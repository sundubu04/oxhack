// Presage's SDK in a process of its own (lib/presage.mjs starts it): its native code can abort the whole process
// (an OpenCV assertion when the camera's frame size changed under it took the server down once), so it runs here
// and the server only hears what it reads. Stops when told to, or when the server goes.
const { SmartSpectraSDK, CameraSelection, faceMetrics, decodeMetrics } = await import("@smartspectra/node-sdk");
const send = (m) => { try { process.send?.(m); } catch (e) {} };
const sdk = new SmartSpectraSDK({ apiKey: process.env.PRESAGE_API_KEY, requestedMetrics: [...faceMetrics], enableTelemetry: false });
sdk.on("processingStatus", (s) => send({ kind: "status", s }));
sdk.on("validationStatus", (code, _ts, hint) => send({ kind: "validation", code, hint }));
sdk.on("error", (_code, message) => send({ kind: "error", message }));
sdk.on("metrics", (buf) => {
  const m = decodeMetrics(buf); if (!m || Buffer.isBuffer(m)) return;
  const e = m.face?.expression?.at(-1);
  if (e?.scores?.length) send({ kind: "expression", stable: !!e.stable, scores: e.scores.map((s) => [s.type, +s.confidence || 0]) });
});
const quit = async () => { try { await sdk.stopAsync(); } catch (e) {} try { await sdk.destroy(); } catch (e) {} process.exit(0); };
process.on("message", (m) => { if (m === "stop") quit(); });
process.on("disconnect", quit);
try { sdk.useCamera(CameraSelection.default); sdk.start(); }
catch (e) { send({ kind: "error", message: e.message }); process.exit(1); }
