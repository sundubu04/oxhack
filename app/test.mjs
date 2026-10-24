import { ik, fk, toAngles, GEOM, R2D } from "./src/ik.js";
import { samplePathD } from "./src/svg.js";
import { plan } from "./src/pathplan.js";
import { imageToStrokes } from "./src/vectorize.js";

// 1) IK round-trip over the clock region
let maxErr = 0, n = 0;
for (let i = 0; i < 360; i += 3) { const a = i / R2D, x = 90 * Math.cos(a), y = 215 + 90 * Math.sin(a);
  const s = ik(x, y, GEOM.L1, GEOM.L2); if (!s) continue; const f = fk(s.t1, s.t2, GEOM.L1, GEOM.L2); maxErr = Math.max(maxErr, Math.hypot(f.px - x, f.py - y)); n++; }
console.log("IK round-trip:", n, "pts, max err", maxErr.toExponential(2), "mm");

// 2) SVG path -> strokes
const strokes = samplePathD("M10 10 L90 10 L90 90 L10 90 Z M30 30 C 40 10, 70 10, 80 40");
console.log("SVG parse:", strokes.length, "strokes,", strokes.reduce((a,s)=>a+s.length,0), "points");

// 3) plan -> toolpath + angle stream
const pl = plan(strokes, GEOM);
const ang = toAngles(pl.toolpath, GEOM);
console.log("plan: toolpath", pl.toolpath.length, "ink", pl.ink, "mm travel", pl.travel, "mm | unreachable", ang.unreachable, "worstDex", ang.worstDex);
console.log("first draw angle:", ang.path.find(p=>p.tilt===GEOM.tilt.draw));

// 4) raster vectorize: a 40x40 image with a filled square
const W=40,H=40,data=new Uint8ClampedArray(W*H*4).fill(255);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const ink=(x>=8&&x<32&&y>=8&&y<32);const i=(y*W+x)*4;if(ink){data[i]=data[i+1]=data[i+2]=0;}data[i+3]=255;}
const rs = imageToStrokes({data,width:W,height:H},{threshold:128,minLen:8});
console.log("vectorize square:", rs.length, "contour(s),", rs[0]?.length, "pts (expect ~4-5 corners)");

// 5) the live sim: ideal servos lay the planned ink. An SG92R's 1° dead band trails the command (a few mm off);
//    compensation plus a lead-in to each stroke takes that out, in the model at least.
import { geomFrom, DEFAULT_CONFIG } from "./src/config.js";
import { makeJob, Sim } from "./src/sim.js";
import { erasePlan } from "./src/pathplan.js";
const G = geomFrom(DEFAULT_CONFIG);
const face = [Array.from({ length: 73 }, (_, k) => ({ x: 50 + 44 * Math.cos(k / 72 * 2 * Math.PI), y: 50 + 44 * Math.sin(k / 72 * 2 * Math.PI) }))];
for (let h = 0; h < 12; h++) { const a = h / 12 * 2 * Math.PI; face.push([{ x: 50 + 39.6 * Math.sin(a), y: 50 - 39.6 * Math.cos(a) }, { x: 50 + 42.7 * Math.sin(a), y: 50 - 42.7 * Math.cos(a) }]); }
for (const [name, physics, smoothing] of [["ideal", false, true], ["SG92R, raw", true, false], ["SG92R, compensated + lead-in", true, true]]) {
  const g = { ...G, servo: { ...G.servo, compensate: smoothing } };
  const fp = plan(face, g, { half: g.half, leadIn: smoothing ? g.leadIn : 0 }), job = makeJob(fp.toolpath, toAngles(fp.toolpath, g), g);
  const s = new Sim(g); s.physics = physics; s.load(job); let ink = 0;
  s.advance(job.total + 0.5, (a, b, m) => { if (m === "draw") ink += Math.hypot(b.x - a.x, b.y - a.y); });
  console.log(`sim ${name}: ${job.total.toFixed(1)} s, plan ink ${fp.ink} mm, sim ink ${Math.round(ink)} mm, off the line max ${s.dev.max.toFixed(2)} mm, mean ${(s.dev.sum / s.dev.n).toFixed(2)} mm`);
}
const ep = erasePlan(G), ea = toAngles(ep.toolpath, G);
console.log(`erase pass: ${ep.toolpath.length} pts, ${makeJob(ep.toolpath, ea, G).total.toFixed(1)} s, ${ea.outOfRange} past servo limits`);
