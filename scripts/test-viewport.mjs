// Simulates the iOS home-screen bug: the web view lays out 48px shorter than
// the screen. Installed, the tab bar must still reach the screen bottom.
import { chromium, devices } from 'playwright'
import { createServer } from 'vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const server = await createServer({ root: resolve(here, '..'), server: { port: 5194, strictPort: true }, logLevel: 'error' })
await server.listen()
const browser = await chromium.launch()
let failed = false
try {
  for (const standalone of [true, false]) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 796 }, screen: { width: 390, height: 844 } })
    if (standalone) await ctx.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }))
    const page = await ctx.newPage()
    await page.goto('http://localhost:5194', { waitUntil: 'networkidle' })
    const want = standalone ? 844 : 796
    const check = async (name, sel) => {
      const bottom = await page.evaluate((s) => Math.round(document.querySelector(s).getBoundingClientRect().bottom), sel)
      const ok = bottom === want
      failed ||= !ok
      console.log(`${ok ? 'PASS' : 'FAIL'} ${standalone ? 'installed' : 'browser'}: ${name} bottom ${bottom}, want ${want}`)
    }
    await check('tab bar', '.dock')
    await page.getByLabel('Library options').click()
    await page.waitForTimeout(500)
    await check('sheet overlay', '.overlay, .sheet-overlay, [class*=overlay]')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Cancel' }).click().catch(() => {})
    await page.waitForTimeout(500)
    await page.locator('.row__main').first().click()
    await page.waitForTimeout(500)
    await page.locator('.mini').click()
    await page.waitForTimeout(700)
    await check('now playing', '.now')
    await ctx.close()
  }
} finally {
  await browser.close()
  await server.close()
}
if (failed) process.exit(1)
