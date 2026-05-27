// Validates the import → IndexedDB → object-URL → play loop end to end by
// feeding a file into the picker (as the Files app would) and checking the
// resulting track actually plays from a blob: URL.
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
await page.waitForTimeout(800)

// Import a file — reuse a sample WAV but give it a clean display name.
const buf = readFileSync(resolve(here, '../public/samples/sample-d.wav'))
await page.locator('input[type=file]').setInputFiles({
  name: 'Imported Test.wav',
  mimeType: 'audio/wav',
  buffer: buf,
})
await page.waitForTimeout(1500)

console.log('track appeared:', await page.getByText('Imported Test').count())

await page.getByText('Imported Test').first().click()
await page.waitForTimeout(1200)

const state = await page.evaluate(() => {
  const a = document.querySelector('audio')
  return { paused: a?.paused, currentTime: Number((a?.currentTime || 0).toFixed(2)), srcKind: a?.src?.split(':')[0] }
})
console.log('audio state:', JSON.stringify(state))

// Reload to prove persistence across sessions (IndexedDB survives).
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
console.log('after reload, track still present:', await page.getByText('Imported Test').count())

await page.screenshot({ path: resolve(here, '../screenshots/07-imported.png') })
await browser.close()
console.log('done')
