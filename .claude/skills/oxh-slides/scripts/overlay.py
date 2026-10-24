#!/usr/bin/env python3
"""Recolours a deck built from a template with an overlay, so the template itself stays as it is. An overlay is a
colour map in assets/templates/<name>/overlay-<overlay>.json; the pink overlay swaps each template's accent for the UI kit's
pink (#B23A6E and its tints) and leaves type, layout and neutrals alone.

  python overlay.py ~/decks/q4 --template grid            -> grid's signal red becomes the UI kit's pink, in place
  python overlay.py ~/decks/q4 --template grid --dry-run  -> lists what would change
  python check.py ~/decks/q4 --template grid --overlay pink    -> checks the recoloured deck

Only colours in the map change, in slide styles and in inline SVG fills and strokes.
"""
import argparse
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATES = os.path.join(os.path.dirname(HERE), "assets", "templates")


def load(template, overlay):
    p = os.path.join(TEMPLATES, template, f"overlay-{overlay}.json")
    m = json.load(open(p))
    return {k.upper(): v.upper() for k, v in m["colours"].items()}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder")
    ap.add_argument("--template", required=True)
    ap.add_argument("--overlay", default="pink")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    cmap = load(a.template, a.overlay)
    slides = os.path.join(a.folder, "project", "slides")
    total = 0
    for f in sorted(os.listdir(slides)):
        if not f.endswith(".html"):
            continue
        p = os.path.join(slides, f)
        src = open(p).read()
        n = 0

        def swap(m):
            nonlocal n
            c = m.group(0).upper()
            if c in cmap:
                n += 1
                return cmap[c]
            return m.group(0)
        out = re.sub(r"#[0-9A-Fa-f]{6}\b", swap, src)
        if n:
            total += n
            print(f"{f[:-5]}: {n} colour(s)")
            if not a.dry_run:
                open(p, "w").write(out)
    print(f"{a.overlay} overlay on {a.template}: {total} colour(s) {'would change' if a.dry_run else 'changed'}.")


if __name__ == "__main__":
    main()
