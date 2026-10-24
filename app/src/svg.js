// Parse an SVG (or a JSON point list) into polylines: strokes = [[{x,y}, ...], ...].
// Handles the shapes models emit for line art: path (M/L/H/V/C/S/Q/A/Z), polyline, polygon, line, rect,
// circle, ellipse. Curves and arcs are sampled. Without a DOM (node) the elements are found by pattern.

function samplePathD(d) {
  const strokes = [];
  let cur = [], x = 0, y = 0, sx = 0, sy = 0;
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let i = 0, cmd = "";
  const num = () => parseFloat(toks[i++]);
  const push = () => { if (cur.length > 1) strokes.push(cur); };
  const bez = (p0, p1, p2, p3) => { for (let t = 1; t <= 16; t++) { const u = t / 16, m = 1 - u; cur.push({ x: m*m*m*p0.x + 3*m*m*u*p1.x + 3*m*u*u*p2.x + u*u*u*p3.x, y: m*m*m*p0.y + 3*m*m*u*p1.y + 3*m*u*u*p2.y + u*u*u*p3.y }); } };
  // an SVG arc, from its endpoints to its centre and angles (SVG spec, appendix F.6.5), then sampled
  const arc = (x1, y1, rx, ry, phi, fa, fs, x2, y2) => {
    rx = Math.abs(rx); ry = Math.abs(ry);
    if (!rx || !ry) { cur.push({ x: x2, y: y2 }); return; }
    const r = (phi * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, xp = c * dx + s * dy, yp = -s * dx + c * dy;
    const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry); if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
    const k = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, (rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp) / (rx * rx * yp * yp + ry * ry * xp * xp)));
    const cxp = (k * rx * yp) / ry, cyp = (-k * ry * xp) / rx, cx = c * cxp - s * cyp + (x1 + x2) / 2, cy = s * cxp + c * cyp + (y1 + y2) / 2;
    const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry); let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
    if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
    const n = Math.max(4, Math.ceil(Math.abs(dt) / (Math.PI / 16)));
    for (let j = 1; j <= n; j++) { const t = t1 + (dt * j) / n; cur.push({ x: cx + rx * Math.cos(t) * c - ry * Math.sin(t) * s, y: cy + rx * Math.cos(t) * s + ry * Math.sin(t) * c }); }
  };
  const quad = (p0, p1, p2) => { for (let t = 1; t <= 12; t++) { const u = t / 12, m = 1 - u; cur.push({ x: m*m*p0.x + 2*m*u*p1.x + u*u*p2.x, y: m*m*p0.y + 2*m*u*p1.y + u*u*p2.y }); } };
  while (i < toks.length) {
    let t = toks[i];
    if (/[a-zA-Z]/.test(t)) { cmd = t; i++; }
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    if (C === "M") { push(); cur = []; let nx = num(), ny = num(); if (rel) { nx += x; ny += y; } x = nx; y = ny; sx = x; sy = y; cur.push({ x, y }); cmd = rel ? "l" : "L"; }
    else if (C === "L") { let nx = num(), ny = num(); if (rel) { nx += x; ny += y; } x = nx; y = ny; cur.push({ x, y }); }
    else if (C === "H") { let nx = num(); if (rel) nx += x; x = nx; cur.push({ x, y }); }
    else if (C === "V") { let ny = num(); if (rel) ny += y; y = ny; cur.push({ x, y }); }
    else if (C === "C") { let p1 = { x: num(), y: num() }, p2 = { x: num(), y: num() }, p3 = { x: num(), y: num() }; if (rel) { p1.x+=x;p1.y+=y;p2.x+=x;p2.y+=y;p3.x+=x;p3.y+=y; } bez({ x, y }, p1, p2, p3); x = p3.x; y = p3.y; }
    else if (C === "S") { let p2 = { x: num(), y: num() }, p3 = { x: num(), y: num() }; if (rel) { p2.x+=x;p2.y+=y;p3.x+=x;p3.y+=y; } bez({ x, y }, { x, y }, p2, p3); x = p3.x; y = p3.y; }
    else if (C === "Q") { let p1 = { x: num(), y: num() }, p2 = { x: num(), y: num() }; if (rel) { p1.x+=x;p1.y+=y;p2.x+=x;p2.y+=y; } quad({ x, y }, p1, p2); x = p2.x; y = p2.y; }
    else if (C === "A") { const rx = num(), ry = num(), phi = num(), fa = num(), fs = num(); let nx = num(), ny = num(); if (rel) { nx += x; ny += y; } arc(x, y, rx, ry, phi, fa, fs, nx, ny); x = nx; y = ny; }
    else if (C === "Z") { cur.push({ x: sx, y: sy }); x = sx; y = sy; push(); cur = []; }
    else { i++; }
  }
  push();
  return strokes;
}

// Without a DOM (node): the same shapes found by pattern, with just enough of an element for parseSVG.
function textDoc(text) {
  const els = [...text.matchAll(/<(path|polyline|polygon|line|rect|circle|ellipse)\b([^>]*)>/gi)].map((m) => {
    const a = {}; for (const x of m[2].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) a[x[1]] = x[2] ?? x[3];
    return { tag: m[1].toLowerCase(), getAttribute: (k) => a[k] ?? null };
  });
  return { querySelectorAll: (sel) => els.filter((e) => sel.split(",").map((s) => s.trim()).includes(e.tag)) };
}

function circleStroke(cx, cy, rx, ry, n = 48) {
  const s = []; for (let i = 0; i <= n; i++) { const a = i / n * 2 * Math.PI; s.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }); } return s;
}

export function parseSVG(text) {
  text = (text || "").trim();
  if (!text) return [];
  // JSON point list: [[[x,y],...], ...] or [[x,y],...]
  if (text[0] === "[") {
    try { const j = JSON.parse(text); if (Array.isArray(j[0][0])) return j.map(s => s.map(p => ({ x: p[0], y: p[1] }))); return [j.map(p => ({ x: p[0], y: p[1] }))]; } catch (e) { /* fall through */ }
  }
  // a bare path string
  if (!text.includes("<")) return samplePathD(text);
  let doc;
  if (typeof DOMParser === "undefined") doc = textDoc(text);
  else try { doc = new DOMParser().parseFromString(text, "image/svg+xml"); } catch (e) { return samplePathD(text); }
  const strokes = [];
  const num = (el, a, d = 0) => parseFloat(el.getAttribute(a) ?? d) || 0;
  doc.querySelectorAll("path").forEach(p => strokes.push(...samplePathD(p.getAttribute("d") || "")));
  doc.querySelectorAll("polyline, polygon").forEach(p => {
    const pts = (p.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number);
    const s = []; for (let i = 0; i + 1 < pts.length; i += 2) s.push({ x: pts[i], y: pts[i + 1] });
    if (p.tagName.toLowerCase() === "polygon" && s.length) s.push(s[0]);
    if (s.length > 1) strokes.push(s);
  });
  doc.querySelectorAll("line").forEach(l => strokes.push([{ x: num(l, "x1"), y: num(l, "y1") }, { x: num(l, "x2"), y: num(l, "y2") }]));
  doc.querySelectorAll("rect").forEach(r => { const x = num(r, "x"), y = num(r, "y"), w = num(r, "width"), h = num(r, "height"); strokes.push([{ x, y }, { x: x+w, y }, { x: x+w, y: y+h }, { x, y: y+h }, { x, y }]); });
  doc.querySelectorAll("circle").forEach(c => strokes.push(circleStroke(num(c, "cx"), num(c, "cy"), num(c, "r"), num(c, "r"))));
  doc.querySelectorAll("ellipse").forEach(c => strokes.push(circleStroke(num(c, "cx"), num(c, "cy"), num(c, "rx"), num(c, "ry"))));
  return strokes.filter(s => s.length > 1);
}

// For node tests (no DOMParser): parse a single path d string.
export { samplePathD };

// In the browser: let Chrome lay the SVG out and trace every shape itself, so arcs, transforms and every element
// type come out right. The model's SVG is rebuilt from an allow-list of shapes and geometry attributes first, so
// nothing in it can run. -> { strokes in the viewBox's own units, vb: {x, y, w, h} }
const SHAPES = new Set(["svg", "g", "path", "line", "polyline", "polygon", "rect", "circle", "ellipse"]);
const GEOMETRY = new Set(["d", "points", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "transform", "viewBox"]);
const NS = "http://www.w3.org/2000/svg";
export function parseSVGDom(text, { step = 0.5 } = {}) {
  const src = new DOMParser().parseFromString(text || "", "image/svg+xml").documentElement;
  if (!src || src.nodeName.toLowerCase() !== "svg") return { strokes: parseSVG(text), vb: { x: 0, y: 0, w: 100, h: 100 } };
  const copy = (n) => {
    const tag = n.nodeName.toLowerCase(); if (!SHAPES.has(tag)) return null;
    const el = document.createElementNS(NS, tag);
    for (const a of n.attributes) if (GEOMETRY.has(a.name)) el.setAttribute(a.name, a.value);
    for (const c of n.children) { const k = copy(c); if (k) el.appendChild(k); }
    return el;
  };
  const svg = copy(src);
  const vbs = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
  const vb = vbs.length === 4 && vbs.every(isFinite) ? { x: vbs[0], y: vbs[1], w: vbs[2], h: vbs[3] } : { x: 0, y: 0, w: +svg.getAttribute("width") || 100, h: +svg.getAttribute("height") || 100 };
  svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`); svg.setAttribute("width", vb.w); svg.setAttribute("height", vb.h);
  const host = document.createElement("div");
  host.style.cssText = "position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none";
  host.appendChild(svg); document.body.appendChild(host);
  const strokes = [];
  try {
    const toRoot = svg.getScreenCTM().inverse();
    for (const el of svg.querySelectorAll("path,line,polyline,polygon,rect,circle,ellipse")) {
      const total = el.getTotalLength(); if (!(total > 0)) continue;
      const m = toRoot.multiply(el.getScreenCTM()), n = Math.max(2, Math.ceil(total / step));
      let cur = [], prev = null;
      for (let i = 0; i <= n; i++) {
        const p = el.getPointAtLength((total * i) / n).matrixTransform(m);
        // a jump means a new subpath ("M" in the middle of a path)
        if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) > step * 4) { if (cur.length > 1) strokes.push(cur); cur = []; }
        cur.push({ x: p.x, y: p.y }); prev = p;
      }
      if (cur.length > 1) strokes.push(cur);
    }
  } finally { host.remove(); }
  return { strokes: strokes.map((s) => thin(s, step * 0.25)), vb };
}

// drop points that sit on the line between their neighbours, keeping corners
function thin(pts, eps) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i + 1], p = pts[i], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    if (Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / L > eps) out.push(p);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
