// The measurable half of rules.md, run inside a page drawn with kit.css: contrast, the type scale, light only,
// gradients and glows, cut-off text, and the tells of a generated interface (eyebrows, boxes in boxes, side stripes, icon
// tiles, two primaries, layout or bounce motion, the accent everywhere, filler words).
// node check.mjs app.html --root main -> problems and notes, one per line; exits 1 on a problem. --card checks a card-sized frame.
// --axe adds axe-core's WCAG checks (roles, names, labels) and --impeccable adds impeccable's detector, each from the repository's node_modules.
// await page.evaluate(lintPage, { root: 'main' }) -> { problems: ['contrast 2.9:1, needs 4.5:1: "Changes requested" (13px)'], notes: […], sizes: [12, 14, 21], kit: 0.64 }
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function lintPage({ root: rootSelector, card = false } = {}) {
  const root = rootSelector ? document.querySelector(rootSelector) : document.body
  if (!root) throw new Error(`no element matches ${rootSelector}`)
  // a page allows one level of panels and more type sizes; a card allows neither
  const page = !card
  const SCALE = [11, 12, 13, 14, 15, 17, 21, 28]
  // one line per rule, with how often it broke and the first place
  const problems = new Map(), notes = new Map()
  const say = (list, rule, where = '') => { const e = list.get(rule); if (e) e.n++; else list.set(rule, { n: 1, where }) }
  const lines = (list) => [...list].map(([rule, { n, where }]) => `${rule}${n > 1 ? ` (${n} places)` : ''}${where ? `: ${where}` : ''}`)
  const cv = document.createElement('canvas').getContext('2d')
  /** '#1a1a1d' or 'rgb(…)' -> [r, g, b, a] */
  const rgba = (c) => {
    cv.fillStyle = '#000'; cv.fillStyle = c
    const s = cv.fillStyle
    if (s.startsWith('#')) return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)).concat(1)
    // color-mix() computes to 'color(srgb 0.64 0.29 0.41 / 0.5)', in 0 to 1
    if (s.startsWith('color(srgb')) { const m = s.slice(10).match(/[\d.]+/g).map(Number); return [m[0] * 255, m[1] * 255, m[2] * 255, m[3] ?? 1] }
    const m = s.match(/[\d.]+/g).map(Number)
    return [m[0], m[1], m[2], m[3] ?? 1]
  }
  const over = (top, base) => [0, 1, 2].map((i) => top[i] * top[3] + base[i] * (1 - top[3])).concat(1)
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const base = rgba(getComputedStyle(root).getPropertyValue('--dl-bg').trim() || '#ffffff')
  /** What an element's text sits on: its own and its ancestors' backgrounds over the card's frame. */
  const backdrop = (el) => {
    const layers = []
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const b = getComputedStyle(n).backgroundColor
      if (b && b !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(b)) layers.unshift(rgba(b))
    }
    return layers.reduce((acc, l) => over(l, acc), base)
  }
  /** How see-through an element is with its ancestors: a busy button at opacity .7 inside a card at 1 -> 0.7 */
  const opacityOf = (el) => { let o = 1; for (let n = el; n && n !== document.documentElement; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o }
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05 }
  const all = [...root.querySelectorAll('*')].filter((el) => !['SCRIPT', 'STYLE'].includes(el.tagName))
  const texty = all.filter((el) => visible(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
  const sizes = new Set()
  for (const el of texty) {
    const s = getComputedStyle(el), px = parseFloat(s.fontSize), text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()
    sizes.add(px)
    const sample = `"${text.slice(0, 32)}" (${px}px)`
    if (!SCALE.some((x) => Math.abs(x - px) < 0.3)) say(notes, `font size ${px}px is off the scale (${SCALE.join(', ')})`, sample)
    if (Number(s.fontWeight) > 600) say(notes, `weight ${s.fontWeight} is heavier than 600`, sample)
    const o = opacityOf(el), fg = rgba(s.color), bg = backdrop(el), page0 = backdrop(el.parentElement ?? el)
    // an element at opacity o shows its text and its own fill over what is behind it at that strength
    const r = ratio(over([...fg.slice(0, 3), fg[3] * o], bg), o < 1 ? over([...bg.slice(0, 3), o], page0) : bg)
    const large = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700)
    if (r < (large ? 3 : 4.5)) say(problems, `contrast ${r.toFixed(1)}:1, needs ${large ? 3 : 4.5}:1`, sample)
    if (s.textShadow !== 'none') say(problems, 'a text shadow: no glows', sample)
    const numeric = /\d/.test(text) && /^[\d\s:.,%+\-–/()]+(h|m|min|s|d|h \d+m)?$/i.test(text), mono = /mono|menlo|consolas|courier/i.test(s.fontFamily)
    if (numeric && mono) say(notes, 'monospace on a number: mono is for ids and code; use dl-num', sample)
    else if (numeric && !s.fontVariantNumeric.includes('tabular-nums')) say(notes, 'a number without tabular figures: use dl-num', sample)
    if (/\p{Extended_Pictographic}/u.test(text)) say(notes, 'emoji: use Icon from the kit', sample)
    if (el.scrollWidth > el.clientWidth + 1 && ['hidden', 'clip'].includes(s.overflowX) && s.textOverflow !== 'ellipsis') say(problems, 'text is cut off', sample)
  }
  for (const el of all.filter(visible)) {
    const s = getComputedStyle(el)
    if (s.backgroundImage.includes('gradient')) say(problems, 'a gradient: no gradients', `<${el.tagName.toLowerCase()} class="${el.className?.baseVal ?? el.className}">`)
    const glow = s.boxShadow !== 'none' && s.boxShadow.split(/,(?![^(]*\))/).some((sh) => { const m = sh.match(/(-?[\d.]+)px/g); const c = sh.match(/rgba?\([^)]*\)/)?.[0]; return m && m.length >= 3 && parseFloat(m[2]) >= 10 && c && !/rgba?\((0|255), ?\1, ?\1/.test(c.replace(/\s/g, '')) })
    if (glow) say(problems, 'a coloured blurred shadow: no glows', `<${el.tagName.toLowerCase()}>`)
    if (el.matches('button, a[href], input, select, textarea, [role="button"], [role="switch"], [onclick]')) {
      const r = el.getBoundingClientRect()
      if (r.width < 24 || r.height < 24) say(notes, 'a target under 24px', `"${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}px`)
    }
  }
  // the kit is light only: no dark panel covering a quarter of the frame or more
  const area = innerWidth * Math.max(innerHeight, 1)
  for (const el of all.filter(visible)) {
    const b = getComputedStyle(el).backgroundColor
    if (!b || b === 'transparent' || /rgba\(.*,\s*0\)$/.test(b)) continue
    const r = el.getBoundingClientRect()
    if (r.width * r.height >= area / 4 && lum(over(rgba(b), base)) < 0.3) say(problems, 'a dark panel: the kit is light only', `<${el.tagName.toLowerCase()}> ${b}`)
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) say(problems, `the page is ${document.documentElement.scrollWidth - innerWidth}px wider than the window`)
  if (!page && sizes.size > 4) say(problems, `${sizes.size} font sizes (${[...sizes].sort((a, b) => a - b).join(', ')}px): use four at most`)
  for (const card of root.querySelectorAll('.dl-card')) {
    const inCard = new Set(texty.filter((el) => card.contains(el)).map((el) => parseFloat(getComputedStyle(el).fontSize)))
    if (page && inCard.size > 4) say(problems, `${inCard.size} font sizes in one card (${[...inCard].sort((a, b) => a - b).join(', ')}px): use four at most`)
  }
  const ordered = [...sizes].sort((a, b) => a - b)
  if (ordered.length >= 2 && ordered.at(-1) / ordered[0] < 1.15) say(notes, `the type has no hierarchy (${ordered.join(', ')}px): make the answer clearly bigger, or use one size`)
  craft()
  const classed = all.filter((el) => typeof el.className === 'string' && el.className.trim())
  const kit = classed.length ? classed.filter((el) => /(^|\s)dl-/.test(el.className)).length / classed.length : 0
  if (kit < 0.3) say(notes, `only ${Math.round(kit * 100)}% of classed elements use the kit (dl-*): build from the kit first`)
  return { problems: lines(problems).slice(0, 10), notes: lines(notes).slice(0, 10), sizes: [...sizes].sort((a, b) => a - b), kit: Math.round(kit * 100) / 100 }

  /** The tells of a generated interface (rules 11 to 16) on the same elements: eyebrow labels, boxes inside the card,
      a hairline with a wide shadow, side stripes, icon tiles, more than one primary button, layout and bounce motion, the
      accent on everything, menus cut off by their box, and words that say nothing. */
  function craft() {
    const own = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim()
    const tagOf = (el) => { const c = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join(' ') : ''; return `<${el.tagName.toLowerCase()}${c ? ` class="${c}"` : ''}>` }
    const quote = (el, t = own(el)) => `"${t.slice(0, 32)}" (${parseFloat(getComputedStyle(el).fontSize)}px)`
    const OVERLAY = '[role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"], [role="tooltip"], dialog, [popover], .dl-toast, .dl-toasts, .dl-menu, .dl-tooltip, .dl-dialog'
    const KIT = 'button, a[href], input, select, textarea, [role="button"], [role="switch"], [role="tab"], pre, code, img, svg, canvas, video, iframe, table, .dl-seg, .dl-tag, .dl-kbd, .dl-chip, .dl-avatar, .dl-status, .dl-input, .dl-switch, .dl-timeline, .dl-meter, .dl-spark'
    const clear = (c) => !c || c === 'transparent' || rgba(c)[3] < 0.05
    const edge = (s, side) => parseFloat(s[`border${side}Width`]) >= 1 && s[`border${side}Style`] !== 'none' && !clear(s[`border${side}Color`])
    /** A colour with a hue, not a grey: 'rgb(214, 51, 108)' -> true */
    const tinted = (c) => { const [r, g, b, a] = rgba(c); return a >= 0.05 && Math.max(r, g, b) - Math.min(r, g, b) >= 24 }
    /** '0 1px 2px rgba(0,0,0,.1), inset 3px 0 0 #d6336c' -> [{ inset: false, px: [0, 1, 2], color }, { inset: true, px: [3, 0, 0], color: '#d6336c' }] */
    const shadows = (s) => s.boxShadow === 'none' ? [] : s.boxShadow.split(/,(?![^(]*\))/).map((sh) => ({ inset: /inset/.test(sh), px: (sh.match(/-?[\d.]+px/g) ?? []).map(parseFloat), color: sh.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/i)?.[0] ?? '' }))
    /** A token's colour as the frame computes it: token('--dl-accent') -> 'rgb(214, 51, 108)' */
    const token = (name) => { const i = document.createElement('i'); i.style.color = `var(${name})`; document.body.append(i); const c = getComputedStyle(i).color; i.remove(); return c }
    /** How many lines an element's own text runs to: lineCount(<p>Two lines of text</p>) -> 2 */
    const lineCount = (el) => {
      const tops = new Set()
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.textContent.trim()) continue
        const range = document.createRange(); range.selectNodeContents(n)
        for (const r of range.getClientRects()) if (r.width > 0) tops.add(Math.round(r.top))
      }
      return tops.size
    }

    // 11. eyebrow labels: small capitals by text-transform, by tracking, or typed in capitals as a bold little label
    for (const el of texty) {
      if (el.closest('kbd, code, pre, .dl-kbd')) continue
      const s = getComputedStyle(el), t = own(el), px = parseFloat(s.fontSize), letters = t.replace(/[^\p{L}]/gu, '')
      if (letters.length < 2 || px > 13) continue
      const typedCaps = letters.length >= 3 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()
      const tracked = (parseFloat(s.letterSpacing) || 0) >= px * 0.04
      if (s.textTransform === 'uppercase' || (typedCaps && (tracked || (t.length <= 24 && Number(s.fontWeight) >= 500)))) say(problems, 'small capitals as a label (an eyebrow or kicker): write it in sentence case at the normal spacing', quote(el))
    }

    // 12. one surface: boxes inside the card (one level is fine on a full page), a hairline with a wide shadow, side
    // stripes, icon tiles, more than one primary button
    const boxy = new Map()
    const isBox = (el) => {
      if (boxy.has(el)) return boxy.get(el)
      let v = false
      if (!el.matches(KIT) && !el.closest(OVERLAY) && el.children.length && visible(el)) {
        const s = getComputedStyle(el), r = el.getBoundingClientRect()
        const sides = ['Top', 'Right', 'Bottom', 'Left'].filter((x) => edge(s, x)).length
        const lifted = shadows(s).some((x) => !x.inset && (x.px[2] ?? 0) >= 4)
        v = r.width >= innerWidth * 0.3 && r.height >= 40 && ((sides >= 3 && (parseFloat(s.borderTopLeftRadius) >= 4 || !clear(s.backgroundColor))) || lifted)
      }
      boxy.set(el, v); return v
    }
    for (const el of all) {
      if (!isBox(el)) continue
      let depth = 0
      for (let n = el; n && n !== root.parentElement; n = n.parentElement) if (isBox(n)) depth++
      if (depth > (page ? 1 : 0)) say(problems, page ? 'a box inside a box: one level of panels on a page, and inside them group with space and hairlines' : 'a box inside the card (a border or shadow round a group): the card is the only box; separate groups with space and hairlines', tagOf(el))
    }
    for (const el of all.filter(visible)) {
      if (el.matches('.dl-timeline__block, .dl-timeline__now') || el.closest('[role="tablist"], .dl-tabs, .dl-seg, [role="tab"]')) continue
      const s = getComputedStyle(el), r = el.getBoundingClientRect()
      const sides = ['Top', 'Right', 'Bottom', 'Left'].filter((x) => edge(s, x)).length
      if (sides >= 3 && shadows(s).some((x) => !x.inset && (x.px[2] ?? 0) >= 12) && !el.closest(OVERLAY)) say(problems, 'a hairline and a wide soft shadow on one box: give it one edge, a border or a shadow', tagOf(el))
      for (const side of ['Left', 'Right', 'Top', 'Bottom']) {
        const w = parseFloat(s[`border${side}Width`]) || 0, others = ['Top', 'Right', 'Bottom', 'Left'].filter((x) => x !== side).map((x) => parseFloat(s[`border${x}Width`]) || 0)
        if (s[`border${side}Style`] === 'none' || !tinted(s[`border${side}Color`]) || r.height < 20 || el.tagName === 'HR') continue
        if ((side === 'Left' || side === 'Right') ? w >= 2 && Math.max(...others) <= 1 : w >= 3 && Math.max(...others) <= 1)
          say(problems, `a coloured stripe on one side of a box (border-${side.toLowerCase()} ${w}px): show state with a Status and a word`, tagOf(el))
      }
      if (r.height >= 24 && shadows(s).some((x) => x.inset && Math.abs(x.px[0] ?? 0) >= 3 && !x.px[1] && tinted(x.color))) say(problems, 'a coloured stripe on one side of a box (an inset shadow): show state with a Status and a word', tagOf(el))
      const ratio = r.width / (r.height || 1), icon = el.querySelector('svg')
      if (r.width >= 28 && r.width <= 72 && ratio > 0.8 && ratio < 1.25 && !el.matches('.dl-avatar, button, a[href]') && (!clear(s.backgroundColor) || edge(s, 'Top'))
        && parseFloat(s.borderTopLeftRadius) < r.width / 2 - 1 && icon && icon.getBoundingClientRect().width < r.width * 0.8 && el.textContent.trim().length <= 2)
        say(problems, 'an icon in a tinted tile: drop the tile; an icon, if any, sits inline with its words', tagOf(el))
    }
    const primary = token('--dl-primary')
    const primaries = all.filter((el) => visible(el) && el.matches('button, [role="button"], a[href]') && !el.matches('[role="switch"], .dl-send') && (el.matches('.dl-btn--primary') || getComputedStyle(el).backgroundColor === primary))
    // one primary per card, and on a page one per card or section
    const groups = Map.groupBy(primaries, (b) => (page && b.closest('.dl-card, section, [role="dialog"]')) || root)
    for (const group of groups.values()) if (group.length > 1) say(problems, `${group.length} primary buttons together: one per card or section, the rest secondary or ghost`, group.slice(0, 3).map((b) => `"${b.textContent.trim().slice(0, 16)}"`).join(', '))

    // 9. motion on transform, opacity and colour only, no bounce, nothing looping but a spinner
    const LAYOUT = /(^|,\s*)(width|height|max-height|max-width|min-height|min-width|padding[\w-]*|margin[\w-]*|top|left|right|bottom)(?=,|$)/
    for (const el of all) {
      const s = getComputedStyle(el), timed = s.transitionDuration.split(',').some((d) => parseFloat(d) > 0)
      if (timed && /(^|,\s*)all(,|$)/.test(s.transitionProperty)) say(problems, 'transition: all: name what moves (transform, opacity, a colour)', tagOf(el))
      else if (timed && LAYOUT.test(s.transitionProperty)) say(problems, `an animated size or position (${s.transitionProperty}): animate transform or opacity`, tagOf(el))
      for (const m of `${s.transitionTimingFunction},${s.animationTimingFunction}`.matchAll(/cubic-bezier\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/g)) {
        if ([m[2], m[4]].some((y) => Number(y) < -0.1 || Number(y) > 1.1)) { say(problems, "a bounce or overshoot curve: use the stylesheet's --dl-tint, --dl-enter or --dl-travel", tagOf(el)); break }
      }
      if (s.animationName !== 'none' && /bounce|elastic|wobble|jiggle|spring|shake/i.test(s.animationName)) say(problems, `a bouncing animation (${s.animationName})`, tagOf(el))
      if (s.animationName !== 'none' && s.animationIterationCount === 'infinite' && !el.closest('[aria-busy="true"], [role="progressbar"], [role="status"], [class*="spin"], [class*="loading"]')) say(notes, 'something loops forever: only a spinner, and only while work runs', tagOf(el))
    }

    // 13. the accent marks one thing: the main action, the selection, or the number that answers the card
    const accent = token('--dl-accent')
    const hasAccent = (el) => {
      const s = getComputedStyle(el), b = getComputedStyle(el, '::before'), a = getComputedStyle(el, '::after')
      return [s.color, s.backgroundColor, s.borderTopColor, b.content !== 'none' && b.backgroundColor, a.content !== 'none' && a.backgroundColor].includes(accent)
    }
    const accented = all.filter((el) => visible(el) && hasAccent(el) && !(el.parentElement && hasAccent(el.parentElement)))
    if (accented.length > 3) say(notes, `the accent colour on ${accented.length} things: keep it for the main action, the selection or the one number`, accented.slice(0, 3).map(tagOf).join(' '))

    // 14. a menu, tooltip or popover cut off by the box it sits in
    for (const el of all.filter(visible)) {
      const s = getComputedStyle(el)
      if (!['absolute', 'fixed'].includes(s.position) || el.closest('.dl-timeline')) continue
      const r = el.getBoundingClientRect()
      for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
        const ns = getComputedStyle(n)
        if (!/(hidden|clip|auto|scroll)/.test(ns.overflowX + ns.overflowY)) continue
        const b = n.getBoundingClientRect()
        if (r.left < b.left - 2 || r.right > b.right + 2 || r.top < b.top - 2 || r.bottom > b.bottom + 2) say(notes, 'something positioned is cut off by the box it sits in (a menu or tooltip?): let it escape the clipping', tagOf(el))
        break
      }
    }

    // 15. tight leading, text pressed against its box, text cut short with no way to read it all
    for (const el of texty) {
      const s = getComputedStyle(el), px = parseFloat(s.fontSize), lh = s.lineHeight === 'normal' ? px * 1.2 : parseFloat(s.lineHeight)
      if (lineCount(el) > 1 && lh / px < 1.3) say(notes, `wrapped text at line height ${(lh / px).toFixed(2)}: use 1.35 or more`, quote(el))
      if (s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1 && !el.closest('[title]')) say(notes, 'text cut short with no way to read it all: put the full text in a title', quote(el))
      if (!el.matches('[class*="dl-"]') && (!clear(s.backgroundColor) || edge(s, 'Left')) && el.getBoundingClientRect().height > 22) {
        // the gap between the text itself and its box, so a centred label in a fixed-height button counts as padded
        const box = el.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(el)
        const text = range.getBoundingClientRect()
        if (text.width && (text.left - box.left < 6 || text.top - box.top < 3)) say(notes, 'text pressed against the edge of its box: pad it 8px or more', quote(el))
      }
    }

    // 16. words: no exclamation marks, no filler, real ellipses, sentence case on the card's own labels, nothing said three times
    const FILLER = /\b(something went wrong|no data( available)?|coming soon|lorem ipsum|welcome back|oops|click here|get started|unlock|supercharge|seamless(ly)?|effortless(ly)?)\b/i
    const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'via'])
    for (const el of all.filter((x) => visible(x) && x.matches('button, [role="tab"], label, th, h1, h2, h3, h4, .dl-empty, .dl-card__head > *, .dl-stat__l, .dl-seg > *'))) {
      const t = el.textContent.replace(/\s+/g, ' ').trim()
      if (!t) continue
      if (/!/.test(t)) say(notes, 'an exclamation mark in a label: say it plainly', `"${t.slice(0, 32)}"`)
      if (/\.\.\./.test(t)) say(notes, 'three dots: use the ellipsis character …', `"${t.slice(0, 32)}"`)
      const w = t.split(' ').filter((x) => /^\p{L}/u.test(x))
      if (w.length >= 2 && w.filter((x) => !SMALL.has(x.toLowerCase())).every((x) => /^\p{Lu}\p{Ll}/u.test(x)) && w.some((x, i) => i > 0 && /^\p{Lu}\p{Ll}{3,}/u.test(x)))
        say(notes, 'Title Case on a label: use sentence case (names keep their capitals)', `"${t.slice(0, 32)}"`)
    }
    for (const el of texty) { const t = own(el); if (FILLER.test(t)) say(notes, `filler words ("${t.match(FILLER)[0]}"): say what happened and what to do`, quote(el)) }
    const seen = new Map()
    for (const el of texty) {
      const t = own(el)
      if (t.length < 4 || /^[\d\s:.,%+\-–/()]+$/.test(t)) continue
      const shape = []
      for (let n = el; n && n !== root && shape.length < 4; n = n.parentElement) shape.push(`${n.tagName}.${typeof n.className === 'string' ? n.className : ''}`)
      seen.set(t, (seen.get(t) ?? new Set()).add(shape.join('<')))
    }
    for (const [t, shapes] of seen) if (shapes.size >= 3) say(notes, `the same words in ${shapes.size} different places: say it once`, `"${t.slice(0, 32)}"`)
  }
}

/** axe-core's WCAG 2.2 A and AA rules on the page: [{ id: 'button-name', impact: 'critical', help: 'Buttons must have discernible text', nodes: 2, where: '.dl-icon-btn' }] */
export async function axePass(page, require, root) {
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
  return page.evaluate(async (sel) => {
    const res = await window.axe.run(sel ? document.querySelector(sel) : document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, where: v.nodes[0]?.target.join(' ') }))
  }, root)
}

/** impeccable's detector on the rendered page, run without adding a script element: [{ type: 'side-tab', severity: 'warning', detail: '…', where: 'li.dl-row' }] */
export async function impeccablePass(page, require, root) {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(require.resolve('impeccable/browser'), 'utf8')
  await page.evaluate(`window.__IMPECCABLE_CONFIG__ = { autoScan: false }; ${src}`)
  return page.evaluate(async (sel) => {
    const found = await (window.impeccableDetectAsync ?? window.impeccableDetect)()
    // with a root, only what sits inside it; the detector itself always scans the whole page
    const box = sel && document.querySelector(sel)
    const inside = (s) => { if (!box) return true; try { const el = document.querySelector(s); return !!el && box.contains(el) } catch { return false } }
    return found.filter((e) => inside(e.selector)).flatMap((e) => (e.findings ?? []).filter((f) => !f.advisory).map((f) => ({ type: f.type, severity: f.severity, detail: f.detail, where: e.selector })))
  }, root)
}

// node check.mjs <file or url> [--root <selector>] [--card] [--width 1440] [--height 900] [--axe] [--impeccable]
// Playwright, axe-core and impeccable come from the repository you run it in, on the Chrome installed on the machine.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args.splice(i, 2)[1] }
  const flag = (k) => args.includes(`--${k}`) && args.splice(args.indexOf(`--${k}`), 1).length > 0
  const card = flag('card'), axe = flag('axe'), imp = flag('impeccable')
  const rootSel = opt('root'), width = Number(opt('width', 1440)), height = Number(opt('height', 900)), target = args[0]
  if (!target) throw new Error('usage: node check.mjs <file or url> [--root <selector>] [--card] [--width 1440] [--height 900] [--axe] [--impeccable]')
  const require = createRequire(resolve('package.json'))
  const { chromium } = require('playwright')
  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width, height } })
  await page.goto(/^https?:/.test(target) ? target : pathToFileURL(resolve(target)).href, { waitUntil: 'networkidle' })
  const r = await page.evaluate(lintPage, { root: rootSel, card })
  const withPackage = async (name, pkg, run) => {
    try { await run() } catch (e) { throw e.code === 'MODULE_NOT_FOUND' ? new Error(`--${name} needs ${pkg} in this repository: npm i -D ${pkg}`) : e }
  }
  // impeccable first: axe's script, once added to the page, contains markup impeccable would read as the page's
  if (imp) await withPackage('impeccable', 'impeccable', async () => {
    for (const f of await impeccablePass(page, require, rootSel)) r.notes.push(`impeccable ${f.type}: ${f.detail}: ${f.where}`)
  })
  if (axe) await withPackage('axe', 'axe-core', async () => {
    for (const v of await axePass(page, require, rootSel)) { r.problems.push(`axe ${v.id} (${v.impact}): ${v.help}${v.nodes > 1 ? ` (${v.nodes} places)` : ''}: ${v.where}`) }
  })
  await browser.close()
  for (const p of r.problems) console.log(`problem  ${p}`)
  for (const n of r.notes) console.log(`note     ${n}`)
  console.log(`sizes ${r.sizes.join(', ')}px · kit ${Math.round(r.kit * 100)}% · ${r.problems.length} problems, ${r.notes.length} notes`)
  process.exit(r.problems.length ? 1 : 0)
}
