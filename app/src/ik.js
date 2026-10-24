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
  const lim = (j, a) => { const s = g.servo?.[j]; if (!s) return true; const v = +s.offset + +s.dir * a; return v >= +s.min - 1e-6 && v <= +s.max + 1e-6; };
  const path = toolpath.map((p) => {
    const s = ik(p.x, p.y, g.L1, g.L2, g.elbowUp);
    if (!s) { unreachable++; return { out_of_reach: true }; }
    worstDex = Math.min(worstDex, s.dex);
    const tool = p.tool || (p.pen ? "draw" : "lift");
    const base = +((((s.t1 * R2D + 180) % 360) + 360) % 360 - 180).toFixed(2), elbow = +(s.t2 * R2D).toFixed(2);
    if (!lim("base", base) || !lim("elbow", elbow)) outOfRange++;
    return { base, elbow, tilt: g.tilt[tool], pressure: tool === "lift" ? 0 : g.pressure };
  });
  return { path, unreachable, outOfRange, worstDex: +worstDex.toFixed(3) };
}
