// Clockwork: ask for a drawing, watch the simulated arm draw it to scale, send the same angles to the real arm.
// Pipeline: words -> a picture (Gemini, through the dev server) -> the shortest pen path -> joint angles ->
// a live sim through the servos' limits. Everything after the picture is deterministic.
import { toAngles, R2D } from "./ik.js";
import { parseSVG } from "./svg.js";
import { plan, erasePlan } from "./pathplan.js";
import { imageToStrokes } from "./vectorize.js";
import * as voice from "./voice.js";
import * as arm from "./arm.js";
import { SAMPLES, clockSVG } from "./sample.js";
import { loadConfig, saveConfig, geomFrom, withDefaults, DEFAULT_CONFIG, servoAngle } from "./config.js";
import { makeJob, Sim, homePose } from "./sim.js";
import { createBoard } from "./board.js";
import { nibHeight } from "./pen.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const params = new URLSearchParams(location.search);
const now = () => (params.get("at") ? new Date(params.get("at")) : new Date());   // ?at= fixes the clock for screenshots

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
const modelName = (m = "") => m.replace(/^gemini-/, "Gemini ").replace(/-/g, " ").replace(/\b(flash|pro|lite|image|preview)\b/g, (w) => w[0].toUpperCase() + w.slice(1));

// ---------- state ----------
let cfg = withDefaults({}), g = geomFrom(cfg);
let board, sim, setupBoard, setupSim, v3 = null, inkDirty = true;
let services = { gemini: { ready: false, model: "" }, voice: { provider: "browser" } };
const S = load("clockwork.prefs", { narrate: false, route: "svg", physics: true, reach: true, voice: "" });
let recent = load("clockwork.recent", []);
let drawing = null;       // { prompt, strokes, picture, meta, sample }
let planned = null;       // { plan, angles, job } for the drawing
let active = null;        // the job the sim is running: the drawing, an erase, or erase + clock
let lastAsk = "";
let playing = false, speed = 1, view = "board", keepTime = false, keptMinute = -1, sending = null, erasing = false, cleaned = false;

function load(k, d) {
  try { const v = JSON.parse(localStorage.getItem(k) || "null"); if (v == null) return d; return Array.isArray(d) ? (Array.isArray(v) ? v : d) : { ...d, ...v }; }
  catch (e) { return d; }
}
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

// ---------- notices ----------
function toast(msg, name = "check") {
  const t = document.createElement("div"); t.className = "dl-toast"; t.setAttribute("role", "status");
  t.innerHTML = `${icon(name)}<span>${esc(msg)}</span>`; $("#toasts").append(t); setTimeout(() => t.remove(), 3200);
}
function showError(msg) { $("#error-text").textContent = msg; $("#error").hidden = false; $("#empty").hidden = true; }
function hideError() { $("#error").hidden = true; }

// A new ask replaces what is on the board: nothing from the last drawing stays on screen as if it were this one's.
function clearDrawing(title, subtitle) {
  pause(); planned = null; active = null; drawing = null;
  sim.reset(); board.clearInk(); draw();
  $("#title").textContent = title.charAt(0).toUpperCase() + title.slice(1); $("#title").title = title; $("#subtitle").textContent = subtitle;
  $("#stats").hidden = true; $("#stats-skel").hidden = false; $("#m-answer").hidden = true; $("#empty").hidden = true;
  ["#download", "#copy"].forEach((s) => { $(s).disabled = true; });
  renderPicture(); renderAngles(); syncSend(); syncTransport(); syncLive(true);
}

// ---------- the arm's voice (ElevenLabs when its key is in app/.env) ----------
function narrate(kind, d = {}) {
  if (!S.narrate) return;
  const lines = {
    start: () => `Drawing ${d.prompt}. About ${d.secs} seconds.${d.out ? ` ${d.out} points are out of my reach.` : ""}`,
    done: () => `Done, in ${d.secs} seconds.`,
    clean: () => "Board clean.",
    time: () => `It's ${d.time}.`,
    connected: () => "Arm connected. Ready when you are.",
    failed: () => d.msg,
  };
  voice.say(lines[kind](), { voice: S.voice || undefined });
}

// ---------- state words: one vocabulary, colour only for what needs attention ----------
function status(el, text, { tone = "", mark = "" } = {}) {
  el.textContent = text;
  if (tone) el.dataset.tone = tone; else delete el.dataset.tone;
  if (mark) el.dataset.mark = mark; else delete el.dataset.mark;
}
const planStatus = (text, o) => status($("#plan-status"), text, o);

// ---------- pipeline steps ----------
const steps = {
  reset() { $$("#steps .dl-step").forEach((li) => { li.dataset.state = "next"; li.querySelector(".dl-step__time").textContent = ""; }); this.bar(0); $("#steps").dataset.state = "running"; },
  set(name, state, text) { const li = $(`#steps [data-step="${name}"]`); li.dataset.state = state; if (text != null) li.querySelector(".dl-step__time").textContent = text; },
  fail(name, text) { this.set(name, "now", text); $("#steps").dataset.state = "failed"; },
  bar(p) { $("#steps-fill").style.setProperty("--dl-p", p); },
};

// ---------- the pipeline ----------
function sampleFor(text) {
  const lc = text.trim().toLowerCase();
  if (SAMPLES[lc]) return lc;
  if (/^(the )?(clock|time)( now)?$/.test(lc)) return "clock";
  return null;
}

async function rasterToStrokes(url) {
  const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const N = 256, c = document.createElement("canvas"); c.width = c.height = N; const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, N, N); const s = Math.min(N / img.width, N / img.height);
  x.drawImage(img, (N - img.width * s) / 2, (N - img.height * s) / 2, img.width * s, img.height * s);
  return imageToStrokes(x.getImageData(0, 0, N, N), { threshold: 140, minLen: 14, simplify: 1.5 });
}

async function run(text) {
  text = (text || "").trim();
  if (!text) { $("#prompt").focus(); return; }
  hideError(); setKeepTime(false); busy(true); go("studio");
  $("#prompt").value = text; lastAsk = text;
  clearDrawing(text, sampleFor(text) ? "Sample" : "Gemini");
  planStatus("Working", { mark: "ring" });
  steps.reset(); steps.set("picture", "now", "making");
  const sample = sampleFor(text), t0 = performance.now();
  try {
    let strokes, picture, meta;
    if (sample === "clock") { const svg = clockSVG(now()); strokes = parseSVG(svg); picture = { svg }; meta = "Sample, the time now"; }
    else if (sample) { strokes = parseSVG(SAMPLES[sample]); picture = { svg: SAMPLES[sample] }; meta = "Sample"; }
    else {
      if (!services.gemini.ready) throw new Error("No Gemini key yet. Add GEMINI_API_KEY to app/.env and restart the server, or pick a sample.");
      const r = await fetch("./api/draw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: text, route: S.route }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(friendly(j.error || `The server answered ${r.status}`));
      if (j.svg) { strokes = parseSVG(j.svg); picture = { svg: j.svg }; } else { strokes = await rasterToStrokes(j.image); picture = { image: j.image }; }
      meta = `${modelName(j.model)}, ${(j.ms / 1000).toFixed(1)} s`;
    }
    if (!strokes?.length) throw new Error("That picture has no lines the arm can draw. Try fewer, simpler words.");
    steps.set("picture", "done", sample ? "sample" : `${((performance.now() - t0) / 1000).toFixed(1)} s`);
    setDrawing({ prompt: text, strokes, picture, meta, sample }, { remember: !sample });
    narrate("start", { prompt: text, secs: whole(planned.job.total), out: planned.angles.unreachable });
    play();
  } catch (e) {
    steps.fail("picture", "failed");
    planStatus("Failed", { tone: "stop" });
    $("#stats-skel").hidden = true;
    showError(e.message || String(e));
    narrate("failed", { msg: /busy/.test(e.message) ? "Gemini is busy. Try a sample." : "I couldn't make that picture." });
  } finally { busy(false); }
}

function friendly(msg) {
  if (/503|high demand|overloaded|took over/i.test(msg)) return "Gemini is busy. Pick a sample, or";
  if (/429|quota/i.test(msg)) return S.route === "image" ? "The image models need billing on the Gemini project. Switch Picture to vector drawing in Arm setup." : "Gemini's free quota is used up for now. Try again in a minute.";
  return msg;
}

function busy(on) {
  const b = $("#draw");
  b.setAttribute("aria-busy", String(on));
  b.innerHTML = on ? `<span class="dl-spinner" aria-hidden="true"></span>Draw` : "Draw";
}

// Plan, solve and load a drawing into the sim. Deterministic: the same strokes always give the same angles.
function setDrawing(d, { remember = false } = {}) {
  drawing = d;
  const t1 = performance.now();
  const p = plan(d.strokes, g, { half: g.half, leadIn: g.leadIn });
  steps.set("path", "done", `${p.strokes.length} strokes`);
  const angles = toAngles(p.toolpath, g);
  steps.set("angles", "done", `${p.toolpath.length} points`);
  steps.set("sim", "next", "");
  planned = { plan: p, angles, job: makeJob(p.toolpath, angles, g), ms: performance.now() - t1 };
  $("#steps").dataset.state = "running"; steps.bar(0.75);
  $("#title").textContent = d.prompt.charAt(0).toUpperCase() + d.prompt.slice(1);
  $("#title").title = d.prompt;
  $("#subtitle").textContent = d.meta;
  renderPicture(); renderAngles(); renderPlanStats(); $("#empty").hidden = true;
  startJob(planned.job, { clear: true });
  ["#download", "#copy"].forEach((s) => { $(s).disabled = false; });
  syncSend();
  if (remember) remember_(d);
}

function remember_(d) {
  const strokes = d.strokes.map((s) => s.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })));
  recent = [{ id: Date.now().toString(36), prompt: d.prompt, strokes, svg: d.picture?.svg || null, meta: d.meta, at: Date.now() }, ...recent.filter((r) => r.prompt !== d.prompt)].slice(0, 8);
  store("clockwork.recent", recent); renderRecent();
}

function replan() { if (drawing) setDrawing(drawing); else { sim.reset(); draw(); } }

// ---------- the sim ----------
const onInk = (a, b, mode) => { board.inkSeg(a, b, mode); inkDirty = true; };

function startJob(job, { clear = false } = {}) {
  pause();
  if (clear) { board.clearInk(); sim.reset(); }
  active = job; sim.load(job); sim.physics = S.physics;
  syncTransport(); draw();
}

function play() {
  if (!active) return;
  if (sim.done) { seek(0); }
  playing = true; sim.manual = null; cleaned = false;
  $("#play").setAttribute("aria-label", "Pause"); $("#play").title = "Pause"; setIcon($("#play"), "pause");
  steps.set("sim", "now"); $("#steps").dataset.state = "running";
  kick();
}
function pause() {
  playing = false;
  $("#play").setAttribute("aria-label", "Play"); $("#play").title = "Play"; setIcon($("#play"), "play");
  showPaused();
}
// a job stopped part way: the step stops turning and says where it stopped
function showPaused() {
  if (!active || !planned || sim.done || !$("#steps")) return;
  if (sim.t > 0) { steps.set("sim", "now", `paused at ${clock(sim.t)}`); $("#steps").dataset.state = "stopped"; }
  else { steps.set("sim", "next", ""); $("#steps").dataset.state = "ready"; }
}
function seek(t) {
  if (!active) return;
  board.clearInk(); sim.reset(); sim.load(active); sim.physics = S.physics;
  sim.advance(Math.max(0, Math.min(t, active.total)), onInk);
  syncTransport(); draw(); if (!playing) showPaused();
}
function eraseBoard() {
  if (!board.hasInk()) { toast("The board is already clean", "info"); return; }
  setKeepTime(false);
  const ep = erasePlan(g), an = toAngles(ep.toolpath, g);
  startJob(makeJob(ep.toolpath, an, g)); erasing = true; play();
}

function finished() {
  if (planned && active === planned.job) { planned.seen = true; syncSend(); if (!keepTime) narrate("done", { secs: whole(active.total) }); }
  if (erasing) narrate("clean");
  pause();
  steps.set("sim", "done", sim.dev.n ? `${(sim.dev.sum / sim.dev.n).toFixed(1)} mm off on average` : "done");
  $("#steps").dataset.state = "ready"; steps.bar(1);
  // after an erase, the drawing is ready to draw again on the clean board
  if (erasing && planned) { erasing = false; active = planned.job; sim.load(active); sim.manual = { ...sim.j }; cleaned = true; syncTransport(); }
}

// One animation loop while something moves; nothing runs at rest.
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
    unreachable: planned && active === planned.job ? planned.plan.toolpath.filter((_, i) => planned.angles.path[i].out_of_reach) : null,
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
  else if (!active || sim.t === 0) status(ps, cleaned ? "Board clean" : sim.manual ? "Moved by hand" : "Parked");
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

function renderPlanStats() {
  const { plan: p, angles, job } = planned;
  $("#st-time").textContent = secs(whole(job.total));
  $("#st-ink").textContent = mm(p.ink);
  $("#st-travel").textContent = mm(p.travel);
  $("#st-err").textContent = "0.0 mm";
  $("#stats").hidden = false; $("#stats-skel").hidden = true;
  const rs = $("#reach-status");
  if (angles.unreachable) status(rs, `${angles.unreachable} points out of reach`, { tone: "stop" });
  else if (angles.outOfRange) status(rs, `${angles.outOfRange} points past servo limits`, { tone: "warn" });
  else status(rs, "All in reach", { mark: "dot" });
  $("#m-answer").textContent = `${secs(whole(job.total))} to draw, ${rs.textContent.charAt(0).toLowerCase() + rs.textContent.slice(1)}`; $("#m-answer").hidden = false;
  planStatus("Ready", { mark: "dot" });
}

function renderPicture() {
  const pic = drawing?.picture, el = $("#picture");
  if (!pic) { el.innerHTML = `<div class="dl-empty"><span class="dl-empty__title">No picture yet</span><span>Describe a drawing above, or pick a sample.</span></div>`; return; }
  // an <img> never runs anything inside a model's SVG
  const src = pic.svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pic.svg)}` : pic.image;
  el.innerHTML = `<img src="${src}" alt="${esc(drawing.prompt)}, the picture the arm traces">`;
}

function renderAngles() {
  const el = $("#angles");
  if (!planned) { el.innerHTML = `<div class="dl-empty"><span class="dl-empty__title">No angles yet</span><span>They appear once a drawing is planned.</span></div>`; return; }
  const tp = planned.plan.toolpath, path = planned.angles.path, T = planned.job.tTilt;
  const rows = tp.map((p, i) => {
    const a = path[i], tool = p.tool || (p.pen ? "draw" : "lift");
    return a.out_of_reach
      ? `<tr data-i="${i}"><td class="dl-num">${i + 1}</td><td class="dl-num">${T[i].toFixed(2)}</td><td class="dl-num">${p.x.toFixed(1)}</td><td class="dl-num">${p.y.toFixed(1)}</td><td><span class="dl-status" data-tone="stop">Out of reach</span></td><td></td><td></td><td></td></tr>`
      : `<tr data-i="${i}"><td class="dl-num">${i + 1}</td><td class="dl-num">${T[i].toFixed(2)}</td><td class="dl-num">${p.x.toFixed(1)}</td><td class="dl-num">${p.y.toFixed(1)}</td><td>${tool === "draw" ? "Draw" : tool === "erase" ? "Erase" : "Lift"}</td><td class="dl-num">${a.base.toFixed(2)}°</td><td class="dl-num">${a.elbow.toFixed(2)}°</td><td class="dl-num">${a.tilt}°</td></tr>`;
  }).join("");
  el.innerHTML = `<table class="dl-table"><thead><tr><th>#</th><th>Time s</th><th>x mm</th><th>y mm</th><th>Pen</th><th>Base</th><th>Elbow</th><th>Tilt</th></tr></thead><tbody>${rows}</tbody></table>`;
  lastRow = -1;
}

// ---------- 3D: the arm and the pen's tilt, to orbit round ----------
async function open3d() {
  if (!v3) {
    try { const { createView3d } = await import("./view3d.js"); v3 = createView3d($("#view3d"), board.ink); v3.setGeom(g, cfg.pen); }
    catch (e) { showError(`The 3D view needs WebGL: ${e.message}`); setView("board"); return; }
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

// ---------- keep time: erase and redraw the clock every minute ----------
function setKeepTime(on) {
  keepTime = on; $("#sw-time").setAttribute("aria-checked", String(on));
  if (on) { keptMinute = -1; tickTime(); }
}
function tickTime() {
  if (!keepTime) return;
  const t = now(), m = t.getHours() * 60 + t.getMinutes();
  if (m === keptMinute || playing) return;
  keptMinute = m;
  const svg = clockSVG(t), strokes = parseSVG(svg);
  drawing = { prompt: "The time now", strokes, picture: { svg }, meta: `Redraws every minute, ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`, sample: "clock" };
  const p = plan(strokes, g, { half: g.half, leadIn: g.leadIn });
  const wipe = board.hasInk() ? erasePlan(g).toolpath : [];
  const tp = [...wipe, ...p.toolpath], angles = toAngles(tp, g), job = makeJob(tp, angles, g);
  const own = toAngles(p.toolpath, g);
  planned = { plan: p, angles: own, job: makeJob(p.toolpath, own, g) };
  $("#title").textContent = drawing.prompt; $("#subtitle").textContent = drawing.meta;
  renderPicture(); renderAngles(); renderPlanStats(); $("#empty").hidden = true;
  startJob(job); play();
  narrate("time", { time: `${t.getHours() % 12 || 12}:${String(t.getMinutes()).padStart(2, "0")}` });
}
setInterval(tickTime, 1000);

// ---------- arm ----------
function setArm(on) {
  status($("#arm-status"), on ? (arm.version() >= 2 ? "Connected" : "Connected, simple mode") : "Not connected", { mark: on ? "dot" : "" });
  syncSend(); renderServices();
}
// the arm's one action, in one place: Connect arm until it is connected, then Send to arm
function syncSend() {
  const b = $("#send"), on = arm.connected();
  if (sending) return;
  setIcon(b, on ? "send" : "usb"); b.querySelector("span").textContent = on ? "Send to arm" : "Connect arm";
  b.disabled = on && !planned;
  const next = !!planned?.seen;
  b.classList.toggle("dl-btn--primary", next); b.classList.toggle("dl-btn--secondary", !next);
}
async function connectArm() {
  try {
    await arm.connect(); setArm(true); narrate("connected");
    toast(arm.version() >= 2 ? "Arm connected" : "Arm connected, but it didn't answer as Clockwork firmware");
    arm.jog(homePose(g), g);
  }
  catch (e) { if (e.name !== "NotFoundError") showError(e.message); }
}
async function sendToArm() {
  if (!planned) return;
  if (!arm.connected()) { await connectArm(); if (!arm.connected()) return; }
  const b = $("#send"), label = b.querySelector("span"); b.setAttribute("aria-busy", "true");
  sending = new AbortController();
  setIcon(b, "x"); label.textContent = "Stop the arm";
  try {
    // the sim plays alongside at real speed, so the screen shows what the arm is doing
    speed = 1; $$("#speed button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.speed === "1")));
    seek(0); play();
    await arm.send(planned.job, g, { signal: sending.signal });
    toast(sending.signal.aborted ? "Arm stopped" : "The arm has finished");
  } catch (e) { showError(e.message); }
  finally { sending = null; b.removeAttribute("aria-busy"); syncSend(); syncLive(true); }
}
function stream() {
  const { plan: p, angles, job } = planned;
  return {
    arm: cfg.name, measured: cfg.measured, links_mm: cfg.links, board_mm: cfg.board, pen: cfg.pen, servos: cfg.servos,
    drawing: drawing.prompt, strokes: p.strokes.length, ink_mm: p.ink, travel_mm: p.travel, duration_s: +job.total.toFixed(2),
    worst_dexterity: angles.worstDex, out_of_reach: angles.unreachable, past_servo_limits: angles.outOfRange,
    protocol: "one line per waypoint at its send time t: base,elbow,tilt,pressure; SKIP when out of reach; HOME at the end",
    path: angles.path.map((a, i) => ({ t: +job.tTilt[i].toFixed(3), ...a })),
    keyframes: arm.keyframes(job, g),
  };
}

// ---------- rail: samples, recent, services ----------
const SAMPLE_LIST = [["clock", "The time now", "clock"], ["house", "House", "house"], ["cat", "Cat", "image"], ["star", "Star", "star"], ["flower", "Flower", "image"]];
function renderSamples() {
  $("#samples").innerHTML = SAMPLE_LIST.map(([k, n, ic]) => `<a class="dl-nav__item" href="#studio" data-sample="${k}">${icon(ic)}<span class="dl-nav__label">${n}</span></a>`).join("");
}
function renderRecent() {
  $("#recent-head").hidden = !recent.length;
  $("#recent").innerHTML = recent.map((r) => `<a class="dl-nav__item" href="#studio" data-recent="${esc(r.id)}" title="${esc(r.prompt)}">${icon("history")}<span class="dl-nav__label">${esc(r.prompt)}</span><span class="dl-nav__count">${ago(r.at)}</span></a>`).join("");
}
function openRecent(id) {
  const r = recent.find((x) => x.id === id); if (!r) return;
  hideError(); setKeepTime(false); go("studio"); $("#prompt").value = r.prompt;
  steps.reset(); steps.set("picture", "done", "saved");
  setDrawing({ prompt: r.prompt, strokes: r.strokes, picture: r.svg ? { svg: r.svg } : null, meta: `${r.meta}, saved ${ago(r.at)} ago`.replace(", saved now ago", ", saved just now") });
  play();
}
function renderServices() {
  const gm = services.gemini.ready, vp = services.voice.provider;
  const voiceWord = { elevenlabs: "ElevenLabs", gemini: "Gemini voice", browser: "Browser voice" }[vp];
  $("#services").innerHTML =
    `<div class="cw-service"><span>Gemini</span><span class="dl-status" ${gm ? 'data-mark="dot"' : 'data-tone="warn"'}>${gm ? "Ready" : "No key"}</span></div>` +
    `<div class="cw-service"><span>Voice</span><span>${voiceWord}</span></div>`;
  $("#service-kv").innerHTML =
    `<dt>Gemini</dt><dd>${gm ? `Ready, ${esc(modelName(services.gemini.model))}` : "No key: add GEMINI_API_KEY to app/.env"}</dd>` +
    `<dt>Voice</dt><dd>${vp === "elevenlabs" ? "ElevenLabs" : `${voiceWord}, until an ElevenLabs key is added`}</dd>` +
    `<dt><label for="voice-id">ElevenLabs voice</label></dt><dd class="cw-voice"><input class="dl-input dl-mono" id="voice-id" placeholder="${esc(services.voice.voice || "")}" spellcheck="false"><button class="dl-btn dl-btn--secondary dl-btn--sm" type="button" id="voice-test">${icon("volume-2")}Hear it</button></dd>` +
    `<dt>Arm</dt><dd>${arm.connected() ? "Connected over USB" : "Not connected"}</dd>` +
    `<dt><label for="route">Picture</label></dt><dd><span class="dl-select"><select class="dl-input" id="route"><option value="svg">Vector drawing</option><option value="image">Image, then traced</option></select>${icon("chevron-down")}</span></dd>`;
  $("#route").value = S.route; $("#voice-id").value = S.voice || "";
}

// ---------- pages ----------
function go(page) {
  if (location.hash !== `#${page}`) history.replaceState(null, "", `#${page}`);
  showPage(page);
}
function showPage(page) {
  page = page === "arm" ? "arm" : "studio";
  $("#page-studio").hidden = page !== "studio"; $("#page-arm").hidden = page !== "arm";
  $$(".cw-rail [data-page]").forEach((a) => (a.dataset.page === page ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
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
      <div class="dl-field"><label class="dl-label" for="f-elbow">Elbow bends</label><span class="dl-select"><select class="dl-input" id="f-elbow" data-path="elbow" data-text><option value="up">Up</option><option value="down">Down</option></select>${icon("chevron-down")}</span></div>
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
  // what these numbers give, measured over a grid across the drawing square
  let ok = 0, n = 0, worst = 1;
  const { cx, cy } = { cx: 0, cy: gg.standoff + gg.board / 2 };
  for (let i = 0; i <= 20; i++) for (let k = 0; k <= 20; k++) {
    const x = cx - gg.half + (i / 20) * 2 * gg.half, y = cy - gg.half + (k / 20) * 2 * gg.half; n++;
    const a = toAngles([{ x, y, pen: 1 }], gg); if (a.unreachable || a.outOfRange) continue;
    ok++; const r2 = x * x + y * y, c2 = (r2 - gg.L1 ** 2 - gg.L2 ** 2) / (2 * gg.L1 * gg.L2); worst = Math.min(worst, Math.sqrt(Math.max(0, 1 - c2 * c2)));
  }
  const cover = Math.round((ok / n) * 100), step = (gg.L1 + gg.L2) * gg.servo.resolution * Math.PI / 180;
  $("#derived").innerHTML =
    `<dt>Reach</dt><dd>${mm(gg.L1 + gg.L2)}, inner limit ${mm(Math.abs(gg.L1 - gg.L2))}</dd>` +
    `<dt>Drawing square</dt><dd>${cover}% reachable within servo limits</dd>` +
    `<dt>Worst dexterity</dt><dd>${ok ? worst.toFixed(2) : "none reachable"}</dd>` +
    `<dt>Servo step at the tip</dt><dd>${step.toFixed(1)} mm at full stretch</dd>` +
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
  try {
    cfg = await saveConfig(c); applyConfig(); fillSetup(cfg); renderSetup();
    toast("Saved to arm.config.json");
  } catch (e) { $("#save-note").textContent = e.message; }
  finally { b.removeAttribute("aria-busy"); b.textContent = "Save"; renderSetup(); }
}
function applyConfig() {
  g = geomFrom(cfg); board.setGeom(g); sim.setGeom(g); v3?.setGeom(g, cfg.pen);
  buildJoints(); replan();
}

// ---------- command palette ----------
let palItems = [], palIndex = 0;
function commandList(q) {
  const list = [
    ...SAMPLE_LIST.map(([k, n, ic]) => ({ label: `Draw: ${n.toLowerCase()}`, icon: ic, run: () => run(k === "clock" ? "the time now" : k) })),
    { label: playing ? "Pause" : "Play the drawing", icon: playing ? "pause" : "play", hint: "", run: () => (playing ? pause() : play()), off: !active },
    { label: "Start again", icon: "rotate-ccw", run: () => seek(0), off: !active },
    { label: "Erase the board", icon: "eraser", run: eraseBoard },
    { label: keepTime ? "Stop keeping time" : "Keep time: redraw the clock every minute", icon: "clock", run: () => { go("studio"); setKeepTime(!keepTime); } },
    { label: S.physics ? "Ideal servos" : "Real servo limits", icon: "sliders-horizontal", run: () => togglePhysics() },
    { label: S.reach ? "Hide the reach" : "Show the reach", icon: "crosshair", run: () => toggleReach() },
    { label: "Board view", icon: "layout-grid", run: () => { go("studio"); setView("board"); } },
    { label: "Picture view", icon: "image", run: () => { go("studio"); setView("picture"); } },
    { label: "Angles view", icon: "list-checks", run: () => { go("studio"); setView("angles"); } },
    { label: "Arm setup", icon: "ruler", run: () => go("arm") },
    { label: arm.connected() ? "Send to arm" : "Connect the arm", icon: arm.connected() ? "send" : "usb", run: () => (arm.connected() ? sendToArm() : connectArm()) },
    { label: "Download the angles", icon: "download", run: () => $("#download").click(), off: !planned },
    { label: "Copy the angles", icon: "copy", run: () => $("#copy").click(), off: !planned },
    { label: S.narrate ? "Mute the arm" : "Let the arm speak", icon: S.narrate ? "volume-x" : "volume-2", run: () => toggleNarrate() },
  ].filter((c) => !c.off);
  const t = q.trim().toLowerCase();
  if (!t) return list;
  const hits = list.filter((c) => c.label.toLowerCase().includes(t));
  const drawIt = { label: `Draw “${q.trim()}”`, icon: "pencil", hint: "Gemini", run: () => run(q) };
  return hits.length && hits[0].label.toLowerCase().startsWith(t) ? [...hits, drawIt] : [drawIt, ...hits];
}
function openPalette() {
  const d = $("#palette"); if (d.open) { d.close(); return; }
  $("#palette-input").value = ""; renderPalette(); d.showModal(); $("#palette-input").focus();
}
function renderPalette() {
  palItems = commandList($("#palette-input").value); palIndex = 0;
  $("#palette-list").innerHTML = palItems.map((c, i) => `<li class="cw-palette__item" role="option" id="pal-${i}" data-i="${i}" aria-selected="${i === 0}">${icon(c.icon)}<span>${esc(c.label)}</span>${c.hint ? `<span class="cw-palette__hint">${c.hint}</span>` : ""}</li>`).join("");
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
function togglePhysics() { S.physics = !S.physics; store("clockwork.prefs", S); sim.physics = S.physics; $("#sw-physics").setAttribute("aria-checked", String(S.physics)); if (active) seek(sim.t); }
function toggleReach() { S.reach = !S.reach; store("clockwork.prefs", S); $("#sw-reach").setAttribute("aria-checked", String(S.reach)); draw(); }
function toggleNarrate() {
  S.narrate = !S.narrate; store("clockwork.prefs", S);
  const b = $("#narrate"); b.setAttribute("aria-pressed", String(S.narrate)); setIcon(b, S.narrate ? "volume-2" : "volume-x");
  b.title = b.ariaLabel = S.narrate ? "Arm speaks: on" : "Arm speaks: off";
  if (S.narrate) voice.say("I'll talk you through each drawing.", { voice: S.voice || undefined });
}

// ---------- events ----------
function wire() {
  $("#ask").addEventListener("submit", (e) => { e.preventDefault(); if ($("#draw").getAttribute("aria-busy") !== "true") run($("#prompt").value); });
  $("#views").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setView(b.dataset.view); });
  $("#cams").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || !v3) return;
    $$("#cams button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); v3.view(b.dataset.cam, sim.j);
  });
  $("#speed").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; speed = +b.dataset.speed; $$("#speed button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); });
  $("#play").addEventListener("click", () => (playing ? pause() : play()));
  $("#rewind").addEventListener("click", () => seek(0));
  $("#erase").addEventListener("click", eraseBoard);
  $("#scrub").addEventListener("input", () => { pause(); seek((($("#scrub").value | 0) / 1000) * (active?.total || 0)); syncLive(true); });
  $("#sw-physics").addEventListener("click", togglePhysics);
  $("#sw-reach").addEventListener("click", toggleReach);
  $("#sw-time").addEventListener("click", () => setKeepTime(!keepTime));
  $("#narrate").addEventListener("click", toggleNarrate);
  $("#send").addEventListener("click", () => {
    if (sending) { sending.abort(); pause(); return; }
    arm.connected() ? sendToArm() : connectArm();
  });
  $("#download").addEventListener("click", () => arm.download(stream(), `clockwork-${(drawing?.prompt || "drawing").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.json`));
  $("#copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(stream(), null, 2)); toast("Angles copied"); } catch (e) { showError("The browser would not copy. Use the download instead."); }
  });

  // mic: say it, and it draws when you stop
  let mic = null;
  const micBtn = $("#mic");
  if (!voice.canListen()) { micBtn.disabled = true; micBtn.title = "Speech input needs Chrome"; }
  micBtn.addEventListener("click", () => {
    if (mic) { mic.stop(); return; }
    try {
      micBtn.setAttribute("aria-pressed", "true");
      mic = voice.listen({ onResult: (t) => { $("#prompt").value = t; }, onEnd: (t) => { mic = null; micBtn.setAttribute("aria-pressed", "false"); if (t) run(t); } });
    } catch (e) { micBtn.setAttribute("aria-pressed", "false"); showError(e.message); }
  });

  // rail
  $("#samples").addEventListener("click", (e) => { const a = e.target.closest("[data-sample]"); if (!a) return; e.preventDefault(); run(a.dataset.sample === "clock" ? "the time now" : a.dataset.sample); });
  $("#recent").addEventListener("click", (e) => { const a = e.target.closest("[data-recent]"); if (!a) return; e.preventDefault(); openRecent(a.dataset.recent); });
  $$("[data-open-palette]").forEach((b) => b.addEventListener("click", openPalette));
  $("#nav-open").addEventListener("click", () => $("#app").toggleAttribute("data-nav-open"));
  $(".dl-scrim").addEventListener("click", () => $("#app").removeAttribute("data-nav-open"));
  addEventListener("hashchange", () => showPage(location.hash.slice(1)));
  document.addEventListener("change", (e) => {
    if (e.target.id === "route") { S.route = e.target.value; store("clockwork.prefs", S); }
    if (e.target.id === "voice-id") { S.voice = e.target.value.trim(); store("clockwork.prefs", S); }
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("#voice-test")) voice.say("Hello. I'm the Clockwork arm, and this is how I sound.", { voice: ($("#voice-id").value || "").trim() || undefined });
  });

  // keyboard: ⌘K opens the palette from anywhere
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); }
  });
  $("#palette-input").addEventListener("input", renderPalette);
  $("#palette-input").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); movePalette(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); movePalette(-1); }
    else if (e.key === "Enter") { e.preventDefault(); runPalette(); }
  });
  $("#palette-list").addEventListener("click", (e) => { const li = e.target.closest("[data-i]"); if (li) runPalette(+li.dataset.i); });
  $("#palette-list").addEventListener("pointermove", (e) => { const li = e.target.closest("[data-i]"); if (li && +li.dataset.i !== palIndex) movePalette(+li.dataset.i - palIndex); });
  $("#palette").addEventListener("click", (e) => { if (e.target === $("#palette")) $("#palette").close(); });

  // jog: drag on the board to move the pen by hand
  jogOn($("#board"), () => board, () => sim, (h) => { hover = h; }, () => !playing && !sending, () => { draw(); syncLive(true); kick(); if (sim.manual) arm.jog(sim.manual, g); });
  jogOn($("#setup-board"), () => setupBoard, () => setupSim, (h) => { setupHover = h; }, () => true, () => { renderSetup(); kickSetup(); });

  // setup form
  $("#setup").addEventListener("input", () => { setupSim.manual = null; renderSetup(); $("#save-note").textContent = dirty() ? "Not saved yet" : ""; });
  $("#save").addEventListener("click", save);
  $("#revert").addEventListener("click", () => { fillSetup(cfg); renderSetup(); });

  new ResizeObserver(() => { draw(); renderSetup(); }).observe($("#main"));
}

function jogOn(canvas, getBoard, getSim, setHover, allowed, redraw) {
  let down = false;
  const at = (e) => { const p = getBoard().toWorld(e.clientX, e.clientY); const s = getSim(); const ok = !!s && toAngles([{ ...p, pen: 0 }], s.g).unreachable === 0; return { ...p, ok }; };
  canvas.addEventListener("pointerdown", (e) => { if (!allowed()) return; down = true; cleaned = false; canvas.setPointerCapture(e.pointerId); const p = at(e); if (p.ok) getSim().jog(p.x, p.y); setHover(p); redraw(); });
  canvas.addEventListener("pointermove", (e) => { const p = at(e); setHover(p); if (down && p.ok) getSim().jog(p.x, p.y); redraw(); });
  canvas.addEventListener("pointerup", () => { down = false; });
  canvas.addEventListener("pointerleave", () => { setHover(null); redraw(); });
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
  buildJoints(); buildSetup(); renderSamples(); renderRecent(); renderPicture(); renderAngles();
  $("#sw-physics").setAttribute("aria-checked", String(S.physics)); $("#sw-reach").setAttribute("aria-checked", String(S.reach));
  if (S.narrate) { S.narrate = false; toggleNarrate(); }
  $$("#steps .dl-step").forEach((li) => { li.dataset.state = "next"; });
  $("#retry").addEventListener("click", () => run(lastAsk));
  wire(); renderServices(); syncTransport(); syncLive(true); syncSend();
  showPage(location.hash.slice(1));
  fetch("./api/status").then((r) => r.json()).then((s) => { services = s; renderServices(); }).catch(() => renderServices());
  const ask = params.get("draw"); if (ask) run(ask);
}
start();
