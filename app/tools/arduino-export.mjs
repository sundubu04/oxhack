// Files for running the arm straight from an Arduino, without the app:
//   arm_config.h  pins, pulse widths, zero offsets, limits, link lengths, the park pose and the pen tilts, from
//                 app/arm.config.json, into every sketch in firmware/
//   drawing.h     (with a drawing named) one drawing planned exactly as the app plans it: fitted, ordered, solved
//                 for joint angles, timed and compensated, as keyframes firmware/playback plays by itself
//
//   node tools/arduino-export.mjs                    arm_config.h only
//   node tools/arduino-export.mjs <what> [options]   and drawing.h
//     what: square | circle | calibrate | house | cat | star | flower | clock | "text:Hello|second line"
//           | path/to/file.svg | anything else, which is asked of GPT (OPENAI_API_KEY in app/.env)
//     --speed 0.5   play at half speed (steadier for a first run)      --wipe   wipe the drawing area first
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { geomFrom, withDefaults, servoAngle } from "../src/config.js";
import { drawPath, erasePlan } from "../src/pathplan.js";
import { toAngles, toolPoint } from "../src/ik.js";
import { makeJob, homePose } from "../src/sim.js";
import { keyframes } from "../src/arm.js";
import { emptyScene, applyActions, sceneStrokes } from "../src/scene.js";
import { SAMPLES, clockSVG } from "../src/sample.js";

const APP = new URL("../", import.meta.url), FW = new URL("../../firmware/", import.meta.url);
const cfg = withDefaults(JSON.parse(readFileSync(new URL("arm.config.json", APP), "utf8")));
const g = geomFrom(cfg), ard = cfg.arduino;
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args.splice(i, 2)[1]; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const speed = Math.max(0.1, Math.min(2, +opt("--speed", 1))), wipe = flag("--wipe"), what = args.join(" ").trim();

const cd = (j, a) => Math.round(Math.max(0, Math.min(180, servoAngle(j, a, g))) * 100);   // centi-degrees of servo travel
const home = homePose(g), PARK = [cd("base", home.base), cd("elbow", home.elbow), cd("tilt", home.tilt)];
const D2R = Math.PI / 180, list = (a) => a.join(", ");

// ---------- arm_config.h ----------
const s = (j) => cfg.servos[j];
const config = `// Generated from app/arm.config.json by app/tools/arduino-export.mjs (${new Date().toISOString().slice(0, 16).replace("T", " ")}).
// Change the config (or the app's Arm setup page) and run "./firmware/arm config", not this file.
// Angles are centi-degrees of servo travel (0 to 18000) unless they say deg.
#pragma once
#define ARM_NAME "${cfg.name}"
const uint8_t PIN[3] = {${list(ard.pins)}};              // base, elbow, tilt signal pins
const int US_MIN[3] = {${list(ard.usMin)}};         // pulse at 0 deg of servo travel
const int US_MAX[3] = {${list(ard.usMax)}};      // pulse at 180 deg
const int16_t LIMIT_MIN[3] = {${list(["base", "elbow", "tilt"].map((j) => Math.round(+s(j).min * 100)))}};
const int16_t LIMIT_MAX[3] = {${list(["base", "elbow", "tilt"].map((j) => Math.round(+s(j).max * 100)))}};
const int16_t PARK[3] = {${list(PARK)}};       // beside the drawing, pen lifted
const int16_t TILT_DRAW = ${cd("tilt", g.tilt.draw)}, TILT_LIFT = ${cd("tilt", g.tilt.lift)}, TILT_ERASE = ${cd("tilt", g.tilt.erase)};
// geometry for moving the pen to a board point: servo deg = OFFSET + DIR * RATIO * joint deg
const float OFFSET[3] = {${list(["base", "elbow", "tilt"].map((j) => +s(j).offset))}}, DIR[3] = {${list(["base", "elbow", "tilt"].map((j) => +s(j).dir))}}, RATIO[3] = {${list(["base", "elbow", "tilt"].map((j) => +s(j).ratio || 1))}};
const float L1 = ${g.L1}, L2 = ${g.L2}, NIB_SIDE = ${(+g.nibSide).toFixed(2)};   // mm; the nib sits NIB_SIDE across the forearm's tip
// a servo told to stop dead overshoots: moves the board makes itself (park, jog, the motor test) speed up and slow
// down at SERVO_ACCEL (deg/s²), the motor test's pen at PEN_ACCEL (mm/s²), and a stop eases out over STOP_MS
const float SERVO_ACCEL = ${g.servo.accel}, PEN_ACCEL = ${g.accel};
const uint16_t STOP_MS = ${Math.round(1000 * g.travelSpeed / g.accel)};
const bool ELBOW_UP = ${g.elbowUp};
const float BOARD_CX = 0, BOARD_CY = ${g.standoff + g.board / 2};   // mm from the base: the middle of the drawing area
`;
for (const sketch of ["clockedin", "servo-test", "playback"]) if (existsSync(new URL(`${sketch}/`, FW))) writeFileSync(new URL(`${sketch}/arm_config.h`, FW), config);
console.log(`arm_config.h written: park ${PARK.map((v) => v / 100).join(" / ")} deg, pen ${cd("tilt", g.tilt.draw) / 100} down, ${cd("tilt", g.tilt.lift) / 100} up`);
if (!what) process.exit(0);

// ---------- the drawing ----------
const SHAPES = {
  square: '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80"/></svg>',
  circle: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>',
  // a square, the circle inside it and a cross through the middle: sides should be straight, the circle round
  // and touching the square, the cross through its centre
  calibrate: '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80"/><circle cx="50" cy="50" r="40"/><line x1="50" y1="20" x2="50" y2="80"/><line x1="20" y1="50" x2="80" y2="50"/></svg>',
};
async function sceneFor(w) {
  const draw = (svg) => applyActions(emptyScene(), [{ type: "draw", id: "drawing", name: w, svg }]).scene;
  if (SHAPES[w]) return draw(SHAPES[w]);
  if (SAMPLES[w]) return draw(SAMPLES[w]);
  if (w === "clock") return draw(clockSVG(new Date()));
  if (/^text:/i.test(w)) return applyActions(emptyScene(), [{ type: "write", id: "text", align: "center", lines: w.slice(5).split("|").map((t) => ({ text: t.trim(), check: null })) }]).scene;
  if (/\.svg$/i.test(w)) return draw(readFileSync(w, "utf8"));
  process.loadEnvFile(new URL(".env", APP));
  const gpt = await import("../lib/openai.mjs");
  const models = (process.env.OPENAI_MODELS || "gpt-6.1-sol:low,gpt-5.6-sol:low,gpt-6-luna:low").split(",");
  console.log(`asking GPT to draw "${w}"…`);
  const out = await gpt.chat([{ role: "user", text: w }], [], null, { key: process.env.OPENAI_API_KEY, models, timeoutMs: 30000 });
  console.log(`  ${out.model}: ${out.reply}`);
  return applyActions(emptyScene(), out.actions.filter((a) => a.type !== "repeat")).scene;
}
const scene = await sceneFor(what);
const strokes = sceneStrokes(scene, g);
if (!strokes.length) { console.error("Nothing to draw."); process.exit(1); }

const start = toolPoint(home.base * D2R, home.elbow * D2R, g);
const tp = [];
if (wipe) tp.push(...erasePlan(g).toolpath);
tp.push(...drawPath(strokes, { from: tp.at(-1) || start, leadIn: g.leadIn }).toolpath);
tp.push({ ...start, pen: 0 });   // and back to the park pose, pen up
const angles = toAngles(tp, g), job = makeJob(tp, angles, g);
// the job starts at the park pose and every move in it speeds up and slows down (makeJob); played slower, its
// accelerations drop with the square of the speed
let keys = keyframes(job, g).map((k) => ({ t: Math.round(k.t / speed), a: k.a }));

// drop keyframes the board would rebuild anyway (it moves linearly between keyframes): from each kept one, reach
// as far ahead as every keyframe in between stays within 0.15 deg of the straight line and the pen doesn't change
const TOL = 15, kept = [keys[0]];
const fits = (a, b) => { for (let i = a + 1; i < b; i++) { const k = keys[i], u = (k.t - keys[a].t) / (keys[b].t - keys[a].t || 1); if (k.a[2] !== keys[a].a[2] || k.a.some((v, j) => Math.abs(keys[a].a[j] + (keys[b].a[j] - keys[a].a[j]) * u - v) > TOL)) return false; } return keys[a].a[2] === keys[b].a[2] || b === a + 1; };
for (let a = 0; a < keys.length - 1; ) { let b = a + 1; while (b + 1 < keys.length && fits(a, b + 1)) b++; kept.push(keys[b]); a = b; }
// the board's own interpolation over the kept keyframes, against the full plan, every 20 ms
const at = (K, t) => { let h = 0; while (h + 1 < K.length && K[h + 1].t <= t) h++; const a = K[h], b = K[h + 1]; if (!b) return a.a; const u = (t - a.t) / (b.t - a.t); return a.a.map((v, j) => v + (b.a[j] - v) * u); };
let worst = 0; for (let t = 0; t <= kept.at(-1).t; t += 20) { const x = at(keys, t), y = at(kept, t); worst = Math.max(worst, ...x.map((v, j) => Math.abs(v - y[j]))); }

// delays between keyframes as 16-bit milliseconds
const rows = []; let prevT = 0;
for (const k of kept) { const dt = k.t - prevT; if (dt > 65535) { console.error("A move takes over a minute: use a higher --speed."); process.exit(2); } rows.push([dt, ...k.a]); prevT = k.t; }
const bytes = rows.length * 8, room = 32256 - 8600;   // the playback sketch itself is about 8.5 KB
const header = `// Generated by app/tools/arduino-export.mjs (${new Date().toISOString().slice(0, 16).replace("T", " ")}): "${what.replace(/"/g, "'")}"${wipe ? ", wiping first" : ""}${speed !== 1 ? `, at ${speed}x speed` : ""}.
// ${strokes.length} strokes, ${tp.length} waypoints, ${rows.length} keyframes, ${(prevT / 1000).toFixed(1)} s. Planned as the app plans it, for the arm in app/arm.config.json.
// Each row: { ms since the previous row, base, elbow, tilt } in centi-degrees of servo travel.
#pragma once
#define DRAWING_NAME "${what.replace(/["\\]/g, "").slice(0, 40)}"
const uint16_t DRAWING_KEYS = ${rows.length};
const uint32_t DRAWING_MS = ${prevT}UL;
const uint16_t DRAWING[][4] PROGMEM = {
${rows.map((r) => `  {${r.join(", ")}},`).join("\n")}
};
`;
writeFileSync(new URL("playback/drawing.h", FW), header);
console.log(`drawing.h written: "${what}", ${strokes.length} strokes, ${rows.length} keyframes (from ${keys.length}, at most ${(worst / 100).toFixed(2)} deg off), ${(prevT / 1000).toFixed(1)} s, ${(bytes / 1024).toFixed(1)} KB of flash`);
if (angles.unreachable || angles.outOfRange) console.log(`  warning: ${angles.unreachable} points out of reach and ${angles.outOfRange} past a servo's range; check the drawing size and the zero offsets`);
if (bytes > room) { console.error(`  too big for an Uno or Nano (about ${(room / 1024).toFixed(0)} KB free): draw something simpler, or use a Mega (BOARD=arduino:avr:mega)`); process.exit(2); }
