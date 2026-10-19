// PDF styling and the static chart used by the chart shortcode.
// ABC Arizona is used when its font files are in assets/fonts; otherwise Libertinus Serif (built into Typst).
#set text(font: ("ABC Arizona Text", "Libertinus Serif"), fill: rgb("#0F2B26"))
#show heading: set text(font: ("ABC Arizona Text", "Libertinus Serif"), weight: "medium")
#show heading.where(level: 1): set text(size: 19pt)
#show heading.where(level: 1): set block(above: 2.6em, below: 1em)
#show link: set text(fill: rgb("#C45A3C"))

#let bdf-chart(title: "", source: "", max: 1, rows: ()) = block(breakable: false, width: 100%, fill: rgb("#F4F6F7"), inset: 12pt, radius: 4pt, above: 1.2em, below: 1.2em)[
  #set text(size: 8.5pt)
  #text(weight: "bold", size: 9.5pt)[#title]
  #v(6pt)
  #grid(columns: (32%, 1fr), row-gutter: 6pt, column-gutter: 8pt,
    ..rows.map(r => (
      align(right + horizon, if r.at(4) { text(weight: "bold")[#r.at(0)] } else { r.at(0) }),
      layout(size => {
        let w = size.width * 0.72 * (r.at(1) / max)
        let fill = if r.at(4) { r.at(3).transparentize(68%) } else { r.at(3) }
        stack(dir: ltr, spacing: 5pt,
          rect(width: calc.max(w, 1pt), height: 11pt, fill: fill, radius: (right: 2pt)),
          align(horizon, r.at(2)))
      }),
    )).flatten()
  )
  #v(6pt)
  #text(size: 7.5pt, fill: rgb("#5C6F6B"))[#source]
]

// Report styles from Figma: a thin rule above each chapter, tables as sage cards
#show heading.where(level: 1): it => {
  v(1.2em)
  line(length: 100%, stroke: 0.6pt + rgb("#C7CDD1"))
  v(0.9em)
  it
}
#show heading.where(level: 2): set text(size: 14.5pt)
#show heading.where(level: 3): set text(size: 13pt, weight: "regular", fill: rgb("#4B605C"))
#set table(
  fill: none,
  inset: (left: 0pt, right: 10pt, y: 6pt),
  stroke: (x, y) => if y == 0 { (bottom: 1pt + rgb("#0F2B26")) } else { (bottom: 0.6pt + white) },
)
#show table.cell.where(y: 0): set text(weight: "bold")
#show table.cell.where(x: 0): set text(weight: "bold")
#show table: it => block(fill: rgb("#DDEAE4"), radius: 5pt, inset: (x: 11pt, y: 5pt), width: 100%, it)

// Sans text (ABC Arizona Sans): tables, captions and the contents
#let bdf-sans = ("ABC Arizona Sans", "Inter", "Libertinus Serif")
#show table: set text(font: bdf-sans, size: 9.5pt)
#show outline: set text(font: bdf-sans)
#show footnote.entry: set text(font: bdf-sans)
