// Screens for the UI overhaul at iPhone sizes, with a seeded library.
// node scripts/shoot-overhaul.mjs [outDir]
import { chromium, devices } from 'playwright'
import { createServer } from 'vite'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(process.argv[2] || resolve(here, '../screenshots'))
mkdirSync(out, { recursive: true })
const shot = (page, name) => page.screenshot({ path: resolve(out, `${name}.png`) })
const PORT = 5211
const server = await createServer({ root: resolve(here, '..'), server: { port: PORT, strictPort: true }, logLevel: 'error' })
await server.listen()

const SONGS = [
  ['dQw4w9WgXcQ', 'Never Gonna Give You Up', 213, 1],
  ['fJ9rUzIMcZQ', 'Bohemian Rhapsody', 355, 1],
  ['hTWKbfoikeg', 'Smells Like Teen Spirit', 301, 0],
  ['YkgkThdzX-8', 'Imagine', 183, 0],
  ['btPJPFnesV4', 'Eye of the Tiger', 244, 0],
  ['kXYiU_JCYtU', 'Numb', 187, 1],
  ['1w7OgIMMRc4', "Sweet Child O' Mine", 356, 0],
  ['Zi_XLOBDo_Y', 'Billie Jean', 294, 0],
]
const SERIES = [['001', 'Welcome', 60], ['018', 'Long Talk', 3852], ['036', 'Interview', 1320], ['037', 'Wrap Up', 1651]]

async function seed(page) {
  await page.evaluate(async ({ SONGS, SERIES }) => {
    const { db } = await import('/src/lib/db.js')
    await db.tracks.clear()
    await db.playlists.clear()
    const now = Date.now()
    const rows = []
    const sample = (i) => ({ src: `/samples/sample-${'abcde'[i % 5]}.wav`, srcType: 'url' })
    SERIES.forEach(([n, name, d], i) => rows.push({
      id: `q-${n}`, title: `${n} ${name}`, artist: 'Imported', duration: d, thumbnailUrl: null,
      starred: 0, playCount: 0, dateAdded: now - (n === '037' ? 0 : n === '018' ? 3000 : 90000 + i), ...sample(i),
    }))
    SONGS.forEach(([id, title, d, star], i) => rows.push({
      id: `yt-${id}`, title, artist: 'Imported', duration: d, youtubeId: id,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, starred: star, playCount: 0,
      dateAdded: now - (i < 2 ? 1000 + i : 4000 + i), ...sample(i),
    }))
    await db.tracks.bulkAdd(rows)
    await db.playlists.add({ name: 'Morning Show', trackIds: SERIES.map(([n]) => `q-${n}`), createdAt: now })
    await db.playlists.add({ name: 'Gym', trackIds: SONGS.slice(2, 7).map(([id]) => `yt-${id}`), createdAt: now - 5 })
    await db.playlists.add({ name: 'Road trip', trackIds: [`yt-${SONGS[0][0]}`], createdAt: now - 10 })
  }, { SONGS, SERIES })
}

async function open(size) {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
  const ctx = await browser.newContext(size)
  // Emulate the notch and home indicator the headless browser doesn't have.
  await ctx.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.setProperty('--sat', '47px')
      document.documentElement.style.setProperty('--sab', '34px')
    })
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await seed(page)
  await page.waitForTimeout(800)
  return { browser, page }
}

// Mouse drag of `dy` px starting at the element's center.
async function drag(page, sel, dy) {
  const b = await page.locator(sel).first().boundingBox()
  const x = b.x + b.width / 2
  const y = b.y + Math.min(b.height / 2, 200)
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(x, y + (dy * i) / 8)
  await page.mouse.up()
}

const tab = (page, name) => page.locator('.tabs').getByRole('button', { name }).click()

const { browser, page } = await open({ ...devices['iPhone 13'] })
try {
  // Play episode 037 from its playlist so "Playing from" names it.
  await tab(page, 'Playlists')
  await page.waitForTimeout(400)
  await shot(page, '06-playlists')
  await page.locator('.plcard', { hasText: 'Morning Show' }).click()
  await page.waitForTimeout(500)
  await page.locator('.row__title', { hasText: 'Wrap Up' }).click()
  await page.waitForTimeout(900)
  await shot(page, '07-playlist-detail')

  await tab(page, 'Library')
  await page.waitForTimeout(600)
  await shot(page, '01-library')

  await page.locator('.mini').click()
  await page.waitForTimeout(900)
  await shot(page, '03-np-series')

  await page.getByLabel('More').click()
  await page.waitForTimeout(600)
  await page.getByRole('radio', { name: '1.5x speed' }).click()
  await page.waitForTimeout(300)
  await shot(page, '05-np-menu')
  console.log('rate after 1.5:', await page.evaluate(() => document.querySelector('audio').playbackRate))
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.waitForTimeout(600)

  // Drag down past the threshold closes Now Playing.
  await drag(page, '.now__art', 260)
  await page.waitForTimeout(700)
  console.log('now open after drag-down:', await page.locator('.now').count())

  // A short drag springs back.
  await page.locator('.mini').click()
  await page.waitForTimeout(700)
  await drag(page, '.now__art', 60)
  await page.waitForTimeout(700)
  console.log('now open after short drag:', await page.locator('.now').count())
  await page.keyboard.press('Escape')
  await page.waitForTimeout(700)

  // A regular song, played from the library.
  await page.locator('.row__title', { hasText: 'Never Gonna' }).click()
  await page.waitForTimeout(1500)
  // swipe up on the mini player opens Now Playing
  await drag(page, '.mini__t', -80)
  await page.waitForTimeout(1200)
  console.log('now open after mini swipe-up:', await page.locator('.now').count())
  console.log('rate on next track:', await page.evaluate(() => document.querySelector('audio').playbackRate))
  await shot(page, '02-np-song')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(700)

  await page.getByLabel('Library options').click()
  await page.waitForTimeout(600)
  await shot(page, '04-library-menu')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.waitForTimeout(500)

  // Hold a row for the track sheet.
  await page.locator('.row__title', { hasText: 'Imagine' }).click({ button: 'right' })
  await page.waitForTimeout(600)
  await shot(page, '09-track-sheet')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.waitForTimeout(500)

  await tab(page, 'Search')
  await page.waitForTimeout(300)
  await shot(page, '08b-search-idle')
  await page.locator('.searchbar__input').fill('ne')
  await page.waitForTimeout(500)
  await shot(page, '08-search')
} finally {
  await browser.close()
}

// iPhone SE: the long-form Now Playing has the most to fit.
{
  const { browser, page } = await open({ ...devices['iPhone SE (3rd gen)'] })
  try {
    await page.locator('.row__title', { hasText: 'Wrap Up' }).click()
    await page.waitForTimeout(900)
    await page.locator('.mini').click()
    await page.waitForTimeout(900)
    await shot(page, '10-se-np-series')
  } finally {
    await browser.close()
  }
}
await server.close()
