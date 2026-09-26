// Screenshots of every screen on the production build, with sample songs.
// node scripts/shoot-audit.mjs <output-folder>
import { chromium, devices } from 'playwright'
import { preview } from 'vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = process.argv[2]
mkdirSync(outDir, { recursive: true })
const server = await preview({ root: resolve(here, '..'), base: '/melody/', preview: { port: 5194, strictPort: true }, logLevel: 'error' })
const base = 'http://localhost:5194/melody/'

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
const logs = []
page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message))
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 200)) })
let i = 0
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `${outDir}/${String(++i).padStart(2, '0')}-${name}.png` }) }

function wav(seconds, hz) {
  const rate = 8000, n = seconds * rate
  const b = Buffer.alloc(44 + n)
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22)
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34)
  b.write('data', 36); b.writeUInt32LE(n, 40)
  for (let k = 0; k < n; k++) b[44 + k] = 128 + Math.round(10 * Math.sin((2 * Math.PI * hz * k) / rate))
  return b
}
const songs = [
  ['Daft Punk - Get Lucky [5NV6Rdv1a3I]', 248], ['The Weeknd - Blinding Lights [4NRXx6U8ABQ]', 200],
  ['Coldplay - Viva La Vida [dvgZkm1xWPE]', 242], ['Queen - Bohemian Rhapsody [fJ9rUzIMcZQ]', 355],
  ['Adele - Rolling in the Deep [rYEDA3JcQqw]', 234], ['Kendrick Lamar - HUMBLE. [tvTRZJ-4EyI]', 177],
  ['Tame Impala - The Less I Know The Better [2SUwOgmvzK4]', 216], ['Fleetwood Mac - Dreams [mrZRURcb1cM]', 257],
  ['Long Talk - Deep Work Interview [dQw4w9WgXcQ]', 1500],
]

try {
  await page.goto(base, { waitUntil: 'networkidle' })
  await shot('library-first-run')
  await page.getByRole('button', { name: 'Search' }).click(); await shot('search-empty')
  await page.getByRole('button', { name: 'Playlists' }).click(); await shot('playlists-empty')
  await page.getByRole('button', { name: 'Podcasts' }).click(); await shot('podcasts-empty')

  await page.getByRole('button', { name: 'Library' }).click()
  await page.locator('input[type=file]').setInputFiles(songs.map(([n, s], k) => ({ name: n + '.wav', mimeType: 'audio/wav', buffer: wav(Math.min(s, 60), 220 + k * 30) })))
  await page.waitForFunction(() => document.querySelectorAll('.row').length >= 9, null, { timeout: 60000 })
  await page.waitForTimeout(2500)
  await shot('library-imported')
  await page.getByRole('button', { name: 'Favorites' }).click(); await shot('library-favorites-empty')
  await page.getByRole('button', { name: 'All' }).click()
  await page.locator('.row').nth(1).getByLabel('Favorite').click()

  await page.getByRole('button', { name: 'Search' }).click()
  await page.locator('.searchbar__input').fill('queen'); await shot('search-results')
  await page.locator('.searchbar__input').fill('zzz nothing'); await shot('search-no-match')
  await page.locator('.searchbar__input').fill('https://youtu.be/kJQP7kiw5Fk?si=abc'); await page.waitForTimeout(2000); await shot('search-youtube-link')

  await page.getByRole('button', { name: 'Library' }).click()
  await page.locator('.row__main').first().click()
  await page.waitForTimeout(1500); await shot('library-playing-mini')
  await page.locator('.mini').click(); await shot('now-playing')
  await page.getByLabel('Lyrics').click(); await page.waitForTimeout(2500); await shot('lyrics')
  await page.getByLabel('Lyrics').click()
  await page.getByLabel('Minimize').click()

  await page.locator('.row').nth(2).getByLabel('Add to playlist').click(); await shot('add-to-playlist-sheet')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Playlists' }).click()
  await page.getByRole('button', { name: '+ New' }).click(); await shot('new-playlist-modal')
  await page.locator('.modal__input').fill('Road Trip'); await page.getByRole('button', { name: 'Create' }).click()
  await shot('playlist-detail-empty')
  await page.getByRole('button', { name: 'Library' }).click()
  for (const k of [0, 2, 3, 5]) {
    await page.locator('.row').nth(k).getByLabel('Add to playlist').click()
    await page.getByRole('button', { name: /Road Trip/ }).click()
    await page.waitForTimeout(300)
    if (await page.locator('.sheet').count()) await page.keyboard.press('Escape')
  }
  await page.getByRole('button', { name: 'Playlists' }).click(); await shot('playlists-list')
  await page.getByText('Road Trip').click(); await shot('playlist-detail')
  await page.locator('.phead').getByLabel('Playlist options').click(); await shot('playlist-actions-sheet')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Library' }).click()
  await page.getByText('Deep Work Interview').click(); await page.waitForTimeout(1200)
  await page.locator('.mini').click(); await shot('now-playing-longform')
  await page.getByLabel('Minimize').click()
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await shot('library-bottom')
} catch (e) {
  logs.push('SCRIPT ' + e.message.split('\n')[0])
} finally {
  console.log(logs.join('\n') || 'no console errors')
  await browser.close()
  server.httpServer.close()
}
