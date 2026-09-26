// End-to-end check of podcasts against the real network: search → follow →
// play → speed → position saved → resume after reload → download → offline
// play. Also checks that a long imported track gets podcast controls.
// Starts its own Vite dev server, so just: node scripts/test-podcasts.mjs
import { chromium, devices } from 'playwright'
import { createServer } from 'vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const server = await createServer({ root: resolve(here, '..'), server: { port: 5191, strictPort: true }, logLevel: 'error' })
await server.listen()
const base = 'http://localhost:5191'

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failed++
}
const audio = (fn) => page.evaluate(fn)
const readEpisodes = () => page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('melody')
  r.onsuccess = () => {
    const q = r.result.transaction('episodes').objectStore('episodes').getAll()
    q.onsuccess = () => res(q.result)
  }
}))

try {
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Podcasts' }).click()
  await page.getByRole('button', { name: '+ Add' }).click()
  await page.getByPlaceholder('Search podcasts').fill('the daily new york times')
  await page.locator('.subbtn').first().waitFor({ timeout: 15000 })
  const firstResult = await page.locator('.row__title').first().textContent()
  check('iTunes search returns shows', !!firstResult, firstResult)

  await page.locator('.subbtn').first().click()
  await page.locator('.eprow').first().waitFor({ timeout: 30000 })
  const epCount = await page.locator('.eprow').count()
  check('follow loads episodes from the RSS feed', epCount > 5, `${epCount} episodes`)

  // Play the newest episode and open Now Playing.
  await page.locator('.eprow .row__main').first().click()
  await page.waitForFunction(() => { const a = document.querySelector('audio'); return a && a.currentTime > 0.5 }, null, { timeout: 30000 })
  check('episode streams', true)
  await page.locator('.mini').click()
  check('Now Playing shows skip buttons', await page.getByLabel('Forward 30 seconds').isVisible())
  check('Now Playing shows speed pill instead of repeat', await page.locator('.speedbtn').isVisible())

  await page.locator('.speedbtn').click()
  const rate = await audio(() => document.querySelector('audio').playbackRate)
  check('speed pill sets playbackRate', rate === 1.25, `rate ${rate}`)

  await page.getByLabel('Forward 30 seconds').click()
  await page.getByLabel('Forward 30 seconds').click()
  await page.getByLabel('Forward 30 seconds').click()
  const t = await audio(() => document.querySelector('audio').currentTime)
  check('skip forward moves 30s per tap', t >= 90, `t=${t.toFixed(1)}`)

  await page.locator('.now .playbtn').click()
  await page.waitForTimeout(500)
  const saved = (await readEpisodes()).find((e) => e.position > 0)
  check('pausing saves the position', saved && Math.abs(saved.position - t) < 5, saved ? `saved ${saved.position.toFixed(1)}` : 'none saved')

  // Reload: the episode should be in Continue listening and resume in place.
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Podcasts' }).click()
  const cont = page.locator('.continue .eprow')
  await cont.first().waitFor({ timeout: 5000 })
  check('Continue listening lists it after reload', await cont.count() === 1, await cont.first().locator('.row__artist').textContent())
  await cont.first().locator('.row__main').click()
  await page.waitForFunction(() => { const a = document.querySelector('audio'); return a && a.currentTime > 60 }, null, { timeout: 30000 }).catch(() => {})
  const resumed = await audio(() => document.querySelector('audio').currentTime)
  check('playback resumes at the saved spot', resumed >= saved.position - 2, `t=${resumed.toFixed(1)}`)
  const rate2 = await audio(() => document.querySelector('audio').playbackRate)
  check('speed survives reload', rate2 === 1.25, `rate ${rate2}`)
  await page.locator('.mini').getByLabel('Pause').click()

  // Download the newest episode, then play it with the network cut.
  await page.locator('.showrow').first().click()
  const row = page.locator('.eprow').first()
  await row.getByLabel('Download').click()
  await page.waitForFunction(() => document.querySelector('.eprow .row__artist')?.textContent.includes('Downloaded'), null, { timeout: 180000 })
  check('download completes', true)
  await ctx.setOffline(true)
  await row.locator('.row__main').click()
  await page.waitForFunction(() => { const a = document.querySelector('audio'); return a && a.src.startsWith('blob:') && !a.paused }, null, { timeout: 15000 }).catch(() => {})
  const src = await audio(() => document.querySelector('audio').src)
  check('downloaded episode plays offline from local storage', src.startsWith('blob:'), src.slice(0, 30))
  await ctx.setOffline(false)

  // A long imported track (a 21-minute silent WAV) gets podcast controls.
  await page.getByRole('button', { name: 'Library' }).click()
  const sec = 21 * 60, rateHz = 8000
  const wav = Buffer.alloc(44 + sec * rateHz)
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + sec * rateHz, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rateHz, 24); wav.writeUInt32LE(rateHz, 28); wav.writeUInt16LE(1, 32); wav.writeUInt16LE(8, 34)
  wav.write('data', 36); wav.writeUInt32LE(sec * rateHz, 40); wav.fill(128, 44)
  await page.locator('input[type=file]').setInputFiles({ name: 'Long Talk - Interview.wav', mimeType: 'audio/wav', buffer: wav })
  await page.getByText('Interview').first().waitFor({ timeout: 15000 })
  await page.getByText('Interview').first().click()
  await page.locator('.mini').click()
  check('long imported track gets skip buttons', await page.getByLabel('Back 15 seconds').isVisible())

  await page.screenshot({ path: resolve(here, '../screenshots/10-podcast-now-playing.png') })
} catch (e) {
  console.log('ERROR:', e.message)
  failed++
} finally {
  await browser.close()
  await server.close()
}
console.log(failed ? `${failed} check(s) failed` : 'all checks passed')
process.exit(failed ? 1 : 0)
