---
name: oxh-artifact
description: Publish OxHack's team pages as claude.ai artifacts in one house look, from source files kept in docs/pages/ and listed in hack/artifacts.md so every link survives a republish. Page types for a hackathon are the idea board, plan, architecture, status board, results, demo run sheet, judges' one-pager and the final "what we built". Use whenever the team needs something to read on a phone or share in the group chat, when asked for an artifact, a page, a board, a diagram page or a write-up, or when another oxh- skill says to publish. Not for the pitch deck (oxh-pitch) or a document people edit together (the docs skill).
---

# Team pages

A page beats a long chat message whenever the team reads it on a phone, shares it, or comes back to it. Every page has its HTML source in `docs/pages/`, committed, and a row in `hack/artifacts.md`, so anyone can find it and its owner can republish it to the same link.

## Steps

1. **Start the artifact the tool's way.** For a new page, call the Artifact tool's `quickstart` first (intent `other` for a page or board, `document` for a doc to edit together, `slides` for a deck) and follow what it returns: if it names an Artifact type that fits (a Dashboard for a status board with numbers), use the type. For a plain page, load the `artifact-design` skill before writing.
2. **Copy `templates/page.html`** to `docs/pages/<slug>.html`. It carries the house look: light and dark tokens, the kit's pink as the one accent, the system font with Figtree for titles, rows with space instead of ruled tables, status as a mark and a word, `<details>` for sources. Keep its `:root` tokens; change only the content.
3. **Write the page** from the page type below. The title is a name of two to four words ("OxHack idea board"), the first line under it answers the page's question, and the page fits about one phone screen per section. Diagrams are inline SVG or `<pre class="mermaid">` (the viewer renders mermaid itself). Every number has a source, in the sources fold.
4. **Publish** with `file_path` = `docs/pages/<slug>.html`, an `icon` word on the first publish, and a one-sentence `description`.
5. **Record it** in `hack/artifacts.md`: page, link, source, owner (whoever's account published it).
6. **Update** by editing the source and republishing the same file. In a later session, read the link first (`action: "read"`), then publish with `url`. Someone else's page: edit the source, commit, and ask its owner to republish; never publish a second copy under a new link.
7. **Sharing** is the owner's choice: pages start private and are shared from claude.ai. Never change who can see a page.

## Page types

| Type | Answers | Holds |
| --- | --- | --- |
| `board` | Which idea do we build? | The top five as rows (pitch line, wow moment, scores, the judge's question), the long list folded under, the decision once made |
| `plan` | What are we building, and who does what? | The pitch line, demo beats, outcomes with status, the build order with owners, the cut list |
| `architecture` | How does it fit together? | One diagram, then the contracts between parts as rows |
| `status` | Are we on time? | The countdown, outcomes as done, building, blocked (mark and word), what is blocked on whom, the next checkpoint |
| `results` | Does it work? | The number that moved, how it was measured, one chart drawn to scale (load `dataviz` first), what is not yet tested |
| `run-sheet` | What happens on stage? | Who says what, where to click, timings, the fallback for each beat |
| `judges` | What should a judge remember? | The pitch line, the user, three facts with sources, the demo link, the repo, the team |
| `built` | What did we make? | The final story for after the event: what, for whom, the result, credits, links |

## A page people write on

For a board that teammates vote on, a checklist they tick, or a status they update, load `artifact-capabilities` before writing the page and use its shared `db` capability; Claude then reads and writes the rows with `ArtifactData` instead of republishing. Keep records out of the page source.

## Taste

The rules in `CLAUDE.md` apply: light by default, no extra lines, no capitals or kicker labels, no cards, never fill white space, one accent. Short beats complete: a page longer than a few phone screens is two pages, or a page and a fold.
