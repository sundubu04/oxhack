// Gemini calls, run on the server so the key stays in .env: a description -> a plotter-friendly SVG line
// drawing (the "image first" step), or a raster image to trace. Tries each model in turn, because the newest
// ones answer 503 under load.
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const SYS = `You convert a short description into a clean SINGLE-COLOUR LINE DRAWING for a pen-plotting robot arm.
Rules:
- Output ONLY an <svg> element, nothing else. No prose, no markdown fence.
- viewBox="0 0 100 100". Use only <path>, <polyline>, <line>, <circle>, <ellipse> with fill="none" and stroke="black".
- Line art only: outlines and a few interior strokes, like a one-line sketch. No shading, no fills, no text.
- Keep it to a few continuous strokes so an arm can draw it quickly. Centre the subject in the viewBox.`;

function pickSVG(text) {
  const m = (text || "").match(/<svg[\s\S]*?<\/svg>/i);
  return m ? m[0] : (text || "").trim();
}

// One call. Thinking costs seconds and a line drawing does not need it, so ask for the least the model allows.
async function call(model, key, body) {
  for (const level of ["minimal", "low", null]) {
    const generationConfig = { ...body.generationConfig, ...(level ? { thinkingConfig: { thinkingLevel: level } } : {}) };
    const res = await fetch(`${BASE}/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ ...body, generationConfig }),
    });
    if (res.ok) return res.json();
    const text = await res.text();
    if (res.status === 400 && /thinking/i.test(text)) continue;
    const err = new Error(message(res.status, text)); err.status = res.status; throw err;
  }
  throw new Error(`${model} refused every thinking level`);
}

function message(status, text) {
  let m = text; try { m = JSON.parse(text).error.message; } catch (e) {}
  return `Gemini ${status}: ${String(m).split(". ")[0].slice(0, 160)}`;
}

// Walk the model list; move on when a model is busy, missing or out of quota.
async function firstThatAnswers(models, key, body) {
  let last;
  for (const model of models.filter(Boolean)) {
    const t0 = Date.now();
    try { const json = await call(model, key, body); console.log(`  ${model} answered in ${Date.now() - t0} ms`); return { model, json }; }
    catch (e) { console.log(`  ${model} skipped: ${e.message}`); last = e; if (![404, 429, 500, 503].includes(e.status)) throw e; }
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
  const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  const svg = pickSVG(text);
  if (!/<svg/i.test(svg)) throw new Error("Gemini did not return an SVG");
  return { svg, model };
}

// Raster image (the "Nano Banana" models). Needs billing on the key's project. Returns a data: URL.
export async function generateImage(prompt, { key, models }) {
  if (!key) throw new Error("No Gemini key in app/.env");
  const { model, json } = await firstThatAnswers(models, key, {
    contents: [{ parts: [{ text: `A simple black-and-white line drawing, thick clean outlines on white, no shading, of: ${prompt}` }] }],
    generationConfig: {},
  });
  const part = json?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!part) throw new Error("Gemini returned no image");
  return { image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, model };
}

// Speech from Gemini's TTS model, the fallback voice when there is no ElevenLabs key. Returns WAV bytes.
export async function speak(text, { key, model }) {
  const { json } = await firstThatAnswers([model], key, {
    contents: [{ parts: [{ text }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } },
  });
  const part = json?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
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
