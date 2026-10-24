#!/usr/bin/env python3
"""Renders a Slides-type deck folder locally: a contact sheet, one PNG per slide on request, and a layout
report (text under 24px, words wider than their box, content past the margins or into the footer band).

  python preview.py ../assets/templates/paper                -> ../assets/templates/paper/preview/sheet-1.png …, report on stdout
  python preview.py ../assets/templates/paper --slide market -> also preview/market.png at half size (960 x 540)
  a slide whose table runs into the footer band      -> 'market: flow content ends at y 958, past 920', exit 1

The folder holds project/deck.json and project/slides/<id>.html, as a deck made from the Slides type does.
The page is an approximation of the Slides runtime: <x-connector>, <x-shape> and <x-icon> are drawn by a small
polyfill, and the editor's shrink-to-fit is not imitated, so a box that overflows here overflows there too.
Needs Google Chrome (CHROME= to override the path), network access for Google Fonts, poppler's pdftoppm and
Pillow.
"""
import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

CHROME = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")

# Tag defaults from the Slides format (h1–h3, p sizes, weights and line heights), border-box sizing, no margins.
BASE_CSS = """
@page { size: 1920px 1080px; margin: 0; }
* { margin: 0; box-sizing: border-box; }
html, body { background: #7a7a7a; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
section { width: 1920px; height: 1080px; position: relative; overflow: hidden; break-after: page; }
section:not([style*="display"]), div:not([style*="display"]) { display: flex; flex-direction: column; }
h1 { font-size: 96px; font-weight: 600; line-height: 1.1; }
h2 { font-size: 64px; font-weight: 600; line-height: 1.15; }
h3 { font-size: 44px; font-weight: 600; line-height: 1.2; }
p, li { font-size: 32px; line-height: 1.4; }
ul, ol { padding-left: 1.25em; }
aside { display: none; }
table { border-collapse: collapse; width: 100%; }
td, th { padding: .35em .6em; text-align: left; vertical-align: top; font-weight: 400;
  border: 1px solid color-mix(in srgb, currentColor 16%, transparent); }
th { font-weight: 600; }
x-shape, x-icon, x-connector { display: block; flex: none; }
"""

POLYFILL = r"""
const NS = 'http://www.w3.org/2000/svg';
function svg(w, h) { const s = document.createElementNS(NS, 'svg'); s.setAttribute('width', w); s.setAttribute('height', h);
  s.setAttribute('viewBox', `0 0 ${w} ${h}`); s.style.position = 'absolute'; s.style.left = '0'; s.style.top = '0'; s.style.overflow = 'visible'; s.style.pointerEvents = 'none'; return s; }
function line(s, pts, color, width, dash, headEnd, headStart) {
  const p = document.createElementNS(NS, 'polyline'); p.setAttribute('points', pts.map(q => q.join(',')).join(' '));
  p.setAttribute('fill', 'none'); p.setAttribute('stroke', color); p.setAttribute('stroke-width', width);
  p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); if (dash) p.setAttribute('stroke-dasharray', dash); s.appendChild(p);
  const head = (a, b) => { const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = width * 4, W = width * 2.2;
    const t = document.createElementNS(NS, 'polygon'), x = b[0], y = b[1];
    t.setAttribute('points', `${x},${y} ${x - L * Math.cos(ang) + W * Math.sin(ang)},${y - L * Math.sin(ang) - W * Math.cos(ang)} ${x - L * Math.cos(ang) - W * Math.sin(ang)},${y - L * Math.sin(ang) + W * Math.cos(ang)}`);
    t.setAttribute('fill', color); s.appendChild(t); };
  if (headEnd) head(pts[pts.length - 2], pts[pts.length - 1]); if (headStart) head(pts[1], pts[0]); }
function host(el) { let h = el.parentElement; while (h && h.tagName !== 'SECTION' && getComputedStyle(h).position !== 'relative') h = h.parentElement; return h; }
function num(v, size) { v = String(v || '0').trim(); return v.endsWith('%') ? parseFloat(v) / 100 * size : parseFloat(v); }
for (const c of document.querySelectorAll('x-connector')) {
  const cs = getComputedStyle(c), color = cs.color, width = parseFloat(c.style.borderWidth) || 2;
  const dash = c.style.borderStyle === 'dashed' ? `${width * 3} ${width * 2.5}` : c.style.borderStyle === 'dotted' ? `0 ${width * 2}` : '';
  const head = c.getAttribute('head') || 'end';
  const hs = (c.getAttribute('head-start') || (head === 'both' ? 'filled' : 'none')) !== 'none';
  const he = (c.getAttribute('head-end') || (head === 'none' ? 'none' : 'filled')) !== 'none';
  if (c.hasAttribute('x1')) {
    const h = host(c), W = h.offsetWidth, H = h.offsetHeight;
    const x1 = num(c.getAttribute('x1'), W), y1 = num(c.getAttribute('y1'), H), x2 = num(c.getAttribute('x2'), W), y2 = num(c.getAttribute('y2'), H);
    const r = c.getAttribute('route') || 'straight'; let pts;
    if (r === 'hv') pts = [[x1, y1], [x2, y1], [x2, y2]];
    else if (r === 'vh') pts = [[x1, y1], [x1, y2], [x2, y2]];
    else if (r === 'elbow') pts = Math.abs(x2 - x1) >= Math.abs(y2 - y1) ? [[x1, y1], [(x1 + x2) / 2, y1], [(x1 + x2) / 2, y2], [x2, y2]] : [[x1, y1], [x1, (y1 + y2) / 2], [x2, (y1 + y2) / 2], [x2, y2]];
    else pts = [[x1, y1], [x2, y2]];
    const s = svg(W, H); line(s, pts, color, width, dash, he, hs); c.replaceWith(s);
  } else {
    const w = c.offsetWidth, h = Math.max(c.offsetHeight, 0); const s = svg(w, Math.max(h, 1)); s.style.position = 'relative';
    const from = c.getAttribute('from') || 'tl'; let pts;
    if (h < 2) pts = [[0, 0], [w, 0]]; else if (w < 2) pts = [[0, 0], [0, h]];
    else { const a = { tl: [0, 0], tr: [w, 0], bl: [0, h], br: [w, h] }[from]; pts = [a, [w - a[0], h - a[1]]]; }
    line(s, pts, color, width, dash, he, hs); c.replaceWith(s);
  }
}
const ARROWS = { 'arrow-right': '0 30%,60% 30%,60% 0,100% 50%,60% 100%,60% 70%,0 70%', 'arrow-left': '100% 30%,40% 30%,40% 0,0 50%,40% 100%,40% 70%,100% 70%',
  'arrow-down': '30% 0,70% 0,70% 60%,100% 60%,50% 100%,0 60%,30% 60%', 'arrow-up': '30% 100%,70% 100%,70% 40%,100% 40%,50% 0,0 40%,30% 40%', diamond: '50% 0,100% 50%,50% 100%,0 50%' };
for (const s of document.querySelectorAll('x-shape')) {
  const k = s.getAttribute('kind') || 'rect';
  if (k === 'ellipse') s.style.borderRadius = '50%';
  else if (k === 'rounded') s.style.borderRadius = s.style.borderRadius || '16px';
  else if (ARROWS[k]) s.style.clipPath = `polygon(${ARROWS[k]})`;
  else if (k === 'line') { s.style.borderTop = s.style.border || '2px solid'; s.style.background = 'none'; }
}
for (const i of document.querySelectorAll('x-icon')) {
  const w = i.offsetWidth || 32, h = i.offsetHeight || 32, s = svg(w, h); s.style.position = 'relative';
  const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', w / 2); c.setAttribute('cy', h / 2); c.setAttribute('r', Math.min(w, h) / 4);
  c.setAttribute('fill', 'none'); c.setAttribute('stroke', getComputedStyle(i).color); c.setAttribute('stroke-width', Math.max(2, w / 16)); s.appendChild(c);
  i.innerHTML = ''; i.style.position = 'relative'; i.appendChild(s);
}
"""

CHECK = r"""
const out = [];
for (const sec of document.querySelectorAll('section')) {
  const id = sec.id, R = sec.getBoundingClientRect(), cs = getComputedStyle(sec);
  const pb = parseFloat(cs.paddingBottom), pr = parseFloat(cs.paddingRight), pl = parseFloat(cs.paddingLeft);
  const kids = [...sec.children].filter(k => getComputedStyle(k).position !== 'absolute' && k.tagName !== 'ASIDE');
  const footer = [...sec.children].some(k => getComputedStyle(k).position === 'absolute' && k.style.bottom);
  let bottom = 0, right = 0;
  for (const k of kids) { const r = k.getBoundingClientRect(); bottom = Math.max(bottom, r.bottom - R.top); right = Math.max(right, r.right - R.left); }
  const limit = 1080 - pb;
  if (bottom > limit + 2) out.push(`${id}: flow content ends at y ${Math.round(bottom)}, past ${limit}`);
  if (right > 1920 - pr + 2) out.push(`${id}: flow content reaches x ${Math.round(right)}, past ${1920 - pr}`);
  if (footer && pb > 0 && pb < 160) out.push(`${id}: has a footer band but bottom padding ${pb}px (use 160px)`);
  for (const k of [...sec.children].filter(k => getComputedStyle(k).position === 'absolute' && !k.style.bottom && k.tagName !== 'svg')) {
    const r = k.getBoundingClientRect(); if (r.width === 1920 && r.height === 1080) continue;
    const b = r.bottom - R.top; if (footer && b > 922 && r.height < 1000) out.push(`${id}: pinned <${k.tagName.toLowerCase()}> ends at y ${Math.round(b)}, inside the footer band`);
  }
  for (const el of sec.querySelectorAll('h1,h2,h3,p,li,td,th')) {
    if (!el.textContent.trim() || el.closest('aside')) continue;
    const s = getComputedStyle(el), fs = parseFloat(s.fontSize), t = el.textContent.trim().slice(0, 40);
    if (fs < 24) out.push(`${id}: ${fs}px text "${t}"`);
    if (el.scrollWidth > el.clientWidth + 2 && s.whiteSpace !== 'nowrap') out.push(`${id}: text wider than its box "${t}"`);
    const r = el.getBoundingClientRect();
    if (r.right > R.right + 1 || r.bottom > R.bottom + 1 || r.left < R.left - 1) out.push(`${id}: text off the slide "${t}"`);
  }
}
const pre = document.createElement('pre'); pre.id = 'report'; pre.textContent = JSON.stringify(out); document.body.appendChild(pre);
"""


def chrome(args, url):
    flags = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1920,1080",
             "--virtual-time-budget=20000", "--run-all-compositor-stages-before-draw", "--no-pdf-header-footer"]
    return subprocess.run([CHROME, *flags, *args, url], capture_output=True, text=True, timeout=300)


def load(folder):
    """Returns (deck.json, [(id, html)]) in deck order; files the order leaves out come last, as the type shows them."""
    proj = os.path.join(folder, "project")
    deck = json.load(open(os.path.join(proj, "deck.json")))
    files = {f[:-5] for f in os.listdir(os.path.join(proj, "slides")) if f.endswith(".html")}
    ids = [i for i in deck.get("order", []) if i in files] + sorted(files - set(deck.get("order", [])))
    return deck, [(i, open(os.path.join(proj, "slides", i + ".html")).read()) for i in ids]


def page(deck, slides, check):
    links = "".join(f'<link rel="stylesheet" href="{html.escape(f["href"])}">' for f in deck.get("faces", {}).values() if f.get("href"))
    body = "\n".join(s for _, s in slides)
    script = f"<script>document.fonts.ready.then(() => {{ {POLYFILL} {CHECK if check else ''} }});</script>"
    return f'<!doctype html><html><head><meta charset="utf-8">{links}<style>{BASE_CSS}</style></head><body>{body}{script}</body></html>'


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder")
    ap.add_argument("--slide", action="append", default=[], help="also write this slide at 960 x 540")
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--no-sheet", action="store_true")
    a = ap.parse_args()

    deck, slides = load(a.folder)
    out = os.path.join(a.folder, "preview")
    os.makedirs(out, exist_ok=True)
    tmp = tempfile.mkdtemp()
    try:
        check_html = os.path.join(tmp, "check.html")
        open(check_html, "w").write(page(deck, slides, True))
        dom = chrome(["--dump-dom"], "file://" + check_html).stdout
        m = re.search(r'<pre id="report">(.*?)</pre>', dom, re.S)
        problems = json.loads(html.unescape(m.group(1))) if m else ["report missing: the page's script did not run"]

        if not a.no_sheet or a.slide:
            pdf_html = os.path.join(tmp, "deck.html")
            open(pdf_html, "w").write(page(deck, slides, False))
            pdf = os.path.join(tmp, "deck.pdf")
            chrome([f"--print-to-pdf={pdf}"], "file://" + pdf_html)
            ids = [i for i, _ in slides]
            if not a.no_sheet:
                sheet(pdf, ids, out, a.cols, tmp)
            for sid in a.slide:
                n = ids.index(sid) + 1
                subprocess.run(["pdftoppm", "-png", "-r", "48", "-f", str(n), "-l", str(n), "-singlefile", pdf, os.path.join(out, sid)], check=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print(f"{len(slides)} slides: " + ", ".join(i for i, _ in slides))
    for p in problems:
        print(p)
    print("No layout problems." if not problems else f"{len(problems)} problem(s).")
    sys.exit(1 if problems else 0)


def sheet(pdf, ids, out, cols, tmp):
    """Contact sheets of at most 16 slides each, labelled with the slide id."""
    from PIL import Image, ImageDraw, ImageFont
    subprocess.run(["pdftoppm", "-png", "-r", "24", pdf, os.path.join(tmp, "p")], check=True)
    pngs = sorted(f for f in os.listdir(tmp) if f.startswith("p") and f.endswith(".png"))
    w, h, gap, lab = 480, 270, 16, 30
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 16)
    except OSError:
        font = ImageFont.load_default()
    for s in range(0, len(pngs), 16):
        chunk = pngs[s:s + 16]
        rows = (len(chunk) + cols - 1) // cols
        img = Image.new("RGB", (cols * (w + gap) + gap, rows * (h + lab + gap) + gap), "#5c5c5c")
        d = ImageDraw.Draw(img)
        for k, f in enumerate(chunk):
            x, y = gap + (k % cols) * (w + gap), gap + (k // cols) * (h + lab + gap)
            img.paste(Image.open(os.path.join(tmp, f)).convert("RGB").resize((w, h)), (x, y + lab))
            d.text((x, y + 6), f"{s + k + 1:02d} {ids[s + k]}", fill="#ffffff", font=font)
        img.save(os.path.join(out, f"sheet-{s // 16 + 1}.png"))


if __name__ == "__main__":
    main()
