// Clockedin servo check: no commands and no settings. It sweeps the servo on D9, then D10, then D11, one at a
// time, 30 to 150 degrees and back twice, and lights the board's LED while a servo moves. If a servo stays still
// while the Serial Monitor says it is its turn, the problem is that servo's wiring or power, not the sketches.
#include <Servo.h>

const uint8_t PINS[3] = {9, 10, 11};
const char *NAMES[3] = {"base, pin D9", "elbow, pin D10", "tilt, pin D11"};
Servo servo;

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.println(F("Servo check: each pin in turn, 30 to 150 degrees and back."));
}

void sweep(int from, int to) {
  digitalWrite(LED_BUILTIN, HIGH);
  for (int a = from; a != to; a += (from < to ? 1 : -1)) { servo.write(a); delay(10); }
  digitalWrite(LED_BUILTIN, LOW);
  delay(300);
}

void loop() {
  for (uint8_t i = 0; i < 3; i++) {
    Serial.print(F("Moving now: ")); Serial.println(NAMES[i]);
    servo.attach(PINS[i]);
    servo.write(90); delay(500);
    for (uint8_t k = 0; k < 2; k++) { sweep(30, 150); sweep(150, 30); }
    servo.write(90); delay(500);
    servo.detach();
    delay(1000);
  }
}
