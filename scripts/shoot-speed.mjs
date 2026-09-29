// Now Playing's speed control applies to every track and survives a reload.
// node scripts/shoot-speed.mjs
import { chromium, devices } from 'playwright'
import { createServer } from 'vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const shot = (name) => resolve(here, `../screenshots/${name}.png`)
const server = await createServer({ root: resolve(here, '..'), server: { port: 5193, strictPort: true }, logLevel: 'error' })
await server.listen()

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage()
try {
  await page.goto('http://localhost:5193', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.locator('.row__main').first().click()
  await page.waitForTimeout(600)
  await page.locator('.mini').click()
  await page.waitForTimeout(600)
  await page.getByLabel('More').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: shot('15-speed-1x') })

  await page.getByRole('radio', { name: '1.5x speed' }).click()
  await page.waitForTimeout(400)
  const rate = await page.evaluate(() => document.querySelector('audio').playbackRate)
  console.log('playbackRate on a regular track:', rate)
  await page.screenshot({ path: shot('16-speed-1.5x') })

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.locator('.row__main').nth(1).click()
  await page.waitForTimeout(800)
  console.log('after reload, saved:', await page.evaluate(() => localStorage.getItem('melody.speed')),
    'rate:', await page.evaluate(() => document.querySelector('audio').playbackRate))
} finally {
  await browser.close()
  await server.close()
}
