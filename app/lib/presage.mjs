// Presage SmartSpectra (the MLH sponsor's SDK): the Mac's camera as a sensor. The SDK opens the camera and runs its
// models on this machine (the key is checked with Presage) and reports facial expressions; this keeps the latest one
// for the app's Mood mode, folded into the five moods the arm can draw. Needs PRESAGE_API_KEY in app/.env. The SDK
// is loaded only when the camera starts, so the server runs without it.
let sdk = null, mod = null;
const st = { on: false, status: "off", face: false, hint: null, error: null, mood: null, scores: [], stable: false, at: 0 };

// Presage's eight expressions -> the five moods: fear reads as surprise, disgust and contempt as anger
const EXPRESSIONS = { 1: "angry", 2: "contempt", 3: "disgust", 4: "fear", 5: "happy", 6: "neutral", 7: "sad", 8: "surprise" };
const MOOD = { angry: "angry", contempt: "angry", disgust: "angry", fear: "surprised", surprise: "surprised", happy: "happy", sad: "sad", neutral: "neutral" };
const STATUS = ["uninitialized", "idle", "starting", "running", "stopping", "error"];
const HINTS = { 1: "No face found", 2: "More than one face", 3: "Centre your face", 4: "Move a little closer or further", 5: "Too dark", 6: "Too bright",
  10: "Camera adjusting", 11: "Camera too slow", 12: "Hold still", 13: "Move back a little", 14: "Move closer", 15: "Move down a little", 16: "Move up a little", 17: "Face the camera" };

export function status(key) { return { ...st, ready: !!key, age: st.at ? Date.now() - st.at : null }; }

export async function start(key) {
  if (!key) throw new Error("Presage needs its key: add PRESAGE_API_KEY to app/.env and restart the server");
  if (sdk) return status(key);
  mod ??= await import("@smartspectra/node-sdk");
  const { SmartSpectraSDK, CameraSelection, faceMetrics, decodeMetrics } = mod;
  Object.assign(st, { on: true, status: "starting", face: false, hint: null, error: null, mood: null, scores: [], stable: false, at: 0 });
  sdk = new SmartSpectraSDK({ apiKey: key, requestedMetrics: [...faceMetrics], enableTelemetry: false });
  sdk.on("processingStatus", (s) => { st.status = STATUS[s] || String(s); });
  sdk.on("validationStatus", (code, _ts, hint) => { st.face = code === 0; st.hint = code === 0 ? null : HINTS[code] || hint || "Adjusting"; });
  sdk.on("error", (_code, message) => { st.error = message; });
  sdk.on("metrics", (buf) => {
    const m = decodeMetrics(buf); if (!m || Buffer.isBuffer(m)) return;
    const e = m.face?.expression?.at(-1); if (!e?.scores?.length) return;
    // the eight scores, folded into moods (a mood's score is its best expression's)
    const best = {};
    for (const s of e.scores) {
      const name = EXPRESSIONS[s.type] || String(s.type).toLowerCase(), mood = MOOD[name]; if (!mood) continue;
      best[mood] = Math.max(best[mood] || 0, +s.confidence || 0);
    }
    st.scores = Object.entries(best).map(([mood, confidence]) => ({ mood, confidence: Math.round(confidence) })).sort((a, b) => b.confidence - a.confidence);
    st.mood = st.scores[0]?.mood || null; st.stable = !!e.stable; st.at = Date.now();
  });
  try { sdk.useCamera(CameraSelection.default); sdk.start(); }
  catch (e) { const msg = e.message; await stop(); st.error = msg; throw new Error(msg); }
  return status(key);
}

export async function stop() {
  const s = sdk; sdk = null;
  if (s) { try { await s.stopAsync(); } catch (e) {} try { await s.destroy(); } catch (e) {} }
  Object.assign(st, { on: false, status: "off", face: false, hint: null });
  return status(true);
}
process.on("exit", () => { try { sdk?.stopAsync(); } catch (e) {} });
