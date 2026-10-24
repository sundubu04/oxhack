// Clockedin arm firmware, for an Arduino Uno or Nano driving three hobby servos (base, elbow, tilt).
// The Clockedin app streams timed keyframes over USB; this board buffers them and moves the servos between
// them on its own clock, once per servo frame (20 ms), so the laptop's timing never shows in the line.
// Protocol (115200 baud, one line each, angles in centi-degrees of servo travel, 0 to 18000):
//   ?                      -> CLOCKEDIN 2 <slots>
//   K <t_ms> <b> <e> <w>   keyframe at t ms after G      -> F <free slots> (one reply per K, in order)
//   G                      glide to the first keyframe, then start the clock -> RUN
//   E                      no more keyframes; finish     -> DONE when the last one is reached
//   S                      ease to a stop along the path, drop the buffer -> STOPPED
//   J <b> <e> <w>          glide there (jog)             -> F <free slots>
//   P                      glide to the park pose        -> F <free slots>
// While running it reports T <t_ms> <free> whenever slots free up (at most every 100 ms), and LATE if the
// buffer runs dry. The app counts its unanswered K lines against <free>, so the buffer never overfills.
// A hobby servo told to stop dead overshoots, so nothing here starts or stops at once: the app's keyframes speed up
// and slow down already, glides (G, J, P) ramp at SERVO_ACCEL, and S slows the job's clock to zero over STOP_MS.
#include <Servo.h>
#include "arm_config.h"                          // pins, pulse widths and the park pose, from app/arm.config.json

const uint8_t SLOTS = 48;                        // keyframes held (10 bytes each)
const uint16_t FRAME_MS = 20;                    // a hobby servo reads one pulse every 20 ms
const float GLIDE_SPEED = 120;                   // deg/s for glides

struct Key { uint32_t t; int16_t a[3]; };
Key buf[SLOTS];
uint8_t head = 0, count = 0;
Servo servo[3];
bool running = false, ended = false, late = false, approaching = false, stopping = false;
float tJob = 0, rate = 1;                        // the job's clock (ms) and how fast it runs; S brings rate to 0
float pos[3], vel[3], aim[3];                    // centi-degrees (per s) where each servo is, how fast, where it glides to
uint32_t lastFrame = 0, lastReport = 0;
char line[48];
uint8_t len = 0;

void put(uint8_t j, long cdeg) {
  cdeg = constrain(cdeg, 0, 18000);
  pos[j] = cdeg;
  servo[j].writeMicroseconds(map(cdeg, 0, 18000, US_MIN[j], US_MAX[j]));
}
void putAll(const int16_t a[3]) { for (uint8_t j = 0; j < 3; j++) put(j, a[j]); }
void glideTo(const int16_t a[3]) { for (uint8_t j = 0; j < 3; j++) aim[j] = a[j]; }

// The fastest speed that can still stop on the spot d away, slowing by a*dt each frame (not the smooth-motion
// sqrt(2ad), which arrives too fast for 20 ms frames and stops dead in the last one).
float braking(float d, float a, float dt) { return a * dt * (sqrt(0.25 + 2 * fabs(d) / (a * dt * dt)) - 0.5); }

// One frame of a glide: each servo speeds up toward its aim and slows down in time to stop on it.
bool follow(float dt) {
  const float A = SERVO_ACCEL * 100, V = GLIDE_SPEED * 100;
  bool still = true;
  for (uint8_t j = 0; j < 3; j++) {
    float d = aim[j] - pos[j], want = min(V, braking(d, A, dt));
    vel[j] += constrain((d < 0 ? -want : want) - vel[j], -A * dt, A * dt);
    float step = vel[j] * dt;
    if (fabs(d) < 1 || (d > 0 && step >= d) || (d < 0 && step <= d)) { vel[j] = 0; put(j, aim[j]); }
    else { put(j, pos[j] + step); still = false; }
  }
  return still;
}
uint8_t freeSlots() { return SLOTS - count; }
void credit() { Serial.print(F("F ")); Serial.println(freeSlots()); }

void setup() {
  Serial.begin(115200);
  for (uint8_t j = 0; j < 3; j++) servo[j].attach(PIN[j], US_MIN[j], US_MAX[j]);
  putAll(PARK); glideTo(PARK);
}

// Read one line at a time without blocking the servo frames.
void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') { if (len) { line[len] = 0; handle(line); len = 0; } }
    else if (len < sizeof(line) - 1) line[len++] = c;
  }
  uint32_t now = millis();
  if (now - lastFrame >= FRAME_MS) { float dt = min((now - lastFrame) / 1000.0, 0.1); lastFrame = now; frame(now, dt); }
}

void handle(char *s) {
  long v[4] = {0, 0, 0, 0};
  char cmd = s[0];
  char *p = s + 1;
  for (uint8_t i = 0; i < 4 && *p; i++) v[i] = strtol(p, &p, 10);
  switch (cmd) {
    case '?': Serial.print(F("CLOCKEDIN 2 ")); Serial.println(SLOTS); break;
    case 'K':
      if (count < SLOTS) {
        Key &k = buf[(head + count) % SLOTS];
        k.t = v[0]; k.a[0] = v[1]; k.a[1] = v[2]; k.a[2] = v[3];
        count++;
      }
      credit();
      break;
    case 'G': if (count) { approaching = true; ended = false; glideTo(buf[head].a); } break;
    case 'E': ended = true; break;
    case 'S':
      if (running) { stopping = true; break; }   // STOPPED once the clock has eased to a halt
      approaching = false; count = 0; head = 0;
      for (uint8_t j = 0; j < 3; j++) aim[j] = pos[j] + vel[j] * fabs(vel[j]) / (2 * SERVO_ACCEL * 100);   // where a glide can stop
      Serial.println(F("STOPPED")); break;
    case 'J': { int16_t a[3] = {(int16_t)v[0], (int16_t)v[1], (int16_t)v[2]}; if (!running) glideTo(a); credit(); break; }
    case 'P': if (!running) glideTo(PARK); credit(); break;
  }
}

// One servo frame: glide, or find the two keyframes either side of the job's clock and move to the point between.
void frame(uint32_t now, float dt) {
  if (!running) {
    bool there = follow(dt);
    if (approaching && there) { approaching = false; running = true; stopping = false; tJob = 0; rate = 1; Serial.println(F("RUN")); }
    return;
  }
  if (stopping) {
    rate -= dt * 1000 / STOP_MS;
    if (rate <= 0) { running = stopping = false; count = 0; head = 0; for (uint8_t j = 0; j < 3; j++) { aim[j] = pos[j]; vel[j] = 0; } Serial.println(F("STOPPED")); return; }
  }
  tJob += dt * 1000 * rate;
  uint32_t t = tJob;
  uint8_t freed = 0;
  while (count >= 2 && buf[(head + 1) % SLOTS].t <= t) { head = (head + 1) % SLOTS; count--; freed++; }
  Key &a = buf[head];
  if (count == 1 || t <= a.t) {
    putAll(a.a);
    if (count == 1 && t >= a.t) {
      if (ended) { running = false; count = 0; head = 0; for (uint8_t j = 0; j < 3; j++) { aim[j] = pos[j]; vel[j] = 0; } Serial.println(F("DONE")); return; }
      if (!late) Serial.println(F("LATE"));   // the app fell behind: hold here until more keyframes arrive
      late = true;
    }
  } else {
    late = false;
    Key &b = buf[(head + 1) % SLOTS];
    float u = (float)(t - a.t) / (float)(b.t - a.t);
    for (uint8_t j = 0; j < 3; j++) put(j, a.a[j] + (long)((b.a[j] - a.a[j]) * u));
  }
  if ((freed && now - lastReport >= 100) || now - lastReport >= 500) { lastReport = now; Serial.print(F("T ")); Serial.print(t); Serial.print(' '); Serial.println(freeSlots()); }
}
