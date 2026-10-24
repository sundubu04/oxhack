# OxHack: notes for Claude

The team's workspace for OxHack. Set up 24 Oct 2026, before the theme was known, so the app does not exist yet: `app/` appears once an idea is chosen.

## Where things are

- `hack/event.md`: the event's facts (times, theme, judging criteria, rules, submission) and the team. Read it before any decision; `oxh-kickoff` fills it in.
- `hack/ideas.md`: every idea and its scores. `hack/decisions.md`: what we decided and why, one row each. `hack/artifacts.md`: every published page, with its source file.
- `docs/spec-plan.md`: the plan for the chosen idea (`oxh-spec` writes it). `docs/pages/`: the HTML source of each published page.
- `demo/`: take scripts, edits and the cut video (recordings themselves stay out of git). `pitch/`: the deck folder.
- `app/`: the product, once there is one.

## The flow

| Phase | Skill | Ends with |
| --- | --- | --- |
| Kickoff | `oxh-kickoff` | `hack/event.md` filled in, the hour plan set |
| Ideate | `oxh-ideate` | one idea chosen, in `hack/decisions.md` |
| Spec | `oxh-spec` | `docs/spec-plan.md` with demo beats and owners |
| Build | `oxh-frontend-engineer`, `oxh-ui-kit` | the demo path works end to end |
| Polish | `oxh-ui-polish` | the demo screens pass the critic |
| Freeze | `touch .freeze`, then commit it so every session freezes | app code frozen; only demo, pitch, docs change |
| Demo | `oxh-demo` | a cut video under the time limit, and a fallback |
| Pitch | `oxh-pitch` | the deck on the Slides type, rehearsed twice |
| Wrap-up | `oxh-wrapup` | submitted, repo checked before it goes public, post drafted |

Pages for the team (idea board, plan, architecture, status, results) go through `oxh-artifact`. Two agents help everywhere: `oxh-planner` splits work into owned slices with contracts, and `oxh-judge` scores ideas, plans, decks and demos as the panel would.

## Rules that stay

- **The demo is the product.** Build what the demo shows, in the order it shows it. Anything off the demo path waits until the path works.
- **Freeze before the demo.** At Reinvent the Wheel an edit during a rehearsal broke a turn. When `.freeze` exists, a hook refuses edits to app code; lift it with `rm .freeze`, deliberately.
- **Never invent a number.** Every number on a slide, page or screen comes from a run we did or a source we cite. Mockup data is labelled as mockup.
- **Never in git:** `.env*`, keys, `data/`, `models/`, `recordings/`, `private/`, and anything that is someone's personal data. The pre-commit hook checks; never skip it with `--no-verify`.
- **Fresh code for the app.** Reuse only code under MIT, BSD, Apache-2.0, ISC or PSF, and credit it. The `.claude/` kit is our tooling, not the entry; check `hack/event.md` for what the rules allow.
- **Ask before anything outward-facing:** making the repo public, posting, submitting, emailing organisers.

## Style

- Plain words a judge would use; short sentences; British spelling; sentence case; no em dashes.
- Pages, decks and screens: light by default, no extra lines, no capitals or kicker labels, no cards, no footer unless a number needs a source, never fill white space. One accent.
- Chat answers short: the answer first, then a few bullets.
- Code comments say what and why, briefly, and match the code around them.
