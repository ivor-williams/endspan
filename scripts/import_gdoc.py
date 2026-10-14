#!/usr/bin/env python3
"""Turn a Google Docs export (.docx) of the report into the site's chapter files.

Usage:
    python scripts/import_gdoc.py import/report-v1.0.docx

What it does, in order:
  1. Converts the .docx with pandoc (bundled with Quarto) into pandoc's document tree.
  2. Drops everything before "Executive Summary" (version notes) and everything from
     "CUT FOR SAFEKEEPING" onwards.
  3. Cleans the Google Docs formatting: empty headings, bold inside headings,
     paragraphs that were styled as headings, underlined links.
  4. Turns the one-cell layout tables Google Docs uses for quotes and case studies
     into styled blocks (pull quotes, case studies, definitions).
  5. Replaces chart images with live charts. A chart is matched either by a line
     in the doc reading  [chart: chart-id]  or by the image's fingerprint listed in
     data/charts/charts.yml (so unchanged images are recognised automatically).
  6. Writes one file per chapter into report/chapters/ and the images into report/media/.

The version number is read from the file name (report-v1.0.docx -> 1.0) and written
to report/_version.yml together with the "Last updated" date found in the doc.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHAPTER_DIR = os.path.join(ROOT, "report", "chapters")
MEDIA_DIR = os.path.join(ROOT, "report", "media")
CHARTS_YML = os.path.join(ROOT, "data", "charts", "charts.yml")


def pandoc_bin():
    for cand in (os.environ.get("PANDOC"), shutil.which("pandoc"), shutil.which("quarto")):
        if cand:
            return [cand, "pandoc"] if cand.endswith("quarto") else [cand]
    sys.exit("pandoc not found. Install Quarto (it bundles pandoc) or pandoc itself.")


def load_chart_map():
    """Very small YAML reader for charts.yml: we only need id and image-sha1 keys."""
    charts, cur = {}, None
    if not os.path.exists(CHARTS_YML):
        return {}
    for line in open(CHARTS_YML, encoding="utf-8"):
        m = re.match(r"^([a-z0-9-]+):\s*$", line)
        if m:
            cur = m.group(1)
            charts[cur] = {}
            continue
        m = re.match(r"^\s+([a-z0-9_-]+):\s*(.*)$", line)
        if m and cur:
            charts[cur][m.group(1)] = m.group(2).strip().strip('"')
    by_sha = {}
    for cid, meta in charts.items():
        for sha in re.split(r"[,\s]+", meta.get("image-sha1", "")):
            if sha:
                by_sha[sha] = cid
    return by_sha


# ---------- pandoc AST helpers ----------
def S(s):
    return {"t": "Str", "c": s}


def text_of(node):
    out = []

    def walk(o):
        if isinstance(o, dict):
            t = o.get("t")
            if t == "Str":
                out.append(o["c"])
            elif t in ("Space", "SoftBreak", "LineBreak"):
                out.append(" ")
            else:
                walk(o.get("c"))
        elif isinstance(o, list):
            for i in o:
                walk(i)

    walk(node)
    return re.sub(r"\s+", " ", "".join(out)).strip()


def strip_inline(inlines, kinds):
    """Unwrap Strong/Underline etc. so headings and links are plain."""
    res = []
    for i in inlines:
        if isinstance(i, dict) and i.get("t") in kinds:
            res.extend(strip_inline(i["c"], kinds))
        elif isinstance(i, dict) and i.get("t") == "Link":
            attr, content, target = i["c"]
            res.append({"t": "Link", "c": [attr, strip_inline(content, kinds), target]})
        else:
            res.append(i)
    return res


def fix_underline(o):
    if isinstance(o, list):
        out = []
        for x in o:
            if isinstance(x, dict) and x.get("t") == "Underline":
                out.extend(fix_underline(x["c"]))
            else:
                out.append(fix_underline(x))
        return out
    if isinstance(o, dict) and "c" in o:
        o = dict(o)
        o["c"] = fix_underline(o["c"])
    return o


def table_cells(tbl):
    attr, cap, colspecs, head, bodies, foot = tbl["c"]
    rows = list(head[1])
    for b in bodies:
        rows += b[2] + b[3]
    rows += foot[1]
    return [[c[4] for c in r[1]] for r in rows], len(colspecs)


def div(classes, blocks):
    return {"t": "Div", "c": [["", classes, []], blocks]}


def raw_line(s):
    return {"t": "RawBlock", "c": ["markdown", s]}


def convert_table(tbl):
    rows, ncols = table_cells(tbl)
    # One row, first column empty: a callout box (quote or case study)
    if len(rows) == 1 and ncols == 2 and not text_of(rows[0][0]):
        blocks = rows[0][1]
        t = text_of(blocks)
        if re.match(r'^["“‘\']', t):
            kind = "pullquote"
        elif re.match(r"^(Funding case study|Philanthrop\w* case study|Case study|Funder profiles)", t, re.I):
            kind = "case-study"
        else:
            kind = "callout"
        return [div([kind], [fix_plain(b) for b in blocks])]
    # One row, several columns: definitions side by side
    if len(rows) == 1 and ncols >= 3:
        return [div(["definitions"], [div(["definition"], [fix_plain(b) for b in cell]) for cell in rows[0]])]
    return [simplify_table(tbl)]


def cell_inlines(blocks):
    """Flatten a cell's blocks into one line of inlines (line breaks between paragraphs)."""
    out = []
    for b in blocks:
        t = b.get("t")
        if t in ("Para", "Plain"):
            inl = b["c"]
        elif t == "Header":
            inl = strip_inline(b["c"][2], ("Strong",))
            inl = [{"t": "Strong", "c": inl}]
        elif t in ("BulletList", "OrderedList"):
            items = b["c"] if t == "BulletList" else b["c"][1]
            inl = []
            for it in items:
                if inl:
                    inl.append({"t": "LineBreak"})
                inl += [S("\u2022"), {"t": "Space"}] + cell_inlines(it)
        else:
            inl = [S(text_of(b))]
        if not inl:
            continue
        if out:
            out.append({"t": "LineBreak"})
        out += inl
    return out


def simplify_table(tbl):
    """Google Docs tables often carry merged cells and headings inside cells, which break
    Markdown tables. Rebuild as a plain grid: one line of text per cell, no merged cells."""
    attr, cap, colspecs, head, bodies, foot = tbl["c"]
    rows = [r[1] for r in head[1]] + [r[1] for b in bodies for r in b[2] + b[3]]
    grid = []
    for r in rows:
        line = []
        for c in r:
            line.append(cell_inlines(c[4]))
            for _ in range(max(1, c[3]) - 1):
                line.append([])
        grid.append(line)
    ncol = max(len(r) for r in grid) if grid else 0
    for r in grid:
        r += [[]] * (ncol - len(r))
    keep = [j for j in range(ncol) if any(text_of(r[j]) for r in grid)]
    grid = [[r[j] for j in keep] for r in grid]
    def mkrow(cells):
        return [["", [], []], [[["", [], []], {"t": "AlignDefault"}, 1, 1, ([{"t": "Plain", "c": c}] if c else [])] for c in cells]]
    n = len(keep)
    specs = [[{"t": "AlignDefault"}, {"t": "ColWidthDefault"}] for _ in range(n)]
    head_rows = [mkrow(grid[0])] if grid else []
    body_rows = [mkrow(r) for r in grid[1:]]
    return {"t": "Table", "c": [["", [], []], [None, []], specs, [["", [], []], head_rows],
                                 [[["", [], []], 0, [], body_rows]], [["", [], []], []]]}


def fix_plain(b):
    if b.get("t") == "Plain":
        return {"t": "Para", "c": b["c"]}
    return b


def image_target(block):
    """Return the image path if this block is a lone image (Para/Plain with one Image)."""
    if block.get("t") in ("Para", "Plain"):
        ims = [i for i in block["c"] if isinstance(i, dict) and i.get("t") == "Image"]
        others = [i for i in block["c"] if not (isinstance(i, dict) and i.get("t") in ("Image", "Space", "SoftBreak", "LineBreak"))]
        if len(ims) == 1 and not others:
            return ims[0]["c"][2][0]
    if block.get("t") == "Figure":
        ims = []

        def walk(o):
            if isinstance(o, dict):
                if o.get("t") == "Image":
                    ims.append(o["c"][2][0])
                walk(o.get("c"))
            elif isinstance(o, list):
                for x in o:
                    walk(x)

        walk(block["c"])
        return ims[0] if len(ims) == 1 else None
    return None


def slug(s):
    s = re.sub(r"^chapter\s+(\d+)\s*[:.-]\s*", r"\1-", s.lower())
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:60]


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    docx = os.path.abspath(sys.argv[1])
    m = re.search(r"v(\d+(?:\.\d+)*)", os.path.basename(docx))
    version = m.group(1) if m else "draft"

    tmp = tempfile.mkdtemp()
    subprocess.run(pandoc_bin() + [docx, "-t", "json", "--extract-media", tmp, "-o", os.path.join(tmp, "ast.json")], check=True)
    ast = json.load(open(os.path.join(tmp, "ast.json"), encoding="utf-8"))
    by_sha = load_chart_map()

    blocks = ast["blocks"]
    # Find the "Last updated" date before trimming
    updated = ""
    for b in blocks[:20]:
        t = text_of(b)
        mm = re.match(r"Last updated:\s*(.+)$", t, re.I)
        if mm:
            updated = mm.group(1).strip()

    # Trim front matter and the cut section
    start = next((i for i, b in enumerate(blocks) if b["t"] == "Header" and text_of(b["c"][2]).lower().startswith("executive summary")), 0)
    end = next((i for i, b in enumerate(blocks) if b["t"] == "Header" and "cut for safekeeping" in text_of(b["c"][2]).lower()), len(blocks))
    blocks = blocks[start:end]

    os.makedirs(MEDIA_DIR, exist_ok=True)
    out_blocks = []
    charts_used, images_kept = [], []
    i = 0
    while i < len(blocks):
        b = fix_underline(blocks[i])
        t = b["t"]
        if t == "Header":
            level, attr, inl = b["c"]
            txt = text_of(inl)
            if not txt:
                i += 1
                continue
            if len(txt) > 120:  # a paragraph that was styled as a heading
                out_blocks.append({"t": "Para", "c": strip_inline(inl, ("Strong",))})
                i += 1
                continue
            inl = strip_inline(inl, ("Strong", "Emph"))
            # trim trailing spaces
            while inl and inl[-1].get("t") in ("Space", "SoftBreak"):
                inl = inl[:-1]
            out_blocks.append({"t": "Header", "c": [level, ["", [], []], inl]})
        elif t == "Table":
            out_blocks.extend(convert_table(b))
        elif image_target(b):
            src = image_target(b)
            path = src if os.path.exists(src) else os.path.join(tmp, "media", os.path.basename(src))
            sha = hashlib.sha1(open(path, "rb").read()).hexdigest()
            cid = by_sha.get(sha)
            if cid:
                # Drop the doc's own chart title (paragraph just before) and source line (just after)
                if out_blocks and out_blocks[-1]["t"] == "Para" and len(text_of(out_blocks[-1])) < 140 and not text_of(out_blocks[-1]).endswith("."):
                    out_blocks.pop()
                out_blocks.append(raw_line('{{< chart %s >}}' % cid))
                charts_used.append(cid)
                if i + 1 < len(blocks) and text_of(blocks[i + 1]).startswith("Source:"):
                    # The source line is replaced by the chart's own caption. Google Docs sometimes
                    # keeps the next paragraph in the same block after a line break: keep that part.
                    nxt = blocks[i + 1]
                    inl = nxt["c"] if nxt["t"] in ("Para", "Plain") else []
                    brk = next((k for k, x in enumerate(inl) if x.get("t") == "LineBreak"), None)
                    rest = inl[brk + 1:] if brk is not None else []
                    while rest and rest[0].get("t") in ("LineBreak", "Space", "SoftBreak"):
                        rest = rest[1:]
                    if text_of(rest):
                        blocks[i + 1] = {"t": "Para", "c": rest}
                    else:
                        i += 1
            else:
                name = "figure-" + sha[:10] + os.path.splitext(path)[1]
                shutil.copy(path, os.path.join(MEDIA_DIR, name))
                images_kept.append(name)
                out_blocks.append({"t": "Para", "c": [{"t": "Image", "c": [["", [], []], [], ["media/" + name, ""]]}]})
        elif t == "Para" and re.match(r"^\[chart:\s*([a-z0-9-]+)\s*\]$", text_of(b), re.I):
            cid = re.match(r"^\[chart:\s*([a-z0-9-]+)\s*\]$", text_of(b), re.I).group(1).lower()
            out_blocks.append(raw_line('{{< chart %s >}}' % cid))
            charts_used.append(cid)
        else:
            out_blocks.append(b)
        i += 1

    # Split into chapters at level-1 headings and normalise heading levels inside each
    # Any image still pointing at the temporary folder (e.g. inside a table or a box): copy it in
    def relink(o):
        if isinstance(o, dict):
            if o.get("t") == "Image":
                src = o["c"][2][0]
                if not src.startswith("media/"):
                    path = src if os.path.exists(src) else os.path.join(tmp, "media", os.path.basename(src))
                    if os.path.exists(path):
                        sha = hashlib.sha1(open(path, "rb").read()).hexdigest()
                        name = "figure-" + sha[:10] + os.path.splitext(path)[1]
                        shutil.copy(path, os.path.join(MEDIA_DIR, name))
                        images_kept.append(name)
                        o["c"][2][0] = "media/" + name
            for v in o.values():
                relink(v)
        elif isinstance(o, list):
            for x in o:
                relink(x)
    relink(out_blocks)

    # Only real chapters start a new file; any other top-level heading (e.g. "Example loops")
    # becomes a section inside the chapter it sits in.
    top = re.compile(r"^(chapter\s+\d+|executive summary|conclusion|bibliography|references|appendix)", re.I)
    for b in out_blocks:
        if b["t"] == "Header" and b["c"][0] == 1 and not top.match(text_of(b["c"][2])):
            b["c"][0] = 2
    chapters, cur = [], None
    for b in out_blocks:
        if b["t"] == "Header" and b["c"][0] == 1:
            cur = {"title": text_of(b["c"][2]), "blocks": [b]}
            chapters.append(cur)
        elif cur is not None:
            cur["blocks"].append(b)

    shutil.rmtree(CHAPTER_DIR, ignore_errors=True)
    os.makedirs(CHAPTER_DIR)
    files = []
    for n, ch in enumerate(chapters):
        levels = sorted({b["c"][0] for b in ch["blocks"] if b["t"] == "Header" and b["c"][0] > 1})
        remap = {lv: idx + 2 for idx, lv in enumerate(levels)}
        for b in ch["blocks"]:
            if b["t"] == "Header" and b["c"][0] > 1:
                b["c"][0] = min(remap[b["c"][0]], 4)
        doc = {"pandoc-api-version": ast["pandoc-api-version"], "meta": {}, "blocks": ch["blocks"]}
        jpath = os.path.join(tmp, "ch.json")
        json.dump(doc, open(jpath, "w", encoding="utf-8"))
        fname = "%02d-%s.qmd" % (n, slug(ch["title"]))
        subprocess.run(pandoc_bin() + [jpath, "-f", "json", "-t", "markdown-raw_html-bracketed_spans-native_spans-link_attributes-header_attributes-simple_tables-multiline_tables-grid_tables",
                                       "--wrap=none", "-o", os.path.join(CHAPTER_DIR, fname)], check=True)
        # Footnote labels must be unique across chapters once they are joined into one page
        fpath = os.path.join(CHAPTER_DIR, fname)
        md = open(fpath, encoding="utf-8").read()
        md = re.sub(r"\[\^(\d+)\]", lambda m: "[^c%d-%s]" % (n, m.group(1)), md)
        open(fpath, "w", encoding="utf-8").write(md)
        files.append(fname)

    with open(os.path.join(ROOT, "report", "_chapters.qmd"), "w", encoding="utf-8") as f:
        f.write("<!-- Generated by scripts/import_gdoc.py. Do not edit by hand. -->\n\n")
        for fname in files:
            f.write("{{< include chapters/%s >}}\n\n" % fname)
    with open(os.path.join(ROOT, "report", "_version.yml"), "w", encoding="utf-8") as f:
        f.write('report-version: "%s"\nreport-updated: "%s"\nreport-source: "%s"\n' % (version, updated, os.path.basename(docx)))

    print("Version %s (last updated %s)" % (version, updated or "unknown"))
    print("Chapters: %d -> report/chapters/" % len(files))
    print("Live charts: %s" % (", ".join(charts_used) or "none"))
    print("Images kept as pictures: %d" % len(images_kept))
    missing = [c for c in charts_used if not os.path.exists(os.path.join(ROOT, "data", "charts", c + ".csv"))]
    if missing:
        print("WARNING: no data file for chart(s): " + ", ".join(missing))


if __name__ == "__main__":
    main()
