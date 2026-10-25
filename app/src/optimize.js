// What the arm does when the board changes: which strokes are already there, which must go, how to wipe them, and
// what to draw, in the order and with the wipe that the sim says take least time. Pure: no DOM. Strokes are
// [{x,y}] in board mm. Every candidate is timed with the same schedule the sim and the motors run (makeJob).
import { resample, drawPath, order, bbox, erasePlan, scrub } from "./pathplan.js";
import { toAngles } from "./ik.js";
import { makeJob } from "./sim.js";

const LINE = 2;          // marker line width, mm
const SAMPLE = 1;        // mm between points when checking what a wipe reaches
const hop = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const len = (s) => s.reduce((d, p, i) => d + (i ? hop(s[i - 1], p) : 0), 0);

// ---------- which strokes are the same ----------
// Distance from a point to a polyline.
function toLine(p, s) {
  let best = Infinity;
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1], b = s[i], dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1;
    const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L));
    best = Math.min(best, Math.hypot(a.x + u * dx - p.x, a.y + u * dy - p.y));
  }
  return s.length === 1 ? hop(p, s[0]) : best;
}
// Two strokes are the same if each lies within tol of the other all the way along (either way round).
function same(a, b, tol) {
  const la = len(a), lb = len(b);
  if (Math.abs(la - lb) > Math.max(tol * 2, 0.1 * Math.max(la, lb))) return false;
  const ends = Math.min(hop(a[0], b[0]) + hop(a.at(-1), b.at(-1)), hop(a[0], b.at(-1)) + hop(a.at(-1), b[0]));
  if (ends > 4 * tol && hop(a[0], a.at(-1)) > tol) return false;   // closed strokes may start anywhere
  const A = resample(a, 2), B = resample(b, 2);
  return A.every((p) => toLine(p, b) <= tol) && B.every((p) => toLine(p, a) <= tol);
}
// old board, new board -> { keep, add, remove }. A stroke already on the board within tol mm is kept.
export function diffStrokes(oldS, newS, tol = 1.5) {
  const used = new Set(), keep = [], add = [];
  for (const s of newS) {
    const j = oldS.findIndex((o, k) => !used.has(k) && same(o, s, tol));
    if (j >= 0) { used.add(j); keep.push(oldS[j]); } else add.push(s);
  }
  return { keep, add, remove: oldS.filter((_, k) => !used.has(k)) };
}

// ---------- a spatial index of points, to ask "is any point within r of here" quickly ----------
function grid(points, cell) {
  const m = new Map(), key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  points.forEach((p, i) => { const k = key(p.x, p.y); if (!m.has(k)) m.set(k, []); m.get(k).push(i); });
  return {
    near(p, r, fn) {
      const c0 = Math.floor((p.x - r) / cell), c1 = Math.floor((p.x + r) / cell), r0 = Math.floor((p.y - r) / cell), r1 = Math.floor((p.y + r) / cell);
      for (let cx = c0; cx <= c1; cx++) for (let cy = r0; cy <= r1; cy++) (m.get(`${cx},${cy}`) || []).forEach(fn);
    },
  };
}
const samples = (strokes) => strokes.flatMap((s, si) => resample(s, SAMPLE).map((p) => ({ x: p.x, y: p.y, si })));

// Points of these strokes the eraser passes within reach of, along its erase segments.
function wiped(strokes, erasePaths, reach) {
  const pts = samples(strokes), idx = grid(pts, reach), hit = new Uint8Array(pts.length);
  for (const path of erasePaths) for (const p of resample(path, SAMPLE)) idx.near(p, reach, (i) => { if (hop(pts[i], p) <= reach) hit[i] = 1; });
  return { pts, hit };
}

// how far either side of its path the felt surely wipes: half its width, less half a line and a margin; never under
// 1.5 mm, so a narrow eraser still sweeps rows a little apart
const coverOf = (g) => Math.max(1.5, g.eraserWidth / 2 - LINE / 2 - 1.5);

// ---------- ways to wipe ----------
// Each returns erase paths (polylines the eraser's felt follows while down); between paths it lifts.
const strategies = {
  // follow each stroke to be wiped, with corners cut by as much as the felt allows; skip strokes an earlier pass
  // already covered
  trace(remove, g, from) {
    const cover = coverOf(g);
    const done = [], paths = [];
    for (const s of remove.slice().sort((a, b) => len(b) - len(a))) {
      const pts = resample(s, SAMPLE);
      if (done.length && pts.every((p) => done.some((d) => toLine(p, d) <= cover))) continue;
      const path = simplify(s, cover / 2); paths.push(path); done.push(path);
    }
    return order(paths, { from });
  },
  // the felt sweeps rows across only the cells that hold ink to wipe, one row per felt width
  cells(remove, g, from) {
    const cover = coverOf(g), c = 2 * cover;
    const rows = new Map();
    for (const p of samples(remove)) { const r = Math.floor(p.y / c), k = Math.floor(p.x / c); if (!rows.has(r)) rows.set(r, new Set()); rows.get(r).add(k); }
    const runs = [];
    for (const [r, set] of rows) {
      const ks = [...set].sort((a, b) => a - b); let a = ks[0], b = ks[0];
      const flush = () => runs.push([{ x: a * c - 1, y: (r + 0.5) * c }, { x: (b + 1) * c + 1, y: (r + 0.5) * c }]);
      for (const k of ks.slice(1)) { if (k <= b + 2) b = k; else { flush(); a = b = k; } }
      flush();
    }
    return order(runs, { from });
  },
  // one zigzag over the box round everything to wipe, never lifting
  box(remove, g) {
    const cover = coverOf(g), bb = bbox(remove), pad = LINE;
    const x0 = bb.minx - pad, x1 = bb.maxx + pad, path = [];
    for (let y = bb.miny + cover * 0.9, r = 0; y < bb.maxy + cover; y += 2 * cover, r++) {
      if (r % 2) path.push({ x: x1, y }, { x: x0, y }); else path.push({ x: x0, y }, { x: x1, y });
    }
    return [path];
  },
  // the whole drawing area, as before
  full(remove, g) {
    const tp = erasePlan(g, { zigzag: 0 }).toolpath; return [tp.map((p) => ({ x: p.x, y: p.y }))];   // planChange scrubs it
  },
};

// Ramer–Douglas–Peucker: drop points within eps of the line through their neighbours.
function simplify(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const a = pts[0], b = pts.at(-1); let idx = 0, dmax = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = toLine(pts[i], [a, b]); if (d > dmax) { dmax = d; idx = i; } }
  if (dmax <= eps) return [a, b];
  return simplify(pts.slice(0, idx + 1), eps).slice(0, -1).concat(simplify(pts.slice(idx), eps));
}

// The eraser goes over each wipe `passes` times without lifting, each pass shifted sideways by `apart` mm (0, +apart,
// -apart, +2 apart...) and run the other way, so a line the first pass misses by a little (the build's error adds
// up), the next catches. A traced line shifts across itself; rows shift up and down, so they stay evenly spaced.
function overAgain(path, n, apart, rows) {
  if (!(n > 1) || !(apart > 0) || path.length < 2) return path;
  const shift = (d) => path.map((q, i) => {
    if (rows) return { x: q.x, y: q.y + d };
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: q.x - ((b.y - a.y) / L) * d, y: q.y + ((b.x - a.x) / L) * d };
  });
  const out = path.slice();
  for (let k = 1; k < n; k++) { const p = shift(Math.ceil(k / 2) * apart * (k % 2 ? 1 : -1)); out.push(...(k % 2 ? p.reverse() : p)); }
  return out;
}

// Erase paths -> toolpath points: lift to each path's start (the eraser side of the lift), wipe along it.
function eraseToolpath(paths) {
  const tp = [];
  for (const p of paths) resample(p, 4).forEach((q, i) => tp.push({ x: q.x, y: q.y, pen: i ? 1 : 0, tool: i ? "erase" : "lift" }));
  return tp;
}

const timeOf = (tp, g) => (tp.length ? makeJob(tp, toAngles(tp, g), g).total : 0);

// ---------- the change ----------
// old strokes on the board, new strokes wanted -> the toolpath that gets there, and what each choice cost.
// Any kept ink the felt touches is redrawn afterwards, only where it was touched.
export function planChange(oldS, newS, g, { from = null, tol = 1.5, only = null } = {}) {
  const { keep, add, remove } = diffStrokes(oldS, newS, tol);
  const reach = g.eraserWidth / 2 + LINE / 2;
  const candidates = [];
  // config erase.how: "area" wipes the whole box round what goes (it can't miss a line by a few mm), "lines" follows
  // the lines, "fastest" times all four ways and takes the quickest
  const how = g.erase?.how, ways = how === "area" ? ["box"] : how === "lines" ? ["trace"] : Object.keys(strategies);
  const names = remove.length ? (only ? [only] : ways) : ["none"];
  for (const name of names) {
    const z = g.erase || {}, rows = name !== "trace";
    const paths = name === "none" ? [] : strategies[name](remove, g, from).map((p) => scrub(overAgain(p, z.passes, z.apart, rows), z.zigzag, z.period));
    // what the wipe also takes off strokes that stay
    const touched = [];
    if (paths.length && keep.length) {
      const { pts, hit } = wiped(keep, paths, reach);
      let run = [];
      const flush = () => { if (run.length > 1) touched.push(run); run = []; };
      pts.forEach((p, i) => { if (i && pts[i - 1].si !== p.si) flush(); if (hit[i]) run.push({ x: p.x, y: p.y }); else flush(); });
      flush();
    }
    const erase = eraseToolpath(paths);
    const last = erase.length ? erase.at(-1) : from;
    const draw = drawPath([...add, ...touched], { from: last, leadIn: g.leadIn ?? 3 });
    const toolpath = [...erase, ...draw.toolpath];
    candidates.push({
      name, toolpath, time: timeOf(toolpath, g), eraseTime: timeOf(erase, g),
      wipeLength: Math.round(paths.reduce((d, p) => d + len(p), 0)),
      redrawn: Math.round(touched.reduce((d, s) => d + len(s), 0)),
    });
  }
  candidates.sort((a, b) => a.time - b.time);
  return { best: candidates[0], candidates, keep, add, remove };
}

// For tests: how much ink is left that should be gone, and missing that should be there, on a raster.
export { len as strokeLength };
