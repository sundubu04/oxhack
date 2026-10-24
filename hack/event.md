---
# Times are local to the event (tz below), written YYYY-MM-DD HH:MM. The status line and the
# session-start note read these five lines; leave a value empty until it is known.
# The four times below are ESTIMATES from "25 hours of hacking, demos Sunday" — confirm on Discord.
name: OxHack
tz: Europe/London
start: 2026-10-24 13:00
freeze: 2026-10-25 09:00
submit: 2026-10-25 11:00
pitch: 2026-10-25 12:00
---

# OxHack 2026

From the opening-ceremony deck (`hack/opening-ceremony.md`) and the organisers' prize clarification, 24 Oct 2026. The four times above are estimates; confirm the real submission and judging times on Discord and re-run `oxh-kickoff`.

## The event

- **OxHack 2026**, Oxford, in person + online. Run by Hackathons UK with MLH. ~350 hackers.
- **25 hours of hacking** this weekend — clocks go back on Sun 25 Oct, so there's an extra hour. Started Sat 24 Oct; demos Sunday.

## Judging

**Science-fair style: 4 to 5 minutes per judge**, at your table. Demo, a short presentation, or anything else — your choice. No big-stage pitch. (So `oxh-pitch` adapts: a tight live demo + a one-board poster beats a slide deck here. `oxh-demo` is the fallback and the DEV write-up asset.)

Two kinds of prize, and you may enter one or both:

### Main track — theme "TIME"
Prizes: **First Place**, **Runner Up**, **Best Hand Made Project** (with thanks to Citadel). Judged by the OxHack committee and friends.
- The theme is deliberately broad: "Time" can show up in any way that suits the project (the organisers' example: changes in value over time for stock modelling).
- No published rubric; committee judgement.

### Sponsor prizes (separate; stackable with the main track)
| Prize | Brief | Fit for us |
| --- | --- | --- |
| **HRT** | "Best use of Data for Predictions & Decision Making" | **Strong** — our data-analytics angle |
| **Delta** | "Built with Delta": build in Delta with teammates + agents, share threads. Speed & Performance 30%, Technical 25%, Innovation 25%, Polish & Usability 20% | Process prize — eligible if we build in Delta; rewards snappy UX |
| **Gemini API** | Multimodality + flash models | Vision/explainer features |
| **Presage** | Camera as a real-time biometrics sensor (vision) | Off our theme; a separate project if we want it |
| **ElevenLabs** | AI audio (voice in/out) | Accessibility: read verdicts aloud |
| **Tiger Data** | Scalable (time-series) Postgres | Store the time-series data behind a Time project |
| **Snowflake** | Big-data analytics | The analytics warehouse behind an HRT/data entry |
| **Vultr** | Cloud hosting | Host the backend |
| **Solana** | Blockchain | No natural fit |

## Rules that bite

- **Code written before the start:** confirm on Discord whether a `.claude/` setup prepared beforehand is allowed. Our tooling is process, not the submission; the app is written here. If in doubt, ask the organisers.
- **Licence / public repo:** MLH events usually want the repo link in the submission; a public repo is normal. We default to MIT. Confirm.
- **AI and API use:** encouraged (OpenRouter via Delta; MLH sponsor APIs). Fine.
- **Data:** bring your own; the HRT track is explicitly about using data well.

## Submission

| What | Where | Due | Limit |
| --- | --- | --- | --- |
| Project + repo link | OxHack / MLH platform (confirm) | Sun (confirm) | — |
| Delta threads | Shared, to show collaboration | with submission | — |
| DEV post (optional) | dev.to/mlh-hackathon | after | — |

## Team

| Who | Strengths | Owns | Laptop and accounts |
| --- | --- | --- | --- |
| Eun | App, agent, design | | |

Real users we can reach during the hack (confirm): other hackers are everyday web users we can test an end-user tool with.

## The hour plan

Set by `oxh-kickoff`, back from the pitch. Estimated (confirm times first):

| From | Until | Phase |
| --- | --- | --- |
| Sat 13:00 | Sat 15:00 | Ideate, choose one idea |
| Sat 15:00 | Sat 16:00 | Spec + split, pick which prizes to target |
| Sat 16:00 | Sun 06:00 | Build the demo path, then widen |
| Sun 06:00 | Sun 08:00 | Polish the demo screens |
| Sun 09:00 | — | Freeze; record the demo |
| Sun 10:00 | Sun 12:00 | Rehearse the 4–5 min science-fair pitch twice |
