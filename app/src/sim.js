// Live simulation of the arm: the angle stream played through the servos' limits (top speed and resolution),
// so the line on screen is the one the real arm would leave, wobble and lag included. Pure: no DOM.
import { fk, ik, ikTool, toolPoint, toAngles, R2D } from "./ik.js";

const D2R = Math.PI / 180;
const NEAR = 1.5;   // deg: how close the tilt servo must be to a pose for the marker or eraser to touch
const STEP = 2;     // mm: longer moves are split this fine, so the speed can ramp along them
const SETTLE = 0.05;   // s the arm holds after a tilt, while the marker settles

// When each waypoint is commanded. A hobby servo told to stop dead overshoots, so nothing starts or stops at once:
// the pen speeds up and slows down at `accel` (mm/s²), takes a right-angle corner at `cornerSpeed` (sharper ones
// slower, gentler ones faster) and stops before each tilt; no joint turns faster than the servo can or speeds up
// faster than `servo.accel` (deg/s²). Tilts ease in and out. The pen draws at drawSpeed and travels at
// travelSpeed. Long moves are split every STEP mm first, so the job's toolpath and path are longer than the plan's.
// tTilt[i]: the tilt for waypoint i starts; tLand[i]: it is there; tGo[i]: the arm sets off for waypoint i;
// tCmd[i]: it should have arrived.
export function makeJob(toolpath, angles, g) {
  ({ toolpath, angles } = densify(toolpath, angles, g));
  const n = toolpath.length, path = angles.path;
  const tCmd = new Float64Array(n), tGo = new Float64Array(n), tTilt = new Float64Array(n), tLand = new Float64Array(n);
  const A = +g.accel || Infinity, Aj = +g.servo.accel || Infinity, wj = g.servo.speed / 1.2;
  // move i runs from the waypoint before it (the park pose for the first) to waypoint i
  const len = new Float64Array(n), vTop = new Float64Array(n), acc = new Float64Array(n), turn = new Float64Array(n), dir = [], tilt = [];
  const home = homePose(g), start = toolPoint(home.base * D2R, home.elbow * D2R, g, firstTool(toolpath));
  let last = home, lastTilt = home.tilt;
  for (let i = 0; i < n; i++) {
    const a = path[i], p = i ? toolpath[i - 1] : start, q = toolpath[i];
    const d = Math.hypot(q.x - p.x, q.y - p.y), dj = a.out_of_reach ? 0 : Math.max(Math.abs(a.base - last.base), Math.abs(a.elbow - last.elbow));
    const v = (q.tool || (q.pen ? "draw" : "lift")) === "lift" ? g.travelSpeed : g.drawSpeed;
    len[i] = d; dir[i] = d > 1e-9 && [(q.x - p.x) / d, (q.y - p.y) / d];
    if (d > 1e-9) { const k = dj / d; vTop[i] = k ? Math.min(v, wj / k) : v; acc[i] = k ? Math.min(A, Aj / k) : A; }
    else turn[i] = dj;   // the joints turn with the pen on one spot (rare): a move of its own, from rest to rest
    tilt[i] = a.out_of_reach ? lastTilt : a.tilt;
    if (!a.out_of_reach) { last = a; lastTilt = a.tilt; }
  }
  // the speed at each waypoint: zero where the arm must be still, the corner's speed elsewhere, then no more than
  // it can reach from the speed before (forward) or shed by the speed after (backward)
  const vAt = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const still = i === n - 1 || tilt[i + 1] !== tilt[i] || path[i].out_of_reach || path[i + 1].out_of_reach || turn[i] || turn[i + 1] || !dir[i] || !dir[i + 1];
    vAt[i] = still ? 0 : Math.min(vTop[i], vTop[i + 1], cornerSpeed(dir[i], dir[i + 1], g));
  }
  for (let i = 0; i < n; i++) vAt[i] = Math.min(vAt[i], Math.sqrt((i ? vAt[i - 1] ** 2 : 0) + 2 * acc[i] * len[i]));
  for (let i = n - 2; i >= 0; i--) vAt[i] = Math.min(vAt[i], Math.sqrt(vAt[i + 1] ** 2 + 2 * acc[i + 1] * len[i + 1]));
  let before = home.tilt;
  for (let i = 0; i < n; i++) {
    const prev = i ? tCmd[i - 1] : 0, ease = tilt[i] !== before ? easeTime(Math.abs(tilt[i] - before), g) : 0;
    const move = turn[i] ? rampTime(turn[i], 0, 0, wj, Aj) : rampTime(len[i], i ? vAt[i - 1] : 0, vAt[i], vTop[i] || g.travelSpeed, acc[i] || A);
    tTilt[i] = prev; tLand[i] = prev + ease; tGo[i] = prev + (ease && ease + SETTLE); tCmd[i] = tGo[i] + move;
    before = tilt[i];
  }
  return { toolpath, path, cmd: compensate(path, g), tCmd, tGo, tTilt, tLand, n, total: n ? tCmd[n - 1] + 0.3 : 0 };
}

// Split every move longer than STEP; the joints for the new points come from the IK, so a long move is a straight
// line on the board too. The first move, from the park pose, is a pen-up travel move.
function densify(toolpath, angles, g) {
  const out = []; let split = false;
  const home = homePose(g), start = toolPoint(home.base * D2R, home.elbow * D2R, g, firstTool(toolpath));
  toolpath.forEach((q, i) => {
    const p = i ? toolpath[i - 1] : start, k = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / STEP);
    for (let s = 1; s < k; s++) out.push({ ...(i ? q : { pen: 0, tool: "lift" }), x: p.x + (q.x - p.x) * s / k, y: p.y + (q.y - p.y) * s / k });
    if (k > 1) split = true;
    out.push(q);
  });
  return split ? { toolpath: out, angles: toAngles(out, g) } : { toolpath, angles };
}
function firstTool(tp) { const q = tp.find((p) => p.tool === "erase" || p.pen); return q?.tool === "erase" ? "erase" : "draw"; }

// How fast the pen may pass from one move into the next: unlimited in a straight line, `cornerSpeed` at a right
// angle, nothing for a full reversal (the junction-deviation rule plotters and 3D printers use, scaled so a right
// angle gives cornerSpeed).
function cornerSpeed(u, w, g) {
  const s = Math.sqrt(Math.max(0, (1 + u[0] * w[0] + u[1] * w[1]) / 2));   // cos of half the turn
  return s > 0.999999 ? Infinity : (+g.cornerSpeed || 0) * Math.sqrt(s / ((1 - s) * (1 + Math.SQRT2)));
}

// Time to cover d at up to vTop, starting at v0 and ending at v1, speeding up and slowing down at a.
function rampTime(d, v0, v1, vTop, a) {
  if (d <= 1e-9) return 0;
  if (!isFinite(a)) return d / vTop;
  const vp = Math.min(vTop, Math.sqrt(a * d + (v0 * v0 + v1 * v1) / 2));
  return (vp - v0) / a + (vp - v1) / a + Math.max(0, d - (2 * vp * vp - v0 * v0 - v1 * v1) / (2 * a)) / vp;
}

// A tilt eases in and out along half a cosine: as slow as it must be for the servo's top speed and acceleration.
export function easeTime(deg, g) {
  return Math.max((Math.PI * deg) / (2 * g.servo.speed), Math.PI * Math.sqrt(deg / (2 * (+g.servo.accel || Infinity))));
}
export const ease = (u) => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, u)))) / 2;

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
  const s = ikTool(x, y, g) || ikTool(0, g.standoff + g.board / 2, g) || { t1: Math.PI / 2, t2: 0 };
  return { base: s.t1 * R2D, elbow: s.t2 * R2D, tilt: g.tilt.lift };
}

function homeTip(g) { const h = homePose(g); return toolPoint(h.base * D2R, h.elbow * D2R, g); }

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

  // where an end of the pen is now: the nib, or the eraser's felt
  tip(tool = "draw") { return toolPoint(this.j.base * D2R, this.j.elbow * D2R, this.g, tool); }

  // What touches the board: the marker near its draw pose, the eraser near its erase pose, or nothing.
  mode() {
    const { tilt } = this.j, T = this.g.tilt;
    if (Math.abs(tilt - T.draw) < NEAR) return "draw";
    if (Math.abs(tilt - T.erase) < NEAR) return "erase";
    return null;
  }

  // Jog: send the pen to a point by hand (pen up). Returns false when the point is out of reach.
  jog(x, y) {
    const s = ikTool(x, y, this.g); if (!s) return false;
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
    let base = a.base, elbow = a.elbow, tilt = b.out_of_reach ? this.j.tilt : b.tilt;
    if (this.smooth && job.tLand && !b.out_of_reach && this.t < job.tLand[m]) {
      let q = m - 1; while (q > 0 && P[q].out_of_reach) q--;
      const from = q >= 0 && !P[q].out_of_reach ? P[q].tilt : homePose(this.g).tilt, T0 = job.tTilt[m], T1 = job.tLand[m];
      tilt = from + (b.tilt - from) * ease((this.t - T0) / (T1 - T0));
    }
    // between set-off and arrival the command slides from the last waypoint to this one, as the firmware does
    const p = k > 0 ? P[k - 1] : homePose(this.g);   // the first move starts from the park pose
    if (this.smooth && p && !p.out_of_reach && k === this.i) {
      const span = job.tCmd[k] - job.tGo[k], u = span > 0 ? Math.max(0, Math.min(1, (this.t - job.tGo[k]) / span)) : 1;
      base = p.base + (a.base - p.base) * u; elbow = p.elbow + (a.elbow - p.elbow) * u;
    }
    return { base, elbow, tilt };
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
    const mode = this.mode(), tip = this.tip(mode === "erase" ? "erase" : "draw");
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
