---
name: oxh-demo
description: Script, record and cut the OxHack demo video, visual first and silent-safe, with a drawn cursor, click rings, eased zooms on what was clicked or typed, ▶▶ badges on speed-ups, title cards and captions. Records a scripted Playwright take of the real app (so takes are repeatable) and cuts it with ffmpeg from a running order in demo/edit.json. Use when planning the demo, writing the demo script or run sheet, recording takes, editing the video, making a short social cut, or preparing the fallback for a live demo.
---

# Demo

The video is the strongest evidence a judge sees, and the fallback if the live demo fails. Rebuilt from the flow-er toolchain (Reinvent the Wheel, Oct 2026), whose drafts taught the rules below.

## Rules from the last demo

- **Visuals over text.** Figures, plots and the product moving; not chat transcripts. The room is mixed and the video may be silent, so every beat reads at a glance.
- **Show where the clicks land.** The cursor and the ring are drawn in every take; zoom in on a click or a typed prompt when the change would be missed otherwise. Zooms are opt-in per action (`zoom: 1.5`), never on by default.
- **Crucial moments at 1x, with a hold.** The typed question and the before and after play at real speed and hold 1 to 2 s. Thinking and building play faster, marked with ▶▶ only, never "3×".
- **One project end to end,** from the home screen, on real data. A non-linear cut is fine (open on the result as a hook), but don't jump between projects.
- **Make "before" honest.** Show the real error of the old way or the untrained model, not a staged failure.
- **Every visual comes from the app.** The edit adds only cards, captions, zooms, badges and click rings. Mockup data is labelled as mockup.
- **Skip the clicks that don't matter.** Logins, waiting, scrolling: cut them. Longer than 90 s is fine if each beat earns it; check the event's limit in `hack/event.md`.
- **Freeze the app before recording** (`touch .freeze`), and reset its state before each take, so takes match.

## Steps

1. **Script.** Copy the demo beats from `docs/spec-plan.md` into `demo/script.md`: per beat, what is on screen, the action, the speed, and the caption. Spawn `oxh-judge` with the script alone and fix any beat it can't follow.
2. **Set up once:** `cd demo && npm i` (Playwright, pinned in `demo/package.json`; it drives the Chrome already on the machine). `ffmpeg` and Python with Pillow must be on the path.
3. **Write the take** as `demo/take1.mjs` from `templates/take.mjs`. It imports `record` from this skill's `scripts/rec.mjs` and drives the real app: `mark(name)` names a point to cut at, `tap(selector, { zoom })`, `type(selector, text, { zoom })`, `emph(selector, { zoom, dur })` frames an element without clicking, `rest()` moves the cursor away, `wait(ms)`. Prefer stable selectors (`data-demo="run"` attributes added during the build) over text.
4. **Record:** `node take1.mjs`. Frames, marks and clicks land in `recordings/take1/` (gitignored). Record the whole flow in one take where you can; record risky beats as their own takes.
5. **Cut.** Write `demo/edit.json` from `templates/edit.json`: the takes, then the running order of cards and clips between marks, each with `speed`, an optional `caption` and `hold`. Then:

   ```
   python3 .claude/skills/oxh-demo/scripts/cut.py demo/edit.json --out demo/out/demo.mp4 --small 9.5
   ```

   It prints the timeline and writes `demo.mp4.json` beside the video. `--small` writes a copy under that many MB for upload limits. Clips resample by timestamp onto a steady frame rate, so a long take does not drift.
6. **Check it** by pulling a frame every few seconds (`ffmpeg -ss <t> -i demo/out/demo.mp4 -frames:v 1 f.png`) and looking at them as a contact sheet: cards readable, zooms on target, nothing private on screen. Then watch it once at full speed.
7. **Share.** Upload with the person's go-ahead (Loom, YouTube unlisted, Drive). Loom's upload input is hidden: open "New video", "Upload a video", then put the file on `input[name="files[]"]`. Record the link in `hack/artifacts.md`.

## Live demo

If the pitch has a live demo: seed the data, run it locally (no Wi-Fi dependency), keep tabs open to jump ahead, and have the video cued as the fallback. Write a run sheet with `oxh-artifact` (`run-sheet` type): who clicks, what they say, and what happens if a beat fails.

## Short cut for social

After the event, a 30 to 45 s cut of the one moment that shows the idea, captions on the footage, no full-screen cards except the first. See `oxh-wrapup` for the post.
