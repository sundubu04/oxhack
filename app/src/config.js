// The arm's real dimensions live in app/arm.config.json, the one place to change them. The Arm setup page
// edits that file through the dev server; everything else reads the flat geometry that geomFrom() makes.
// Lengths in mm, angles in degrees, speeds in mm/s (pen) and deg/s (servo).
export const DEFAULT_CONFIG = {
  name: "Clockwork arm",
  measured: false,
  links: { L1: 180, L2: 180 },
  board: { width: 350, height: 350, standoff: 40 },
  drawing: { size: 180 },
  elbow: "up",
  pen: { drawTilt: -14, liftTilt: -2, eraseTilt: 16, pressure: 60, eraserWidth: 20 },
  motion: { drawSpeed: 150, travelSpeed: 300 },
  // SG92R datasheet: 0.1 s per 60 deg at 4.8 V; about 1 deg effective resolution (docs/pages/arm-sim.html).
  servos: {
    model: "TowerPro SG92R", speed: 600, resolution: 1,
    base: { min: 0, max: 180, offset: 0, dir: 1 },
    elbow: { min: 0, max: 180, offset: 0, dir: 1 },
    tilt: { min: 0, max: 180, offset: 90, dir: 1 },   // the tilt servo's neutral at 90 deg; pen tilts are relative to it
  },
};

// Deep merge so a config file missing a key still gets the default for it.
export function withDefaults(cfg = {}, def = DEFAULT_CONFIG) {
  const out = {};
  for (const k of Object.keys(def)) {
    const d = def[k], v = cfg[k];
    out[k] = d && typeof d === "object" && !Array.isArray(d) ? withDefaults(v || {}, d) : (v ?? d);
  }
  return out;
}

// The flat geometry the planner, IK and sim use. Base axis at the origin, board above it, x right, y up.
export function geomFrom(cfg) {
  const c = withDefaults(cfg);
  return {
    L1: +c.links.L1, L2: +c.links.L2,
    standoff: +c.board.standoff, board: +c.board.height, boardW: +c.board.width,
    half: +c.drawing.size / 2, elbowUp: c.elbow !== "down",
    tilt: { draw: +c.pen.drawTilt, lift: +c.pen.liftTilt, erase: +c.pen.eraseTilt },
    pressure: +c.pen.pressure, eraserWidth: +c.pen.eraserWidth,
    drawSpeed: +c.motion.drawSpeed, travelSpeed: +c.motion.travelSpeed,
    servo: { speed: +c.servos.speed, resolution: +c.servos.resolution, base: c.servos.base, elbow: c.servos.elbow, tilt: c.servos.tilt },
  };
}

// Geometry angle -> the angle the servo is commanded to, through its calibration.
export function servoAngle(joint, a, g) { const s = g.servo[joint]; return +s.offset + +s.dir * a; }
export function inServoRange(joint, a, g) { const s = g.servo[joint], v = servoAngle(joint, a, g); return v >= +s.min - 1e-6 && v <= +s.max + 1e-6; }

export async function loadConfig() {
  try { const r = await fetch("./arm.config.json", { cache: "no-store" }); if (r.ok) return withDefaults(await r.json()); } catch (e) {}
  return withDefaults({});
}

export async function saveConfig(cfg) {
  const r = await fetch("./api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Save failed (${r.status})`);
  return withDefaults(await r.json());
}
