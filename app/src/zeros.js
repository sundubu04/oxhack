// Where each servo's zero should sit. A servo turns 180 deg, the joints need more than that to reach the whole
// board, so the zero decides which part of the board the arm gives up. bestZeros picks the base and elbow zeros
// that keep the most of the reachable board inside both servos' travel, while the drawing square, the wipe and the
// park pose always fit with a few degrees to spare.
import { ikTool, R2D } from "./ik.js";
import { erasePlan } from "./pathplan.js";
import { homePose } from "./sim.js";

const SPARE = 5;   // deg kept between what the app must reach and the end of a servo's travel

const at = (g, x, y, tool = "draw") => { const s = ikTool(x, y, g, tool); return s && [s.t1 * R2D, s.t2 * R2D]; };
// joint angles for every 5 mm of the board the nib can reach
function reach(g) {
  const board = [];
  for (let x = -g.boardW / 2; x <= g.boardW / 2; x += 5) for (let y = g.standoff; y <= g.standoff + g.board; y += 5) { const a = at(g, x, y); if (a) board.push(a); }
  return board;
}
// and what the app must always reach: the drawing square, the wipe (with either end) and the park pose
function joints(g) {
  const board = reach(g), need = [], cy = g.standoff + g.board / 2, at2 = (x, y, tool) => at(g, x, y, tool);
  for (let i = 0; i <= 20; i++) for (let k = 0; k <= 20; k++) need.push(at2(-g.half + i / 10 * g.half, cy - g.half + k / 10 * g.half));
  for (const p of erasePlan(g).toolpath) need.push(at2(p.x, p.y, p.tool === "erase" ? "erase" : "draw"));
  const h = homePose(g); need.push([h.base, h.elbow]);
  return { board, need: need.filter(Boolean) };
}

// servo deg = zero + dir * ratio * joint deg; the share of the reachable board both servos can get to, and as a
// tie-break the shares each servo gets to by itself
function share(board, g, zb, ze) {
  const s = g.servo, ok = (j, z, a) => { const v = z + +s[j].dir * (+s[j].ratio || 1) * a; return v >= +s[j].min && v <= +s[j].max; };
  let both = 0, alone = 0;
  for (const [b, e] of board) { const ob = ok("base", zb, b), oe = ok("elbow", ze, e); both += ob && oe; alone += ob + oe; }
  return { both: both / (board.length || 1), alone: alone / (2 * board.length || 1) };
}

export function boardShare(g) { return share(reach(g), g, +g.servo.base.offset, +g.servo.elbow.offset).both; }

export function bestZeros(g) {
  const { board, need } = joints(g), s = g.servo;
  // the zeros that keep what is needed SPARE deg inside travel, for one joint
  const window = (j, col) => {
    const k = +s[j].dir * (+s[j].ratio || 1), v = need.map((a) => k * a[col]);
    return [+s[j].min + SPARE - Math.min(...v), +s[j].max - SPARE - Math.max(...v)];
  };
  const wb = window("base", 0), we = window("elbow", 1);
  if (wb[0] > wb[1] || we[0] > we[1]) return null;   // the drawing needs more than a servo can turn
  let best = null;
  for (let zb = Math.ceil(wb[0]); zb <= wb[1]; zb++) for (let ze = Math.ceil(we[0]); ze <= we[1]; ze++) {
    // the most board; between equals, the most each servo covers alone, then the most room around what is needed
    const c = share(board, g, zb, ze), room = Math.min(zb - wb[0], wb[1] - zb, ze - we[0], we[1] - ze);
    const key = [c.both, c.alone, room], bk = best?.key;
    if (!bk || key[0] > bk[0] + 1e-9 || (key[0] > bk[0] - 1e-9 && (key[1] > bk[1] + 1e-9 || (key[1] > bk[1] - 1e-9 && key[2] > bk[2])))) best = { base: zb, elbow: ze, share: c.both, key };
  }
  return best && { base: best.base, elbow: best.elbow, share: best.share };
}
