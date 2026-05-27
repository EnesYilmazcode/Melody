// Verifies: import with an embedded video id → YouTube cover art; the Now
// Playing scrubber fills; the lyrics view toggles.
import { chromium, devices } from 'playwright'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const base = process.argv[2] || 'http://localhost:5180'

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)

// import a file whose name embeds a real video id (as our yt-dlp cmd produces)
const buf = readFileSync(resolve(here, '../public/samples/sample-d.wav'))
await page.locator('input[type=file]').setInputFiles({
  name: 'Test Song [dQw4w9WgXcQ].wav', mimeType: 'audio/wav', buffer: buf,
})
await page.waitForTimeout(1500)

const artSrc = await page.locator('.row__main img.artwork').first().getAttribute('src').catch(() => null)
console.log('cover art src:', artSrc)

// play it, open Now Playing
await page.getByText('Test Song').first().click()
await page.waitForTimeout(1500)
await page.locator('.mini').click()
await page.waitForTimeout(800)

const fill = await page.locator(".scrub input[type='range']").evaluate((el) => el.style.background)
console.log('scrubber fill:', fill ? fill.slice(0, 60) : '(none)')

// toggle lyrics
await page.getByLabel('Lyrics').click()
await page.waitForTimeout(1500)
const lyr = await page.locator('.lyrics').textContent().catch(() => '(no lyrics el)')
console.log('lyrics view:', JSON.stringify((lyr || '').slice(0, 50)))

await page.screenshot({ path: resolve(here, '../screenshots/09-lyrics.png') })
await browser.close()
console.log('done')
