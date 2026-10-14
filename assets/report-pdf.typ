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
