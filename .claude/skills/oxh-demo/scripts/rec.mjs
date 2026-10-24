// Records a scripted demo take: a CDP screencast of a real Chrome, a drawn cursor with a click
// ring, and a log of marks and clicks that cut.py turns into the video.
//
//   import { chromium } from 'playwright'
//   import { record } from '../.claude/skills/oxh-demo/scripts/rec.mjs'
//   const take = await record(chromium, { url: 'http://localhost:5173', out: 'recordings/take1' })
//   take.mark('home'); await take.wait(1500)
//   await take.tap('text=New project', { zoom: 1.6 })
//   await take.type('textarea', 'Gate every file like the expert did', { zoom: 1.3 })
//   take.mark('end'); await take.stop()
//
// Playwright is passed in so it resolves from the take script's folder (demo/), not from here.
// Frames are JPEGs with their screencast timestamps; marks and clicks use the same clock.
import fs from 'node:fs'
import path from 'node:path'

const RING = '#d14d86'

// Draws the cursor and a ring on each press. Runs in every document the page opens.
const CURSOR = `(() => {
  if (window.__oxhCursor) return; window.__oxhCursor = true;
  const add = () => {
    const c = document.createElement('div');
    c.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M5 3l15 11.5-6.6 1.1 3.9 7.6-3.1 1.6-3.9-7.7L5 22z" fill="#1f1a1d" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', width: '28px', height: '28px', pointerEvents: 'none', zIndex: 2147483647, transform: 'translate(-100px,-100px)' });
    document.documentElement.appendChild(c);
    addEventListener('mousemove', e => { c.style.transform = 'translate(' + (e.clientX - 5) + 'px,' + (e.clientY - 3) + 'px)'; }, true);
    addEventListener('mousedown', e => {
      const r = document.createElement('div');
      Object.assign(r.style, { position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', width: '14px', height: '14px', margin: '-7px 0 0 -7px', borderRadius: '50%', border: '3px solid ${RING}', boxShadow: '0 0 0 2px rgba(255,255,255,.95), inset 0 0 0 2px rgba(255,255,255,.95)', pointerEvents: 'none', zIndex: 2147483646, opacity: '1', transition: 'transform 450ms ease-out, opacity 450ms ease-out' });
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = 'scale(4)'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 500);
    }, true);
  };
  if (document.documentElement) add(); else addEventListener('DOMContentLoaded', add);
})();`

export async function record(chromium, { url, out, width = 1920, height = 1080, scale = 1, headless = true, channel = 'chrome', quality = 92 } = {}) {
  fs.mkdirSync(path.join(out, 'frames'), { recursive: true })
  const browser = await chromium.launch({ headless, channel })
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale })
  await context.addInitScript(CURSOR)
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  const frames = fs.createWriteStream(path.join(out, 'frames.jsonl'))
  const events = fs.createWriteStream(path.join(out, 'events.jsonl'))
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify({ url, width, height, scale, started: new Date().toISOString() }, null, 2))

  let n = 0
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const file = `frames/${String(++n).padStart(6, '0')}.jpg`
    fs.writeFileSync(path.join(out, file), Buffer.from(data, 'base64'))
    frames.write(JSON.stringify({ t: metadata.timestamp ?? Date.now() / 1000, file }) + '\n')
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  const log = (e) => events.write(JSON.stringify({ t: Date.now() / 1000, ...e }) + '\n')

  await page.goto(url, { waitUntil: 'load' })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality, maxWidth: width * scale, maxHeight: height * scale, everyNthFrame: 1 })
  let mx = width / 2, my = height / 2
  await page.mouse.move(mx, my)
  await page.waitForTimeout(300)

  const box = async (selector) => {
    const el = page.locator(selector).first()
    await el.waitFor({ state: 'visible' })
    await el.scrollIntoViewIfNeeded()
    return el.boundingBox()
  }
  // Glide to a point at a steady speed, so the viewer can follow the cursor.
  const glide = async (x, y) => {
    const steps = Math.max(8, Math.round(Math.hypot(x - mx, y - my) / 28))
    await page.mouse.move(x, y, { steps })
    mx = x; my = y
  }

  return {
    page,
    /** A named point in time; edit.json cuts clips between marks. */
    mark: (name) => log({ kind: 'mark', name }),
    wait: (ms) => page.waitForTimeout(ms),
    /** Click an element. zoom > 1 asks cut.py to ease in on it around the click. */
    async tap(selector, { zoom = 0, after = 600 } = {}) {
      const b = await box(selector)
      await glide(b.x + b.width / 2, b.y + b.height / 2)
      await page.waitForTimeout(180)
      log({ kind: 'click', name: selector, box: b, zoom })
      await page.mouse.down(); await page.mouse.up()
      await page.waitForTimeout(after)
    },
    /** Click a field and type into it at a readable speed; the zoom frames the whole field. */
    async type(selector, text, { delay = 45, zoom = 0, after = 500 } = {}) {
      const b = await box(selector)
      await glide(b.x + Math.min(b.width / 2, 40), b.y + b.height / 2)
      await page.mouse.down(); await page.mouse.up()
      log({ kind: 'type', name: selector, box: b, zoom, dur: (text.length * delay) / 1000 })
      await page.keyboard.type(text, { delay })
      await page.waitForTimeout(after)
    },
    /** Frame an element without clicking it, for dur seconds. */
    async emph(selector, { zoom = 1.5, dur = 1.6 } = {}) {
      const b = await box(selector)
      log({ kind: 'emph', name: selector, box: b, zoom, dur })
      await page.waitForTimeout(dur * 1000)
    },
    /** Move the cursor out of the way, for a clean shot. */
    async rest() { await glide(width - 40, height - 40) },
    async stop() {
      await page.waitForTimeout(400)
      await cdp.send('Page.stopScreencast').catch(() => {})
      await new Promise((r) => frames.end(r)); await new Promise((r) => events.end(r))
      await browser.close()
      return { frames: n, out }
    },
  }
}
