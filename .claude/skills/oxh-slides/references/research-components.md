# Slide component catalogue — our product minimal templates

Research for five minimal slide templates (1920 × 1080, one HTML `<section>` per slide, inline CSS, inline SVG, Google Fonts, no JS). Compiled 22 Oct 2026. Source keys like **[DW-col]** point to §6; anything not checked against a primary source is marked **(unverified)**, and §7 lists every gap.

Contents: §1 canvas conventions · §2 build techniques · §3 catalogue (35 components) · §4 chart defaults · §5 the 12 that matter most · §6 sources · §7 what could not be verified.

---

## 1. Canvas conventions every component assumes

These are house numbers derived for a 1920 × 1080 canvas, not taken from any one source. The templates set their own margins and scales (see each template's README); use these numbers for components the templates do not have yet.

**Frame**
- `section`: `position:relative; width:1920px; height:1080px; overflow:hidden;` explicit `background`.
- Margins: 120 px left and right, 96 px top, 72 px bottom. Content box x 120–1800 (1680 px wide).
- Title block y 96–232 (56 px title, at most 2 lines). Content zone y 288–960 (672 px tall). Footnote/source line baseline about y 1008 (24 px). Optional page number bottom-right, 24 px.
- 12-column grid inside 1680 px: 12 × 96 px columns + 11 × 48 px gutters. Halves = 816 px, thirds = 528 px, quarters = 384 px, fifths ≈ 298 px (all with 48 px gutters).
- No kicker or eyebrow line above titles. The title carries the point.

**Type scale (px)** — nothing below 24.

| Role | Size | Notes |
|---|---|---|
| Source line, tick labels, footnotes, legend keys | 24 | the floor; colour `--ink-3` |
| Chart/diagram labels, captions, table body (dense) | 28 | |
| Body, table body (normal), card text | 32 | line-height 1.35 |
| Card titles, lede, subtitle | 40 | |
| Slide title | 56 | line-height 1.15, weight 500–600 |
| Section divider / 2-line statement | 88–120 | |
| Big numbers | 96–160 | tabular figures, weight 400–500 |

WCAG counts 18 pt (= 24 px) and up as "large text", so every label on these slides only needs 3:1 [WCAG-c]. Projectors wash out contrast, so hold all text to 4.5:1 anyway (`#767676` or darker on white).

**Colour tokens** (contrast against `#FFFFFF`, computed)

| Token | Example | Ratio | Use |
|---|---|---|---|
| `--ink` | `#111111` | 18.9 | text, focus marks when there's no accent |
| `--ink-2` | `#555555` | 7.5 | secondary text, labels |
| `--ink-3` | `#767676` | 4.5 | tick labels, source line; lightest colour allowed for text |
| `--context` | `#A6A6A6`–`#B3B3B3` | 2.4–2.1 | grey context data (bars, lines). Below the 3:1 non-text minimum [WCAG-nt], so only for marks the viewer may skim past [DW-emph] |
| `--rule` | `#E3E3E3` | 1.3 | hairlines, gridlines, dividers. Structure only, never data |
| `--accent` | per template | ≥ 3:1 | **one per slide**: the answer, never decoration |

**Strokes (px at 1920)**: hairline/gridline/divider 2 · axis or zero line 2 (`--ink-3`) · connectors and arrows 3 · context data line 3 · focus data line 6 · outline for "plan" or "empty" shapes 3. Why not 1 px: a 1920 slide shown in a 960–1280 px window (thumbnail, laptop, screen share) renders 1 px at 0.5–0.67 px and it breaks up. For reference, the AWS deck draws 2 pt lines and 12 pt labels on a 960 pt-wide slide, which is 4 px and 24 px at 1920 [AWS].

**Spacing scale**: 8 · 16 · 24 · 32 · 48 · 64 · 96 · 128. Label-to-mark gap 12–16. Between unrelated groups ≥ 64.

**Corners**: pick one radius per template (0, or 8–12 px) and use it everywhere. Circles only when the shape means something (a person, a node).

**Banned by taste**: gradients (including `repeating-linear-gradient` hatches), `box-shadow`, `filter`, 3D transforms, emoji, clip-art icons, logo walls built from external images, coloured icon tiles [VER].

---

## 2. Build techniques (HTML + inline SVG, no JS)

1. **Flex for anything that repeats in a row or column**: KPI rows, cards, steps, roadmap columns, table rows, horizontal bars (bar = a `div` with `width:62.5%`, so the value is visible in the markup).
2. **Absolute positioning for diagrams**: nodes are `div`s at grid coordinates inside a `position:relative` wrapper. Connectors go in one SVG layer underneath that shares the same coordinate box.
3. **SVG sized in real pixels**: `width="1680" height="600" viewBox="0 0 1680 600"`, so 1 unit = 1 px. Stroke widths are then true px and HTML labels can sit at the same coordinates. If an SVG has to scale, add `vector-effect="non-scaling-stroke"` to lines.
4. **Text as HTML over SVG.** HTML labels wrap, keep the template font and `font-variant-numeric:tabular-nums`, align to the grid, and are easy to edit. Keep SVG `<text>` out of any scaled SVG, because the 24 px floor then stops being true.
5. **Precompute the geometry** (no JS): `x = x0 + (v − min)/(max − min) · w`, `y = y0 + h − (v − min)/(max − min) · h`, rounded to 0.5 px. Put the data in an HTML comment next to the chart so the next editor can regenerate it.
6. **Crisp hairlines**: even widths (2, 4) on integer coordinates. Odd widths (3) on .5 coordinates. `shape-rendering="crispEdges"` on horizontal and vertical gridlines only, never on curves or diagonals.
7. **Unique ids per slide.** If the tool renders every `<section>` in one document, `<marker>`, `<pattern>` and `<clipPath>` ids collide across slides and the first definition wins. Prefix them: `s07-arrow`, `s07-hatch`.
8. **Solid tints, not opacity.** Overlapping translucent marks blend into muddy third colours, so write tints as solid hex values (accent at 12% on white as its own hex code).

```html
<!-- coordinate box: SVG lines underneath, HTML labels on top, same 1680×600 space -->
<div style="position:absolute;left:120px;top:300px;width:1680px;height:600px">
  <svg width="1680" height="600" viewBox="0 0 1680 600" style="position:absolute;inset:0">
    <defs>
      <marker id="s07-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="12" markerHeight="12"
              markerUnits="userSpaceOnUse" orient="auto-start-reverse">
        <path d="M2 2 L10 6 L2 10" fill="none" stroke="#767676" stroke-width="2"/></marker>
      <pattern id="s07-hatch" width="12" height="12" patternUnits="userSpaceOnUse"
               patternTransform="rotate(45)"><rect width="4" height="12" fill="#111"/></pattern>
    </defs>
    <path d="M400 300 H880" stroke="#767676" stroke-width="3" fill="none" marker-end="url(#s07-arrow)"/>
    <!-- donut alternative if unavoidable: one ring segment, 38%, starting at 12 o'clock -->
    <circle cx="1400" cy="300" r="180" fill="none" stroke="#E3E3E3" stroke-width="56"/>
    <circle cx="1400" cy="300" r="180" fill="none" stroke="var(--accent)" stroke-width="56"
            pathLength="100" stroke-dasharray="38 62" transform="rotate(-90 1400 300)"/>
  </svg>
  <div style="position:absolute;left:400px;top:240px;font:500 28px/1.2 Inter">Request</div>
</div>
```

Other tools: `stroke-dasharray="12 10"` for plans and projections; `border:2px dashed` for boundaries; `<clipPath>` to fill only a Venn intersection; `object-fit:contain` and a 2 px `--rule` border for screenshots.

---

## 3. Component catalogue (35)

Each entry: **Use / avoid** · **Anatomy** (px at 1920 × 1080, inside the 1680 × 672 content zone unless stated) · **Minimal rules** · **Mistakes** · **Build** · **Sources**. Zelazny's test applies to every chart: decide the message first, then the comparison (component, item, time series, frequency distribution, correlation), and only then the chart [ZEL]. The FT Visual Vocabulary lists the alternatives for each relationship [VV].

### A. Numbers

#### 1. Big-number KPI row
- **Use:** 3–4 headline facts (traction, pilot results, research topline). **Avoid:** more than 4 numbers; numbers without a period or definition; vanity totals.
- **Anatomy:** 3 tiles × 528 px or 4 × 384 px, 48 px gutters, top-aligned around y 420. Number 120–160 px (3 tiles) or 96–128 px (4 tiles). Label 32 px `--ink-2` below (what, period). Optional delta or comparison line 24–28 px ("+38% vs Q2"). Vertical gap number → label 16 px.
- **Minimal rules:** tabular figures, weight 400–500 (bold big numbers shout). The accent goes on the one number the title is about, the rest stay ink. Optional 2 px `--rule` vertical dividers, no boxes.
- **Mistakes:** mixed precision (38% next to 37.6%); units spelled differently per tile; a decorative icon over each number; deltas in red/green.
- **Build:** flex row, `align-items:flex-start`, each tile a flex column. Pure HTML.
- **Sources:** [DW-emph], [VER] (stat strip: label, value, detail as peers), [FEW-bullet] for target context.

#### 2. KPI tile with sparkline (and bullet-graph variant)
- **Use:** a number whose trend or target matters (weekly active users, accuracy against target). **Avoid:** when the trend is the story (use a full line chart); sparklines next to each other with different y-scales when readers will compare them [DW-table].
- **Anatomy:** tile 384–528 wide. Number 88–96 px, label 28 px. Sparkline 320 × 72–96 px under or beside the number. 3 px `--ink-3` line, 12 px end dot in accent, end value labelled 24–28 px. Bullet variant: track 480 × 40, featured bar ≈ 1/3 of the track thickness, target tick 4 × 56 px.
- **Minimal rules:** Tufte's sparkline is "data-intense, design-simple, word-sized": no frame, no axes. An optional normal band is a flat `#EDEDED` rect behind the line, and the coloured dot refers to a specific number [TUF-spark]. Bullet: 2–5 qualitative ranges, ideally 3, as intensities of one grey (40/25/10% black), never traffic-light hues [FEW-bullet].
- **Mistakes:** sparkline too flat or spiky (aim for an average slope near 45°) [TUF-spark]; min/max dots on every line.
- **Build:** HTML tile, SVG `<polyline>` in a pixel-sized viewBox. Bullet in pure HTML (three stacked `div`s).
- **Sources:** [TUF-spark], [FEW-bullet], [SWD] bullet graph page.

#### 3. Bar chart (horizontal ranked) and column chart (vertical, time)
- **Use:** comparing magnitudes across items (horizontal, sorted) or a few equal time periods (vertical). **Avoid:** more than 10 bars or 12 columns on a slide; columns for a long time series (use a line).
- **Anatomy (horizontal):** label column 400–480 px, right-aligned 28 px. Bars in the remaining ~1150 px. Bar 40 px, gap 24 px (pitch 64, 10 bars fit 640). Value at the bar end 28 px, 12 px gap. **Vertical:** up to 12 columns in ~1560 px (pitch 130, column 80). Category labels 24 px below. Value labels 24–28 px above the columns, **or** 3–5 gridlines, not both.
- **Minimal rules:** sort descending unless the order means something [D2V order]. Zero baseline always (2 px `--ink-3`). All bars `--context` or ink, the one that matters in accent. Direct value labels make the value axis and gridlines unnecessary [DW-axis].
- **Mistakes:** truncated axis (bars encode length) [ECON]; rotated category labels, so flip to horizontal [D2V hard_label] [DW-ticks]; grouped bars spread apart [D2V grouped_bar]; a legend when there is one series.
- **Build:** pure HTML flex (rows of label · track · value), bar width in %. SVG only if gridlines are needed.
- **Sources:** [VV] magnitude/ranking, [ZEL] item comparison, [D2V], [DW-axis], [SWD] bar chart.

#### 4. Line chart with direct labels
- **Use:** change over time, more than ~6 points, 1–4 series. **Avoid:** unordered categories; two unrelated measures on two y-axes [DW-dual]; more than ~8 lines (spaghetti) [D2V spaghetti], so use small multiples instead [DW-sm] [TUF-EI].
- **Anatomy:** y-label column 120 px. Plot ~1280 × 520 px. Right gutter 280 px for end labels. x labels 24 px below the plot (4–7 labels). 3–5 horizontal gridlines 2 px `--rule`. Focus line 6 px accent, context lines 3 px `--context`. End dot 14 px. End label = series name + latest value, 28 px, in the line's colour (accent label 32 px weight 600).
- **Minimal rules:** no y-axis line, no vertical gridlines. Unit on the top tick only ("$120k"). The y-axis need not start at zero, but add a zero line when values come near it [DW-line]. Projections dashed (`12 10`) after a "today" marker. Annotate the one event that explains the bend [D2V annotation].
- **Mistakes:** legend box instead of end labels [VER] [DW-line]; smoothed curves that invent peaks (use straight segments) [DW-line]; markers on every point; more than one accent.
- **Build:** SVG `<polyline>` per series in a pixel viewBox. Gridlines as `<line>`. All labels HTML absolute.
- **Sources:** [DW-line], [VV] change over time, [D2V], [SWD] line graph.

#### 5. Slopegraph
- **Use:** before/after between exactly two points (two years, two cohorts, without/with us) for 3–8 items. **Avoid:** when the middle of the period matters, when items are unrelated ("dried spaghetti"), or when exact values matter more than direction [SWD-slope].
- **Anatomy:** column headers ("2025", "2026") 28 px `--ink-3` at x ≈ 640 and 1280. Left labels right-aligned ending x 620 ("Name 42%"), right labels starting x 1300 ("58% Name"). Lines 3 px `--context`, focus line 6 px accent with its labels in accent. 8–12 px dots at both ends.
- **Minimal rules:** no axis lines drawn, the two label columns are the axes. Need not start at zero [SWD-slope]. Nudge colliding labels vertically, never the line ends.
- **Mistakes:** too many lines; colouring every line; mixing scales on the two sides.
- **Build:** one SVG with `<line>`s, HTML labels absolutely positioned at the computed y.
- **Sources:** [SWD-slope], [VV] ranking/change.

#### 6. Part-to-whole: 100% bar, stacked bar, waffle (donut alternatives)
- **Use:** shares of one whole (time split by task, revenue mix, survey answers). **Avoid:** pies or donuts with more than 5 slices [DW-pie] (one Academy page says 4) and comparing shares that differ slightly (use bars). With two values, just state the number [DW-pie].
- **Anatomy:** **single 100% bar** full width 1680 × 72–96 px, segments separated by 4 px white gaps, labels above each segment (share 40 px + name 24–28 px). **Stacked bars**: 3–6 rows × ≤ 4 segments, bar 48 px. **Waffle** for one share: 10 × 10 squares, 40 px cells, 8 px gaps (≈ 472 px square), filled cells in accent. **Donut, if unavoidable**: ring stroke 48–64 px, ≤ 3 segments, starting at 12 o'clock and running clockwise, number in the centre.
- **Minimal rules:** the focus segment sits at the baseline (left end) in accent, the others in 2–3 solid greys [DW-stack]. In 100% stacks the second most important category goes at the far end [DW-stack]. Group tiny parts into "Other" [DW-pie].
- **Mistakes:** a legend for segments that could be labelled; a rainbow of segment colours; 3D or exploded pies [D2V 3d].
- **Build:** HTML flex row of `div`s with `flex-basis` in %. Waffle = CSS flex-wrap of 100 `div`s (or an SVG `<rect>` grid). Donut = the `pathLength` trick in §2.
- **Sources:** [DW-pie], [DW-stack], [FEW-pie], [D2V pie, stacking], [VV] part-to-whole.

#### 7. Waterfall
- **Use:** the components between two totals: ARR bridge, cost to serve, hours saved per step, headcount. **Avoid:** more than ~7 bars; when only the net change matters.
- **Anatomy:** start total (ink) · 3–6 floating deltas · end total. Bars 96–120 px wide in ~1560 px. Value labels 28 px above each bar with a sign ("+120", "−40"). Category labels 24 px below. 2 px `--rule` connector lines between bar edges.
- **Minimal rules:** totals start from a shared zero baseline and are never truncated. If the start is large, use a zero-length start and state it in text [SWD-wf]. Group gains together and losses together [SWD-wf]. Increases solid `--context`, decreases outlined (3 px) or hatched, the one delta the title names in accent.
- **Mistakes:** red/green plus an accent (three hues); unlabelled floating bars [SWD-wf].
- **Build:** SVG `<rect>`s at precomputed y (or absolutely positioned `div`s). Connectors as `<line>`s.
- **Sources:** [SWD-wf], [VV] flow/part-to-whole, [IBCS-SC] for outlined/hatched semantics.

#### 8. Heatmap grid
- **Use:** two categorical dimensions × one value: usage by weekday × hour, interview themes × participants (research readouts), feature × segment adoption. **Avoid:** when exact values matter (use a table) or more than ~12 × 10 cells.
- **Anatomy:** cells 56–72 px square with 4 px white gaps. Row labels 28 px right-aligned at left, column labels 24 px above. A 5-step key (24 px) top-right or below.
- **Minimal rules:** one-hue ramp of the accent in 4–5 solid tints, light = low, dark = high [DW-col]. Values inside cells only if 28 px fits. Use text colour that holds contrast on dark cells.
- **Mistakes:** rainbow scale [DW-col]; diverging palette for one-directional data; unsorted rows (sort by row total or cluster) [D2V heatmap].
- **Build:** CSS flex-wrap of fixed-size `div`s (pure HTML) or an SVG `<rect>` grid.
- **Sources:** [DW-col], [D2V heatmap], [DW-table] (heatmap columns in tables).

#### 9. Table with highlighted row (and feature matrix)
- **Use:** lookup of precise values, rankings, "us vs alternatives" with words. **Avoid:** more than 8 rows × 5 columns on a slide (move the rest to the appendix); a table where the point is a pattern (chart it).
- **Anatomy:** row height 72 px (8 rows + header fit 648). Header 24 px `--ink-3`, sentence case. Body 28–32 px. First column ~35–40% of width. Hairline row dividers 2 px `--rule`, no vertical lines.
- **Minimal rules:** text left, numbers right, tabular figures, the same decimals per column. Sort by the most important column, not alphabetically [DW-table]. Highlight one row with a pale accent-tint background or a 6 px accent rule at the left plus weight 600 [DW-table]. No zebra stripes for short tables [DW-table]. Inline mini-bars in one column only [DW-table]. Feature matrix: words ("Minutes", "Weeks") over check marks.
- **Mistakes:** check/cross grids that are all ticks for us (reads as a strawman); boxed cells; centred numbers.
- **Build:** CSS grid or flex rows (`display:grid; grid-template-columns:…`). `<table>` works too.
- **Sources:** [DW-table], [SWD] table, [FEW-snt] (unverified), [VER].

### B. Comparisons

#### 10. Before / after and us vs them
- **Use:** status quo vs with-us, manual vs automated, competitor approach vs ours (2 columns). **Avoid:** more than 2 sides (use a table); claims you can't back up.
- **Anatomy:** two 816 px columns with a 48 px gutter, or a 2 px `--rule` centre divider. Column headers 40 px ("Today" / "With us"). 3–5 parallel rows at identical y positions, 32 px. Optional big number per side (96 px) for the headline difference ("3 weeks" → "2 days").
- **Minimal rules:** the left side in `--ink-2`, the right side in ink, the accent only on the key difference. Rows must pair up line by line.
- **Mistakes:** red ✗ / green ✓ columns; the left side set in grey so light it reads as a strawman; unequal row counts.
- **Build:** flex row of two flex columns, or a CSS grid with `grid-template-columns:1fr 1fr`.
- **Sources:** [ZEL] (item comparison), [VER] (no "favourable = green").

#### 11. 2 × 2 matrix
- **Use:** a real trade-off with two independent axes that the buyer cares about (e.g. "accuracy needed" × "data sensitivity"). **Avoid:** axes picked so we land top-right with nobody near us. Investors read that as a cliché (unverified, common advice).
- **Anatomy:** square plot 640–672 px at left (cols 1–7), explanation at right (cols 8–12). Two crossing 2 px `--rule` lines, or an outer L-axis. Axis titles 24–28 px at the ends, written as words ("Low → High"). Quadrant names 28 px `--ink-3` in the corners. Items as 16 px dots + 28 px labels.
- **Minimal rules:** quadrant fills off; the accent on one quadrant name or our dot only.
- **Mistakes:** arrowheads on both ends of both axes; logos instead of names; filled coloured quadrants.
- **Build:** HTML absolute for labels and dots, a tiny SVG (or 2 `div`s with borders) for the cross.
- **Sources:** (no primary source found, house practice) · [DUA] "use proximity, scale, and links".

#### 12. Positioning map (competitive landscape)
- **Use:** 5–12 named alternatives on two continuous dimensions. **Avoid:** made-up precision; more than ~12 points (use a table).
- **Anatomy:** plot 1000 × 600 px, labels sit beside dots (28 px), axis titles at the axis ends (24–28 px). Our dot 20 px accent, the others 14 px `--ink-2`.
- **Minimal rules:** no quadrant names (that makes it a 2 × 2); no gridlines; an honest source line for how positions were judged.
- **Mistakes:** logo soup; overlapping labels; bubble sizes with no key (size by area, not radius [D2V radius_or_area]).
- **Build:** absolute HTML dots and labels over a 2-line SVG axis.
- **Sources:** [VV] correlation (scatter), [D2V overplotting, radius_or_area].

### C. Flows and processes

#### 13. Three- to five-step process
- **Use:** how it works, pilot plan, method. **Avoid:** more than 5 steps (group them); steps that are actually parallel (use a feature grid); a cycle drawn as a line (or a line drawn as a cycle).
- **Anatomy:** a row of equal columns: 3 × 528, 4 × 384, or 5 × ~298 px. Step number 28 px (`01`) in `--ink-3`, title 40 px, description 28 px (≤ 3 lines). A 2 px `--rule` line runs along the top with 12 px dots at each step, or a 3 px arrow between columns.
- **Minimal rules:** accent only on the step our product owns or the current step. Verbs first in titles.
- **Mistakes:** chevron-shaped filled boxes; icons per step; steps with unequal text lengths that break the row.
- **Build:** flex row. Connector line = absolutely positioned 2 px `div` or one SVG `<line>`.
- **Sources:** [DUA] (Flow), [MER] flowchart direction LR, [SWD] flowchart.

#### 14. Cycle / loop (flywheel)
- **Use:** only when the last step truly feeds the first (data flywheel, continuous evaluation). **Avoid:** linear processes dressed as loops; more than 5 nodes.
- **Anatomy:** 3–5 nodes on a circle of radius 220–260 px centred in the content zone. Node labels 32 px HTML. Arcs 3 px `--ink-3` with ~12° gaps at each node and open arrowheads. An optional centre label 40 px ("Evaluation loop"). The explanation column at right if needed.
- **Minimal rules:** arrows all run clockwise; one accent on the node where our product adds value.
- **Mistakes:** circular arrows drawn as heavy rings; nodes in coloured circles; text curved along the path.
- **Build:** SVG `<path d="M… A r r 0 0 1 …">` arcs with `marker-end`. Node positions `(cx + r·sin θ, cy − r·cos θ)`.
- **Sources:** [DUA] (circular flow), [VV] flow.

#### 15. Funnel
- **Use:** conversion between sequential stages (sign-up → active → paid; pipeline). **Avoid:** trapezoid "funnel" shapes, which encode by area and width with no axis [D2V area_hard].
- **Anatomy:** 4–6 horizontal bars, 56 px tall, left-aligned (or centred), length ∝ count. Stage label 28 px left, count 28 px at the bar end, step conversion (e.g. "42%") 24 px `--ink-3` in the 24 px gap between bars.
- **Minimal rules:** the accent on the stage with the biggest drop, or the one the slide is about. Zero-based lengths.
- **Mistakes:** 3D cones; colour per stage; percentages of the first stage mixed with step conversions without saying which.
- **Build:** pure HTML flex column of bars (width in %).
- **Sources:** [D2V area_hard], [VV] magnitude, [ZEL].

#### 16. Swimlane
- **Use:** who does what in a pilot or onboarding (customer IT · our product · end users), hand-offs. **Avoid:** more than 4 lanes or ~10 steps; when there's only one actor.
- **Anatomy:** lanes 140–168 px tall separated by 2 px `--rule` lines (no filled bands). Lane label column 240 px, 28 px. Steps as text boxes 200–240 × 72 px with a 2 px `--rule` border (or text only). Arrows 3 px cross lanes at hand-offs. A time or phase header 24 px across the top.
- **Minimal rules:** flow left to right; steps sit on a shared column grid; the accent on our lane label or the hand-off that matters.
- **Mistakes:** alternating grey lane fills; diagonal arrows (use right angles) [AWS].
- **Build:** absolute HTML boxes + SVG orthogonal connectors (`M x y H x2 V y2`).
- **Sources:** [AWS] (straight lines and right angles), [MER] subgraphs.

#### 17. Sequence diagram
- **Use:** request/response between 3–5 systems (agent ↔ tool ↔ customer API), for technical audiences. **Avoid:** more than 5 participants or ~8 messages; non-technical rooms (use the step process).
- **Anatomy:** participant names 28–32 px across the top, spaced ~336 px. Lifelines 2 px `--rule` vertical. Messages: horizontal 3 px arrows at 64–72 px vertical pitch, label 24–28 px above each arrow. Replies dashed. Optional step numbers 24 px.
- **Minimal rules:** skip activation bars and frames unless needed. One accent on the message that matters (e.g. the redaction step). Solid = call, dashed = reply is a convention, not Mermaid's spec [MER-seq].
- **Mistakes:** participant boxes as heavy filled rectangles; arrows labelled with function names nobody in the room knows (C4: labels state intent) [C4].
- **Build:** SVG lines + `marker-end`, HTML labels. Lifelines as 2 px absolutely positioned `div`s also work.
- **Sources:** [MER-seq], [C4] (dynamic diagrams, labelled relationships).

#### 18. Decision tree
- **Use:** routing logic (when the agent escalates to a human), eligibility, "which plan fits". **Avoid:** more than 3 levels or 8 leaves.
- **Anatomy:** left to right. Level x positions ≈ 120 / 620 / 1120, leaves ending at 1800. Questions as text 32 px (no diamonds), branch labels ("yes", "no") 24 px on the connector. Elbow connectors 2–3 px. Outcomes 28–32 px at the right edge.
- **Minimal rules:** the accent traces one recommended or most-common path. All other paths `--ink-3`.
- **Mistakes:** flowchart diamonds everywhere; unequal level spacing; crossing lines.
- **Build:** absolute HTML nodes + SVG `<path>` elbows.
- **Sources:** [MER] (diamond = decision, as a convention we deliberately drop), [AWS] right angles.

#### 19. Journey map
- **Use:** research readouts and discovery: a buyer's or user's stages, with pains and the moment our product changes. **Avoid:** imagined journeys with no research behind them; more than 6 stages.
- **Anatomy:** row-label column 240 px. 4–6 stage columns across ~1440 px. Rows: Doing · Thinking · Pain · Opportunity, ~120–140 px each, 24–28 px text. An optional emotion line (3 px SVG polyline) across the top row.
- **Minimal rules:** hairline row dividers, no cell boxes. The accent marks a single column (the moment that matters). Quotes from interviews in `--ink-2` italics.
- **Mistakes:** emoji faces for emotion; every cell filled with text; colour per stage.
- **Build:** CSS grid. The emotion line is an SVG overlay sharing the grid width.
- **Sources:** (no primary source found, house practice) · [DUA] (Flow).

### D. Structure and architecture

#### 20. Layered stack (architecture)
- **Use:** where our product sits in the customer's stack (data → model → agent → workflow → user), platform layers. **Avoid:** when the point is data flow between parts (use a system boundary diagram).
- **Anatomy:** 3–6 full-width layers, 96–112 px tall, 16 px gaps. Layer name 32 px in a 360 px left column. Contents as plain text items 28 px separated by 32 px gaps (not pills [VER]). Our layer gets a 6 px accent left rule (or a pale accent-tint background) and ink text. Other layers have `--rule` borders and `--ink-2` text.
- **Minimal rules:** order top = closest to the user. Same height per layer. No vendor logos unless uploaded and necessary.
- **Mistakes:** isometric 3D stacks; every layer a different colour; layers with arrows that mean nothing.
- **Build:** flex column of flex rows. Pure HTML.
- **Sources:** [DUA] (Stack), [C4] (titles, keys, element types), [VER].

#### 21. System boundary / context diagram (C4 level 1–2)
- **Use:** security and IT reviews, "what touches our data", integrations. **Avoid:** more than ~9 boxes; mixing abstraction levels in one picture [C4].
- **Anatomy:** a customer boundary as a 2 px dashed `--ink-3` box (~1100 × 560) with its name 24 px at the top-left inside. Our system or containers inside: boxes 280 × 120, name 32 px, type and technology 24 px `--ink-3` ("Container · Python"). People at the left, external systems at the right. Arrows 3 px with labels 24–28 px stating intent and protocol ("Sends redacted notes · HTTPS").
- **Minimal rules (C4):** a title that states diagram type and scope; every element has a name, type and short description; every arrow is one-directional and labelled with intent (not "uses"); technology on container links; a key whenever shapes, colours or line styles carry meaning; check it in black and white [C4]. Lines straight or at right angles; number steps left to right / top to bottom when order matters [AWS].
- **Mistakes:** unlabelled arrows; double-headed arrows; vendor icon soup; boundaries drawn as filled panels.
- **Build:** absolute HTML boxes (`border:2px solid`), boundary `border:2px dashed`, SVG connectors with markers.
- **Sources:** [C4] notation + checklist, [AWS] groups/arrows/callouts. Stripe/Vercel/Linear: §7 (unverified).

### E. Time

#### 22. Timeline
- **Use:** history, milestones, pilot schedule. **Avoid:** more than 7 events; uneven spacing that implies time when it doesn't (say "not to scale" or space evenly and label clearly).
- **Anatomy:** a 2 px `--ink-3` axis across 1680 px at y ≈ 620. 12 px dots at events. Date 24 px `--ink-3` and event 28–32 px, alternating above and below if crowded. "Now" in accent (dot 16 px + label).
- **Minimal rules:** proportional spacing if durations matter. Past in ink, future in `--ink-2` or dashed axis.
- **Mistakes:** arrowhead axis with ribbons; an icon per milestone; dates in mixed formats.
- **Build:** HTML absolute dots and labels over a 2 px `div` axis. No SVG needed.
- **Sources:** [VV] change over time (Priestley timeline), [SWD] Gantt (related).

#### 23. Roadmap: now / next / later
- **Use:** customer meetings and team updates without committing to dates. **Avoid:** dated quarters you can't keep; more than ~5 items per column.
- **Anatomy:** 3 columns × 528 px. Headers 40 px ("Now", "Next", "Later") on a 2 px rule. Items 28–32 px with 16 px gaps, an optional one-line detail 24 px `--ink-3`.
- **Minimal rules:** the accent on "Now" (the header rule or the dot). Confidence fades left to right (ink → `--ink-2` → `--ink-3`). Items are outcomes, not ticket names.
- **Mistakes:** coloured cards per item; status pills; a "Later" column longer than "Now".
- **Build:** flex row of 3 flex columns.
- **Sources:** (no primary source found, house practice).

#### 24. Gantt-lite
- **Use:** pilot or implementation plan with 3–8 workstreams over weeks or months. **Avoid:** dependency arrows; more than 8 rows; day-level detail.
- **Anatomy:** row labels 28 px in a 360 px left column. Time header 24 px `--ink-3` across ~1320 px. Bars 24–32 px tall, row pitch 64 px, in `--context`. The critical or current workstream in accent. Milestones as 4 × 40 px ticks. "Today" as a 2 px `--ink-3` vertical line with a 24 px label.
- **Minimal rules:** gridlines only at month boundaries, 2 px `--rule`. Bar ends square or at the template radius. No percent-complete fills.
- **Mistakes:** colour by owner; text inside short bars.
- **Build:** CSS grid columns per week, bars as `div`s with `grid-column: 3 / 9`. Pure HTML.
- **Sources:** [SWD] Gantt chart page.

### F. Relationships

#### 25. Hub-and-spoke
- **Use:** one system that connects several others (our product between EHR, CRM, docs, email), or a platform with modules. **Avoid:** when spoke-to-spoke links matter (network); "we integrate with everything" filler.
- **Anatomy:** hub 200–240 px circle or box at the centre of the content zone, name 40 px. 4–8 spokes, length ~260 px, 2–3 px `--ink-3`. Spoke labels 28–32 px outside the spoke ends. Optional 24 px edge labels.
- **Minimal rules:** even angles (360/n). Accent on the hub only. Labels never on top of lines.
- **Mistakes:** logos on every spoke; arrowheads both ways; spokes of different weights without a key.
- **Build:** SVG `<line>`s from the hub centre, HTML hub and labels at `(cx + r·cos θ, cy + r·sin θ)`.
- **Sources:** [DUA] (Network), [C4] (label relationships).

#### 26. Venn (2 and 3 sets)
- **Use:** a real intersection ("teams who need X **and** Y = our wedge"). **Avoid:** quantitative claims (areas aren't to scale unless you say so); more than 3 sets.
- **Anatomy:** 2 sets: circles r 260–280 px, centres ~360 px apart (lens ~200 px wide). 3 sets: r ~220 px in a triangle. Outlines 3 px `--ink-3`, no fills. Set labels 32 px outside the circles. The intersection is filled with pale accent tint (via `clipPath`) with its label 32 px inside.
- **Minimal rules:** only the intersection gets the accent; everything else ink or grey.
- **Mistakes:** translucent overlapping fills (muddy blends, §2.8); labels inside lenses too small to fit 28 px.
- **Build:** SVG circles + `<clipPath>` for the intersection fill. HTML labels.
- **Sources:** [VV] part-to-whole (Venn), [D2V area_hard].

#### 27. Nested circles: TAM / SAM / SOM
- **Use:** market size in pitch decks, always with the arithmetic. **Avoid:** circles as the only evidence. Area perception is poor: Few's test finds people guess a 16× area anywhere from 6× to 50× [FEW-pie].
- **Anatomy:** bottom-aligned (or concentric) circles at left, cols 1–6. Values right-aligned in a column at right: label 28 px + value 56–72 px + method line 24 px ("12k hospitals × $40k ACV").
- **Minimal rules:** either area-proportional (radius ∝ √value) [D2V radius_or_area] or labelled "not to scale". The accent on SOM (what we'll actually win). Show the bottom-up formula.
- **Mistakes:** top-down "1% of a huge market"; radius proportional to value (exaggerates); sources missing.
- **Alternative:** three horizontal bars (length ∝ value) or an equation line, both more honest.
- **Build:** SVG circles. Values as HTML.
- **Sources:** [FEW-pie], [D2V radius_or_area, area_hard].

### G. People

#### 28. Team cards (org)
- **Use:** pitch (3 founders), customer meetings (who you'll work with). **Avoid:** org charts for teams under ~10; long bios.
- **Anatomy:** 3 × 528 px columns. Photo 200–240 px (uploaded image, square or circle, consistent crop and greyscale or colour, not mixed). Name 40 px, role 28 px `--ink-2`, 2–3 proof lines 28 px ("Ex-…", "PhD …").
- **Minimal rules:** proof over adjectives. No logos unless uploaded. No card borders: the photo and alignment do the grouping. The accent appears once, or not at all.
- **Mistakes:** inconsistent photo backgrounds; hobby lines; four different text lengths.
- **Build:** flex row of flex columns. `<img>` with `object-fit:cover`.
- **Sources:** (no primary source found, house practice). Check that headshots count as allowed uploads (§7).

#### 29. Quote / testimonial and pull quote
- **Use:** design-partner voice, research findings in participants' words. **Avoid:** quotes over ~30 words; anonymous praise with no role.
- **Anatomy:** **testimonial**: quote 48–64 px (≤ 4 lines, max width ~1440), attribution 28 px name + 24 px role, company at 48 px below. **Pull quote** in a research slide: 40 px at the right in cols 8–12, beside the evidence. **Quote wall**: 2–3 short quotes × 528 px at 32 px.
- **Minimal rules:** typographic quotation marks at text size (no giant decorative quote glyphs). The accent on the 3–6 words that matter, or on a 4 px left rule. Hang the opening quote mark outside the text edge.
- **Mistakes:** italics for whole paragraphs; logos larger than the quote; edited quotes passed off as verbatim.
- **Build:** HTML only. `text-indent:-0.4em` to hang the opening mark.
- **Sources:** (no primary source found, house practice).

### H. Product

#### 30. Screenshot with callouts (and frame alternatives)
- **Use:** demos, customer meetings, "what the user sees". **Avoid:** full-screen screenshots where key UI text is unreadable; fake or mocked UI presented as real [VER].
- **Anatomy:** screenshot 1040–1200 px wide at left (cols 1–8), cropped to the relevant region and shown at ≥ 1:1. Callout column cols 9–12: numbered items (number 28 px accent, text 28 px). Leader lines 2 px accent from an 8 px dot on the exact UI element to the callout. Or numbered 40 px circular markers on the image with text in the column. At most 4–5 callouts.
- **Minimal rules:** number in reading order (left to right, top to bottom, or clockwise); keep callouts one size and style; don't stretch them [AWS]. **Frames:** no device mockups. Use a 2 px `--rule` border + the product's own radius; for "web" context, a 24 px `--ink-3` URL line above the image; for phone, a 2 px rounded outline (radius ~48) around a 390-wide screenshot scaled up, with no notch drawing.
- **Mistakes:** drop shadows to "lift" the image; arrows crossing the UI; blurred-out regions.
- **Build:** `<img>` (uploaded) + absolute HTML markers + one SVG layer for leader lines, all in one wrapper.
- **Sources:** [AWS] numbered callouts, [VER] (supplied screenshots only when they're evidence).

#### 31. Feature grid (icon-free)
- **Use:** 4–6 capabilities or benefits of equal weight. **Avoid:** more than 6; features that are steps (use the process); icons as decoration [VER].
- **Anatomy:** 3 × 2 grid of 528 × ~300 px cells (or 2 × 2 of 816). Each cell: 2 px `--rule` top line, 24 px gap, title 32–40 px, description 28 px (≤ 3 lines). Optional index 24 px `--ink-3` (`01`).
- **Minimal rules:** accent on one cell's top rule (the differentiator) or none. No boxes, no icons, no tiles.
- **Mistakes:** filler features to complete the grid; unequal description lengths.
- **Build:** CSS grid `grid-template-columns:repeat(3,1fr); gap:48px`.
- **Sources:** [VER] (no icons in coloured tiles; spacing before borders).

#### 32. Pricing tiers
- **Use:** customer meetings and proposals, 2–3 options. **Avoid:** more than 3 tiers on a slide; full feature comparison tables on the same slide.
- **Anatomy:** 3 × 528 px columns. Tier name 40 px, price 72–96 px tabular + unit 28 px ("/ seat / month"), one-line "for whom" 28 px `--ink-2`, 4–6 included items 28 px separated by 16 px. Recommended tier: 6 px accent top rule + the word "Recommended" in 24 px accent text (no pill). Other tiers: 2 px `--rule` top rule.
- **Minimal rules:** align prices on one baseline; "Everything in Starter, plus …" to avoid repetition.
- **Mistakes:** strike-through "discount" prices; check-mark lists 15 long.
- **Build:** flex row, `align-items:stretch`.
- **Sources:** (no primary source found, house practice).

### I. Text

#### 33. Statement slide
- **Use:** the thesis, a finding, a transition, the ask. **Avoid:** two ideas on one slide; a claim with a number and no source.
- **Anatomy:** one sentence ≤ 15 words, 88–120 px, left-aligned at x 120, max width ~1440 px (≤ 3 lines), optical centre slightly above the middle (top of text ~y 340). An optional supporting line 32–40 px `--ink-2` 48 px below. Source line if needed.
- **Minimal rules:** the accent on 1–3 words at most, or none. No kicker, no image.
- **Mistakes:** centred multi-line text with ragged lines; quotation marks around your own claim.
- **Build:** one `div`. Use `text-wrap:balance` if the renderer supports it (unverified for this tool).
- **Sources:** [SWD] (simple text), [VER] (one focal relationship).

#### 34. Agenda, progress indicator and section divider
- **Use:** decks over ~12 slides, workshops, customer meetings with set topics. **Avoid:** agendas in 10-slide pitches.
- **Anatomy:** **agenda**: 3–6 items, number 28 px `--ink-3` + title 40–56 px, 32 px row gaps, left column. **Section divider**: the same agenda with the current item in ink (or accent) and the others in `--ink-3`, or the section number + title 96–120 px alone. **Progress indicator**: 4–6 segments of 48 × 4 px with 8 px gaps, at the top-right of the margin (y 56). The current one is accent, the others `--rule`.
- **Minimal rules:** the indicator never competes with the title and stays the same on every slide.
- **Mistakes:** page-wide progress bars; section dividers with stock photos.
- **Build:** HTML only.
- **Sources:** (no primary source found, house practice).

#### 35. Checklist / requirements
- **Use:** pilot success criteria, security requirements met, "Done when", next steps with owners. **Avoid:** more than 8 items; vague items ("improve accuracy").
- **Anatomy:** rows 64–72 px: status mark 28 px (a drawn 3 px SVG check, an open 28 px square, or the word "Done"/"Open"), item 32 px, owner/date 24–28 px `--ink-3` right-aligned. Hairline dividers.
- **Minimal rules:** done items in ink, open items in `--ink-2`. The accent on the one item that needs the audience's action.
- **Mistakes:** emoji checkboxes; green ticks + red crosses; checklists that are really feature lists.
- **Build:** flex rows. Checks as a 28 × 28 inline SVG `<path d="M5 14 L11 20 L23 8">`.
- **Sources:** (no primary source found, house practice).

---

## 4. Chart styling defaults for slides

**Titles and text**
- Slide title = the takeaway in a sentence ("Pilot sites cut review time by 61%"), not the chart's topic [ZEL] [SWD] (book lessons, unverified edition detail).
- Subtitle states the measure, unit and period: "Median review time, minutes per case, Jun–Sep 2026", 32 px `--ink-2`.
- In charts, put units in the subtitle or on the top tick, not in axis titles [DW-axis].

**Axes and gridlines**
- Bars and columns: zero baseline 2 px `--ink-3`, always. Never truncate [ECON] [SWD-wf].
- Horizontal bars: no value axis, no gridlines, direct values at bar ends.
- Columns and lines: horizontal gridlines only, 3–5 of them (about 5 ticks per axis [WB]), 2 px `--rule`, behind the data [ONS]. No vertical gridlines except scatter/positioning maps. No y-axis line [ECON] (secondary).
- Tick labels 24 px `--ink-3`, never rotated [DW-ticks]. Y-tick labels sit at the left end of each gridline, just above it, or right-aligned in a 96–120 px column. Round ticks (0, 50, 100), unit on the top tick only.
- Time axes: 4–7 labels, abbreviated (Jan, Apr, Jul, Oct, with '25 on the first and year changes).
- Line charts may start above zero; say so with a zero line or note when values approach zero [DW-line].

**Label sizes at 1920 × 1080**

| Element | Size | Colour |
|---|---|---|
| Tick labels, source line, notes, keys | 24 | `--ink-3` |
| Data and direct labels | 28 | `--ink-2` or series colour |
| Focus label (the number the title cites) | 32–40, weight 600 | accent |
| Annotation | 24–28 | `--ink-2`, 2 px leader in `--ink-3` only if needed |

For scale: Observable Plot defaults to 10 px type on a 640 px-wide chart [OBS]. Scaled 3× to 1920 that is 30 px, so a full-width slide chart needs about 28–30 px labels to look as balanced as a screen chart.

**Mark sizes**: bar 32–48 px thick with gaps 50–70% of the bar · columns 48–96 px · focus line 6 px, context 3 px · points 12–16 px, only where labelled · sparkline 3 px · bullet featured bar ⅓ of its track [FEW-bullet].

**How many categories before it stops working (on one slide)**

| Chart | Comfortable | Hard limit | Basis |
|---|---|---|---|
| Horizontal bars | ≤ 8 | 10 | 672 px zone at 64 px pitch (house) |
| Columns | ≤ 8 | 12 | label width at 24 px (house); time series beyond that → line |
| Lines | 1 accent + ≤ 3 labelled | ~8 incl. grey context | [DW-line] gives no max; [D2V spaghetti] |
| Pie/donut slices | ≤ 3 | 5 | [DW-pie] says 5 (Academy says 4) |
| Stacked segments | ≤ 4 | 5–6 | [DW-stack]; Academy "five or six" |
| Stacked columns (totals) | ≤ 6 | ~10 | [DW-stack] |
| Distinct hues anywhere | 1 accent | 7 | [DW-col] max 7; our taste: 1 |
| Bullet qualitative ranges | 3 | 5 | [FEW-bullet] |
| Table | 6 rows × 4 cols | 8 × 5 | 72 px rows (house); [DW-table] few columns |
| Heatmap | 7 × 12 | 10 × 12 | 56–72 px cells (house) |
| Scatter/positioning points labelled | ≤ 8 | 12 | label collisions (house) |
| Process steps / roadmap items | 3–5 | 5 / 5 per column | (house) |

**Colour rules**
- **One series:** every mark is ink or `--context`. The one mark the title talks about takes the accent. If no single mark is the point, use ink and no accent (don't colour all bars accent).
- **Several series:** the focus series in accent, all others in `--context` grey, distinguished by direct labels, not hue [DW-emph] [DW-col]. If two non-focus series must differ, use ink vs grey, or solid vs dashed. Grey "other/don't know" categories last [DW-emph].
- **Lighter versions of the accent** (solid tints) for the same category at lower priority; a new hue only for a genuinely different category [DW-emph].
- **Sequential data:** one-hue ramp from light (low) to dark (high), 4–5 steps [DW-col]. No rainbow [D2V] [DW-col].
- **Good/bad:** don't colour a bar because it's favourable [VER]. If a slide really is about variance, use the IBCS convention (green = positive, red = negative; secondary sources) as that slide's colour pair. That replaces the accent, it doesn't add to it. Add +/− signs for colour-blind readers [DW-col].
- **Actual vs plan vs forecast:** IBCS notation: actual solid, plan outlined, forecast hatched and outlined. Earlier periods are lighter grey ("the later the darker") [IBCS-SC].
- **Consistency:** a category keeps its colour on every slide of the deck [D2V consistency] [DW-col].

**Direct labelling**
- Label lines at their right end, bars at their end, segments above themselves. No legend if labels fit [VER] [DW-line]. A legend (24 px, inline above the plot, in series order) only for 3+ series that can't be labelled, e.g. small multiples.
- Label only what the story needs: endpoints, the focus value, the max/min if discussed.

**Number formatting** (pick once per deck; house choices below)
- Round on slides: 2–3 significant figures ($1.2M, 38%, 4.1×). Full precision in appendix tables. Short forms ("1.3m" rather than "1,300,000") read faster [DW-table].
- Suffixes: k, M, B with no space ("$480M", "12k"). The Economist writes "m/bn" (unverified for charts); choose one.
- Same decimals within a chart. Tabular, right-aligned numbers in tables.
- Use the true minus sign "−" (U+2212), the en dash for ranges ("3–5 weeks"), and "×" (U+00D7) for multiples.
- Percent vs percentage points: "+4 pp" when rates change; "+12%" for relative change. Say which.
- Dates: "Q3 2026", "Oct 2026", "22 Oct 2026". Never 10/22/26.

**Source line** (every chart and every numeric claim)
- Bottom-left at x 120, baseline y ≈ 1008, 24 px `--ink-3`, one line (two at most).
- Format: `Note: <definition or caveat>. Source: <who>, <what>, <period>; n = <count>.` E.g. "Source: our product pilot logs, three hospitals, Jun–Sep 2026; n = 1,240 cases."
- Own data says so ("our product internal data"). Projections say "Projection" in the subtitle and the source.

**Never**: dual axes [DW-dual]; 3D [D2V 3d]; rotated labels; chart borders or panels around charts [VER]; gradient fills; shadows; legends when labels fit; more than one accent; pies above 5 slices; area-only encodings without numbers [FEW-pie]; unsorted bars without a reason [D2V order].

---

## 5. The 12 components that matter most (pre-seed / seed B2B)

Ranked by how often they carry a decisive slide across pitch, customer meeting, demo, research readout and team update (house judgement, not a source).

1. **Statement slide** — every deck turns on 3–5 sentences; these slides carry the argument in all five deck types.
2. **Big-number KPI row** — traction, pilot results and research toplines are what audiences remember and quote.
3. **Three- to five-step process** — "how it works" and "pilot plan" appear in pitch, sales and demo decks alike.
4. **Screenshot with callouts** — demos and customer meetings need the real product, made readable.
5. **Before / after (us vs status quo)** — B2B buyers buy the change in their workflow; this shows it in one look.
6. **Bar/line chart with one accent** — the default proof for traction, accuracy and time saved; one template covers both.
7. **System boundary / context diagram** — security and IT reviewers ask "what touches our data" in every enterprise deal.
8. **Quote / testimonial** — design-partner words are a pre-revenue company's strongest evidence.
9. **Roadmap now/next/later (plus Gantt-lite for pilots)** — customer and team updates need commitments without false dates.
10. **Comparison table with highlighted row** — competition and alternatives without the 2 × 2 cliché.
11. **Team cards** — investors back three founders; proof lines over bios.
12. **TAM/SAM/SOM as bars plus arithmetic** — required in pitch decks; the bottom-up version is the credible one.

Runners-up: layered stack (technical buyers), heatmap (research readouts), checklist (pilot success criteria), journey map (discovery readouts), 2 × 2 (only with honest axes).

---

## 6. Sources

Checked 22 Oct 2026 unless noted. "Fetched" means the page or file was read. "Snippet" means only search results were seen.

**Chart choice and caveats**
- **[VV]** FT Visual Vocabulary (9 relationships: deviation, correlation, ranking, distribution, change over time, part-to-whole, magnitude, spatial, flow). Fetched. https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary · poster https://github.com/Financial-Times/chart-doctor/blob/main/visual-vocabulary/Visual-vocabulary-en.pdf · interactive https://ft-interactive.github.io/visual-vocabulary/
- **[ZEL]** Gene Zelazny, *Say It With Charts* (4th ed., McGraw-Hill 2001): message → comparison → chart; five comparisons. Snippet of the O'Reilly chapter (from *The Say It With Charts Complete Toolkit*, 2007): https://www.oreilly.com/library/view/the-say-it/9780071474702/ch02.html
- **[D2V]** data-to-viz caveats (37 items: order data, spaghetti, pie, dual axes, 3D, stacking, area, radius vs area, annotation, consistency…). Fetched. https://www.data-to-viz.com/caveats.html. Sub-pages follow `https://www.data-to-viz.com/caveat/<name>.html` (e.g. `spaghetti`, `radius_or_area`).

**Business reporting notation**
- **[IBCS]** IBCS Standards 2.0, approved 11 Jun 2026, Notation part aligned with ISO 24896 "Notation for business reporting". Page fetched, full text not read (member PDF). https://www.ibcs.com/ibcs-version-2-0/
- **[IBCS-SC]** Hichert & Faisst, scenario notation proposal (2018): "AC solid, FC hatched and bordered, PL bordered", "the later the darker", "solid lighter gray for comparison to earlier time". Fetched (PDF text). https://www.ibcs.com/wp-content/uploads/2018/01/UN-3.2_More-scenarios_2018-01-23_rh.pdf

**Storytelling and practice**
- **[SWD]** Cole Nussbaumer Knaflic, storytelling with data: books https://www.storytellingwithdata.com/books · chart guide (22 types) https://www.storytellingwithdata.com/chart-guide. Both fetched.
- **[SWD-slope]** Mike Cisneros, "what is a slopegraph?" (2020). Fetched. https://www.storytellingwithdata.com/blog/2020/7/27/what-is-a-slopegraph
- **[SWD-wf]** Mike Cisneros, "what is a waterfall?" (2020). Fetched. https://www.storytellingwithdata.com/blog/2020/11/16/what-is-a-waterfall
- **[DUA]** Duarte Diagrammer taxonomy (Flow, Join, Segment, Network, Stack; "Use proximity, scale, and links to clarify data and relationships"). Fetched. https://www.duarte.com/duartes-diagrammer-4000-diagrams-at-your-fingertips-for-99-cents-each/ · *slide:ology* (2008) diagram chapter not read.

**Newsroom style**
- **[ECON]** Sarah Leo, "Mistakes, we've drawn a few" (The Economist, 2019): truncated axes, dual axes, charts that fail to make a point. https://medium.economist.com/mistakes-weve-drawn-a-few-8cdd8a42d368 (blocked; read via https://flowingdata.com/2019/03/29/remaking-charts-from-the-economist-by-a-journalist-at-the-economist). The Economist chart style guide PDF, https://design-system.economist.com/documents/CHARTstyleguide_20170505.pdf, now returns an HTML shell: not retrievable.
- **[DW-col]** Lisa Charlotte Muth, "What to consider when choosing colors for data visualization" (2018): ≤ 7 colours, grey "the most important color", light = low, no rainbow, contrast. Fetched. https://www.datawrapper.de/blog/colors
- **[DW-emph]** Muth, "Emphasize what you want readers to see with color" (2023): grey everything, then colour the important category; tints of one hue for lower priority. Fetched. https://www.datawrapper.de/blog/emphasize-with-color-in-data-visualizations
- **[DW-line]** Muth, "What to consider when creating line charts" (2018). Fetched. https://www.datawrapper.de/blog/line-charts
- **[DW-pie]** Muth, pie charts (2018): ≤ 5 values; two values → text. Fetched. https://www.datawrapper.de/blog/pie-charts · Academy (says 4): https://www.datawrapper.de/academy/what-to-consider-when-creating-a-pie-chart (snippet)
- **[DW-stack]** Muth, stacked column charts (2018). Fetched. https://www.datawrapper.de/blog/stacked-column-charts
- **[DW-table]** Muth, "What to consider when creating tables" (2019). Fetched. https://www.datawrapper.de/blog/guide-what-to-consider-when-creating-tables
- **[DW-axis]** Why many Datawrapper charts have no axis titles. Fetched. https://www.datawrapper.de/academy/why-datawrapper-does-not-include-axis-labels-for-many-charts
- **[DW-ticks]** New axis ticks, no rotated labels (snippet). https://www.datawrapper.de/blog/new-axis-ticks
- **[DW-sm]** Small multiple line charts (snippet). https://www.datawrapper.de/blog/small-multiple-line-charts
- **[DW-dual]** Dual axes (linked from data-to-viz; not fetched). https://blog.datawrapper.de/dualaxis/
- **[OBS]** Observable Plot defaults: width 640 (src/dimensions.js), font-size 10, system-ui (src/plot.js). Fetched source. https://github.com/observablehq/plot/tree/main/src
- **[ONS]** UK ONS: gridlines behind data, usually one direction (snippet). https://service-manual.ons.gov.uk/data-visualisation/guidance/axes-and-gridlines
- **[WB]** World Bank data-viz style guide: about 5 ticks per axis, rounded (snippet). https://worldbank.github.io/data-visualization-style-guide/chartelements

**Perception and minimalism**
- **[FEW-pie]** Stephen Few, "Save the Pies for Dessert" (Aug 2007): area and angle judgements; 16× area guessed as 6–50×. Fetched. https://www.perceptualedge.com/articles/visual_business_intelligence/save_the_pies_for_dessert.pdf
- **[FEW-bullet]** Few, Bullet Graph Design Specification: featured bar ⅓ of the track, 2–5 ranges (ideally 3), grey intensities. Fetched. https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf
- **[FEW-snt]** Few, *Show Me the Numbers* (2nd ed. 2012), table design. Not read (unverified).
- **[TUF-spark]** Edward Tufte, "Sparkline theory and practice": word-sized, no frames, grey normal band, ~45°. Fetched. https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/
- **[TUF-EI]** Tufte, *Envisioning Information* (1990), small multiples, layering and separation. Book page fetched. https://www.edwardtufte.com/book/envisioning-information/ · the data-ink ratio is from *The Visual Display of Quantitative Information* (1983), from memory (unverified).

**Diagrams and architecture**
- **[C4]** C4 model notation and review checklist: titles with type and scope, keys, element types, labelled one-way arrows, technology, black-and-white check. Fetched. https://c4model.com/diagrams/notation · https://c4model.com/diagrams/checklist · https://c4model.com/
- **[AWS]** AWS Architecture Icons, Release 24-2026.07.31, PPTx toolkit, slides 13–18. Downloaded and read: groups (nested ≥ .05″ buffer), straight lines and right angles, preset open arrows, 12 pt Arial labels, 2 pt lines / 16 pt type for training diagrams, numbered callouts in reading order. https://aws.amazon.com/architecture/icons/
- **[MER]** Mermaid flowchart shapes (rectangle = process, diamond = decision, cylinder = database, stadium = terminal), LR/TB directions, subgraphs. Fetched. https://mermaid.js.org/syntax/flowchart.html
- **[MER-seq]** Mermaid sequence diagrams: arrow types, notes, loop/alt/opt, autonumber. Fetched. https://mermaid.js.org/syntax/sequenceDiagram.html
- **[EXC]** Excalidraw defaults: stroke widths 1 / 2 / 4 (thin/medium/bold), roughness architect 0 / artist 1 / cartoonist 2, font sizes 16/20/28/36. Fetched source. https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/constants.ts Use "architect" roughness 0 if an Excalidraw sketch is ever pasted in. Its hand-drawn default doesn't fit our taste.
- **[VER]** Vercel `design.md` (Geist report-site spec): "Prefer direct labels to legends", "Design in monochrome", "Do not turn a … longer bar green merely because it is favorable", no icons in coloured tiles, no "dark rounded rectangle around every chart", spacing before borders. Fetched. https://vercel.com/design.md Note: it covers report websites, not architecture diagrams.

**Accessibility**
- **[WCAG-c]** WCAG 2.1 SC 1.4.3 (large text = 18 pt / 14 pt bold, 3:1). https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html (from knowledge, not fetched)
- **[WCAG-nt]** WCAG 2.1 SC 1.4.11 non-text contrast 3:1. https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html (from knowledge, not fetched)

---

## 7. What could not be verified

- **Economist chart style guide**: the 2017 PDF URL no longer serves the PDF, and Medium was blocked. Economist traits (red tag, right-hand y labels, no y-axis line, gridlines kept) come from secondary descriptions only, and nothing in §3–4 rests on them alone.
- **FT chart style guide**: no public FT chart style guide was found beyond the Visual Vocabulary and the chart-doctor repo. FT conventions are not cited as rules.
- **IBCS 2.0 full text** (member PDF, June 2026) not read. Scenario notation is from the 2018 Hichert & Faisst proposal (marked there as "used for several years"). Green/red variance colours are from secondary (vendor) sources.
- **Books not re-read**: Zelazny (five comparisons confirmed by snippets), Knaflic (lessons such as declutter and focus attention, from memory), Tufte *Visual Display* (data-ink ratio), Few *Show Me the Numbers*, Duarte *slide:ology* (only the Diagrammer taxonomy was confirmed).
- **Stripe, Linear, Vercel architecture diagrams**: none publish diagram guidelines that I could find. Observed traits, unverified: Stripe docs use light containers, thin grey connectors, one brand colour for the highlighted path and numbered steps; Vercel uses black and white, mono labels, thin lines and dashed boundaries; Linear marketing art is dark with glows and 3D, which conflicts with our taste. Vercel's `design.md` (report sites) is the only primary source among the three.
- **Datawrapper pie limit**: blog says 5 slices, an Academy page says 4. Snippets only for [DW-ticks], [DW-sm], [ONS], [WB]; [DW-dual] not opened.
- **Observable Plot**: default height and margin values not checked (width and font size were).
- **Common advice, no primary source**: "2 × 2 with us top-right is a cliché"; most pixel sizes, ratios and category limits marked "(house)" are derived for this canvas, not sourced.
- **Tool behaviour to test in the slide tool itself**: whether all `<section>`s share one document (id collisions, §2.7); `text-wrap:balance` support; whether founder headshots count as allowed uploads under "no external images except uploaded screenshots".
