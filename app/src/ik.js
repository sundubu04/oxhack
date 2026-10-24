// Inverse kinematics for the serial two-link arm (base + elbow), reused from the verified sim.
// All lengths in mm, angles in degrees CCW from +x, elbow relative to link 1. Base at the origin.
export const R2D = 180 / Math.PI;

export function fk(t1, t2, L1, L2) {
  const ex = L1 * Math.cos(t1), ey = L1 * Math.sin(t1);
  return { ex, ey, px: ex + L2 * Math.cos(t1 + t2), py: ey + L2 * Math.sin(t1 + t2) };
}

// (x,y) in mm -> { t1, t2 (radians), dex } or null if out of reach.
export function ik(x, y, L1, L2, up = true) {
  const r2 = x * x + y * y, r = Math.sqrt(r2);
  if (r > L1 + L2 + 1e-6 || r < Math.abs(L1 - L2) - 1e-6) return null;
  let c2 = (r2 - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  c2 = Math.min(1, Math.max(-1, c2));
  const s2 = Math.sqrt(1 - c2 * c2) * (up ? 1 : -1), t2 = Math.atan2(s2, c2);
  const t1 = Math.atan2(y, x) - Math.atan2(L2 * s2, L1 + L2 * c2);
  return { t1, t2, dex: Math.sqrt(1 - c2 * c2) };
}

// The pen lies across the forearm's tip (docs/pages/pen-mount.html): the nib touches `nibSide` mm to one side
// of the tip and the eraser `eraserSide` mm to the other (+ is the counter-clockwise side). Seen as a link, the
// forearm out to either end is a little longer and turned by gamma.
export function toolLink(g, tool) {
  const side = tool === "erase" ? +(g.eraserSide || 0) : +(g.nibSide || 0);
  return { L: Math.hypot(g.L2, side), gamma: Math.atan2(side, g.L2) };
}
// Joint angles that put this end of the pen on (x, y), or null when it is out of reach.
export function ikTool(x, y, g, tool = "draw") {
  const { L, gamma } = toolLink(g, tool), s = ik(x, y, g.L1, L, g.elbowUp);
  return s && { t1: s.t1, t2: s.t2 - gamma, dex: s.dex };
}
// Where this end of the pen is for given joint angles (radians).
export function toolPoint(t1, t2, g, tool = "draw") {
  const { L, gamma } = toolLink(g, tool), f = fk(t1, t2 + gamma, g.L1, L);
  return { x: f.px, y: f.py };
}

// Default geometry — the chosen build (180 mm links, base 40 mm below a 350 mm board, clock centred).
export const GEOM = {
  L1: 180, L2: 180, standoff: 40, board: 350, elbowUp: true, pressure: 60,
  tilt: { draw: -14, lift: -2, erase: 16 },
};
// where the drawing sits, in arm coords: centred on the board, base `standoff` below it.
export function drawCentre(g = GEOM) { return { cx: 0, cy: g.standoff + g.board / 2 }; }

// toolpath [{x,y,pen,tool?}] (mm, arm frame) -> angle stream for the Pi. tool is draw, lift or erase;
// without one, pen 1 draws and pen 0 lifts. outOfRange counts waypoints past a servo's limits, when the
// geometry carries servo calibration (see config.js).
export function toAngles(toolpath, g = GEOM) {
  let unreachable = 0, worstDex = 1, outOfRange = 0;
  const lim = (j, a) => { const s = g.servo?.[j]; if (!s) return true; const v = +s.offset + +s.dir * (+s.ratio || 1) * a; return v >= +s.min - 1e-6 && v <= +s.max + 1e-6; };
  const tools = toolpath.map((p) => p.tool || (p.pen ? "draw" : "lift"));
  // a lifted move aims the end that touches down next (the nib before a stroke, the felt before a wipe)
  const hand = tools.slice(); let next = "draw";
  for (let i = hand.length - 1; i >= 0; i--) { if (hand[i] === "lift") hand[i] = next; else next = hand[i]; }
  const path = toolpath.map((p, i) => {
    const s = ikTool(p.x, p.y, g, hand[i]);
    if (!s) { unreachable++; return { out_of_reach: true }; }
    worstDex = Math.min(worstDex, s.dex);
    const tool = tools[i];
    const base = +((((s.t1 * R2D + 180) % 360) + 360) % 360 - 180).toFixed(2), elbow = +(s.t2 * R2D).toFixed(2);
    if (!lim("base", base) || !lim("elbow", elbow)) outOfRange++;
    return { base, elbow, tilt: g.tilt[tool], pressure: tool === "lift" ? 0 : g.pressure };
  });
  return { path, unreachable, outOfRange, worstDex: +worstDex.toFixed(3) };
}
