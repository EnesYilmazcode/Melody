// Captures the 3 README screenshots into docs/screenshots/ at iPhone size.
// For the lyrics shot it imports a file named like a real song so LRCLIB
// returns actual synced lyrics to show off the feature.
import { chromium, devices } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../docs/screenshots')
mkdirSync(out, { recursive: true })
const base = process.argv[2] || 'http://localhost:5180'

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
const shot = (n) => page.screenshot({ path: resolve(out, `${n}.png`) })

await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

// 1) Library
await shot('library')

// 2) YouTube link → command card
await page.getByRole('button', { name: /^Search$/ }).click()
await page.waitForTimeout(200)
await page.locator('.searchbar__input').fill('https://youtu.be/dQw4w9WgXcQ?si=x')
await page.waitForTimeout(1800)
await shot('youtube')

// 3) Now Playing + synced lyrics (import a real-named track so lyrics resolve)
await page.getByRole('button', { name: /^Library$/ }).click()
await page.waitForTimeout(200)
const buf = readFileSync(resolve(here, '../public/samples/sample-d.wav'))
await page.locator('input[type=file]').setInputFiles({
  name: 'Rick Astley - Never Gonna Give You Up [dQw4w9WgXcQ].wav',
  mimeType: 'audio/wav',
  buffer: buf,
})
await page.waitForTimeout(2500) // import + lyrics fetch
await page.getByText('Never Gonna Give You Up').first().click()
await page.waitForTimeout(800)
await page.locator('.mini').click()
await page.waitForTimeout(800)
await page.getByLabel('Lyrics').click()
await page.waitForTimeout(2500) // lyrics load
await shot('lyrics')

await browser.close()
console.log('README screenshots written to docs/screenshots/')
