-- {{< chart chart-id >}}
-- Reads data/charts/<chart-id>.csv and the chart's entry in data/charts/charts.yml.
-- Web: writes the data into a <figure>; assets/site-scripts.html draws and animates it.
-- PDF (Typst): draws the same bars as a static chart, so both always show the same numbers.

local COLOURS = {
  ["health-care"] = "#4A6FA8",      -- Indigo
  ["social-care"] = "#2E6F5E",      -- Pine
  ["social-security"] = "#D4A24C",  -- Ochre
}

local function project_root()
  return quarto.project.directory or "."
end

local function read_file(path)
  local f = io.open(path, "r")
  if not f then return nil end
  local s = f:read("a"); f:close(); return s
end

-- Minimal reader for charts.yml (id: then indented key: value lines)
local function read_meta(id)
  local s = read_file(project_root() .. "/data/charts/charts.yml") or ""
  local meta, cur = {}, nil
  for line in s:gmatch("[^\r\n]+") do
    if not line:match("^%s*#") then
      local top = line:match("^([%w%-]+):%s*$")
      if top then cur = top
      elseif cur == id then
        local k, v = line:match("^%s+([%w%-_]+):%s*(.-)%s*$")
        if k then meta[k] = (v:gsub('^"(.*)"$', "%1")) end
      end
    end
  end
  return meta
end

local function parse_csv_line(line)
  local out, field, inq, i = {}, "", false, 1
  while i <= #line do
    local c = line:sub(i, i)
    if inq then
      if c == '"' then
        if line:sub(i + 1, i + 1) == '"' then field = field .. '"'; i = i + 1 else inq = false end
      else field = field .. c end
    else
      if c == '"' then inq = true
      elseif c == "," then table.insert(out, field); field = ""
      else field = field .. c end
    end
    i = i + 1
  end
  table.insert(out, field)
  return out
end

local function read_rows(id)
  local s = read_file(project_root() .. "/data/charts/" .. id .. ".csv")
  if not s then return nil end
  local rows, header = {}, nil
  for line in s:gmatch("[^\r\n]+") do
    local f = parse_csv_line(line)
    if not header then header = f
    else
      local r = {}
      for k, name in ipairs(header) do r[name] = f[k] or "" end
      table.insert(rows, r)
    end
  end
  return rows
end

local function thousands(n)
  local s = string.format("%d", math.floor(n + 0.5))
  local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
  return (out:gsub("^,", ""))
end

local function fmt(v, unit)
  if unit == "bn" then return "£" .. string.format("%.1f", v) .. "bn" end
  return "£" .. thousands(v) .. "m"
end

local function json_str(s)
  s = tostring(s or "")
  s = s:gsub("\\", "\\\\"):gsub('"', '\\"'):gsub("\n", " ")
  return '"' .. s .. '"'
end

local function html_escape(s)
  return (tostring(s or ""):gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"):gsub('"', "&quot;"):gsub("'", "&#39;"))
end

local function typst_str(s)
  return '"' .. tostring(s or ""):gsub("\\", "\\\\"):gsub('"', '\\"') .. '"'
end

return {
  ["chart"] = function(args)
    local id = pandoc.utils.stringify(args[1] or "")
    local meta = read_meta(id)
    local rows = read_rows(id)
    if not rows then
      return pandoc.Para({ pandoc.Strong({ pandoc.Str("[Missing chart data: data/charts/" .. id .. ".csv]") }) })
    end
    local unit = meta.unit or "m"
    local max = tonumber(meta["scale-max"]) or 0
    for _, r in ipairs(rows) do max = math.max(max, tonumber(r.value) or 0) end
    local default_colour = meta.colour or "health-care"

    if quarto.doc.is_format("html") then
      local parts = {}
      for _, r in ipairs(rows) do
        local colour = r.colour ~= "" and r.colour or default_colour
        local total = colour == "total"
        if total then colour = default_colour end
        table.insert(parts, string.format('{"label":%s,"v":%s,"pct":%s,"total":%s,"colour":%s,"note":%s}',
          json_str(r.label), tonumber(r.value) or 0, json_str(r.share), total and "true" or "false", json_str(colour), json_str(r.note)))
      end
      local data = string.format('{"title":%s,"source":%s,"unit":%s,"max":%s,"rows":[%s]}',
        json_str(meta.title), json_str(meta.source), json_str(unit), max, table.concat(parts, ","))
      -- Static table inside the figure so the numbers are readable without JavaScript
      local trs = {}
      for _, r in ipairs(rows) do
        table.insert(trs, "<tr><td>" .. html_escape(r.label) .. "</td><td class=\"r\">" .. fmt(tonumber(r.value) or 0, unit) .. "</td><td class=\"r\">" .. html_escape(r.share) .. "</td></tr>")
      end
      local html = '<figure class="bdf-chart" id="chart-' .. id .. '" data-chart=\'' .. html_escape(data) .. '\'>'
        .. '<figcaption class="bdf-chart-title">' .. html_escape(meta.title) .. '</figcaption>'
        .. '<table class="bdf-chart-table"><thead><tr><th>Category</th><th class="r">Spend</th><th class="r">Share</th></tr></thead><tbody>'
        .. table.concat(trs) .. '</tbody></table>'
        .. '<p class="bdf-chart-source">' .. html_escape(meta.source) .. '</p></figure>'
      return pandoc.RawBlock("html", html)
    elseif quarto.doc.is_format("typst") then
      local parts = {}
      for _, r in ipairs(rows) do
        local colour = r.colour ~= "" and r.colour or default_colour
        local total = colour == "total"
        local hex = COLOURS[total and default_colour or colour] or "#4A6FA8"
        local label = fmt(tonumber(r.value) or 0, unit) .. (r.share ~= "" and (" (" .. r.share .. ")") or "")
        table.insert(parts, string.format("(%s, %s, %s, rgb(%s), %s)", typst_str(r.label), tonumber(r.value) or 0,
          typst_str(label), typst_str(hex), total and "true" or "false"))
      end
      local code = string.format("#bdf-chart(title: %s, source: %s, max: %s, rows: (%s,))",
        typst_str(meta.title), typst_str(meta.source), max, table.concat(parts, ", "))
      return pandoc.RawBlock("typst", code)
    else
      -- Any other format: a plain table
      local lines = { "| Category | Spend | Share |", "|---|---:|---:|" }
      for _, r in ipairs(rows) do table.insert(lines, "| " .. r.label .. " | " .. fmt(tonumber(r.value) or 0, unit) .. " | " .. r.share .. " |") end
      return pandoc.read(table.concat(lines, "\n") .. "\n\n: " .. (meta.title or ""), "markdown").blocks
    end
  end
}
