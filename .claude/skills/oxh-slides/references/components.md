# Components: which slide to copy

Every chart, diagram and layout in the five templates, where to find it, and when to use it. Each template's fourth slide (`considerations`) is the short, sourced version of this page for that template's job. A component can move between templates: copy the slide, then swap its colours, faces and sizes for the target template's tokens (`check.py --template <target>` lists what is left to change). The full catalogue with anatomy in pixels, common mistakes and sources is `research-components.md`.

The twelve that matter most for a pre-seed B2B deck, ranked by how often they carry a decisive slide (research-components §5): statement, KPI row, step process, screenshot with callouts, before and after, bar or line chart with one accent, system boundary diagram, quote, now/next/later roadmap, comparison table, team, market bottom-up.

## Numbers

| Component | Copy from | Use when | Rules |
|---|---|---|---|
| One big numeral | `grid/numeral` | One number carries the slide | 220px, caption on the same baseline, once or twice a deck |
| Three findings | `grid/findings`, `midnight/numbers` | Three numbers make the argument together | One in the accent, the rest in ink; a source for each |
| Finding left, chart right | `grid/bars`, `grid/line`, `grid/slope` | A number and the chart that proves it | The number in columns 1 to 4, the chart in 5 to 12 on the plot fill |
| KPI tiles with bullet graphs | `console/metrics` | Measured values against targets | One scale for every tile, target as a tick, only the named tile in the accent |
| Progress meters | `petal/meters` | Progress against goals in a team update | Value in words beside every bar |
| Success criteria | `paper/success` | What a pilot must show | Three figures, how they are measured in the margin |
| Counts beside a plan | `midnight/traction` | Traction beside a plan | Three at most, label in one line |

## Charts

| Component | Copy from | Use when | Rules |
|---|---|---|---|
| Ranked horizontal bars | `grid/bars` | Comparing up to eight categories | Sorted, values at bar ends, no axis, one bar in the accent |
| Columns over time | `petal/bars` | One series over up to twelve periods | Bars on one baseline, the bar the title names in the accent |
| Line chart | `grid/line` | Trends, one focus series and up to three in grey | Horizontal gridlines only, labels at line ends, focus 6px, context 3px |
| Slopegraph | `grid/slope` | Two moments for up to six items | Names and values on both ends, no axes |
| 100% bars | `grid/stacked` | Shares across groups | Fixed segment order, names once above the first bar, at most five segments |
| Waterfall | `grid/waterfall` | How a total builds up step by step | Floating steps, total on the baseline in ink |
| Heatmap | `grid/heatmap` | Two categories against each other | One hue in five steps, a value in every cell |
| Positioning map | `grid/scatter` | Where items sit on two honest axes | Units on both axes, median lines, four labels at most |
| Small multiples | `grid/multiples` | The same chart for four groups | One scale for all, or none |
| Market circles | `midnight/market` | TAM, SAM and SOM for a pitch | The arithmetic written beside them; bottom-up numbers only |

## Comparisons and tables

| Component | Copy from | Use when | Rules |
|---|---|---|---|
| Comparison table | `midnight/table` | Competitors or alternatives | Rows, not a ruled table; our row filled, a sentence under it on "why isn't this a feature" |
| Trade-offs | `console/tradeoffs` | Approaches against properties | Rows, answers in words, not ticks |
| Data table | `grid/table` | Numbers to read across | Flex rows, numbers right-aligned in tabular figures, one tinted row |
| Terms | `paper/terms` | What each side gives | Rows, not a ruled table; five rows, the contract carries the rest |
| Options | `paper/options` | Pricing tiers or plans | Three, the recommended one marked; "Later" rather than an invented price |
| Before and after | `midnight/beforeafter` | What changed and what did not | Before in muted, now in ink |
| Before and after Venn | `midnight/venn` | Two groups apart, then overlapping | SVG circles, labels as pinned text |
| Two columns | `paper/argument` | Problem and answer, point by point | Parallel heads, answers on the same rows |
| Risks | `paper/risks` | Risks and mitigations | Likelihood in a word, the mitigation as a sentence |
| Decisions | `petal/decisions` | Open questions needing owners | The unowned row tinted and saying so |

## Flows, structure and time

| Component | Copy from | Use when | Rules |
|---|---|---|---|
| Three-step flow | `midnight/flow` | How it works in three steps | Numbered columns, no boxes or arrows, the consequence in one sentence |
| State flow | `console/lifecycle` | The life of a request or record | The deciding state outlined, side exits in panels below |
| Context diagram (C4 L1) | `console/context` | What touches what, for a security or IT reviewer | People, existing system, ours outlined, external dashed, every line labelled |
| Layered stack | `console/layers` | What runs where | One row per layer, the layer the talk is about outlined |
| Sequence diagram | `console/sequence` | One request through the system | Five participants and seven messages at most, numbered |
| Code panel | `console/code` | A config or a snippet | The one dark surface; 28px mono, three colours, notes keyed to line numbers |
| Terminal | `console/terminal` | A command-line walk-through | Prompt, command, output, success, nothing else |
| Gantt-lite phases | `paper/phases` | A plan over months | Phase names in the margin, the current phase in the accent |
| Timeline | `petal/timeline` | Dated milestones | Period bands above the dates, the key moment in the accent |
| Now, next, later | `console/roadmap`, `petal/board` | Commitments without false dates | Four items a column at most, only Now highlighted |
| Next steps | `paper/next` | Who does what by when | The first row is the one to agree in the room |

## People, product and text

| Component | Copy from | Use when | Rules |
|---|---|---|---|
| Team | `midnight/team` | Founders for investors | Name, field, what they built, how they know each other; no cards, no titles until settled |
| People and status | `petal/people` | Who is on what | Own flowers, status as words |
| Screenshot with callouts | `console/product` | The real product, made readable | Crop, 2× capture, numbered dots and a legend |
| Two screenshots | `midnight/product` | What the user sees and what the vendor gets | Captions under each, demo data labelled |
| Wins | `petal/wins` | What shipped | Area pill, what changed, the figure, the owner |
| Anecdote | `midnight/story` | The opening of a pitch | Who, where and when on every moment; one verbatim quote |
| Quote grid | `midnight/quotes` | Several customer voices | Four at most, speakers by company type |
| Pull quote | `paper/quote`, `petal/shoutout` | One voice | Verbatim, role and date |
| Statement | `console/statement`, `midnight/statement` | The one sentence to remember | Centred, nothing else on the slide |
| Summary | `paper/summary`, `paper/korean` | The proposal in three points | Each head stands alone |
| Agenda | `console/agenda`, `petal/agenda`, `paper/contents` | Where the meeting is | Repeat it between parts with the highlight moved |
| Divider | `paper/divider`, `petal/divider` | Between parts | Number and name only |
| Which visual when | `*/considerations` (each template) | Before building: the visual for each situation in that template's job | Sourced; delete it from the deck you send |
| Checklist | `petal/checklist` | Readiness or requirements | Done items step back, open items keep the strong ink |
| Retro | `petal/retro` | Keep, stop, try | Three items a column at most |
| Method | `grid/method` | How the numbers were made | Sample, period, definition, limits |
| Three columns | `midnight/columns` | Three reasons | No index numbers and no dividers; space separates them |
