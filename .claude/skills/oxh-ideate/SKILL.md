---
name: oxh-ideate
description: Generate, check and score hackathon ideas for OxHack against the event's own judging criteria, then publish an idea board the team can read on their phones and decide from. Use when the team starts brainstorming, asks "what should we build", wants more ideas on a theme, wants an idea scored or compared, or needs to choose between two or three ideas. Ends with one chosen idea recorded in hack/decisions.md.
---

# Ideate

Diverge fast, check what exists, score honestly against what the judges reward, decide inside the time box. The idea that wins a hackathon is one a judge understands in ten seconds and believes in the demo.

Read `hack/event.md` first: the theme, the tracks, the criteria and weights, the sponsor prizes, the data rules and the team. If it is empty, run `oxh-kickoff` first.

## What the last hackathon taught us

From Reinvent the Wheel (flow-er, Oct 2026):
- **Build for one real person.** flow-er was built around Will, an immunology researcher in the room, and his three asks. A real user gives the problem slide a quote, the demo a believable task and the judges someone to ask.
- **The panel wanted the problem, the old way, then mostly the tool.** Pick an idea whose tool is the interesting part.
- **The proof was a number that moved.** "25 points off the expert, then under 2 after four mice" carried the pitch. Prefer ideas where a before and after can be measured during the event.
- **Real data beats mock-ups.** The open mouse dataset (CC BY 4.0) made the demo credible. Check the data exists and is licensed before choosing.

## Steps

1. **Seed.** List what we have: the theme and tracks, sponsor tech with prizes, the team's strengths, datasets we can use, and the real users we can reach today. Ask the team for their own seeds and pains; their ideas go in first and are marked as theirs.
2. **Diverge.** Write 15 to 25 ideas in `hack/ideas.md` (long list), one line each: who it is for, the pain, and the wow moment a judge sees in the demo. Vary the angle: a tool for a specific expert, an agent that does a chore end to end, a new view of an existing dataset, a sponsor's API used for something it wasn't built for. No idea gets a paragraph yet.
3. **Shortlist eight** that fit the theme and the team. Drop anything that needs data we can't get, hardware we don't have, or more than one unknown we can't spike in an hour.
4. **Check prior art** for the eight: a few web searches each (product, GitHub, past winners on Devpost). Record the closest existing thing and what ours does that it doesn't, with the link, in the prior-art table. An idea that exists already isn't dead, but its pitch must say what is new.
5. **Score.** One row per idea in the scores table: each judging criterion from `event.md` (1 to 5), then our filters:
   - **Demo:** a visual wow inside the first 30 seconds of a 90-second video.
   - **Buildable:** this team, in the build hours of the plan, with one spike for the riskiest part.
   - **Data:** real, available now, licence allows a public demo.
   - **Real user:** someone we can quote and test with during the event.
   The total weights the judging criteria as the organisers do, then adds the filters at half weight. Write one line of reasoning for every 1 or 5.
6. **Ask the panel.** Spawn `oxh-judge` with `hack/event.md` and the top five as one paragraph each (pitch line, user, demo moment, prior art), and nothing else. It scores them blind to our scores and names the question a judge would ask about each. Where it disagrees with us by 2 or more on a criterion, say so.
7. **Publish the idea board** with `oxh-artifact` (the `board` page type): the top five as rows with the pitch line, the wow moment, the scores and the judge's question; the long list folded under them. Record it in `hack/artifacts.md`.
8. **Decide.** The team chooses, not Claude. When they do, add a row to `hack/decisions.md` (the idea, the runner-up, why) and hand over to `oxh-spec`. If the time box in the hour plan runs out without a choice, say so and recommend one, with the reason in one sentence.

## A shared board

If the team wants to vote on the board itself, load `artifact-capabilities` before writing the page and give it the shared `db` capability: one document per idea, votes as fields. Claude reads the votes back with `ArtifactData`. Otherwise votes happen in the room and Claude records them.
