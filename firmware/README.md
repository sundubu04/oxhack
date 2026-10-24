# Running the arm without the app

Three sketches for an Arduino Uno or Nano, and one command to build, upload and talk to them. It works on this Mac and on the Raspberry Pi; both need `arduino-cli` (with `arduino-cli core install arduino:avr`) and `node`. Wiring and power are in [docs/hardware-link.md](../docs/hardware-link.md#wiring): servos on D9, D10, D11, powered from their own 5 V supply with its ground joined to the Arduino's.

| Sketch | What it is for |
| --- | --- |
| `servo-check/` | Nothing to type or set: sweeps the servo on D9, then D10, then D11, so a servo that stays still is a wiring or power fault |
| `servo-test/` | Move each servo by hand from the Serial Monitor: check it turns, find its range, calibrate it, draw a square |
| `playback/` | Draw one drawing by itself, baked into the board by `./firmware/arm draw` |
| `clockedin/` | The firmware the Clockedin app streams to over USB |

## Commands

```
./firmware/arm ports                     the boards plugged in
./firmware/arm test                      upload the motor test, open the Serial Monitor
./firmware/arm draw calibrate --speed 0.5
                                         plan a drawing, upload it, open the monitor; type go
./firmware/arm app                       upload the app's firmware
./firmware/arm monitor                   open the Serial Monitor again (Ctrl-C leaves it)
./firmware/arm config                    rewrite arm_config.h after changing app/arm.config.json
./firmware/arm check                     compile all three, upload nothing
```

`draw` takes `square`, `circle`, `calibrate` (a square, its circle and a cross), `house`, `cat`, `star`, `flower`, `clock` (the time now), `"text:Hello|second line"`, a `.svg` file, or any words, which GPT draws (the key in `app/.env`). `--speed 0.5` plays at half speed, `--wipe` wipes the drawing area first. The drawing is planned by the app's own code (order, joint angles, timing, servo compensation) and comes out within 0.16° of what the app would send. A clock is about 160 keyframes, 1.2 KB of the board's 32 KB.

Set `BOARD=arduino:avr:nano:cpu=atmega328old` for an older or clone Nano, and `PORT=/dev/ttyACM0` (the Pi) or `PORT=/dev/cu.usbmodem1101` to choose the port.

## First run, in this order

If nothing moves at all: `./firmware/arm servos` (or upload `servo-check` from the IDE). Check that each servo has 5 V and GND, that a separate supply's GND is joined to the Arduino's, and that signals are on D9, D10, D11. In the motor test the Serial Monitor must send "Newline" (each command comes back as `> b 90`), and the playback sketches wait for `go`.


1. **Servos off the arm.** `./firmware/arm test`, then `b 90`, `e 90`, `t 90`: each horn turns and stops. `sweep all` swings base and elbow through their range twice.
2. **Ends of travel.** `us b 544`, then `us b 2400`: if the horn buzzes or strains at an end, step the number in until it stops, and put the two values in `arduino.usMin` / `usMax` in `app/arm.config.json`. Run `./firmware/arm config`.
3. **Links on, pen off.** The elbow bends to the left of the line from base to pen. Fit the horns so that, with every servo at 90 (`mid`), the upper arm points left, 13° above level, and the forearm is turned 103° clockwise from the upper arm (Arm setup's Best zeros chose these to keep the most of the board in reach). Then `park`, and `ga 90 -90`: the upper arm should point straight up the board and the forearm to the right at a right angle to it. If not, change that servo's zero (and direction if it turns the wrong way) in Arm setup or the config, `./firmware/arm config`, and upload again.
4. **Pen on.** `xy 0 215` puts the nib over the middle of the drawing area. `pen draw` touches it down, `pen lift` lifts it. Adjust the pen's measurements in Arm setup if the nib misses the board or presses too hard.
5. **A first line.** `square 100` draws a 100 mm square, slowly, pen down. Then `./firmware/arm draw calibrate --speed 0.5` and `go`: the square's sides should be straight, the circle round and touching them, the cross through the middle.

In the motor test every move glides (60 deg/s to start, `speed` changes it), speeding up and slowing down at `accel` (deg/s², the app's Servo acceleration to start), and stays inside the limits in `arm_config.h`, except `us`, which is raw. `stop` slows to a halt and holds.

**Finding the acceleration.** A servo told to stop dead overshoots, so every move the app plans speeds up and slows down (Arm setup: Acceleration, Corner speed, Servo acceleration). To find what this arm takes: `speed 300`, then `sweep b 60 120` at `accel 500`, `1000`, `2000`, `4000`, watching the ends of each swing. Take the highest with no overshoot, less a third, as Servo acceleration; do the same with `sweep e 60 120`, and keep the lower. If drawn lines end in a hook or corners bulge, lower Acceleration or Corner speed.

## Playback commands

`go` draws it, `stop` eases to a halt and holds, `park` glides home, `loop` repeats it until you type `loop` again, `speed 50` plays at half speed (25 to 200), `info` says what is loaded. Set `AUTOSTART 1` at the top of `playback.ino` to draw 3 s after power-up with no computer attached.
