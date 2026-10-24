// Parse an SVG (or a JSON point list) into polylines: strokes = [[{x,y}, ...], ...].
// Handles the shapes Gemini reliably emits for line art: path (M/L/H/V/C/Q/Z), polyline, polygon,
// line, rect, circle, ellipse. Curves are sampled; arcs (A) are skipped.

function samplePathD(d) {
  const strokes = [];
  let cur = [], x = 0, y = 0, sx = 0, sy = 0;
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let i = 0, cmd = "";
  const num = () => parseFloat(toks[i++]);
  const push = () => { if (cur.length > 1) strokes.push(cur); };
  const bez = (p0, p1, p2, p3) => { for (let t = 1; t <= 16; t++) { const u = t / 16, m = 1 - u; cur.push({ x: m*m*m*p0.x + 3*m*m*u*p1.x + 3*m*u*u*p2.x + u*u*u*p3.x, y: m*m*m*p0.y + 3*m*m*u*p1.y + 3*m*u*u*p2.y + u*u*u*p3.y }); } };
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
    else if (C === "Z") { cur.push({ x: sx, y: sy }); x = sx; y = sy; push(); cur = []; }
    else { i++; }
  }
  push();
  return strokes;
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
  try { doc = new DOMParser().parseFromString(text, "image/svg+xml"); } catch (e) { return samplePathD(text); }
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
