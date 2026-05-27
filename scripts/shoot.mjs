// Screenshot harness: renders Melody at iPhone-14 size and captures each page
// so the design can be reviewed and iterated from real renders.
// Usage: node scripts/shoot.mjs [baseUrl]   (default http://localhost:5180)
import { chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const base = process.argv[2] || 'http://localhost:5180'
const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../screenshots')
mkdirSync(outDir, { recursive: true })

// iPhone 14 ≈ 390x844 @3x. Playwright's iPhone 13 profile matches closely.
const iphone = devices['iPhone 13']

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...iphone })
const page = await ctx.newPage()

const shot = async (name) => {
  await page.screenshot({ path: resolve(outDir, `${name}.png`) })
  console.log('shot', name)
}
const tap = async (text) => page.getByText(text, { exact: false }).first().click()
const wait = (ms) => page.waitForTimeout(ms)

await page.goto(base, { waitUntil: 'networkidle' })
await wait(800) // let seed + fonts settle

// Library (default tab)
await shot('01-library')

// Favorites filter
try { await page.getByRole('button', { name: /Favorites/i }).click(); await wait(300); await shot('02-favorites') } catch {}

// Search with a query
await page.getByRole('button', { name: /^Search$/ }).click()
await wait(200)
await page.getByPlaceholder(/Search/i).fill('subway')
await wait(400)
await shot('03-search')

// Track actions sheet (⋯ on a track) — from Library
await page.getByRole('button', { name: /^Library$/ }).click()
await wait(200)
await page.getByLabel('Add to playlist').first().click()
await wait(300)
await shot('03b-track-actions')
await page.getByRole('button', { name: /^Cancel$/ }).click()
await wait(200)

// Playlists
await page.getByRole('button', { name: /^Playlists$/ }).click()
await wait(200)
await shot('04-playlists')

// Create a playlist via the modal, landing on its (empty) detail page
await page.getByRole('button', { name: /\+ New/ }).click()
await wait(300)
await page.locator('.modal__input').fill('Subway Mix')
await shot('04b-new-playlist-modal')
await page.getByRole('button', { name: /^Create$/ }).click()
await wait(400)
await shot('04c-playlist-detail')

// Playlist options (⋯) sheet from inside the detail view
await page.getByLabel('Playlist options').click()
await wait(300)
await shot('04d-playlist-actions')
await page.getByRole('button', { name: /^Cancel$/ }).click()
await wait(200)

// Back to the list, then long-press (right-click) a card to open actions
await page.getByLabel('Back').click()
await wait(200)
await page.locator('.plcard').first().click({ button: 'right' })
await wait(300)
await shot('04e-longpress-actions')
await page.getByRole('button', { name: /^Cancel$/ }).click()
await wait(200)

// Play a track, capture mini-player, then expand to Now Playing
await page.getByRole('button', { name: /^Library$/ }).click()
await wait(200)
await page.locator('.row__main').first().click()
await wait(600)
await shot('05-miniplayer')
await page.locator('.mini').click()
await wait(600)
await shot('06-nowplaying')

await browser.close()
console.log('\nScreenshots in screenshots/')
