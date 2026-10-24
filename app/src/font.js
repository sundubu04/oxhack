// The arm's own lettering: a single-stroke font, so words come out as clean pen lines instead of the shapes a model
// guesses at. Drawn for this project. Each glyph is strokes on a grid with the baseline at 0 and capitals 1 high
// (y up); a stroke is points "x y" and arcs "a cx cy rx ry from to" (degrees, counter-clockwise from +x).
// Lines and lists are laid out here too: text in a box, and the to-do list a "write" action asks for.

const G = {
  A: [.72, "0 0, .36 1, .72 0; .13 .36, .59 .36"],
  B: [.64, "0 .5, .4 .5, a .4 .75 .22 .25 -90 90, 0 1, 0 0, .42 0, a .42 .25 .22 .25 -90 90, 0 .5"],
  C: [.7, "a .38 .5 .36 .5 38 322"],
  D: [.68, "0 0, 0 1, .3 1, a .3 .5 .36 .5 90 -90, 0 0"],
  E: [.58, ".58 1, 0 1, 0 0, .58 0; 0 .52, .46 .52"],
  F: [.56, ".56 1, 0 1, 0 0; 0 .52, .44 .52"],
  G: [.74, "a .38 .5 .36 .5 40 345, .74 .46, .44 .46"],
  H: [.66, "0 0, 0 1; .66 0, .66 1; 0 .52, .66 .52"],
  I: [.12, ".06 0, .06 1"],
  J: [.5, ".5 1, .5 .28, a .26 .28 .24 .28 0 -180"],
  K: [.62, "0 0, 0 1; .62 1, 0 .36; .2 .56, .64 0"],
  L: [.54, "0 1, 0 0, .54 0"],
  M: [.8, "0 0, 0 1, .4 .35, .8 1, .8 0"],
  N: [.66, "0 0, 0 1, .66 0, .66 1"],
  O: [.78, "a .39 .5 .39 .5 90 450"],
  P: [.6, "0 0, 0 1, .36 1, a .36 .74 .24 .26 90 -90, 0 .48"],
  Q: [.78, "a .39 .5 .39 .5 90 450; .48 .22, .8 -.06"],
  R: [.62, "0 0, 0 1, .36 1, a .36 .74 .24 .26 90 -90, 0 .48; .3 .48, .62 0"],
  S: [.6, "a .3 .76 .27 .24 25 270, a .3 .26 .3 .26 90 -155"],
  T: [.64, "0 1, .64 1; .32 1, .32 0"],
  U: [.66, "0 1, 0 .32, a .33 .32 .33 .32 180 360, .66 1"],
  V: [.7, "0 1, .35 0, .7 1"],
  W: [.94, "0 1, .23 0, .47 .72, .71 0, .94 1"],
  X: [.66, "0 0, .66 1; 0 1, .66 0"],
  Y: [.66, "0 1, .33 .5, .66 1; .33 .5, .33 0"],
  Z: [.62, "0 1, .62 1, 0 0, .62 0"],

  a: [.5, "a .25 .31 .25 .31 0 360; .5 .62, .5 0"],
  b: [.5, "0 1, 0 0; a .25 .31 .25 .31 180 540"],
  c: [.48, "a .26 .31 .26 .31 45 315"],
  d: [.5, "a .25 .31 .25 .31 0 360; .5 1, .5 0"],
  e: [.52, ".01 .31, .51 .31, a .26 .31 .25 .31 0 318"],
  f: [.42, "a .36 .84 .15 .16 20 180, .21 0; .03 .6, .39 .6"],
  g: [.5, "a .25 .31 .25 .31 0 360; .5 .62, .5 -.1, a .25 -.1 .25 .2 0 -160"],
  h: [.5, "0 1, 0 0; a .25 .4 .25 .22 180 0, .5 0"],
  i: [.1, ".05 .62, .05 0; .05 .84, .05 .87"],
  j: [.32, ".26 .62, .26 -.1, a .1 -.1 .16 .18 0 -170; .26 .84, .26 .87"],
  k: [.48, "0 1, 0 0; .46 .62, 0 .22; .14 .34, .48 0"],
  l: [.1, ".05 1, .05 0"],
  m: [.76, "0 .62, 0 0; a .19 .4 .19 .22 180 0, .38 0; a .57 .4 .19 .22 180 0, .76 0"],
  n: [.5, "0 .62, 0 0; a .25 .4 .25 .22 180 0, .5 0"],
  o: [.52, "a .26 .31 .26 .31 90 450"],
  p: [.5, "0 .62, 0 -.3; a .25 .31 .25 .31 180 540"],
  q: [.5, "a .25 .31 .25 .31 0 360; .5 .62, .5 -.3"],
  r: [.4, "0 .62, 0 0; a .3 .38 .3 .24 180 70"],
  s: [.44, "a .22 .47 .2 .15 30 270, a .22 .16 .22 .16 90 -150"],
  t: [.4, ".16 .9, .16 .12, a .3 .12 .14 .12 180 300; 0 .62, .38 .62"],
  u: [.5, "0 .62, 0 .24, a .25 .24 .25 .24 180 360; .5 .62, .5 0"],
  v: [.5, "0 .62, .25 0, .5 .62"],
  w: [.72, "0 .62, .18 0, .36 .45, .54 0, .72 .62"],
  x: [.48, "0 .62, .48 0; 0 0, .48 .62"],
  y: [.5, "0 .62, .25 0; .5 .62, .13 -.3"],
  z: [.48, "0 .62, .48 .62, 0 0, .48 0"],

  0: [.58, "a .29 .5 .29 .5 90 450"],
  1: [.5, ".06 .78, .26 1, .26 0; .04 0, .48 0"],
  2: [.58, "a .29 .72 .27 .27 160 -25, 0 0, .58 0"],
  3: [.58, "a .28 .76 .26 .24 150 -90, a .28 .26 .3 .26 90 -150"],
  4: [.6, ".44 0, .44 1, 0 .3, .6 .3"],
  5: [.58, ".54 1, .1 1, .08 .56, a .28 .33 .28 .33 135 -150"],
  6: [.58, "a .3 .45 .28 .5 70 180, a .3 .3 .28 .3 180 540"],
  7: [.58, "0 1, .58 1, .2 0"],
  8: [.58, "a .29 .76 .23 .24 270 630, a .29 .27 .28 .27 90 450"],
  9: [.58, "a .29 .7 .27 .3 0 360, a .28 .55 .28 .55 0 -110"],

  ".": [.08, ".04 0, .04 .03"],
  ",": [.12, ".08 .04, .02 -.12"],
  "!": [.1, ".05 1, .05 .28; .05 .02, .05 .05"],
  "?": [.5, "a .25 .76 .24 .22 150 -80, .27 .44, .27 .28; .27 .02, .27 .05"],
  "'": [.1, ".05 1, .05 .78"],
  '"': [.22, ".03 1, .03 .78; .19 1, .19 .78"],
  "-": [.42, ".03 .4, .39 .4"],
  ":": [.1, ".05 .5, .05 .53; .05 .02, .05 .05"],
  ";": [.12, ".08 .5, .08 .53; .08 .04, .02 -.12"],
  "(": [.26, "a .3 .4 .28 .7 122 238"],
  ")": [.26, "a -.04 .4 .28 .7 58 -58"],
  "/": [.44, "0 -.05, .44 1.05"],
  "+": [.5, ".04 .4, .46 .4; .25 .19, .25 .61"],
  "=": [.5, ".04 .5, .46 .5; .04 .28, .46 .28"],
  "#": [.56, ".14 0, .22 .9; .34 0, .42 .9; .04 .3, .52 .3; .06 .6, .54 .6"],
  "%": [.56, "0 0, .56 1; a .12 .84 .1 .14 0 360; a .44 .16 .1 .14 0 360"],
  "*": [.44, ".22 .9, .22 .5; .04 .8, .4 .6; .04 .6, .4 .8"],
  "_": [.5, "0 -.1, .5 -.1"],
  "<": [.44, ".44 .7, 0 .4, .44 .1"],
  ">": [.44, "0 .7, .44 .4, 0 .1"],
  "°": [.24, "a .12 .88 .1 .1 0 360"],
  "&": [.62, ".62 0, .1 .62, a .24 .8 .14 .18 180 -20, .04 .22, a .24 .22 .2 .22 180 330, .58 .36"],
  "$": [.6, "a .3 .76 .27 .22 25 270, a .3 .28 .3 .24 90 -155; .3 1.08, .3 -.08"],
  "£": [.6, ".56 .86, a .38 .78 .18 .2 20 180, .2 .2, .06 0, .6 0; .02 .52, .44 .52"],
  "@": [.9, "a .45 .42 .17 .2 0 360; .62 .62, .62 .3, a .74 .3 .12 .16 180 340, a .45 .45 .45 .5 10 330"],
};

const SPACE = 0.36, GAP = 0.16;      // word space and gap between letters, in cap heights
export const ASCENT = 1, DESCENT = 0.3;

const parsed = new Map();
function strokesOf(ch) {
  if (parsed.has(ch)) return parsed.get(ch);
  const g = G[ch];
  const out = g ? g[1].split(";").map((st) => st.split(",").flatMap((item) => {
    const n = item.trim().replace(/^a\s+/, "").split(/\s+/).map(Number);
    if (!/^\s*a\s/.test(item)) return [{ x: n[0], y: n[1] }];
    const [cx, cy, rx, ry, a0, a1] = n, steps = Math.max(6, Math.ceil(Math.abs(a1 - a0) / 12)), pts = [];
    for (let i = 0; i <= steps; i++) { const a = ((a0 + (a1 - a0) * (i / steps)) * Math.PI) / 180; pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }); }
    return pts;
  })) : [];
  parsed.set(ch, out);
  return out;
}
// letters the font hasn't got: accents dropped, curly quotes and dashes straightened, anything else left out
const plain = (s) => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[‘’`]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/×/g, "x");
const width = (ch) => (ch === " " ? SPACE : G[ch] ? G[ch][0] : 0);

// width of a line, in cap heights
export function measure(text) {
  const t = plain(text); let w = 0, n = 0;
  for (const ch of t) { const cw = width(ch); if (!cw) continue; w += cw + (n++ ? GAP : 0); }
  return w;
}

// one line of text as strokes, y down: (x, baseline) is where it starts, size is the capital height
export function textStrokes(text, x, baseline, size) {
  const out = []; let pen = x, n = 0;
  for (const ch of plain(text)) {
    const cw = width(ch); if (!cw) continue;
    if (n++) pen += GAP * size;
    for (const st of strokesOf(ch)) out.push(st.map((p) => ({ x: pen + p.x * size, y: baseline - p.y * size })));
    pen += cw * size;
  }
  return out;
}

// text filling a rectangle (y down), one or more lines split on "\n", centred, as large as fits
export function fitText(text, r) {
  const lines = String(text).split(/\n|\\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length || !(r.w > 0 && r.h > 0)) return [];
  const pitch = 1.5, wide = Math.max(...lines.map(measure), 0.1);
  const size = Math.min(r.w / wide, r.h / (ASCENT + 0.2 + (lines.length - 1) * pitch));
  const block = (lines.length - 1) * pitch * size + size, top = r.y + (r.h - block) / 2;
  return lines.flatMap((l, i) => textStrokes(l, r.x + (r.w - measure(l) * size) / 2, top + size + i * pitch * size, size));
}

// ---------- lists, notes and signs: a "write" action laid out in its box (box units, y down) ----------
// A line may have a box to tick. The lettering size is kept with the item, so adding a line or ticking one leaves
// the other lines where they were and the planner only draws what changed.
const LINE = 1.75, TITLE = 1.4, CHECK = 0.95;   // line pitch, title size and tick box, in line cap heights
const indent = (w) => (w.lines.some((l) => l.check) ? CHECK + 0.6 : 0);
function needs(w) {
  const wide = Math.max(w.title ? measure(w.title) * TITLE : 0, ...w.lines.map((l) => indent(w) + measure(l.text)), 0.1);
  const tall = (w.title ? TITLE * 1.9 : 0) + Math.max(1, w.lines.length) * LINE;
  return { wide, tall };
}
// the size to letter a write item at: its old size while everything still fits, else the largest that does,
// leaving room for two more lines so a growing list doesn't have to shrink at once
export function writeSize(w, box, old) {
  const { wide, tall } = needs(w), pad = 0.06 * Math.min(box.w, box.h);
  const fits = (s) => wide * s <= box.w - 2 * pad && tall * s <= box.h - 2 * pad;
  if (old && fits(old)) return old;
  const room = needs({ ...w, lines: [...w.lines, ...(w.lines.some((l) => l.check) ? [{ text: "" }, { text: "" }] : [])] }).tall;
  // a list keeps to handwriting size; a sign or a card may fill its box
  const most = Math.min(box.w, box.h) / (w.lines.some((l) => l.check) ? 7 : 3);
  return Math.min((box.w - 2 * pad) / wide, (box.h - 2 * pad) / room, most);
}
export function writeStrokes(w, box) {
  const s = w.size || writeSize(w, box), pad = 0.06 * Math.min(box.w, box.h), out = [];
  const left = (lineW) => (w.align === "center" ? (box.w - lineW * s) / 2 : pad);
  let y = pad;
  if (w.title) { y += TITLE * s; out.push(...textStrokes(w.title, left(measure(w.title) * TITLE), y, TITLE * s)); y += TITLE * 0.9 * s; }
  const ind = indent(w);
  for (const l of w.lines) {
    y += LINE * s;
    const x = left(ind + measure(l.text));
    if (l.check) {
      const b = CHECK * s, bx = x, by = y - b;
      out.push([{ x: bx, y: by }, { x: bx + b, y: by }, { x: bx + b, y: by + b }, { x: bx, y: by + b }, { x: bx, y: by }]);
      if (l.check === "done") out.push([{ x: bx + 0.18 * b, y: by + 0.5 * b }, { x: bx + 0.42 * b, y: by + 0.8 * b }, { x: bx + 0.95 * b, y: by - 0.25 * b }]);
    }
    out.push(...textStrokes(l.text, x + ind * s, y, s));
  }
  return out;
}

export const GLYPHS = Object.keys(G);
