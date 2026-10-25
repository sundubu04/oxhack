// The arm over USB, held by the server: one serial port kept open, the Clockedin firmware's protocol
// (firmware/clockedin), and three ways to move it:
//   servos(b, e, p)   servo degrees, 0 to 180 (calibration)
//   point(x, y, pen)  a board point in mm; the IK picks the servo degrees (live drawing)
//   run(keys)         a planned job's keyframes, streamed ahead of the board's own clock (drawings)
// Live moves never go straight to the servos: the newest target wins, at most one is sent every `interval` ms,
// and the board glides to it at `speed` and `accel`, so a hand that jerks or a burst of requests can't make the
// motors jump. No packages: the port is opened by the shell (stty for the baud rate, cat each way).
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";

const NAMES = /^(cu\.usbmodem|cu\.usbserial|cu\.wchusbserial|ttyACM|ttyUSB)/;
export function ports() { try { return readdirSync("/dev").filter((n) => NAMES.test(n)).sort().map((n) => `/dev/${n}`); } catch (e) { return []; } }

const st = {
  port: null, open: false, firmware: null, other: null, error: null,
  settings: { interval: 40, minStep: 0.2, speed: 120, accel: 1500 },   // ms, deg, deg/s, deg/s²
  sent: null,                                                          // the last servo degrees sent
  job: null,                                                           // { keys, sent, t, ms, state }
  log: [],                                                             // the last lines, each way
};
let child = null, rest = "", slots = 48, free = 0;
const listeners = new Set();

function note(dir, line) { st.log.push(`${dir} ${line}`); if (st.log.length > 40) st.log.shift(); }
function write(line) { if (!child) throw new Error("The arm is not connected"); note(">", line); child.stdin.write(line + "\n"); }
function onLine(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function expect(test, ms) {
  return new Promise((resolve) => {
    const off = onLine((l) => { if (test(l)) { off(); clearTimeout(t); resolve(l); } });
    const t = setTimeout(() => { off(); resolve(null); }, ms);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function status() { return { ...st, ports: ports(), log: st.log.slice(-20) }; }

export async function connect(port = ports()[0]) {
  if (!port) throw new Error("No Arduino found: plug it in over USB");
  await disconnect();
  Object.assign(st, { port, open: false, firmware: null, other: null, error: null, job: null, sent: null });
  // its own process group, so disconnect can stop both cats; 3<> keeps the port open while stty sets it
  child = spawn("sh", ["-c", 'exec 3<>"$1" || exit 2; stty 115200 raw -echo clocal -crtscts -hupcl <&3 || exit 3; cat <&3 & exec cat >&3', "sh", port], { detached: true, stdio: ["pipe", "pipe", "pipe"] });
  child.stdout.on("data", (b) => {
    rest += b.toString("latin1"); const lines = rest.split(/\r?\n/); rest = lines.pop();
    for (const l of lines.map((s) => s.trim()).filter(Boolean)) { note("<", l); listeners.forEach((fn) => fn(l)); }
  });
  child.stderr.on("data", (b) => { st.error = b.toString().trim(); });
  // the cable pulled or the port taken away: say so, so nothing looks connected that isn't
  const mine = child;
  child.on("exit", (code) => { if (child !== mine) return; st.error ||= `The USB link closed${code ? ` (${code})` : ""}: connect again`; child = null; st.open = false; st.firmware = null; if (st.job?.state === "running") st.job.state = "failed"; });
  st.open = true;
  // the board resets when the port opens, and a Mega's bootloader can hang on to bytes that arrive while it starts:
  // wait 2 s, then ask until it answers, for up to 4 s more
  await sleep(2000);
  let hello = null;
  for (let i = 0; i < 10 && !hello && child; i++) { write("?"); hello = await expect((l) => l.startsWith("CLOCKEDIN"), 400); }
  if (!hello) {
    st.other = st.log.filter((l) => l.startsWith("<")).at(-1)?.slice(2) || null;
    st.error = st.other ? "The board answers, but not as the Clockedin firmware: upload firmware/clockedin" : st.error || "The board didn't answer";
    return status();
  }
  const [, v, n] = hello.split(" "); st.firmware = { protocol: +v || 2, slots: +n || 48 }; slots = st.firmware.slots;
  if (st.firmware.protocol >= 3) {
    await tune({});
    // live moves that leave a servo out keep it where it is, so start from where the board says they are
    write("W"); const pos = await expect((l) => l.startsWith("POS "), 500);
    if (pos) st.sent = pos.split(" ").slice(1, 4).map((v) => +v / 100);
  }
  return status();
}

export async function disconnect() {
  if (!child) return status();
  try { process.kill(-child.pid, "SIGTERM"); } catch (e) { try { child.kill(); } catch (e2) {} }
  child = null; st.open = false; st.firmware = null;
  await sleep(100);
  return status();
}
process.on("exit", () => { if (child) try { process.kill(-child.pid, "SIGTERM"); } catch (e) {} });

const ready = () => { if (!child || !st.firmware) throw new Error(st.error || "The arm is not connected"); if (st.job?.state === "running") throw new Error("The arm is drawing: stop it first"); };

// Live settings: how often a live move goes out, the smallest change worth sending, and the board's glides.
export async function tune({ interval, minStep, speed, accel }) {
  const s = st.settings, num = (v, lo, hi, d) => (Number.isFinite(+v) && v !== null && v !== "" ? Math.min(hi, Math.max(lo, +v)) : d);
  s.interval = num(interval, 10, 1000, s.interval); s.minStep = num(minStep, 0, 5, s.minStep);
  s.speed = num(speed, 5, 600, s.speed); s.accel = num(accel, 50, 20000, s.accel);
  if (child && st.firmware?.protocol >= 3) { write(`A ${Math.round(s.accel)} ${Math.round(s.speed)}`); await expect((l) => l.startsWith("A "), 500); }
  return status();
}

// The newest target waits here; a timer sends it no sooner than `interval` after the last one.
let pending = null, lastSent = 0, timer = null;
function flush() {
  timer = null; if (!pending || !child) return;
  const wait = st.settings.interval - (Date.now() - lastSent);
  if (wait > 0) { timer = setTimeout(flush, wait); return; }
  const a = pending; pending = null;
  const prev = st.sent, step = prev ? Math.max(...a.map((v, j) => Math.abs(v - prev[j]))) : Infinity;
  if (step < st.settings.minStep) return;
  write(`J ${a.map((v) => Math.round(v * 100)).join(" ")}`); st.sent = a; lastSent = Date.now();
}
function aim(a) { pending = a.map((v) => Math.min(180, Math.max(0, +v))); if (!timer) flush(); }

// servo degrees; any of the three left out stays where it was
export function servos({ base, elbow, pen }) {
  ready();
  const was = pending || st.sent;
  if (!was && [base, elbow, pen].some((v) => v == null)) throw new Error("Send all three the first time: base, elbow and pen");
  aim([base ?? was[0], elbow ?? was[1], pen ?? was[2]].map(Number));
  return status();
}

// A board point for the nib (or the eraser). The first point of a stroke (start) lifts the pen where it is,
// travels there lifted and only then puts it down, waiting for each glide to arrive (the board's AT), so a stroke
// never begins with a line dragged across the board. Points while a stroke goes on just move the target.
export async function point(x, y, tool, g, sv, start = false) {
  ready();
  const a = sv(x, y, tool);
  if (!a) throw new Error(`(${Math.round(x)}, ${Math.round(y)}) is out of the arm's reach`);
  if (start && tool !== "lift") {
    pending = null; clearTimeout(timer); timer = null;
    const was = st.sent || a.servo;
    if (Math.abs(was[2] - a.lift) > 0.5) await glide([was[0], was[1], a.lift]);
    if (Math.max(Math.abs(was[0] - a.servo[0]), Math.abs(was[1] - a.servo[1])) > 0.5) await glide([a.servo[0], a.servo[1], a.lift]);
  }
  aim(a.servo);
  return status();
}
async function glide(a) {
  write(`J ${a.map((v) => Math.round(v * 100)).join(" ")}`); st.sent = a; lastSent = Date.now();
  if (st.firmware.protocol >= 3) await expect((l) => l === "AT", 4000); else await sleep(800);
}

export function park() { ready(); pending = null; write("P"); st.sent = null; return status(); }
// Home as the config has it (servo degrees: base, elbow, pen at rest): lift the pen where it is, then glide there.
export async function home(a) {
  ready(); pending = null; clearTimeout(timer); timer = null;
  const was = st.sent;
  if (!was || st.firmware.protocol < 3) { write("P"); st.sent = null; return status(); }   // where it is isn't known: the board's own park
  if (Math.abs(was[2] - a[2]) > 0.5) await glide([was[0], was[1], a[2]]);
  await glide(a);
  return status();
}

// Stop: a job eases to a halt along its path, a glide stops where it can; then, given the rest angle (servo
// degrees), the pen lifts where the arm has stopped, so nothing is left pressing on the board.
export async function stop(lift) {
  pending = null; clearTimeout(timer); timer = null;
  if (!child) return status();
  const running = st.job?.state === "running";
  write("S"); await expect((l) => l === "STOPPED", running ? 3000 : 600);
  if (Number.isFinite(lift) && st.firmware?.protocol >= 3) {
    write("W"); const pos = await expect((l) => l.startsWith("POS "), 600);
    if (pos) { const a = pos.split(" ").slice(1, 4).map((v) => +v / 100); a[2] = lift; write(`J ${a.map((v) => Math.round(v * 100)).join(" ")}`); st.sent = a; lastSent = Date.now(); }
  }
  return status();
}

// A job's keyframes [{ t ms, a: [b, e, w] centi-degrees }], streamed as the board frees slots.
export async function run(keys) {
  ready();
  if (!Array.isArray(keys) || keys.length < 2) throw new Error("Nothing to draw");
  const job = st.job = { keys: keys.length, sent: 0, t: 0, ms: keys.at(-1).t, state: "running" };
  free = slots; let inflight = 0, started = false;
  const off = onLine((l) => {
    if (l.startsWith("F ")) { inflight = Math.max(0, inflight - 1); free = Number(l.slice(2)) - inflight; }
    else if (l.startsWith("T ")) { const [, t, f] = l.split(" "); job.t = +t; free = +f - inflight; }
    else if (l === "DONE") job.state = "done";
    else if (l === "STOPPED") job.state = "stopped";
  });
  (async () => {
    try {
      for (const k of keys) {
        while (free <= 0 && job.state === "running" && child) await sleep(10);
        if (job.state !== "running" || !child) return;
        free--; inflight++; write(`K ${Math.round(k.t)} ${k.a.map(Math.round).join(" ")}`); job.sent++;
        // start once a quarter of the buffer is full: enough lead for USB hiccups, little wait
        if (!started && (job.sent >= slots / 4 || job.sent === keys.length)) { write("G"); started = true; }
      }
      write("E");
      while (job.state === "running" && child) await sleep(50);
    } catch (e) { job.state = "failed"; st.error = e.message; }
    finally { off(); if (job.state === "running") job.state = "stopped"; }
  })();
  return status();
}
