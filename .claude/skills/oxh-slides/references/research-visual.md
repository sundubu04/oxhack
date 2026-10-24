# Visual systems for our slide templates

Research for five native slide templates (minimal, clean, spacious). Written 22 Oct 2026.
Out of scope because it is already covered: storytelling (YC, Sequoia, DocSend, Airbnb and Legora decks) and the readability canon (Alley, Duarte, Reynolds, Tufte, WCAG, Butterick, KRDS).

**How much to trust each claim.** Every claim has one of these tags:
- **[measured]**: I pulled the value from the live site's CSS or JS bundle, a downloaded font file or a slide image on 22 Oct 2026. Sites change, so treat these values as dated.
- **[published]**: stated on the organisation's own page or in its own document.
- **[secondary]**: reported by press, a blog or a third-party analysis.
- **[unverified]**: plausible, but I could not confirm it.

The measurements were made with small scripts (font metrics and ink density, WCAG contrast, dominant colours in slide images) that were not kept.

---

## 0. What the research says, in five lines

1. Every clean brand I measured runs on a **neutral ramp plus one chromatic accent**. The neutral is tinted: Stripe's is navy, Anthropic's and Notion's are warm, and Toss's is a blue-grey. The accent is kept for signals such as links, actions and the one thing to look at.
2. A brand's hue often fails 4.5:1 as text, so mature systems **split the accent into a "mark" colour and a darker "text" sibling**. SmartHR documents this split [published]. Anthropic's clay and Toss's blue fail as text [measured].
3. Large type is either **light** (Stripe's 300 hero type, Carbon's 300 for its 42 and 54 px headings) or **semibold and tightly tracked** (Geist uses −0.06 em at 40 px and up; Linear uses −0.022 em). It is never bold at default tracking. All four of those values are [measured] or [published].
4. Separation comes from **space first, then a fill step, then a hairline**. Shadows are never needed. Measured hairlines sit at only 1.2 to 1.4:1 against their page.
5. The best dark themes use **near-black with off-white text, not #000 on #FFF**: Linear uses #08090A on #F7F8F8 and Vercel uses #0A0A0A on #EDEDED [measured]. Material's guidance also says to desaturate accents on dark.

---

## 1. Reference looks (17)

### 1.1 Stripe (stripe.com, Sessions)
- **Palette [measured]:**
  - Headings: `--hds-color-core-neutral-990` #061B31. This is navy, not black.
  - Neutrals: #50617A (600), #64748D (500, subdued headings), #E5EDF5 (50, quiet borders), #F8FAFD (25, subdued surface).
  - Brand: brand-600 #533AFD (6.2:1 on white). The older, widely cited blurple #635BFF is [secondary]. The navy #0A2540 is [unverified] on today's site.
- **Type [measured]:** `sohne-var` (Klim's Söhne) for everything. Code is set in Source Code Pro.
  - Hero headings are weight **300**, line-height 1.05 to 1.12, letter-spacing −0.01 to −0.02 em.
  - Klim describes Söhne as "the memory of Akzidenz-Grotesk framed through the reality of Helvetica" [published].
- **Grid:** not documented publicly.
- **Motifs:** light-weight display type on generous white, product UI shown in crisp frames, a single action colour, and navy instead of black for text. The site also uses mesh gradients, which we exclude.
- **Clean because:** the large type is *light*, so a 64 px headline whispers instead of shouting.
- **Sessions slides:** I found no primary breakdown of the Sessions keynote slides. A 2026 third-party write-up (StrategyU) praises its title-less, speaker-led slides [secondary].
- **Sources:** https://stripe.com (CSS bundle) · https://klim.co.nz/collections/soehne/ · https://strategyu.co/stripe-sessions-2026-keynote-communication

### 1.2 Linear (brand, Method, app)
- **Palette:**
  - The brand page [published] gives Mercury White #F4F5F8 and Nordic Gray #222326, plus "a subtle desaturated blue" with no hex value.
  - Website, dark [measured]: bg-level-0 #08090A, then #0F1011, #141516 and #191A1B. Text is #F7F8F8, secondary #D0D6E0 or #B4BCD0, tertiary #8A8F98 (6.1:1). Borders are translucent white, #FFFFFF14 (8%).
  - Website, light [measured]: text #282A30, tertiary #6F6E77, borders #E9E8EA.
  - Brand and accent [measured]: #5E6AD2 on light, #7170FF on dark (5.2:1 on #08090A).
- **Type [measured]:** Inter Variable, with Berkeley Mono for code.
  - Weights are 510, 590 and 680 rather than 500, 600 and 700.
  - The title scale runs 17, 20, 24, 32, 40, 48, 56, 64 and 72 px. Tracking is −0.012 em up to 24 px and −0.022 em from 32 px.
  - The 2024 redesign post says they started "using Inter Display to add more expression to our headings" [published].
  - On Google Fonts, Inter has an `opsz` axis from 14 to 32 [measured]. The top of that axis is the Display cut [unverified that it is identical to Inter Display].
- **Colour method [published]:** the LCH colour system is built from three inputs: "base color, accent color, and contrast". They "limited how much blue… to return to a more neutral and timeless appearance".
- **Brand rule [published]:** "Give them room to breathe."
- **Motifs:** stacked near-black elevation levels about 2 to 3% apart, 1 px translucent borders and one indigo.
- **Clean because:** depth comes from tiny lightness steps rather than lines or shadows.
- **Keynote slides:** I found no primary source; only an unofficial homage exists [secondary].
- **Sources:** https://linear.app/brand · https://linear.app/now/how-we-redesigned-the-linear-ui · https://linear.app/method · https://linear.app (CSS)

### 1.3 Vercel, Geist design system
- **Palette [measured, light / dark]:**
  - background-100: #FFFFFF / #0A0A0A
  - background-200: #FAFAFA / #000000
  - gray-100: #F2F2F2 / #1A1A1A
  - gray-400 (default border): #EBEBEB / #2E2E2E
  - gray-900 (secondary text): #4D4D4D / #A1A1A1
  - gray-1000 (primary text): #171717 / #EDEDED
  - blue-700 (accent): #0070F7
- **Roles [published]:** "Gray is the default for text, icons, fills, borders, and dividers." Gray-alpha is used where the background should show through.
- **Type [measured]:** Geist and Geist Mono, both on Google Fonts since Oct 2024 [measured, GF metadata].
  - Headings run text-heading-14 to text-heading-72, in semibold.
  - Tracking grows with size: −0.02 em at 14 to 20 px, −0.04 em at 24 to 32 px, and −0.06 em from 40 px. Line-height is 1.0 from 56 px.
- **Motifs:** monochrome everywhere, mono labels, hairline borders in gray-400 and very tight display type.
- **Clean because:** the system has almost no hue, so the one blue is unmistakable.
- **Ship talks:** I have not checked them against recordings [unverified].
- **Sources:** https://vercel.com/geist/colors · https://vercel.com/geist/typography (CSS) · https://fonts.google.com/specimen/Geist

### 1.4 Apple (keynotes, apple.com)
- **Palette [measured on apple.com]:**
  - Text #1D1D1F on #F5F5F7 (15.5:1). Secondary text is #6E6E73 or #86868B.
  - Links are #0066CC on light and #2997FF on dark.
  - Dark "theatre" sections are pure #000.
- **Type [measured]:** SF Pro (not on Google Fonts).
  - A 56 px headline is set at line-height 1.07, weight 600 and −0.005 em.
  - Body is 17 px at −0.022 em, so small text is tracked tighter than large text. That is because SF Pro Display already has tight default spacing.
- **Keynote style [secondary]:**
  - Dark field, very few words, cut-out product imagery and a full-bleed photo as the only exception.
  - It is reported that Jobs used Keynote's Gradient theme and moved to Myriad in 2002. This is single-source [unverified].
- **Motifs:** one object or one number per slide, centred, and huge.
- **Clean because:** each slide holds exactly one thing.
- **Source:** https://www.apple.com (CSS bundle)

### 1.5 Anthropic
- **Palette [measured, anthropic.com CSS]:**
  - Ivory: light #FAF9F5, medium #F0EEE6, dark #E8E6DC
  - Slate: 950 #141413, 700 #3D3D3A, 600 #5E5D59, 500 #87867F
  - Accents: clay #D97757 (interactive #C6613F), oat #E3DACC, olive #788C5D, cactus #BCD1CA, heather #CBCADB, fig #C46686, coral #EBCECE
  - Clay on ivory is only **2.96:1**, so it works as a mark or fill, not as text.
- **Type [measured]:** custom Anthropic Sans, Anthropic Serif and Anthropic Mono. Legacy Styrene B, Tiempos Text and Copernicus are still referenced in the CSS.
  - The 2024 site used Styrene for headlines and Tiempos for body [secondary].
- **Agency:** the identity is credited to the studio Geist (not Vercel) by one blog [secondary].
- **Motifs:**
  - Warm off-white paper instead of white.
  - A serif and a sans used together, both prominently.
  - Hand-cut, flat illustrations in a small set of earthy hues.
- **Clean because:** a warm paper colour and near-black ink read as print, so restraint feels intentional rather than empty.
- **Talk slides:** I have not checked Anthropic's own talk slides [unverified].
- **Sources:** https://www.anthropic.com (CSS) · https://type.today/en/journal/anthropic · https://www.abduzeedo.com/seamlessly-crafting-ai-branding-and-visual-identity-anthropic

### 1.6 Notion
- **Palette [measured, "tatami" tokens]:**
  - Warm grays: 900 #191918, 800 #31302E, 600 #615D59, 500 #78736F, 400 #A39E98, 300 #DFDCD9, 200 #F6F5F4, 100 #F9F9F8
  - Blue-600 #0075DE (4.6:1 on white)
- **Type [measured]:** NotionInter (an Inter variant), Lyon Text (serif) and iA Writer Mono.
- **Motifs:**
  - Black-and-white line illustration.
  - Warm-gray UI.
  - A serif reserved for long reading and moments of voice.
- **Clean because:** the grays are slightly warm, so the whitespace never feels clinical.
- **Source:** https://www.notion.com (CSS)

### 1.7 OpenAI (2025 identity)
- **Palette:** "mostly grey and blue, with bold contrast colours" [secondary]. openai.com and openai.com/brand returned 403, so I have no hex values [unverified].
- **Type [secondary]:** OpenAI Sans, built with ABC Dinamo. It has five weights and replaced six or seven earlier faces. A monospace cut is planned.
- **Team [secondary]:** an in-house team led by Veit Moeller and Shannon Jager, with Studio Dumbar.
- **Motifs:** "the point", a black circle standing for the cursor, is built into the letterforms.
- **Clean because:** one family does every job.
- **DevDay slides:** I have not checked them [unverified].
- **Source:** https://www.fastcompany.com/91273217/open-ai-rebrand-chat-gpt-logo

### 1.8 IBM Carbon and IBM Plex
- **Palette [published]:** four themes.
  - White #FFFFFF and Gray 10 #F4F4F4 (light)
  - Gray 90 #262626 and Gray 100 #161616 (dark)
- **Colour rules [published]:**
  - Blue 60 is the interactive colour. It is #0F62FE, 5.0:1 on white [measured].
  - "Neutral gray is dominant." Other colours are used "sparingly and purposefully".
  - Light themes "alternate between White and Gray 10 with each added layer". Layering is done with fills, not borders.
- **Type [published]:** IBM Plex Sans, Serif and Mono, all on Google Fonts. IBM Plex Sans KR is on Google Fonts too.
  - Productive set (14 px base): 12, 14, 16, 20, 28, 32, 42 and 54 px.
  - Expressive set: fluid up to display-04 at 92/102 px.
  - Weights are 300, 400 and 600, with **300 for most of the largest sizes**.
- **2x Grid [published]:**
  - 8 px "mini unit", 16 columns at large breakpoints and 16 px padding.
  - Gutters are 32 px when used. The grid is "built by halving".
  - Carbon v9 used 5% outer margins [secondary].
- **Data-viz rules [published]:**
  - Categorical colours are "applied in sequence strictly".
  - Monochrome sequential palettes are for trends.
  - "Never use a gradient in place of a sequential palette."
- **Clean because:** every dimension is a multiple of 8 and every colour has a single job.
- **Sources:** https://carbondesignsystem.com/elements/2x-grid/overview/ · https://carbondesignsystem.com/elements/typography/type-sets/ · https://carbondesignsystem.com/elements/color/overview/ · https://carbondesignsystem.com/data-visualization/color-palettes/

### 1.9 Google Material 3
- **Type scale [published, material-web tokens]:**

  | Style | Size / line-height |
  |---|---|
  | Display L / M / S | 57/64, 45/52, 36/44 |
  | Headline L | 32/40 |
  | Title L | 22/28 |
  | Body L | 16/24 |
  | Label L | 14/20 |

  That makes 15 styles in 5 roles. It is a UI scale: far more sizes than a deck needs.
- **Dark theme (Material 2 guidance, still the reference) [published]:**
  - Surfaces are #121212, not black.
  - Text-to-background contrast should be at least **15.8:1**, so text still passes 4.5:1 on the lightest elevated surface.
  - Elevation is shown by lighter overlays, not shadows.
  - Accents are desaturated because saturated colours "vibrate" on dark.
- **Slide templates:** I have not checked Google's Material slide templates [unverified].
- **Clean because:** the roles are named for their job, so a size is never chosen ad hoc.
- **Sources:** https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-typescale.scss · https://m2.material.io/design/color/dark-theme

### 1.10 Toss (Viva Republica, Korea)
- **Palette [measured in toss.im JS bundles]:**
  - Grey ramp: #191F28, #333D4B, #4E5968, #6B7684, #8B95A1, #B0B8C1, #E5E8EB, #F2F4F6, #F9FAFB. The commonly used names grey900 to grey50 are [unverified].
  - Blue #3182F6.
- **Contrast [measured]:**
  - Blue on white is only **3.71:1**, so it is a button colour, not small text.
  - #6B7684 on #F2F4F6 is 4.19:1, which fails.
- **Type [measured]:** Toss Product Sans (custom). Geist Mono appears on toss.im.
  - Tracking is −0.02 em in most rules, −0.01 em elsewhere. Body line-height is 1.6.
- **Motifs:**
  - Big, short, bold Korean sentences.
  - A cool blue-grey neutral.
  - One blue.
  - Flat rounded fills instead of borders.
- **Clean because:** the greys carry a little blue, so the one blue belongs to the page instead of fighting it.
- **SLASH slides:** I found no source for the SLASH conference slide rules [unverified].
- **Sources:** https://toss.im and https://toss.tech (bundles)

### 1.11 SmartHR and the Japanese company-deck genre (会社紹介資料)
- **Palette [published]:**
  - SmartHR Blue #00C4CC is "not recommended for text on white". I measured it at 2.15:1.
  - Text is Black #23221F. The recommended accent is orange #FF9900.
  - Each extended family has a darker step for text, such as Aqua 04 #0F7F85 (4.8:1). The mark-and-text split is written into the system.
- **Slide template [published]:** SmartHR's template is internal (Notion and Google Doc). Its rules are [unverified].
- **Company deck, Sep 2026 [measured, Speaker Deck]:**
  - 1920×1080.
  - A small boxed section tag top left ("01 会社概要 / 各事業の紹介").
  - A large teal headline, a bold sub-headline and airy body text.
  - The product screenshot sits on a brand-colour half panel.
  - Footer: "© SmartHR, Inc. 09 | 61".
- **LayerX deck [measured]:** bilingual section dividers, with a large Japanese title and a small English line beneath.
- **Motifs:** a section tag, bilingual dividers, "page | total" and screenshots on flat colour fields. Covers use gradients, which we exclude.
- **Clean because:** the strict, repeated furniture lets dense Japanese text breathe.
- **Sources:** https://smarthr.design/basics/colors/ · https://smarthr.design/communication/slides/ · https://speakerdeck.com/smarthr_pr/smarthr-company-introduction1 · https://speakerdeck.com/layerx/bakuraku-engineering-team-deck

### 1.12 McKinsey (and the consulting house style)
- **Identity:**
  - Wolff Olins' 2019 identity has a custom serif, **Bower**, made with Radim Pesko [published by Wolff Olins].
  - It uses a "McKinsey deep blue" against "clean white", plus a data-viz package [published].
  - #051C2C (navy), #2251FF (electric blue) and the rule "accent once per slide" come from an unofficial homage [secondary/unverified].
- **House conventions [secondary]:**
  - Full-sentence **action titles** (under about 15 words, two lines at most).
  - A section tracker.
  - A "ghost deck" storyboard, so the argument reads from the titles alone.
  - Source and footnote lines.
- **BCG:** its fonts are contested across sources (Trebuchet MS versus Arimo-like) [unverified].
- **Clean because:** each slide has exactly one claim, at the top, in words.
- **Sources:** https://wolffolins.com/work/mckinsey · https://www.mckinsey.com/about-us/new-at-mckinsey-blog/the-new-mckinsey-look-gets-a-red-dot · https://slidespeak.co/blog/mckinsey-style-presentation (homage)

### 1.13 Swiss International Typographic Style and Müller-Brockmann
- **Traits [secondary]:** grid first, asymmetric layout, flush-left and ragged-right text, Akzidenz-Grotesk, Helvetica or Univers, and objective photography over illustration.
- **The grid book [published, publisher blurb]:** *Grid Systems in Graphic Design* (1981) covers grids of **8 to 32 fields**.
- **"The grid system is an aid, not a guarantee"** is widely attributed to it [secondary; page not checked].
- **Palette:** black, white and one strong colour (often red) is the folk version [unverified as a rule].
- **Motifs:** a hanging headline, a visible column logic, oversized numerals and captions on a shared baseline.
- **Clean because:** every element is aligned to something.
- **Sources:** https://en.wikipedia.org/wiki/International_Typographic_Style · https://draw-down.com/products/grid-systems-in-graphic-design

### 1.14 The Vignelli Canon (2010, free PDF)
- **Quotes I read directly in the PDF [published]:**
  - "Our first rule is to stick to one or two type sizes at the most." (section "Contrasting Type Sizes")
  - "It is really the white that makes the black sing." (same section)
  - "Wider margins deflate the tension and bring about a certain level of serenity to the page." (section "White Space")
  - "Bad layouts have no space left for breathing - every little space covered by a cacophony of type-sizes, images, and screaming titles."
- **Typefaces:**
  - His exhibition used only Garamond, Bodoni, Century Expanded and Helvetica.
  - He "can get along well with a half a dozen", adding Optima, Futura, Univers, Caslon and Baskerville.
- **Weights:** he says to use them "dedicated to a specific function, rather than… for color purposes".
- **Grids:** he shows 2×4, 3×6, 4×8, 5×4 and 6×6 grids.
- **Clean because:** it is the strictest economy of sizes and faces on record.
- **Source:** https://www.rit.edu/vignellicenter/sites/rit.edu.vignellicenter/files/documents/The%20Vignelli%20Canon.pdf

### 1.15 Dieter Rams and Braun
- **Ten principles [published, Vitsoe]:**
  - No. 5: "Good design is unobtrusive". Products are "like tools… neither decorative objects nor works of art."
  - No. 10: "Good design is as little design as possible": "Less, but better".
- **Colour [published, Braun]:** Rams used colour if "it told the user something". On the ET66 calculator, the yellow equals key is the only colour-coded key beyond on/off.
  - ET66 attribution (Rams with Dietrich Lubs) is contested [secondary].
- **Motifs:** neutral bodies and one functional colour dot.
- **Clean because:** colour appears only where it carries meaning.
- **Sources:** https://www.vitsoe.com/us/about/good-design · https://www.braun-audio.com/en-ES/stories/design/braun-colour-choices/ · https://collections.vam.ac.uk/item/O1360553

### 1.16 Kenya Hara and Muji ("emptiness", 空)
- **Idea [secondary interviews]:** Hara separates *emptiness* from *simplicity*.
  - A Henckels knife is the product of simplicity. A yanagi-ba knife is the product of emptiness: its plainness lets the user use it however their skill allows.
  - Emptiness "makes room for future filling".
- **Palette:** unbleached, kraft and off-white, with dark red Muji wordmarks [unverified hex].
- **Motifs:** large empty fields, small type placed at an edge, natural materials.
- **Clean because:** the empty space is offered to the viewer rather than left over.
- **Sources:** https://designanthologymag.com/story/kenya-hara-conversation · https://www.dezeen.com/2017/12/13/kenya-hara-exclusive-interview-muji-us-expansion-brand-aesthetic/ · https://metropolismag.com/projects/kenya-hara-breaks-down-muji-unique-appeal/

### 1.17 The Takahashi method
- **What it is [secondary]:** text-only slides with very few, very large characters, and many slides shown briefly.
  - Masayoshi Takahashi had no presentation or image software, so "he simply made it much bigger".
  - It spread through Tokyo Ruby talks around 2005.
- **Motifs:** one word or phrase filling the slide, black on white, no furniture.
- **Clean because:** there is nothing to arrange except the word.
- **Sources:** https://en.wikipedia.org/wiki/Takahashi_method (flagged for citations) · https://signalvnoise.com/archives2/presentation_ideas_takahashi_kingsize_text_and_kawasaki_top10

### 1.18 Context: Korean medical-AI brands (not a reference look)
- VUNO uses Poppins plus NanumSquare, navy #102135 and mint #40E2DE; Lunit uses Manrope with #233232 [measured]. Korean medical AI leans navy or teal, so a our product healthcare look should stay calm without copying either. Sources: https://www.vuno.co and https://www.lunit.io/ko

**Not covered:** Pitch.com, Keynote templates and Cookpad (not researched). Airbnb: only Cereal is confirmed (Dalton Maag, 2018, six weights, "playful, open, and simple" [secondary, AIGA]); Rausch #FF385C is [unverified]. Figma Config's identities are expressive and maximal (Figma blog), a poor fit here.

---

## 2. Typography (Google Fonts only)

All availability below was checked against `fonts.google.com/metadata/fonts` on 22 Oct 2026 [measured].
- **Not on Google Fonts:** Pretendard, SUIT, Wanted Sans and Spoqa Han Sans Neo. That means the current sales look (Pretendard) cannot load in the slide tool as it stands.

### 2.1 Latin metrics [measured]
These are the regular weights, as fractions of the em.

| Face | x-height | cap height | x/cap | Note |
|---|---|---|---|---|
| Inter (opsz 14–32) | .546 | .728 | .75 | Large x-height; the Display cut sits at the top of opsz |
| Inter Tight | .546 | .728 | .75 | Inter metrics with tighter spacing, for display |
| Geist / Geist Mono | .530 | .710 | .75 | Identical verticals across sans and mono |
| IBM Plex Sans / Serif / Mono | .516 | .698 | .74 | Identical verticals across the whole family |
| JetBrains Mono | .550 | .730 | .75 | Matches Inter almost exactly |
| Schibsted Grotesk | .527 | .703 | .75 | Akzidenz-flavoured grotesk |
| Instrument Sans / Instrument Serif | .510 | .720 | .71 | Same designers; Serif is condensed and 400 only, with italic |
| Newsreader (opsz 6–72) | .441 | .676 | .65 | Small x-height; bookish and editorial |
| Source Serif 4 (opsz 8–60) | .492 | .670 | .73 | Workhorse editorial serif |
| Bricolage Grotesque (opsz 12–96) | .517 | .660 | .78 | Characterful display grotesk |

### 2.2 Pairings

| Kind | Pairing | Why it works | Watch out |
|---|---|---|---|
| Serif-led editorial | **Newsreader** (display at opsz 72, 400–500) + **Inter** (labels and body) | The small x-height serif reads as literary next to a neutral sans | Set the serif about 8% larger than you would set Inter |
| Serif-led editorial | **Instrument Serif** (display) + **Instrument Sans** | The same designers (Fuenzalida, Egstad) and an identical cap height of .720 | The serif has one weight, so use it only at 56 px and up |
| Serif-led editorial | **Source Serif 4** + **Source Sans 3** | Adobe superfamily. Noto Sans KR's Latin is Source Sans scaled 113%, so the family stays consistent into Korean | Source Sans looks small next to Hangul; see 2.4 |
| Grotesk | **Inter Tight** (display) + **Inter** (text) | One design with two spacings; the Linear and Vercel feel | Very common, so lean on layout for identity |
| Grotesk | **Schibsted Grotesk** + **Inter** | Closest free relative of Söhne's Akzidenz feel [my judgement] | Schibsted's weights run 400–900 only |
| Grotesk | **Geist** + **Geist Mono** | Identical verticals; Vercel's own system | Reads "developer tool", which is intentional |
| Mono-led technical | **JetBrains Mono** (labels, code, numbers) + **Inter** | Measured x-height and cap height within 1% of Inter's | Mono is wide (advance .600), so keep mono lines short |
| Mono-led technical | **IBM Plex Mono** + **IBM Plex Sans** (+ **Plex Sans KR**) | One family covering Latin, mono and Korean, with identical metrics | Feels corporate; make it warmer with a tinted page |
| Mono-led technical | **Geist Mono** (display mono) + **Geist** | Mono headlines work at Vercel's scale | Track mono headlines tighter, by −0.02 to −0.04 em |

### 2.3 Korean-capable Google Fonts
There are 38 families with a Korean subset; most are display or handwriting. The useful ones are below [measured].

| Family | Weights | Designer | Hangul block height (em) | Hangul ink at 400* | Role |
|---|---|---|---|---|---|
| **Noto Sans KR** (= Source Han Sans) | 100–900 variable | Google / Adobe | .890 | .204 (darkest) | Default 고딕 for body and UI |
| **IBM Plex Sans KR** | 100–700 | Sandoll + Bold Monday, 2020 | .877 | .180 | Corporate and technical; ships unscaled Plex Sans Latin |
| **Gothic A1** | 100–900 | HanYang I&C | .879 | .195 | Strong display weights (800/900) |
| **Asta Sans** | 300–800 variable | 42dot | .845 (smallest) | .181 | Contemporary; GF metadata says added 2025-05-28 (another source says 2024) |
| **Nanum Gothic / Nanum Myeongjo** | 400 / 700 / 800 | Sandoll for Naver | .918 / .921 | .181 / .146 | Ubiquitous, slightly dated |
| **Noto Serif KR** (= Source Han Serif) | 200–900 variable | Google / Adobe | .940 | .166 | 명조 for dignified headlines |
| **Hahmlet** | 100–900 variable | Hypertype | .896 | .201 | Modern, high-contrast serif |
| **Gowun Batang / Gowun Dodum** | 400 / 700 | Yanghee Ryu | .890 / .870 | .131 / .148 | Soft and literary; too light for projection |

*Ink is the share of dark pixels in a rendered sample. It is a crude measure of typographic colour, useful only for comparing faces with each other.

### 2.4 Pairing Latin with Hangul

**Rule (my method, built on measurements).** Every Korean font ships its own Latin, and its designers sized that Latin to sit with their Hangul. To add a separate Latin face at the same CSS size, **match its cap height to the cap height of the Korean font's built-in Latin**. If they differ, scale the Latin by the ratio.

Adobe confirms the principle: in Source Han Sans, "the Source Sans Pro glyphs were scaled to 113% and 115%" (Normal and Bold), because Latin is the minority script and is adjusted to the CJK design [published]. Typotheque adds that at the same point size, "the Latin text tends to appear too small and often needs to be scaled up" [published]. It also advises matching "the average weight of the character rather than the stroke thickness alone" [published].

| Hangul face (its Latin cap) | Best metric matches (scale needed) [measured] |
|---|---|
| Noto Sans KR (.733) | **Inter 1.01**, Inter Tight 1.01, **JetBrains Mono 1.00**, Manrope 1.02, Plus Jakarta Sans 0.98 |
| IBM Plex Sans KR (.698) | **IBM Plex Sans / Mono 1.00**, DM Sans 1.00, Schibsted Grotesk 0.99, Figtree 1.00 |
| Gothic A1 (.731) | Mona Sans 1.00, Public Sans 1.01, Libre Franklin 0.99, Inter 1.00, Geist 1.03 |
| Asta Sans (.707) | DM Sans 1.01, Figtree 1.01, Instrument Sans 0.98, Geist 1.00 |
| Noto Serif KR (.728) | **Instrument Serif 1.01**, Public Sans 1.01, Newsreader 1.08, Source Serif 4 1.09 |

**Findings:**
1. **Inter + Noto Sans KR is essentially Pretendard, and both are on Google Fonts.** Pretendard's README says it "is designed based on Inter, Source Han Sans, and M PLUS 1p". Noto Sans KR *is* Source Han Sans, and its Latin cap height is within 1% of Inter's [measured].
   - This is the drop-in replacement for the sales look in the slide tool.
   - Use the font stack `'Inter', 'Noto Sans KR', sans-serif` so Latin falls to Inter and Hangul to Noto.
2. **IBM Plex Sans KR is the only Korean family on Google Fonts whose Latin is exactly the Latin family's** [measured: identical metrics]. Mixed-script lines never shift.
3. **Weight.** Inside fonts designed together, the ratio of Latin ink to Hangul ink is 0.50 to 0.61 [measured].
   - Inter (.118) with Noto Sans KR Hangul (.204) gives 0.58, inside that range, so use the same weight number for both.
   - Inter with Plex Sans KR (.180) gives 0.66, so Inter will look a touch darker. Take the Korean face one weight up or the Latin one down, and check by eye [inference].
4. **Size.** Hangul blocks are 1.12 to 1.29× the cap height of their own Latin and rise above it [measured]. In bilingual headline pairs (Korean title with an English sub-line), the Korean will look larger at equal size. Size the English sub-line at 0.5 to 0.6× by design, not to "match".

### 2.5 Korean setting rules for slides
- **Line height:** Toss uses 1.6 for body [measured]. Typotheque suggests about 1.7 for CJK reading text [published]. Use 1.5 to 1.6 for slide body and 1.25 to 1.35 for Korean headlines; Latin usually needs only about 1.1.
- **Tracking:** Toss's common value is −0.02 em [measured]. Use −0.01 to −0.03 em on Korean display text and 0 on body.
- **Line breaks:** use `word-break: keep-all` so lines break between 어절 rather than mid-word. This is standard CSS behaviour; I did not re-check the MDN wording. Hand-break headlines.
- **Glyph width:** Google Fonts Knowledge notes a trend toward narrower Hangul (around 850 to 950 units) for readability [secondary snippet]. Of the faces on Google Fonts, Asta Sans and Plex Sans KR are the narrower ones (advance .856 and .892 em) [measured].
- **Sources:** https://fonts.google.com/metadata/fonts · https://ccjktype.fonts.adobe.com/2015/01/shs-vs-ssp-and-scp.html · https://github.com/orioncactus/pretendard · https://www.typotheque.com/articles/typesetting-cjk-text · https://www.sandollcloud.com/font/15781/IBM-Plex-Sans-KR · https://fontsource.org/fonts/asta-sans/about · https://fonts.google.com/knowledge/type_in_china_japan_and_korea/cjk_typesetting_rules

---

## 3. Principles of minimal slides, beyond the readability canon

### 3.1 Whitespace and margins
- **The broadcast "graphics-safe" margin is 5% per side of a 16:9 frame** (action-safe is 3.5%) [published, EBU R 95 v1.1]. On 1920×1080 that is **96 px left and right and 54 px top and bottom**. Treat it as the *minimum*.
- Carbon v9 used the same 5% outer margin on wide screens [secondary].
- **Wider than minimum reads as calm.** Vignelli: "Wider margins deflate the tension and bring about a certain level of serenity" [published].
  - For a "spacious" look, use 7.5 to 8.5% (144 to 160 px) left and right and 96 to 120 px top and bottom.
- **Empty space should look deliberate.** Hara's emptiness is space offered to the viewer [secondary]. In practice, keep one large unbroken empty region per slide rather than gaps spread evenly.
- **Target coverage [my heuristic, unverified]:**
  - Content slides should leave at least 40% of the safe area empty.
  - Statement slides should leave at least 70% empty.
  - If a slide needs more coverage, split it.

### 3.2 Grids for 16:9
These are my arithmetic on 1920×1080, using IBM's 8 px unit, which divides both 1920 and 1080. Twelve columns divide by 2, 3, 4 and 6 [published, Zowe grid guide].

| Grid | Margins (left and right) | Gutter | Column | Use |
|---|---|---|---|---|
| Standard | 96 (5%) | 24 | 122 | Dense readouts, tables |
| Spacious | 144 (7.5%) | 24 | 114 | Most templates |
| Editorial | 160 (8.3%) | 32 | 104 | Serif decks; keep a two-column left "margin rail" |

- **Vertical:** use a 96 to 120 px top band for the title zone and footer furniture at 56 to 64 px from the bottom. Lay everything on an 8 px baseline.
- **Asymmetry** is the Swiss signature [secondary]: content on columns 4 to 12, with labels or numbers hanging on columns 1 to 3.

### 3.3 Number of type sizes and the scale
- **Vignelli:** "one or two type sizes at the most" per page [published].
- **A deck needs 4, at most 5, sizes; any single slide should use 3 or fewer** [recommendation]. Material's 15 styles and Geist's 30 classes are UI scales, not slide scales [measured].
- **Use a modular scale** (Tim Brown, A List Apart, 2011) [published]. A perfect fourth (1.333) from 24 px gives 24, 32, 42, 56, 75, 100 and 133 px. Pick four of them, for example **24 label, 32 body, 56 title, 100 display**.
- **Weight and size move in opposite directions:**
  - Carbon sets its 42 and 54 px headings and most display sizes at 300 [published].
  - Stripe sets its heroes at 300 [measured].
  - The alternative school (Geist and Linear) uses semibold with strong negative tracking.
  - Choose one school per template, never both.
- **Tracking tightens as size grows [measured]:**
  - Geist: −0.02, −0.04 and −0.06 em.
  - Linear: −0.012 and −0.022 em.
  - Stripe: −0.01 and −0.02 em.
  - Toss Korean: −0.02 em.
- **Weights carry function, not colour.** Vignelli says weights should be "dedicated to a specific function" [published]. Two weights per template is enough.

### 3.4 One accent
- **Evidence [measured]:** every system measured above has one chromatic accent on a neutral ramp:
  - Stripe brand-600, Vercel blue-700, Linear indigo, Notion blue-600, Toss blue, Apple link blue and Anthropic clay.
  - IBM: "sparingly and purposefully" [published].
  - Rams: colour only when it "told the user something" [published].
- **Tint the neutral toward the accent's temperature:**
  - Stripe's navy-tinted neutrals with violet.
  - Toss's blue-greys with blue.
  - Anthropic's and Notion's warm greys with warm accents [measured].
- **Split the accent into a mark colour and a text colour** whenever the brand hue is under 4.5:1. SmartHR documents this (Aqua 04 for text) [published]. Clay, Toss blue and SmartHR Blue all fail as text [measured].
- **Slide rule [recommendation]:**
  - The accent appears on **at most one element per slide**: the number, the word, the active step or the highlighted series.
  - Never use it for decoration: rules, title bars, bullets or icons.

### 3.5 Hairlines, fills and cards
- **Spacing first.** Refactoring UI's "use fewer borders" tactic: separate with spacing, a background change or a shadow instead of a border [published, refactoringui.com; details secondary]. Our taste removes shadows, which leaves space and fill.
- **Fill second.** Carbon's layering alternates White and Gray 10 [published]. Linear steps its dark levels by about 2 to 3% lightness [measured].
  - A filled panel 1.1 to 1.2:1 against the page groups content with no line.
- **Hairline third:**
  - Measured border tokens: Vercel #EBEBEB (1.2:1), Notion #DFDCD9, Stripe #E5EDF5 and Linear #FFFFFF14 on dark.
  - Use 1 px at 1080p (or 1.5 px if the deck is projected), and only for **tables, axes and the top rule of a footer or column**.
- **Never fill and outline the same box.** A box with both a fill and a border is a "card". In a minimal deck, cards are the main source of clutter [recommendation].
- **Decorative hairlines may be low-contrast.** Lines that carry meaning, such as chart marks, diagram edges and active states, need at least **3:1** under WCAG 1.4.11 non-text contrast.

### 3.6 Dark slides done well
- **Near-black, not #000 [measured]:**
  - Linear #08090A, Vercel #0A0A0A and Material #121212 [published].
  - Apple uses pure #000 only for product theatre.
- **Off-white text [measured]:**
  - Linear #F7F8F8, Vercel #EDEDED and Apple #F5F5F7.
  - Secondary text sits at 6 to 8:1: Linear #8A8F98 is 6.1:1 and Vercel #A1A1A1 is 7.7:1.
- **Material's base target is 15.8:1** so text survives on raised surfaces [published].
- **Raise surfaces by lightness, not shadow:** about +3 to 5% per level, 2 to 3 levels at most [measured, Linear; published, Material].
- **Lighten and desaturate the accent one step for dark:** Linear #5E6AD2 becomes #7170FF, and Apple #0066CC becomes #2997FF [measured]. Material warns that saturated colours "vibrate" on dark [published].
- **Halation:** light text on dark can bloom for astigmatic viewers, so avoid thin weights under about 32 px on dark [unverified; Material and Apple materials hint at it].

### 3.7 Quiet diagrams and charts
- **Grey first, then colour one thing.** Muth (Datawrapper, 2023): "I actually recommend graying out all your colorful categories first," and "If everything is important and emphasized, nothing is." [published]
- **Sequence over rainbow.** Carbon uses monochrome sequential palettes for magnitude, applies categorical colours in a fixed order, and never uses a gradient in place of a sequential palette [published].
- **For diagrams [recommendation, synthesised from 3.4 and 3.5]:**
  - One stroke weight (1.5 to 2 px at 1080p) and one corner radius (or none).
  - Nodes are text plus either a fill or a hairline, never both.
  - Arrowheads small and open.
  - Labels in the body face at 0.75× body size.
  - Ink-2 for structure and ink for the content.
  - Accent on the single path or node the slide is about.
  - No icons inside nodes.
- **Numbers:** use tabular figures or the template's mono for anything compared in columns.

---

## 4. Proposal: seven template directions

These are seven distinct *systems*, each with its own grid, furniture and type. They are not recolours of one layout.
- The mapping to jobs is a starting point. Pick five.
- All contrast ratios below were computed with the WCAG 2.x formula [measured, `final_palettes.py`]. Text ratios are listed against **every** background in that palette, in the order the backgrounds appear.
- Shared bans (our product taste): gradients, shadows, emoji, stock photos, rules under titles, coloured left borders and fill-plus-outline cards.

| # | Name | Job | Ground | Type | Signature motif |
|---|---|---|---|---|---|
| A | **Ivory Editorial** | Investor narrative, vision, fundraising update | Warm paper | Newsreader + Inter | Margin rail with section numerals; one italic accent word |
| B | **Swiss Signal** | Customer or partner meeting | White | Schibsted Grotesk + Inter | Hanging headline and oversized numeral on an asymmetric grid |
| C | **Console** | Product demo, engineering talk | Near-black | Geist + Geist Mono | Status-line footer; before/after diff panes |
| D | **Readout** | Research or data readout, metrics review | White, plot fill | IBM Plex Sans + Plex Mono | Finding-left, chart-right; "Fig. n · Source" line |
| E | **Big Room** | Internal update, workshop | Warm grey | Bricolage Grotesque + Inter | Takahashi-scale words; flat "zones" for exercises |
| F | **Clinic** (진료실) | Korean meetings with healthcare companies | White, blue-grey panels | Noto Serif KR + IBM Plex Sans KR | Bilingual header; 요청 · 생성 · 승인 step rail |
| G | **Petal Product** | Customer-facing product walkthrough | Hub page grey | Instrument Sans + Instrument Serif | Screenshot on a flat stage; Ask → Build → Approve rail |

### A. Ivory Editorial: investor narrative
- **Job:** the story slides of a raise, vision memos read aloud, and a monthly investor update. It is the warm, literary alternative to the navy and sakura deck.
- **Layout:**
  - Editorial grid with 160 px margins.
  - Columns 1 to 2 are a **margin rail**: section numeral ("§ 02") and a small caps-style label in Inter.
  - Columns 3 to 11 hold a serif headline written as a full sentence, with body text below.
  - Statement slides use one serif line at 100 px with nothing else.
  - A hairline at the very top carries the running head (section left, page right). There is no rule under the title.

| Token | Hex | Role | Contrast (page / panel / accent-tint) |
|---|---|---|---|
| page | #FAF8F3 | Slide ground | n/a |
| panel | #F1EDE4 | Pull-quote or figure field | n/a |
| accent-tint | #F4DFE5 | Highlight field behind one figure | n/a |
| ink | #1C1B19 | Headlines, body | 16.2 / 14.7 / 13.5 |
| ink-2 | #57534B | Secondary text | 7.2 / 6.5 / 6.0 |
| ink-3 | #67625A | Rail labels, captions, footer | 5.7 / 5.2 / 4.8 |
| accent | #A3305B | One word or number per slide (deep petal, a sibling of sakura) | 6.3 / 5.7 / 5.3 |
| hairline | #DDD7CB | Running-head rule, table rows | 1.35 (decorative) |

- **Type:** Newsreader at opsz 72, weight 400 (500 at most); italic for the accent word. Inter 400/500 for body and rail.
- **Scale:** 24 (rail and footer), 32 (body), 60 (headline), 100 (statement).
- **Korean fallback:** Noto Serif KR for headlines, with Newsreader scaled to 1.08×; Noto Sans KR for body.
- **Borrows from:** Anthropic (paper ground, serif and sans together), Notion (warm greys, serif for voice) and the Vignelli Canon (two sizes per slide, wide margins).

### B. Swiss Signal: customer or partner meeting
- **Job:** first meetings, follow-ups and partner kickoffs where the slides must look precise and businesslike. It is distinct from the existing quiet slate sales look because it is a grid-forward, high-contrast black and white.
- **Layout:**
  - Spacious grid with 144 px margins.
  - Headlines **hang** from a fixed line at y = 144, flush left and ragged right, across columns 1 to 8.
  - Key numbers are set huge (200 to 240 px) on columns 1 to 6, with the caption on the same baseline as the number's foot.
  - Columns are separated by space only. A single hairline sits *above* a text column (the Swiss column rule), never under a title.
  - There are no boxes.

| Token | Hex | Role | Contrast (page / panel / signal-tint) |
|---|---|---|---|
| page | #FFFFFF | Ground | n/a |
| panel | #F2F2F2 | Comparison field, quote field | n/a |
| signal-tint | #FBE7E2 | Background of the one highlighted cell or step | n/a |
| ink | #111111 | Headlines, numerals | 18.9 / 16.9 / 15.9 |
| ink-2 | #474747 | Body | 9.3 / 8.3 / 7.8 |
| ink-3 | #686868 | Captions, footer | 5.6 / 5.0 / 4.7 |
| signal | #B83219 | One element per slide (Swiss red-orange) | 6.0 / 5.3 / 5.0 |
| hairline | #E0E0E0 | Column rule, table rows | 1.32 (decorative) |

- **Type:** Schibsted Grotesk 600 for headlines (−0.02 em) and 700 for numerals (−0.04 em). Inter 400 for body.
- **Scale:** 22 (caption), 30 (body), 64 (headline), 220 (numeral).
- **Korean:** Gothic A1 (cap match 1.04×) or Noto Sans KR.
- **Borrows from:** Müller-Brockmann and Swiss Style (hanging line, asymmetry, flush left), Braun and Rams (one functional colour) and the Vignelli Canon (Helvetica-school economy).

### C. Console: product demo and engineering talk (dark)
- **Job:** live demos, architecture talks and meetups for developers. It shows prompts, generated diffs and the approval step.
- **Layout:**
  - Standard grid with 96 px margins.
  - A **status line** runs along the bottom in Geist Mono at 20 px, like an editor's: left `darling · demo / 03 build`, right `07 / 24`.
  - Code and diffs sit in panels with a +/− gutter; added lines get a tint and removed lines a red-tint.
  - A prompt is shown as one mono line with a block caret.
  - Section slides are one Geist line at 120 px, tracked −0.05 em.

| Token | Hex | Role | Contrast (page / panel / add-tint / del-tint) |
|---|---|---|---|
| page | #0B0C0E | Ground (near-black) | n/a |
| panel | #15171A | Code and diff panes, one elevation | n/a |
| add-tint | #0E2A1D | Background of added lines | n/a |
| del-tint | #2D1416 | Background of removed lines | n/a |
| ink | #EDEEF0 | Headlines, code | 16.9 / 15.5 / 13.2 / 14.8 |
| ink-2 | #A6AAB1 | Body, comments | 8.4 / 7.7 / 6.6 / 7.4 |
| ink-3 | #8B9098 | Status line, line numbers | 6.1 / 5.6 / 4.8 / 5.3 |
| accent | #6EE7A8 | "Approved / shipped", the one highlight | 12.7 / 11.7 / 10.0 / 11.2 |
| del | #FF8A8A | Removed-line marker, only inside diffs | 8.6 / 7.9 / 6.8 / 7.6 |
| hairline | #2A2D33 | Pane edges, status-line rule | 1.42 (decorative) |

- **Type:** Geist 600 for headlines (−0.04 to −0.06 em) and 400 for body. Geist Mono 400 for code, labels and the status line.
- **Scale:** 20 (status), 28 (code and body), 56 (headline), 120 (section).
- **Korean:** Noto Sans KR at the same size (Geist to Noto cap ratio is 1.03).
- **Borrows from:** Vercel Geist (monochrome ramp, tracking scale, mono labels), Linear (near-black levels, translucent hairlines, one accent) and Material's dark theme (#121212 logic, desaturated accent, the 15.8:1 target).

### D. Readout: research or data readout
- **Job:** pilot results, experiment readouts, metrics reviews and interview syntheses. These are slides that have to *prove* something.
- **Layout:**
  - Standard grid.
  - The top band holds a **full-sentence action title** (two lines at most).
  - Columns 1 to 4 hold **the number** (100 px, Plex Mono) and a one-line finding.
  - Columns 5 to 12 hold the chart on a plot fill with no frame.
  - Footer: `Fig. 3 · Source: pilot logs, Sep 2026 · n = 412`, in mono at 20 px.
  - Charts are grey-first with one highlight series, direct labels, no legend and gridlines in the grid colour only.

| Token | Hex | Role | Contrast (page / plot) |
|---|---|---|---|
| page | #FFFFFF | Ground | n/a |
| plot | #F4F5F7 | Chart field (fill, no border) | n/a |
| ink | #161616 | Titles, numbers | 18.1 / 16.6 |
| ink-2 | #525252 | Body, direct labels | 7.8 / 7.2 |
| ink-3 | #6F6F6F | Axis labels, footer | 5.0 / 4.6 |
| highlight | #C2410C | The series or bar that is the finding, plus its label | 5.2 / 4.7 |
| compare | #2F4F8F | Optional second series, such as a baseline (use rarely) | 8.0 / 7.3 |
| context | #8D8D8D | All other series (a mark, 3:1 or more) | 3.32 on page, 3.04 on plot |
| grid | #E0E0E0 | Gridlines, table rules | 1.32 (decorative) |

- **Type:** IBM Plex Sans 400/600 for titles and body. IBM Plex Mono 400 for numbers, axes and footer, with tabular figures.
- **Scale:** 20 (axis and footer), 28 (body and labels), 44 (action title), 100 (the number).
- **Korean:** IBM Plex Sans KR. Its metrics are identical, so this template is bilingual for free.
- **Borrows from:** IBM Carbon and Plex (8 px grid, one-job colours, sequence rules), Datawrapper and Muth (grey first, one highlight) and the McKinsey house style (action titles, source line).

### E. Big Room: internal update and workshop
- **Job:** Monday updates, retros, planning workshops and offsites. The aim is low effort and high legibility from the back of a room.
- **Layout:**
  - Spacious grid.
  - The **Takahashi register**: one phrase per slide at 160 to 240 px, flush left on columns 1 to 10, with nothing else.
  - The agenda is three huge numerals.
  - Exercise slides use flat **zones**: filled rectangles with no border, labelled at the top left.
  - A small timer chip (a marker fill with ink text) sits top right on activity slides.
  - The inverse page is used for "decision" slides only.

| Token | Hex | Role | Contrast (page / zone / marker) |
|---|---|---|---|
| page | #F2F1EE | Ground (warm grey) | n/a |
| zone | #E5E3DD | Exercise areas, columns | n/a |
| marker | #FFD84D | Timer chip, one emphasis field (fill only) | n/a |
| ink | #151412 | Everything textual | 16.3 / 14.3 / 13.3 |
| ink-2 | #55524B | Small labels, footer | 6.9 / 6.1 / 5.6 |
| hairline | #D3CFC6 | Only for tables | 1.38 (decorative) |
| inverse-page | #151412 | Decision slides | n/a |
| inverse-ink | #F2F1EE | Text on inverse | 16.3 |

- **Type:** Bricolage Grotesque at opsz 96, weight 700, −0.03 em, for statements. Inter 400/500 for labels.
- **Scale:** 24 (labels), 36 (zone text), 96 (slide title when needed), 200 (statement).
- **Korean:** Gothic A1 800. Bricolage's cap is small, so scale Bricolage 1.11× when the two are mixed on one line.
- **Borrows from:** the Takahashi method (giant words, many slides), Toss (short bold sentences, flat fills instead of borders) and Kenya Hara and Muji (empty zones offered to the room to fill).

### F. Clinic (진료실): Korean meetings with healthcare companies
- **Job:** Korean-language meetings with hospitals, medical-AI firms and healthcare SaaS. It has to feel trustworthy, formal and calm, and it carries more text and tables than the other templates.
- **Layout:**
  - Standard grid.
  - **Bilingual header:** a Korean headline in 명조 with a small English sub-line beneath. This is the Japanese company-deck convention.
  - A section tag at the top left (`02 도입 절차`).
  - The footer reads `대외비 · our product` on the left and `07 / 24` on the right.
  - A three-step **rail** (요청 · 생성 · 승인) marks where the slide sits in our flow; the active step is in the accent.
  - Review tables use row hairlines only. "확인 사항" sits in a panel fill.

| Token | Hex | Role | Contrast (page / panel / accent-tint) |
|---|---|---|---|
| page | #FFFFFF | Ground | n/a |
| panel | #F3F5F7 | Info panels, table header row | n/a |
| accent-tint | #E4F1F0 | Active-step field, highlighted row | n/a |
| ink | #191F28 | Headlines, body (Toss-like blue-black) | 16.6 / 15.2 / 14.3 |
| ink-2 | #4E5968 | Body, table text | 7.1 / 6.5 / 6.1 |
| ink-3 | #626D7A | English sub-line, footer, captions | 5.3 / 4.8 / 4.55 |
| accent | #0B6B68 | Deep celadon-teal: the active step, the one figure | 6.3 / 5.8 / 5.5 |
| hairline | #E5E8EB | Table rows, rail connectors | 1.23 (decorative) |

- **Type:** Noto Serif KR 600 for headlines (−0.02 em, line-height 1.3). IBM Plex Sans KR 400/500 for body (line-height 1.6, `keep-all`). Latin is Plex Sans, which ships inside the KR font. For an all-sans variant, use Noto Sans KR + Inter.
- **Scale:** 22 (footer and sub-line), 30 (body), 52 (headline), 84 (key figure).
- **Note:** don't copy VUNO's navy and mint or Lunit's dark teal. Celadon sits next to them without imitating them.
- **Borrows from:** Toss (blue-grey ramp, −0.02 em Korean tracking, 1.6 body), SmartHR and LayerX company decks (section tag, bilingual dividers, page `n / N`) and IBM Plex (one family across Korean and Latin).

### G. Petal Product: customer-facing walkthrough
- **Job:** showing our product itself to customers and partners (non-engineers). It is the one direction that deliberately reuses an existing product look, so slides and product feel like one thing.
- **Layout:**
  - Spacious grid.
  - Product screenshots sit on a flat **stage** fill (columns 4 to 12), with no device frames and no shadow.
  - Numbered callouts are small petal dots with ink numerals, explained in columns 1 to 3.
  - A thin **Ask → Build → Approve rail** at the top shows which stage the slide is about; the current stage is in the accent.
  - The headline is short Instrument Sans, with an optional single Instrument Serif italic word.

| Token | Hex | Role | Contrast (page / stage / petal-tint) |
|---|---|---|---|
| page | #F7F6F7 | Ground (hub page) | n/a |
| stage | #EEEBEE | Screenshot field | n/a |
| petal-tint | #F6E3EA | Current-stage field on the rail | n/a |
| ink | #1E1A1D | Headlines, body | 16.0 / 14.5 / 14.0 |
| ink-2 | #5A5358 | Callout text, footer | 6.9 / 6.3 / 6.1 |
| accent | #B03A74 | Hub accent: current stage, one key word | 5.3 / 4.8 / 4.6 |
| petal | #D77F9C | Callout dots only (mark); ink numerals on it are 6.1:1 | 2.63 (mark) |
| hairline | #E0DBDF | Rail connectors | 1.27 (decorative) |

- **Type:** Instrument Sans 500/600 for headlines (−0.02 em) and 400 for body. Instrument Serif italic for a single emphasis word at 56 px and up.
- **Scale:** 22 (callouts), 30 (body), 56 (headline), 88 (cover).
- **Korean:** Asta Sans or Noto Sans KR (Instrument Sans to Asta cap ratio is 0.98).
- **Borrows from:** Stripe (product UI framed on calm neutrals, one action colour), Linear (product-first, almost no chrome) and SmartHR (screenshot on a flat colour field).

### How they differ, at a glance

| | Ground | Grid | Type school | Separation | Furniture |
|---|---|---|---|---|---|
| A | Warm paper | Editorial, margin rail | Serif display, light | Space + top hairline | Running head, § numerals |
| B | White | Asymmetric, hanging line | Grotesk, semibold | Space only | Big numerals, column rule |
| C | Near-black | Standard | Grotesk + mono, tight | Elevation fill | Status line, diff panes |
| D | White + plot | Standard, 4/8 split | Plex + mono | Fill (plot) + axes | Fig./source line |
| E | Warm grey | Spacious, one phrase | Display grotesk, heavy | Flat zones | Timer chip, inverse decision slides |
| F | White + blue-grey | Standard, table-ready | 명조 + 고딕 | Fill + row hairlines | Bilingual header, 요청·생성·승인 rail |
| G | Hub grey | Spacious, 3/9 split | Sans + serif italic | Stage fill | Callout dots, Ask→Build→Approve rail |

**Suggested five:** A (investor), B (customer), C (demo and engineering), D (readout) and F (Korean healthcare).
- E is the easiest to drop; internal decks can use D or B.
- G is the alternative if customer demos matter more than partner meetings.

---

## 5. Unverified or missing

- **Talk slides not checked against recordings:** Linear, Stripe Sessions, Vercel Ship, OpenAI DevDay and Anthropic. Their entries rely on web tokens. The Apple keynote details (Gradient theme, Myriad) are single-source and secondary.
- **Hex values I could not confirm:** OpenAI (site returned 403), McKinsey (only an unofficial homage gives values and the "accent once per slide" rule), Airbnb's Rausch, and Muji. BCG's fonts conflict across sources. SmartHR's slide rules are internal; I saw only its colours and a public deck. Toss token names are community names, though the hex values are measured; I found no source for SLASH slide rules.
- **Assumed or heuristic:** the Müller-Brockmann quote (not checked in the book; "8 to 32 fields" is from the blurb), Inter opsz 32 being Inter Display, the halation advice (3.6), the coverage targets (3.1) and the ink-density numbers (2.3 and 2.4), which are only for relative comparison.
- **Not researched:** Pitch.com, Keynote templates, Cookpad and Material slide templates.
