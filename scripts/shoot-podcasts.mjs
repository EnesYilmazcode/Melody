// Screenshots of the Podcasts tab: search results, a show's episode list,
// and the tab with Continue listening. node scripts/shoot-podcasts.mjs
import { chromium, devices } from 'playwright'
import { createServer } from 'vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const shot = (name) => resolve(here, `../screenshots/${name}.png`)
const server = await createServer({ root: resolve(here, '..'), server: { port: 5192, strictPort: true }, logLevel: 'error' })
await server.listen()

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage()
try {
  await page.goto('http://localhost:5192', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Podcasts' }).click()
  await page.getByRole('button', { name: '+ Add' }).click()
  await page.getByPlaceholder('Search podcasts').fill('huberman')
  await page.locator('.subbtn').first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: shot('11-podcast-search') })

  await page.locator('.subbtn').first().click()
  await page.locator('.eprow').first().waitFor({ timeout: 30000 })
  await page.locator('.eprow .row__main').nth(1).click()
  await page.waitForFunction(() => document.querySelector('audio')?.currentTime > 0.5, null, { timeout: 30000 })
  await page.evaluate(() => { const a = document.querySelector('audio'); a.currentTime = 600 })
  await page.waitForTimeout(1500)
  await page.locator('.mini').getByLabel('Pause').click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: shot('12-podcast-show') })

  await page.getByLabel('Back').click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: shot('13-podcasts-tab') })
} finally {
  await browser.close()
  await server.close()
}
