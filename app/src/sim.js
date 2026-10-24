// Live simulation of the arm: the angle stream played through the servos' limits (top speed and resolution),
// so the line on screen is the one the real arm would leave, wobble and lag included. Pure: no DOM.
import { fk, ik, R2D } from "./ik.js";

const D2R = Math.PI / 180;
const NEAR = 1.5;   // deg: how close the tilt servo must be to a pose for the marker or eraser to touch

// When each waypoint is commanded. The pen moves at drawSpeed and travels at travelSpeed, but never faster than
// the servos can turn; when the tilt changes the arm holds still while the marker settles (the way the firmware
// should do it), so strokes start clean. tTilt[i]: the tilt for waypoint i is sent; tGo[i]: the arm sets off
// for it; tCmd[i]: it should have arrived.
export function makeJob(toolpath, angles, g) {
  const n = toolpath.length, tCmd = new Float64Array(n), tGo = new Float64Array(n), tTilt = new Float64Array(n);
  let lastTilt = null, last = null;
  for (let i = 0; i < n; i++) {
    const a = angles.path[i];
    const tilt = a.out_of_reach ? lastTilt : a.tilt;
    const prev = i ? tCmd[i - 1] : 0;
    const dwell = lastTilt != null && tilt !== lastTilt ? Math.abs(tilt - lastTilt) / g.servo.speed + 0.05 : 0;
    // the first move comes from the park pose, at travel speed
    const p = i ? toolpath[i - 1] : homeTip(g), q = toolpath[i], tool = i ? q.tool || (q.pen ? "draw" : "lift") : "lift";
    let move = Math.hypot(q.x - p.x, q.y - p.y) / (tool === "lift" ? g.travelSpeed : g.drawSpeed);
    const from = last || homePose(g);
    if (!a.out_of_reach) move = Math.max(move, 1.2 * Math.max(Math.abs(a.base - from.base), Math.abs(a.elbow - from.elbow)) / g.servo.speed);
    tTilt[i] = prev; tGo[i] = prev + dwell; tCmd[i] = tGo[i] + move;
    if (tilt != null) lastTilt = tilt;
    if (!a.out_of_reach) last = a;
  }
  return { toolpath, path: angles.path, cmd: compensate(angles.path, g), tCmd, tGo, tTilt, n, total: n ? tCmd[n - 1] + 0.3 : 0 };
}

// What to command so the link lands where the plan wants it. A hobby servo stops half its dead band short of a
// command, and gear play leaves the link half the play behind the motor, both on the side it came from; so
// each base and elbow command is pushed that far ahead in the direction the joint is moving, and the push
// flips when the joint reverses. Off when the config says so, or with nothing to make up.
export function compensate(path, g) {
  const s = g.servo || {}, on = s.compensate !== false;
  const out = path.map((a) => ({ ...a }));
  if (!on) return out;
  for (const k of ["base", "elbow"]) {
    const ratio = +(s[k]?.ratio) || 1, push = ((+s.resolution || 0) / 2 + (+s.backlash || 0) / 2) / ratio;
    if (!push) continue;
    let dir = 0, prev = null;
    for (let i = 0; i < out.length; i++) {
      if (out[i].out_of_reach) continue;
      const v = path[i][k];
      if (prev != null && Math.abs(v - prev) > 1e-4) dir = Math.sign(v - prev);
      out[i][k] = v + dir * push; prev = v;
    }
  }
  return out;
}

// The pose the arm parks in: pen up, beside the drawing on the elbow's side, so neither link crosses it.
export function homePose(g) {
  const x = (g.elbowUp ? 1 : -1) * Math.min(g.half + 25, g.boardW / 2 - 10), y = g.standoff + g.board / 2 + g.half / 2;
  const s = ik(x, y, g.L1, g.L2, g.elbowUp) || ik(0, g.standoff + g.board / 2, g.L1, g.L2, g.elbowUp) || { t1: Math.PI / 2, t2: 0 };
  return { base: s.t1 * R2D, elbow: s.t2 * R2D, tilt: g.tilt.lift };
}

function homeTip(g) { const h = homePose(g), f = fk(h.base * D2R, h.elbow * D2R, g.L1, g.L2); return { x: f.px, y: f.py }; }

// How a servo turns a command into a position (physics on):
//   deadband  it only moves when the command is more than half its dead band away, and stops at the edge of it,
//             so it trails a moving command by half the band and kinks where the joint reverses (a real hobby servo)
//   steps     every command rounded to whole steps first (a firmware sending whole degrees, or a stepper)
// backlash (deg) is play in the gears between the motor and the link. The command is interpolated between
// waypoints the way the Arduino firmware does it, unless smooth is false.
export class Sim {
  constructor(g) { this.g = g; this.physics = true; this.model = "deadband"; this.smooth = true; this.job = null; this.reset(); }

  setGeom(g) { this.g = g; }

  // Back to the park pose with the clock at zero; the board's ink is the caller's to clear.
  reset() {
    this.j = homePose(this.g); this.m = { ...this.j }; this.t = 0; this.i = 0; this.ti = 0; this.manual = null;
    this.prevTip = this.tip(); this.prevMode = null;
    this.dev = { max: 0, sum: 0, n: 0 };
  }

  load(job) { this.job = job; this.t = 0; this.i = 0; this.ti = 0; this.manual = null; this.dev = { max: 0, sum: 0, n: 0 }; }

  get done() { return !this.job || this.t >= this.job.total; }

  tip() { const f = fk(this.j.base * D2R, this.j.elbow * D2R, this.g.L1, this.g.L2); return { x: f.px, y: f.py, ex: f.ex, ey: f.ey }; }

  // What touches the board: the marker near its draw pose, the eraser near its erase pose, or nothing.
  mode() {
    const { tilt } = this.j, T = this.g.tilt;
    if (Math.abs(tilt - T.draw) < NEAR) return "draw";
    if (Math.abs(tilt - T.erase) < NEAR) return "erase";
    return null;
  }

  // Jog: send the pen to a point by hand (pen up). Returns false when the point is out of reach.
  jog(x, y) {
    const s = ik(x, y, this.g.L1, this.g.L2, this.g.elbowUp); if (!s) return false;
    this.manual = { base: s.t1 * R2D, elbow: s.t2 * R2D, tilt: this.g.tilt.lift }; return true;
  }

  target() {
    if (this.manual) return this.manual;
    const job = this.job; if (!job || !job.n) return homePose(this.g);
    let k = this.i; while (k > 0 && job.path[k].out_of_reach) k--;
    let m = this.ti; while (m > 0 && job.path[m].out_of_reach) m--;
    // compensated commands are for real servos; ideal ones follow the plan itself
    const P = (this.physics && job.cmd) || job.path, a = P[k], b = P[m];
    if (a.out_of_reach) return { base: this.j.base, elbow: this.j.elbow, tilt: b.out_of_reach ? this.j.tilt : b.tilt };
    let base = a.base, elbow = a.elbow;
    // between set-off and arrival the command slides from the last waypoint to this one, as the firmware does
    const p = P[k - 1];
    if (this.smooth && k > 0 && p && !p.out_of_reach && k === this.i) {
      const span = job.tCmd[k] - job.tGo[k], u = span > 0 ? Math.max(0, Math.min(1, (this.t - job.tGo[k]) / span)) : 1;
      base = p.base + (a.base - p.base) * u; elbow = p.elbow + (a.elbow - p.elbow) * u;
    }
    return { base, elbow, tilt: b.out_of_reach ? this.j.tilt : b.tilt };
  }

  // Advance by dt seconds in small steps. onInk(from, to, mode) gets every piece of line the tip leaves.
  // hold: the job's clock stands still and only the servos move (settling while paused).
  advance(dt, onInk, hold = false) {
    const h = 1 / 240;
    for (let left = dt; left > 1e-9; left -= h) this.step(Math.min(h, left), onInk, hold);
  }

  step(dt, onInk, hold = false) {
    const job = this.job;
    if (job && !this.manual && !hold) {
      this.t = Math.min(this.t + dt, job.total);
      while (this.i < job.n - 1 && job.tGo[this.i + 1] <= this.t) this.i++;
      while (this.ti < job.n - 1 && job.tTilt[this.ti + 1] <= this.t) this.ti++;
    }
    const tg = this.target(), s = this.g.servo;
    for (const k of ["base", "elbow", "tilt"]) {
      let want = tg[k];
      if (!this.physics) { this.j[k] = this.m[k] = want; continue; }
      // a servo stops at the ends of its travel, wherever the plan wanted it
      const c = s[k], ratio = +(c?.ratio) || 1;
      if (c) { const dir = +c.dir || 1, v = Math.min(+c.max, Math.max(+c.min, +c.offset + dir * ratio * want)); want = (v - +c.offset) / (dir * ratio); }
      // a gear reduction divides the servo's dead band, speed and play by its ratio at the link
      const res = (s.resolution || 0) / ratio, lim = (s.speed / ratio) * dt, play = (+(s.backlash) || 0) / ratio;
      let d;
      if (this.model === "steps") { if (res > 0) want = Math.round(want / res) * res; d = want - this.m[k]; }
      else { const e = want - this.m[k]; d = Math.abs(e) > res / 2 ? e - Math.sign(e) * res / 2 : 0; }
      this.m[k] += Math.max(-lim, Math.min(lim, d));
      // gear play: the link only follows once the motor has taken it up
      if (play > 0) { if (this.m[k] - this.j[k] > play / 2) this.j[k] = this.m[k] - play / 2; else if (this.j[k] - this.m[k] > play / 2) this.j[k] = this.m[k] + play / 2; }
      else this.j[k] = this.m[k];
    }
    const tip = this.tip(), mode = this.mode();
    if (mode && mode === this.prevMode && onInk) onInk(this.prevTip, tip, mode);
    if (mode === "draw" && job && !this.manual && this.i > 0) this.measure(tip);
    this.prevTip = tip; this.prevMode = mode;
  }

  // How far the real tip is from the planned line it should be on: the error the camera would see.
  measure(tip) {
    const tp = this.job.toolpath, a = tp[this.i - 1], b = tp[this.i];
    if (!(b.tool === "draw" || (!b.tool && b.pen))) return;
    const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1;
    const u = Math.max(0, Math.min(1, ((tip.x - a.x) * dx + (tip.y - a.y) * dy) / L));
    const d = Math.hypot(a.x + u * dx - tip.x, a.y + u * dy - tip.y);
    this.dev.max = Math.max(this.dev.max, d); this.dev.sum += d; this.dev.n++;
  }
}
