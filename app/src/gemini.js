// Gemini calls: natural language -> a plotter-friendly SVG line drawing (the "image"), and an
// optional raster image generator. Key + model come from Settings (never committed). Called
// straight from the browser with the user's API key.
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

export async function generateSVG(prompt, { key, model = "gemini-2.5-flash" } = {}) {
  if (!key) throw new Error("No Gemini API key set (Settings).");
  const res = await fetch(`${BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYS }] },
      contents: [{ parts: [{ text: `Draw: ${prompt}` }] }],
      generationConfig: { temperature: 0.6 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const text = j?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
  const svg = pickSVG(text);
  if (!/<svg/i.test(svg)) throw new Error("Gemini did not return an SVG.");
  return svg;
}

// Raster image (the "Nano Banana" image model). Returns a data: URL, or throws.
export async function generateImage(prompt, { key, model = "gemini-2.5-flash-image" } = {}) {
  if (!key) throw new Error("No Gemini API key set (Settings).");
  const res = await fetch(`${BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: `A simple black-and-white line drawing, thick clean outlines on white, no shading, of: ${prompt}` }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini image ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const part = j?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!part) throw new Error("Gemini returned no image.");
  return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
}
