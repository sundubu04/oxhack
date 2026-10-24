---
name: oxh-ui-polish
description: Make a hackathon screen that works look finished, by comparing it with two or three apps that do the same job and fixing what a separate critic finds, in at most three rounds. Use when a screen works but looks unpolished, before recording the demo, or when asked to "polish", "make it look like Linear", "make it less wordy" or "more like a dashboard". Not for a first build with no screen yet, and not for the deck (use oxh-pitch).
---

# UI polish

Adapted from darling-agentic's drl-ui-polish. One-shot UI is usually functional and unpolished in the same few ways: everything at one weight, sentences where labels belong, rows taller than the job needs, a different look for the same state. Apps that already do the job have settled those choices. This loop borrows their conventions, never their brand, and has a critic who did not build the screen judge the result from screenshots.

`rubric.md` (twelve lines, 0 to 2) is the bar. The critic is the `oxh-ui-critic` agent.

**At a hackathon, polish only the screens the demo shows**, and only after the demo path works end to end. One round on the hero screen is usually worth more than three rounds on a settings page. Stop at the demo freeze (`.freeze` at the repo root).

## House rules come first

References show conventions; our rules decide the look. Where they disagree, the rules win and the brief says so. The rules are `oxh-ui-kit`'s `references/rules.md` plus the taste in `CLAUDE.md`: light by default, no extra lines, no capitals or kicker labels, no cards, never fill white space. Reuse a kit piece before writing styles, and run the kit's `check.mjs` before any critique; never critique a build that fails it.

## Steps

1. **Name the job** in one sentence: who opens this, to decide or do what, in how many seconds. "A judge watching the demo sees in three seconds which files the model got wrong." Every later step is judged against it.
2. **Pick two or three reference apps** that do that job well. Defaults:

   | Job | References |
   |---|---|
   | Dev or review dashboard | Linear (Inbox, My issues), GitHub (Pull requests), Jira board |
   | Calendar | Google Calendar week view, Notion Calendar |
   | Inbox or triage list | Gmail, Superhuman, Linear Inbox |
   | Chat with an agent | Claude.ai, ChatGPT, Perplexity |
   | Data or analysis tool | Observable, Hex, Datadog dashboards |
   | Metrics overview | Vercel analytics, Stripe home, PostHog |

3. **Collect references**, three to six screens, saved as files with their source in `docs/refs/<job>/refs.md`:
   - **Mobbin first:** `search_screens` with `platform: "web"` and the app named ("Linear inbox screen"). Download each `image_url` (the inline image is a preview); cite `mobbin_url`. Crop the "curated by Mobbin" band before a blind comparison. Prefer a populated screen with nothing open over it.
   - **Otherwise:** the product's own docs or help-centre screenshots, or a screenshot of the app in Chrome with the person's go-ahead. Never commit a screenshot that shows private data.
4. **Write the reference brief** in `docs/refs/<job>/brief.md`, twenty lines at most: the layout skeleton; density (items per 1440 × 900 screen, row height); the row or card anatomy; the state words and marks; how empty and loading look; what the references leave out. End with **"Ours"**: what we take, and what the house rules change.
5. **Build**, or take the existing screen as round 0. Kit first; layout from the brief.
6. **Hard checks, then screenshots.** Fix every problem `check.mjs` reports and every overflow (`page.evaluate`: mark any element whose content spills past its box) before taking a screenshot. Shoot with Playwright against the dev server at 1440 × 900, scale 2, with fixed data and a fixed time, every state the brief names: populated, empty, loading, error, one long-text case. For line 11, three frames: at rest, hovered or selected, just after a click.
7. **Critique, twice, in parallel.** Give neither critic anything but what is named here: no code, no brief, no conversation.
   - **Score blind.** Spawn `oxh-ui-critic` in `blind` mode with the job sentence, the rubric's path, and the candidate's first screen shuffled among the reference screens under neutral labels (keep the key yourself). Its scores decide the pass, with the references' craft as the bar.
   - **Name fixes.** Spawn it in `loop` mode with the labelled candidate states, the strip, the references and the house rules in one line. It returns the top three fixes; its own scores are advisory. A critic who knows which screens are the references grades toward them, so never take the pass from loop mode.
8. **Fix the top three fixes only**, inside the house rules, then go back to step 6. Ignore fixes that would break a rule, and say which. Shoot the next round on the same data as the last.
9. **Stop** when the blind score passes and the loop critic names no part of the job the screen leaves out (no line at 0, the job lines at 2, and craft at least the best reference's: see `rubric.md`), after round 3, or when a round does not raise the total. Report what is left.

## Report

One table: the rubric lines down the side, a column per round, the total and pass at the foot. Then the first and last screenshots side by side with one reference, the fixes made, the fixes skipped and why. Publish it with `oxh-artifact` if the team wants to see it.
