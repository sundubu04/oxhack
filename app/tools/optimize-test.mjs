// Checks the planner: stroke order against the true optimum, and every way of erasing and redrawing on real
// changes, each played through the sim (SG92R physics) onto an ink raster to prove the board ends up right.
// node tools/optimize-test.mjs [out.json]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { geomFrom, withDefaults } from "../src/config.js";
import { fitStrokes, toBox, orderTour, tourTravel, exactTour, drawPath, plan, erasePlan, resample } from "../src/pathplan.js";
import { planChange, diffStrokes } from "../src/optimize.js";
import { toAngles, toBoard } from "../src/ik.js";
import { makeJob, Sim } from "../src/sim.js";
import { SAMPLES, clockSVG } from "../src/sample.js";
import * as ttt from "../src/games/tictactoe.js";

const g = geomFrom(withDefaults(JSON.parse(readFileSync(new URL("../arm.config.json", import.meta.url), "utf8"))));
const { cx, cy } = g, start = { x: cx, y: cy - g.half - 20 };   // the drawing's middle, and a start just below it
const out = {};

// ---- SVG to strokes without a DOM: the shapes the samples and Gemini's drawings use ----
function svgStrokes(svg) {
  const S = [], num = (t, a) => +((t.match(new RegExp(`\\b${a}="([-\\d.]+)"`)) || [])[1] || 0);
  const ring = (cx, cy, rx, ry) => Array.from({ length: 49 }, (_, i) => ({ x: cx + rx * Math.cos(i / 48 * 2 * Math.PI), y: cy + ry * Math.sin(i / 48 * 2 * Math.PI) }));
  for (const [t] of svg.matchAll(/<(path|circle|ellipse|line|polyline|polygon|rect)\b[^>]*>/g)) {
    const tag = t.match(/^<(\w+)/)[1];
    if (tag === "path") S.push(...pathD((t.match(/\bd="([^"]*)"/) || [])[1] || ""));
    else if (tag === "circle") S.push(ring(num(t, "cx"), num(t, "cy"), num(t, "r"), num(t, "r")));
    else if (tag === "ellipse") S.push(ring(num(t, "cx"), num(t, "cy"), num(t, "rx"), num(t, "ry")));
    else if (tag === "line") S.push([{ x: num(t, "x1"), y: num(t, "y1") }, { x: num(t, "x2"), y: num(t, "y2") }]);
    else if (tag === "rect") { const x = num(t, "x"), y = num(t, "y"), w = num(t, "width"), h = num(t, "height"); S.push([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }]); }
    else { const p = ((t.match(/\bpoints="([^"]*)"/) || [])[1] || "").trim().split(/[\s,]+/).map(Number), s = []; for (let i = 0; i + 1 < p.length; i += 2) s.push({ x: p[i], y: p[i + 1] }); if (tag === "polygon" && s.length) s.push(s[0]); S.push(s); }
  }
  return S.filter((s) => s.length > 1);
}
function pathD(d) {
  const S = []; let cur = [], x = 0, y = 0, sx = 0, sy = 0, cmd = "", i = 0;
  const T = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [], n = () => +T[i++];
  const push = () => { if (cur.length > 1) S.push(cur); cur = []; };
  const bez = (p0, p1, p2, p3) => { for (let k = 1; k <= 16; k++) { const u = k / 16, m = 1 - u; cur.push({ x: m * m * m * p0.x + 3 * m * m * u * p1.x + 3 * m * u * u * p2.x + u * u * u * p3.x, y: m * m * m * p0.y + 3 * m * m * u * p1.y + 3 * m * u * u * p2.y + u * u * u * p3.y }); } };
  while (i < T.length) {
    if (/[a-zA-Z]/.test(T[i])) cmd = T[i++];
    const r = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    if (C === "M") { push(); x = n() + (r ? x : 0); y = n() + (r ? y : 0); sx = x; sy = y; cur.push({ x, y }); cmd = r ? "l" : "L"; }
    else if (C === "L") { x = n() + (r ? x : 0); y = n() + (r ? y : 0); cur.push({ x, y }); }
    else if (C === "H") { x = n() + (r ? x : 0); cur.push({ x, y }); }
    else if (C === "V") { y = n() + (r ? y : 0); cur.push({ x, y }); }
    else if (C === "C") { const a = { x: n() + (r ? x : 0), y: n() + (r ? y : 0) }, b = { x: n() + (r ? x : 0), y: n() + (r ? y : 0) }, c = { x: n() + (r ? x : 0), y: n() + (r ? y : 0) }; bez({ x, y }, a, b, c); x = c.x; y = c.y; }
    else if (C === "Q") { const a = { x: n() + (r ? x : 0), y: n() + (r ? y : 0) }, c = { x: n() + (r ? x : 0), y: n() + (r ? y : 0) }; bez({ x, y }, a, a, c); x = c.x; y = c.y; }
    else if (C === "Z") { cur.push({ x: sx, y: sy }); x = sx; y = sy; push(); }
    else i++;
  }
  push(); return S;
}
// a drawing placed by its viewBox in the drawing square, as the app places it, so an edit lands where it was
const onBoard = (svg) => toBox(svgStrokes(svg), { x: cx - g.half, y: cy - g.half, w: 2 * g.half, h: 2 * g.half });

// ---- 1. stroke order: greedy, improved, and the true best ----
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const randomStrokes = (n) => Array.from({ length: n }, () => { const x = cx - 80 + rnd() * 160, y = cy - 80 + rnd() * 160, a = rnd() * 6.28, l = 5 + rnd() * 30; return [{ x, y }, { x: x + l * Math.cos(a), y: y + l * Math.sin(a) }]; });
const orderRows = [];
for (const n of [6, 8, 10, 12]) {
  let gs = 0, bs = 0, gWorst = 0, bWorst = 0, trials = n >= 12 ? 8 : 25;
  for (let t = 0; t < trials; t++) {
    const S = randomStrokes(n), from = start;
    const ex = exactTour(S, from).travel, gr = tourTravel(S, orderTour(S, { from, how: "greedy" }), from), be = tourTravel(S, orderTour(S, { from, how: "heuristic" }), from);
    gs += gr / ex - 1; bs += be / ex - 1; gWorst = Math.max(gWorst, gr / ex - 1); bWorst = Math.max(bWorst, be / ex - 1);
  }
  orderRows.push({ strokes: n, trials, greedyAbove: +(100 * gs / trials).toFixed(1), improvedAbove: +(100 * bs / trials).toFixed(1), greedyWorst: +(100 * gWorst).toFixed(1), improvedWorst: +(100 * bWorst).toFixed(1) });
}
out.order = orderRows;
console.log("stroke order, % more pen-up travel than the true best (random strokes; the app uses the exact order up to 12 strokes):"); console.table(orderRows);

// on the real drawings: greedy vs improved, travel and time
const oxford = existsSync(process.env.OXFORD || "") ? readFileSync(process.env.OXFORD, "utf8") : null;
const drawings = { clock: clockSVG(new Date("2026-10-24T10:10:00")), house: SAMPLES.house, cat: SAMPLES.cat, star: SAMPLES.star, flower: SAMPLES.flower, ...(oxford ? { oxford } : {}) };
const timeOf = (tp) => makeJob(tp, toAngles(tp, g), g).total;
const drawRows = [];
for (const [name, svg] of Object.entries(drawings)) {
  const S = onBoard(svg), from = start;
  const gr = drawPath(S, { from, how: "greedy", leadIn: g.leadIn }), be = drawPath(S, { from, leadIn: g.leadIn });
  // exactness: up to 12 strokes the order is the proven optimum
  if (S.length <= 12) { const ex = exactTour(S, from).travel, got = tourTravel(S, orderTour(S, { from }), from); if (Math.abs(ex - got) > 1e-6) throw new Error(`${name}: order is not optimal`); }
  drawRows.push({ drawing: name, strokes: S.length, travelGreedy: gr.travel, travelImproved: be.travel, timeGreedy: +timeOf(gr.toolpath).toFixed(1), timeImproved: +timeOf(be.toolpath).toFixed(1) });
}
out.drawings = drawRows;
console.log("\nreal drawings, pen-up travel (mm) and time to draw (s):"); console.table(drawRows);

// ---- 2. changes: every way to erase, timed, and checked on an ink raster through the sim ----
const RES = 0.5, W = Math.round(g.boardW / RES), Hh = Math.round(g.board / RES);
const raster = () => new Uint8Array(W * Hh);
const cell = (p) => { const q = toBoard(g, p); return [Math.round(q.u / RES), Math.round((g.board - q.v) / RES)]; };
function stamp(R, a, b, r, v) {
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / (RES / 2))), rr = Math.ceil(r / RES);
  for (let k = 0; k <= n; k++) {
    const p = { x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n }, [cx, cyy] = cell(p);
    for (let dx = -rr; dx <= rr; dx++) for (let dy = -rr; dy <= rr; dy++) {
      if (dx * dx + dy * dy > (r / RES) ** 2) continue;
      const x = cx + dx, y = cyy + dy; if (x >= 0 && y >= 0 && x < W && y < Hh) R[y * W + x] = v;
    }
  }
}
const paint = (S) => { const R = raster(); for (const s of S) for (let i = 1; i < s.length; i++) stamp(R, s[i - 1], s[i], 1, 1); return R; };
// leftover: ink more than 1.5 mm from where ink should be; missing: points along new strokes with no ink within 1 mm
function check(R, target) {
  const T = paint(target), near = raster(); for (let i = 0; i < T.length; i++) if (T[i]) near[i] = 1;
  const grow = raster(); const g3 = Math.round(1.5 / RES);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (near[y * W + x]) for (let dx = -g3; dx <= g3; dx++) for (let dy = -g3; dy <= g3; dy++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < Hh) grow[Y * W + X] = 1; }
  let left = 0; for (let i = 0; i < R.length; i++) if (R[i] && !grow[i]) left++;
  let pts = 0, missing = 0;
  for (const s of target) for (const p of resample(s, 1)) {
    pts++; const [cx, cyy] = cell(p); let ok = false;
    for (let dx = -2; dx <= 2 && !ok; dx++) for (let dy = -2; dy <= 2 && !ok; dy++) { const X = cx + dx, Y = cyy + dy; if (X >= 0 && Y >= 0 && X < W && Y < Hh && R[Y * W + X]) ok = true; }
    if (!ok) missing++;
  }
  return { leftoverMm2: +(left * RES * RES).toFixed(1), missingPct: +(100 * missing / (pts || 1)).toFixed(1) };
}
function playOn(R, toolpath) {
  const job = makeJob(toolpath, toAngles(toolpath, g), g), sim = new Sim(g); sim.physics = true; sim.load(job);
  sim.advance(job.total + 0.5, (a, b, m) => stamp(R, a, b, m === "erase" ? g.eraserWidth / 2 : 1, m === "erase" ? 0 : 1));
  return R;
}

const box = { x: cx - g.half, y: cy - g.half, w: 2 * g.half, h: 2 * g.half };
const gridS = ttt.gridStrokes(box), marks = (moves) => moves.flatMap(([c, w]) => ttt.markStrokes(box, c, w));
const cat = onBoard(SAMPLES.cat);
// new whiskers: the cat's last path (the right whiskers) swapped for longer, droopier ones
const catEdit = [...onBoard(SAMPLES.cat.replace('M34 62 L20 60 M34 66 L22 68 M66 62 L80 60 M66 66 L78 68', 'M34 62 L14 66 M34 66 L16 74 M66 62 L86 66 M66 66 L84 74'))];
const scenes = {
  "clock, 10:10 to 10:11": [onBoard(clockSVG(new Date("2026-10-24T10:10:00"))), onBoard(clockSVG(new Date("2026-10-24T10:11:00")))],
  "clock, 10:59 to 11:00": [onBoard(clockSVG(new Date("2026-10-24T10:59:00"))), onBoard(clockSVG(new Date("2026-10-24T11:00:00")))],
  "cat, new whiskers": [cat, catEdit],
  "tic-tac-toe, new game": [[...gridS, ...marks([[0, "X"], [4, "O"], [8, "X"], [2, "O"], [6, "X"]])], gridS],
  "tic-tac-toe, one more move": [[...gridS, ...marks([[0, "X"], [4, "O"]])], [...gridS, ...marks([[0, "X"], [4, "O"], [8, "X"]])]],
  "cat, wiped": [cat, []],
  "house to star": [onBoard(SAMPLES.house), onBoard(SAMPLES.star)],
  ...(oxford ? { "Oxford crest, wiped": [onBoard(oxford), []] } : {}),
};
const changeRows = [];
for (const [name, [before, after]] of Object.entries(scenes)) {
  const from = start;
  const res = planChange(before, after, g, { from });
  // the old way: wipe the whole drawing area, then draw everything again
  const wipe = erasePlan(g).toolpath, redraw = drawPath(after, { from: wipe.at(-1), leadIn: g.leadIn, how: "greedy" }).toolpath;
  const oldWay = timeOf([...wipe, ...redraw]);
  const row = { change: name, kept: res.keep.length, wiped: res.remove.length, added: res.add.length, oldWay: +oldWay.toFixed(1) };
  for (const c of res.candidates) row[c.name] = +c.time.toFixed(1);
  row.chosen = res.best.name; row.time = +res.best.time.toFixed(1); row.saved = `${Math.round(100 * (1 - res.best.time / oldWay))}%`;
  row.redrawnMm = res.best.redrawn;
  // prove it: old ink, then the chosen plan through the SG92R sim
  Object.assign(row, check(playOn(paint(before), res.best.toolpath), after));
  changeRows.push(row);
}
out.changes = changeRows;
console.log("\nchanges: seconds for each way of erasing (old way = wipe everything, redraw everything), the one chosen, and the board after it, through the sim:");
console.table(changeRows);
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
