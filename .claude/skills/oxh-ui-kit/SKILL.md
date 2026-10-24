---
name: oxh-ui-kit
description: The team's UI kit for the OxHack app, one light stylesheet (kit.css), React pieces with Base UI underneath the overlays, Lucide icons and eighteen rules, with a check that measures a page against them (plus axe-core and impeccable). Use before building or restyling any screen of the hackathon app, and whenever someone asks for "the pink style", "the house style", an icon, or a new component. Not for documents or decks (use oxh-artifact or oxh-slides).
---

# UI kit

Adapted from darling-agentic's drl-ui-kit. One look for every screen of the app: neutral greys, the system font, and flow-er's flower pink for the main action, the current item, links and the focus ring. Hover is grey and things that are on are ink. Light only. Reuse a piece from here before designing a new one; a second treatment for the same thing is the drift this kit exists to stop.

| File | What it is |
|---|---|
| `assets/kit.css` | The stylesheet: `--dl-*` tokens (a twelve-step pink scale among them), then every component as a `dl-` class |
| `assets/kit.tsx` | React components with no dependencies: buttons, fields, checkbox, radio, switch, segmented control, tabs, rows, status, banner, empty, skeleton, stats, meter, progress, steps, thread, composer, timeline, spark, icon |
| `assets/overlays.tsx` | What opens over a page, on Base UI: `RowMenu`, `Pick`, `Confirm`, `Dialog`, `Tip`, `useToast`, inside one `<Overlays>` at the app's root |
| `assets/icons.json` | 81 Lucide 1.53 icons for `Icon`; `assets/LICENSE-lucide.txt` is their licence and goes wherever they go |
| `assets/specimen.html` | Every piece in every state. Open it beside the sheet |
| `references/rules.md` | The eighteen rules a screen follows, and what makes an interface look generated |
| `scripts/check.mjs` | Measures a rendered page against the rules a number can catch; `--axe` and `--impeccable` add those tools' checks |

## Start a screen

1. Decide where the kit lives: `app/web/src/ui/` (or the frontend's own `src/ui/`). If the app already uses a component library, pick one: the kit or that library, never both on one screen.
2. Copy the files in `assets/` there, unchanged. Import the sheet once at the app's root. Install Base UI for the overlays: `npm i @base-ui/react@1.9.0`.
3. Put the look on the root element and wrap the app once in `Overlays`. Everything the kit draws sits inside.

   ```html
   <html data-dl-look="pink">                              <!-- an app -->
   <html data-dl-look="pink" data-dl-density="compact">    <!-- a dense console -->
   ```

4. Lay the page out with the app frame, then fill it from the pieces below. `AppFrame` adds the skip link and, under 720px, the top bar and the drawer:

   ```tsx
   <AppFrame title="Changes" brand={<Avatar name="App" brand />}
     rail={<a className="dl-nav__item" aria-current="page" href="/app"><Icon name="layers" /><span className="dl-nav__label">Changes</span><span className="dl-nav__count">7</span></a>}>
     …
   </AppFrame>
   ```

5. Read `references/rules.md` before the first screen, and run the check before calling one finished.

## The pieces

| Need | Use |
|---|---|
| Page frame | `AppFrame title brand rail` draws `dl-app` + `dl-rail` (`dl-nav__item`, `dl-nav__group`, `dl-nav__count`) + `dl-main`, a skip link, and under 720px a `dl-topbar` whose button opens the rail as a drawer. `dl-app--sheet` + `dl-sheet` puts the content on a rounded sheet |
| Titles and text | `dl-h1` (21), `dl-title` (17), `Head` (a group's label, sentence case), `dl-meta`, `dl-muted`, `dl-num`, `dl-mono`, `dl-link`, `Sr` for words only a screen reader needs |
| A list | `Rows` + `Row lead title sub action current off`; a link or button with `dl-row__link` in the title opens the row |
| A table | `dl-table`, with `dl-num` cells and `dl-quote` for a clipped quote; `data-current` on the open row |
| A number that answers the screen | `Stats` + `Stat value label tone hero` |
| State | `Status tone` with words (ok dot, info ring, warn half, stop diamond, none a dash), `Tag tone` for a fixed label, `Banner tone action` for a notice |
| Actions | `Btn kind sm busy icon` (`primary` once per card or section, `secondary`, `ghost`, `danger`, `danger-solid` only to confirm a loss), `btn()` for a link that looks like one, `IconBtn` inside `Tip`, `RowMenu` for a row's other actions, `dl-chip` for answer choices |
| Inputs | `Field label hint error` around `Input`, `Textarea` or `NativeSelect`; `Check`, `Radio` in a `Fieldset`, `Switch` for what takes effect at once, `Seg` for one of 2 to 4 views, `Tabs` for pages of one object, `Pick` for a value chosen in place, `dl-search` |
| Over the page | `Confirm` before a loss that can't be undone, `Dialog` for a short task, `useToast()` after an action with Undo, `Tip` to name an icon button |
| Waiting and nothing | `Spinner`, `Skeleton`, `Steps` for work with named steps, `Progress`, `Empty title action` |
| Data | `Meter` (always with its numbers in words beside it), `Timeline`, `Spark`, `KV items`, `Avatar name` |
| Asking | `Thread` with `dl-msg--user` / `dl-msg--assistant`, `Composer` with `Pick` pickers in it |
| Everything else | `Icon name size`, `Kbd`, `hm`, `rel`, `dur` format times as "09:30", "in 12 min", "1 h 35 min" |

The extension's own pieces (`dl-tab`, `dl-panel`, `dl-notice`, `dl-ba`, `dl-section`) are in the sheet too.

## Icons

`Icon` draws from `assets/icons.json`, which holds Lucide 1.53's drawings by their Lucide names. For an icon that isn't there, take it from the same version (`npm pack lucide-static@1.53.0`, then `icons/<name>.svg`) and add its elements to the JSON under its name, or install `lucide-react@1.53.0` and give its components `className="dl-icon"`. Never draw one by hand and never use an emoji.

## When the kit has no piece

Write the CSS beside the screen, and only from the sheet's tokens: `--dl-bg`, `--dl-surface-2`, `--dl-raised` for surfaces, `--dl-text` to `--dl-text-3`, `--dl-line` to `--dl-line-strong`, `--dl-hover` and `--dl-press` (grey), `--dl-accent`, `--dl-selected` and `--dl-pink-1` to `--dl-pink-12` for the pink, `--dl-control-on` for what is on, `--dl-ok` / `--dl-warn` / `--dl-stop` / `--dl-info` with their `-wash`, the `--dl-fs-*` sizes, `--dl-ctl-h` heights, `--dl-r-*` corners and the motion tokens `--dl-tint`, `--dl-enter`, `--dl-travel`. No hex value, no new size, no new shadow. Anything that opens over the page comes from Base UI, styled with these classes. If the same thing is needed on a second screen, it belongs in the kit.

## Check a screen

From the frontend's folder, with the app running and Playwright installed there (`npm i -D playwright`; it drives the Chrome already on the machine). `--axe` and `--impeccable` need `npm i -D axe-core impeccable` in the same folder. Point at the script by its path from the repository root:

```
node ../.claude/skills/oxh-ui-kit/scripts/check.mjs http://localhost:5173/app --root main --axe --impeccable
node ../.claude/skills/oxh-ui-kit/scripts/check.mjs http://localhost:5173/app --root main --width 400 --height 860 --axe
node ../.claude/skills/oxh-ui-kit/scripts/check.mjs card.html --card
```

It prints one line per finding and exits 1 on a problem; axe's WCAG failures count as problems, impeccable's findings as notes. Fix every problem. Notes are judgement calls: fix them unless the screen has a reason, and say the reason in the commit. Four impeccable notes are expected from the kit itself: the segmented control's 2px inset, the toast's padding beside its button, a row title ending in an ellipsis, and a box clipping a closed drawer or a pictured overlay. Run it at phone width too. `--card` holds a card-sized frame to the card rules (four sizes, no box inside).

## Changing the kit

The copy in the app stays identical to these files, so change the kit here and copy it out again. Change a token before adding a component, and add a component only when two screens need it. After a change, add the new piece to `assets/specimen.html` in every state it has, then run the check on it from a folder where Playwright, axe-core and impeccable are installed. One problem is expected there: the controls section shows nine primary buttons on purpose, one per state.

```
node <this skill>/scripts/check.mjs <this skill>/assets/specimen.html --root '.sp' --axe --impeccable
node <this skill>/scripts/check.mjs <this skill>/assets/specimen.html --root '.sp' --width 400 --height 860 --axe
```
