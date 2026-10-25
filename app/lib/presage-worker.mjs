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
// what the camera sees, small, 8 times a second, so the app can show you your face: videoOutput is the SDK's own
// frame for a UI to render, so nothing else has to open the camera (that changed the frame size under the SDK)
let shown = 0;
sdk.on("videoOutput", (buf, w, h, stride, fmt) => {
  const now = Date.now(); if (now - shown < 125) return; shown = now;
  const bpp = fmt === 2 || fmt === 3 ? 4 : fmt === 0 || fmt === 1 ? 3 : 0; if (!bpp || !w || !h) return;   // RGB(A) and BGR(A)
  const W = 240, H = Math.round((h / w) * W), out = Buffer.alloc(W * H * 3), bgr = fmt === 1 || fmt === 3;
  for (let y = 0; y < H; y++) {
    const row = Math.floor((y * h) / H) * stride;
    for (let x = 0; x < W; x++) {
      const i = row + Math.floor((x * w) / W) * bpp, o = (y * W + x) * 3;
      out[o] = buf[i + (bgr ? 2 : 0)]; out[o + 1] = buf[i + 1]; out[o + 2] = buf[i + (bgr ? 0 : 2)];
    }
  }
  send({ kind: "frame", w: W, h: H, rgb: out });
});
const quit = async () => { try { await sdk.stopAsync(); } catch (e) {} try { await sdk.destroy(); } catch (e) {} process.exit(0); };
process.on("message", (m) => { if (m === "stop") quit(); });
process.on("disconnect", quit);
try { sdk.useCamera(CameraSelection.default); sdk.start(); }
catch (e) { send({ kind: "error", message: e.message }); process.exit(1); }
