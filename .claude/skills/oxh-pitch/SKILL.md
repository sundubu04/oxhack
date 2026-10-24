---
name: oxh-pitch
description: Build and rehearse the OxHack pitch, a short deck on the claude.ai Slides type from one of the oxh-slides templates, with speaker notes that say who speaks and where to click, a demo slot, one honest number and a close on the thesis; then time two rehearsals and prepare the judges' questions. Use when asked for the pitch, the deck, the slides, the talk, the presentation script, Q&A prep, or to restyle, cut or fact-check them.
---

# Pitch

The deck exists to make the demo land. Judges remember one person's problem, one moment in the demo and one number; everything else is in service of those three.

Read `hack/event.md` (pitch length, live or video demo, slide limits, judging criteria) and `docs/spec-plan.md` (pitch line, user, demo beats, outcomes) first. `references/pitch-craft.md` holds the sourced rules behind this skill.

## The storyline

At Reinvent the Wheel the panel wanted the problem, the old way, then mostly the tool, in at most eight slides. Start from this and cut:

| # | Slide | Its title says |
| --- | --- | --- |
| 1 | Name and what it does | The pitch line, in words a stranger can repeat |
| 2 | The person and the problem | One real user, their pain in their words, with a quote |
| 3 | The old way | What they do today and what it costs, with one sourced number |
| 4 | What we built | Product screens, not a diagram, captioned so nobody has to study them |
| 5 | Demo | The live demo or the video; the beat list in the notes |
| 6 | Evidence | The number that moved during the event, how it was measured, what is not yet tested |
| 7 | How it works (optional) | One architecture slide, only if a criterion rewards technical depth |
| 8 | Close | The thesis restated, what's next in one line, the team |

Titles are full-sentence claims; read alone in order, they tell the story. Close on the thesis, never on "Thanks" or "Questions?".

## Steps

1. **Brief** in `pitch/brief.md`: the audience (the panel and its criteria), the length, live or video, who presents, the one thing a judge should remember.
2. **Write the titles first,** then the notes for each slide: who speaks, the words (spoken, short), where to click.
3. **Pick a template** with `oxh-slides`: Console for a product demo or an engineering-heavy idea, Grid when the evidence is numbers, Petal for a friendly community pitch, Midnight when the panel are investors. Then build the deck folder in `pitch/` with its `new.py`, replace every sample, and run its `check.py` and `preview.py`.
4. **Screens and figures come from the app,** shot with Playwright at the size the slide needs, or from the demo frames. Mockups are labelled. Every number has its source line.
5. **Publish** on the Slides type as `oxh-slides` describes, and record the link in `hack/artifacts.md`. If the team wants to edit in Google Slides, export PowerPoint from the deck and convert it in Drive (Eun's notes on what survives the import are in her global memory, `google-slides-from-pptx`).
6. **Ask the panel.** Spawn `oxh-judge` with the deck's titles and notes, the demo script and `hack/event.md`. Fix the slide it marks weakest, and keep its five likely questions.
7. **Rehearse twice, timed,** with the real demo or the video, at least two hours before the pitch. Cut words, not slides, when over time. The demo fallback (the video, cued) is tested in the second rehearsal.
8. **Q&A sheet** in `pitch/qa.md`: the judge's likely questions with a two-sentence answer each, every number to hand, and what we honestly haven't done yet.

## Rules

- One presenter per section, rehearsed; speak slowly.
- Nothing under 24 px on a slide; under 20 words a slide where possible.
- Never inflate. "Under 2 points off the expert on 6 unseen donors" beats "near-expert accuracy".
- Name the biggest objection yourself before a judge does.
