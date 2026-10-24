#!/usr/bin/env python3
"""Prints flowers as inline SVG for a slide: a person's own flower, drawn from their name exactly
the same way every time (5 to 8 petals, two shades from its palette, a turn), or the hub's mark.

  python flower.py "Mara Quill" 96   -> <svg width="96" height="96" viewBox="2 0 36 36" …>…</svg>
  python flower.py --hub 160          -> the six-petal flower at 160px

The same name always gives the same flower. Paste the output where the slide needs it (Petal template).
"""
import argparse

OWN = [["#D77F9C", "#F2C4D3", "#9E3F62"], ["#C0577C", "#ECB3C6", "#7D2F4B"], ["#D77F9C", "#B9D3BF", "#9E3F62"],
       ["#B56D8C", "#F3D4C0", "#7D3B57"], ["#E39AAE", "#CFC3E6", "#A9506F"], ["#C86A86", "#F1DFA6", "#8A3A56"]]


def own(name, size):
    h = 2166136261
    for c in name:
        h ^= ord(c)
        h = (h * 16777619) & 0xFFFFFFFF
    n = 5 + (h % 4)
    a, b, core = OWN[(h >> 3) % len(OWN)]
    pointed = (h >> 7) % 2 == 1
    turn = (h >> 9) % 60
    parts = []
    for i in range(n):
        tr = f"rotate({turn + i * 360 / n:.1f} 20 18)"
        fill = b if i % 2 else a
        if pointed:
            parts.append(f'<path d="M20 18C16.2 13.4 16.6 6.6 20 3.4C23.4 6.6 23.8 13.4 20 18Z" fill="{fill}" transform="{tr}"/>')
        else:
            parts.append(f'<ellipse cx="20" cy="10.6" rx="{4 if n > 6 else 4.8}" ry="7" fill="{fill}" opacity=".92" transform="{tr}"/>')
    return f'<svg width="{size}" height="{size}" viewBox="2 0 36 36" aria-label="{name}’s flower">{"".join(parts)}<circle cx="20" cy="18" r="3.3" fill="{core}"/></svg>'


def hub(size, a="#D77F9C", b="#F2C4D3", core="#A34A69"):
    petals = "".join(f'<ellipse cx="20" cy="10.6" rx="4.7" ry="7.4" fill="{a if i % 2 == 0 else b}" transform="rotate({i * 60} 20 18)"/>' for i in range(6))
    return f'<svg width="{size}" height="{size}" viewBox="5 3 30 30" aria-label="Flower mark">{petals}<circle cx="20" cy="18" r="3.4" fill="{core}"/></svg>'


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("name", nargs="?")
    ap.add_argument("size", nargs="?", type=int, default=96)
    ap.add_argument("--hub", action="store_true")
    a = ap.parse_args()
    if a.hub:
        print(hub(a.size if a.name is None else int(a.name)))
    else:
        if not a.name:
            ap.error("give a name, or --hub")
        print(own(a.name, a.size))
