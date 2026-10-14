# Better Dying Fund website

The home page and the Phase 1 report, built with [Quarto](https://quarto.org) and published to GitHub Pages.
The report's web page and its PDF are made from the same files, so they always match.

## How the report is published (versions)

The report is written in Google Docs. Each published version is a snapshot of that doc.

1. **Freeze the doc.** Make a copy of it (File → Make a copy, untick "Copy comments"), accept or reject
   suggestions, and delete the "CUT FOR SAFEKEEPING" section. This repository is public, so the .docx you
   upload is public too: anything in it, including comments, can be read.
2. **Download the copy.** In Google Docs: File → Download → Microsoft Word (.docx).
3. **Name it with the version**, for example `report-v1.1.docx`.
4. **Upload it to the `import/` folder** of this repository (on github.com: open the folder,
   Add file → Upload files, then Commit changes).

That's it. Within a few minutes GitHub converts the doc, rebuilds the site and the PDF,
and saves the PDF as a release called `report-v1.1` (see the repository's Releases page,
which the report links to as "Previous versions").

Keep older .docx files in `import/` as the record of each version.

### Charts

Charts are drawn from the data files in `data/charts/`, one CSV per chart, with titles and
sources in `data/charts/charts.yml`.

- **To change a number**, edit the chart's CSV on github.com and commit. The web chart and the PDF both update.
- **The three charts in Chapter 4** are recognised automatically from the pictures in the doc.
- **To add a new chart**, add a CSV and an entry in `charts.yml`, then type `[chart: your-chart-id]`
  on its own line in the Google Doc where the chart should go.

### Things the import relies on

- Chapters start with a Heading 1 that begins "Chapter", plus Executive Summary, Conclusion and Bibliography.
  Any other Heading 1 becomes a section inside the chapter it sits in.
- Everything from the heading "CUT FOR SAFEKEEPING" onwards is left out.
- One-cell boxes in the doc become pull quotes (text starting with a quotation mark) or case studies
  (text starting "Case study" or "Funding case study").

## Name, contact and fonts

- The organisation name, tagline and contact are in `_variables.yml`. Change them there.
- Colours follow the brand palette in the Figma file and are set in `assets/theme.scss`.
- ABC Arizona needs a web licence from Dinamo. Put the `.woff2` files in `assets/fonts/` and uncomment the
  `@font-face` lines at the top of `assets/theme.scss`. For the PDF, put the `.otf` files in the same folder.
  Until then free fallback fonts are used.

## Working on it locally (optional)

Install Quarto, then run `quarto preview` in this folder. To convert a doc by hand:
`python scripts/import_gdoc.py import/report-v1.1.docx`.
