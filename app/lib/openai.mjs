// OpenAI calls (the GPT credits), run on the server like gemini.mjs: a chat turn -> a reply and actions on the
// board, and speech. Drawings come back as a list of SVG path strings, one pen stroke each, and are wrapped into an
// <svg> here: an SVG with quoted attributes inside a JSON string made some models lose their place and run on.
const BASE = "https://api.openai.com/v1";

export const CHAT = `You are Clockedin, a robot arm that draws on a small whiteboard with one black marker, and wipes with the eraser on the marker's other end. You talk with the person and change the drawing on the board as they ask.

The board is a square drawing area, 0 to 100 both ways, x to the right and y downwards (like SVG). What is on it now is listed with each turn.

reply: one or two short sentences in plain British English: say what you are about to draw or change. Never describe paths or coordinates.
actions, carried out in order (leave out the fields an action doesn't use, as null):
- draw: adds a drawing. id: a short new id; name: what it is; box: where it goes on the board {x, y, w, h}; parts: first list what makes the subject recognisable (for a crest: its shield shape, every charge on it and where, any motto); paths: then draw all of it; texts: any words in it (below). The first drawing usually takes the whole board {"x":0,"y":0,"w":100,"h":100}; later ones go in empty space, smaller, unless the person says where.
- edit: changes a drawing on the board. id: its id; paths: its whole new list; texts: its whole new list, or null to leave them. Start from its current paths, given below, and change only what was asked: copy every unchanged path exactly, so the robot only wipes and redraws what changed.
- write: anything that is mainly words: a to-do list, a shopping list, a note, a sign, a card, a short poem, a menu, a score. id, name, box; title: a heading or null; lines: [{text, check}], check "open" for a line with an empty box to tick, "done" for a ticked one, null for a plain line; align: "left" for lists and notes, "center" for signs and cards. At most 12 lines of about 30 characters. The app letters it neatly in its own pen font and lays it out. When the person doesn't say what goes on a list, make up a short, playful one in character. To change one (tick a line, add one, cross one out, retitle it), send write with the same id and the whole new list: unchanged lines exactly as they are, so only the change is drawn. A picture to go with it is a separate draw in its own box.
- erase: wipes one drawing (id). clear: wipes the board.
- game: starts noughts and crosses (game "tictactoe", first "person" or "robot"); the app draws the grid and plays the robot's moves. move: plays the person's move (cell 0 top left, 2 top right, 8 bottom right) when a game is on.
- repeat: when the person wants something to happen again by itself on a schedule ("keep it up to date", "a new animal every 10 minutes"): every: minutes between runs, 1 or more; prompt: the request to run each time, short, in their words (for a clock: "draw the time", which the app draws itself). Add the actions that do it now as well.
- No actions when the person is only chatting or asking a question.
- Never ask which one the person means: draw the best-known one and name it in the reply. They can ask for a change.

paths: each is the d of one SVG path in a 100 x 100 box (x right, y down), one pen stroke: M, L, H, V, C, Q, A and Z only, numbers to one decimal place.
- Make the subject instantly recognisable. If it is a known logo, emblem, landmark, character or symbol, reproduce its real layout and distinctive features faithfully as line art.
- Outlines only: no shading or hatching, no detail smaller than 2 units. Prefer fewer, longer, continuous strokes; 60 paths at most.
- Never draw letters or digits as paths. Every word in a drawing (a motto, a name, a label, a number on a clock face) goes in texts: {text, x, y, w, h}, the rectangle in the same 100 x 100 box that the words should fill; the app letters them in its own pen font. Use "\n" in text for a second line.
- Fill most of the box, centred.`;

const S = { type: ["string", "null"] };
const SCHEMA = {
  type: "object", additionalProperties: false, required: ["reply", "actions"],
  properties: {
    reply: { type: "string" },
    actions: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        // written in this order, so the parts are listed before the paths that draw them
        required: ["type", "id", "name", "box", "parts", "paths", "texts", "title", "lines", "align", "game", "first", "cell", "every", "prompt"],
        properties: {
          type: { type: "string", enum: ["draw", "edit", "write", "erase", "clear", "game", "move", "repeat"] },
          id: S, name: S,
          box: { anyOf: [{ type: "object", additionalProperties: false, required: ["x", "y", "w", "h"], properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" } } }, { type: "null" }] },
          parts: S,
          paths: { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] },
          texts: { anyOf: [{ type: "array", items: { type: "object", additionalProperties: false, required: ["text", "x", "y", "w", "h"], properties: { text: { type: "string" }, x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" } } } }, { type: "null" }] },
          title: S,
          lines: { anyOf: [{ type: "array", items: { type: "object", additionalProperties: false, required: ["text", "check"], properties: { text: { type: "string" }, check: { type: ["string", "null"], enum: ["open", "done", null] } } } }, { type: "null" }] },
          align: S,
          game: S, first: S, cell: { type: ["integer", "null"] }, every: { type: ["integer", "null"] }, prompt: S,
        },
      },
    },
  },
};

// path strings -> one <svg>; anything but path commands and numbers is dropped, so nothing else gets into the page
const clean = (d) => String(d).replace(/[^MLHVCSQTAZmlhvcsqtaz0-9.,\-\s]/g, "").trim();
export const toSVG = (paths) => `<svg viewBox="0 0 100 100">${paths.map(clean).filter(Boolean).map((d) => `<path d="${d}" fill="none" stroke="black"/>`).join("")}</svg>`;
// a drawing's current paths, when its svg is only paths (it is, for anything GPT drew); otherwise the svg itself
const pathsOf = (svg) => (/<(circle|ellipse|rect|line|polyline|polygon)\b/i.test(svg) ? null : [...svg.matchAll(/\sd="([^"]*)"/g)].map((m) => m[1]));

// "gpt-6-sol:low" -> { model, effort }
const parse = (spec) => { const [model, effort] = spec.split(":"); return { model, effort: effort || null }; };
const cooling = new Map();
export function coolingState() { const now = Date.now(); return [...cooling].filter(([, c]) => c.until > now).map(([model, c]) => ({ model, ...c })); }
const cool = (model, ms, why) => cooling.set(model, { until: Date.now() + ms, why });

async function respond(model, effort, key, body, timeoutMs, stop) {
  for (const eff of effort ? [effort, null] : [null]) {
    const res = await fetch(`${BASE}/responses`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ ...body, model, ...(eff ? { reasoning: { effort: eff } } : {}) }), signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), stop]),
    }).catch((e) => { const err = new Error(e.name === "TimeoutError" ? `${model} took over ${timeoutMs / 1000} s` : e.message); err.status = 503; err.slow = e.name === "TimeoutError"; throw err; });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      if (j.status === "incomplete") { const err = new Error(`${model} ran out of room (${j.incomplete_details?.reason})`); err.status = 502; err.room = true; throw err; }
      return j;
    }
    // a model without reasoning settings: ask again without them
    if (res.status === 400 && /reasoning/i.test(j.error?.message || "")) continue;
    const err = new Error(`GPT ${res.status}: ${String(j.error?.message || "no answer").split(". ")[0].slice(0, 160)}`); err.status = res.status;
    if (res.status === 429) { err.quota = j.error?.code === "insufficient_quota"; cool(model, err.quota ? 3600000 : 30000, "quota"); }
    throw err;
  }
}

// Ask the models in order, hedged: if the first hasn't answered within hedgeMs, ask the next as well and take
// whichever answers first (the others are cancelled). A model that fails hands over to the next at once.
// The best model usually answers in 4 to 15 s, but now and then takes a minute; this keeps those turns short.
function firstThatAnswers(specs, key, body, timeoutMs, hedgeMs = 12000) {
  const ready = specs.filter(Boolean).map(parse).filter(({ model }) => !(cooling.get(model)?.until > Date.now()));
  if (!ready.length) return Promise.reject(Object.assign(new Error("Every GPT model is resting after a slow or failed answer. Try again in a few minutes."), { status: 503 }));
  const stop = new AbortController();
  return new Promise((resolve, reject) => {
    let next = 0, running = 0, done = false, last, hedge;
    const finish = (fn, v) => { done = true; clearTimeout(hedge); stop.abort(); fn(v); };
    const start = () => {
      if (done || next >= ready.length) return;
      const k = next++, { model, effort } = ready[k], t0 = Date.now();
      const wait = k === ready.length - 1 ? Math.max(timeoutMs, 60000) : timeoutMs;
      running++; clearTimeout(hedge); hedge = setTimeout(start, hedgeMs);
      respond(model, effort, key, body, wait, stop.signal).then((json) => {
        if (done) return;
        console.log(`  ${model} answered in ${Date.now() - t0} ms`); finish(resolve, { model, json });
      }, (e) => {
        running--; if (done) return;
        console.log(`  ${model} skipped: ${e.message}`); last = e;
        if (e.slow && k < ready.length - 1) cool(model, 600000, "slow");
        if (e.status >= 500 && !e.slow && !e.room) cool(model, 120000, "busy");
        if (![404, 429, 500, 502, 503].includes(e.status)) return finish(reject, e);
        if (next < ready.length) start(); else if (!running) finish(reject, last);
      });
    };
    start();
  });
}

const text = (j) => (j.output || []).flatMap((o) => o.content || []).map((c) => c.text || "").join("");

// messages: [{ role: "user" | "assistant", text }], board: [{ id, name, box, svg }], game: a line of text or null
export async function chat(messages, board, game, { key, models, timeoutMs = 25000 }) {
  if (!key) throw new Error("No OpenAI key in app/.env");
  const state = board.length
    ? `On the board now:\n${board.map((b) => {
        if (b.write) return `- id "${b.id}", ${b.name}, written, box ${JSON.stringify(b.box)}, title ${JSON.stringify(b.write.title || null)}, align ${b.write.align}, lines: ${JSON.stringify(b.write.lines)}`;
        const p = b.svg && pathsOf(b.svg);
        return `- id "${b.id}", ${b.name}, box ${JSON.stringify(b.box)}${p ? `, paths: ${JSON.stringify(p)}` : b.svg ? `, svg: ${b.svg}` : ""}${b.texts ? `, texts: ${JSON.stringify(b.texts)}` : ""}`;
      }).join("\n")}`
    : "The board is empty.";
  const input = messages.slice(-12).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));
  input.push({ role: "user", content: `${state}${game ? `\nGame: ${game}` : ""}\n(Answer the person's last message.)` });
  const { model, json } = await firstThatAnswers(models, key, {
    instructions: CHAT, input, max_output_tokens: 12000,
    text: { format: { type: "json_schema", name: "turn", schema: SCHEMA, strict: true } },
  }, timeoutMs);
  let out; try { out = JSON.parse(text(json)); } catch (e) { throw Object.assign(new Error("GPT's answer wasn't readable; ask again"), { status: 502 }); }
  // back to the app's own shape: drop the nulls, and turn paths into the svg the scene keeps
  out.actions = (out.actions || []).map((a) => {
    const b = Object.fromEntries(Object.entries(a).filter(([, v]) => v !== null));
    if (b.paths) { b.svg = toSVG(b.paths.slice(0, 80)); delete b.paths; }
    return b;
  });
  return { ...out, model };
}

// One drawing from a description (the /api/draw route): a single chat turn, its first drawing.
export async function generateSVG(prompt, opts) {
  const out = await chat([{ role: "user", text: `Draw ${prompt}` }], [], null, opts);
  const d = out.actions.find((a) => a.svg);
  if (!d) throw new Error("GPT did not draw anything");
  return { svg: d.svg, model: out.model };
}

// Speech (gpt-4o-mini-tts), the voice before Gemini's when there is no ElevenLabs key. Returns MP3 bytes.
export async function speak(text, { key, model = "gpt-4o-mini-tts", voice = "coral" }) {
  const res = await fetch(`${BASE}/audio/speech`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, voice, input: text, response_format: "mp3", instructions: "Friendly and brisk, a helpful robot at a demo." }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`GPT voice ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
