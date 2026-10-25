// Talk to the arm through the dev server, which holds its USB port (lib/arm.mjs): any browser works, and curl or a
// script can drive the same arm. The board runs firmware/clockedin. A job goes out as keyframes the board plays
// on its own 20 ms clock, so browser and network timing never reach the line; live moves (servo degrees, a board
// point) go out as the newest target, no more often than the server's interval, and the board glides to each.
import { servoAngle } from "./config.js";
import { ease, homePose } from "./sim.js";

let last = null;   // the server's last word on the arm
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, body) {
  const r = await fetch(`./api/arm${path}`, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const s = await r.json().catch(() => ({ error: `The server answered ${r.status}` }));
  if ("open" in s) last = s;
  if (!r.ok) throw new Error(s.error || `The server answered ${r.status}`);
  return s;
}

export function supported() { return true; }
export function state() { return last; }
export function connected() { return !!last?.firmware; }
export function version() { return last?.firmware?.protocol || 0; }
export const refresh = () => call("");
export async function connect(port) {
  const s = await call("/connect", port ? { port } : {});
  if (!s.firmware) throw new Error(s.error || "The board didn't answer");
  return s;
}
export const disconnect = () => call("/disconnect", {});
export const park = () => call("/park", {});
export const stop = () => call("/stop", {});
export const tune = (settings) => call("/tune", settings);

// Live moves: one request in flight at a time, and only the newest waiting, so a fast hand never queues a backlog.
let busy = false, next = null;
function live(path, body) {
  next = { path, body };
  if (busy) return;
  (async () => {
    busy = true;
    try { while (next) { const n = next; next = null; await call(n.path, n.body).catch(() => {}); } }
    finally { busy = false; }
  })();
}
export function servos(base, elbow, pen) { if (connected()) live("/servos", { base, elbow, pen }); }
// pens: the pen servo's angles to use ({ draw, lift, erase }), when they differ from the saved config
export function point(x, y, tool = "draw", start = false, pens) { if (connected()) live("/point", { x, y, tool, start, pen: pens?.[tool], lift: pens?.lift }); }
// the same, waited for, so a refusal (the arm is drawing, out of reach) comes back as an error
export const pointNow = (x, y, tool = "draw", start = false, pens) => call("/point", { x, y, tool, start, pen: pens?.[tool], lift: pens?.lift });
// joint angles (as the app counts them) -> servo degrees through the calibration
export function jog(j, g) { if (connected()) servos(...["base", "elbow", "tilt"].map((k) => Math.max(0, Math.min(180, servoAngle(k, j[k], g))))); }

// Keyframes for the board, from the sim's schedule: the job starts from the park pose, the arm holds still while
// the tilt changes, then moves to each waypoint by the time it should arrive. Angles go out in the servo's own
// frame, after calibration, in centi-degrees; t in ms.
export function keyframes(job, g) {
  const cd = (j, a) => Math.round(Math.max(0, Math.min(180, servoAngle(j, a, g))) * 100);
  const h = homePose(g);
  let prev = [cd("base", h.base), cd("elbow", h.elbow), cd("tilt", h.tilt)], lastTilt = h.tilt;
  const out = [{ t: 0, a: prev }];
  for (let i = 0; i < job.n; i++) {
    const a = (job.cmd || job.path)[i]; if (a.out_of_reach) continue;
    const s = [cd("base", a.base), cd("elbow", a.elbow), cd("tilt", a.tilt)];
    if (prev && a.tilt !== lastTilt) {
      // the tilt eases in and out (a step would overshoot), in steps of about 5 deg, then holds while it settles
      const T0 = job.tTilt[i], T1 = job.tLand?.[i] ?? T0, k = Math.max(4, Math.ceil(Math.abs(a.tilt - lastTilt) / 5));
      for (let m = 1; m <= k; m++) out.push({ t: T0 + (T1 - T0) * m / k, a: [prev[0], prev[1], cd("tilt", lastTilt + (a.tilt - lastTilt) * ease(m / k))] });
      out.push({ t: job.tGo[i], a: [prev[0], prev[1], s[2]] });
    }
    out.push({ t: job.tCmd[i], a: s });
    prev = s; lastTilt = a.tilt;
  }
  return out.map((k) => ({ t: Math.round(k.t * 1000), a: k.a }));
}

// Drop the keyframes the board would rebuild anyway (it moves in straight lines between them): from each one kept,
// reach as far ahead as every keyframe in between stays within tol centi-degrees of the line and the pen doesn't
// change. A third to a half as many lines down the USB cable, for 0.15 deg.
export function thin(keys, tol = 15) {
  const fits = (a, b) => {
    for (let i = a + 1; i < b; i++) {
      const k = keys[i], u = (k.t - keys[a].t) / (keys[b].t - keys[a].t || 1);
      if (k.a[2] !== keys[a].a[2] || k.a.some((v, j) => Math.abs(keys[a].a[j] + (keys[b].a[j] - keys[a].a[j]) * u - v) > tol)) return false;
    }
    return keys[a].a[2] === keys[b].a[2] || b === a + 1;
  };
  const kept = [keys[0]];
  for (let a = 0; a < keys.length - 1;) { let b = a + 1; while (b + 1 < keys.length && fits(a, b + 1)) b++; kept.push(keys[b]); a = b; }
  return kept;
}

// Run a job on the arm and follow it to the end. onProgress(fraction of its time); signal stops the arm, which
// eases to a halt along its path.
export async function send(job, g, { onProgress, signal } = {}) {
  if (!connected()) throw new Error("Arm not connected");
  await call("/run", { keys: thin(keyframes(job, g)) });
  const halt = () => call("/stop", {}).catch(() => {});
  signal?.addEventListener("abort", halt, { once: true });
  try {
    for (;;) {
      await sleep(200);
      const j = (await call("")).job;
      if (!j) return;
      onProgress && onProgress(Math.min(1, j.t / (j.ms || 1)));
      if (j.state !== "running") { if (j.state === "failed") throw new Error("The arm stopped: the USB link dropped"); return; }
    }
  } finally { signal?.removeEventListener("abort", halt); }
}

export function download(streamObj, name = "clockedin-angles.json") {
  const blob = new Blob([JSON.stringify(streamObj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Strokes in board mm, drawn by the server in the shortest order, solved and timed like any job.
export const draw = (strokes) => call("/draw", { strokes });
