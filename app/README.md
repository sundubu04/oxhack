# Clockwork — arm control

A Linear-style control app for the OxHack drawing arm. You ask for a drawing in words (or by voice); it
turns the ask into a line drawing, plans the most effective pen path, solves the joint angles, and sends
them to the arm.

## The pipeline

```
natural language ask
   → a line drawing (Gemini: an SVG, or an image we trace)      "create the image first"
   → deterministic path plan (fit to board, order strokes for the shortest pen travel, resample)
   → inverse kinematics → base°, elbow°, tilt, pressure per waypoint
   → the arm (Web Serial to the Pi) — or Copy / Download the angle stream
```

Every step after the image is **deterministic** (no model in the loop), so the same picture always gives the
same path and the same angles. Gemini only makes the picture; ElevenLabs gives the arm a voice; the browser's
own speech recognition lets you talk to it (no key needed for voice input).

## Run it

No build step.

```
cd app
node server.mjs          # → http://localhost:5178
```

Open the URL in Chrome. Try a **sample** (Clock, House, Cat, Star, Flower) with no key at all. For your own
prompts, add API keys in **Settings**:

- **Gemini** — free key from [mlh.link/gemini-aistudio](https://mlh.link/gemini-aistudio) → Google AI Studio → *Get API key*. Default model `gemini-2.5-flash` (set yours if different). "Nano Banana" image model is `gemini-2.5-flash-image` for the image→trace route.
- **ElevenLabs** (optional, for the spoken feedback) — your promo code arrives in the MLH event email → sign up → API key from the dashboard.

Keys live only in this browser's `localStorage`; nothing is committed or sent anywhere but the APIs.

## Using it

- Type a prompt and press **Draw** (or ⏎), or click the **mic** and say it.
- Watch the five pipeline steps tick, then flip between **Image / Path / Arm** and press **Preview draw**.
- **Send to arm** streams the angles over Web Serial (connect first in Settings); **Download** / **Copy angles** always work.
- Settings also holds the arm geometry (L1, L2, standoff, draw size) — defaults match the build: 180 mm links, base 40 mm below a 350 mm board, a 200 mm centred clock.

## The arm serial protocol

The Pi/microcontroller reads one line per waypoint at 115200 baud:

```
base,elbow,tilt,pressure      e.g.  57.03,85.02,-14,60
SKIP                          a waypoint out of reach (hold / skip)
HOME                          end of path — return to the park pose
```

`tilt` is the marker-tilt servo in degrees (draw ≈ −14, lift ≈ −2, erase ≈ +16); `pressure` is 0–100.

## Files

| Path | What |
|---|---|
| `index.html`, `style.css` | the Linear-style UI shell |
| `src/app.js` | wiring: settings, pipeline run, canvas preview, voice, arm |
| `src/ik.js` | 2-link inverse kinematics + toolpath → angle stream (verified to 1e-13 mm) |
| `src/svg.js` | SVG / JSON → polylines (path, polyline, line, rect, circle, ellipse) |
| `src/vectorize.js` | raster image → polylines (threshold + Moore boundary tracing + simplify) |
| `src/pathplan.js` | fit to board, order strokes for least pen travel, resample, flatten |
| `src/gemini.js` | prompt → SVG line drawing, or → raster image |
| `src/voice.js` | ElevenLabs TTS out, browser speech-to-text in |
| `src/arm.js` | Web Serial send + download |
| `src/sample.js` | built-in drawings so it runs with no key |
| `server.mjs` | static dev server |

## Status / next

- Working now: the whole pipeline on samples and on Gemini SVGs, the preview, the angle export, the Linear UI, voice in (browser) and out (ElevenLabs).
- Needs the hardware to verify: the Web Serial send (the firmware side on the Pi that reads the lines).
- Nice next: a queue of drawings, the erase pass between redraws, and a camera closed-loop for crisper lines.
