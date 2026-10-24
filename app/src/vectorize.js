// Deterministic raster → polylines, for when the drawing is a bitmap (a generated image or a photo)
// rather than vectors. Threshold to a binary mask, then trace region boundaries with the
// Moore-neighbour algorithm. Good for silhouettes and bold line art; for fine photos prefer the
// SVG route (ask the model for vectors). Pure: takes an ImageData-like {data,width,height}.

function toBinary(img, threshold) {
  const { data, width: w, height: h } = img;
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    const lum = a < 32 ? 255 : 0.299 * r + 0.587 * g + 0.114 * b;
    bin[i] = lum < threshold ? 1 : 0; // 1 = ink
  }
  return bin;
}

// Moore boundary tracing of each 4-connected ink component's outer contour.
function traceContours(bin, w, h, minLen) {
  const seen = new Uint8Array(w * h);
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : bin[y * w + x];
  const contours = [];
  // 8-neighbour offsets, clockwise from east
  const N = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!bin[y * w + x] || seen[y * w + x]) continue;
      // start of a new component boundary (ink pixel with a background pixel to its left)
      if (at(x - 1, y)) continue;
      const contour = [];
      let px = x, py = y, bx = x - 1, by = y; // b = background cell we came from
      const startX = x, startY = y;
      let safety = 0, firstStep = null;
      do {
        contour.push({ x: px, y: py }); seen[py * w + px] = 1;
        // find the backtrack direction index
        let dir = 0;
        for (let k = 0; k < 8; k++) if (px + N[k][0] === bx && py + N[k][1] === by) { dir = k; break; }
        // search clockwise from backtrack+1 for the next ink pixel
        let found = false;
        for (let k = 1; k <= 8; k++) {
          const idx = (dir + k) % 8, nx = px + N[idx][0], ny = py + N[idx][1];
          if (at(nx, ny)) { bx = px + N[(idx + 7) % 8][0]; by = py + N[(idx + 7) % 8][1]; px = nx; py = ny; found = true; if (firstStep === null) firstStep = idx; break; }
        }
        if (!found) break;
        if (++safety > w * h * 4) break;
      } while (!(px === startX && py === startY));
      if (contour.length >= minLen) contours.push(contour);
    }
  }
  return contours;
}

// Ramer–Douglas–Peucker simplify.
function simplify(points, eps) {
  if (points.length < 3) return points;
  let dmax = 0, idx = 0;
  const a = points[0], b = points[points.length - 1];
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const d = Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax > eps) {
    const l = simplify(points.slice(0, idx + 1), eps), r = simplify(points.slice(idx), eps);
    return l.slice(0, -1).concat(r);
  }
  return [a, b];
}

export function imageToStrokes(img, opts = {}) {
  const threshold = opts.threshold ?? 128;
  const minLen = opts.minLen ?? 12;         // drop specks
  const eps = opts.simplify ?? 1.2;          // px
  const bin = toBinary(img, threshold);
  const contours = traceContours(bin, img.width, img.height, minLen);
  return contours.map(c => simplify(c, eps)).filter(s => s.length > 1);
}
