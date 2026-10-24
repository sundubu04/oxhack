---
name: oxh-spec
description: Turn the chosen OxHack idea into docs/spec-plan.md, a build plan the whole team works from, with the pitch line, the user, the demo beats second by second, outcomes with how we'll know each works, the riskiest unknown and its spike, the build order with sizes and owners, the contracts between parts, and what we cut when behind. Use right after an idea is chosen, when the plan needs re-cutting because time is short, or when someone asks "what's the plan", "who's doing what" or "what do we cut".
---

# Spec

Write the plan backwards from the demo. The demo beats decide the outcomes, the outcomes decide the build order, and the clock decides the cut list. The shape follows flow-er's `spec-plan.md`, which the team built from at Reinvent the Wheel.

## Steps

1. **Read** `hack/event.md` (criteria, pitch format, rules, team, the hour plan) and the chosen idea's row and notes in `hack/ideas.md` and `hack/decisions.md`.
2. **Copy `template.md`** (beside this file) to `docs/spec-plan.md` and fill it in, in this order:
   1. **The pitch line**: one sentence a stranger can repeat ("We built X so that Y can Z").
   2. **The user**: one named person or role, their pain in their words, and what they do today.
   3. **Demo beats**: the 60 to 120 s video (or the live demo), beat by beat: time, what is on screen, what the judge should understand. Open on the transformation, not on set-up. This is the spec everything else serves.
   4. **Outcomes**: one per beat that needs code, each with "how we'll know": a test, a scripted demo run, or a number from a real run.
   5. **The riskiest unknown** and the spike that settles it in under an hour. It goes first in the build order.
   6. **Build order**: number, work, size (S under 2 h, M 2 to 5 h, L over 5 h), owner, needs, in the demo or not. The demo path end to end comes before any widening.
   7. **Architecture**: one diagram (mermaid in the doc; `oxh-artifact` draws it for the page) and the contracts between parts: routes and payloads, file formats, the model call. Contracts are written before two people build either side.
   8. **Data**: source, licence, where it lives (never in git), and the credit line.
   9. **Rules that stay**: carried from `CLAUDE.md`, plus any the idea needs ("the model never makes up a number").
   10. **The cut list**: what we drop, in order, at each checkpoint we miss.
3. **Split the work.** Spawn `oxh-planner` with `docs/spec-plan.md` and the team table from `event.md`. It returns owned vertical slices with contracts and handoffs; merge them into the build order and the contracts section.
4. **Check it against the clock.** Sum the sizes on the critical path. If it doesn't fit before the freeze with a third left over, cut now, not at 4 a.m.
5. **Ask the panel.** Spawn `oxh-judge` with the pitch line, the user, the demo beats and `event.md`. Fix any beat it says a judge would not follow.
6. **Publish** the plan with `oxh-artifact` (the `plan` page type) so the team can read it on their phones, and record decisions (stack, contracts, data) in `hack/decisions.md`.

## Keeping it true

Update `docs/spec-plan.md` when the plan changes: tick outcomes as they pass, move cut items to "Cut", and add the time. Republish the page after each checkpoint. A plan nobody updates is worse than none, because people build from it.
