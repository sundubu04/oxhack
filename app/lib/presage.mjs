// Presage SmartSpectra (the MLH sponsor's SDK): the Mac's camera as a sensor. The SDK opens the camera and runs its
// models on this machine (the key is checked with Presage) and reports facial expressions; this keeps the latest one
// for the app's Emotion mode, folded into the five moods the arm can draw. The SDK runs in a child process
// (presage-worker.mjs), so a crash in its native code can't take the server or the arm down. Needs PRESAGE_API_KEY
// in app/.env. Only one thing should use the camera while it runs: another opening it can change the frame size
// under the SDK, which aborts it.
import { fork } from "node:child_process";

let child = null, stopping = false;
const st = { on: false, status: "off", face: false, hint: null, error: null, mood: null, scores: [], stable: false, at: 0 };

// Presage's eight expressions -> the five moods: fear reads as surprise, disgust and contempt as anger
const EXPRESSIONS = { 1: "angry", 2: "contempt", 3: "disgust", 4: "fear", 5: "happy", 6: "neutral", 7: "sad", 8: "surprise" };
const MOOD = { angry: "angry", contempt: "angry", disgust: "angry", fear: "surprised", surprise: "surprised", happy: "happy", sad: "sad", neutral: "neutral" };
const STATUS = ["uninitialized", "idle", "starting", "running", "stopping", "error"];
const HINTS = { 1: "No face found", 2: "More than one face", 3: "Centre your face", 4: "Move a little closer or further", 5: "Too dark", 6: "Too bright",
  10: "Camera adjusting", 11: "Camera too slow", 12: "Hold still", 13: "Move back a little", 14: "Move closer", 15: "Move down a little", 16: "Move up a little", 17: "Face the camera" };

export function status(key) { return { ...st, ready: !!key, age: st.at ? Date.now() - st.at : null }; }

function heard(m) {
  if (m.kind === "status") st.status = STATUS[m.s] || String(m.s);
  else if (m.kind === "validation") { st.face = m.code === 0; st.hint = m.code === 0 ? null : HINTS[m.code] || m.hint || "Adjusting"; }
  else if (m.kind === "error") st.error = m.message;
  else if (m.kind === "expression") {
    // the eight scores, folded into moods (a mood's score is its best expression's)
    const best = {};
    for (const [type, confidence] of m.scores) { const mood = MOOD[EXPRESSIONS[type]]; if (mood) best[mood] = Math.max(best[mood] || 0, confidence); }
    st.scores = Object.entries(best).map(([mood, confidence]) => ({ mood, confidence: Math.round(confidence) })).sort((a, b) => b.confidence - a.confidence);
    st.mood = st.scores[0]?.mood || null; st.stable = m.stable; st.at = Date.now();
  }
}

export async function start(key) {
  if (!key) throw new Error("Presage needs its key: add PRESAGE_API_KEY to app/.env and restart the server");
  if (child) return status(key);
  Object.assign(st, { on: true, status: "starting", face: false, hint: null, error: null, mood: null, scores: [], stable: false, at: 0 });
  stopping = false;
  const last = [];   // its last words on stderr: what to say if it dies
  child = fork(new URL("./presage-worker.mjs", import.meta.url), { env: { ...process.env, PRESAGE_API_KEY: key }, stdio: ["ignore", "ignore", "pipe", "ipc"] });
  child.stderr.on("data", (b) => { for (const l of b.toString().split("\n")) if (l.trim() && !/feedback_manager|avfoundation|absl::|model path|NORM_RECT/.test(l)) { last.push(l.trim()); if (last.length > 5) last.shift(); } });
  child.on("message", heard);
  child.on("exit", (code, signal) => {
    child = null; Object.assign(st, { on: false, status: "off", face: false });
    if (!stopping) st.error = `The camera reader stopped${signal ? ` (${signal})` : code ? ` (${code})` : ""}${last.length ? `: ${last.at(-1).replace(/^.*error: /, "").slice(0, 160)}` : ""}. Start it again.`;
  });
  return status(key);
}

export async function stop() {
  const c = child; stopping = true;
  if (c) {
    c.send("stop");
    await new Promise((done) => { const t = setTimeout(() => { try { c.kill("SIGKILL"); } catch (e) {} done(); }, 4000); c.once("exit", () => { clearTimeout(t); done(); }); });
  }
  Object.assign(st, { on: false, status: "off", face: false, hint: null });
  return status(true);
}
process.on("exit", () => { try { child?.kill(); } catch (e) {} });
