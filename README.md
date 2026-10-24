# OxHack

Our workspace for OxHack. The app gets written at the event; what is here already is the Claude Code setup the team works with, so the hours go on the idea, not on tooling.

## Start

```
git clone git@github.com:sundubu04/oxhack.git && cd oxhack
claude
```

Trust the folder when Claude Code asks. The first session turns on the repo's pre-commit guard, and the status line shows the countdown once `hack/event.md` has the times. Then, at the opening: "run oxh-kickoff with the brief" and paste or link it.

Needs: Claude Code, git, Python 3.9+ with Pillow, Node 20+, ffmpeg (for the demo video), and Chrome.

## The flow

| Phase | Ask Claude to | What it does |
| --- | --- | --- |
| Kickoff | `oxh-kickoff` | Reads the brief into `hack/event.md`: times, criteria and weights, rules, submission, team; sets the hour plan |
| Ideate | `oxh-ideate` | 15 to 25 ideas, prior-art check, scores against the event's criteria, a blind panel score, an idea board page |
| Spec | `oxh-spec` | `docs/spec-plan.md` from the demo backwards: beats, outcomes, the spike, build order with owners, contracts, cut list |
| Build | `oxh-frontend-engineer`, `oxh-ui-kit` | The demo path end to end, on one light UI kit with a checker |
| Polish | `oxh-ui-polish` | Compare with apps that do the same job; a blind critic picks the top three fixes, up to three rounds |
| Freeze | `touch .freeze` and commit it | A hook refuses edits to app code until someone runs `rm .freeze` |
| Demo | `oxh-demo` | Scripted Playwright takes with a drawn cursor, cut with zooms, ▶▶ badges, cards and captions |
| Pitch | `oxh-pitch`, `oxh-slides` | An eight-slide deck on the claude.ai Slides type, notes, two timed rehearsals, a Q&A sheet |
| Wrap-up | `oxh-wrapup` | Submission checklist, README for judges, licence check, public check, the post |

Team pages (idea board, plan, architecture, status, results, run sheet) are published with `oxh-artifact` from sources in `docs/pages/`, listed in `hack/artifacts.md`.

## What is in `.claude/`

| Kind | Name | Source |
| --- | --- | --- |
| Skill | `oxh-kickoff`, `oxh-ideate`, `oxh-spec`, `oxh-artifact`, `oxh-demo`, `oxh-pitch`, `oxh-wrapup` | New, from what worked at Reinvent the Wheel (flow-er, Oct 2026) |
| Skill | `oxh-ui-kit`, `oxh-ui-polish`, `oxh-slides` | Adapted from darling-agentic |
| Agent | `oxh-planner`, `oxh-judge` | New |
| Agent | `oxh-ui-critic`, `oxh-frontend-engineer` | Adapted from darling-agentic |
| Hook | `clock.py` | Session note and status line: time to the freeze, the submission and the pitch, and the phase |
| Hook | `freeze.py` | Refuses edits to app code while `.freeze` exists |
| Git hook | `.githooks/pre-commit` | Stops commits of secrets, `.env` files, data, models, recordings and files over 20 MB |

## Rules

`CLAUDE.md` holds them: build the demo path first, freeze before the demo, never invent a number, keep data and keys out of git, write the app fresh, and ask before anything public.
