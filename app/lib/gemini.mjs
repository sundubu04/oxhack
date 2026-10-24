// Gemini calls, run on the server so the key stays in .env: a description -> a plotter-friendly SVG line drawing,
// a chat turn -> a reply and actions on the board, a raster image to trace, and speech. Models are tried in order;
// one that answers "busy" is skipped for this call, one that is out of quota is skipped until its quota resets.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const DRAW_RULES = `- Output one <svg viewBox="0 0 100 100"> using only <path>, <polyline>, <line>, <circle>, <ellipse>, <rect>, <polygon>, all fill="none" stroke="black". No <text>: draw any letters as single-stroke paths.
- Make the subject instantly recognisable. If it is a known logo, emblem, landmark, character or symbol, reproduce its real layout and distinctive features faithfully as line art.
- Outlines only: no shading or hatching, no detail smaller than 2 units. Prefer fewer, longer, continuous strokes.
- Fill most of the viewBox, centred.`;
const SYS = `You draw for a robot arm that holds one black whiteboard marker. Output ONLY the <svg>…</svg>, nothing else.\n${DRAW_RULES}`;

function pickSVG(text) {
  const m = (text || "").match(/<svg[\s\S]*?<\/svg>/i);
  return m ? m[0] : (text || "").trim();
}

// "gemini-3.5-flash:minimal" -> { model, level }
const parse = (spec) => { const [model, level] = spec.split(":"); return { model, level: level || null }; };

// When each model may be asked again, and why: "quota" after a 429 (its retry delay), "busy" after a 503, "slow" after a timeout.
// kept in data/ so a server restart doesn't spend the first turn finding out again (daily quotas last until midnight Pacific)
const SAVED = new URL("../data/gemini-cooling.json", import.meta.url);
const cooling = new Map((() => { try { return Object.entries(JSON.parse(readFileSync(SAVED, "utf8"))); } catch (e) { return []; } })());
const cool = (model, ms, why) => {
  cooling.set(model, { until: Date.now() + ms, why });
  try { mkdirSync(new URL("../data/", import.meta.url), { recursive: true }); writeFileSync(SAVED, JSON.stringify(Object.fromEntries(cooling))); } catch (e) {}
};
export function quotaState() { const now = Date.now(); return [...cooling].filter(([, c]) => c.until > now).map(([model, c]) => ({ model, ...c })); }

async function call(model, level, key, body, timeoutMs) {
  const levels = level ? [level, null] : [null];
  for (const lv of levels) {
    const generationConfig = { ...body.generationConfig, ...(lv ? { thinkingConfig: { thinkingLevel: lv } } : {}) };
    // a busy model can sit on a request for minutes; give up on it and try the next one
    const res = await fetch(`${BASE}/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ ...body, generationConfig }), signal: AbortSignal.timeout(timeoutMs),
    }).catch((e) => { const err = new Error(e.name === "TimeoutError" ? `${model} took over ${timeoutMs / 1000} s` : e.message); err.status = 503; err.slow = e.name === "TimeoutError"; throw err; });
    if (res.ok) return res.json();
    const text = await res.text();
    if (res.status === 400 && /thinking/i.test(text)) continue;
    const err = new Error(message(res.status, text)); err.status = res.status;
    if (res.status === 429) {
      let wait = 60; try { const d = JSON.parse(text).error.details.find((x) => x.retryDelay); wait = parseFloat(d.retryDelay) || 60; } catch (e) {}
      cool(model, wait * 1000, "quota"); err.until = Date.now() + wait * 1000;
    }
    throw err;
  }
  throw new Error(`${model} refused every thinking level`);
}

function message(status, text) {
  let m = text; try { m = JSON.parse(text).error.message; } catch (e) {}
  return `Gemini ${status}: ${String(m).split(". ")[0].slice(0, 160)}`;
}

// Walk the model list; move on when a model is busy, missing or out of quota.
async function firstThatAnswers(specs, key, body, timeoutMs = 25000) {
  let last, soonest = Infinity;
  const ready = specs.filter(Boolean).map(parse).filter(({ model }) => { const u = cooling.get(model)?.until; if (u && u > Date.now()) { soonest = Math.min(soonest, u); return false; } return true; });
  for (const [k, { model, level }] of ready.entries()) {
    const t0 = Date.now();
    // the last model left has nothing to fall back on, so it gets longer to answer
    const wait = k === ready.length - 1 ? Math.max(timeoutMs, 75000) : timeoutMs;
    try { const json = await call(model, level, key, body, wait); console.log(`  ${model} answered in ${Date.now() - t0} ms`); return { model, json }; }
    catch (e) {
      console.log(`  ${model} skipped: ${e.message}`); last = e; if (e.until) soonest = Math.min(soonest, e.until);
      // says it's busy: leave it alone for two minutes, so the next turns don't wait on it again
      if ((e.status === 503 || e.status === 500) && !e.slow) cool(model, 120000, "busy");
      // too slow, with others still to try: skip it for fifteen minutes, or every few turns wait 30 s on it again
      if (e.slow && k < ready.length - 1) cool(model, 900000, "slow");
      if (![404, 429, 500, 503].includes(e.status)) throw e;
    }
  }
  if (!last && !ready.length && soonest - Date.now() < 300000) { const err = new Error("Gemini is busy right now. Try again in a minute or two."); err.status = 503; throw err; }
  if (!last || last.status === 429) {
    const err = new Error(`Gemini's free quota is used up${isFinite(soonest) ? ` until ${new Date(soonest).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}. Turning on billing for the Gemini project lifts it.`);
    err.status = 429; throw err;
  }
  throw last;
}

export async function generateSVG(prompt, { key, models }) {
  if (!key) throw new Error("No Gemini key in app/.env");
  const { model, json } = await firstThatAnswers(models, key, {
    systemInstruction: { parts: [{ text: SYS }] },
    contents: [{ parts: [{ text: `Draw: ${prompt}` }] }],
    generationConfig: { temperature: 0.6 },
  });
  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  const svg = pickSVG(text);
  if (!/<svg/i.test(svg)) throw new Error("Gemini did not return an SVG");
  return { svg, model };
}

// ---- chat: one turn -> a reply and what to do to the board ----
const CHAT = `You are Clockedin, a robot arm that draws on a small whiteboard with one black marker, and wipes with the eraser on the marker's other end. You talk with the person and change the drawing on the board as they ask.

The board is a square drawing area, 0 to 100 both ways, x to the right and y downwards (like SVG). What is on it now is listed with each turn.

Answer with JSON: {"reply": "...", "actions": [...]}.
reply: one or two short sentences in plain British English: say what you are about to draw or change. Never describe SVG.
actions, carried out in order:
- {"type":"draw","id":"a short new id","name":"what it is","box":{"x":..,"y":..,"w":..,"h":..},"parts":"…","svg":"<svg viewBox=\\"0 0 100 100\\">…</svg>"} adds a drawing in that box. In parts, first list what makes the subject recognisable (for a crest: its shield shape, every charge on it and where, any motto), then draw all of it in svg. The first drawing usually takes the whole board {"x":0,"y":0,"w":100,"h":100}; later ones go in empty space, smaller, unless the person says where.
- {"type":"edit","id":"an id on the board","svg":"…"} changes a drawing. Start from its current SVG, given below, and change only what was asked: copy every unchanged element exactly, character for character, so the robot only wipes and redraws what changed.
- {"type":"erase","id":"an id on the board"} wipes one drawing; {"type":"clear"} wipes the board.
- {"type":"game","game":"tictactoe","first":"person" or "robot"} starts noughts and crosses; the app draws the grid and plays the robot's moves. {"type":"move","cell":0..8} plays the person's move (0 top left, 2 top right, 8 bottom right) when a game is on.
- No actions when the person is only chatting or asking a question.
Every svg follows these rules:
${DRAW_RULES}`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING" },
    actions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", enum: ["draw", "edit", "erase", "clear", "game", "move"] },
          id: { type: "STRING" }, name: { type: "STRING" }, parts: { type: "STRING" }, svg: { type: "STRING" },
          box: { type: "OBJECT", properties: { x: { type: "NUMBER" }, y: { type: "NUMBER" }, w: { type: "NUMBER" }, h: { type: "NUMBER" } } },
          game: { type: "STRING" }, first: { type: "STRING" }, cell: { type: "INTEGER" },
        },
        // Gemini writes the fields in alphabetical order, so the parts come before the svg and the drawing follows them
        required: ["type"],
      },
    },
  },
  required: ["reply", "actions"],
};

// messages: [{ role: "user" | "assistant", text }], board: [{ id, name, box, svg }], game: a line of text or null
export async function chat(messages, board, game, { key, models }) {
  if (!key) throw new Error("No Gemini key in app/.env");
  const state = board.length
    ? `On the board now:\n${board.map((b) => `- id "${b.id}", ${b.name}, box ${JSON.stringify(b.box)}${b.svg ? `, svg: ${b.svg}` : ""}`).join("\n")}`
    : "The board is empty.";
  const contents = messages.slice(-12).map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.text }] }));
  contents.push({ role: "user", parts: [{ text: `${state}${game ? `\nGame: ${game}` : ""}\n(Answer the person's last message.)` }] });
  const { model, json } = await firstThatAnswers(models, key, {
    systemInstruction: { parts: [{ text: CHAT }] }, contents,
    generationConfig: { temperature: 0.6, responseMimeType: "application/json", responseSchema: SCHEMA },
  }, 30000);
  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  let out; try { out = JSON.parse(text); } catch (e) { throw new Error("Gemini's answer wasn't readable; ask again"); }
  out.actions = (out.actions || []).map((a) => (a.svg ? { ...a, svg: pickSVG(a.svg) } : a));
  return { ...out, model };
}

// Raster image (the "Nano Banana" models). Needs billing on the key's project. Returns a data: URL.
export async function generateImage(prompt, { key, models }) {
  if (!key) throw new Error("No Gemini key in app/.env");
  const { model, json } = await firstThatAnswers(models, key, {
    contents: [{ parts: [{ text: `A simple black-and-white line drawing, thick clean outlines on white, no shading, of: ${prompt}` }] }],
    generationConfig: {},
  });
  const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error("Gemini returned no image");
  return { image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, model };
}

// Speech from Gemini's TTS model, the fallback voice when there is no ElevenLabs key. Returns WAV bytes.
export async function speak(text, { key, model }) {
  const { json } = await firstThatAnswers([model], key, {
    contents: [{ parts: [{ text }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } },
  });
  const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error("Gemini returned no audio");
  const bytes = Buffer.from(part.inlineData.data, "base64");
  const mime = part.inlineData.mimeType;
  if (mime.includes("wav")) return bytes;
  return wav(bytes, Number((mime.match(/rate=(\d+)/) || [])[1] || 24000));
}

// Raw 16-bit mono PCM -> a WAV file the browser can play.
function wav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
