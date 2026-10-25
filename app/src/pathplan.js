// Turn polylines into the most effective pen path: fit to the board, order the strokes to minimise
// pen-up travel (nearest first, then 2-opt and Or-opt, each stroke either way round), resample, and flatten.
import { GEOM, drawCentre } from "./ik.js";

export function bbox(strokes) {
  let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
  for (const s of strokes) for (const p of s) { a = Math.min(a, p.x); b = Math.min(b, p.y); c = Math.max(c, p.x); d = Math.max(d, p.y); }
  return { minx: a, miny: b, maxx: c, maxy: d, w: c - a, h: d - b };
}

// Centre the drawing and scale it to fill a box of half-size `half` mm at (cx,cy), flipping y
// (image y grows down, arm y grows up).
export function fitStrokes(strokes, half, cx, cy) {
  const bb = bbox(strokes);
  if (!isFinite(bb.minx)) return [];
  const sc = (2 * half) / Math.max(bb.w || 1, bb.h || 1), mx = (bb.minx + bb.maxx) / 2, my = (bb.miny + bb.maxy) / 2;
  return strokes.map(s => s.map(p => ({ x: (p.x - mx) * sc + cx, y: -(p.y - my) * sc + cy })));
}

// Place a drawing by its own frame (an SVG's viewBox, 0 to 100 by default) into a box in board mm, keeping its
// shape and flipping y. Unlike fitStrokes, an edited drawing lands where the original was.
export function toBox(strokes, box, vb = { x: 0, y: 0, w: 100, h: 100 }) {
  const s = Math.min(box.w / vb.w, box.h / vb.h), ox = box.x + (box.w - vb.w * s) / 2, oy = box.y + (box.h - vb.h * s) / 2;
  return strokes.map((st) => st.map((p) => ({ x: ox + (p.x - vb.x) * s, y: oy + (vb.y + vb.h - p.y) * s })));
}

export function resample(stroke, step) {
  if (stroke.length < 2) return stroke.slice();
  const out = [stroke[0]]; let acc = 0;
  for (let i = 1; i < stroke.length; i++) {
    let a = stroke[i - 1], b = stroke[i], d = Math.hypot(b.x - a.x, b.y - a.y);
    while (acc + d >= step) { const t = (step - acc) / d; a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; out.push(a); d = Math.hypot(b.x - a.x, b.y - a.y); acc = 0; }
    acc += d;
  }
  out.push(stroke[stroke.length - 1]);
  return out;
}

// ---- the order to draw strokes in, each either way round, for the least pen-up travel ----
// A tour is [{i, rev}]: stroke i, drawn backwards when rev. Travel is the sum of pen-up hops between strokes,
// plus the hop from `from` (the pen's position) when given.
const hop = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const headOf = (S, k) => (k.rev ? S[k.i][S[k.i].length - 1] : S[k.i][0]);
const tailOf = (S, k) => (k.rev ? S[k.i][0] : S[k.i][S[k.i].length - 1]);
export function tourTravel(S, tour, from = null) {
  let d = from && tour.length ? hop(from, headOf(S, tour[0])) : 0;
  for (let k = 1; k < tour.length; k++) d += hop(tailOf(S, tour[k - 1]), headOf(S, tour[k]));
  return d;
}

// Nearest stroke end next, from the pen's position (or the top-left of the drawing).
function greedy(S, from) {
  const left = new Set(S.map((_, i) => i)), tour = [];
  let at = from;
  if (!at) { const bb = bbox(S); at = { x: bb.minx, y: bb.maxy }; }
  while (left.size) {
    let best = null, bd = Infinity;
    for (const i of left) {
      const d0 = hop(at, S[i][0]), d1 = hop(at, S[i][S[i].length - 1]);
      if (d0 < bd) { bd = d0; best = { i, rev: false }; }
      if (d1 < bd) { bd = d1; best = { i, rev: true }; }
    }
    tour.push(best); left.delete(best.i); at = tailOf(S, best);
  }
  return tour;
}

// Then improve it until no move helps: 2-opt (turn a run of strokes round, which also flips each stroke) and
// Or-opt (lift one stroke out and put it back elsewhere, either way round). Each move is scored by the two or
// three hops it changes, so a pass over n strokes costs n².
function improve(S, tour, from) {
  const n = tour.length, H = (k) => headOf(S, k), T = (k) => tailOf(S, k);
  const before = (a) => (a > 0 ? T(tour[a - 1]) : from);
  let better = true, guard = 0;
  while (better && guard++ < 60) {
    better = false;
    for (let a = 0; a < n - 1; a++) for (let b = a + 1; b < n; b++) {
      const p = before(a), q = b + 1 < n ? H(tour[b + 1]) : null;
      const old = (p ? hop(p, H(tour[a])) : 0) + (q ? hop(T(tour[b]), q) : 0);
      const neu = (p ? hop(p, T(tour[b])) : 0) + (q ? hop(H(tour[a]), q) : 0);
      if (neu < old - 1e-9) {
        const seg = tour.slice(a, b + 1).reverse().map((k) => ({ i: k.i, rev: !k.rev }));
        tour.splice(a, seg.length, ...seg); better = true;
      }
    }
    for (let a = 0; a < n; a++) {
      const k = tour[a], p = before(a), q = a + 1 < n ? H(tour[a + 1]) : null;
      const out = (p ? hop(p, H(k)) : 0) + (q ? hop(T(k), q) : 0) - (p && q ? hop(p, q) : 0);
      let bestGain = 1e-9, bestAt = -1, bestRev = false;
      const rest = tour.filter((_, x) => x !== a);
      for (let j = 0; j <= rest.length; j++) {
        const pp = j > 0 ? T(rest[j - 1]) : from, qq = j < rest.length ? H(rest[j]) : null;
        for (const rev of [false, true]) {
          const kk = { i: k.i, rev }, ins = (pp ? hop(pp, H(kk)) : 0) + (qq ? hop(T(kk), qq) : 0) - (pp && qq ? hop(pp, qq) : 0);
          if (out - ins > bestGain) { bestGain = out - ins; bestAt = j; bestRev = rev; }
        }
      }
      if (bestAt >= 0) { rest.splice(bestAt, 0, { i: k.i, rev: bestRev }); tour.splice(0, n, ...rest); better = true; }
    }
  }
  return tour;
}

// strokes -> a tour: ordered and turned round for the least travel. how: "greedy", "heuristic" (greedy then
// 2-opt and Or-opt), or "best" (the default): the exact optimum up to EXACT strokes, the heuristic above.
const EXACT = 12;
export function orderTour(S, { from = null, how = "best" } = {}) {
  if (S.length <= 1) return S.map((_, i) => ({ i, rev: false }));
  if (how === "best" && S.length <= EXACT) return exactTour(S, from).tour;
  const tour = greedy(S, from);
  return how === "greedy" ? tour : improve(S, tour, from);
}
export function order(strokes, opts = {}) {
  return orderTour(strokes, opts).map((k) => (k.rev ? strokes[k.i].slice().reverse() : strokes[k.i]));
}

// The true least travel, by dynamic programming over subsets (Held–Karp, with each stroke either way round):
// 2^n · n² steps, a few milliseconds for 12 strokes. -> { travel, tour }
export function exactTour(S, from = null) {
  const n = S.length, N = 1 << n, INF = 1e18;
  const cost = new Float64Array(N * n * 2).fill(INF), back = new Int32Array(N * n * 2).fill(-1);
  const at = (m, i, r) => (m * n + i) * 2 + r, end = (i, r) => (r ? S[i][0] : S[i][S[i].length - 1]), beg = (i, r) => (r ? S[i][S[i].length - 1] : S[i][0]);
  for (let i = 0; i < n; i++) for (const r of [0, 1]) cost[at(1 << i, i, r)] = from ? hop(from, beg(i, r)) : 0;
  for (let m = 1; m < N; m++) for (let i = 0; i < n; i++) for (const r of [0, 1]) {
    const c = cost[at(m, i, r)]; if (c >= INF || !(m & (1 << i))) continue;
    for (let j = 0; j < n; j++) if (!(m & (1 << j))) for (const t of [0, 1]) {
      const m2 = m | (1 << j), c2 = c + hop(end(i, r), beg(j, t));
      if (c2 < cost[at(m2, j, t)]) { cost[at(m2, j, t)] = c2; back[at(m2, j, t)] = at(m, i, r); }
    }
  }
  let best = INF, k = -1;
  for (let i = 0; i < n; i++) for (const r of [0, 1]) if (cost[at(N - 1, i, r)] < best) { best = cost[at(N - 1, i, r)]; k = at(N - 1, i, r); }
  const tour = [];
  for (; k >= 0; k = back[k]) { const i = Math.floor(k / 2) % n; tour.unshift({ i, rev: k % 2 === 1 }); }
  return { travel: best, tour };
}

// strokes (image coords) -> { toolpath:[{x,y,pen}], ink, travel, strokes:ordered(mm) }
// pen = 0 on the first point of each stroke (travel move), 1 while drawing.
export function plan(strokes, g = GEOM, opts = {}) {
  const half = opts.half ?? 90;               // drawing half-size in mm (180 mm box ~ 200 mm clock)
  const { cx, cy } = drawCentre(g);
  return drawPath(fitStrokes(strokes, half, cx, cy), opts);
}

// Strokes already in board mm -> the toolpath that draws them: ordered for least travel from `from`, resampled
// every `step` mm, each with a pen-up lead-in.
export function drawPath(strokes, opts = {}) {
  const step = opts.step ?? 2, lead = opts.leadIn ?? 0;
  const s = order(strokes.filter((st) => st.length > 1), { from: opts.from || null, how: opts.how }).map((st) => resample(st, step));
  const toolpath = []; let ink = 0, travel = 0; let prev = opts.from || null;
  for (const st of s) {
    // lead-in: stop short of the stroke and glide onto its start pen-up, moving the way the stroke goes, so the
    // servos' dead band and gear play are already taken up when the pen touches down
    if (lead > 0 && st.length > 1) {
      const dx = st[1].x - st[0].x, dy = st[1].y - st[0].y, d = Math.hypot(dx, dy) || 1;
      toolpath.push({ x: st[0].x - (dx / d) * lead, y: st[0].y - (dy / d) * lead, pen: 0 });
    }
    for (let i = 0; i < st.length; i++) {
      const pen = i === 0 ? 0 : 1;
      toolpath.push({ x: st[i].x, y: st[i].y, pen });
      if (i > 0) ink += Math.hypot(st[i].x - st[i - 1].x, st[i].y - st[i - 1].y);
    }
    if (prev) travel += Math.hypot(st[0].x - prev.x, st[0].y - prev.y);
    prev = st[st.length - 1];
  }
  return { toolpath, ink: Math.round(ink), travel: Math.round(travel), strokes: s };
}

// The eraser scrubs: along a wipe path it swings `amp` mm to each side, once every `period` mm, so the felt rubs
// across the ink as well as along it and covers a band 2 * amp wider. No amp leaves the path as it is.
export function scrub(path, amp, period = 12) {
  if (!(amp > 0) || !(period > 0) || path.length < 2) return path;
  const pts = resample(path, Math.min(2, period / 6)), out = []; let d = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const o = amp * Math.sin((2 * Math.PI * d) / period);
    out.push({ x: pts[i].x - ((b.y - a.y) / L) * o, y: pts[i].y + ((b.x - a.x) / L) * o });
  }
  return out;
}

// The eraser sweeps across a line instead of along it: from `half` mm one side to `half` mm the other, then `step` mm
// along the line, then back across, so the rubber moves at right angles to the line and each sweep wipes `step` mm of
// it with the eraser's edge that lies along the line (the longer edge, when it is mounted so).
export function sweepAcross(path, half, step) {
  if (!(half > 0) || !(step > 0) || path.length < 2) return path;
  const pts = resample(path, step), out = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = (-(b.y - a.y) / L) * half, ny = ((b.x - a.x) / L) * half, s = i % 2 ? 1 : -1;
    out.push({ x: p.x + nx * s, y: p.y + ny * s }, { x: p.x - nx * s, y: p.y - ny * s });
  });
  return out;
}

// A wipe over the drawing area with the eraser end: rows `width * 0.7` apart so passes overlap, drawn as one
// zigzag so the eraser never lifts between rows, scrubbing side to side as it goes (config erase.zigzag). Returns
// a toolpath in the same shape as plan()'s.
export function erasePlan(g = GEOM, opts = {}) {
  const half = (opts.half ?? g.half ?? 90) + 6, w = opts.width ?? g.eraserWidth ?? 20, step = opts.step ?? 4;
  const { cx, cy } = drawCentre(g);
  const gap = Math.max(4, w * 0.7), rows = Math.ceil((2 * half) / gap) + 1;
  const path = []; let ink = 0;
  for (let r = 0; r < rows; r++) {
    const y = cy + half - Math.min(2 * half, r * gap), xs = [cx - half, cx + half]; if (r % 2) xs.reverse();
    path.push({ x: xs[0], y }, { x: xs[1], y });
    ink += 2 * half + (r ? gap : 0);
  }
  const pts = scrub(resample(path, step), opts.zigzag ?? g.erase?.zigzag ?? 0, g.erase?.period);
  const toolpath = pts.map((p, i) => ({ x: p.x, y: p.y, pen: i ? 1 : 0, tool: i ? "erase" : "lift" }));
  return { toolpath, ink: Math.round(ink), travel: 0, strokes: [] };
}
