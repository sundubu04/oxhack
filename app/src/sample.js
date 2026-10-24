// Built-in line drawings so the pipeline runs and demos without any API key.
export const SAMPLES = {
  house: `<svg viewBox="0 0 100 100"><path fill="none" stroke="black" d="M20 55 L50 25 L80 55 M28 50 L28 85 L72 85 L72 50 M44 85 L44 65 L58 65 L58 85"/><circle fill="none" stroke="black" cx="74" cy="22" r="8"/></svg>`,
  cat: `<svg viewBox="0 0 100 100"><path fill="none" stroke="black" d="M30 35 L22 18 L38 30 M70 35 L78 18 L62 30 M30 35 C 18 50, 18 72, 50 78 C 82 72, 82 50, 70 35 C 62 28, 38 28, 30 35 Z M40 52 L44 52 M56 52 L60 52 M48 60 L52 60 M50 60 L50 66"/><path fill="none" stroke="black" d="M34 62 L20 60 M34 66 L22 68 M66 62 L80 60 M66 66 L78 68"/></svg>`,
  star: `<svg viewBox="0 0 100 100"><polygon fill="none" stroke="black" points="50,12 61,38 90,38 66,56 75,84 50,66 25,84 34,56 10,38 39,38"/></svg>`,
  flower: `<svg viewBox="0 0 100 100"><circle fill="none" stroke="black" cx="50" cy="45" r="10"/><ellipse fill="none" stroke="black" cx="50" cy="25" rx="8" ry="14"/><ellipse fill="none" stroke="black" cx="50" cy="65" rx="8" ry="14"/><ellipse fill="none" stroke="black" cx="30" cy="45" rx="14" ry="8"/><ellipse fill="none" stroke="black" cx="70" cy="45" rx="14" ry="8"/><path fill="none" stroke="black" d="M50 75 L50 92 M50 84 C 58 80, 62 72, 60 68"/></svg>`,
};

// A clock face at the current time, as an SVG (the project's own subject).
export function clockSVG(now = new Date()) {
  const R = 44, cx = 50, cy = 50, el = [];
  el.push(`<circle fill="none" stroke="black" cx="${cx}" cy="${cy}" r="${R}"/>`);
  for (let h = 0; h < 12; h++) { const a = h / 12 * 2 * Math.PI, r0 = h % 3 === 0 ? R * 0.82 : R * 0.9; el.push(`<line stroke="black" x1="${(cx + r0 * Math.sin(a)).toFixed(1)}" y1="${(cy - r0 * Math.cos(a)).toFixed(1)}" x2="${(cx + R * 0.97 * Math.sin(a)).toFixed(1)}" y2="${(cy - R * 0.97 * Math.cos(a)).toFixed(1)}"/>`); }
  const hr = (now.getHours() % 12) + now.getMinutes() / 60, mn = now.getMinutes();
  const ah = hr / 12 * 2 * Math.PI, am = mn / 60 * 2 * Math.PI;
  el.push(`<line stroke="black" x1="${cx}" y1="${cy}" x2="${(cx + R * 0.5 * Math.sin(ah)).toFixed(1)}" y2="${(cy - R * 0.5 * Math.cos(ah)).toFixed(1)}"/>`);
  el.push(`<line stroke="black" x1="${cx}" y1="${cy}" x2="${(cx + R * 0.78 * Math.sin(am)).toFixed(1)}" y2="${(cy - R * 0.78 * Math.cos(am)).toFixed(1)}"/>`);
  return `<svg viewBox="0 0 100 100">${el.join("")}</svg>`;
}
