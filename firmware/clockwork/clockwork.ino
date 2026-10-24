// Clockwork arm firmware, for an Arduino Uno or Nano driving three hobby servos (base, elbow, tilt).
// The Clockwork app streams timed keyframes over USB; this board buffers them and moves the servos between
// them on its own clock, once per servo frame (20 ms), so the laptop's timing never shows in the line.
// Protocol (115200 baud, one line each, angles in centi-degrees of servo travel, 0 to 18000):
//   ?                      -> CLOCKWORK 2 <slots>
//   K <t_ms> <b> <e> <w>   keyframe at t ms after G      -> F <free slots> (one reply per K, in order)
//   G                      start the clock               -> RUN
//   E                      no more keyframes; finish     -> DONE when the last one is reached
//   S                      stop where it is, drop the buffer -> STOPPED
//   J <b> <e> <w>          go there now (jog)            -> F <free slots>
//   P                      park                          -> F <free slots>
// While running it reports T <t_ms> <free> whenever slots free up (at most every 100 ms), and LATE if the
// buffer runs dry. The app counts its unanswered K lines against <free>, so the buffer never overfills.
#include <Servo.h>

const uint8_t PIN[3] = {9, 10, 11};             // base, elbow, tilt signal pins
const int US_MIN[3] = {544, 544, 544};           // pulse at 0 deg: the Servo library's default; calibrate per servo
const int US_MAX[3] = {2400, 2400, 2400};        // pulse at 180 deg
const int16_t PARK[3] = {2830, 7570, 8800};      // centi-degrees: the app's park pose for the design numbers, pen lifted
const uint8_t SLOTS = 48;                        // keyframes held (10 bytes each)
const uint16_t FRAME_MS = 20;                    // a hobby servo reads one pulse every 20 ms

struct Key { uint32_t t; int16_t a[3]; };
Key buf[SLOTS];
uint8_t head = 0, count = 0;
Servo servo[3];
bool running = false, ended = false, late = false;
uint32_t t0 = 0, lastFrame = 0, lastReport = 0;
char line[48];
uint8_t len = 0;

void put(uint8_t j, long cdeg) {
  cdeg = constrain(cdeg, 0, 18000);
  servo[j].writeMicroseconds(map(cdeg, 0, 18000, US_MIN[j], US_MAX[j]));
}
void putAll(const int16_t a[3]) { for (uint8_t j = 0; j < 3; j++) put(j, a[j]); }
uint8_t freeSlots() { return SLOTS - count; }
void credit() { Serial.print(F("F ")); Serial.println(freeSlots()); }

void setup() {
  Serial.begin(115200);
  for (uint8_t j = 0; j < 3; j++) servo[j].attach(PIN[j], US_MIN[j], US_MAX[j]);
  putAll(PARK);
}

// Read one line at a time without blocking the servo frames.
void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') { if (len) { line[len] = 0; handle(line); len = 0; } }
    else if (len < sizeof(line) - 1) line[len++] = c;
  }
  uint32_t now = millis();
  if (now - lastFrame >= FRAME_MS) { lastFrame = now; frame(now); }
}

void handle(char *s) {
  long v[4] = {0, 0, 0, 0};
  char cmd = s[0];
  char *p = s + 1;
  for (uint8_t i = 0; i < 4 && *p; i++) v[i] = strtol(p, &p, 10);
  switch (cmd) {
    case '?': Serial.print(F("CLOCKWORK 2 ")); Serial.println(SLOTS); break;
    case 'K':
      if (count < SLOTS) {
        Key &k = buf[(head + count) % SLOTS];
        k.t = v[0]; k.a[0] = v[1]; k.a[1] = v[2]; k.a[2] = v[3];
        count++;
      }
      credit();
      break;
    case 'G': running = true; ended = false; t0 = millis(); Serial.println(F("RUN")); break;
    case 'E': ended = true; break;
    case 'S': running = false; count = 0; head = 0; Serial.println(F("STOPPED")); break;
    case 'J': { int16_t a[3] = {(int16_t)v[0], (int16_t)v[1], (int16_t)v[2]}; if (!running) putAll(a); credit(); break; }
    case 'P': if (!running) putAll(PARK); credit(); break;
  }
}

// One servo frame: find the two keyframes either side of now and move to the point between them.
void frame(uint32_t now) {
  if (!running || !count) return;
  uint32_t t = now - t0;
  uint8_t freed = 0;
  while (count >= 2 && buf[(head + 1) % SLOTS].t <= t) { head = (head + 1) % SLOTS; count--; freed++; }
  Key &a = buf[head];
  if (count == 1 || t <= a.t) {
    putAll(a.a);
    if (count == 1 && t >= a.t) {
      if (ended) { running = false; count = 0; head = 0; Serial.println(F("DONE")); return; }
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
