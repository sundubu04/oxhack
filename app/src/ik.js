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

// Each end of the marker touches the board near the forearm's tip: `nibAlong` mm further out along the forearm and
// `nibSide` mm across it (+ is the counter-clockwise side), and the same for the eraser. Seen as a link, the
// forearm out to either end is a little longer and turned by gamma.
export function toolLink(g, tool) {
  const side = tool === "erase" ? +(g.eraserSide || 0) : +(g.nibSide || 0), along = tool === "erase" ? +(g.eraserAlong || 0) : +(g.nibAlong || 0);
  return { L: Math.hypot(g.L2 + along, side), gamma: Math.atan2(side, g.L2 + along) };
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

// Default geometry — the build (160 mm upper arm, 200 mm forearm, elbow on the left, base 40 mm below a 350 mm board, clock centred).
export const GEOM = {
  L1: 160, L2: 200, standoff: 40, board: 350, elbowUp: false, pressure: 60,
  tilt: { draw: -14, lift: -2, erase: 16 },
};
// where the drawing's middle sits, in arm coords (config.js works it out for a base below the board or at its corner)
export function drawCentre(g = GEOM) { return { cx: g.cx ?? 0, cy: g.cy ?? g.standoff + g.board / 2 }; }

// The base angle, a whole turn either way, that its servo can reach: with the elbow on the left the base works
// around 180 deg, so a plain -180..180 wrap would send it to the far end of its travel.
function baseTurn(deg, g) {
  const s = g.servo?.base, w = (((deg + 180) % 360) + 360) % 360 - 180;
  if (!s) return w;
  const v = (a) => +s.offset + +s.dir * (+s.ratio || 1) * a, mid = (+s.min + +s.max) / 2;
  return [w, w + 360, w - 360].reduce((best, a) => (Math.abs(v(a) - mid) < Math.abs(v(best) - mid) ? a : best));
}

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
    const base = +baseTurn(s.t1 * R2D, g).toFixed(2), elbow = +(s.t2 * R2D).toFixed(2);
    if (!lim("base", base) || !lim("elbow", elbow)) outOfRange++;
    // lifted, the pen waits on the side of the end it uses next, so wipes don't swing it over to the nib and back
    const tilt = tool === "lift" && hand[i] === "erase" ? (g.tilt.liftErase ?? g.tilt.lift) : g.tilt[tool];
    return { base, elbow, tilt, pressure: tool === "lift" ? 0 : g.pressure };
  });
  return { path, unreachable, outOfRange, worstDex: +worstDex.toFixed(3) };
}
