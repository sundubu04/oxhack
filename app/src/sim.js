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
  return { toolpath, path: angles.path, tCmd, tGo, tTilt, n, total: n ? tCmd[n - 1] + 0.3 : 0 };
}

// The pose the arm parks in: pen up, beside the drawing on the elbow's side, so neither link crosses it.
export function homePose(g) {
  const x = (g.elbowUp ? 1 : -1) * Math.min(g.half + 25, g.boardW / 2 - 10), y = g.standoff + g.board / 2 + g.half / 2;
  const s = ik(x, y, g.L1, g.L2, g.elbowUp) || ik(0, g.standoff + g.board / 2, g.L1, g.L2, g.elbowUp) || { t1: Math.PI / 2, t2: 0 };
  return { base: s.t1 * R2D, elbow: s.t2 * R2D, tilt: g.tilt.lift };
}

function homeTip(g) { const h = homePose(g), f = fk(h.base * D2R, h.elbow * D2R, g.L1, g.L2); return { x: f.px, y: f.py }; }

export class Sim {
  constructor(g) { this.g = g; this.physics = true; this.job = null; this.reset(); }

  setGeom(g) { this.g = g; }

  // Back to the park pose with the clock at zero; the board's ink is the caller's to clear.
  reset() {
    this.j = homePose(this.g); this.t = 0; this.i = 0; this.ti = 0; this.manual = null;
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
    const a = job.path[k], b = job.path[m];
    return { base: a.out_of_reach ? this.j.base : a.base, elbow: a.out_of_reach ? this.j.elbow : a.elbow, tilt: b.out_of_reach ? this.j.tilt : b.tilt };
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
      if (this.physics) {
        // a servo stops at the ends of its travel, wherever the plan wanted it
        const c = s[k];
        if (c) { const dir = +c.dir || 1, v = Math.min(+c.max, Math.max(+c.min, +c.offset + dir * want)); want = (v - +c.offset) / dir; }
        const res = s.resolution || 0;
        if (res > 0) want = Math.round(want / res) * res;
        const lim = s.speed * dt, d = want - this.j[k];
        this.j[k] += Math.max(-lim, Math.min(lim, d));
      } else this.j[k] = want;
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
