// Where the clock's draw time goes, and how it moves with servo and pen speed: node tools/time-budget.mjs
// The numbers on the motion planning page (docs/pages/motion-planning.html) come from this run.
import { readFileSync } from "node:fs";
import { geomFrom, withDefaults } from "../src/config.js";
import { plan, fitStrokes, order } from "../src/pathplan.js";
import { toAngles, drawCentre } from "../src/ik.js";
import { makeJob, homePose, Sim } from "../src/sim.js";

const base = geomFrom(withDefaults(JSON.parse(readFileSync(new URL("../arm.config.json", import.meta.url), "utf8"))));
const G = (servo = {}, geom = {}) => { const g = structuredClone(base); Object.assign(g, geom); Object.assign(g.servo, servo); return g; };

// the clock face at 10:10, as tools/compare-servos.mjs draws it
const face = [Array.from({ length: 73 }, (_, k) => ({ x: 50 + 44 * Math.cos(k / 72 * 2 * Math.PI), y: 50 + 44 * Math.sin(k / 72 * 2 * Math.PI) }))];
for (let h = 0; h < 12; h++) { const a = h / 12 * 2 * Math.PI, r0 = h % 3 ? 39.6 : 36.1; face.push([{ x: 50 + r0 * Math.sin(a), y: 50 - r0 * Math.cos(a) }, { x: 50 + 42.7 * Math.sin(a), y: 50 - 42.7 * Math.cos(a) }]); }
const ah = (10 + 10 / 60) / 12 * 2 * Math.PI, am = 10 / 60 * 2 * Math.PI;
face.push([{ x: 50, y: 50 }, { x: 50 + 22 * Math.sin(ah), y: 50 - 22 * Math.cos(ah) }], [{ x: 50, y: 50 }, { x: 50 + 34.3 * Math.sin(am), y: 50 - 34.3 * Math.cos(am) }]);

const build = (g, leadIn = g.leadIn) => { const p = plan(face, g, { half: g.half, leadIn }), an = toAngles(p.toolpath, g); return { p, an, job: makeJob(p.toolpath, an, g) }; };

// Split the schedule into drawing, pen-up moves, tilt waits and the end hold; count the moves the servo slowed
// (where 1.2 x joint turn / servo speed beat distance / pen speed) and the fastest each joint turns.
function budget(g) {
  const { p, an, job } = build(g), home = homePose(g);
  const r = { draw: 0, travel: 0, dwell: 0, tilts: 0, first: job.tCmd[0], slowed: 0, peak: { draw: [0, 0], lift: [0, 0] } };
  for (let i = 0; i < job.n; i++) {
    const wait = job.tGo[i] - (i ? job.tCmd[i - 1] : 0), move = job.tCmd[i] - job.tGo[i];
    const q = p.toolpath[i], tool = i ? q.tool || (q.pen ? "draw" : "lift") : "lift";
    if (wait > 0) { r.dwell += wait; r.tilts++; }
    r[tool === "lift" ? "travel" : "draw"] += move;
    if (!i) continue;
    const a = an.path[i], f = an.path[i - 1], pp = p.toolpath[i - 1];
    const pen = Math.hypot(q.x - pp.x, q.y - pp.y) / (tool === "lift" ? g.travelSpeed : g.drawSpeed);
    const joint = 1.2 * Math.max(Math.abs(a.base - f.base), Math.abs(a.elbow - f.elbow)) / g.servo.speed;
    if (joint > pen) r.slowed++;
    const pk = r.peak[tool === "lift" ? "lift" : "draw"];
    pk[0] = Math.max(pk[0], Math.abs(a.base - f.base) / move); pk[1] = Math.max(pk[1], Math.abs(a.elbow - f.elbow) / move);
  }
  return { ...r, total: job.total, n: job.n, strokes: p.strokes.length, ink: p.ink, penUp: p.travel, home };
}

const f2 = (x) => x.toFixed(2), deg = (x) => Math.round(x);
const b = budget(G());
console.log(`clock at 10:10: ${b.strokes} strokes, ${b.n} waypoints, ${b.ink} mm of ink, ${b.penUp} mm pen-up between strokes`);
console.log(`total ${f2(b.total)} s = drawing ${f2(b.draw)} + pen-up moves ${f2(b.travel)} (first move from park ${f2(b.first)}) + tilt waits ${f2(b.dwell)} (${b.tilts} changes) + end hold 0.30`);
console.log(`pen tilts: draw ${base.tilt.draw.toFixed(1)}°, lift ${base.tilt.lift.toFixed(1)}°`);
console.log(`fastest joint turn: drawing base ${deg(b.peak.draw[0])}, elbow ${deg(b.peak.draw[1])} °/s; pen-up base ${deg(b.peak.lift[0])}, elbow ${deg(b.peak.lift[1])} °/s; servo set to ${base.servo.speed} °/s`);

console.log("\nservo top speed (°/s) -> clock time, moves the servo slowed");
for (const sp of [600, 400, 300, 200, 150, 100, 60]) { const r = budget(G({ speed: sp })); console.log(`  ${String(sp).padStart(3)}  ${f2(r.total)} s  ${r.slowed} of ${r.n}  (tilt waits ${f2(r.dwell)} s)`); }

console.log("\npen speed drawing / pen up (mm/s) -> clock time, fastest joint turn");
for (const ds of [100, 150, 200, 300, 400]) { const r = budget(G({}, { drawSpeed: ds, travelSpeed: 2 * ds })); console.log(`  ${ds}/${2 * ds}  ${f2(r.total)} s  ${deg(Math.max(...r.peak.draw, ...r.peak.lift))} °/s  ${r.slowed} moves slowed`); }

// a servo slower than the plan assumes, and one the plan knows about
const play = (job, g) => { const s = new Sim(g); s.load(job); let ink = 0; s.advance(job.total + 0.5, (a, c, m) => { if (m === "draw") ink += Math.hypot(c.x - a.x, c.y - a.y); }); return { worst: s.dev.max, mean: s.dev.sum / s.dev.n, ink }; };
const at600 = build(G());
console.log("\nreal servo speed: planned for 600 °/s | planned for the real speed");
for (const sp of [600, 300, 150, 100, 60]) {
  const wrong = play(at600.job, G({ speed: sp })), right = build(G({ speed: sp })), ok = play(right.job, G({ speed: sp }));
  console.log(`  ${String(sp).padStart(3)} °/s: worst ${f2(wrong.worst)} mm | ${f2(right.job.total)} s, worst ${f2(ok.worst)} mm`);
}

// stroke order: as given, greedy (what plan() does), and greedy plus a 2-opt pass (not in the app)
const { cx, cy } = drawCentre(base), fitted = fitStrokes(face, base.half, cx, cy);
const gap = (ss) => ss.slice(1).reduce((t, s, i) => t + Math.hypot(s[0].x - ss[i].at(-1).x, s[0].y - ss[i].at(-1).y), 0);
let best = order(fitted), bt = gap(best);
for (let better = true; better;) {
  better = false;
  for (let i = 0; i < best.length - 1; i++) for (let j = i + 1; j < best.length; j++) {
    const c = [...best.slice(0, i), ...best.slice(i, j + 1).reverse().map((s) => s.slice().reverse()), ...best.slice(j + 1)], ct = gap(c);
    if (ct < bt - 1e-6) { best = c; bt = ct; better = true; }
  }
}
console.log(`\npen-up travel between strokes: as given ${Math.round(gap(fitted))} mm, greedy ${Math.round(gap(order(fitted)))} mm, greedy + 2-opt ${Math.round(bt)} mm`);
console.log(`lead-in costs ${f2(at600.job.total - build(G(), 0).job.total)} s`);

for (let w = 0; w < 20; w++) build(G());
const t0 = performance.now(); for (let w = 0; w < 200; w++) build(G());
console.log(`plan + angles + timing: ${((performance.now() - t0) / 200).toFixed(2)} ms per clock`);
