// Talk to the arm over USB (Web Serial, Chrome on localhost). The Arduino firmware in firmware/clockwork speaks
// protocol 2: the app streams timed keyframes ahead of time and the board moves the servos between them on its
// own 20 ms frame, so browser timing never reaches the line. A board that doesn't answer the handshake gets
// protocol 1: one "base,elbow,tilt,pressure" line per waypoint, paced by the app.
import { servoAngle } from "./config.js";

let port = null, writer = null, protocol = 0, slots = 0;
const listeners = new Set();
const enc = new TextEncoder();

export function supported() { return "serial" in navigator; }
export function connected() { return !!writer; }
export function version() { return protocol; }
export function onLine(fn) { listeners.add(fn); return () => listeners.delete(fn); }

const write = (s) => writer.write(enc.encode(s + "\n"));

// Wait for the first line that matches, or give up after ms.
function expect(test, ms) {
  return new Promise((resolve) => {
    const off = onLine((l) => { if (test(l)) { off(); clearTimeout(timer); resolve(l); } });
    const timer = setTimeout(() => { off(); resolve(null); }, ms);
  });
}

async function readLines() {
  const reader = port.readable.pipeThrough(new TextDecoderStream()).getReader();
  let rest = "";
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      rest += value; const lines = rest.split(/\r?\n/); rest = lines.pop();
      for (const l of lines) if (l.trim()) listeners.forEach((fn) => fn(l.trim()));
    }
  } catch (e) {} finally { reader.releaseLock(); }
}

export async function connect(baud = 115200) {
  if (!supported()) throw new Error("Connecting needs Chrome on localhost (Web Serial)");
  port = await navigator.serial.requestPort();
  await port.open({ baudRate: baud });
  writer = port.writable.getWriter();
  readLines();
  // an Uno resets when the port opens; give it time to boot before the handshake
  await new Promise((r) => setTimeout(r, 1800));
  await write("?");
  const hello = await expect((l) => l.startsWith("CLOCKWORK"), 1500);
  protocol = hello ? Number(hello.split(" ")[1]) || 2 : 1;
  slots = hello ? Number(hello.split(" ")[2]) || 48 : 0;
  return protocol;
}

export async function disconnect() {
  try { writer && writer.releaseLock(); await port?.close(); } catch (e) {}
  port = writer = null; protocol = 0;
}

// Keyframes for protocol 2, from the sim's schedule: the arm holds still while the tilt changes, then moves to
// each waypoint by the time it should arrive. Angles go out in the servo's own frame, after calibration.
export function keyframes(job, g) {
  const cd = (j, a) => Math.round(Math.max(0, Math.min(180, servoAngle(j, a, g))) * 100);
  const out = []; let prev = null, lastTilt = null;
  for (let i = 0; i < job.n; i++) {
    const a = job.path[i]; if (a.out_of_reach) continue;
    const s = [cd("base", a.base), cd("elbow", a.elbow), cd("tilt", a.tilt)];
    if (prev && a.tilt !== lastTilt) {
      out.push({ t: job.tTilt[i], a: [prev[0], prev[1], s[2]] });
      out.push({ t: job.tGo[i], a: [prev[0], prev[1], s[2]] });
    }
    out.push({ t: job.tCmd[i], a: s });
    prev = s; lastTilt = a.tilt;
  }
  return out.map((k) => ({ t: Math.round(k.t * 1000), a: k.a }));
}

// Send a job. Protocol 2: prime the board's buffer, start its clock, keep it topped up as it frees slots.
// onProgress(fraction) as keyframes go out (2) or waypoints (1). signal aborts and stops the arm.
export async function send(job, g, { onProgress, signal } = {}) {
  if (!writer) throw new Error("Arm not connected");
  if (protocol >= 2) {
    const keys = keyframes(job, g);
    // free: slots the board last reported, less the K lines it hasn't answered yet (a safe undercount)
    let free = slots, inflight = 0, started = false, i = 0;
    const off = onLine((l) => {
      if (l.startsWith("F ")) { inflight = Math.max(0, inflight - 1); free = Number(l.slice(2)) - inflight; }
      else if (l.startsWith("T ")) free = Number(l.split(" ")[2]) - inflight;
    });
    try {
      while (i < keys.length) {
        if (signal?.aborted) { await write("S"); return; }
        if (free <= 0) { await new Promise((r) => setTimeout(r, 10)); continue; }
        const k = keys[i++]; free--; inflight++;
        await write(`K ${k.t} ${k.a[0]} ${k.a[1]} ${k.a[2]}`);
        // start once a quarter of the buffer is full: enough lead for USB hiccups, little wait
        if (!started && (i >= slots / 4 || i === keys.length)) { await write("G"); started = true; }
        onProgress && onProgress(i / keys.length);
      }
      await write("E");
      const done = expect((l) => l === "DONE" || l === "STOPPED", (keys.at(-1)?.t || 0) + 10000);
      const stop = new Promise((r) => signal?.addEventListener("abort", () => { write("S"); r(); }, { once: true }));
      await Promise.race([done, stop]);
    } finally { off(); }
    return;
  }
  // protocol 1: one line per waypoint, sent when the arm should set off for it
  const t0 = performance.now();
  for (let i = 0; i < job.n; i++) {
    if (signal?.aborted) break;
    const wait = job.tTilt[i] * 1000 - (performance.now() - t0); if (wait > 2) await new Promise((r) => setTimeout(r, wait));
    const p = job.path[i];
    await write(p.out_of_reach ? "SKIP" : `${p.base},${p.elbow},${p.tilt},${p.pressure}`);
    onProgress && onProgress((i + 1) / job.n);
  }
  await write("HOME");
}

// Move the real arm now (protocol 2 only), e.g. while dragging the pen on the board. Called often; sends at
// most one line per servo frame.
let lastJog = 0;
export function jog(j, g) {
  if (!writer || protocol < 2) return;
  const now = performance.now(); if (now - lastJog < 20) return; lastJog = now;
  const cd = (k, a) => Math.round(Math.max(0, Math.min(180, servoAngle(k, a, g))) * 100);
  write(`J ${cd("base", j.base)} ${cd("elbow", j.elbow)} ${cd("tilt", j.tilt)}`);
}

export function download(streamObj, name = "clockwork-angles.json") {
  const blob = new Blob([JSON.stringify(streamObj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
