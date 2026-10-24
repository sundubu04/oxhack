---
name: oxh-kickoff
description: Start OxHack properly. Read the organisers' brief (a web page, PDF, email, Slack or Discord post, or a photo of the opening slides), fill in hack/event.md with the times, theme, judging criteria and weights, rules, submission requirements and the team, then set the hour plan back from the pitch. Use at the opening ceremony, when the brief or the theme is announced, when rules or deadlines change, or when someone asks "what are the rules", "when is the deadline" or "how long do we have".
---

# Kickoff

The first hour decides what every later choice is judged against. Get the facts into `hack/event.md` before anyone ideates, because ideas scored against the wrong criteria waste the night.

## Steps

1. **Collect the brief.** Ask for whatever the organisers published: the event page (WebFetch it), the PDF or slide photo (Read it), the Slack, Discord or email post (paste, or the connector if it is reachable). Save a copy of anything not public in `private/` (gitignored).
2. **Fill in `hack/event.md`.**
   - The five front-matter lines first: `start`, `freeze`, `submit` and `pitch` as `YYYY-MM-DD HH:MM` in the event's zone, and `tz`. The status line and the session note read them. Set `freeze` yourself if the organisers don't: three hours before the submission for a 24-hour event, two for a shorter one.
   - Judging: every criterion with its weight, in the organisers' words. If no weights are given, write "equal" and say so.
   - Rules that bite: code written before the start, licence and public-repo requirements, team size, who may present, AI and API limits, data rules. Quote them. Where the brief is silent on whether our `.claude/` tooling counts as prior code, write "ask" and draft the question for the organisers.
   - Submission: every item (repo link, video, deck, form text), where it goes, when, and its limit (video length, slide count, word count).
   - Team: who is here, strengths, who owns what, and any real user we can reach during the event. Ask rather than guess.
   - Every line says where it came from: "(brief p. 2)", "(organiser, Slack 09:40)".
3. **Set the hour plan** back from the pitch, and write it in the table at the end of `event.md`. For a 24-hour event:

   | Share of the time | Phase |
   | --- | --- |
   | 8% | Ideate, ending with one chosen idea |
   | 4% | Spec and split the work |
   | 55% | Build the demo path, then widen it |
   | 8% | Polish the screens the demo shows |
   | then the freeze | Record the demo and cut it |
   | 10% | Deck, then two timed rehearsals |
   | the rest | Sleep in shifts, food, slack for what breaks |

   Put the first rehearsal at least two hours before the pitch.
4. **Check the clock reads it:** `python3 .claude/hooks/clock.py --line` prints the countdown.
5. **Record it.** Add a row to `hack/decisions.md` for any rule interpretation the team agreed. Then hand over to `oxh-ideate`.

## What to say back

The countdown, the judging criteria with weights, and any rule that changes what we can build (prior code, licence, data), in a few lines. Flag every question the brief leaves open, with the draft message to the organisers.
