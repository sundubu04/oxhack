# Connecting the arm: Arduino, and where a Pi fits

**Recommendation:** an Arduino Uno or Nano drives the three servos, plugged by USB into the laptop running Clockwork.
The app plans everything and streams timed keyframes; the Arduino does only the real-time part, moving the servos
between keyframes on its own 20 ms clock. Add a Raspberry Pi only if the arm must run without a laptop.

```
Laptop (Chrome, Clockwork, node server.mjs)
   │  USB serial, 115200 baud, protocol 2: timed keyframes, flow-controlled
   ▼
Arduino Uno / Nano (firmware/clockwork)   ── D9 base · D10 elbow · D11 tilt ──▶  3 × SG92R
   ▲                                                                              ▲
   └── powered by USB                                   5 V servo supply ─────────┘  (shared ground)
```

## Why this split is the efficient one

| Fact | Consequence |
|---|---|
| A hobby servo reads one pulse every 20 ms (50 Hz) | Commands faster than 50 Hz do nothing, so the board interpolates at exactly that rate |
| The clock face is 394 keyframes over 8.6 s, about 46 a second (sim) | A buffer of 48 holds about a second of drawing, enough to ride out USB and browser hiccups |
| A keyframe line is about 25 bytes; 115200 baud carries about 11,500 bytes a second | The stream uses about a tenth of the link |
| Browser and Linux timers jitter by milliseconds | Timing lives on the Arduino, which has no operating system in the way |
| The firmware is 6.3 KB of flash and 803 bytes of RAM on an Uno (compiled) | Room to spare on a Uno or Nano |

Tested without hardware: the app streamed the clock to a simulated board with the firmware's rules and 4 ms of USB
latency each way; the buffer stayed full, never overflowed and never ran dry. The real board is untested.

## Wiring

| Servo | Signal pin | Power |
|---|---|---|
| Base | D9 | 5 V supply, + and − |
| Elbow | D10 | 5 V supply, + and − |
| Tilt | D11 | 5 V supply, + and − |

- Power the servos from their own 5 V supply, not the Arduino's 5 V pin: a USB 2.0 port gives 500 mA, and three servos moving together can draw more. Join the supply's ground to the Arduino's GND.
- A large electrolytic capacitor across the servo supply, close to the servos, smooths the current spikes when they start moving.
- Plug the servo supply in after the Arduino is running: at start the firmware sends every servo to the park pose.

## Protocol 2 (firmware/clockwork/clockwork.ino)

One line each way, angles in centi-degrees of servo travel (0 to 18000), times in ms from the start.

| App sends | Board answers | Meaning |
|---|---|---|
| `?` | `CLOCKWORK 2 48` | handshake: protocol and buffer size |
| `K <t> <base> <elbow> <tilt>` | `F <free>` | one keyframe; the reply says how many slots are free |
| `G` | `RUN` | start the clock (the app sends it once 12 keyframes are buffered) |
| `E` | `DONE` when finished | no more keyframes |
| `S` | `STOPPED` | stop where it is, drop the buffer (the Stop the arm button) |
| `J <base> <elbow> <tilt>` | `F <free>` | go there now (dragging the pen on the board moves the real arm) |
| `P` | `F <free>` | park |
| | `T <t> <free>` | progress, when slots free up |
| | `LATE` | the buffer ran dry; the arm holds until more arrive |

The app counts its unanswered `K` lines against the last free count, so it never sends into a full buffer.
Keyframes come from the sim's own schedule: the arm holds still while the tilt changes, then reaches each waypoint
when the sim says it should, so the real arm and the on-screen arm keep the same pace.
A board that doesn't answer `?` gets protocol 1: plain `base,elbow,tilt,pressure` lines paced by the app.

## Bring-up

```
arduino-cli compile --fqbn arduino:avr:uno firmware/clockwork        # arduino:avr:nano for a Nano
arduino-cli board list                                                # find the port, e.g. /dev/cu.usbmodem1101
arduino-cli upload -p /dev/cu.usbmodem1101 --fqbn arduino:avr:uno firmware/clockwork
```

1. Open the Serial Monitor at 115200, type `?`: it should answer `CLOCKWORK 2 48`.
2. `J 9000 9000 9000` puts every servo at the middle of its travel. Note where each link points.
3. In Clockwork's Arm setup, set each servo's zero offset and direction so the sim's pose matches the real one; set the real link lengths and board position. Save.
4. If a servo doesn't reach its ends, change its `US_MIN` / `US_MAX` pulse widths at the top of the sketch (the defaults are the Servo library's, 544 to 2400 µs).
5. In Studio, Connect arm, then drag the pen on the board: the real arm should follow. Then draw a sample and Send to arm.

## Where a Raspberry Pi fits

| Setup | When | Notes |
|---|---|---|
| Laptop + Arduino | the demo | what is built and tested above |
| Pi + Arduino | the arm runs on its own, e.g. keeping time on a wall | the Pi runs `node server.mjs` and Chromium in kiosk mode on the arm's page; Chromium on Pi OS has Web Serial, so nothing else changes |
| Pi alone + a PCA9685 servo board (I2C) | fewer parts | the PCA9685 makes the pulses in hardware, but the keyframe timing would have to move into a Pi process; more work than it saves |
| Pi GPIO pins straight to the servos | not recommended | software pulses on Linux jitter, which shows as a shaky line |
