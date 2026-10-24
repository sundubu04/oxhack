// Clockedin: talk to a drawing arm. Each simulation is a whiteboard you change by chatting: ask for a drawing, an
// edit, or a game. Every change is planned as the difference from what is already on the board (optimize.js):
// only what changed is wiped and drawn, in the order the sim times as fastest. The sim plays it to scale through
// the servos' limits, and the real arm gets the same commands.
import { toAngles } from "./ik.js";
import { parseSVG } from "./svg.js";
import { plan } from "./pathplan.js";
import { planChange } from "./optimize.js";
import * as voice from "./voice.js";
import * as arm from "./arm.js";
import { SAMPLES, clockSVG } from "./sample.js";
import { loadConfig, saveConfig, geomFrom, withDefaults, servoAngle } from "./config.js";
import { makeJob, Sim, homePose } from "./sim.js";
import { createBoard } from "./board.js";
import { nibHeight } from "./pen.js";
import { emptyScene, sceneStrokes, applyActions, describeGame, cellName, boxMm, sceneSVG, FULL } from "./scene.js";
import { parseCell } from "./games/tictactoe.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const params = new URLSearchParams(location.search);
const now = () => (params.get("at") ? new Date(params.get("at")) : new Date());   // ?at= fixes the clock for screenshots
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ---------- icons (Lucide, from the kit's icons.json) ----------
let ICONS = {};
function icon(name, size = 16) {
  const els = ICONS[name] || [];
  return `<svg class="dl-icon" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${els.map(([t, a]) => `<${t} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("")}</svg>`;
}
function hydrate(root = document) { $$("i[data-icon]", root).forEach((i) => { i.outerHTML = icon(i.dataset.icon); }); }
function setIcon(el, name) { const svg = el.querySelector("svg.dl-icon"); if (svg) svg.outerHTML = icon(name); }

// ---------- formatting ----------
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const whole = (s) => Math.ceil(s - 1e-6);   // a duration is shown rounded up, the same everywhere
const secs = (s) => (s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`);
const mm = (v) => `${Math.round(v).toLocaleString("en-GB")} mm`;
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "now" : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };
const modelName = (m = "") => m.replace(/^gemini-/, "Gemini ").replace(/^gpt-/, "GPT ").replace(/-/g, " ").replace(/\b(flash|pro|lite|image|preview|sol|luna|terra|astra|mini|nano)\b/g, (w) => w[0].toUpperCase() + w.slice(1));
const hhmm = (t) => `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;

// ---------- state ----------
let cfg = withDefaults({}), g = geomFrom(cfg);
let board, sim, setupBoard, setupSim, v3 = null, inkDirty = true;
let services = { openai: { ready: false }, gemini: { ready: false, model: "" }, voice: { provider: "browser" } };
let pageNow = "studio";       // the page on show: "studio" or "arm"
let serverState = "checking";   // "checking" | "up" | "offline": whether /api/status last answered
const S = load("clockedin.prefs", { narrate: false, physics: true, reach: true, voice: "", follow: true });
let sims = [], doc = null;           // the saved simulations, and the open one
let scene = emptyScene();            // what should be on the board
let boardStrokes = [];               // what is on it once the current job finishes (board mm)
let messages = [], thinking = false;
let planned = null;                  // { toolpath, angles, job, res, ink, wiped } for the last change
let active = null, inkBefore = null; // the job the sim is running, and the ink it started on
let playing = false, speed = 1, view = "board", sending = null;
let hooks = [];   // this simulation's repeats: { id, prompt, every (minutes), slot, last, error }

function load(k, d) {
  try { const v = JSON.parse(localStorage.getItem(k) || "null"); if (v == null) return d; return Array.isArray(d) ? (Array.isArray(v) ? v : d) : { ...d, ...v }; }
  catch (e) { return d; }
}
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

function toast(msg, name = "check") {
  const t = document.createElement("div"); t.className = "dl-toast"; t.setAttribute("role", "status");
  t.innerHTML = `${icon(name)}<span>${esc(msg)}</span>`; $("#toasts").append(t); setTimeout(() => t.remove(), 3200);
}

// ---------- state words: one vocabulary, colour only for what needs attention ----------
function status(el, text, { tone = "", mark = "" } = {}) {
  el.textContent = text;
  if (tone) el.dataset.tone = tone; else delete el.dataset.tone;
  if (mark) el.dataset.mark = mark; else delete el.dataset.mark;
}
const planStatus = (text, o) => status($("#plan-status"), text, o);
const steps = {
  reset() { $$("#steps .dl-step").forEach((li) => { li.dataset.state = "next"; li.querySelector(".dl-step__time").textContent = ""; }); this.bar(0); $("#steps").dataset.state = "running"; },
  set(name, state, text) { const li = $(`#steps [data-step="${name}"]`); li.dataset.state = state; if (text != null) li.querySelector(".dl-step__time").textContent = text; },
  fail(name, text) { this.set(name, "now", text); $("#steps").dataset.state = "failed"; },
  bar(p) { $("#steps-fill").style.setProperty("--dl-p", p); },
};

// ---------- simulations: each a board and a conversation, saved by the dev server ----------
async function listSims() {
  try { sims = await fetch("./api/sims").then((r) => r.json()); } catch (e) { sims = []; }
  renderSims();
}
function renderSims() {
  const mine = doc && !sims.some((s) => s.id === doc.id) ? [{ id: doc.id, title: doc.title, updated: doc.updated }] : [];
  // the open one shows its title now, not the one saved last
  $("#sims").innerHTML = [...mine, ...sims].map((s) => (doc && s.id === doc.id ? { ...s, title: doc.title } : s)).map((s) => `<a class="dl-nav__item" href="#studio" data-sim="${esc(s.id)}" title="${esc(s.title)}">${icon("pencil")}<span class="dl-nav__label">${esc(s.title)}</span><span class="dl-nav__count">${ago(s.updated)}</span></a>`).join("");
  markCurrent();
}
// One item in the rail is current: the open simulation while the studio shows it, otherwise the page's own link.
function markCurrent() {
  const row = pageNow === "studio" && doc ? $(`#sims [data-sim="${CSS.escape(doc.id)}"]`) : null;
  $$(".cw-rail [data-page], #sims [data-sim]").forEach((a) => a.removeAttribute("aria-current"));
  (row || $(`.cw-rail [data-page="${pageNow}"]`))?.setAttribute("aria-current", "page");
  row?.scrollIntoView({ block: "nearest" });
}
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
async function newSim({ focus = true } = {}) {
  await leaveSim();
  doc = { id: newId(), title: "New simulation", created: Date.now(), updated: Date.now() };
  await enter({ ...doc, messages: [], scene: emptyScene(), ink: null });
  await saveNow(); listSims(); go("studio"); if (focus) $("#prompt").focus();
}
async function openSim(id) {
  if (doc && id === doc.id) { go("studio"); return; }
  await leaveSim();
  const s = await fetch(`./api/sims/${id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!s) { toast("That simulation couldn't be opened", "circle-alert"); return; }
  await enter(s); renderSims(); go("studio");
}
async function enter(s) {
  doc = { id: s.id, title: s.title || "New simulation", created: s.created || Date.now(), updated: s.updated || Date.now() };
  messages = s.messages || []; scene = s.scene || emptyScene(); hooks = s.hooks || [];
  pause(); active = null; planned = null; inkBefore = null;
  await board.setInk(s.ink); inkDirty = true;
  boardStrokes = sceneStrokes(scene, g);
  sim.reset();
  renderTitle(); renderThread(); renderHooks(); renderPicture(); renderAngles(); renderPlanEmpty();
  $("#empty").hidden = !!(scene.items.length || scene.game);
  syncTransport(); syncLive(true); draw(); try { localStorage.setItem("clockedin.open", doc.id); } catch (e) {}
}
// before leaving a simulation, finish what is drawing and keep the board as it ends
async function leaveSim() { if (!doc) return; finishJob(); clearTimeout(saveTimer); await saveNow(); }
let saveTimer = 0;
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 700); }
async function saveNow() {
  if (!doc) return;
  doc.updated = Date.now();
  // the ink as it will be when the job ends, so a reopened simulation shows the finished board
  const ink = active && !sim.done ? null : board.inkURL();
  const body = { ...doc, messages, scene, hooks, ...(ink ? { ink } : { ink: doc.ink || null }) };
  if (ink) doc.ink = ink;
  // read the reply too: an unread response keeps the request open in the browser
  try { await fetch(`./api/sims/${doc.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.text()); } catch (e) {}
  const row = sims.find((s) => s.id === doc.id); if (row) { row.title = doc.title; row.updated = doc.updated; } else sims.unshift({ id: doc.id, title: doc.title, updated: doc.updated });
  renderSims();
}
function renderTitle() {
  $("#title").textContent = doc?.title || "New simulation"; $("#title").title = doc?.title || "";
  const n = scene.items.length + (scene.game ? 1 : 0);
  $("#subtitle").textContent = n ? (scene.game ? `Noughts and crosses${scene.items.length ? ` and ${scene.items.length} ${scene.items.length === 1 ? "drawing" : "drawings"}` : ""}` : `${n} ${n === 1 ? "drawing" : "drawings"} on the board`) : "The board is empty";
}

// ---------- the chat ----------
const STARTERS = ["Draw the time", "Write a to-do list", "Play noughts and crosses", "Draw the Oxford logo"];
function renderThread() {
  const t = $("#thread");
  if (!messages.length && !thinking) {
    t.innerHTML = `<div class="cw-hello"><p class="dl-msg dl-msg--assistant">Ask me to draw something, change what's on the board, or play a game.</p><div class="cw-starters">${STARTERS.map((s) => `<button class="dl-chip" type="button" data-say="${esc(s)}">${esc(s)}</button>`).join("")}</div></div>`;
    return;
  }
  t.innerHTML = messages.map((m) => m.role === "user"
    ? `<p class="dl-msg dl-msg--user">${esc(m.text)}</p>`
    : `<div class="dl-msg dl-msg--assistant"><p class="${m.error ? "cw-msg-fail" : ""}">${m.error ? icon("circle-alert") + " " : ""}${esc(m.text)}</p>${m.note ? `<p class="dl-msg__note">${esc(m.note)}</p>` : ""}${m.error && m.retry ? `<div class="dl-msg__actions"><button class="dl-btn dl-btn--secondary dl-btn--sm" type="button" data-retry>Try again</button></div>` : ""}${m.offer === "keep-time" && !clockHook() ? `<div class="dl-msg__actions"><button class="dl-btn dl-btn--secondary dl-btn--sm" type="button" data-keep-time>${icon("refresh-cw")}Keep it on time</button></div>` : ""}</div>`).join("")
    + (thinking ? `<p class="dl-msg dl-msg--assistant cw-thinking"><span class="dl-spinner" aria-hidden="true"></span>Drawing it up</p>` : "");
  t.scrollTop = t.scrollHeight;
}

// What the app does itself, without asking a model: clearing, the time, the samples, and the game.
function localTurn(text) {
  const t = text.toLowerCase().replace(/[.!?]+$/, "").trim();
  if (/^(please )?(clear|wipe|erase|rub out|clean)( (it|everything|all|the board|board|it all))*$/.test(t)) return { reply: "Wiping the board.", actions: [{ type: "clear" }] };
  if (/^(draw |show )?(me )?(the )?(time|clock)( now)?$/.test(t) || /what time is it/.test(t)) {
    const has = scene.items.some((i) => i.id === "clock");
    const others = scene.items.some((i) => i.id !== "clock");
    return { reply: `Drawing the time: ${hhmm(now())}.`, actions: [{ type: has ? "edit" : "draw", id: "clock", name: "clock", box: others ? undefined : FULL, svg: clockSVG(now()) }] };
  }
  const sm = t.match(/^(draw |show )?(me )?(a |an |the )?(cat|house|star|flower)$/);
  if (sm) return { reply: `Drawing a ${sm[4]}.`, actions: [{ type: "draw", id: sm[4], name: sm[4], svg: SAMPLES[sm[4]] }] };
  if (/(tic.?tac.?toe|noughts and crosses|naughts and crosses)/.test(t)) return { reply: "Noughts and crosses.", actions: [{ type: "game", game: "tictactoe", first: /\b(you|robot) (go |start )?first\b/.test(t) ? "robot" : "person" }] };
  const listed = listTurn(t);
  if (listed) return listed;
  if (scene.game) {
    if (/\b(again|new game|restart|rematch|another)\b/.test(t)) return { reply: "New game.", actions: [{ type: "game", game: "tictactoe" }] };
    const c = parseCell(t); if (c >= 0 && t.split(/\s+/).length <= 6) return { reply: "", actions: [{ type: "move", cell: c }] };
  }
  return null;
}

// Ticking off and adding to a list on the board, without a model: "tick off the first one", "check milk",
// "add call mum to the list". Anything it can't place goes to the model as usual.
const ORDINAL = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
function listTurn(t) {
  const list = [...scene.items].reverse().find((i) => i.write?.lines.some((l) => l.check));
  if (!list) return null;
  const lines = list.write.lines.map((l) => ({ ...l }));
  const write = (reply) => ({ reply, actions: [{ type: "write", id: list.id, lines }] });
  const add = t.match(/^(?:please )?(?:add|put|write)\s+["“']?(.+?)["”']?\s+(?:to|on|onto)\s+(?:the|my|this|your)\s+(?:to-?do\s+|todo\s+|shopping\s+)?list$/);
  if (add) { const text = cap(add[1]); lines.push({ text, check: "open" }); return write(`Adding "${text}".`); }
  const m = t.match(/^(?:please )?(tick|check|cross|mark|untick|uncheck)(?:\s+off)?\s+(.+?)(?:\s+(?:as\s+)?(?:done|off|complete|completed))?$/);
  if (!m) return null;
  const done = !/^un/.test(m[1]);
  const what = m[2].replace(/^(the|number|item|#|no\.?)\s*/g, "").replace(/\s+(one|item|line|thing)$/, "").replace(/["“”']/g, "").trim();
  let k = /^\d+$/.test(what) ? +what - 1 : ORDINAL[what] ? ORDINAL[what] - 1 : what === "last" ? lines.length - 1 : -1;
  if (k < 0) k = lines.findIndex((l) => l.text.toLowerCase().includes(what) || (what.length > 3 && what.includes(l.text.toLowerCase())));
  if (k < 0 || k >= lines.length || !lines[k].check) return null;
  lines[k].check = done ? "done" : "open";
  return write(done ? `Ticking off "${lines[k].text}".` : `Unticking "${lines[k].text}".`);
}

let lastAsk = "";
// A turn: the person's words, or a repeat's prompt when `hook` is given -> a reply and a change to the board.
// A repeat's turn adds nothing to the chat when the app does it itself (the clock); a model's reply is shown.
async function send(text, hook = null) {
  text = (text || "").trim();
  if (!text || thinking) return;
  if (!doc) await newSim({ focus: false });
  if (!hook) {
    messages.push({ role: "user", text }); lastAsk = text;
    if (doc.title === "New simulation") { doc.title = cap(text).slice(0, 48); renderTitle(); renderSims(); }
    $("#prompt").value = ""; autosize(); selectTab("chat");
    const r = repeatTurn(text);
    if (r) { messages.push({ role: "assistant", text: r.said }); renderThread(); renderHooks(); saveSoon(); if (r.hook) await runHook(r.hook); return; }
  }
  let reply = "", actions = [], note = "", t0 = performance.now();
  const local = localTurn(text);
  steps.reset(); steps.set("picture", "now", local ? "on the arm" : services.openai?.ready ? "asking GPT" : "asking Gemini"); planStatus("Working", { mark: "ring" });
  if (local) ({ reply, actions } = local);
  else {
    thinking = true; renderThread(); busy(true);
    try {
      const said = messages.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
      const r = await fetch("./api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        messages: hook ? [...said, { role: "user", text }] : said,
        board: scene.items.map(({ id, name, box, svg, texts, write }) => (write ? { id, name, box, write: { title: write.title, lines: write.lines, align: write.align } } : { id, name, box, svg, texts })),
        game: describeGame(scene.game),
      }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `The server answered ${r.status}`);
      reply = j.reply; actions = j.actions || []; note = `${modelName(j.model)}, ${(j.ms / 1000).toFixed(1)} s`;
    } catch (e) {
      thinking = false; busy(false);
      // a repeat that fails says so in its own row, not in the chat, and tries again at its next time
      if (hook) { hook.error = friendly(e.message); renderHooks(); renderThread(); }
      else { messages.push({ role: "assistant", text: friendly(e.message), error: true, retry: true }); renderThread(); }
      steps.fail("picture", "failed"); planStatus("Failed", { tone: "stop" }); saveSoon(); return;
    }
    thinking = false; busy(false);
  }
  steps.set("picture", "done", note || "on the arm");
  // the model asks for a repeat as an action: start it, and do the rest of the turn now
  if (!hook) actions.filter((a) => a.type === "repeat" && a.prompt).forEach((a) => addHook(a.prompt, a.every));
  const { scene: next, notes } = applyActions(scene, actions.filter((a) => a.type !== "repeat"));
  const said = [reply, ...notes].filter(Boolean).join(" ") || "Done.";
  const summary = change(next);
  if (hook) {
    hook.last = Date.now(); hook.error = null; renderHooks();
    if (!local) messages.push({ role: "assistant", text: said, note: [`Repeat, every ${everyWords(hook.every)}`, summary, note].filter(Boolean).join(" · ") });
  } else {
    const clock = local && actions.some((a) => a.id === "clock");
    messages.push({ role: "assistant", text: said, note: [summary, note].filter(Boolean).join(" · "), ...(clock ? { offer: "keep-time" } : {}) });
  }
  renderThread(); saveSoon();
  if (S.narrate && !(hook && local)) voice.say(said, { voice: S.voice || undefined });
}

// ---------- repeats: a request run again on a schedule while the simulation is open ("hooks") ----------
// The clock is the usual one: "draw the time" every minute, done by the app itself, so the hands follow the time
// and only the hands that moved are wiped and redrawn. Anything else is asked of the model each time.
const NUMBER = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30 };
const everyWords = (n) => (n === 1 ? "minute" : n === 60 ? "hour" : n % 60 === 0 ? `${n / 60} hours` : `${n} minutes`);
const isClock = (p) => /^(draw |show )?(me )?(the )?(time|clock)( now)?$/i.test(p.trim());
const clockHook = () => hooks.find((h) => isClock(h.prompt));
// "every 10 minutes draw a cat", "keep the clock on time", "stop repeating" -> { said, hook? }, or null for a normal turn
function repeatTurn(text) {
  const t = text.toLowerCase().replace(/[.!?]+$/, "").trim();
  if (/^(stop|cancel|end|turn off|switch off|pause)\b/.test(t) && (/\b(repeat\w*|updat\w*|refresh\w*|clock|time|hooks?|automation\w*|that|it|all|everything)\b/.test(t) || t === "stop")) {
    if (!hooks.length) return { said: "Nothing is repeating." };
    const n = hooks.length; hooks = [];
    return { said: n === 1 ? "Stopped the repeat." : `Stopped all ${n} repeats.` };
  }
  const m = text.match(/\b(?:every|each)\s+(?:(\d+|an?|one|two|three|four|five|ten|fifteen|twenty|thirty)\s+)?(sec\w*|min\w*|hours?|hrs?)\b|\bhourly\b/i);
  const keepClock = /\b(clock|time)\b/.test(t) && /\b(keep|kept|auto\W?updat\w*|updat\w*|refresh\w*|right|correct|on time|up to date|ticking|live|current|follow\w*)\b/.test(t);
  if (!m && !keepClock) return null;
  let every = 1;
  if (m) {
    const n = m[1] ? NUMBER[m[1].toLowerCase()] ?? parseInt(m[1], 10) : 1, unit = (m[2] || "hour").toLowerCase();
    every = unit.startsWith("h") ? n * 60 : unit.startsWith("s") ? 1 : Math.max(1, n);
  }
  let prompt = keepClock ? "draw the time" : text.replace(m[0], " ").replace(/\s+/g, " ").replace(/^(please |can you |could you |and |then |so )+/i, "").replace(/\s(and|then)$/i, "").trim();
  // "do that every minute": the request before this one
  if (!prompt || /^(do |draw |repeat )?(that|this|it)( again)?$/i.test(prompt)) prompt = messages.filter((x) => x.role === "user").at(-2)?.text || "";
  if (!prompt) return { said: 'Say what to repeat, for example "draw the time every minute".' };
  const hook = addHook(prompt, every);
  return { hook, said: isClock(prompt) ? `I'll keep the clock on time: it changes every ${everyWords(every)} while this simulation is open.` : `I'll ${prompt.replace(/^please /i, "").replace(/^\w/, (c) => c.toLowerCase())} every ${everyWords(every)} while this simulation is open.` };
}
function addHook(prompt, every = 1) {
  every = Math.max(1, Math.round(Number(every) || 1));
  let h = hooks.find((x) => x.prompt.toLowerCase() === prompt.toLowerCase() || (isClock(x.prompt) && isClock(prompt)));
  if (!h) { h = { id: newId(), prompt, every }; hooks.push(h); }
  h.every = every; h.slot = null; h.error = null;
  renderHooks(); saveSoon(); return h;
}
function removeHook(id) { hooks = hooks.filter((h) => h.id !== id); renderHooks(); renderThread(); saveSoon(); }
// which run a repeat is due for: whole periods of local time, so "every minute" turns over on the minute
const slotOf = (h) => { const t = now(); return Math.floor((t.getTime() / 60000 - t.getTimezoneOffset()) / h.every); };
function runHook(h) { h.slot = slotOf(h); return send(h.prompt, h); }
setInterval(() => {
  if (!doc || thinking || playing || !hooks.length) return;
  const due = hooks.find((h) => h.slot !== slotOf(h));
  if (due) runHook(due);
}, 1000);
function renderHooks() {
  const el = $("#repeats"); el.hidden = !hooks.length;
  el.innerHTML = hooks.map((h) => `<div class="cw-repeat">${icon(isClock(h.prompt) ? "clock" : "refresh-cw")}<div class="cw-repeat__text"><span class="cw-repeat__what">${esc(isClock(h.prompt) ? "Keep the clock on time" : cap(h.prompt))}</span>`
    + `<span class="cw-repeat__when${h.error ? " cw-msg-fail" : ""}">${h.error ? esc(h.error) : `Every ${everyWords(h.every)}${h.last ? `, last at ${hhmm(new Date(h.last))}` : ""}`}</span></div>`
    + `<button class="dl-icon-btn" type="button" data-unhook="${esc(h.id)}" aria-label="Stop: ${esc(h.prompt)}" title="Stop">${icon("x")}</button></div>`).join("");
}

function friendly(msg) {
  // the browser's own words when the request never reached the server (stopped, or restarting)
  if (/failed to fetch|networkerror|load failed/i.test(msg)) { refreshStatus(); return "Can't reach the Clockedin server. Start it with node server.mjs in app/, then try again."; }
  if (/503|high demand|overloaded|took over|resting/i.test(msg)) return "The drawing model is busy right now. Try again in a moment.";
  if (/quota/i.test(msg)) return msg.replace(/^(Gemini|GPT) \d+: /, "");
  return msg;
}
function busy(on) { const b = $("#draw"); b.setAttribute("aria-busy", String(on)); b.disabled = on; $("#ask").setAttribute("aria-busy", String(on)); }
function autosize() { const t = $("#prompt"); t.style.height = "auto"; t.style.height = `${Math.min(132, t.scrollHeight)}px`; }

// ---------- a change: from what is on the board to the next scene ----------
// The planner picks what to keep, wipe and draw; the sim plays it from the arm's pose now, on top of the board's ink.
function change(next) {
  finishJob();
  const t0 = performance.now();
  const nextStrokes = sceneStrokes(next, g);
  const from = sim.tip("draw");
  const res = planChange(boardStrokes, nextStrokes, g, { from });
  scene = next; boardStrokes = nextStrokes;
  renderTitle(); renderPicture();
  $("#empty").hidden = !!(scene.items.length || scene.game);
  const tp = res.best.toolpath;
  if (!tp.length) { steps.set("path", "done", "nothing to change"); planStatus("Ready", { mark: "dot" }); return "Nothing on the board needs to change."; }
  const angles = toAngles(tp, g), job = makeJob(tp, angles, g);
  const lenOf = (S) => S.reduce((d, s) => d + s.reduce((a, p, i) => a + (i ? Math.hypot(p.x - s[i - 1].x, p.y - s[i - 1].y) : 0), 0), 0);
  planned = { toolpath: tp, angles, job, res, ink: lenOf(res.add), wiped: lenOf(res.remove) };
  steps.set("path", "done", `${res.best.name === "none" ? "" : `${res.best.name} wipe, `}${(performance.now() - t0).toFixed(0)} ms`);
  steps.set("angles", "done", `${tp.length} points`); steps.set("sim", "next", ""); steps.bar(0.75);
  renderAngles(); renderPlanStats(); startJob(job); play();
  if (arm.connected() && S.follow) sendToArm(job);
  const parts = [];
  if (res.remove.length) parts.push(`wipes ${res.remove.length} ${res.remove.length === 1 ? "stroke" : "strokes"}`);
  if (res.add.length) parts.push(`draws ${res.add.length}`);
  if (res.keep.length && (res.remove.length || res.add.length)) parts.push(`keeps ${res.keep.length}`);
  return `${cap(parts.join(", "))}, ${secs(whole(job.total))}`;
}
// geometry changed: draw the whole scene again, from a clean board
function replan() { board.clearInk(); boardStrokes = []; sim.reset(); const s = scene; scene = emptyScene(); if (s.items.length || s.game) change(s); else draw(); }

// ---------- the sim ----------
const onInk = (a, b, mode) => { board.inkSeg(a, b, mode); inkDirty = true; };
function startJob(job) {
  pause();
  active = job; inkBefore = board.snapshot(); sim.load(job); sim.physics = S.physics;
  syncTransport(); draw();
}
// run what is left of the job at once, so the board matches what was planned
function finishJob() { if (active && !sim.done) { pause(); sim.advance(active.total - sim.t + 0.05, onInk); syncTransport(); draw(); } }
function play() {
  if (!active) return;
  if (sim.done) seek(0);
  playing = true; sim.manual = null;
  $("#play").setAttribute("aria-label", "Pause"); $("#play").title = "Pause"; setIcon($("#play"), "pause");
  steps.set("sim", "now"); $("#steps").dataset.state = "running";
  kick();
}
function pause() {
  playing = false;
  $("#play").setAttribute("aria-label", "Play"); $("#play").title = "Play"; setIcon($("#play"), "play");
  showPaused();
}
function showPaused() {
  if (!active || !planned || sim.done || !$("#steps")) return;
  if (sim.t > 0) { steps.set("sim", "now", `paused at ${clock(sim.t)}`); $("#steps").dataset.state = "stopped"; }
  else { steps.set("sim", "next", ""); $("#steps").dataset.state = "ready"; }
}
// replay the job from its start, on the ink it started on
function seek(t) {
  if (!active) return;
  board.restore(inkBefore); sim.reset(); sim.load(active); sim.physics = S.physics; inkDirty = true;
  sim.advance(Math.max(0, Math.min(t, active.total)), onInk);
  syncTransport(); draw(); if (!playing) showPaused();
}
function finished() {
  pause();
  steps.set("sim", "done", sim.dev.n ? `${(sim.dev.sum / sim.dev.n).toFixed(1)} mm off on average` : "done");
  $("#steps").dataset.state = "ready"; steps.bar(1);
  planned && (planned.seen = true); syncSend(); saveSoon();
}

let raf = 0, lastTs = 0;
function kick() { if (!raf) { lastTs = performance.now(); raf = requestAnimationFrame(frame); } }
function frame(ts) {
  raf = 0;
  const dt = Math.min(0.1, (ts - lastTs) / 1000); lastTs = ts;
  let moving = false;
  if (playing && active) { sim.advance(dt * speed, onInk); moving = true; if (sim.done) finished(); }
  else if (settling(sim)) { sim.advance(dt, onInk, true); moving = true; }
  draw(); syncLive();
  if (moving || playing) kick();
}
function settling(s) { const t = s.target(); return Math.abs(t.base - s.j.base) + Math.abs(t.elbow - s.j.elbow) + Math.abs(t.tilt - s.j.tilt) > (S.physics ? g.servo.resolution * 0.5 + 0.05 : 0.01); }

let hover = null;
function draw() {
  if (view === "3d") { draw3d(); return; }
  board.render({
    toolpath: active?.toolpath, joints: sim.j, mode: sim.mode(), showReach: S.reach, hover,
    unreachable: planned ? planned.toolpath.filter((_, i) => planned.angles.path[i].out_of_reach) : null,
  });
}

// ---------- live readouts ----------
const JOINTS = [["base", "Base"], ["elbow", "Elbow"], ["tilt", "Tilt"]];
function buildJoints() {
  $("#joints").innerHTML = JOINTS.map(([k, n]) => `<span>${n}</span><b class="dl-num" id="j-${k}">0.0°</b><div class="dl-meter" role="meter" id="m-${k}" aria-label="${n} servo position"></div>`).join("");
}
let lastLive = 0, lastRow = -1;
function syncLive(force) {
  const t = performance.now(); if (!force && t - lastLive < 50) return; lastLive = t;
  for (const [k] of JOINTS) {
    const v = sim.j[k], s = g.servo[k], sv = servoAngle(k, v, g), p = (sv - s.min) / (s.max - s.min || 1);
    $(`#j-${k}`).textContent = `${v.toFixed(1)}°`;
    const m = $(`#m-${k}`); m.style.setProperty("--dl-p", Math.max(0, Math.min(1, p)).toFixed(3));
    m.setAttribute("aria-valuemin", s.min); m.setAttribute("aria-valuemax", s.max); m.setAttribute("aria-valuenow", sv.toFixed(1));
    m.setAttribute("aria-valuetext", `${sv.toFixed(0)}° of ${s.min}° to ${s.max}°`);
    m.dataset.tone = p < 0.02 || p > 0.98 ? "warn" : "";
  }
  const mode = sim.mode(), ps = $("#pen-status");
  if (playing) status(ps, mode === "draw" ? "Drawing" : mode === "erase" ? "Erasing" : "Moving, pen up", { mark: mode === "draw" ? "dot" : mode === "erase" ? "ring" : "" });
  else if (!active || sim.t === 0) status(ps, sim.manual ? "Moved by hand" : "Parked");
  else status(ps, sim.done ? "Done" : "Paused", { mark: sim.done ? "dot" : "" });
  if (planned && active === planned.job) $("#st-err").textContent = `${sim.dev.max.toFixed(1)} mm`;
  syncTransport();
  if (view === "angles" && active === planned?.job && sim.i !== lastRow) {
    $(`#angles tr[data-i="${lastRow}"]`)?.removeAttribute("data-current");
    const row = $(`#angles tr[data-i="${sim.i}"]`); if (row) { row.setAttribute("data-current", ""); if (playing) row.scrollIntoView({ block: "nearest" }); }
    lastRow = sim.i;
  }
  if (playing) steps.set("sim", "now", `${clock(sim.t)} of ${clock(whole(active.total))}`);
}
function syncTransport() {
  const total = active?.total || 0;
  $("#time").textContent = `${clock(sim?.t || 0)} / ${clock(whole(total))}`;
  if (document.activeElement !== $("#scrub")) $("#scrub").value = total ? Math.round((sim.t / total) * 1000) : 0;
  ["#play", "#rewind", "#scrub"].forEach((s) => { $(s).disabled = !active; });
}

function renderPlanEmpty() {
  $("#stats").hidden = true; $("#stats-skel").hidden = true; $("#m-answer").hidden = true;
  planStatus("Nothing yet");
  $$("#steps .dl-step").forEach((li) => { li.dataset.state = "next"; li.querySelector(".dl-step__time").textContent = ""; }); steps.bar(0);
  ["#download", "#copy"].forEach((s) => { $(s).disabled = true; }); syncSend();
}
function renderPlanStats() {
  const { angles, job, res } = planned;
  $("#st-time").textContent = secs(whole(job.total));
  $("#st-ink").textContent = mm(planned.ink);
  $("#st-travel").textContent = mm(planned.wiped);
  $("#st-err").textContent = "0.0 mm";
  $("#stats").hidden = false; $("#stats-skel").hidden = true;
  const rs = $("#reach-status");
  if (angles.unreachable) status(rs, `${angles.unreachable} points out of reach`, { tone: "stop" });
  else if (angles.outOfRange) status(rs, `${angles.outOfRange} points past servo limits`, { tone: "warn" });
  else status(rs, "All in reach", { mark: "dot" });
  $("#m-answer").textContent = `${secs(whole(job.total))} to finish, ${rs.textContent.charAt(0).toLowerCase() + rs.textContent.slice(1)}`; $("#m-answer").hidden = false;
  planStatus("Ready", { mark: "dot" });
  ["#download", "#copy"].forEach((s) => { $(s).disabled = false; }); syncSend();
}

function renderPicture() {
  const el = $("#picture");
  if (!scene.items.length && !scene.game) { el.innerHTML = `<div class="dl-empty"><span class="dl-empty__title">Nothing on the board</span><span>Ask for a drawing in the chat.</span></div>`; return; }
  // an <img> never runs anything inside a model's SVG
  el.innerHTML = `<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(sceneSVG(scene, g))}" alt="What should be on the board">`;
}

function renderAngles() {
  const el = $("#angles");
  if (!planned) { el.innerHTML = `<div class="dl-empty"><span class="dl-empty__title">No angles yet</span><span>They appear once a change is planned.</span></div>`; return; }
  const tp = planned.toolpath, path = planned.angles.path, T = planned.job.tTilt;
  const rows = tp.map((p, i) => {
    const a = path[i], tool = p.tool || (p.pen ? "draw" : "lift");
    return a.out_of_reach
      ? `<tr data-i="${i}"><td class="dl-num">${i + 1}</td><td class="dl-num">${T[i].toFixed(2)}</td><td class="dl-num">${p.x.toFixed(1)}</td><td class="dl-num">${p.y.toFixed(1)}</td><td><span class="dl-status" data-tone="stop">Out of reach</span></td><td></td><td></td><td></td></tr>`
      : `<tr data-i="${i}"><td class="dl-num">${i + 1}</td><td class="dl-num">${T[i].toFixed(2)}</td><td class="dl-num">${p.x.toFixed(1)}</td><td class="dl-num">${p.y.toFixed(1)}</td><td>${tool === "draw" ? "Draw" : tool === "erase" ? "Erase" : "Lift"}</td><td class="dl-num">${a.base.toFixed(2)}°</td><td class="dl-num">${a.elbow.toFixed(2)}°</td><td class="dl-num">${a.tilt.toFixed(1)}°</td></tr>`;
  }).join("");
  el.innerHTML = `<table class="dl-table"><thead><tr><th>#</th><th>Time s</th><th>x mm</th><th>y mm</th><th>Pen</th><th>Base</th><th>Elbow</th><th>Tilt</th></tr></thead><tbody>${rows}</tbody></table>`;
  lastRow = -1;
}

// ---------- 3D: the arm and the pen's tilt, to orbit round ----------
async function open3d() {
  if (!v3) {
    try { const { createView3d } = await import("./view3d.js"); v3 = createView3d($("#view3d"), board.ink); v3.setGeom(g, cfg.pen); }
    catch (e) { toast(`The 3D view needs WebGL: ${e.message}`, "circle-alert"); setView("board"); return; }
  }
  v3.show(true); inkDirty = true; draw3d();
}
function draw3d() {
  if (!v3) return;
  v3.update(sim.j, inkDirty); inkDirty = false;
  const pg = g.pen, mode = sim.mode(), end = mode === "erase" ? "eraser" : "nib";
  const hNib = mode === "erase" ? nibHeight(pg, -sim.j.tilt) : nibHeight(pg, sim.j.tilt);
  $("#read3d").textContent = `Tilt ${sim.j.tilt.toFixed(0)}° from flat · ${end} ${hNib <= 0.5 ? "on the board" : `${hNib.toFixed(1)} mm off the board`} · shaft ${pg.height.toFixed(0)} mm up · pen meets the board at ${pg.beta.toFixed(0)}°`;
}
function setView(v) {
  view = v;
  $$("#views button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v)));
  $("#board").hidden = v !== "board"; $("#picture").hidden = v !== "picture"; $("#angles").hidden = v !== "angles";
  $("#view3d").hidden = v !== "3d"; v3?.show(v === "3d");
  if (v === "3d") open3d();
  if (v === "board") draw();
  if (v === "angles") { lastRow = -1; syncLive(true); }
}
function selectTab(which) {
  for (const t of ["chat", "plan"]) {
    const on = t === which; $(`#tab-${t}`).setAttribute("aria-selected", String(on)); $(`#tab-${t}`).tabIndex = on ? 0 : -1; $(`#panel-${t}`).hidden = !on;
  }
}


// ---------- arm ----------
function setArm(on) {
  status($("#arm-status"), on ? (arm.version() >= 2 ? "Connected" : "Connected, simple mode") : "Not connected", { mark: on ? "dot" : "" });
  syncSend(); renderServices();
}
function syncSend() {
  const b = $("#send"), on = arm.connected();
  if (sending) return;
  setIcon(b, on ? "send" : "usb"); b.querySelector("span").textContent = on ? "Send to arm" : "Connect arm";
  b.disabled = on && !active;
  const next = !!planned?.seen;
  b.classList.toggle("dl-btn--primary", next); b.classList.toggle("dl-btn--secondary", !next);
}
async function connectArm() {
  try { await arm.connect(); setArm(true); toast(arm.version() >= 2 ? "Arm connected" : "Arm connected, but it didn't answer as Clockedin firmware"); arm.jog(homePose(g), g); }
  catch (e) { if (e.name !== "NotFoundError") toast(e.message, "circle-alert"); }
}
// the arm runs exactly the job the sim is running
async function sendToArm(job = active) {
  if (!job) return;
  if (!arm.connected()) { await connectArm(); if (!arm.connected()) return; }
  if (sending) sending.abort();
  const b = $("#send"), label = b.querySelector("span"); b.setAttribute("aria-busy", "true");
  const ctl = new AbortController(); sending = ctl;
  setIcon(b, "x"); label.textContent = "Stop the arm";
  try {
    speed = 1; $$("#speed button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.speed === "1")));
    if (job === active) { seek(0); play(); }
    await arm.send(job, g, { signal: ctl.signal });
    if (sending === ctl) toast(ctl.signal.aborted ? "Arm stopped" : "The arm has finished");
  } catch (e) { toast(e.message, "circle-alert"); }
  finally { if (sending === ctl) { sending = null; b.removeAttribute("aria-busy"); syncSend(); syncLive(true); } }
}
function stream() {
  const { angles, job } = planned;
  return {
    arm: cfg.name, measured: cfg.measured, links_mm: cfg.links, board_mm: cfg.board, pen: cfg.pen, servos: cfg.servos,
    simulation: doc?.title, duration_s: +job.total.toFixed(2), out_of_reach: angles.unreachable, past_servo_limits: angles.outOfRange,
    protocol: "one line per waypoint at its send time t: base,elbow,tilt,pressure; SKIP when out of reach; HOME at the end",
    path: angles.path.map((a, i) => ({ t: +job.tTilt[i].toFixed(3), ...a })),
    keyframes: arm.keyframes(job, g),
  };
}

function renderServices() {
  const vp = services.voice.provider;
  const voiceWord = { elevenlabs: "ElevenLabs", openai: "GPT voice", gemini: "Gemini voice", browser: "Browser voice" }[vp];
  const until = (t) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  // one provider's state: models it tries, the ones resting and why; "out" when every model is out of quota
  const state = (p) => {
    const cool = p?.cooling || [], models = (p?.models || []).map((m) => m.split(":")[0]);
    const out = !models.some((m) => !cool.some((c) => c.model === m && c.why === "quota"));
    const resting = cool.map((c) => `${modelName(c.model)} ${c.why === "quota" ? "out of quota" : c.why === "slow" ? "too slow, skipped" : "busy, skipped"} until ${until(c.until)}`);
    return { ready: !!p?.ready, out, line: `Tries ${models.map(modelName).join(", then ")}${resting.length ? `; ${resting.join(", ")}` : ""}` };
  };
  const gp = state(services.openai), gm = state(services.gemini), gptOn = gp.ready && !gp.out;
  // before the first answer, or when the server stops answering, the keys are unknown: don't say "No key"
  const status = (s, { backup } = {}) =>
    serverState === "checking" ? '<span class="dl-status" data-mark="ring">Checking</span>'
    : serverState === "offline" ? '<span class="dl-status" data-tone="stop">Server offline</span>'
    : !s.ready ? '<span class="dl-status" data-mark="dash">No key</span>'
    : s.out ? '<span class="dl-status" data-tone="warn">Out of quota</span>'
    : backup ? '<span class="dl-status" data-mark="ring">Backup</span>' : '<span class="dl-status" data-mark="dot">Ready</span>';
  $("#services").innerHTML =
    `<div class="cw-service"><span>GPT</span>${status(gp)}</div>` +
    `<div class="cw-service"><span>Gemini</span>${status(gm, { backup: gptOn })}</div>` +
    `<div class="cw-service"><span>Voice</span><span>${voiceWord}</span></div>`;
  const line = (s, key) => serverState === "offline" ? "Can't reach the Clockedin server: run node server.mjs in app/"
    : serverState === "checking" ? "Asking the server" : !s.ready ? `No key: add ${key} to app/.env` : s.line;
  $("#service-kv").innerHTML =
    `<dt>GPT</dt><dd>${line(gp, "OPENAI_API_KEY")}</dd>` +
    `<dt>Gemini</dt><dd>${gptOn ? "Used when every GPT model fails. " : ""}${line(gm, "GEMINI_API_KEY")}</dd>` +
    `<dt>Voice</dt><dd>${vp === "elevenlabs" ? "ElevenLabs" : `${voiceWord}, until an ElevenLabs key is added`}</dd>` +
    `<dt><label for="voice-id">ElevenLabs voice</label></dt><dd class="cw-voice"><input class="dl-input dl-mono" id="voice-id" placeholder="${esc(services.voice.voice || "")}" spellcheck="false"><button class="dl-btn dl-btn--secondary dl-btn--sm" type="button" id="voice-test">${icon("volume-2")}Hear it</button></dd>` +
    `<dt>Arm</dt><dd>${arm.connected() ? "Connected over USB" : "Not connected"}</dd>`;
  $("#voice-id").value = S.voice || "";
}
function refreshStatus() { fetch("./api/status").then((r) => r.json()).then((s) => { services = s; serverState = "up"; renderServices(); }).catch(() => { serverState = "offline"; renderServices(); }); }

// ---------- pages ----------
function go(page) {
  if (location.hash !== `#${page}`) history.replaceState(null, "", `#${page}`);
  showPage(page);
}
function showPage(page) {
  page = pageNow = page === "arm" ? "arm" : "studio";
  $("#page-studio").hidden = page !== "studio"; $("#page-arm").hidden = page !== "arm";
  markCurrent();
  $("#app").removeAttribute("data-nav-open");
  if (page === "arm") { fillSetup(cfg); requestAnimationFrame(renderSetup); }
  else requestAnimationFrame(draw);
}

// ---------- arm setup ----------
const FIELDS = [
  ["Links", [["links.L1", "Upper link", "mm"], ["links.L2", "Forearm", "mm"]]],
  ["Board", [["board.width", "Width", "mm"], ["board.height", "Height", "mm"], ["board.standoff", "Base below board", "mm"], ["drawing.size", "Drawing size", "mm"]]],
  ["Pen", [["pen.length", "Length, nib to eraser", "mm"], ["pen.barrel", "Barrel width", "mm"], ["pen.nib", "Nib sticks out", "mm"], ["pen.angle", "Meets the board at (0 = best)", "°"], ["pen.margin", "Barrel kept off the board", "mm"], ["pen.press", "Press in", "mm"], ["pen.lift", "Lift clear", "mm"], ["pen.eraserWidth", "Eraser width", "mm"]]],
  ["Motion", [["motion.drawSpeed", "Draw speed", "mm/s"], ["motion.travelSpeed", "Travel speed", "mm/s"], ["motion.leadIn", "Lead-in", "mm"], ["servos.speed", "Servo speed", "°/s"]]],
  ["Smoothing", [["servos.resolution", "Dead band", "°"], ["servos.backlash", "Gear play", "°"]]],
];
const get = (o, path) => path.split(".").reduce((a, k) => a?.[k], o);
const put = (o, path, v) => { const ks = path.split("."); let a = o; ks.slice(0, -1).forEach((k) => { a = a[k] ??= {}; }); a[ks.at(-1)] = v; };
function buildSetup() {
  const id = (p) => `f-${p.replace(/\./g, "-")}`;
  $("#setup").innerHTML = FIELDS.map(([legend, fs]) => `<div class="cw-group" role="group" aria-labelledby="g-${legend}"><h2 class="dl-kicker" id="g-${legend}">${legend}</h2><div class="cw-fields">${fs.map(([p, label, unit]) =>
    `<div class="dl-field"><label class="dl-label" for="${id(p)}">${label}</label><span class="cw-unit"><input class="dl-input dl-num" id="${id(p)}" data-path="${p}" type="number" step="any" inputmode="decimal"><span>${unit}</span></span></div>`).join("")}</div></div>`).join("") +
    `<div class="cw-group" role="group" aria-labelledby="g-servos"><h2 class="dl-kicker" id="g-servos">Servos</h2><div class="cw-fields">
      <div class="dl-field"><label class="dl-label" for="f-model">Model</label><input class="dl-input" id="f-model" data-path="servos.model" data-text></div>
      <div class="dl-field"><label class="dl-label" for="f-elbow">Elbow side</label><span class="dl-select"><select class="dl-input" id="f-elbow" data-path="elbow" data-text><option value="up">Right</option><option value="down">Left</option></select>${icon("chevron-down")}</span></div>
      <table class="dl-table cw-servos"><colgroup><col><col><col><col><col><col class="cw-dir"></colgroup><thead><tr><th>Joint</th><th>Min °</th><th>Max °</th><th>Zero °</th><th>Ratio</th><th>Direction</th></tr></thead><tbody>${["base", "elbow", "tilt"].map((j) =>
        `<tr><td>${j[0].toUpperCase() + j.slice(1)}</td>${["min", "max", "offset", "ratio"].map((k) => `<td><input class="dl-input dl-num" type="number" step="any" data-path="servos.${j}.${k}" aria-label="${j} ${{ offset: "zero offset", ratio: "gear ratio" }[k] || k}"></td>`).join("")}<td><span class="dl-select"><select class="dl-input" data-path="servos.${j}.dir" aria-label="${j} direction"><option value="1">Normal</option><option value="-1">Reversed</option></select>${icon("chevron-down")}</span></td></tr>`).join("")}</tbody></table>
    </div></div>`;
}
function fillSetup(c) {
  $$("#setup [data-path]").forEach((el) => { el.value = get(c, el.dataset.path) ?? ""; });
  $("#placeholder").hidden = !!c.measured; $("#save-note").textContent = "";
}
function readSetup() {
  const c = structuredClone(cfg);
  $$("#setup [data-path]").forEach((el) => { put(c, el.dataset.path, "text" in el.dataset ? el.value : Number(el.value)); });
  return withDefaults(c);
}
function dirty() { return JSON.stringify(readSetup()) !== JSON.stringify(cfg); }
let clockStrokes = null;
function renderSetup() {
  if ($("#page-arm").hidden) return;
  const c = readSetup(), gg = geomFrom(c);
  setupBoard.setGeom(gg); setupSim.setGeom(gg); if (!setupSim.manual) setupSim.reset();
  clockStrokes ??= parseSVG(clockSVG(now()));
  const p = plan(clockStrokes, gg, { half: gg.half, leadIn: gg.leadIn }), an = toAngles(p.toolpath, gg), job = makeJob(p.toolpath, an, gg);
  setupBoard.render({ toolpath: p.toolpath, joints: setupSim.j, mode: null, showReach: true, hover: setupHover });
  let ok = 0, n = 0, worst = 1;
  const cy = gg.standoff + gg.board / 2;
  for (let i = 0; i <= 20; i++) for (let k = 0; k <= 20; k++) {
    const x = -gg.half + (i / 20) * 2 * gg.half, y = cy - gg.half + (k / 20) * 2 * gg.half; n++;
    const a = toAngles([{ x, y, pen: 1 }], gg); if (a.unreachable || a.outOfRange) continue;
    ok++; const r2 = x * x + y * y, c2 = (r2 - gg.L1 ** 2 - gg.L2 ** 2) / (2 * gg.L1 * gg.L2); worst = Math.min(worst, Math.sqrt(Math.max(0, 1 - c2 * c2)));
  }
  const cover = Math.round((ok / n) * 100), stepMm = (gg.L1 + gg.L2) * gg.servo.resolution * Math.PI / 180;
  $("#derived").innerHTML =
    `<dt>Reach</dt><dd>${mm(gg.L1 + gg.L2)}, inner limit ${mm(Math.abs(gg.L1 - gg.L2))}</dd>` +
    `<dt>Drawing square</dt><dd>${cover}% reachable within servo limits</dd>` +
    `<dt>Worst dexterity</dt><dd>${ok ? worst.toFixed(2) : "none reachable"}</dd>` +
    `<dt>Servo step at the tip</dt><dd>${stepMm.toFixed(1)} mm at full stretch</dd>` +
    `<dt>Clock takes</dt><dd>${secs(job.total)}${an.unreachable ? `, ${an.unreachable} points out of reach` : ""}</dd>` +
    `<dt>Pen meets the board at</dt><dd>${gg.pen.beta.toFixed(0)}°${+c.pen.angle > 0 ? `, best is ${Math.ceil(gg.pen.best)}°` : ", the best for this pen"}</dd>` +
    `<dt>Tilt shaft above the board</dt><dd>${gg.pen.height.toFixed(1)} mm</dd>` +
    `<dt>Tilts from flat</dt><dd>draw ${gg.pen.draw.toFixed(1)}°, lift ${gg.pen.lift.toFixed(1)}°, erase +${gg.pen.erase.toFixed(1)}°</dd>` +
    `<dt>Nib and eraser</dt><dd>${gg.pen.side.toFixed(0)} mm either side of the forearm's tip; reach to the nib ${mm(Math.hypot(gg.L2, gg.pen.side))}</dd>` +
    `<dt>Barrel edge while drawing</dt><dd>${gg.pen.clearance >= 0 ? `${gg.pen.clearance.toFixed(1)} mm off the board` : `hits the board by ${(-gg.pen.clearance).toFixed(1)} mm`}</dd>`;
  const fs = $("#fit-status");
  fs.textContent = cover === 100 ? "Fits" : `${cover}% fits`; fs.dataset.tone = cover === 100 ? "ok" : cover > 80 ? "warn" : "stop";
  $("#save").disabled = !dirty(); $("#revert").disabled = !dirty();
}
let setupHover = null;
async function save() {
  const c = readSetup(); c.measured = true;
  const b = $("#save"); b.setAttribute("aria-busy", "true"); b.innerHTML = `<span class="dl-spinner" aria-hidden="true"></span>Save`;
  try { cfg = await saveConfig(c); applyConfig(); fillSetup(cfg); renderSetup(); toast("Saved to arm.config.json"); }
  catch (e) { $("#save-note").textContent = e.message; }
  finally { b.removeAttribute("aria-busy"); b.textContent = "Save"; renderSetup(); }
}
function applyConfig() { g = geomFrom(cfg); board.setGeom(g); sim.setGeom(g); v3?.setGeom(g, cfg.pen); buildJoints(); replan(); }

// ---------- command palette ----------
let palItems = [], palIndex = 0;
function commandList(q) {
  const list = [
    { label: "New simulation", icon: "plus", run: () => newSim() },
    ...STARTERS.map((s) => ({ label: s, icon: "pencil", run: () => { go("studio"); send(s); } })),
    { label: playing ? "Pause" : "Play the change", icon: playing ? "pause" : "play", run: () => (playing ? pause() : play()), off: !active },
    { label: "Start the change again", icon: "rotate-ccw", run: () => seek(0), off: !active },
    { label: "Clear the board", icon: "eraser", run: () => send("Clear the board") },
    { label: clockHook() ? "Stop keeping the clock on time" : "Keep the clock on time: redraw its hands every minute", icon: "clock", run: () => { go("studio"); const h = clockHook(); if (h) removeHook(h.id); else runHook(addHook("draw the time", 1)); } },
    { label: S.physics ? "Ideal servos" : "Real servo limits", icon: "sliders-horizontal", run: () => togglePhysics() },
    { label: S.reach ? "Hide the reach" : "Show the reach", icon: "crosshair", run: () => toggleReach() },
    { label: "Board view", icon: "layout-grid", run: () => { go("studio"); setView("board"); } },
    { label: "3D view", icon: "move", run: () => { go("studio"); setView("3d"); } },
    { label: "Picture view", icon: "image", run: () => { go("studio"); setView("picture"); } },
    { label: "Angles view", icon: "list-checks", run: () => { go("studio"); setView("angles"); } },
    { label: "Arm setup", icon: "ruler", run: () => go("arm") },
    { label: arm.connected() ? "Send to arm" : "Connect the arm", icon: arm.connected() ? "send" : "usb", run: () => (arm.connected() ? sendToArm() : connectArm()) },
    { label: "Download the angles", icon: "download", run: () => $("#download").click(), off: !planned },
    { label: S.narrate ? "Mute the arm" : "Let the arm speak", icon: S.narrate ? "volume-x" : "volume-2", run: () => toggleNarrate() },
  ].filter((c) => !c.off);
  const t = q.trim().toLowerCase();
  if (!t) return list;
  const hits = list.filter((c) => c.label.toLowerCase().includes(t));
  const say = { label: `Ask: “${q.trim()}”`, icon: "message-square", run: () => { go("studio"); send(q); } };
  return hits.length && hits[0].label.toLowerCase().startsWith(t) ? [...hits, say] : [say, ...hits];
}
function openPalette() {
  const d = $("#palette"); if (d.open) { d.close(); return; }
  $("#palette-input").value = ""; renderPalette(); d.showModal(); $("#palette-input").focus();
}
function renderPalette() {
  palItems = commandList($("#palette-input").value); palIndex = 0;
  $("#palette-list").innerHTML = palItems.map((c, i) => `<li class="cw-palette__item" role="option" id="pal-${i}" data-i="${i}" aria-selected="${i === 0}">${icon(c.icon)}<span>${esc(c.label)}</span></li>`).join("");
  $("#palette-input").setAttribute("aria-activedescendant", palItems.length ? "pal-0" : "");
}
function movePalette(d) {
  if (!palItems.length) return;
  $(`#pal-${palIndex}`).setAttribute("aria-selected", "false");
  palIndex = (palIndex + d + palItems.length) % palItems.length;
  const li = $(`#pal-${palIndex}`); li.setAttribute("aria-selected", "true"); li.scrollIntoView({ block: "nearest" });
  $("#palette-input").setAttribute("aria-activedescendant", `pal-${palIndex}`);
}
function runPalette(i = palIndex) { const c = palItems[i]; if (!c) return; $("#palette").close(); c.run(); }

// ---------- toggles ----------
function togglePhysics() { S.physics = !S.physics; store("clockedin.prefs", S); sim.physics = S.physics; $("#sw-physics").setAttribute("aria-checked", String(S.physics)); if (active) seek(sim.t); }
function toggleReach() { S.reach = !S.reach; store("clockedin.prefs", S); $("#sw-reach").setAttribute("aria-checked", String(S.reach)); draw(); }
function toggleFollow() { S.follow = !S.follow; store("clockedin.prefs", S); $("#sw-follow").setAttribute("aria-checked", String(S.follow)); }
function toggleNarrate() {
  S.narrate = !S.narrate; store("clockedin.prefs", S);
  const b = $("#narrate"); b.setAttribute("aria-pressed", String(S.narrate)); setIcon(b, S.narrate ? "volume-2" : "volume-x");
  b.title = b.ariaLabel = S.narrate ? "Arm speaks: on" : "Arm speaks: off";
  if (S.narrate) voice.say("I'll talk you through each change.", { voice: S.voice || undefined });
}

// ---------- the board: drag to move the pen; in a game, tap a square ----------
function cellAt(p) {
  if (!scene.game || scene.game.over) return -1;
  const b = boxMm(scene.game.box, g), col = Math.floor((p.x - b.x) / (b.w / 3)), row = 2 - Math.floor((p.y - b.y) / (b.h / 3));
  return col >= 0 && col < 3 && row >= 0 && row < 3 ? row * 3 + col : -1;
}
function jogOn(canvas, getBoard, getSim, setHover, allowed, redraw, onTap) {
  let down = false, start = null;
  const at = (e) => { const p = getBoard().toWorld(e.clientX, e.clientY); const s = getSim(); const ok = !!s && toAngles([{ ...p, pen: 0 }], s.g).unreachable === 0; return { ...p, ok }; };
  canvas.addEventListener("pointerdown", (e) => {
    const p = at(e); start = p;
    if (onTap && onTap(p, true)) return;   // a tap the game takes isn't a drag
    if (!allowed()) return; down = true; canvas.setPointerCapture(e.pointerId); if (p.ok) getSim().jog(p.x, p.y); setHover(p); redraw();
  });
  canvas.addEventListener("pointermove", (e) => { const p = at(e); setHover(p); if (down && p.ok) getSim().jog(p.x, p.y); redraw(); });
  canvas.addEventListener("pointerup", () => { down = false; });
  canvas.addEventListener("pointerleave", () => { setHover(null); redraw(); });
}

// ---------- events ----------
function wire() {
  $("#ask").addEventListener("submit", (e) => { e.preventDefault(); send($("#prompt").value); });
  $("#prompt").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send($("#prompt").value); } });
  $("#prompt").addEventListener("input", autosize);
  $("#thread").addEventListener("click", (e) => {
    const s = e.target.closest("[data-say]"); if (s) send(s.dataset.say);
    if (e.target.closest("[data-retry]")) { const last = messages.at(-1); if (last?.error) messages.pop(); const u = messages.at(-1); if (u?.role === "user") { messages.pop(); send(u.text); } }
    // the clock was just drawn for this minute, so its repeat starts at the next one
    if (e.target.closest("[data-keep-time]")) { const h = addHook("draw the time", 1); h.slot = slotOf(h); renderThread(); }
  });
  $("#repeats").addEventListener("click", (e) => { const b = e.target.closest("[data-unhook]"); if (b) removeHook(b.dataset.unhook); });
  $("#tab-chat").addEventListener("click", () => selectTab("chat"));
  $("#tab-plan").addEventListener("click", () => selectTab("plan"));
  $(".cw-tabs").addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const to = $("#tab-chat").getAttribute("aria-selected") === "true" ? "plan" : "chat"; selectTab(to); $(`#tab-${to}`).focus(); } });
  $("#new-sim").addEventListener("click", () => newSim());
  $("#sims").addEventListener("click", (e) => { const a = e.target.closest("[data-sim]"); if (!a) return; e.preventDefault(); openSim(a.dataset.sim); });
  $("#views").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setView(b.dataset.view); });
  $("#cams").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || !v3) return;
    $$("#cams button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); v3.view(b.dataset.cam, sim.j);
  });
  $("#speed").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; speed = +b.dataset.speed; $$("#speed button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); });
  $("#play").addEventListener("click", () => (playing ? pause() : play()));
  $("#rewind").addEventListener("click", () => seek(0));
  $("#erase").addEventListener("click", () => send("Clear the board"));
  $("#scrub").addEventListener("input", () => { pause(); seek((($("#scrub").value | 0) / 1000) * (active?.total || 0)); syncLive(true); });
  $("#sw-physics").addEventListener("click", togglePhysics);
  $("#sw-reach").addEventListener("click", toggleReach);
  $("#sw-follow").addEventListener("click", toggleFollow);
  $("#narrate").addEventListener("click", toggleNarrate);
  $("#send").addEventListener("click", () => { if (sending) { sending.abort(); pause(); return; } arm.connected() ? sendToArm() : connectArm(); });
  $("#download").addEventListener("click", () => arm.download(stream(), `clockedin-${(doc?.title || "change").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.json`));
  $("#copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(stream(), null, 2)); toast("Angles copied"); } catch (e) { toast("The browser would not copy. Use the download instead.", "circle-alert"); }
  });

  let mic = null;
  const micBtn = $("#mic");
  if (!voice.canListen()) { micBtn.disabled = true; micBtn.title = "Speech input needs Chrome"; }
  micBtn.addEventListener("click", () => {
    if (mic) { mic.stop(); return; }
    try {
      micBtn.setAttribute("aria-pressed", "true");
      mic = voice.listen({ onResult: (t) => { $("#prompt").value = t; autosize(); }, onEnd: (t) => { mic = null; micBtn.setAttribute("aria-pressed", "false"); if (t) send(t); } });
    } catch (e) { micBtn.setAttribute("aria-pressed", "false"); toast(e.message, "circle-alert"); }
  });

  $$("[data-open-palette]").forEach((b) => b.addEventListener("click", openPalette));
  $("#nav-open").addEventListener("click", () => $("#app").toggleAttribute("data-nav-open"));
  $(".dl-scrim").addEventListener("click", () => $("#app").removeAttribute("data-nav-open"));
  addEventListener("hashchange", () => showPage(location.hash.slice(1)));
  document.addEventListener("change", (e) => { if (e.target.id === "voice-id") { S.voice = e.target.value.trim(); store("clockedin.prefs", S); } });
  document.addEventListener("click", (e) => { if (e.target.closest("#voice-test")) voice.say("Hello. I'm the Clockedin arm, and this is how I sound.", { voice: ($("#voice-id").value || "").trim() || undefined }); });
  document.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); } });
  $("#palette-input").addEventListener("input", renderPalette);
  $("#palette-input").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); movePalette(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); movePalette(-1); }
    else if (e.key === "Enter") { e.preventDefault(); runPalette(); }
  });
  $("#palette-list").addEventListener("click", (e) => { const li = e.target.closest("[data-i]"); if (li) runPalette(+li.dataset.i); });
  $("#palette-list").addEventListener("pointermove", (e) => { const li = e.target.closest("[data-i]"); if (li && +li.dataset.i !== palIndex) movePalette(+li.dataset.i - palIndex); });
  $("#palette").addEventListener("click", (e) => { if (e.target === $("#palette")) $("#palette").close(); });

  jogOn($("#board"), () => board, () => sim, (h) => { hover = h; }, () => !playing && !sending, () => { draw(); syncLive(true); kick(); if (sim.manual) arm.jog(sim.manual, g); },
    (p) => { const c = cellAt(p); if (c < 0 || thinking) return false; send(cap(cellName(c))); return true; });
  jogOn($("#setup-board"), () => setupBoard, () => setupSim, (h) => { setupHover = h; }, () => true, () => { renderSetup(); kickSetup(); });

  $("#setup").addEventListener("input", () => { setupSim.manual = null; renderSetup(); $("#save-note").textContent = dirty() ? "Not saved yet" : ""; });
  $("#save").addEventListener("click", save);
  $("#revert").addEventListener("click", () => { fillSetup(cfg); renderSetup(); });
  new ResizeObserver(() => { draw(); renderSetup(); }).observe($("#main"));
}
let setupRaf = 0, setupTs = 0;
function kickSetup() {
  if (setupRaf) return; setupTs = performance.now();
  setupRaf = requestAnimationFrame(function f(ts) {
    setupRaf = 0; const dt = Math.min(0.1, (ts - setupTs) / 1000); setupTs = ts;
    setupSim.advance(dt); renderSetup(); if (settling(setupSim)) { setupTs = ts; setupRaf = requestAnimationFrame(f); }
  });
}

// ---------- start ----------
async function start() {
  ICONS = await fetch("./ui/icons.json").then((r) => r.json()).catch(() => ({}));
  hydrate();
  cfg = await loadConfig(); g = geomFrom(cfg);
  board = createBoard($("#board")); board.setGeom(g);
  sim = new Sim(g); sim.physics = S.physics;
  setupBoard = createBoard($("#setup-board"), { pad: 8 }); setupSim = new Sim(g);
  buildJoints(); buildSetup();
  $("#sw-physics").setAttribute("aria-checked", String(S.physics)); $("#sw-reach").setAttribute("aria-checked", String(S.reach)); $("#sw-follow").setAttribute("aria-checked", String(S.follow));
  if (S.narrate) { S.narrate = false; toggleNarrate(); }
  wire(); renderServices(); refreshStatus(); setInterval(refreshStatus, 60000); window.addEventListener("focus", refreshStatus);
  await listSims();
  let want = params.get("sim"); try { want ||= localStorage.getItem("clockedin.open"); } catch (e) {}
  const pick = sims.find((s) => s.id === want) || sims[0];
  if (pick && !params.has("fresh")) await openSim(pick.id); else await newSim({ focus: false });
  showPage(location.hash.slice(1));
  const ask = params.get("say"); if (ask) send(ask);
}
start();
