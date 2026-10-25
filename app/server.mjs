// Dev server for Clockedin. Serves this folder, holds the API keys (from .env, never sent to the browser) and
// answers the app's few calls: /api/status, /api/chat, /api/draw, /api/speak, /api/sims and /api/config. It also
// holds the arm's USB port (/api/arm, lib/arm.mjs), so the app, curl or a script can move the arm. Local only.
// GPT answers first when OPENAI_API_KEY is set, Gemini when it is not or when every GPT model fails. `node server.mjs`, then open the URL.
import { createServer } from "node:http";
import { readFile, writeFile, readdir, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import * as gemini from "./lib/gemini.mjs";
import * as gpt from "./lib/openai.mjs";
import * as armLink from "./lib/arm.mjs";
import { geomFrom, withDefaults, servoAngle } from "./src/config.js";
import { toAngles, toolPoint } from "./src/ik.js";
import { drawPath, plan } from "./src/pathplan.js";
import { makeJob, homePose } from "./src/sim.js";
import { keyframes, thin } from "./src/arm.js";
import { parseSVG } from "./src/svg.js";

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

const keys = () => ({ openai: env("OPENAI_API_KEY"), gemini: env("GEMINI_API_KEY"), eleven: env("ELEVENLABS_API_KEY") });
// best drawings first (10 to 18 s); then the fast one (5 to 10 s); see app/README.md for how they were picked
const gptModels = () => env("OPENAI_MODELS", "gpt-6.1-sol:low,gpt-5.6-sol:low,gpt-6-luna:low").split(",").map((s) => s.trim()).filter(Boolean);
// best first: the pro model answers once the project has billing (its free quota is zero, so until then it is
// skipped at once); each flash model has its own free quota of 20 a day
const textModels = () => env("GEMINI_MODELS", "gemini-3.1-pro-preview:low,gemini-3.5-flash:minimal,gemini-3.8-flash:low,gemini-3.1-flash-lite:low").split(",").map((s) => s.trim()).filter(Boolean);
const SIMS = join(root, "data", "sims");
const imageModels = () => [env("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image"), "gemini-3.1-flash-image"];

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(Buffer.isBuffer(body) || typeof body === "string" ? body : JSON.stringify(body));
}
async function body(req, max = 1e6) {
  let s = ""; for await (const c of req) { s += c; if (s.length > max) throw new Error("too large"); }
  return s ? JSON.parse(s) : {};
}

// GPT first when its key is set; Gemini when there is no GPT key or every GPT model failed
async function either(withGpt, withGemini) {
  const k = keys();
  if (k.openai) {
    try { return await withGpt({ key: k.openai, models: gptModels(), timeoutMs: 30000 }); }
    catch (e) { if (!k.gemini) throw e; console.log(`  GPT failed (${e.message}), trying Gemini`); }
  }
  return withGemini({ key: k.gemini, models: textModels() });
}

async function api(req, res, path) {
  if (path === "/api/status") {
    const k = keys();
    return send(res, 200, {
      openai: { ready: !!k.openai, models: gptModels(), cooling: gpt.coolingState() },
      gemini: { ready: !!k.gemini, model: textModels()[0].split(":")[0], models: textModels(), cooling: gemini.quotaState() },
      voice: { provider: k.eleven ? "elevenlabs" : k.openai ? "openai" : k.gemini ? "gemini" : "browser", voice: env("ELEVENLABS_VOICE", "JBFqnCBsd6RMkjVDRZzb") },
    });
  }
  if (path === "/api/draw" && req.method === "POST") {
    const { prompt, route } = await body(req);
    if (!prompt) return send(res, 400, { error: "Say what to draw" });
    const k = keys();
    if (!k.openai && !k.gemini) return send(res, 503, { error: "No OpenAI or Gemini key in app/.env" });
    try {
      const t0 = Date.now();
      const out = route === "image"
        ? await gemini.generateImage(prompt, { key: k.gemini, models: imageModels() })
        : await either((o) => gpt.generateSVG(prompt, o), (o) => gemini.generateSVG(prompt, o));
      return send(res, 200, { ...out, ms: Date.now() - t0 });
    } catch (e) { return send(res, 502, { error: e.message }); }
  }
  if (path === "/api/chat" && req.method === "POST") {
    const { messages, board, game } = await body(req);
    if (!keys().openai && !keys().gemini) return send(res, 503, { error: "No OpenAI or Gemini key in app/.env" });
    try {
      const t0 = Date.now();
      const out = await either((o) => gpt.chat(messages || [], board || [], game || null, o), (o) => gemini.chat(messages || [], board || [], game || null, o));
      return send(res, 200, { ...out, ms: Date.now() - t0 });
    } catch (e) { return send(res, e.status === 429 ? 429 : 502, { error: e.message }); }
  }
  // simulations: one JSON file each in app/data/sims (data/ stays out of git)
  if (path === "/api/sims" && req.method === "GET") {
    await mkdir(SIMS, { recursive: true });
    const list = [];
    for (const f of (await readdir(SIMS)).filter((f) => f.endsWith(".json"))) {
      try { const s = JSON.parse(await readFile(join(SIMS, f), "utf8")); list.push({ id: s.id, title: s.title, updated: s.updated }); } catch (e) {}
    }
    return send(res, 200, list.sort((a, b) => b.updated - a.updated));
  }
  const sm = path.match(/^\/api\/sims\/([a-z0-9-]{4,40})$/);
  if (sm) {
    const file = join(SIMS, `${sm[1]}.json`);
    if (req.method === "GET") { try { return send(res, 200, JSON.parse(await readFile(file, "utf8"))); } catch (e) { return send(res, 404, { error: "No such simulation" }); } }
    if (req.method === "PUT") { await mkdir(SIMS, { recursive: true }); const s = await body(req, 8e6); await writeFile(file, JSON.stringify({ ...s, id: sm[1] })); return send(res, 200, { ok: true }); }
    if (req.method === "DELETE") { await unlink(file).catch(() => {}); return send(res, 200, { ok: true }); }
  }
  if (path === "/api/speak" && req.method === "POST") {
    const { text, voice: asked } = await body(req), k = keys();
    if (!text) return send(res, 400, { error: "Nothing to say" });
    const voice = /^[A-Za-z0-9]{8,40}$/.test(asked || "") ? asked : env("ELEVENLABS_VOICE", "JBFqnCBsd6RMkjVDRZzb");
    const key = `${k.eleven ? `el:${voice}` : k.openai ? "oa" : "gm"}:${text}`;
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
        if (!k.openai && !k.gemini) throw new Error(`ElevenLabs ${r.status}`);
      }
      if (k.openai) {
        try { const [type, bytes] = remember(key, ["audio/mpeg", await gpt.speak(text, { key: k.openai, model: env("OPENAI_TTS_MODEL", "gpt-4o-mini-tts"), voice: env("OPENAI_VOICE", "coral") })]); return send(res, 200, bytes, type); }
        catch (e) { console.log(`  ${e.message}`); if (!k.gemini) throw e; }
      }
      if (k.gemini) { const [type, bytes] = remember(key, ["audio/wav", await gemini.speak(text, { key: k.gemini, model: env("GEMINI_TTS_MODEL", "gemini-3.8-flash-tts") })]); return send(res, 200, bytes, type); }
      res.writeHead(204).end();
    } catch (e) { return send(res, 502, { error: e.message }); }
    return;
  }
  if (path === "/api/arm" || path.startsWith("/api/arm/")) {
    try { return send(res, 200, await arm(req, path.slice(8))); }
    catch (e) { return send(res, 400, { ...armLink.status(), error: e.message }); }
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

// The arm, through lib/arm.mjs. Every call answers with the arm's status.
//   GET  /api/arm                          status: ports, connection, firmware, live settings, job, last lines
//   POST /api/arm/connect {port?}          open the port (the first Arduino when no port is given)
//   POST /api/arm/servos {base, elbow, pen}   servo degrees, 0 to 180; any left out stay put
//   POST /api/arm/point {x, y, tool, start, pen, lift}   a board point in mm for the nib (tool draw or lift) or the
//                                          eraser (erase); start: a stroke's first point, reached lifted, then pen down;
//                                          pen, lift: pen servo degrees to use instead of the saved ones
//   POST /api/arm/draw {strokes} | {svg}   strokes in board mm, drawn as they are, or an SVG fitted to the drawing
//                                          square: ordered for least travel, solved, timed with ramps, streamed
//   POST /api/arm/run {keys}               keyframes the app planned
//   POST /api/arm/tune {interval, minStep, speed, accel}   live moves: ms apart, smallest step, glide deg/s, deg/s²
//   POST /api/arm/park | stop | disconnect
async function arm(req, sub) {
  if (req.method === "GET") return armLink.status();
  const b = await body(req, 4e6), g = geomFrom(withDefaults(JSON.parse(await readFile(join(root, "arm.config.json"), "utf8"))));
  switch (sub) {
    case "/connect": { const c = withDefaults(JSON.parse(await readFile(join(root, "arm.config.json"), "utf8")));
      const s = await armLink.connect(b.port || undefined); return s.firmware ? armLink.tune({ ...c.live, accel: c.servos.accel }) : s; }
    case "/disconnect": return armLink.disconnect();
    case "/servos": return armLink.servos(b);
    case "/point": return armLink.point(+b.x, +b.y, ["draw", "lift", "erase"].includes(b.tool) ? b.tool : "draw", g, servosAt(g, b), !!b.start);
    case "/tune": return armLink.tune(b);
    case "/park": return armLink.park();
    case "/stop": return armLink.stop();
    case "/run": return armLink.run(b.keys);
    case "/draw": {
      const h = homePose(g), from = toolPoint(h.base * Math.PI / 180, h.elbow * Math.PI / 180, g);
      const strokes = b.svg ? null : (b.strokes || []).map((s) => s.map((p) => ({ x: +p.x, y: +p.y })));
      const tp = (b.svg ? plan(parseSVG(b.svg), g, { half: g.half, leadIn: g.leadIn, from }) : drawPath(strokes, { from, leadIn: g.leadIn })).toolpath;
      if (!tp.length) throw new Error("Nothing to draw");
      tp.push({ ...from, pen: 0 });   // and home again
      const an = toAngles(tp, g);
      if (an.unreachable || an.outOfRange) throw new Error(`${an.unreachable + an.outOfRange} points are out of the arm's reach`);
      return armLink.run(thin(keyframes(makeJob(tp, an, g), g)));
    }
  }
  throw new Error("no such arm call");
}
// a board point -> servo degrees for that end of the pen, or null when the arm can't get there; the request's own pen
// angles (pen, lift: servo degrees) win over the saved ones, so Arm setup can try them before saving
function servosAt(g, b = {}) {
  const num = (v) => (v !== null && v !== "" && Number.isFinite(+v) ? Math.min(180, Math.max(0, +v)) : null);
  return (x, y, tool) => {
    const r = toAngles([{ x, y, pen: tool === "lift" ? 0 : 1, tool }], g), a = r.path[0];
    if (a.out_of_reach || r.outOfRange) return null;
    const lift = num(b.lift) ?? servoAngle("tilt", g.tilt.lift, g);
    return { servo: [servoAngle("base", a.base, g), servoAngle("elbow", a.elbow, g), num(b.pen) ?? (tool === "lift" ? lift : servoAngle("tilt", a.tilt, g))], lift };
  };
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
  console.log(`Clockedin → http://localhost:${PORT}`);
  console.log(`  GPT ${k.openai ? `ready (${gptModels().join(", ")})` : "no key"} · Gemini ${k.gemini ? "ready" : "no key"} · voice ${k.eleven ? "ElevenLabs" : k.openai ? "GPT" : k.gemini ? "Gemini TTS" : "browser"}`);
});
