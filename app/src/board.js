// Draws the whiteboard, the planned path, the ink the simulated arm has left and the arm itself, to scale.
// World units are mm in the arm frame: base axis at the origin, x right, y up, the board above the base.
import { fk, toolPoint } from "./ik.js";

const PXMM = 3;      // resolution of the ink layer, px per mm
const MARKER = 2;    // width of the marker line, mm
const D2R = Math.PI / 180;

export function createBoard(canvas, { pad = 12 } = {}) {
  const ink = document.createElement("canvas"), ictx = ink.getContext("2d");
  const ctx = canvas.getContext("2d");
  let g = null, view = null, col = null;

  function tokens() {
    const cs = getComputedStyle(canvas);
    const v = (n) => cs.getPropertyValue(n).trim();
    col = { board: v("--dl-bg"), edge: v("--dl-line-ctl"), plan: v("--dl-line-ctl"), ink: v("--dl-ink"), arm: v("--dl-text-2"), joint: v("--dl-bg"),
      accent: v("--dl-accent"), reach: v("--dl-hover"), stop: v("--dl-stop"), info: v("--dl-info"), mount: v("--dl-line-strong"), text3: v("--dl-text-3"),
      font: v("--dl-font") };
  }

  function setGeom(geom) {
    const changed = !g || geom.boardW !== g.boardW || geom.board !== g.board;
    g = geom;
    if (changed) { ink.width = Math.round(g.boardW * PXMM); ink.height = Math.round(g.board * PXMM); clearInk(); }
  }

  function layout() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!r.width || !r.height) return false;
    if (canvas.width !== Math.round(r.width * dpr) || canvas.height !== Math.round(r.height * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const x0 = -g.boardW / 2 - pad, x1 = g.boardW / 2 + pad, y0 = -24, y1 = g.standoff + g.board + pad;
    const s = Math.min(r.width / (x1 - x0), r.height / (y1 - y0));
    view = { s, w: r.width, h: r.height, ox: (r.width - (x1 - x0) * s) / 2 - x0 * s, oy: (r.height - (y1 - y0) * s) / 2 + y1 * s };
    return true;
  }
  const P = (x, y) => [view.ox + x * view.s, view.oy - y * view.s];
  function toWorld(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left - view.ox) / view.s, y: (view.oy - (clientY - r.top)) / view.s };
  }

  // Ink layer, in board pixels: u right from the board's left edge, v down from its top edge.
  const U = (p) => [(p.x + g.boardW / 2) * PXMM, (g.standoff + g.board - p.y) * PXMM];
  function inkSeg(a, b, mode) {
    ictx.globalCompositeOperation = mode === "erase" ? "destination-out" : "source-over";
    ictx.strokeStyle = col?.ink || "#1d1d1f"; ictx.lineCap = ictx.lineJoin = "round";
    ictx.lineWidth = (mode === "erase" ? g.eraserWidth : MARKER) * PXMM;
    const [ua, va] = U(a), [ub, vb] = U(b);
    ictx.beginPath(); ictx.moveTo(ua, va); ictx.lineTo(ub, vb); ictx.stroke();
  }
  function clearInk() { ictx.clearRect(0, 0, ink.width, ink.height); }
  // the ink before a job, so rewinding replays it on top of what was already there
  const snapshot = () => ictx.getImageData(0, 0, ink.width, ink.height);
  const restore = (img) => { if (img && img.width === ink.width && img.height === ink.height) ictx.putImageData(img, 0, 0); else clearInk(); };
  // as an image, to keep with a saved simulation
  const inkURL = () => ink.toDataURL("image/png");
  const setInk = (url) => new Promise((res) => {
    clearInk(); if (!url) return res();
    const im = new Image(); im.onload = () => { ictx.globalCompositeOperation = "source-over"; ictx.drawImage(im, 0, 0, ink.width, ink.height); res(); }; im.onerror = () => res(); im.src = url;
  });
  function hasInk() {
    const d = ictx.getImageData(0, 0, ink.width, ink.height).data;
    for (let i = 3; i < d.length; i += 64) if (d[i]) return true; return false;
  }

  // state: { toolpath, path (angles), joints {base, elbow, tilt}, mode, showPlan, showReach, hover, unreachable[] }
  function render(state = {}) {
    if (!g || !layout()) return;
    if (!col) tokens();
    const { s } = view;
    ctx.clearRect(0, 0, view.w, view.h);
    const [bx, by] = P(-g.boardW / 2, g.standoff + g.board), bw = g.boardW * s, bh = g.board * s;

    // the board, then where the arm cannot reach shaded grey
    ctx.fillStyle = col.board; ctx.fillRect(bx, by, bw, bh);
    if (state.showReach) {
      ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
      const [cx, cy] = P(0, 0), R = (g.L1 + g.L2) * s, r = Math.abs(g.L1 - g.L2) * s;
      ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.arc(cx, cy, R, 0, Math.PI * 2, true);
      if (r > 0) { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2); }
      ctx.fillStyle = col.reach; ctx.fill("evenodd");
      const [dx, dy] = P(-g.half, g.standoff + g.board / 2 + g.half);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = col.mount; ctx.lineWidth = 1; ctx.strokeRect(dx, dy, 2 * g.half * s, 2 * g.half * s); ctx.setLineDash([]);
      // name the grey where it shows: the top of the board, out past the arm's reach
      if (g.L1 + g.L2 < g.standoff + g.board) {
        const [lx, ly] = P(0, g.standoff + g.board); ctx.fillStyle = col.text3; ctx.font = `12px ${col.font}`; ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText("Out of reach", lx, ly + 10);
      }
      ctx.restore();
    }
    ctx.strokeStyle = col.edge; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    // the board's real size, so "to scale" can be read
    ctx.fillStyle = col.text3; ctx.font = `11px ${col.font}`; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText(`${g.boardW} × ${g.board} mm`, bx + 8, by + bh - 6);

    // what the plan will draw, faint, under the ink
    const tp = state.toolpath;
    if (tp && state.showPlan !== false) {
      ctx.strokeStyle = col.plan; ctx.lineWidth = Math.max(1, MARKER * s); ctx.lineCap = ctx.lineJoin = "round"; ctx.beginPath();
      for (let i = 1; i < tp.length; i++) {
        const tool = tp[i].tool || (tp[i].pen ? "draw" : "lift"); if (tool !== "draw") continue;
        const a = P(tp[i - 1].x, tp[i - 1].y), b = P(tp[i].x, tp[i].y); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
    }
    ctx.drawImage(ink, bx, by, bw, bh);

    // waypoints the arm cannot reach
    if (state.unreachable?.length) {
      ctx.fillStyle = col.stop;
      for (const p of state.unreachable) { const [x, y] = P(p.x, p.y); ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 4, y); ctx.fill(); }
    }

    // the arm: mount, two links, joints, and the tip
    const j = state.joints; if (!j) return;
    const f = fk(j.base * D2R, j.elbow * D2R, g.L1, g.L2), base = P(0, 0), elb = P(f.ex, f.ey), end = P(f.px, f.py);
    const n = toolPoint(j.base * D2R, j.elbow * D2R, g, "draw"), e = toolPoint(j.base * D2R, j.elbow * D2R, g, "erase");
    const nib = P(n.x, n.y), felt = P(e.x, e.y), tip = state.mode === "erase" ? felt : nib;
    ctx.fillStyle = col.mount; const mw = 36 * s, mh = 14 * s; ctx.beginPath(); ctx.roundRect(base[0] - mw / 2, base[1] - mh / 2, mw, mh, 3); ctx.fill();
    // lighter than the ink, so the drawing stays the darkest thing on the board
    ctx.globalAlpha = 0.55; ctx.strokeStyle = col.mount; ctx.lineCap = "round"; ctx.lineWidth = Math.max(4, 8 * s);
    ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(elb[0], elb[1]); ctx.lineTo(end[0], end[1]); ctx.stroke();
    // the pen, seen from the front: it lies across the forearm's tip, nib to one side and eraser to the other
    ctx.lineWidth = Math.max(4, 9 * s); ctx.beginPath(); ctx.moveTo(felt[0], felt[1]); ctx.lineTo(nib[0], nib[1]); ctx.stroke(); ctx.globalAlpha = 1;
    for (const p of [base, elb]) { ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(3, 4 * s), 0, Math.PI * 2); ctx.fillStyle = col.joint; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = col.mount; ctx.stroke(); }
    if (state.mode === "erase") {
      ctx.beginPath(); ctx.arc(tip[0], tip[1], (g.eraserWidth / 2) * s, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = col.info; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(tip[0], tip[1], 5, 0, Math.PI * 2);
      if (state.mode === "draw") { ctx.fillStyle = col.accent; ctx.fill(); } else { ctx.fillStyle = col.joint; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col.accent; ctx.stroke(); }
    }

    // where a drag would send the pen
    if (state.hover) {
      const [hx, hy] = P(state.hover.x, state.hover.y); ctx.strokeStyle = state.hover.ok ? col.text3 : col.stop; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx - 6, hy); ctx.lineTo(hx + 6, hy); ctx.moveTo(hx, hy - 6); ctx.lineTo(hx, hy + 6); ctx.stroke();
    }
  }

  return { setGeom, render, inkSeg, clearInk, hasInk, toWorld, ink, snapshot, restore, inkURL, setInk, retheme: () => { col = null; } };
}
