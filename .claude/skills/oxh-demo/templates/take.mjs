// One demo take. Copy to demo/take1.mjs, then: cd demo && node take1.mjs
// Marks name the points edit.json cuts between; zoom asks cut.py to ease in on that action.
import { chromium } from 'playwright'
import { record } from '../.claude/skills/oxh-demo/scripts/rec.mjs'

const APP = process.env.APP_URL || 'http://localhost:5173'
const take = await record(chromium, { url: APP, out: '../recordings/take1' })

take.mark('home')
await take.wait(1500)

take.mark('ask')
await take.type('[data-demo="ask"]', 'Replace with the question the user really asks', { zoom: 1.3 })
await take.tap('[data-demo="send"]')

take.mark('working')
await take.page.waitForSelector('[data-demo="result"]', { timeout: 120_000 })

take.mark('result')
await take.emph('[data-demo="result"]', { zoom: 1.4, dur: 2 })

await take.rest()
await take.wait(1500)
take.mark('end')
console.log(await take.stop())
