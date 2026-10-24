// Drawing arm: jog + inverse kinematics + clock. Arduino Mega.
// Pins: base D9, elbow D10, pen D11.  Serial 115200 (works with jog.py).
//   n / m  base +/-     h / j  elbow +/-     u / y  pen +/-     + / -  step size
//   c  draw circle   t  draw hands at 3 o'clock   x  erase the hands   r  go home (servo b160, e10)
//   k  eraser calibration: puts the eraser on the clock centre and holds it there
// base + turns anticlockwise. Elbow servo runs the opposite way to the bend:
// servo angle = ELBOW_K - bend (bend 0 = links straight, + = clockwise).
// Coordinates in mm, origin = base shaft, +y up the board (12 o'clock).

#include <Servo.h>
#include <math.h>

const int PINS[3] = {9, 10, 11};      // base, elbow, pen
const char UP[3] = {'n', 'h', 'u'};
const char DN[3] = {'m', 'j', 'y'};

const float OFF = 60;                 // deg: where base 0 points
const float L1 = 160, L2 = 200;       // mm
const float ELBOW_K = 175;            // elbow servo angle = ELBOW_K - geometric bend
const float HOME_B = 160, HOME_E = 10;  // servo angles at home
const float PEN_UP = 40, PEN_DOWN = 4;    // measured with u / y
const float ERASE_DOWN = 150;             // pen servo angle with the eraser on the board
const float ERASER_BACK = -14;            // CALIBRATE: mm the eraser sits behind the pen tip along arm 2 (negative = beyond it)
const float ERASER_SIDE = 42;             // CALIBRATE: mm the eraser sits to the RIGHT of arm 2's line (looking elbow -> pen)
const float CX = 0, CY = 220, R = 80;     // clock centre and radius, mm
const int N = 180;                         // points around the circle
const int STEP_MS = 25;

const int CLOCK_H = 3, CLOCK_M = 0;        // time drawn by 't'
const float HOUR_LEN = 0.5 * R, MIN_LEN = 0.75 * R;
const float HAND_DX = 3, HAND_DY = -3;     // CALIBRATE: mm to nudge the DRAWN hands (+x right, +y up); eraser unaffected

Servo s[3];
float ang[3];
float toolL2 = L2;                         // straight-line distance elbow -> active tool tip
float toolAng = 0;                         // rad: tool tip direction minus arm 2 direction (+ = anticlockwise)
float toolDown = PEN_DOWN;

void usePen()    { toolL2 = L2; toolAng = 0; toolDown = PEN_DOWN; }
void useEraser() {
  float a = L2 - ERASER_BACK;
  toolL2 = hypot(a, ERASER_SIDE);
  toolAng = atan2(-ERASER_SIDE, a);         // right of the arm = clockwise
  toolDown = ERASE_DOWN;
}
int stepDeg = 2;

void setAng(int i, float a) {
  ang[i] = constrain(a, 0, 180);
  s[i].writeMicroseconds(544 + ang[i] * (2400 - 544) / 180.0);
}

void penTo(float a) { setAng(2, a); delay(300); }

// tool tip x,y (mm) -> base servo b, elbow servo e (deg). false if out of reach or outside 0..180.
// The tool tip is treated as a virtual arm from the elbow; toolAng corrects the real elbow bend.
bool ik(float x, float y, float &b, float &e) {
  float c2 = (x*x + y*y - L1*L1 - toolL2*toolL2) / (2 * L1 * toolL2);
  if (c2 < -1 || c2 > 1) return false;
  float er = acos(c2);                                   // elbow bend, 0..pi
  float t1 = atan2(y, x) + atan2(toolL2 * sin(er), L1 + toolL2 * cos(er));
  b = fmod(degrees(t1) - OFF + 720.0, 360.0);
  e = ELBOW_K - degrees(er + toolAng);                   // real arm-2 bend -> elbow servo angle
  return b <= 180 && e >= 0 && e <= 180;
}

void glide(float b, float e) {                           // both joints, smooth
  float b0 = ang[0], e0 = ang[1];
  int n = max(1, (int)max(fabs(b - b0), fabs(e - e0)));
  for (int k = 1; k <= n; k++) {
    setAng(0, b0 + (b - b0) * k / n);
    setAng(1, e0 + (e - e0) * k / n);
    delay(STEP_MS);
  }
}

void drawCircle() {
  float b, e;
  for (int k = 0; k <= N; k++) {                         // check every point first
    float t = 2 * PI * k / N;
    if (!ik(CX + R * cos(t), CY + R * sin(t), b, e)) { Serial.println("circle out of reach"); return; }
  }
  penTo(PEN_UP);
  ik(CX + R, CY, b, e);
  glide(b, e);                                           // travel to start, pen up
  penTo(toolDown);
  for (int k = 1; k <= N; k++) {
    float t = 2 * PI * k / N;
    ik(CX + R * cos(t), CY + R * sin(t), b, e);
    setAng(0, b); setAng(1, e);
    delay(STEP_MS);
  }
  penTo(PEN_UP);
  Serial.println("circle done");
}

// straight line from (x0,y0) to (x1,y1), pen down, 1 mm steps
bool drawLine(float x0, float y0, float x1, float y1) {
  float b, e;
  int n = max(1, (int)hypot(x1 - x0, y1 - y0));
  for (int k = 0; k <= n; k++)                           // check every point first
    if (!ik(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, b, e)) { Serial.println("line out of reach"); return false; }
  penTo(PEN_UP);
  ik(x0, y0, b, e);
  glide(b, e);                                           // travel to start, pen up
  penTo(toolDown);
  for (int k = 1; k <= n; k++) {
    ik(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, b, e);
    setAng(0, b); setAng(1, e);
    delay(STEP_MS);
  }
  penTo(PEN_UP);
  return true;
}

// hands from the centre; 12 o'clock = +y, angles go clockwise
void drawTime(int h, int m) {
  float ma = radians(90 - m * 6.0);
  float ha = radians(90 - ((h % 12) + m / 60.0) * 30.0);
  float ox = CX + HAND_DX, oy = CY + HAND_DY;           // where the hands meet
  drawLine(ox, oy, ox + HOUR_LEN * cos(ha), oy + HOUR_LEN * sin(ha));
  drawLine(ox, oy, ox + MIN_LEN * cos(ma), oy + MIN_LEN * sin(ma));
  Serial.println("time done");
}

// eraser: wipe along each hand, a little past its end, back and forth
void eraseTime(int h, int m) {
  const float EXTRA = 8;                                 // mm past the hand tip
  float ma = radians(90 - m * 6.0);
  float ha = radians(90 - ((h % 12) + m / 60.0) * 30.0);
  useEraser();
  for (int pass = 0; pass < 2; pass++) {
    drawLine(CX, CY, CX + (HOUR_LEN + EXTRA) * cos(ha), CY + (HOUR_LEN + EXTRA) * sin(ha));
    drawLine(CX, CY, CX + (MIN_LEN + EXTRA) * cos(ma), CY + (MIN_LEN + EXTRA) * sin(ma));
  }
  usePen();
  Serial.println("erase done");
}

// put the eraser on the clock centre and hold it, to check ERASER_BACK / ERASER_SIDE
void eraserCalib() {
  float b, e;
  useEraser();
  if (ik(CX, CY, b, e)) {
    penTo(PEN_UP); glide(b, e); penTo(ERASE_DOWN);
    Serial.println("eraser should be on the clock centre. Press r to go home.");
  } else Serial.println("centre out of reach for eraser");
  usePen();
}

void goHome() { penTo(PEN_UP); glide(HOME_B, HOME_E); }

void setup() {
  Serial.begin(115200);
  setAng(0, HOME_B); setAng(1, HOME_E); setAng(2, PEN_UP);   // set before attach: no jump
  for (int i = 0; i < 3; i++) s[i].attach(PINS[i]);
  Serial.println("Ready: n/m base, h/j elbow, u/y pen, +/- step, c circle, t 3 o'clock, x erase, k eraser check, r home");
}

void loop() {
  if (!Serial.available()) return;
  char c = Serial.read();
  if (c == '\n' || c == '\r') return;
  if (c == '+') stepDeg = min(10, stepDeg + 1);
  if (c == '-') stepDeg = max(1, stepDeg - 1);
  if (c == 'c') drawCircle();
  if (c == 't') drawTime(CLOCK_H, CLOCK_M);
  if (c == 'x') eraseTime(CLOCK_H, CLOCK_M);
  if (c == 'k') eraserCalib();
  if (c == 'r') goHome();
  for (int i = 0; i < 3; i++) {
    if (c == UP[i]) setAng(i, ang[i] + stepDeg);
    if (c == DN[i]) setAng(i, ang[i] - stepDeg);
  }
  Serial.print("b="); Serial.print(ang[0], 1);
  Serial.print(" e="); Serial.print(ang[1], 1);
  Serial.print(" p="); Serial.print(ang[2], 1);
  Serial.print("  step="); Serial.println(stepDeg);
}
