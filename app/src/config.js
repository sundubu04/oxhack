import { penGeometry } from "./pen.js";

// The arm's real dimensions live in app/arm.config.json, the one place to change them. The Arm setup page
// edits that file through the dev server; everything else reads the flat geometry that geomFrom() makes.
// Lengths in mm, angles in degrees, speeds in mm/s (pen) and deg/s (servo).
export const DEFAULT_CONFIG = {
  name: "Clockedin arm",
  measured: false,
  links: { L1: 160, L2: 200 },   // the build: upper arm 16 cm, forearm 20 cm
  board: { width: 350, height: 350, standoff: 40 },
  drawing: { size: 180 },
  elbow: "up",   // up: the elbow bends to the right of the line from base to pen, as on the build (Arm setup says Right)
  // The marker, measured with its caps on: 165 mm long (the team's pen); barrel width and how far the nib sticks
  // out are placeholders until measured. angle 0 means the best angle for this pen (see pen.js); margin is how
  // far the barrel's edge must stay off the board; press and lift are how far the nib goes in and comes away.
  pen: { length: 165, barrel: 17, nib: 12, angle: 0, margin: 5, press: 1, lift: 3, pressure: 60, eraserWidth: 20 },
  motion: { drawSpeed: 150, travelSpeed: 300, leadIn: 3 },   // leadIn: mm of pen-up glide onto each stroke
  // SG92R datasheet: 0.1 s per 60 deg at 4.8 V; about 1 deg dead band (docs/pages/arm-sim.html). backlash is the
  // gear play, in degrees at the servo horn: 0 until measured. compensate pushes commands past both.
  servos: {
    model: "TowerPro SG92R", speed: 600, resolution: 1, backlash: 0, compensate: true,
    // ratio: servo degrees per joint degree, for a belt or gear reduction between servo and link
    // zero offsets keep each joint's working range inside its servo's travel (base -31 to 76 deg, elbow 41 to 158
    // deg for the drawing square, the wipe and the park pose, so servo 27 to 134 and 31 to 148): mount the base so
    // servo 90 points 32 deg up from +x, and the elbow so servo 90 is 100 deg round from link 1
    base: { min: 0, max: 180, offset: 58, dir: 1, ratio: 1 },
    elbow: { min: 0, max: 180, offset: -10, dir: 1, ratio: 1 },
    tilt: { min: 0, max: 180, offset: 90, dir: 1, ratio: 1 },   // the tilt servo's neutral at 90 deg; pen tilts are relative to it
  },
  // The Arduino: signal pins for base, elbow and tilt, each servo's pulse width at 0 and 180 deg (the Servo
  // library's defaults until calibrated with the motor test's "us" command), and the board for arduino-cli.
  // tools/arduino-export.mjs writes these into every sketch's arm_config.h.
  arduino: { board: "arduino:avr:uno", pins: [9, 10, 11], usMin: [544, 544, 544], usMax: [2400, 2400, 2400] },
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
    ...penFields(c.pen),
    pressure: +c.pen.pressure, eraserWidth: +c.pen.eraserWidth,
    drawSpeed: +c.motion.drawSpeed, travelSpeed: +c.motion.travelSpeed, leadIn: +c.motion.leadIn,
    servo: { speed: +c.servos.speed, resolution: +c.servos.resolution, backlash: +c.servos.backlash, compensate: c.servos.compensate !== false, base: c.servos.base, elbow: c.servos.elbow, tilt: c.servos.tilt },
  };
}

// The tilts and the two ends' offsets across the forearm come from the pen's measurements.
function penFields(p) {
  const pg = penGeometry(p);
  return { pen: pg, tilt: { draw: pg.draw, lift: pg.lift, erase: pg.erase, liftErase: -pg.lift }, nibSide: pg.side, eraserSide: -pg.side };
}

// Geometry angle -> the angle the servo is commanded to, through its calibration.
export function servoAngle(joint, a, g) { const s = g.servo[joint]; return +s.offset + +s.dir * (+s.ratio || 1) * a; }
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
