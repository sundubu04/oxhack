// Built-in line drawings so the pipeline runs and demos without any API key.
export const SAMPLES = {
  house: `<svg viewBox="0 0 100 100"><path fill="none" stroke="black" d="M20 55 L50 25 L80 55 M28 50 L28 85 L72 85 L72 50 M44 85 L44 65 L58 65 L58 85"/><circle fill="none" stroke="black" cx="74" cy="22" r="8"/></svg>`,
  cat: `<svg viewBox="0 0 100 100"><path fill="none" stroke="black" d="M30 35 L22 18 L38 30 M70 35 L78 18 L62 30 M30 35 C 18 50, 18 72, 50 78 C 82 72, 82 50, 70 35 C 62 28, 38 28, 30 35 Z M40 52 L44 52 M56 52 L60 52 M48 60 L52 60 M50 60 L50 66"/><path fill="none" stroke="black" d="M34 62 L20 60 M34 66 L22 68 M66 62 L80 60 M66 66 L78 68"/></svg>`,
  star: `<svg viewBox="0 0 100 100"><polygon fill="none" stroke="black" points="50,12 61,38 90,38 66,56 75,84 50,66 25,84 34,56 10,38 39,38"/></svg>`,
  flower: `<svg viewBox="0 0 100 100"><circle fill="none" stroke="black" cx="50" cy="45" r="10"/><ellipse fill="none" stroke="black" cx="50" cy="25" rx="8" ry="14"/><ellipse fill="none" stroke="black" cx="50" cy="65" rx="8" ry="14"/><ellipse fill="none" stroke="black" cx="30" cy="45" rx="14" ry="8"/><ellipse fill="none" stroke="black" cx="70" cy="45" rx="14" ry="8"/><path fill="none" stroke="black" d="M50 75 L50 92 M50 84 C 58 80, 62 72, 60 68"/></svg>`,
};

// A clock face at the current time, as an SVG (the project's own subject).
// Mood mode's faces, one per mood the camera reads (lib/presage.mjs). They share the head and the eyes, so going
// from one mood to another wipes and redraws only the brows and the mouth.
export const MOODS = ["happy", "sad", "surprised", "angry", "neutral"];
export function moodFace(mood) {
  const brows = {
    sad: '<path d="M27 33 L42 28"/><path d="M73 33 L58 28"/>',
    angry: '<path d="M27 27 L43 34"/><path d="M73 27 L57 34"/>',
    surprised: '<path d="M27 30 Q35 22 43 29"/><path d="M57 29 Q65 22 73 30"/>',
  }[mood] || "";
  const mouth = {
    happy: '<path d="M31 59 Q50 81 69 59"/>',
    sad: '<path d="M33 75 Q50 59 67 75"/>',
    surprised: '<circle cx="50" cy="68" r="8"/>',
    angry: '<path d="M33 71 Q50 62 67 71"/>',
  }[mood] || '<path d="M35 67 L65 67"/>';
  return `<svg viewBox="0 0 100 100" fill="none" stroke="black"><circle cx="50" cy="50" r="42"/><circle cx="36" cy="41" r="3.5"/><circle cx="64" cy="41" r="3.5"/>${brows}${mouth}</svg>`;
}

// The clock for clock mode: the same face (radius 44 of the 100-unit box), the numbers 1 to 12 in the pen's own
// lettering in place of the ticks, and single-line hands kept short of the numbers. Returns the face and hands as SVG
// and the numbers as texts, the way a scene item holds them.
export function numberedClock(now = new Date()) {
  const R = 44, cx = 50, cy = 50, h = 7, rn = R * 0.8, texts = [];
  for (let k = 1; k <= 12; k++) {
    const a = (k / 12) * 2 * Math.PI, x = cx + rn * Math.sin(a), y = cy - rn * Math.cos(a), w = k > 9 ? 10 : 6;
    texts.push({ text: String(k), x: +(x - w / 2).toFixed(2), y: +(y - h / 2).toFixed(2), w, h });
  }
  const hr = (now.getHours() % 12) + now.getMinutes() / 60, ah = (hr / 12) * 2 * Math.PI, am = (now.getMinutes() / 60) * 2 * Math.PI;
  const hand = (a, r) => `<line stroke="black" x1="${cx}" y1="${cy}" x2="${(cx + r * Math.sin(a)).toFixed(1)}" y2="${(cy - r * Math.cos(a)).toFixed(1)}"/>`;
  return { svg: `<svg viewBox="0 0 100 100"><circle fill="none" stroke="black" cx="${cx}" cy="${cy}" r="${R}"/>${hand(ah, R * 0.45)}${hand(am, R * 0.66)}</svg>`, texts };
}

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
