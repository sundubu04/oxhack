// Is the sim what the motors get? Builds real jobs, turns them into the keyframes the Arduino receives, replays
// those through the firmware's own 50 Hz interpolation (a line-for-line copy of frame() in clockwork.ino), and
// compares every servo command with what the sim commands at the same moment. node tools/verify-motors.mjs
import { readFileSync } from "node:fs";
import { geomFrom, withDefaults, servoAngle } from "../src/config.js";
import { toBox, drawPath, erasePlan } from "../src/pathplan.js";
import { planChange } from "../src/optimize.js";
import { toAngles } from "../src/ik.js";
import { makeJob, Sim } from "../src/sim.js";
import { keyframes } from "../src/arm.js";
import { clockSVG, SAMPLES } from "../src/sample.js";
import * as ttt from "../src/games/tictactoe.js";

const g = geomFrom(withDefaults(JSON.parse(readFileSync(new URL("../arm.config.json", import.meta.url), "utf8"))));
const cy = g.standoff + g.board / 2, box = { x: -g.half, y: cy - g.half, w: 2 * g.half, h: 2 * g.half };
const lines = (svg) => [...svg.matchAll(/<line[^>]*x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g)].map((m) => [{ x: +m[1], y: +m[2] }, { x: +m[3], y: +m[4] }]);
const clock = (t) => { const r = []; for (let i = 0; i <= 72; i++) r.push({ x: 50 + 44 * Math.cos(i / 72 * 2 * Math.PI), y: 50 + 44 * Math.sin(i / 72 * 2 * Math.PI) }); return toBox([r, ...lines(clockSVG(t))], box); };

// the firmware: hold the keyframe at or before now, slide linearly to the next; constrain to 0..180 degrees
function firmwareAt(keys, tms) {
  let h = 0; while (h + 1 < keys.length && keys[h + 1].t <= tms) h++;
  const a = keys[h], b = keys[h + 1];
  const c = (v) => Math.max(0, Math.min(18000, v)) / 100;
  if (!b || tms <= a.t) return a.a.map(c);
  const u = (tms - a.t) / (b.t - a.t); return a.a.map((v, j) => c(v + (b.a[j] - v) * u));
}

const jobs = {
  "clock face": (() => { const tp = drawPath(clock(new Date("2026-10-24T10:10:00")), { from: { x: 0, y: g.standoff + 20 }, leadIn: g.leadIn }).toolpath; return makeJob(tp, toAngles(tp, g), g); })(),
  "clock, next minute (erase and draw)": (() => { const r = planChange(clock(new Date("2026-10-24T10:10:00")), clock(new Date("2026-10-24T10:11:00")), g, { from: { x: 0, y: g.standoff + 20 } }); return makeJob(r.best.toolpath, toAngles(r.best.toolpath, g), g); })(),
  "tic-tac-toe, new game (wipe marks)": (() => { const before = [...ttt.gridStrokes(box), ...ttt.markStrokes(box, 0, "X"), ...ttt.markStrokes(box, 4, "O"), ...ttt.markStrokes(box, 8, "X")]; const r = planChange(before, ttt.gridStrokes(box), g, { from: { x: 0, y: g.standoff + 20 } }); return makeJob(r.best.toolpath, toAngles(r.best.toolpath, g), g); })(),
  "full wipe": (() => { const tp = erasePlan(g).toolpath; return makeJob(tp, toAngles(tp, g), g); })(),
};

const rows = [];
for (const [name, job] of Object.entries(jobs)) {
  const keys = keyframes(job, g), sim = new Sim(g); sim.physics = true; sim.load(job);
  const worst = [0, 0, 0], diffs = [];
  let t = 0;
  for (let f = 0; f * 20 <= job.total * 1000; f++) {
    // both sides at the same instant, just after the frame tick, so a keyframe due exactly then counts for both
    const tf = f * 0.02 + 1e-6; sim.advance(tf - t, null); t = tf;
    const tg = sim.target(), simServo = ["base", "elbow", "tilt"].map((j) => { const c = g.servo[j]; return Math.max(+c.min, Math.min(+c.max, servoAngle(j, tg[j], g))); });
    // keyframe times go out in whole milliseconds, so compare within one millisecond either way
    const fws = [-1, 0, 1].map((dt) => firmwareAt(keys, Math.round(tf * 1000) + dt));
    const d = simServo.map((v, j) => Math.min(...fws.map((fw) => Math.abs(v - fw[j]))));
    d.forEach((v, j) => { worst[j] = Math.max(worst[j], v); }); diffs.push(Math.max(...d));
  }
  diffs.sort((a, b) => a - b);
  rows.push({ job: name, seconds: +job.total.toFixed(1), keyframes: keys.length, frames: diffs.length, worstBase: +worst[0].toFixed(3), worstElbow: +worst[1].toFixed(3), worstTilt: +worst[2].toFixed(3), p99: +diffs[Math.floor(diffs.length * 0.99)].toFixed(3) });
}
console.log("sim command vs what the firmware commands (within 1 ms), degrees of servo travel, every 20 ms frame:");
console.table(rows);
