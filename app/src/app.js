import { ik, fk, toAngles, GEOM, R2D } from "./ik.js";
import { parseSVG } from "./svg.js";
import { plan } from "./pathplan.js";
import { imageToStrokes } from "./vectorize.js";
import * as gemini from "./gemini.js";
import * as voice from "./voice.js";
import * as arm from "./arm.js";
import { SAMPLES, clockSVG } from "./sample.js";

const $ = s => document.querySelector(s);
const SKEY = "clockwork.settings";
const defaults = { gkey: "", gmodel: "gemini-2.5-flash", gimg: "gemini-2.5-flash-image", route: "svg", ekey: "", evoice: "JBFqnCBsd6RMkjVDRZzb", L1: 180, L2: 180, standoff: 40, half: 90 };
let S = load();
function load() { try { return { ...defaults, ...JSON.parse(localStorage.getItem(SKEY) || "{}") }; } catch (e) { return { ...defaults }; } }
function persist() { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) {} }
function geom() { return { ...GEOM, L1: +S.L1, L2: +S.L2, standoff: +S.standoff }; }

let cur = { svg: null, strokes: null, plan: null, angles: null, speed: 150 };
let narrateOn = false;

// ---------- toast + steps ----------
let toastT;
function toast(msg, tone) { let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); } t.textContent = msg; t.dataset.tone = tone || ""; clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 3200); }
function step(name, state, text) { const li = document.querySelector(`.steps li[data-step="${name}"]`); if (!li) return; if (state) li.dataset.state = state; if (text != null) li.querySelector(".t").textContent = text; }
function resetSteps() { document.querySelectorAll(".steps li").forEach(li => { li.dataset.state = ""; li.querySelector(".t").textContent = ""; }); }

// ---------- preview rendering ----------
function showImage(html) { const v = $("#view-image"); v.innerHTML = html; }
function viewTab(t) {
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("active", b.dataset.t === t));
  $("#view-image").hidden = t !== "image"; $("#view-path").hidden = t !== "path"; $("#view-arm").hidden = t !== "arm";
  if (t === "path") drawPath(); if (t === "arm") drawArm(armAnim.i);
}
function fitCanvas(cv) {
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = r.width * dpr; cv.height = r.height * dpr; const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = geom(), topY = g.standoff + 350 + 30, halfX = 190, scale = Math.min(r.width / (2 * halfX), r.height / topY), ox = r.width / 2, oy = r.height - 14;
  return { ctx, r, scale, g, P: (x, y) => [ox + x * scale, oy - y * scale] };
}
function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function board(ctx, P, g, scale, r) {
  ctx.clearRect(0, 0, r.width, r.height);
  const bl = P(-175, g.standoff), tr = P(175, g.standoff + 350);
  ctx.strokeStyle = css("--border-2"); ctx.lineWidth = 1.5; ctx.strokeRect(bl[0], tr[1], tr[0] - bl[0], bl[1] - tr[1]);
}
function drawPath() {
  const cv = $("#view-path"); const { ctx, P, g, scale, r } = fitCanvas(cv); board(ctx, P, g, scale, r);
  if (!cur.plan) return; const tp = cur.plan.toolpath;
  // travel
  ctx.strokeStyle = css("--travel"); ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath();
  for (let i = 1; i < tp.length; i++) if (tp[i].pen === 0) { const a = P(tp[i - 1].x, tp[i - 1].y), b = P(tp[i].x, tp[i].y); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke(); ctx.setLineDash([]);
  // ink
  ctx.strokeStyle = css("--accent"); ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
  for (let i = 1; i < tp.length; i++) if (tp[i].pen === 1) { const a = P(tp[i - 1].x, tp[i - 1].y), b = P(tp[i].x, tp[i].y); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
}
let armAnim = { on: false, i: 0, last: 0, acc: 0 };
function drawArm(idx) {
  const cv = $("#view-arm"); const { ctx, P, g, scale, r } = fitCanvas(cv); board(ctx, P, g, scale, r);
  if (!cur.plan) return; const tp = cur.plan.toolpath; idx = Math.min(idx, tp.length - 1);
  // trace so far
  ctx.strokeStyle = css("--accent"); ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.beginPath();
  for (let i = 1; i <= idx; i++) if (tp[i].pen === 1) { const a = P(tp[i - 1].x, tp[i - 1].y), b = P(tp[i].x, tp[i].y); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
  // arm
  const pt = tp[idx], s = ik(pt.x, pt.y, g.L1, g.L2, g.elbowUp); if (!s) return;
  const f = fk(s.t1, s.t2, g.L1, g.L2), base = P(0, 0), elb = P(f.ex, f.ey), pen = P(f.px, f.py);
  ctx.strokeStyle = css("--text"); ctx.lineWidth = 5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(elb[0], elb[1]); ctx.lineTo(pen[0], pen[1]); ctx.stroke();
  ctx.fillStyle = css("--text-3"); ctx.fillRect(base[0] - 7, base[1] - 5, 14, 12);
  ctx.fillStyle = css("--bg"); ctx.strokeStyle = css("--text"); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(elb[0], elb[1], 4, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = pt.pen ? css("--accent") : css("--text-3"); ctx.beginPath(); ctx.arc(pen[0], pen[1], pt.pen ? 4 : 3, 0, 7); ctx.fill();
}
function tickArm(ts) {
  if (!armAnim.on) return; const dt = Math.min(0.05, (ts - armAnim.last) / 1000 || 0); armAnim.last = ts;
  const tp = cur.plan.toolpath; armAnim.acc += cur.speed * dt;
  while (armAnim.acc > 0 && armAnim.i < tp.length - 1) { const a = tp[armAnim.i], b = tp[armAnim.i + 1], d = Math.hypot(b.x - a.x, b.y - a.y) || 0.01; if (armAnim.acc >= d) { armAnim.acc -= d; armAnim.i++; } else break; }
  drawArm(armAnim.i);
  if (armAnim.i >= tp.length - 1) { armAnim.on = false; $("#play").textContent = "Preview draw"; return; } requestAnimationFrame(tickArm);
}

// ---------- the pipeline ----------
async function rasterToStrokes(url) {
  const img = new Image(); img.crossOrigin = "anonymous"; await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const N = 256, c = document.createElement("canvas"); c.width = c.height = N; const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, N, N); const s = Math.min(N / img.width, N / img.height); const w = img.width * s, h = img.height * s;
  x.drawImage(img, (N - w) / 2, (N - h) / 2, w, h);
  return imageToStrokes(x.getImageData(0, 0, N, N), { threshold: 140, minLen: 14, simplify: 1.5 });
}
async function run(promptText) {
  promptText = (promptText || "").trim(); if (!promptText) { toast("Type or say what to draw."); return; }
  resetSteps(); $("#draw").disabled = true; $("#draw").textContent = "Drawing…";
  const g = geom(); const lc = promptText.toLowerCase();
  try {
    step("prompt", "run"); step("prompt", "done", "ok");
    step("image", "run"); const t0 = performance.now();
    let strokes;
    if (lc === "clock" || lc.includes("clock")) { const svg = clockSVG(); showImage(svg); strokes = parseSVG(svg); }
    else if (SAMPLES[lc]) { showImage(SAMPLES[lc]); strokes = parseSVG(SAMPLES[lc]); }
    else if (S.gkey && S.route === "image") { const url = await gemini.generateImage(promptText, { key: S.gkey, model: S.gimg }); showImage(`<img src="${url}" alt="">`); strokes = await rasterToStrokes(url); }
    else if (S.gkey) { const svg = await gemini.generateSVG(promptText, { key: S.gkey, model: S.gmodel }); showImage(svg); strokes = parseSVG(svg); }
    else { step("image", "err", "no key"); toast("Add a Gemini key in Settings, or pick a sample.", "err"); return; }
    if (!strokes || !strokes.length) { step("image", "err"); toast("Couldn't get drawable lines from that.", "err"); return; }
    step("image", "done", `${(performance.now() - t0 | 0)} ms`);

    step("path", "run"); const t1 = performance.now();
    cur.strokes = strokes; cur.plan = plan(strokes, g, { half: +S.half });
    step("path", "done", `${(performance.now() - t1 | 0)} ms`);

    step("angles", "run");
    cur.angles = toAngles(cur.plan.toolpath, g);
    const n = cur.plan.toolpath.length, time = (cur.plan.ink + cur.plan.travel) / cur.speed;
    step("angles", "done", `${n} pts`);

    // stats
    $("#s-strokes").textContent = cur.plan.strokes.length;
    $("#s-ink").textContent = cur.plan.ink; $("#s-travel").textContent = cur.plan.travel;
    const dexEl = $("#s-dex"); dexEl.textContent = cur.angles.worstDex.toFixed(2); dexEl.dataset.tone = cur.angles.worstDex > 0.5 ? "ok" : cur.angles.worstDex > 0.3 ? "warn" : "stop";
    $("#s-time").textContent = time.toFixed(0) + " s";
    const rEl = $("#s-reach"); rEl.textContent = cur.angles.unreachable; rEl.dataset.tone = cur.angles.unreachable ? "stop" : "ok";

    ["#play", "#copy", "#download", "#send"].forEach(id => { $(id).disabled = false; }); $("#send").disabled = !arm.connected();
    armAnim.i = 0; drawPath(); drawArm(0);
    step("ready", "done", cur.angles.unreachable ? "check reach" : "✓");
    if (narrateOn && S.ekey) voice.speak(`Drawing ${promptText}. ${cur.plan.strokes.length} strokes, about ${time.toFixed(0)} seconds.`, { key: S.ekey, voice: S.evoice }).catch(() => {});
  } catch (e) {
    step("image", "err"); toast(String(e.message || e), "err");
  } finally { $("#draw").disabled = false; $("#draw").textContent = "Draw ⏎"; }
}

// ---------- settings dialog ----------
function openSettings() {
  $("#set-gkey").value = S.gkey; $("#set-gmodel").value = S.gmodel; $("#set-gimg").value = S.gimg; $("#set-route").value = S.route;
  $("#set-ekey").value = S.ekey; $("#set-evoice").value = S.evoice; $("#set-l1").value = S.L1; $("#set-l2").value = S.L2; $("#set-standoff").value = S.standoff; $("#set-half").value = S.half;
  $("#settings").showModal();
}
$("#settings").addEventListener("close", () => {
  if ($("#settings").returnValue !== "save") return;
  S = { ...S, gkey: $("#set-gkey").value.trim(), gmodel: $("#set-gmodel").value.trim() || defaults.gmodel, gimg: $("#set-gimg").value.trim() || defaults.gimg, route: $("#set-route").value, ekey: $("#set-ekey").value.trim(), evoice: $("#set-evoice").value.trim() || defaults.evoice, L1: +$("#set-l1").value, L2: +$("#set-l2").value, standoff: +$("#set-standoff").value, half: +$("#set-half").value };
  persist(); if (cur.plan) run($("#prompt").value); toast("Saved.");
});
$("#set-connect").addEventListener("click", async () => { try { await arm.connect(); setArm(true); toast("Arm connected."); } catch (e) { toast(String(e.message || e), "err"); } });
function setArm(on) { const c = $("#arm-status"); c.textContent = on ? "Arm: connected" : "Arm: offline"; if (on) c.dataset.on = "1"; else delete c.dataset.on; if (cur.plan) $("#send").disabled = !on; }

// ---------- events ----------
$("#settings-btn").addEventListener("click", openSettings);
$("#draw").addEventListener("click", () => run($("#prompt").value));
$("#prompt").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run($("#prompt").value); } });
$("#samples").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; const map = { clock: "clock", house: "house", cat: "cat", star: "star", flower: "flower" }; $("#prompt").value = b.dataset.s; run(map[b.dataset.s]); });
$("#tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) viewTab(b.dataset.t); });
$("#play").addEventListener("click", () => {
  if (!cur.plan) return; viewTab("arm");
  if (armAnim.on) { armAnim.on = false; $("#play").textContent = "Preview draw"; return; }
  if (armAnim.i >= cur.plan.toolpath.length - 1) armAnim.i = 0;
  armAnim.on = true; armAnim.last = performance.now(); $("#play").textContent = "Pause"; requestAnimationFrame(tickArm);
});
$("#copy").addEventListener("click", async () => { try { await navigator.clipboard.writeText(JSON.stringify(streamObj(), null, 2)); toast("Angle stream copied."); } catch (e) { toast("Copy failed.", "err"); } });
$("#download").addEventListener("click", () => arm.download(streamObj(), "clockwork-angles.json"));
$("#send").addEventListener("click", async () => {
  if (!arm.connected()) { toast("Connect the arm in Settings first.", "err"); return; }
  $("#send").disabled = true; $("#send").textContent = "Sending…";
  try { await arm.send(cur.angles.path, { onProgress: (i, n) => { $("#send").textContent = `Sending ${i}/${n}`; } }); toast("Sent to arm."); }
  catch (e) { toast(String(e.message || e), "err"); }
  finally { $("#send").disabled = false; $("#send").textContent = "Send to arm"; }
});
$("#narrate").addEventListener("click", () => { narrateOn = !narrateOn; $("#narrate").classList.toggle("ghost", !narrateOn); $("#narrate").textContent = narrateOn ? "🔊 Narrate on" : "🔊 Narrate"; if (narrateOn && !S.ekey) toast("Add an ElevenLabs key in Settings for voice."); });
let mic;
$("#mic").addEventListener("click", () => {
  if (mic) { mic.stop(); mic = null; $("#mic").removeAttribute("data-on"); return; }
  try { $("#mic").dataset.on = "1"; mic = voice.listen({ onResult: (t) => { $("#prompt").value = t; }, onEnd: (t) => { mic = null; $("#mic").removeAttribute("data-on"); if (t) run(t); } }); }
  catch (e) { $("#mic").removeAttribute("data-on"); toast(String(e.message || e), "err"); }
});
function streamObj() {
  const g = geom();
  return { mechanism: "serial 2-link + rolling-ball tip", geom_mm: { L1: g.L1, L2: g.L2, standoff: g.standoff }, tilt_deg: g.tilt, feed_mm_s: cur.speed, worst_dexterity: cur.angles.worstDex, out_of_reach: cur.angles.unreachable, path: cur.angles.path };
}

new ResizeObserver(() => { if (!$("#view-path").hidden) drawPath(); if (!$("#view-arm").hidden) drawArm(armAnim.i); }).observe($(".stage"));
if (arm.connected()) setArm(true);
