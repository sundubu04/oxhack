import { geomFrom, withDefaults } from "../src/config.js";
import { readFileSync } from "node:fs";
import { plan } from "../src/pathplan.js";
import { toAngles, ik, R2D } from "../src/ik.js";
import { makeJob, Sim } from "../src/sim.js";
import { writeFileSync } from "node:fs";
const out = process.argv[2] || ".";
// the arm as configured: measure the real dead band and gear play, put them in Arm setup, and run this again
const base = geomFrom(withDefaults(JSON.parse(readFileSync(new URL("../arm.config.json", import.meta.url), "utf8"))));
const band = base.servo.resolution, play = base.servo.backlash || 1;
// Compares servo models on the clock face: node tools/compare-servos.mjs <dir> writes <dir>/smooth.html.
// the clock face at 10:10, as the app draws it
const face = [Array.from({ length: 73 }, (_, k) => ({ x: 50 + 44 * Math.cos(k / 72 * 2 * Math.PI), y: 50 + 44 * Math.sin(k / 72 * 2 * Math.PI) }))];
for (let h = 0; h < 12; h++) { const a = h / 12 * 2 * Math.PI, r0 = h % 3 ? 39.6 : 36.1; face.push([{ x: 50 + r0 * Math.sin(a), y: 50 - r0 * Math.cos(a) }, { x: 50 + 42.7 * Math.sin(a), y: 50 - 42.7 * Math.cos(a) }]); }
const ah = (10 + 10 / 60) / 12 * 2 * Math.PI, am = 10 / 60 * 2 * Math.PI;
face.push([{ x: 50, y: 50 }, { x: 50 + 22 * Math.sin(ah), y: 50 - 22 * Math.cos(ah) }], [{ x: 50, y: 50 }, { x: 50 + 34.3 * Math.sin(am), y: 50 - 34.3 * Math.cos(am) }]);

// joint travel the drawing square needs
let bmin = 1e9, bmax = -1e9, emin = 1e9, emax = -1e9;
const cy = base.standoff + base.board / 2;
for (let i = 0; i <= 40; i++) for (let k = 0; k <= 40; k++) {
  const s = ik(-base.half + i / 40 * 2 * base.half, cy - base.half + k / 40 * 2 * base.half, base.L1, base.L2, base.elbowUp); if (!s) continue;
  bmin = Math.min(bmin, s.t1 * R2D); bmax = Math.max(bmax, s.t1 * R2D); emin = Math.min(emin, s.t2 * R2D); emax = Math.max(emax, s.t2 * R2D);
}
console.log(`drawing square needs: base ${bmin.toFixed(1)}..${bmax.toFixed(1)} deg (${(bmax - bmin).toFixed(0)}), elbow ${emin.toFixed(1)}..${emax.toFixed(1)} deg (${(emax - emin).toFixed(0)})`);

const variants = [
  ["A", "Whole-degree commands, jumping waypoint to waypoint (the sim until now)", { model: "steps", smooth: false, comp: false }],
  ["B", `${band}° dead band, smooth µs commands (the Arduino firmware)`, { model: "deadband", comp: false }],
  ["C", `B plus ${play}° of gear play`, { model: "deadband", backlash: play, comp: false }],
  ["B+", "B with dead-band compensation", { model: "deadband" }],
  ["C+", "C with dead-band and play compensation", { model: "deadband", backlash: play }],
  ["B++", "B+ with a 3 mm lead-in to each stroke", { model: "deadband", lead: 3 }],
  ["C++", "C+ with a 3 mm lead-in", { model: "deadband", backlash: play, lead: 3 }],
  ["D", `C with a 2:1 reduction, no compensation`, { model: "deadband", backlash: play, ratio: 2, comp: false }],
  ["E", "Stepper, 0.1125° microsteps, direct", { model: "steps", res: 0.1125, comp: false }],
];
const cells = [];
for (const [id, label, o] of variants) {
  const g = structuredClone(base);
  if (o.res != null) g.servo.resolution = o.res;
  if (o.backlash) g.servo.backlash = o.backlash;
  g.servo.compensate = o.comp !== false;
  if (o.ratio) { g.servo.base = { ...g.servo.base, ratio: o.ratio, offset: 0, min: -360, max: 360 }; g.servo.elbow = { ...g.servo.elbow, ratio: o.ratio, offset: 0, min: -360, max: 360 }; }
  const p = plan(face, g, { half: g.half, leadIn: o.lead || 0 }), an = toAngles(p.toolpath, g), job = makeJob(p.toolpath, an, g);
  const sim = new Sim(g); sim.physics = o.physics !== false; sim.model = o.model || "deadband"; if (o.smooth === false) sim.smooth = false; sim.load(job);
  const segs = []; let ink = 0;
  sim.advance(job.total + 0.5, (a, b, m) => { if (m === "draw") { segs.push([a.x, a.y, b.x, b.y]); ink += Math.hypot(b.x - a.x, b.y - a.y); } });
  const r = { id, label, mean: sim.dev.sum / sim.dev.n, max: sim.dev.max, extra: (ink / p.ink - 1) * 100 };
  console.log(`${id} ${label.padEnd(72)} mean ${r.mean.toFixed(2)} mm  worst ${r.max.toFixed(2)} mm  ink ${r.extra >= 0 ? "+" : ""}${r.extra.toFixed(0)}%`);
  // draw: plan faint, sim ink black, 2 mm marker, around the drawing
  const x0 = -100, y1 = cy + 100, S = 3;
  const P = (x, y) => `${((x - x0) * S).toFixed(1)},${((y1 - y) * S).toFixed(1)}`;
  const planPath = p.toolpath.map((q, i) => (i && (q.pen) ? `L${P(q.x, q.y)}` : `M${P(q.x, q.y)}`)).join("");
  const inkPath = segs.map(([a, b, c, d]) => `M${P(a, b)}L${P(c, d)}`).join("");
  cells.push(`<figure><svg viewBox="0 0 600 600" width="300" height="300"><rect width="600" height="600" fill="#fff"/><path d="${planPath}" fill="none" stroke="#d6d6da" stroke-width="6" stroke-linecap="round"/><path d="${inkPath}" fill="none" stroke="#1d1d1f" stroke-width="6" stroke-linecap="round"/></svg><figcaption><b>${id}</b> ${label}<br>mean ${r.mean.toFixed(1)} mm · worst ${r.max.toFixed(1)} mm · ink ${r.extra >= 0 ? "+" : ""}${r.extra.toFixed(0)}%</figcaption></figure>`);
}
writeFileSync(`${out}/smooth.html`, `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;font:13px -apple-system,sans-serif;color:#1d1d1f;background:#f7f7f8;display:grid;grid-template-columns:repeat(3,300px);gap:16px}figure{margin:0}svg{display:block;border:1px solid #e5e5e8;background:#fff}figcaption{margin-top:6px;line-height:1.35}</style>${cells.join("")}`);
