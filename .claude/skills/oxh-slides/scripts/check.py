#!/usr/bin/env python3
"""Checks that a deck keeps to its template's look: colours from the palette, sizes from the type scale,
typefaces from the pairing, a background on every slide, nothing under 24px, no leftover sample text, and the
house taste: no capitals or letter-spaced labels, no page numbers, and a note for every rule a slide draws.

  python check.py ../assets/templates/paper            -> checks the template's own sample deck
  python check.py ~/decks/q4-readout --template grid   -> checks a deck built from the grid template
  a slide using #FF0000 in the paper template          -> 'risks: colour #FF0000 is not in the paper palette', exit 1

Colours are read from style attributes outside <svg>: drawings and charts are checked by eye in preview.py.
Text colour is checked for contrast against the nearest painted <div> or the slide: body text needs 4.5:1,
text of 44px or more 3:1. Labels pinned inside a position:relative host (over a drawing) are skipped.
"""
import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATES = os.path.join(os.path.dirname(HERE), "assets", "templates")
LEFTOVERS = ["Sample data", "Sample quote", "Sample prices", "Sample plan", "Sample terms", "Sample risks", "Sample targets", "Sample dates", "Sample output", "Sample notes", "Placeholder frame", "Recipe:", "[TBD", "Lorem",
             "Loamly", "loamly", "Mara Quill", "Theo Varga", "Ines Okafor", "Vale Growers"]   # the made-up sample company


def lum(hex_):
    h = hex_.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def contrast(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


def tokens(name):
    t = json.load(open(os.path.join(TEMPLATES, name, "tokens.json")))
    colours = {v.upper() for tok in t["color"]["tokens"] for v in ([tok["value"]] if isinstance(tok["value"], str) else tok["value"].values())}
    sizes = {int(float(s["fontSize"].rstrip("px"))) for g in t["type"]["groups"] for s in g["styles"]}
    families = {f.strip().strip("'\"") for fam in t["type"]["families"].values() for f in fam.split(",")}
    return colours, sizes, families


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder")
    ap.add_argument("--template", help="template name; defaults to the folder's own name")
    ap.add_argument("--sample", action="store_true", help="allow sample text (for the templates' own decks)")
    ap.add_argument("--overlay", help="the overlay the deck was recoloured with, e.g. pink; its colours are allowed too")
    a = ap.parse_args()
    name = a.template or os.path.basename(os.path.abspath(a.folder))
    colours, sizes, families = tokens(name)
    if a.overlay:
        om = json.load(open(os.path.join(TEMPLATES, name, f"overlay-{a.overlay}.json")))["colours"]
        colours |= {v.upper() for v in om.values()}
    deck = json.load(open(os.path.join(a.folder, "project", "deck.json")))
    faces = {f["family"] for f in deck.get("faces", {}).values()}
    problems, notes = [], []
    for f in faces - families:
        problems.append(f"deck.json: typeface {f} is not in the {name} pairing")
    slides = os.path.join(a.folder, "project", "slides")
    order = deck.get("order", [])
    for sid in order + sorted({f[:-5] for f in os.listdir(slides) if f.endswith(".html")} - set(order)):
        path = os.path.join(slides, sid + ".html")
        if not os.path.exists(path):
            problems.append(f"{sid}: in the order but has no file")
            continue
        src = open(path).read()
        body = re.sub(r"<aside>.*?</aside>", "", src, flags=re.S)
        svg_free = re.sub(r"<svg.*?</svg>", "", body, flags=re.S)
        sec = re.match(r'<section[^>]*style="([^"]*)"', src)
        bg = re.search(r"background:\s*(#[0-9A-Fa-f]{3,6})\b", sec.group(1)) if sec else None
        if not bg:
            problems.append(f"{sid}: the section sets no background colour")
        styles = " ".join(re.findall(r'style="([^"]*)"', svg_free))
        for c in sorted({c.upper() for c in re.findall(r"#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b", styles)} - colours):
            problems.append(f"{sid}: colour {c} is not in the {name} palette")
        for s in sorted({int(float(x)) for x in re.findall(r"font-size:\s*([\d.]+)px", svg_free)} - sizes):
            problems.append(f"{sid}: {s}px is not on the {name} type scale ({', '.join(map(str, sorted(sizes)))})")
        for fam in sorted({m.strip().strip("'\"") for f in re.findall(r"font-family:\s*([^;\"]+)", svg_free) for m in f.split(",")}):
            if fam not in families and fam.lower() not in ("serif", "sans-serif", "monospace", "arial", "georgia", "courier new", "times new roman", "verdana"):
                problems.append(f"{sid}: typeface {fam} is not in the {name} pairing")
        text_only = re.sub(r"<[^>]+>", " ", svg_free)
        if "text-transform:uppercase" in svg_free or re.search(r"\b[A-Z]{3,}(?:\s+[A-Z]{3,}){2,}\b", text_only):
            problems.append(f"{sid}: text set in capitals (use sentence case)")
        for m_ in re.finditer(r'style="([^"]*letter-spacing:\s*([\d.]+)px[^"]*)"', svg_free):
            fs_ = re.search(r"font-size:\s*(\d+)px", m_.group(1))
            if float(m_.group(2)) > 0.5 and fs_ and int(fs_.group(1)) < 40:
                problems.append(f"{sid}: a letter-spaced label (drop the label; the title carries the slide)")
        for m_ in re.finditer(r'<p style="[^"]*bottom:64px[^"]*">\s*(\d{1,3})\s*</p>', svg_free):
            problems.append(f"{sid}: a page number in the footer (leave it off)")
        rules_ = len(re.findall(r"border(?:-top|-bottom|-left|-right)?:\s*\d+px (?:solid|double)", svg_free))
        if rules_:
            notes.append(f"{sid}: draws {rules_} rule(s) or outline(s); keep each only if it carries information")
        if re.search(r"\s[–—]\s|—", text_only):
            problems.append(f"{sid}: a dash used as punctuation (rewrite the sentence)")
        if not a.sample:
            if re.search(r"\[[a-z][a-z ,]{2,40}\]", text_only):
                problems.append(f"{sid}: a [bracketed] placeholder is still on the slide")
            for w in LEFTOVERS:
                if w in src:
                    problems.append(f"{sid}: leftover template text '{w}'")
        # Text colour on the section background: each element that sets color and font-size, outside painted boxes.
        if bg:
            for m in re.finditer(r'<(p|h1|h2|h3|li)\s[^>]*style="([^"]*)"', svg_free):
                st = m.group(2)
                if "background" in st:
                    continue
                col = re.search(r"(?<!-)color:\s*(#[0-9A-Fa-f]{6})", st)
                fs = re.search(r"font-size:\s*(\d+)px", st)
                if col and fs and "position:absolute" in st and in_host(svg_free, m.start()):
                    continue  # a label pinned over a drawing or a shape: its ground is not knowable from the markup
                if col and fs:
                    under = painted(svg_free, m.start()) or bg.group(1)
                    need = 3.0 if int(fs.group(1)) >= 44 else 4.5
                    r = contrast(col.group(1), under)
                    if r < need:
                        problems.append(f"{sid}: {col.group(1)} on {under} is {r:.1f}:1 at {fs.group(1)}px (needs {need}:1)")
    for p in problems:
        print(p)
    for n in notes:
        print("note: " + n)
    print(f"{name}: {len(order)} slides, " + ("look OK." if not problems else f"{len(problems)} problem(s).") + (f" {len(notes)} note(s)." if notes else ""))
    sys.exit(1 if problems else 0)


def in_host(src, pos):
    """True when the element at pos sits inside a position:relative <div>, the host for labels over drawings."""
    stack = []
    for m in re.finditer(r"<div\b([^>]*)>|</div>", src[:pos]):
        if m.group(0) == "</div>":
            if stack:
                stack.pop()
        else:
            stack.append("position:relative" in m.group(1))
    return any(stack)


def painted(src, pos):
    """The background colour of the innermost open <div> before pos that paints one (a card or a band),
    which then decides the contrast instead of the slide's; None when the element sits on the slide."""
    stack = []
    for m in re.finditer(r"<div\b([^>]*)>|</div>", src[:pos]):
        if m.group(0) == "</div>":
            if stack:
                stack.pop()
        else:
            c = re.search(r"background:\s*(#[0-9A-Fa-f]{6})", m.group(1))
            stack.append(c.group(1) if c else None)
    return next((c for c in reversed(stack) if c), None)


if __name__ == "__main__":
    main()
