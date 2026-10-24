# Principles behind the templates

The rules every template keeps, and where each comes from. Sources and measurements are in `research-visual.md` (reference looks, fonts, Korean pairing) and `research-components.md` (charts and diagrams); both were compiled on 22 October 2026, and every claim there is tagged measured, published, secondary or unverified.

## Colour

- **A tinted neutral ramp and one accent.** Every clean brand measured runs on neutrals tinted toward one temperature plus a single chromatic accent for "the one thing to look at": Stripe, Linear, Vercel, Notion, Toss, Apple, Anthropic, IBM (research-visual §0, §3.4). Each template has one accent: pink (Midnight), rosewood (Paper), signal red-orange (Grid), sakura (Console), deep pink (Petal).
- **One accent element per slide.** The accent marks what the title is about and nothing decorative: not rules, title bars, bullets or icons (§3.4; Rams: colour only when it "told the user something"; Duarte: "if too much is emphasised, nothing is").
- **Split a brand colour into a mark colour and a text colour** when it fails 4.5:1 as text (SmartHR does this publicly). Midnight's sakura and Petal's petal are mark colours; pink #B23A6E and deep pink #A34A69 are their text siblings.
- **Contrast is a number.** Text 4.5:1 on its ground, 3:1 at 44px and up, chart marks 3:1 unless labelled (WCAG 1.4.3 and 1.4.11). Every README lists the ratios; `check.py` checks text against the nearest painted ground.
- **Colour never says it alone.** Status, good or bad, the winning bar: the word or number says it too.
- **Dark done well:** near-black with off-white text, never #000 on #FFF (Linear #08090A on #F7F8F8, Vercel #0A0A0A on #EDEDED); surfaces step up by lightness, 2 or 3 levels; secondary text at 6 to 8:1; accents lightened a step for dark (§3.6). Console follows this.

## Type

- **Five or six sizes a deck, three a slide.** Vignelli: "one or two type sizes at the most" a page; slide scales are much smaller than UI scales (Material has 15 styles, Geist 30) (§3.3). Each template's `tokens.json` is its whole scale, and `check.py` refuses any other size.
- **Big type is either light or semibold and tight, never bold at default tracking.** Geist tracks −0.06em at 40px and up, Linear −0.022em, Stripe sets heroes at 300 (§3.3). Templates track display sizes −2 to −9px.
- **Nothing under 24px,** body 28 to 30px, sentences at most 1000px wide (the readability canon).
- **Google Fonts only,** at most four faces a deck. Pretendard is not on Google Fonts; Inter for Latin with Noto Sans KR for Hangul is its near-exact substitute, because Pretendard is built on Inter and Source Han Sans (§2.4).
- **Korean:** body line height 1.5 to 1.6, headlines 1.25 to 1.4, tracking 0 on body and at most −0.02em on display, break between 어절 (§2.5). Match a Latin face's cap height to the Korean font's own Latin (Noto Sans KR ↔ Inter 1.01; IBM Plex Sans KR ↔ Plex Sans 1.00; Noto Serif KR ↔ Newsreader 1.08) (§2.4).

## Space and structure

- **Margins of 128 to 144px** (6.7 to 7.5% of the width). The broadcast graphics-safe minimum is 5% (EBU R 95); wider "deflates the tension" (Vignelli) (§3.1).
- **Do not fill the white space.** Content sits under the title at its natural height; empty space low on a slide is correct. No stretched cards, no spacers to push a row to the bottom, no sentence, band or box added for balance (the team's rule, 23 October 2026; impeccable's distill: "remove anything that doesn't earn its place").
- **Titles at the same height on every content slide,** so nothing hops when the viewer pages through (the Slides type's layout guide). Statement, quote and divider slides may centre.
- **No extra lines.** A line must carry information: a chart axis, a gridline, a connector, a lifeline, a timeline rail, a target tick. No rules between rows, under headings, above columns, around a cover's details or around cards (the team's rule; research-visual §3.5: space first, then a fill step, then a hairline).
- **No cards.** Separate groups with space. A fill is allowed where it means something (the one highlighted row, the current item, a dark code panel); a box is never both filled and outlined, and an outline marks only the one box the slide is about or something someone else owns.
- **No footer by default.** No page numbers and no running headers. A source line appears only on a slide whose numbers need one, in sentence case, 24px, at `bottom:64px`, and only then does the slide get `padding-bottom:160px`.
- **One radius per template, or none.** Circles only where the shape means something: a person, a node, a step.

## Charts and diagrams

- **Grey first, then colour one thing** (Muth, Datawrapper 2023: "gray out all your colorful categories first"; IBM Carbon) (research-visual §3.7, research-components §4).
- **Direct labels, not legends;** values at bar ends; the unit on the top tick; horizontal gridlines only for columns and lines, none for horizontal bars; zero baselines for bars; never a dual axis, 3D, rotated labels or pies over five slices (research-components §4).
- **Numbers:** two or three significant figures, tabular figures in columns, × for multiples, − for minus, "pp" for percentage points, dates as "22 Oct 2026" (§4).
- **Diagrams:** boxes on one grid with one pitch, one stroke weight, labels on every connector, the accent on the one path or node the slide is about, no icons inside nodes (research-visual §3.7; the Slides type's diagram guide for the geometry).
- **Every chart has a source line:** "Fig. n · source, what, period · n = …". Sample data says so until it is replaced.

## Taste

Minimal and clean means removing, not decorating. Never: labels or kickers above titles (impeccable bans them outright: "the heading carries its own weight"), text in capitals, letter-spaced small labels, mono used as a costume for "technical", section numbers that carry no order, page numbers, gradients, drop shadows, emoji, stock photos, clip-art icons, logo walls, accent lines under titles, coloured left borders, rules nobody needs, dashes as punctuation, "Thank you" or "Questions?" as the last slide.

## Checked with impeccable

On 23 October 2026 the five templates were run through impeccable (github.com/pbakaus/impeccable, Apache-2.0): its craft floor, distill and quieter references, and its deterministic detector run on each deck as one page. The detector's real findings were the old Midnight's letter-spaced capital labels (`wide-tracking`) and rules hugging Paper's column heads (`cramped-padding`); both are gone. What remains are false alarms for slides: labels over SVG drawings read as low contrast, and Inter and Geist flagged as overused (kept on purpose: Midnight inherits the approved pitch deck's face, and Geist suits the engineering look). `check.py` now enforces the taste rules the detector cannot see on slides: capitals, letter-spaced labels, page numbers, and a note for every rule a slide draws.
