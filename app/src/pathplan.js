// Turn polylines into the most effective pen path: fit to the board, order the strokes to minimise
// pen-up travel (greedy nearest-neighbour with reversal), resample, and flatten to a toolpath.
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

// Greedy nearest-neighbour ordering from the top-left, allowing each stroke to be drawn either way,
// to cut the pen-up travel between strokes.
export function order(strokes) {
  if (strokes.length <= 1) return strokes.slice();
  const left = strokes.map((s, i) => i);
  const end = s => s[s.length - 1];
  const out = [];
  // start at the stroke whose start is nearest the top-left of the group
  const bb = bbox(strokes), corner = { x: bb.minx, y: bb.miny };
  let bi = 0, bd = Infinity;
  left.forEach(i => { const d = Math.hypot(strokes[i][0].x - corner.x, strokes[i][0].y - corner.y); if (d < bd) { bd = d; bi = i; } });
  let cur = strokes[bi]; out.push(cur); left.splice(left.indexOf(bi), 1);
  let tip = end(cur);
  while (left.length) {
    let best = -1, rev = false, dist = Infinity;
    for (const i of left) {
      const s = strokes[i];
      const d0 = Math.hypot(s[0].x - tip.x, s[0].y - tip.y);
      const d1 = Math.hypot(end(s).x - tip.x, end(s).y - tip.y);
      if (d0 < dist) { dist = d0; best = i; rev = false; }
      if (d1 < dist) { dist = d1; best = i; rev = true; }
    }
    let s = strokes[best]; if (rev) s = s.slice().reverse();
    out.push(s); left.splice(left.indexOf(best), 1); tip = end(s);
  }
  return out;
}

// strokes (image coords) -> { toolpath:[{x,y,pen}], ink, travel, strokes:ordered(mm) }
// pen = 0 on the first point of each stroke (travel move), 1 while drawing.
export function plan(strokes, g = GEOM, opts = {}) {
  const half = opts.half ?? 90;               // drawing half-size in mm (180 mm box ~ 200 mm clock)
  const { cx, cy } = drawCentre(g);
  const step = opts.step ?? 2;
  let s = fitStrokes(strokes, half, cx, cy);
  s = order(s).map(st => resample(st, step));
  const toolpath = []; let ink = 0, travel = 0; let prev = null;
  for (const st of s) {
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

// A wipe over the drawing area with the eraser end: rows `width * 0.7` apart so passes overlap, drawn as one
// zigzag so the eraser never lifts between rows. Returns a toolpath in the same shape as plan()'s.
export function erasePlan(g = GEOM, opts = {}) {
  const half = (opts.half ?? g.half ?? 90) + 6, w = opts.width ?? g.eraserWidth ?? 20, step = opts.step ?? 4;
  const { cx, cy } = drawCentre(g);
  const gap = Math.max(4, w * 0.7), rows = Math.ceil((2 * half) / gap) + 1;
  const toolpath = []; let ink = 0;
  for (let r = 0; r < rows; r++) {
    const y = cy + half - Math.min(2 * half, r * gap), ltr = r % 2 === 0;
    const xs = [cx - half, cx + half]; if (!ltr) xs.reverse();
    const row = resample([{ x: xs[0], y }, { x: xs[1], y }], step);
    row.forEach((p, i) => toolpath.push({ x: p.x, y: p.y, pen: r === 0 && i === 0 ? 0 : 1, tool: r === 0 && i === 0 ? "lift" : "erase" }));
    ink += 2 * half + (r ? gap : 0);
  }
  return { toolpath, ink: Math.round(ink), travel: 0, strokes: [] };
}
