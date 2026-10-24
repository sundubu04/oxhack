# Clockedin

Control app for the OxHack drawing arm. Each **simulation** is a whiteboard you change by chatting: ask for a
drawing, change it ("make the cat grumpy"), clear it, or play noughts and crosses. Every change is planned as the
difference from what's already on the board, so the arm wipes and redraws only what changed. The sim plays it to
scale through the servos' real limits, and the arm gets exactly the same commands.

```
words or voice
  → a line drawing (GPT, or Gemini, through the dev server)          the picture first
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

- **OpenAI (GPT credits)**: `OPENAI_API_KEY`. When it is set GPT answers first and Gemini is the backup. `OPENAI_MODELS` lists the models to try, best first: `gpt-6.1-sol:low` (the best drawings: the Oxford crest with its motto, 10 to 20 s), `gpt-5.6-sol:low` (nearly as good, 5 to 10 s), `gpt-6-luna:low` (rougher, 4 to 8 s). A model that takes over 30 s is skipped for ten minutes. GPT returns each drawing as a list of path strokes, which the server wraps into the SVG the app keeps. With no ElevenLabs key the arm speaks with GPT's voice (`gpt-4o-mini-tts`, about 1 s). The models were compared with `node tools/model-bench.mjs` on 24 Oct 2026 (it spends credits).
- **Gemini**: Google AI Studio, *Get API key* ([mlh.link/gemini-aistudio](https://mlh.link/gemini-aistudio)). `GEMINI_MODELS` lists the models to try, best first: `gemini-3.1-pro-preview`, `gemini-3.5-flash`, `gemini-3.8-flash`, `gemini-3.1-flash-lite`. On the free tier each flash model allows **20 requests a day** and the pro model none; the server skips a model that's out of quota until its reset, and one that's busy for two minutes. Turning on billing for the Gemini project (the MLH credits) makes the pro model answer, and the drawings much better: the flash models draw a recognisable Oxford crest, the lite one doesn't.
- **ElevenLabs**: redeem the MLH promo code from the event email, sign up, then *Developers → API keys*. Put it in `ELEVENLABS_API_KEY` and restart: the arm then speaks with ElevenLabs (Flash model), and Arm setup lets you pick a voice by id and hear it. Until then it speaks with GPT's voice (or Gemini's). Spoken lines are cached, so repeats cost no credits.

## Using it

- **Simulations** (left): *New simulation* starts a clean board and conversation; each is saved in `app/data/sims/` (gitignored) with its board, chat and ink.
- **Chat** (right): ask in words or with the mic. Clearing the board, the time, the samples and noughts and crosses moves run in the app without a model; everything else asks GPT (or Gemini), which answers with a reply and actions (draw in a box, edit a drawing, erase one, clear, start a game, play a move). In a game, tap a square on the board or say where.
- **Repeats** (above the chat box): a request run again on a schedule while the simulation is open, saved with it. "Keep the clock on time" (or *Keep it on time* under a drawn clock) redraws the clock every minute, on the minute, and only the hands that moved are wiped and redrawn; the app does this itself, so it costs no credits and adds nothing to the chat. "Every 5 minutes add a star", or "do that every hour", asks the model each time and shows its reply. The model can also start one when asked to keep something up to date. "Stop repeating", or the × on a row, ends them. A repeat waits while the arm is drawing or the model is answering.
- **Plan** tab: time to finish, reach, what was drawn and wiped, the steps, the joints, the arm connection, and the switches (servo limits, reach, the real arm follows each change).

- **Studio**: type or say what to draw (⏎ or Draw). The board shows the plan faintly and the simulated ink as the arm lays it. Play, start again, erase, scrub and speed sit under the board.
- **Board, 3D, Picture, Angles**: the sim, the same sim in 3D (drag to orbit, scroll to zoom; *Along the arm* shows the pen's tilt side-on, with the board as the floor), the picture the model made, and every waypoint with its time and angles.
- **Inspector**: time to draw, ink, pen-up travel, the worst wobble measured in the sim, the four pipeline steps, live joint meters against each servo's range, and the arm connection.
- **Simulation switches**: servo limits on or off (ideal servos), and the reach (grey where the arm can't get to).
- **⌘K**: every command, and "Draw …" for anything you type.
- Drag on the board to move the pen by hand when nothing is playing.
- **Smoothing** (Arm setup): the servos' dead band and gear play, compensated in every command, plus a 3 mm lead-in to each stroke. Why, and what to do with the motors: [`docs/hardware-link.md`](../docs/hardware-link.md#smoothing-the-line).

## How a change is planned (`src/optimize.js`)

1. **Diff**: strokes already on the board within 1.5 mm of a wanted stroke are kept.
2. **Wipe**: four ways are timed with the sim's own schedule (follow each stroke, rows over only the cells with ink, one zigzag over its box, the whole drawing area) and the fastest is used. Kept ink the eraser brushes is redrawn, only where it was touched.
3. **Draw**: what's new, plus anything brushed, in the order with the least pen-up travel: exact (Held–Karp) up to 12 strokes, nearest-first then 2-opt and Or-opt above that, each stroke either way round, with a lead-in.

`node tools/optimize-test.mjs` checks it: stroke order against the true optimum, every way of erasing on real changes, and the board afterwards through the SG92R sim (no ink left that should be gone, none missing). `node tools/verify-motors.mjs` replays the keyframes the Arduino gets through a copy of its interpolation and compares every 20 ms frame with the sim.

## The arm's dimensions

The pen is entered as the marker itself: its length (165 mm, the team's), barrel width and how far the nib sticks out. From those, `src/pen.js` picks the best angle for it to meet the board (the lowest that keeps the barrel 5 mm clear), the tilt shaft's height above the board, the draw, lift and erase tilts, and how far the nib and eraser touch either side of the forearm's tip. Arm setup shows all of them; the reasoning is in [`docs/pages/pen-mount.html`](../docs/pages/pen-mount.html).

**Servo mounting:** the base needs −16° to 80° and the elbow 45° to 157° (with the pen across the forearm), so the default zero offsets centre those ranges on each servo's travel: mount the base so that at its middle (1500 µs) link 1 points 32° above the board's bottom edge, and the elbow so that at its middle the forearm is 100° round from link 1. Without that the base runs into its end stop in the bottom-right of the drawing.

`app/arm.config.json` is the one place for them: link lengths, board size and how far the base sits below it,
drawing size, pen tilts and eraser width, speeds, and each servo's range, zero offset and direction. Edit it
in **Arm setup** (it saves the file and shows reach, coverage, dexterity and the clock's draw time as you type)
or by hand. The numbers in it now are the design ones (`"measured": false`); saving from the app marks them measured.

## The arm over USB

An Arduino Uno or Nano runs `firmware/clockedin` and drives the servos; the app streams timed keyframes and the
board moves between them on its own 20 ms servo frame. **Connect arm** finds it, dragging the pen on the board moves
the real arm, **Send to arm** draws the plan while the sim plays alongside, and the same button stops it. Wiring,
the protocol, bring-up and where a Raspberry Pi fits: [`docs/hardware-link.md`](../docs/hardware-link.md).

## Files

| Path | What |
|---|---|
| `index.html`, `style.css` | the screens; components come from the team kit (`ui/kit.css`, `ui/icons.json`, copied from `.claude/skills/oxh-ui-kit`) |
| `src/app.js` | simulations, chat, changes, sim loop, palette and setup page |
| `src/scene.js` | what should be on the board: drawings in boxes, and a game |
| `src/optimize.js` | diff, the four ways to wipe, kept ink to redraw, the fastest plan |
| `src/games/tictactoe.js` | grid and marks as strokes, a computer player that never loses |
| `src/sim.js` | the arm simulation: schedule, servo speed and resolution, servo end stops, wobble measurement |
| `src/board.js` | draws the board, plan, ink and arm to scale |
| `src/view3d.js` | the 3D view, on three.js 0.170 (MIT, `ui/vendor/`, licence beside it) |
| `src/pen.js` | the marker on the tilt servo: best angle, shaft height, tilts, offsets |
| `src/config.js`, `arm.config.json` | the arm's dimensions and servo calibration |
| `src/ik.js` | two-link inverse kinematics and the angle stream |
| `src/pathplan.js` | fit, order, resample; the eraser's zigzag |
| `src/svg.js`, `src/vectorize.js` | SVG to polylines; raster to polylines |
| `src/voice.js`, `src/arm.js` | speech in and out; Web Serial, keyframes and flow control (protocol 2) |
| `../firmware/clockedin` | the Arduino sketch (Uno or Nano) |
| `server.mjs`, `lib/openai.mjs`, `lib/gemini.mjs` | dev server holding the keys; GPT chat and voice, Gemini as the backup |
| `test.mjs` | `node test.mjs`: IK, parsing, planning and the sim |
| `tools/model-bench.mjs` | the GPT models timed on a few drawings (spends credits) |
| `tools/compare-servos.mjs` | the clock under each servo model, side by side |
| `tools/optimize-test.mjs`, `tools/verify-motors.mjs` | planner optimality and correctness; sim against the firmware |
