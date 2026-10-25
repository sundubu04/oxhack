import { penGeometry, measuredPen } from "./pen.js";

// The arm's real dimensions live in app/arm.config.json, the one place to change them. The Arm setup page
// edits that file through the dev server; everything else reads the flat geometry that geomFrom() makes.
// Lengths in mm, angles in degrees, speeds in mm/s (pen) and deg/s (servo).
export const DEFAULT_CONFIG = {
  rev: 0,   // which saved version this is: the server refuses a save from a page that loaded an older one
  name: "Clockedin arm",
  measured: false,
  links: { L1: 157, L2: 190 },   // the build, measured 25 Oct: upper arm 157 mm, forearm 190 mm (elbow to nib)
  // base "corner": the board hangs as a diamond with the base shaft `inset` mm in from its bottom corner, and the arm
  // reaches straight up through it, the drawing's middle `drawing.reach` mm above the base (the build, 25 Oct; the
  // jog sketch's frame). base "below": centred `standoff` mm below a square board's bottom edge, the drawing in its middle.
  board: { width: 350, height: 350, standoff: 40, base: "corner", inset: 20 },
  // the drawing's middle: `reach` mm up from the base and `x` mm across (Arm setup's Centre here sets both)
  drawing: { size: 160, reach: 220, x: 0 },
  // width and height scale, from the circle test: drawings are stretched by these about their middle so they come out
  // true on the board (1 = as the model says)
  correct: { sx: 1, sy: 1 },
  elbow: "down",   // the build's elbow sits to the left of the line from base to pen ("up" would put it on the right)
  // Measured on the build with the team's jog sketch (firmware/jog), in servo degrees: home, and the pen servo with
  // the nib on the board, lifted, and the eraser on the board. Where each end of the marker touches, in mm from
  // the forearm's tip: along the forearm (+ further out) and across it (+ to the left, looking from the elbow).
  park: { base: 160, elbow: 10 },
  penServo: { draw: 4, lift: 40, erase: 180 },   // erase 180 from the team on 25 Oct (the jog sketch had 150)
  // The team, 25 Oct: the pen sits on the forearm's centre line, the eraser lands dead centre and the nib a little to the
  // left (3 mm to start: line them up with Arm setup's eraser check).
  tool: { nib: { along: 0, side: 3 }, eraser: { along: 14, side: 0 } },
  // Wiping: "area" covers the whole box round what goes, "lines" follows the lines, "fastest" picks the quicker. Along a
  // line the eraser sweeps across it (sweep "across": `zigzag` mm to each side, `step` mm along between sweeps; the
  // team's ask, 25 Oct) or waves along it (sweep "along": `zigzag` mm each side once every `period` mm); rows always
  // wave. It goes over each wipe `passes` times, each pass `apart` mm to one side of the last, to catch a line the
  // error carries it past.
  erase: { how: "area", sweep: "across", zigzag: 4, step: 4, period: 12, passes: 3, apart: 3 },
  // The marker, measured with its caps on: 165 mm long (the team's pen); barrel width and how far the nib sticks
  // out are placeholders until measured. angle 0 means the best angle for this pen (see pen.js); margin is how
  // far the barrel's edge must stay off the board; press and lift are how far the nib goes in and comes away.
  // pivot: how high the pen servo's shaft is above the board (70 mm on the build)
  pen: { length: 165, barrel: 17, nib: 12, angle: 0, margin: 5, press: 1, lift: 3, pressure: 60, eraserWidth: 20, pivot: 70 },
  // leadIn: mm of pen-up glide onto each stroke. Draw speed is the jog sketch's (1 mm per 25 ms). A hobby servo
  // told to stop dead overshoots, so the pen speeds up and slows down at accel (mm/s²) and takes a right-angle
  // corner at cornerSpeed (mm/s; sharper corners slower). Lower accel if lines end in a hook.
  motion: { drawSpeed: 40, travelSpeed: 120, eraseSpeed: 60, leadIn: 3, accel: 1000, cornerSpeed: 15 },   // a wipe needn't be as exact as a line
  // SG92R datasheet: 0.1 s per 60 deg at 4.8 V; about 1 deg dead band (docs/pages/arm-sim.html). backlash is the
  // gear play, in degrees at the servo horn: 0 until measured. compensate pushes commands past both. accel caps
  // how fast any joint speeds up or slows down, in deg/s²: well under what an SG92R can give the loaded arm, so it
  // tracks without overshoot (find the real figure with "accel" in the motor test).
  servos: {
    model: "TowerPro SG92R", speed: 600, accel: 1500, resolution: 1, backlash: 0, compensate: true,
    // ratio: servo degrees per joint degree, for a belt or gear reduction between servo and link
    // zero offsets, servo deg = offset + joint deg (the base from +x, the elbow from the upper arm, + anticlockwise),
    // from the jog sketch: base servo 0 points 60 deg round from +x; elbow servo 175 with the links straight.
    // Calibrate live in Arm setup (Live arm). Best zeros there is for mounting horns afresh.
    base: { min: 0, max: 180, offset: -60, dir: 1, ratio: 1 },
    elbow: { min: 0, max: 180, offset: 175, dir: 1, ratio: 1 },
    tilt: { min: 0, max: 180, offset: 90, dir: 1, ratio: 1 },   // the tilt servo's neutral at 90 deg; pen tilts are relative to it
  },
  // Live moves from Arm setup or /api/arm (lib/arm.mjs): the newest target goes out at most every `interval` ms,
  // only if some servo moves `minStep` deg or more, and the board glides to it at up to `speed` deg/s, speeding up
  // and slowing down at servos.accel. Raise interval or lower speed if the arm shakes.
  live: { interval: 40, minStep: 0.2, speed: 120 },
  // The Arduino: signal pins for base, elbow and tilt, each servo's pulse width at 0 and 180 deg (the Servo
  // library's defaults until calibrated with the motor test's "us" command), and the board for arduino-cli.
  // tools/arduino-export.mjs writes these into every sketch's arm_config.h.
  arduino: { board: "arduino:avr:mega", pins: [9, 10, 11], usMin: [544, 544, 544], usMax: [2400, 2400, 2400] },
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

// The flat geometry the planner, IK and sim use. Base axis at the origin, x right, y up (towards the drawing).
// The board's own corner is `bo`, its bottom edge at `bang` radians from x (45 deg for the diamond); the
// drawing's middle is (cx, cy), upright in the arm's frame.
export function geomFrom(cfg) {
  const c = withDefaults(cfg), W = +c.board.width, H = +c.board.height, corner = c.board.base === "corner";
  const reach = +c.drawing.reach || +c.board.standoff + H / 2;
  const s = c.servos, joint = (j, v) => (+v - +s[j].offset) / (+s[j].dir * (+s[j].ratio || 1));
  return {
    L1: +c.links.L1, L2: +c.links.L2,
    standoff: +c.board.standoff, board: H, boardW: W, corner,
    bo: corner ? { x: 0, y: -(+c.board.inset || 0) } : { x: -W / 2, y: +c.board.standoff }, bang: corner ? Math.PI / 4 : 0,
    cx: +c.drawing.x || 0, cy: corner ? reach : +c.board.standoff + H / 2,
    correct: { sx: +c.correct.sx || 1, sy: +c.correct.sy || 1 },
    half: +c.drawing.size / 2, elbowUp: c.elbow !== "down",
    ...penFields(c.pen),
    // what was measured on the arm wins over what pen.js works out from the marker's size
    tilt: { draw: joint("tilt", c.penServo.draw), lift: joint("tilt", c.penServo.lift), erase: joint("tilt", c.penServo.erase), liftErase: joint("tilt", c.penServo.lift) },
    nibAlong: +c.tool.nib.along, nibSide: +c.tool.nib.side, eraserAlong: +c.tool.eraser.along, eraserSide: +c.tool.eraser.side,
    // the marker's pivot height and swing, from where its two ends were measured to touch (for the 3D view)
    pen: { ...penGeometry(c.pen), ...measuredPen(+c.pen.length, Math.hypot(+c.tool.eraser.along - +c.tool.nib.along, +c.tool.eraser.side - +c.tool.nib.side), +c.pen.pivot) },
    park: { base: joint("base", c.park.base), elbow: joint("elbow", c.park.elbow) },
    pressure: +c.pen.pressure, eraserWidth: +c.pen.eraserWidth, erase: { how: c.erase.how, sweep: c.erase.sweep, zigzag: +c.erase.zigzag, step: +c.erase.step || +c.pen.eraserWidth * 0.8, period: +c.erase.period, passes: Math.max(1, Math.round(+c.erase.passes || 1)), apart: +c.erase.apart || 0 },
    drawSpeed: +c.motion.drawSpeed, travelSpeed: +c.motion.travelSpeed, eraseSpeed: +c.motion.eraseSpeed || +c.motion.drawSpeed, leadIn: +c.motion.leadIn, accel: +c.motion.accel, cornerSpeed: +c.motion.cornerSpeed,
    servo: { speed: +c.servos.speed, accel: +c.servos.accel, resolution: +c.servos.resolution, backlash: +c.servos.backlash, compensate: c.servos.compensate !== false, base: c.servos.base, elbow: c.servos.elbow, tilt: c.servos.tilt },
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
