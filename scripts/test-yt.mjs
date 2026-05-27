// Verifies the YouTube-link → command card: pastes a share-style link into
// Search and checks the generated a-Shell command renders.
import { chromium, devices } from 'playwright'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const base = process.argv[2] || 'http://localhost:5180'

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)

await page.getByRole('button', { name: /^Search$/ }).click()
await page.waitForTimeout(200)
// a real share-link shape: youtu.be/<id>?si=...
await page.locator('.searchbar__input').fill('https://youtu.be/dQw4w9WgXcQ?si=abcd1234')
await page.waitForTimeout(2000) // allow noembed preview to load

const cmd = await page.locator('.ytcard__cmd').textContent().catch(() => null)
console.log('command shown:', JSON.stringify(cmd))
console.log('preview title:', await page.locator('.ytcard__title').textContent().catch(() => '(none)'))

await page.screenshot({ path: resolve(here, '../screenshots/08-yt-link.png') })
await browser.close()
console.log('done')
