# Clockwork

Control app for the OxHack drawing arm. Ask for a drawing in words or by voice; Clockwork draws the picture,
plans the shortest pen path, solves the joint angles and plays them through a to-scale simulation of the arm
with the servos' real limits. Then it sends the same angles to the arm, at the same pace.

```
words or voice
  → a line drawing (Gemini, through the dev server)          the picture first
  → the shortest pen path (fit to the board, order strokes, resample every 2 mm)
  → base, elbow and tilt angles for every waypoint (inverse kinematics)
  → live sim: SG92R top speed and 1° steps, so the line wobbles like the real one
  → the arm over USB (Web Serial), or the angles as a file
```

Everything after the picture is deterministic: the same picture always gives the same path and angles.

## Run it

```
cd app
cp .env.example .env      # then add the keys (see below)
npm install               # only for the checks; the app itself has no dependencies
node server.mjs           # → http://localhost:5178
```

Open it in Chrome. The samples (the time now, house, cat, star, flower) work with no key.

## Keys

They live in `app/.env`, which git ignores. The dev server reads them and calls the APIs itself; the browser never sees a key.

- **Gemini**: Google AI Studio, *Get API key* ([mlh.link/gemini-aistudio](https://mlh.link/gemini-aistudio)). The free tier covers the vector drawings and the Gemini voice. `gemini-2.5-flash` is closed to new keys, so the default is `gemini-3.5-flash`, then `gemini-3.1-flash-lite`, then `gemini-3.8-flash`, each given 20 s before the next is tried. The image route (Nano Banana) needs billing on the key's project.
- **ElevenLabs**: redeem the MLH promo code from the event email, sign up, then *Developers → API keys*. Put it in `ELEVENLABS_API_KEY` and restart: the arm then speaks with ElevenLabs (Flash model), and Arm setup lets you pick a voice by id and hear it. Until then it speaks with Gemini's voice. Spoken lines are cached, so repeats cost no credits.

## Using it

- **Studio**: type or say what to draw (⏎ or Draw). The board shows the plan faintly and the simulated ink as the arm lays it. Play, start again, erase, scrub and speed sit under the board.
- **Board, Picture, Angles**: the sim, the picture Gemini made, and every waypoint with its time and angles.
- **Inspector**: time to draw, ink, pen-up travel, the worst wobble measured in the sim, the four pipeline steps, live joint meters against each servo's range, and the arm connection.
- **Simulation switches**: servo limits on or off (ideal servos), the reach (grey where the arm can't get to), and keep time (erase and redraw the clock every minute).
- **⌘K**: every command, and "Draw …" for anything you type.
- Drag on the board to move the pen by hand when nothing is playing.
- **Smoothing** (Arm setup): the servos' dead band and gear play, compensated in every command, plus a 3 mm lead-in to each stroke. Why, and what to do with the motors: [`docs/hardware-link.md`](../docs/hardware-link.md#smoothing-the-line).

## The arm's dimensions

`app/arm.config.json` is the one place for them: link lengths, board size and how far the base sits below it,
drawing size, pen tilts and eraser width, speeds, and each servo's range, zero offset and direction. Edit it
in **Arm setup** (it saves the file and shows reach, coverage, dexterity and the clock's draw time as you type)
or by hand. The numbers in it now are the design ones (`"measured": false`); saving from the app marks them measured.

## The arm over USB

An Arduino Uno or Nano runs `firmware/clockwork` and drives the servos; the app streams timed keyframes and the
board moves between them on its own 20 ms servo frame. **Connect arm** finds it, dragging the pen on the board moves
the real arm, **Send to arm** draws the plan while the sim plays alongside, and the same button stops it. Wiring,
the protocol, bring-up and where a Raspberry Pi fits: [`docs/hardware-link.md`](../docs/hardware-link.md).

## Files

| Path | What |
|---|---|
| `index.html`, `style.css` | the screens; components come from the team kit (`ui/kit.css`, `ui/icons.json`, copied from `.claude/skills/oxh-ui-kit`) |
| `src/app.js` | the pipeline, sim loop, palette, history and setup page |
| `src/sim.js` | the arm simulation: schedule, servo speed and resolution, servo end stops, wobble measurement |
| `src/board.js` | draws the board, plan, ink and arm to scale |
| `src/config.js`, `arm.config.json` | the arm's dimensions and servo calibration |
| `src/ik.js` | two-link inverse kinematics and the angle stream |
| `src/pathplan.js` | fit, order, resample; the eraser's zigzag |
| `src/svg.js`, `src/vectorize.js` | SVG to polylines; raster to polylines |
| `src/voice.js`, `src/arm.js` | speech in and out; Web Serial, keyframes and flow control (protocol 2) |
| `../firmware/clockwork` | the Arduino sketch (Uno or Nano) |
| `server.mjs`, `lib/gemini.mjs` | dev server holding the keys; Gemini drawing, image and voice calls |
| `test.mjs` | `node test.mjs`: IK, parsing, planning and the sim |
| `tools/compare-servos.mjs` | the clock under each servo model, side by side |
