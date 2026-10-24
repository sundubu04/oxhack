// Tic-tac-toe on the whiteboard: the grid and the marks as strokes inside a box (board mm), and a computer player
// that never loses (minimax). Cells are 0 to 8, left to right from the top row.
export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

// box: { x, y, w, h } with (x, y) its bottom-left corner, y up
const cellBox = (box, c) => { const w = box.w / 3, h = box.h / 3, col = c % 3, row = Math.floor(c / 3); return { x: box.x + col * w, y: box.y + box.h - (row + 1) * h, w, h }; };

export function gridStrokes(box) {
  const s = [];
  for (const f of [1 / 3, 2 / 3]) {
    s.push([{ x: box.x + box.w * f, y: box.y }, { x: box.x + box.w * f, y: box.y + box.h }]);
    s.push([{ x: box.x, y: box.y + box.h * f }, { x: box.x + box.w, y: box.y + box.h * f }]);
  }
  return s;
}

// X as two strokes, O as a circle, each kept well inside its cell so wiping one doesn't touch the grid
export function markStrokes(box, c, who) {
  const b = cellBox(box, c), m = 0.24, x0 = b.x + b.w * m, x1 = b.x + b.w * (1 - m), y0 = b.y + b.h * m, y1 = b.y + b.h * (1 - m);
  if (who === "X") return [[{ x: x0, y: y1 }, { x: x1, y: y0 }], [{ x: x1, y: y1 }, { x: x0, y: y0 }]];
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = (x1 - x0) / 2, pts = [];
  for (let i = 0; i <= 40; i++) { const a = Math.PI / 2 + (i / 40) * 2 * Math.PI; pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
  return [pts];
}

// the line through three in a row
export function winStroke(box, line) {
  const a = cellBox(box, line[0]), b = cellBox(box, line[2]);
  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = cb.x - ca.x, dy = cb.y - ca.y, d = Math.hypot(dx, dy) || 1, ext = a.w * 0.3;
  return [{ x: ca.x - (dx / d) * ext, y: ca.y - (dy / d) * ext }, { x: cb.x + (dx / d) * ext, y: cb.y + (dy / d) * ext }];
}

export function winner(cells) {
  for (const l of LINES) { const [a, b, c] = l; if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return { who: cells[a], line: l }; }
  return cells.every(Boolean) ? { who: "draw" } : null;
}

// the best move for `me`: win soonest, lose latest; the centre and corners first among equals
export function bestMove(cells, me) {
  const them = me === "X" ? "O" : "X";
  const score = (b, turn, depth) => {
    const w = winner(b);
    if (w) return w.who === me ? 10 - depth : w.who === them ? depth - 10 : 0;
    let best = turn === me ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) if (!b[i]) {
      b[i] = turn; const v = score(b, turn === me ? them : me, depth + 1); b[i] = null;
      best = turn === me ? Math.max(best, v) : Math.min(best, v);
    }
    return best;
  };
  let pick = -1, top = -Infinity;
  for (const i of [4, 0, 2, 6, 8, 1, 3, 5, 7]) if (!cells[i]) {
    const b = cells.slice(); b[i] = me; const v = score(b, them, 1);
    if (v > top) { top = v; pick = i; }
  }
  return pick;
}

// "top left", "centre", "b2", "middle right", "5" -> a cell, or -1
export function parseCell(text) {
  const t = text.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
  const n = t.match(/\b([1-9])\b/); if (n) return +n[1] - 1;
  const ab = t.match(/\b([abc])\s?([123])\b/); if (ab) return (+ab[2] - 1) * 3 + "abc".indexOf(ab[1]);
  const row = /\btop\b|\bupper\b/.test(t) ? 0 : /\bbottom\b|\blower\b/.test(t) ? 2 : /\bmiddle\b|\bcent(er|re)\b|\bmid\b/.test(t) ? 1 : -1;
  const col = /\bleft\b/.test(t) ? 0 : /\bright\b/.test(t) ? 2 : /\bmiddle\b|\bcent(er|re)\b|\bmid\b/.test(t) ? 1 : -1;
  if (row >= 0 && col >= 0) return row * 3 + col;
  if (/\bcent(er|re)\b|\bmiddle\b/.test(t)) return 4;
  return -1;
}
