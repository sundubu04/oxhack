// The marker on the tilt servo, as in docs/pages/pen-mount.html: clamped at its middle on a shaft that runs along
// the forearm, so it lies across the forearm and swings across it, nib down to draw and eraser down to erase.
// How high the shaft sits off the board fixes the angle the pen meets the board at; everything else follows.
const D2R = Math.PI / 180;

// p: { length, barrel, nib, angle (0 = best), margin, press, lift } in mm and degrees.
export function penGeometry(p) {
  const h = +p.length / 2, R = +p.barrel / 2, t = +p.nib, margin = +p.margin || 0;
  // The best angle is the lowest one at which the barrel's edge still clears the board by the margin. Lower
  // slides less as the nib lands, turns the servo less and keeps the shaft lower; the margin covers nib wear
  // and the servo's dead band.
  const A = Math.hypot(t, R), best = (Math.atan2(R, t) + Math.asin(Math.min(1, margin / (A || 1)))) / D2R;
  const beta = +p.angle > 0 ? Math.min(89, +p.angle) : Math.min(89, Math.ceil(best));
  const height = h * Math.sin(beta * D2R);
  const pressTo = Math.asin(Math.min(1, (height + (+p.press || 0)) / h)) / D2R;          // nib pressed in
  const liftTo = Math.asin(Math.max(-1, Math.min(1, (height - (+p.lift || 0)) / h))) / D2R; // nib lifted clear
  return {
    beta, best, height, half: h,
    side: h * Math.cos(beta * D2R),            // how far each end touches across the forearm's tip
    draw: -pressTo, lift: -liftTo, erase: pressTo,  // tilt from the pen lying flat; negative brings the nib down
    travel: 2 * pressTo,                       // servo turn from drawing to erasing
    slide: h * (Math.cos(beta * D2R) - Math.cos(pressTo * D2R)),   // the nib's slide as it presses in
    clearance: t * Math.sin(beta * D2R) - R * Math.cos(beta * D2R), // barrel edge above the board while drawing
    torquePerN: (h / 10) * Math.cos(beta * D2R),                   // N·cm on the servo per newton of pen force
  };
}

// Where the nib is above the board (mm) for a tilt from flat, with the shaft at the given height.
export function nibHeight(pg, tilt) { return pg.height + pg.half * Math.sin(tilt * D2R); }

// The marker as built and measured (config penServo and tool): the nib touches the board where the forearm's
// nib point is with the pen servo at its nib-down angle, the eraser at the eraser point at its eraser-down angle,
// and the pen turns with its servo. So it swings about a shaft above the middle of those two points: at the
// measured pivot height when there is one (each end then reaches hypot(pivot, gap / 2) from it), or else as high
// as the pen's half length allows. beta is the angle each end meets the board at.
export function measuredPen(length, gap, pivot) {
  if (pivot > 0) { const beta = Math.atan2(pivot, gap / 2); return { half: Math.hypot(pivot, gap / 2), beta: beta / D2R, height: pivot, gap }; }
  const half = length / 2, beta = Math.acos(Math.min(1, gap / (2 * half)));
  return { half, beta: beta / D2R, height: half * Math.sin(beta), gap };
}
// The pen's angle from flat (deg; negative brings the nib down) for a tilt joint angle: -beta at nib-down, +beta at
// eraser-down, in step with the servo between and beyond them.
export function penTilt(g, tilt) {
  const s = g.servo.tilt, sv = (t) => +s.offset + +s.dir * (+s.ratio || 1) * t;
  const d = sv(g.tilt.draw), e = sv(g.tilt.erase), b = g.pen.beta;
  return e === d ? -b : -b + ((sv(tilt) - d) * 2 * b) / (e - d);
}
