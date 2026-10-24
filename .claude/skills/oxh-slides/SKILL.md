---
name: oxh-slides
description: Five native slide templates for the claude.ai Slides artifact type (Midnight for investor decks, Paper for proposals and partner meetings including Korean, Grid for research and data readouts, Console for product demos and engineering talks, Petal for team updates and workshops). Each has a palette, a type scale, spacing rules and 16 to 18 sample slides covering about 60 diagram and chart components. Use for the OxHack pitch deck, a demo or architecture slide, a results readout, and when starting any deck, choosing a look, needing a chart, diagram, table, timeline or architecture slide, or making slides look clean and consistent.
---

# Slide templates

Adapted from darling-agentic's drl-slide-templates. For the hackathon pitch itself, start from `oxh-pitch`, which picks the template and the storyline and comes back here for the slides.

Five looks, each a complete deck folder in the Slides type's own format (`project/deck.json` and one `project/slides/<id>.html` per slide). Copy the slides you need, replace the sample text, keep the look. The sample text tells the story of Loamly, a made-up soil-sensor startup, so no word or number in it is real; `check.py` flags any Loamly text left in a deck. Every template follows the same taste: lots of space left empty, one accent per slide, no labels above titles, no capitals, no cards, no lines that carry no information, no footer unless a number needs a source, and no gradients, shadows, emoji or stock photos. Each template's fourth slide says which visual to use in which situation, with sources.

The commands below run from the repository root, where this skill lives at `.claude/skills/oxh-slides/`.

## Pick a template

| Template | For | Ground and type | Signature |
|---|---|---|---|
| [`midnight`](assets/templates/midnight/README.md) | Investor and accelerator decks | Navy bookends, warm pages; Inter alone | The two-circle brand mark, a timeline opening, the problem loop and its pink rhyme, a navy and page split, the sakura statement slide; no cards, no labels |
| [`paper`](assets/templates/paper/README.md) | Proposals, partner meetings, narrative updates, Korean meetings | Warm paper; Newsreader + Noto Sans KR (+ Noto Serif KR) | A 360px margin column for labels, serif headlines, no boxes and no rules, rosewood accent |
| [`grid`](assets/templates/grid/README.md) | Research readouts, metrics reviews, numbers-heavy updates | Stark white; Schibsted Grotesk + Inter | Hanging headlines, 220px numerals, grey-first charts with one red-orange signal; lines only inside charts |
| [`console`](assets/templates/console/README.md) | Product demos, engineering talks, architecture reviews | Cool light page, dark only for code and terminal; Geist + Geist Mono | Filled boxes, an accent outline on the one box that matters, labelled connectors |
| [`petal`](assets/templates/petal/README.md) | Team updates, workshops, onboarding, hackathons | Warm grey; Figtree | A six-petal flower, each person's own flower, status pills; no cards, no footers |

Each template is also a showcase deck on claude.ai (private to Eun; ask for a share link): [Midnight](https://claude.ai/artifact/DrQCEQNpXzHw1PV233FoMn), [Paper](https://claude.ai/artifact/22s6LWcRcgDXJV6Zc7gbmt), [Grid](https://claude.ai/artifact/5Hpxducircn6zsXrcw4Ter), [Console](https://claude.ai/artifact/Y5tL4hFxSFWbtFxnZ8jpZh), [Petal](https://claude.ai/artifact/3ERhEvbgXDLXH1EkXGpgs1). The repo files are the source; republish a deck after changing its template.

**Pink overlay.** To use any template in the UI kit's pink (`oxh-ui-kit`) without changing it, build the deck, then run `python3 .claude/skills/oxh-slides/scripts/overlay.py <folder> --template <name>`: it swaps the colours listed in `assets/templates/<name>/overlay-pink.json` (the accent and its tints) and leaves type, layout and neutrals alone. Midnight and Petal are pink already, so their maps are empty. Check the result with `python3 .claude/skills/oxh-slides/scripts/check.py <folder> --template <name> --overlay pink`.

Decide by audience first, then by content: a pitch to investors is Midnight even when it has charts; a readout to a partner is Grid; a proposal to a Korean partner is Paper. When unsure, say which two fit and why, and ask.

## Files

| File | Read it when |
|---|---|
| `assets/templates/<name>/README.md` | You have picked a template: palette with contrast, type scale, spacing, the recipe for every sample slide, and what not to do |
| `assets/templates/<name>/tokens.json` | You need exact values (also in the Design System type's shape, so a template can become a claude.ai design system) |
| `assets/templates/<name>/project/` | You are building: copy slides from here |
| `references/principles.md` | Making a design decision or defending one: the shared rules and where they come from |
| `references/components.md` | You need a chart or diagram: which template has which component, when to use it, the rules that keep it quiet |
| `references/research-visual.md`, `references/research-components.md` | You want the sources: 17 reference looks (Stripe, Linear, Vercel, IBM, Toss, SmartHR, Vignelli…), font metrics and Korean pairing, and a 35-component catalogue with chart defaults |
| `scripts/new.py` | Starting a deck from a template |
| `scripts/preview.py` | Rendering a deck folder locally: a contact sheet and a layout report |
| `scripts/overlay.py`, `assets/templates/<name>/overlay-pink.json` | You want a template in the UI kit's pink without editing the template |
| `scripts/check.py` | Checking a deck keeps to its template and the house taste: colours, sizes, faces, contrast, capitals, labels, page numbers, rules, leftover sample text |

## Workflow

1. **Brief.** Who it is for, how it is used (presented or sent), the one thing they should remember, the length.
2. **Pick the template** (table above) and read its README.
3. **Write the titles first,** one full-sentence claim per slide (method, contents and dividers may use short labels). Read them alone in order: they must tell the story.
4. **Start the deck folder:** `python3 .claude/skills/oxh-slides/scripts/new.py <template> <folder> --title "Deck name" --slides cover,summary,phases,...`. It copies the chosen slides in that order. Each sample slide's `<aside>` says how to use it; replace it with real speaker notes or delete it.
5. **Replace the sample content.** Every number needs a source; fill in or delete each `[bracketed]` source line. Use only the template's palette and sizes. Diagrams: keep the grid the sample uses and change labels first, geometry second (the coordinates are listed in the recipe).
6. **Check:** `python3 .claude/skills/oxh-slides/scripts/check.py <folder> --template <name>` (add `--overlay pink` after running overlay.py) (palette, scale, faces, contrast, capitals, letter-spaced labels, page numbers, dashes, leftover recipes and `[bracketed]` sources; it notes every rule a slide draws), then `python3 .claude/skills/oxh-slides/scripts/preview.py <folder>` and look at `preview/sheet-*.png`. Fix anything past the margins and any text wider than its box. Leave empty space empty.
7. **Publish on the Slides type.** Artifact tool: `quickstart` with intent `slides`, then publish with the Slides `type_url`, a `title` and no files; then one publish with `url`, `root` = the deck folder, `file_path` = `<folder>/project/deck.json` and `files` mapping every `project/slides/<id>.html` to itself. Keep `designSystems` empty: the template is the look.
8. **Editable copy, if asked:** in the deck, Share › Export › PowerPoint › Current fonts, then upload to Drive and File › Save as Google Slides (the Send to Google Slides button asks for a Drive connector grant, which is the person's to give).

## Rules every template keeps

- **One idea per slide, one accent per slide.** The accent marks the thing the title is about: a number, a bar, a box, a row. Everything else is ink and grey.
- **The title carries the slide.** No label, kicker or eyebrow above it, no capitals anywhere, no letter-spaced small text. Titles sit at the same place on every content slide, as full sentences of at most two lines with no full stop.
- **No extra lines.** Only lines that carry information: chart axes and gridlines, connectors, lifelines, a timeline rail, a target tick. Space separates everything else.
- **No cards.** A fill only where it means something; never a fill and an outline on the same box.
- **No footer by default.** No page numbers. A source line only where a number needs one.
- **Do not fill the white space.** Content sits at its natural height under the title.
- **Nothing under 24px.** Body 28 to 30px, sentences in columns of 1000px or less.
- **Charts grey first, then colour one thing.** Direct labels instead of legends, values on bars, units on the top tick, never a dual axis.
- **Never invent.** Sample numbers stay in the template; a real deck sources every number. Customers are described by type unless they signed off on being named.
- **No dashes as punctuation,** British spelling, sentence case everywhere.

## Making a new template

Copy the closest template folder, change `tokens.json` first (palette with contrast for every text colour on every ground, five or six sizes, one or two faces from Google Fonts), rebuild the palette and type slides, then restyle each sample slide. It needs a README in the same shape and must pass `check.py` and `preview.py`. A sixth template should do a job none of the five does, not recolour one of them. During the hackathon, prefer a template plus the project's own accent over a new template.
