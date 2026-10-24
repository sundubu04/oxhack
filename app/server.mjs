// Dev server for Clockwork. Serves this folder, holds the API keys (from .env, never sent to the browser) and
// answers the app's few calls: /api/status, /api/draw, /api/speak and /api/config. `node server.mjs`, then open the URL.
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import * as gemini from "./lib/gemini.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
if (existsSync(join(root, ".env"))) process.loadEnvFile(join(root, ".env"));
const env = (k, d = "") => (process.env[k] || d).trim();
const PORT = env("PORT", "5178");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain" };
// Never served: keys, the server's own code, installed packages.
const PRIVATE = /(^|\/)(\.env[^/]*|lib\/|node_modules\/|server\.mjs|package-lock\.json)/;

// Spoken lines repeat ("Done.", the time each minute); keep the last few so a repeat costs no credits.
const spoken = new Map();
function remember(k, v) { spoken.set(k, v); if (spoken.size > 60) spoken.delete(spoken.keys().next().value); return v; }

const keys = () => ({ gemini: env("GEMINI_API_KEY"), eleven: env("ELEVENLABS_API_KEY") });
const textModels = () => [...new Set([env("GEMINI_MODEL", "gemini-3.5-flash"), env("GEMINI_FALLBACK_MODEL", "gemini-3.1-flash-lite"), "gemini-3.1-flash-lite", "gemini-3.8-flash"])];
const imageModels = () => [env("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image"), "gemini-3.1-flash-image"];

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(Buffer.isBuffer(body) || typeof body === "string" ? body : JSON.stringify(body));
}
async function body(req) {
  let s = ""; for await (const c of req) { s += c; if (s.length > 1e6) throw new Error("too large"); }
  return s ? JSON.parse(s) : {};
}

async function api(req, res, path) {
  if (path === "/api/status") {
    const k = keys();
    return send(res, 200, {
      gemini: { ready: !!k.gemini, model: textModels()[0] },
      voice: { provider: k.eleven ? "elevenlabs" : k.gemini ? "gemini" : "browser", voice: env("ELEVENLABS_VOICE", "JBFqnCBsd6RMkjVDRZzb") },
    });
  }
  if (path === "/api/draw" && req.method === "POST") {
    const { prompt, route } = await body(req);
    if (!prompt) return send(res, 400, { error: "Say what to draw" });
    if (!keys().gemini) return send(res, 503, { error: "No Gemini key in app/.env" });
    try {
      const t0 = Date.now();
      const out = route === "image"
        ? await gemini.generateImage(prompt, { key: keys().gemini, models: imageModels() })
        : await gemini.generateSVG(prompt, { key: keys().gemini, models: textModels() });
      return send(res, 200, { ...out, ms: Date.now() - t0 });
    } catch (e) { return send(res, 502, { error: e.message }); }
  }
  if (path === "/api/speak" && req.method === "POST") {
    const { text, voice: asked } = await body(req), k = keys();
    if (!text) return send(res, 400, { error: "Nothing to say" });
    const voice = /^[A-Za-z0-9]{8,40}$/.test(asked || "") ? asked : env("ELEVENLABS_VOICE", "JBFqnCBsd6RMkjVDRZzb");
    const key = `${k.eleven ? `el:${voice}` : "gm"}:${text}`;
    if (spoken.has(key)) { const [type, bytes] = spoken.get(key); return send(res, 200, bytes, type); }
    try {
      if (k.eleven) {
        // ElevenLabs first whenever its key is in .env; Flash is its low-latency model
        const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
          method: "POST", headers: { "xi-api-key": k.eleven, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify({ text, model_id: env("ELEVENLABS_MODEL", "eleven_flash_v2_5") }),
          signal: AbortSignal.timeout(15000),
        });
        if (r.ok) { const [type, bytes] = remember(key, ["audio/mpeg", Buffer.from(await r.arrayBuffer())]); return send(res, 200, bytes, type); }
        console.log(`  ElevenLabs ${r.status}: ${(await r.text()).slice(0, 160)}`);
        if (!k.gemini) throw new Error(`ElevenLabs ${r.status}`);
      }
      if (k.gemini) { const [type, bytes] = remember(key, ["audio/wav", await gemini.speak(text, { key: k.gemini, model: env("GEMINI_TTS_MODEL", "gemini-3.8-flash-tts") })]); return send(res, 200, bytes, type); }
      res.writeHead(204).end();
    } catch (e) { return send(res, 502, { error: e.message }); }
    return;
  }
  if (path === "/api/config" && req.method === "POST") {
    const cfg = await body(req);
    const bad = [];
    (function walk(o, at) { for (const [k, v] of Object.entries(o)) { if (v && typeof v === "object") walk(v, `${at}${k}.`); else if (typeof v === "number" && !Number.isFinite(v)) bad.push(at + k); } })(cfg, "");
    if (bad.length || !cfg.links || !(cfg.links.L1 > 0 && cfg.links.L2 > 0)) return send(res, 400, { error: `Check ${bad[0] || "the link lengths"}` });
    await writeFile(join(root, "arm.config.json"), JSON.stringify(cfg, null, 2) + "\n");
    return send(res, 200, cfg);
  }
  send(res, 404, { error: "no such call" });
}

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p.startsWith("/api/")) return await api(req, res, p);
    if (p === "/") p = "/index.html";
    if (PRIVATE.test(p)) return send(res, 404, "not found", "text/plain");
    const file = normalize(join(root, p));
    if (!file.startsWith(root)) return send(res, 403, "forbidden", "text/plain");
    send(res, 200, await readFile(file), TYPES[extname(file)] || "application/octet-stream");
  } catch (e) {
    send(res, 404, "not found", "text/plain");
  }
}).listen(PORT, "127.0.0.1", () => {
  const k = keys();
  console.log(`Clockwork → http://localhost:${PORT}`);
  console.log(`  Gemini ${k.gemini ? "ready" : "no key (add GEMINI_API_KEY to app/.env)"} · voice ${k.eleven ? "ElevenLabs" : k.gemini ? "Gemini TTS" : "browser"}`);
});
