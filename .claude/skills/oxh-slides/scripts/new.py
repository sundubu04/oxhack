#!/usr/bin/env python3
"""Starts a deck folder from a template: copies the chosen slides in the chosen order, sets the title, keeps the
sections that still have slides, and renumbers the page numbers in the footers.

  python new.py paper ~/decks/clinic-proposal --title "Clinic proposal"
      -> all 16 Paper slides in ~/decks/clinic-proposal/project/
  python new.py grid ~/decks/q4 --slides cover,findings,bars,line,table,close
      -> six slides, pages 01 to 06
  python new.py grid ~/decks/q4 --slides cover,pie   -> 'grid has no slide "pie" (cover, palette, …)', exit 1

The folder is then ready for preview.py, check.py and the Artifact tool (root = the folder). It refuses a
folder that already holds a project/.
"""
import argparse
import datetime
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATES = os.path.join(os.path.dirname(HERE), "assets", "templates")
PAGE = re.compile(r'(<p style="position:absolute;right:\d+px;bottom:64px;width:120px;[^"]*">)(\d+)(</p>)')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("template", choices=sorted(os.listdir(TEMPLATES)))
    ap.add_argument("dest")
    ap.add_argument("--title")
    ap.add_argument("--slides", help="comma-separated slide ids, in deck order; default: all")
    a = ap.parse_args()

    src = os.path.join(TEMPLATES, a.template, "project")
    deck = json.load(open(os.path.join(src, "deck.json")))
    order = deck["order"]
    pick = [s.strip() for s in a.slides.split(",")] if a.slides else list(order)
    missing = [s for s in pick if s not in order]
    if missing:
        sys.exit(f'{a.template} has no slide "{missing[0]}" ({", ".join(order)})')
    out = os.path.join(os.path.expanduser(a.dest), "project")
    if os.path.exists(out):
        sys.exit(f"{out} already exists; pick an empty folder")
    os.makedirs(os.path.join(out, "slides"))

    # A section survives if any of its slides is picked; it then starts at its first picked slide.
    starts = sorted(((order.index(v["start"]), k, v) for k, v in deck.get("sections", {}).items()))
    sections = {}
    for i, (pos, key, v) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(order)
        members = [s for s in pick if pos <= order.index(s) < end]
        if members:
            sections[key] = {"description": v["description"], "start": members[0]}

    for n, sid in enumerate(pick, 1):
        html = open(os.path.join(src, "slides", sid + ".html")).read()
        html = PAGE.sub(lambda m: f"{m.group(1)}{n:0{len(m.group(2))}d}{m.group(3)}", html)
        open(os.path.join(out, "slides", sid + ".html"), "w").write(html)

    deck.update({"createdOnFiles": {"v": 1, "at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")},
                 "title": a.title or deck["title"], "order": pick, "cover": pick[0], "sections": sections})
    json.dump(deck, open(os.path.join(out, "deck.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(pick)} {a.template} slides in {out}: {', '.join(pick)}")


if __name__ == "__main__":
    main()
