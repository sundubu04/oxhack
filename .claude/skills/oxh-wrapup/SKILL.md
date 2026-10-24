---
name: oxh-wrapup
description: Finish OxHack cleanly. Run the submission checklist from hack/event.md, write the README judges will read, check licences and credits, run the public check before the repo is made public, draft the LinkedIn post and short video cut, and record the result. Use before the submission deadline, before making the repo public, after the pitch, or when asked for the README, the submission text, the Devpost entry or the post.
---

# Wrap-up

Most hackathon repos are judged and remembered by their README and their video. And a public snapshot is permanent, so check it before it goes out.

## Before the deadline

1. **The checklist.** Every row of the submission table in `hack/event.md`: done, its link, and its limit checked (video length, word count, slide count). Submit early; resubmitting is usually allowed, a late first submission isn't.
2. **README for judges** (`README.md`, top section): what it does in one sentence, who it is for, the demo video link, how to run it in three commands, what is real and what is mocked, the team, and credits (data with licence, reused code with licence, organisers). Keep the `.claude/` notes below it.
3. **Licences.** The app's licence matches the event rules (`LICENSE`). List what we reused: `npx license-checker --summary` in a Node app, `uvx pip-licenses` in a Python one. Anything not MIT, BSD, Apache-2.0, ISC or PSF goes to the team before it ships.

## Before the repo goes public

Run the public check from the repo root:

```
sh .claude/skills/oxh-wrapup/scripts/public-check.sh
```

It lists every tracked file that looks like a secret, personal data, a big file, or a word from `hack/private-words.txt` (gitignored; copy `hack/private-words.example.txt` and add client names and people who didn't agree to be named). It reports and never deletes. Fix each finding, and remember that git history keeps a removed file: if a secret was ever committed, rotate it.

The `.claude/` kit includes pieces adapted from Darling's private darling-agentic repo (`oxh-ui-kit`, `oxh-ui-polish`, `oxh-ui-critic`, `oxh-slides`, `oxh-frontend-engineer`, `oxh-pitch/references/pitch-craft.md`). Ask Eun whether they may be public; if not, remove them in one commit before the visibility changes. Making the repo public is the team's decision, never Claude's.

## After the pitch

1. **The result** in `hack/decisions.md` (placing, judges' feedback in their words) and in Eun's global memory as a project memory, the way `flower-hackathon` records Reinvent the Wheel.
2. **The post**, drafted for whoever posts it:
   - Open on a general problem in research or work, in precise words anyone in the field would use ("manual annotation, one file at a time"), not the niche detail and not a results-first hook. A one-line hook, then a one-line re-hook.
   - The insight before the product; the field and the numbers further down; credit the team, the organisers and the data.
   - The video: the 30 to 45 s cut from `oxh-demo`, captions on the footage, no full-screen cards after the first.
   - Publish the draft with `oxh-artifact` so the team can comment. Never post for anyone.
3. **Thank-yous**: the users who helped, the organisers, the sponsors, as the team decides.
