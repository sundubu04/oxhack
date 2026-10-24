// Clockedin playback: the board draws one drawing by itself, from drawing.h, with no app or computer once it is
// uploaded. Make drawing.h with "./firmware/arm draw <what>" (app/tools/arduino-export.mjs plans it exactly as
// the app does). It moves the servos between keyframes once per servo frame, the same way firmware/clockedin does.
// Nothing starts or stops at once, because a servo told to stop dead overshoots: the keyframes speed up and slow
// down already, glides ramp at SERVO_ACCEL, and stop and speed ease the drawing's clock over STOP_MS.
// Serial Monitor at 115200 baud, newline:
//   go           draw it from the start          stop     ease to a halt and hold
//   park         glide to the park pose           loop     draw it again and again (loop again to stop)
//   speed 50     play at 50% (or 25 to 200)       info     what drawing.h holds
#include <Servo.h>
#include <avr/pgmspace.h>
#include "arm_config.h"
#include "drawing.h"

#define AUTOSTART 0                 // 1: draw it 3 s after power-up, with no Serial Monitor at all
const uint16_t FRAME_MS = 20;

Servo servo[3];
bool playing = false, looping = false;
uint16_t k = 0;                    // the keyframe being left
uint32_t tA = 0, tB = 0;           // its time and the next one's, ms on the drawing's clock
int16_t A[3], B[3], now3[3];
float rate = 1, want = 1, speedPct = 1;   // drawing ms per real ms, what it is easing to, and the speed asked for
float tDraw = 0;                   // ms on the drawing's clock
uint32_t lastFrame = 0, lastReport = 0;
uint8_t lastTenth = 0;
char line[24];
uint8_t len = 0;

void put(uint8_t j, long cdeg) {
  cdeg = constrain(cdeg, LIMIT_MIN[j], LIMIT_MAX[j]);
  now3[j] = cdeg;
  servo[j].writeMicroseconds(map(cdeg, 0, 18000, US_MIN[j], US_MAX[j]));
}
uint16_t keyAt(uint16_t i, uint8_t f) { return pgm_read_word(&DRAWING[i][f]); }
void load(uint16_t i, int16_t a[3]) { for (uint8_t j = 0; j < 3; j++) a[j] = keyAt(i, j + 1); }

// The fastest speed that can still stop on the spot d away, slowing by a*dt each frame (not the smooth-motion
// sqrt(2ad), which arrives too fast for 20 ms frames and stops dead in the last one).
float braking(float d, float a, float dt) { return a * dt * (sqrt(0.25 + 2 * fabs(d) / (a * dt * dt)) - 0.5); }

// glide from where the servos are to a pose at up to 120 deg/s, each servo speeding up and slowing down at
// SERVO_ACCEL; blocks until it is there
void glide(const int16_t to[3]) {
  const float A = SERVO_ACCEL * 100, V = 12000, dt = FRAME_MS / 1000.0;
  float p[3], v[3] = {0, 0, 0};
  for (uint8_t j = 0; j < 3; j++) p[j] = now3[j];
  for (bool moving = true; moving; delay(FRAME_MS)) {
    moving = false;
    for (uint8_t j = 0; j < 3; j++) {
      float d = to[j] - p[j], w = min(V, braking(d, A, dt));
      v[j] += constrain((d < 0 ? -w : w) - v[j], -A * dt, A * dt);
      if (fabs(d) < 1 || fabs(v[j] * dt) >= fabs(d)) { p[j] = to[j]; v[j] = 0; } else { p[j] += v[j] * dt; moving = true; }
      put(j, p[j]);
    }
  }
}
void park() { playing = false; glide(PARK); Serial.println(F("parked")); }

void info() {
  Serial.print(F("drawing: ")); Serial.print(F(DRAWING_NAME)); Serial.print(F(", ")); Serial.print(DRAWING_KEYS);
  Serial.print(F(" keyframes, ")); Serial.print(DRAWING_MS / 1000.0, 1); Serial.print(F(" s at 100%, now ")); Serial.print((int)(speedPct * 100)); Serial.println('%');
}

void go() {
  int16_t first[3]; load(0, first);
  glide(first);                              // the first keyframe is the park pose: get there gently
  k = 0; tA = 0; load(0, A); load(1, B); tB = keyAt(1, 0);
  tDraw = 0; rate = want = speedPct; lastFrame = millis(); lastTenth = 0; playing = true;
  Serial.println(F("drawing"));
}

void setup() {
  Serial.begin(115200);
  for (uint8_t j = 0; j < 3; j++) { now3[j] = PARK[j]; servo[j].writeMicroseconds(map(PARK[j], 0, 18000, US_MIN[j], US_MAX[j])); servo[j].attach(PIN[j], US_MIN[j], US_MAX[j]); }
  Serial.println(F("Clockedin playback. Parked. Type go to draw, or help."));
  info();
  if (AUTOSTART) { delay(3000); go(); }
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') { if (len) { line[len] = 0; handle(line); len = 0; } }
    else if (len < sizeof(line) - 1) line[len++] = tolower(c);
  }
  uint32_t ms = millis();
  if (ms - lastFrame >= FRAME_MS) { float dt = ms - lastFrame; lastFrame = ms; if (playing) frame(dt); }
}

// One servo frame: ease the clock's rate toward what was asked (0 after stop), move the drawing's clock on, find
// the keyframes either side of it and move to the point between.
void frame(float dt) {
  rate += constrain(want - rate, -dt / STOP_MS, dt / STOP_MS);
  if (want == 0 && rate <= 0) { rate = 0; playing = false; Serial.println(F("stopped")); return; }
  tDraw += dt * rate;
  uint32_t t = tDraw;
  while (t >= tB) {
    if (k + 2 >= DRAWING_KEYS) {             // past the last keyframe
      for (uint8_t j = 0; j < 3; j++) put(j, B[j]);
      playing = false; Serial.println(F("done"));
      if (looping) { delay(2000); go(); }
      return;
    }
    k++; tA = tB; for (uint8_t j = 0; j < 3; j++) A[j] = B[j];
    load(k + 1, B); tB += keyAt(k + 1, 0);
  }
  float u = tB > tA ? (float)(t - tA) / (float)(tB - tA) : 1;
  for (uint8_t j = 0; j < 3; j++) put(j, A[j] + (long)((B[j] - A[j]) * u));
  uint8_t tenth = (uint8_t)(10UL * t / DRAWING_MS);
  if (tenth != lastTenth) { lastTenth = tenth; Serial.print(tenth * 10); Serial.print(F("%  ")); Serial.print(t / 1000.0, 1); Serial.println(F(" s")); }
}

void handle(char *s) {
  Serial.print(F("> ")); Serial.println(s);
  if (!strcmp(s, "go")) go();
  else if (!strcmp(s, "stop")) { if (playing) want = 0; }   // says stopped once it has eased to a halt
  else if (!strcmp(s, "park")) park();
  else if (!strcmp(s, "loop")) { looping = !looping; Serial.println(looping ? F("looping") : F("not looping")); if (looping && !playing) go(); }
  else if (!strncmp(s, "speed", 5)) { speedPct = constrain(atoi(s + 5), 25, 200) / 100.0; if (playing && want) want = speedPct; info(); }
  else if (!strcmp(s, "info")) info();
  else Serial.println(F("go  stop  park  loop  speed <25-200>  info"));
}
