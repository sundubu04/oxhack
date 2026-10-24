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

## Smoothing the line

The jagged line the sim used to show was the sim, not the motors: it rounded every command to a whole degree and
jumped from waypoint to waypoint, which draws a staircase. The firmware sends microseconds and moves smoothly
between keyframes, so the real limits are the servo's dead band and the play in its gears.
`node app/tools/compare-servos.mjs <dir>` draws the clock under each model (results below, for the design numbers).

| Model of the clock face | Off the line, mean | Worst |
|---|---|---|
| Whole-degree commands, jumping (the old sim) | 1.0 mm | 3.3 mm, a staircase (+27% ink) |
| SG92R, 1° dead band, smooth commands | 1.4 mm | 4.0 mm, smooth but trailing, hooks at stroke starts |
| Same with 1° of gear play | 3.1 mm | 8.0 mm |
| Dead band and play compensated, 3 mm lead-in (now the default) | 0.0 mm | 0.1 mm |
| 2:1 reduction, no compensation, 1° play | 1.4 mm | 4.0 mm (half the error of no reduction) |
| Stepper, 1/16 microsteps, direct | 0.1 mm | 0.3 mm |

What the app now does (software, no new parts):
- **Compensation:** a servo stops half its dead band short of a command and its gears leave the link half the play behind, both on the side it came from. Each base and elbow command is pushed that far ahead in the direction the joint is moving, flipping when it reverses.
- **Lead-in:** each stroke starts with a 3 mm pen-up glide in the stroke's own direction, so the slack is already taken up when the pen touches down. This removes the hooks at the start of strokes.

The model is tidier than a real servo: its dead band is exact and the same every time. Expect a clear gain on the
real arm, not the model's 0.1 mm, and check it on the board.

What to do with the motors, in order:
1. **Measure, then enter the numbers** in Arm setup, Smoothing. Dead band: send `J` commands 0.1° apart from the Serial Monitor and note the smallest step that moves the horn. Gear play: with the servo holding, wiggle the link and measure how far the pen tip moves; play in degrees ≈ tip movement ÷ distance from the joint × 57.3.
2. **Make the horn joint rigid:** screw the servo's own horn into the link. A printed spline that slips adds play that changes as it wears, which compensation can't follow.
3. **Preload the joints:** a rubber band from each link to the frame keeps the gears pressed on one side, so the play stays taken up.
4. **Give the servos their own 5 V supply.** A sagging supply makes them twitch, and no software removes that.
5. **If it still wobbles, add a 2:1 reduction** (GT2 belt or printed gears) to base and elbow; it halves dead band and play at the link. The drawing square needs 89° of base travel and 83° of elbow, so 2:1 uses 178° and 166° of a 180° servo: it fits, with the zero offsets set carefully. 3:1 does not fit. Set the ratio in the servo table.
6. **Steppers** are the step after that: in the sim, 1/16 microstepping is within 0.3 mm with no compensation. They need drivers and are much heavier; mount both at the base and drive the elbow with a belt.

## Where a Raspberry Pi fits

| Setup | When | Notes |
|---|---|---|
| Laptop + Arduino | the demo | what is built and tested above |
| Pi + Arduino | the arm runs on its own, e.g. keeping time on a wall | the Pi runs `node server.mjs` and Chromium in kiosk mode on the arm's page; Chromium on Pi OS has Web Serial, so nothing else changes |
| Pi alone + a PCA9685 servo board (I2C) | fewer parts | the PCA9685 makes the pulses in hardware, but the keyframe timing would have to move into a Pi process; more work than it saves |
| Pi GPIO pins straight to the servos | not recommended | software pulses on Linux jitter, which shows as a shaky line |
