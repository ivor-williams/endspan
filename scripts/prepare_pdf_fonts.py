"""Re-save the desktop fonts in assets/fonts-pdf so Typst can read them.

Typst needs a font's table directory in sorted order; Dinamo's OTFs list theirs
unsorted. Re-saving with fontTools re-sorts the directory only: outlines, metrics
and names are unchanged. The re-saved files are used at build time and never committed.
"""
import glob, sys
from fontTools.ttLib import TTFont

for path in sorted(glob.glob(sys.argv[1] + "/*.otf")):
    font = TTFont(path)
    font.save(path)
    print("prepared", path)
