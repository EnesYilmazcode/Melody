// Numbered imports become an ordered playlist, and a playlist resumes on the
// track and spot where you left it, across a reload.
// Starts its own Vite dev server: node scripts/test-series.mjs
import { chromium, devices } from 'playwright'
import { createServer } from 'vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const server = await createServer({ root: resolve(here, '..'), server: { port: 5193, strictPort: true }, logLevel: 'error' })
await server.listen()

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage()
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failed++
}

// A quiet 90-second 8 kHz WAV with a faint tone so each file is distinct.
function wav(seconds, hz) {
  const rate = 8000, n = seconds * rate
  const b = Buffer.alloc(44 + n)
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22)
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34)
  b.write('data', 36); b.writeUInt32LE(n, 40)
  for (let i = 0; i < n; i++) b[44 + i] = 128 + Math.round(8 * Math.sin((2 * Math.PI * hz * i) / rate))
  return b
}
const file = (name, hz) => ({ name, mimeType: 'audio/wav', buffer: wav(90, hz) })

try {
  await page.goto('http://localhost:5193', { waitUntil: 'networkidle' })
  // Picked out of order, and 10 sorts after 2 only when compared as numbers.
  await page.locator('input[type=file][multiple]').setInputFiles([
    file('Morning Show - 010 Wrap Up.wav', 300),
    file('Morning Show - 002 Second.wav', 320),
    file('Morning Show - 001 Welcome.wav', 340),
    file('Morning Show - 003 Third.wav', 360),
  ])
  await page.getByText('is ready, in order').waitFor({ timeout: 20000 })
  check('import reports the series playlist', true)

  await page.getByRole('button', { name: 'Playlists', exact: true }).click()
  await page.locator('.plcard', { hasText: 'Morning Show' }).click()
  // Numbered tracks show their number as the artwork tile, the title without it.
  const titles = await page.locator('.row__title').allTextContents()
  const tiles = await page.locator('.row .tile b').allTextContents()
  check('playlist is in episode order', titles.join(',') === 'Welcome,Second,Third,Wrap Up' && tiles.join(',') === '001,002,003,010', `${tiles.join(',')} / ${titles.join(',')}`)

  // Play the second episode, move 40s in, pause.
  await page.locator('.row__main').nth(1).click()
  await page.waitForFunction(() => document.querySelector('audio')?.currentTime > 0.3, null, { timeout: 10000 })
  await page.evaluate(() => { document.querySelector('audio').currentTime = 40 })
  await page.waitForTimeout(600)
  await page.locator('.mini').getByLabel('Pause').click()
  await page.waitForTimeout(500)

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Playlists', exact: true }).click()
  await page.locator('.plcard', { hasText: 'Morning Show' }).click()
  const resume = page.locator('.resume')
  await resume.waitFor({ timeout: 5000 })
  const label = await resume.textContent()
  check('Resume shows the right episode and time', label.includes('Second') && label.includes('0:40'), label)

  await resume.click()
  await page.waitForFunction(() => document.querySelector('audio')?.currentTime > 39, null, { timeout: 10000 }).catch(() => {})
  const t = await page.evaluate(() => document.querySelector('audio').currentTime)
  const title = await page.locator('.mini__title').textContent()
  check('Resume plays that episode from that spot', title === 'Second' && t >= 39, `${title} @ ${t.toFixed(1)}`)

  // Finishing an episode moves the bookmark to the next one.
  await page.evaluate(() => { const a = document.querySelector('audio'); a.currentTime = a.duration - 0.5 })
  await page.waitForFunction(() => document.querySelector('.mini__title')?.textContent === 'Third', null, { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(800)
  await page.locator('.mini').getByLabel('Pause').click()
  await page.waitForTimeout(500)
  const next = await page.locator('.resume').textContent()
  check('bookmark follows playback to the next episode', next.includes('Third'), next)
  await page.screenshot({ path: resolve(here, '../screenshots/14-series-resume.png') })

  // Re-importing the same files adds nothing and keeps one playlist.
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await page.locator('input[type=file][multiple]').setInputFiles([file('Morning Show - 001 Welcome.wav', 340)])
  await page.waitForTimeout(1500)
  // The tab keeps its place (the open playlist); step back to the list.
  await page.getByRole('button', { name: 'Playlists', exact: true }).click()
  await page.getByLabel('Back').click()
  await page.locator('.plcard').first().waitFor({ timeout: 5000 })
  const cards = await page.locator('.plcard').allTextContents()
  check('no duplicate playlist on re-import', cards.filter((c) => c.includes('Morning Show')).length === 1, cards.join(' / '))
} catch (e) {
  console.log('ERROR:', e.message)
  failed++
} finally {
  await browser.close()
  await server.close()
}
console.log(failed ? `${failed} check(s) failed` : 'all checks passed')
process.exit(failed ? 1 : 0)
