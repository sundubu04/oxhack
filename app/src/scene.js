// What should be on the whiteboard: drawings, each an SVG in a box, and at most one game. The chat, the clock and
// the games change the scene; the planner (optimize.js) works out how to get the board from the old one to the new.
// Boxes are in the drawing area's own units, 0 to 100 both ways with y down, the way the chat model sees the board.
import { parseSVG, parseSVGDom } from "./svg.js";
import { toBox } from "./pathplan.js";
import * as ttt from "./games/tictactoe.js";

export const FULL = { x: 0, y: 0, w: 100, h: 100 };
export const emptyScene = () => ({ items: [], game: null });

// a box in drawing units -> board mm (y up)
export function boxMm(box, g) {
  const s = (2 * g.half) / 100, cy = g.standoff + g.board / 2;
  return { x: -g.half + box.x * s, y: cy + g.half - (box.y + box.h) * s, w: box.w * s, h: box.h * s };
}

const traced = new Map();   // svg text -> { strokes, vb }, so a drawing is only traced once
function trace(svg) {
  if (!traced.has(svg)) traced.set(svg, typeof document !== "undefined" ? parseSVGDom(svg) : { strokes: parseSVG(svg), vb: { x: 0, y: 0, w: 100, h: 100 } });
  return traced.get(svg);
}

// every stroke of the scene, in board mm
export function sceneStrokes(scene, g) {
  const out = [];
  for (const it of scene.items) { const t = trace(it.svg); out.push(...toBox(t.strokes, boxMm(it.box || FULL, g), t.vb)); }
  if (scene.game) out.push(...gameStrokes(scene.game, g));
  return out;
}

// ---------- noughts and crosses ----------
export function newGame(robotFirst = false) {
  const game = { kind: "tictactoe", box: FULL, cells: Array(9).fill(null), person: "X", robot: "O", over: null };
  if (robotFirst) game.cells[ttt.bestMove(game.cells, game.robot)] = game.robot;
  return game;
}
function gameStrokes(game, g) {
  const b = boxMm(game.box, g), s = [...ttt.gridStrokes(b)];
  game.cells.forEach((w, c) => { if (w) s.push(...ttt.markStrokes(b, c, w)); });
  if (game.over?.line) s.push(ttt.winStroke(b, game.over.line));
  return s;
}
const CELL = ["top left", "top middle", "top right", "middle left", "the centre", "middle right", "bottom left", "bottom middle", "bottom right"];
export const cellName = (c) => CELL[c];
// the person's move, then the robot's answer -> { game, said }
export function playMove(game, cell) {
  if (!game || game.over) return { game, said: "That game's over. Say \"new game\" to play again." };
  if (game.cells[cell]) return { game, said: `${CELL[cell][0].toUpperCase() + CELL[cell].slice(1)} is taken. Pick an empty square.` };
  const next = { ...game, cells: game.cells.slice() };
  next.cells[cell] = next.person;
  let w = ttt.winner(next.cells);
  if (w) { next.over = w; return { game: next, said: w.who === "draw" ? "A draw." : "Three in a row: you win." }; }
  const mine = ttt.bestMove(next.cells, next.robot); next.cells[mine] = next.robot;
  w = ttt.winner(next.cells);
  if (w) { next.over = w; return { game: next, said: w.who === "draw" ? `I'll take ${CELL[mine]}. That's a draw.` : `I'll take ${CELL[mine]}, and that's three in a row.` }; }
  return { game: next, said: `I'll take ${CELL[mine]}. Your turn.` };
}
export function describeGame(game) {
  if (!game) return null;
  const rows = [0, 3, 6].map((r) => game.cells.slice(r, r + 3).map((c) => c || ".").join(" ")).join(" / ");
  return `noughts and crosses, the person is X, the robot is O; board ${rows}${game.over ? `; over (${game.over.who === "draw" ? "a draw" : `${game.over.who} won`})` : ""}`;
}

// ---------- the chat model's actions -> the next scene ----------
const uid = () => Math.random().toString(36).slice(2, 7);
export function applyActions(scene, actions) {
  let items = scene.items.slice(), game = scene.game;
  const notes = [];
  for (const a of actions || []) {
    if (a.type === "draw" && a.svg) {
      const box = validBox(a.box) || (items.length ? null : FULL) || freeBox(items);
      const id = a.id && !items.some((i) => i.id === a.id) ? a.id : `${(a.id || a.name || "drawing").replace(/\W+/g, "-").slice(0, 16)}-${uid()}`;
      items.push({ id, name: a.name || "drawing", box, svg: a.svg });
    } else if (a.type === "edit" && a.svg) {
      const k = items.findIndex((i) => i.id === a.id); const at = k >= 0 ? k : items.length === 1 ? 0 : -1;
      if (at >= 0) items[at] = { ...items[at], svg: a.svg }; else items.push({ id: a.id || uid(), name: a.name || "drawing", box: FULL, svg: a.svg });
    } else if (a.type === "erase") {
      items = items.filter((i) => i.id !== a.id);
      if (a.id === "game" || a.id === "tictactoe") game = null;
    } else if (a.type === "clear") { items = []; game = null; }
    else if (a.type === "game") { items = []; game = newGame(a.first === "robot"); notes.push(game.cells.some(Boolean) ? `I'll start: ${cellName(game.cells.findIndex(Boolean))}. Your turn.` : "You're X: tap a square or tell me where."); }
    else if (a.type === "move" && game && Number.isInteger(a.cell) && a.cell >= 0 && a.cell < 9) { const r = playMove(game, a.cell); game = r.game; notes.push(r.said); }
  }
  return { scene: { items, game }, notes };
}
function validBox(b) {
  if (!b || ![b.x, b.y, b.w, b.h].every(Number.isFinite) || b.w < 5 || b.h < 5) return null;
  const x = Math.max(0, Math.min(95, b.x)), y = Math.max(0, Math.min(95, b.y));
  return { x, y, w: Math.min(b.w, 100 - x), h: Math.min(b.h, 100 - y) };
}
// the quarter of the board with the least ink in it, for a drawing the model didn't place
function freeBox(items) {
  const quarters = [{ x: 50, y: 0, w: 50, h: 50 }, { x: 0, y: 0, w: 50, h: 50 }, { x: 50, y: 50, w: 50, h: 50 }, { x: 0, y: 50, w: 50, h: 50 }];
  const pts = items.flatMap((it) => {
    const b = it.box || FULL, t = trace(it.svg), s = Math.min(b.w / t.vb.w, b.h / t.vb.h);
    return t.strokes.flat().map((p) => ({ x: b.x + (p.x - t.vb.x) * s, y: b.y + (p.y - t.vb.y) * s }));
  });
  const ink = (q) => pts.filter((p) => p.x >= q.x && p.x < q.x + q.w && p.y >= q.y && p.y < q.y + q.h).length;
  return quarters.map((q) => ({ q, n: ink(q) })).sort((a, b) => a.n - b.n)[0].q;
}

// the whole scene as one SVG, for the Picture view
export function sceneSVG(scene, g) {
  const parts = scene.items.map((it) => { const b = it.box || FULL, inner = it.svg.replace(/^[\s\S]*?<svg[^>]*>/i, "").replace(/<\/svg>\s*$/i, ""), vb = trace(it.svg).vb; return `<svg x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}">${inner}</svg>`; });
  if (scene.game) {
    const s = (2 * g.half) / 100, cy = g.standoff + g.board / 2;
    const toUnits = (p) => `${((p.x + g.half) / s).toFixed(2)},${((cy + g.half - p.y) / s).toFixed(2)}`;
    parts.push(...gameStrokes(scene.game, g).map((st) => `<polyline points="${st.map(toUnits).join(" ")}"/>`));
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="black" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round">${parts.join("")}</svg>`;
}
