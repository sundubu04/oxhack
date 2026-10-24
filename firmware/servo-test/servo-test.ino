// Clockedin motor test: drive each servo by hand from the Serial Monitor, no app needed. 115200 baud, newline.
// Every move is a glide at a set speed (60 deg/s to start), never a jump: each servo speeds up and slows down at
// a set acceleration (SERVO_ACCEL from the app's config to start), because a servo told to stop dead overshoots.
// Moves stay inside the limits in arm_config.h. Type "help" for the commands. The arm's numbers come from app/arm.config.json through
// arm_config.h; regenerate it with "./firmware/arm config".
//
//   b 90 | e 45 | t 120      one servo to that many degrees of its travel (0 to 180)
//   all 90 90 90             all three
//   park | mid               the park pose (pen up) | every servo at 90
//   pen draw|lift|erase      tilt the pen to touch the nib, lift it, or touch the eraser
//   sweep b|e|t|all [lo hi]  swing between the limits (or lo and hi) twice
//   ga 90 -90                joint angles as the app counts them (base from +x, elbow from the upper arm, - clockwise)
//   xy 0 215                 the nib to a board point in mm from the base (x right, y away from it)
//   square 100 | circle 40   draw one, pen down, at the middle of the drawing area (size in mm)
//   speed 60                 glide speed in deg/s          where     positions now
//   accel 1500               how fast a glide speeds up and slows down, deg/s². To tune: "speed 300", then
//                            "sweep b 60 120" at a few accels; the highest with no overshoot at the ends, less
//                            a third, goes in Arm setup as Servo acceleration
//   us b 1500                raw pulse in microseconds, to calibrate US_MIN / US_MAX (no limits: go gently)
//   stop                     slow to a halt and hold
#include <Servo.h>
#include "arm_config.h"

const char *NAME[3] = {"base", "elbow", "tilt"};
const uint16_t FRAME_MS = 20;

Servo servo[3];
float pos[3], target[3], vel[3];   // degrees of servo travel, and deg/s
float speed = 60, accel = SERVO_ACCEL;   // deg/s, deg/s²
int8_t sweepJoint = -1;          // -1 none, 0..2 one servo, 3 base and elbow together
float sweepLo[3], sweepHi[3];
uint8_t sweepLeft = 0;
// a shape the pen follows: points in board mm, walked at PATH_SPEED
const uint8_t PATH_MAX = 49;
float pathX[PATH_MAX], pathY[PATH_MAX];
uint8_t pathN = 0, pathI = 0;
float pathT = 0, pathV = 0;      // 0..1 along the current segment, and the pen's speed now
const float PATH_SPEED = 40;     // mm/s, slow on purpose; it speeds up and slows down at PEN_ACCEL
uint8_t pathStage = 0;           // 0 off, 1 gliding to the start (pen up), 2 pen going down, 3 drawing, 4 pen going up
char line[48];
uint8_t len = 0;
uint32_t lastFrame = 0;

float lo(uint8_t j) { return LIMIT_MIN[j] / 100.0; }
float hi(uint8_t j) { return LIMIT_MAX[j] / 100.0; }
void put(uint8_t j, float deg) { servo[j].writeMicroseconds(US_MIN[j] + (long)((US_MAX[j] - US_MIN[j]) * constrain(deg, 0, 180) / 180.0)); }
bool settled() { for (uint8_t j = 0; j < 3; j++) if (fabs(pos[j] - target[j]) > 0.05 || vel[j]) return false; return true; }

// Ask for a servo position; anything past a limit is held at the limit, and says so.
void aim(uint8_t j, float deg, bool say = true) {
  float d = constrain(deg, lo(j), hi(j));
  if (d != deg && say) { Serial.print(NAME[j]); Serial.print(F(" held at its limit, ")); Serial.println(d); }
  target[j] = d;
}

// The app's geometry: joint angles -> servo degrees, and a board point -> joint angles for the nib.
float servoDeg(uint8_t j, float joint) { return OFFSET[j] + DIR[j] * RATIO[j] * joint; }
bool solve(float x, float y, float &base, float &elbow) {
  float L = sqrt(L2 * L2 + NIB_SIDE * NIB_SIDE), gamma = atan2(NIB_SIDE, L2);
  float r2 = x * x + y * y, r = sqrt(r2);
  if (r > L1 + L || r < fabs(L1 - L)) return false;
  float c2 = constrain((r2 - L1 * L1 - L * L) / (2 * L1 * L), -1, 1), s2 = sqrt(1 - c2 * c2) * (ELBOW_UP ? 1 : -1);
  float t2 = atan2(s2, c2), t1 = atan2(y, x) - atan2(L * s2, L1 + L * c2);
  base = t1 * 180 / PI;   // unwrapped, as the app's IK gives it: the zero offsets are set for these angles
  elbow = (t2 - gamma) * 180 / PI;
  return true;
}
bool aimXY(float x, float y, bool say = true) {
  float b, e;
  if (!solve(x, y, b, e)) { if (say) Serial.println(F("out of reach")); return false; }
  aim(0, servoDeg(0, b), say); aim(1, servoDeg(1, e), say);
  return true;
}

void setup() {
  Serial.begin(115200);
  for (uint8_t j = 0; j < 3; j++) { pos[j] = target[j] = PARK[j] / 100.0; put(j, pos[j]); servo[j].attach(PIN[j], US_MIN[j], US_MAX[j]); }
  Serial.println(F("Clockedin motor test. Parked. Type help."));
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') { if (len) { line[len] = 0; Serial.print(F("> ")); Serial.println(line); handle(line); len = 0; } }
    else if (len < sizeof(line) - 1) line[len++] = c;
  }
  uint32_t now = millis();
  if (now - lastFrame >= FRAME_MS) { float dt = min((now - lastFrame) / 1000.0, 0.1); lastFrame = now; frame(dt); }
}

// The fastest speed that can still stop on the spot d away, slowing by a*dt each frame (not the smooth-motion
// sqrt(2ad), which arrives too fast for 20 ms frames and stops dead in the last one).
float braking(float d, float a, float dt) { return a * dt * (sqrt(0.25 + 2 * fabs(d) / (a * dt * dt)) - 0.5); }

// One servo frame: each servo speeds up toward its target and slows down in time to stop on it, then the sweep
// or the shape moves along.
void frame(float dt) {
  for (uint8_t j = 0; j < 3; j++) {
    float d = target[j] - pos[j], want = min(speed, braking(d, accel, dt));
    vel[j] += constrain((d < 0 ? -want : want) - vel[j], -accel * dt, accel * dt);
    float step = vel[j] * dt;
    if (fabs(d) < 0.05 || (d > 0 && step >= d) || (d < 0 && step <= d)) { pos[j] = target[j]; vel[j] = 0; }
    else pos[j] += step;
    put(j, pos[j]);
  }
  if (sweepJoint >= 0 && settled()) {
    if (!sweepLeft) { sweepJoint = -1; Serial.println(F("sweep done")); return; }
    bool up = fabs(pos[sweepJoint == 3 ? 0 : sweepJoint] - sweepLo[sweepJoint == 3 ? 0 : sweepJoint]) < 0.1;
    for (uint8_t j = 0; j < 3; j++) if (sweepJoint == j || (sweepJoint == 3 && j < 2)) target[j] = up ? sweepHi[j] : sweepLo[j];
    if (!up) sweepLeft--;
  }
  if (pathStage) followPath(dt);
}

void followPath(float dt) {
  if (pathStage == 1 && settled()) { aim(2, TILT_DRAW / 100.0); pathStage = 2; return; }
  if (pathStage == 2 && settled()) { pathStage = 3; pathI = 0; pathT = 0; pathV = 0; return; }
  if (pathStage == 3) {
    float dx = pathX[pathI + 1] - pathX[pathI], dy = pathY[pathI + 1] - pathY[pathI], d = sqrt(dx * dx + dy * dy);
    // full speed, but slowing to a stop at the end and at any corner sharper than 30 deg
    bool corner = pathI + 2 >= pathN;
    if (!corner) { float ex = pathX[pathI + 2] - pathX[pathI + 1], ey = pathY[pathI + 2] - pathY[pathI + 1], e = sqrt(ex * ex + ey * ey); corner = e > 0 && d > 0 && (dx * ex + dy * ey) / (d * e) < 0.866; }
    float vWant = corner ? min(PATH_SPEED, sqrt(2 * PEN_ACCEL * (1 - pathT) * d)) : PATH_SPEED;
    pathV = max(2.0f, pathV + constrain(vWant - pathV, -PEN_ACCEL * dt, PEN_ACCEL * dt));
    pathT += d > 0 ? pathV * dt / d : 1;
    while (pathT >= 1 && pathI + 1 < pathN - 1) { pathT -= 1; pathI++; }
    if (pathT >= 1) { aimXY(pathX[pathN - 1], pathY[pathN - 1], false); pos[0] = target[0]; pos[1] = target[1]; aim(2, TILT_LIFT / 100.0); pathStage = 4; return; }
    // the pen walks the line itself, so the servos are put straight on it each frame
    aimXY(pathX[pathI] + (pathX[pathI + 1] - pathX[pathI]) * pathT, pathY[pathI] + (pathY[pathI + 1] - pathY[pathI]) * pathT, false);
    pos[0] = target[0]; pos[1] = target[1]; put(0, pos[0]); put(1, pos[1]);
    return;
  }
  if (pathStage == 4 && settled()) { pathStage = 0; Serial.println(F("drawn")); }
}

void startPath() {
  sweepJoint = -1;
  aim(2, TILT_LIFT / 100.0);
  if (aimXY(pathX[0], pathY[0])) pathStage = 1;
}

uint8_t joint(const char *s) {
  if (s[0] == 'b') return 0;
  if (s[0] == 'e') return 1;
  if (s[0] == 't') return 2;
  return 255;
}

void handle(char *s) {
  char *cmd = strtok(s, " "), *a1 = strtok(NULL, " "), *a2 = strtok(NULL, " "), *a3 = strtok(NULL, " ");
  if (!cmd) return;
  for (char *p = cmd; *p; p++) *p = tolower(*p);
  float v1 = a1 ? atof(a1) : 0, v2 = a2 ? atof(a2) : 0, v3 = a3 ? atof(a3) : 0;
  if (strcmp(cmd, "speed") && strcmp(cmd, "accel") && strcmp(cmd, "where")) pathStage = 0;   // any move ends a shape being drawn
  uint8_t j = joint(cmd);
  if (j < 3 && strlen(cmd) <= 5 && a1) { sweepJoint = -1; aim(j, v1); }
  else if (!strcmp(cmd, "all") && a3) { sweepJoint = -1; aim(0, v1); aim(1, v2); aim(2, v3); }
  else if (!strcmp(cmd, "park") || !strcmp(cmd, "home")) { sweepJoint = -1; for (uint8_t k = 0; k < 3; k++) aim(k, PARK[k] / 100.0); }
  else if (!strcmp(cmd, "mid")) { sweepJoint = -1; for (uint8_t k = 0; k < 3; k++) aim(k, 90); }
  else if (!strcmp(cmd, "pen") && a1) { aim(2, (a1[0] == 'd' ? TILT_DRAW : a1[0] == 'e' ? TILT_ERASE : TILT_LIFT) / 100.0); }
  else if (!strcmp(cmd, "sweep") && a1) {
    uint8_t k = a1[0] == 'a' ? 3 : joint(a1);
    if (k > 3) { Serial.println(F("sweep b, e, t or all")); return; }
    for (uint8_t i = 0; i < 3; i++) { sweepLo[i] = a2 ? max(v2, lo(i)) : lo(i); sweepHi[i] = a3 ? min(v3, hi(i)) : hi(i); }
    sweepJoint = k; sweepLeft = 2;
    for (uint8_t i = 0; i < 3; i++) if (k == i || (k == 3 && i < 2)) target[i] = sweepLo[i];
  }
  else if (!strcmp(cmd, "ga") && a2) { sweepJoint = -1; aim(0, servoDeg(0, v1)); aim(1, servoDeg(1, v2)); }
  else if (!strcmp(cmd, "xy") && a2) { sweepJoint = -1; aimXY(v1, v2); }
  else if (!strcmp(cmd, "square") || !strcmp(cmd, "circle")) {
    float size = a1 ? v1 : (cmd[0] == 's' ? 100 : 40);
    if (cmd[0] == 's') {
      float h = size / 2; float xs[5] = {-h, h, h, -h, -h}, ys[5] = {-h, -h, h, h, -h};
      pathN = 5; for (uint8_t i = 0; i < 5; i++) { pathX[i] = BOARD_CX + xs[i]; pathY[i] = BOARD_CY + ys[i]; }
    } else {
      pathN = PATH_MAX; for (uint8_t i = 0; i < pathN; i++) { float a = 2 * PI * i / (pathN - 1); pathX[i] = BOARD_CX + size * cos(a); pathY[i] = BOARD_CY + size * sin(a); }
    }
    startPath();
  }
  else if (!strcmp(cmd, "speed") && a1) { speed = constrain(v1, 5, 600); Serial.print(F("speed ")); Serial.println(speed); }
  else if (!strcmp(cmd, "accel") && a1) { accel = constrain(v1, 50, 20000); Serial.print(F("accel ")); Serial.println(accel); }
  else if (!strcmp(cmd, "us") && a2) {
    uint8_t k = joint(a1);
    if (k > 2) { Serial.println(F("us b, e or t, then microseconds")); return; }
    sweepJoint = -1; pathStage = 0;
    servo[k].writeMicroseconds(constrain((int)v2, 400, 2600));
    Serial.print(NAME[k]); Serial.print(F(" pulse ")); Serial.println((int)v2);
    return;
  }
  else if (!strcmp(cmd, "stop")) { sweepJoint = -1; for (uint8_t k = 0; k < 3; k++) target[k] = constrain(pos[k] + vel[k] * fabs(vel[k]) / (2 * accel), lo(k), hi(k)); }   // where it can stop
  else if (!strcmp(cmd, "where")) {}
  else { help(); return; }
  where();
}

void where() {
  for (uint8_t k = 0; k < 3; k++) { Serial.print(NAME[k]); Serial.print(' '); Serial.print(target[k], 1); Serial.print(k < 2 ? F("  ") : F(" deg\n")); }
}

void help() {
  Serial.println(F("b|e|t <deg>  all <b> <e> <t>  park  mid  pen draw|lift|erase  sweep b|e|t|all [lo hi]"));
  Serial.println(F("ga <base> <elbow>  xy <x mm> <y mm>  square [mm]  circle [radius mm]  speed <deg/s>  accel <deg/s2>"));
  Serial.println(F("us b|e|t <us>  stop  where"));
}
