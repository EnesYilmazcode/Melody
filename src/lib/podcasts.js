import { useSyncExternalStore } from 'react'
import { db, savePodcast, saveEpisodeAudio } from './db'

// ── Podcasts: search, RSS, downloads ────────────────────────────────────────
// Search goes through Apple's public iTunes Search API (CORS-enabled, no key).
// Most feed hosts also send CORS headers, so feeds are fetched directly; the
// few that don't fall back to a public read-only proxy.

const PROXY = 'https://api.allorigins.win/raw?url='
const MAX_EPISODES = 200 // per show; older back catalog isn't worth the storage
const STALE_MS = 60 * 60 * 1000

/** Anything this long is treated as long-form (resume, speed, skip buttons). */
export const LONG_FORM_SEC = 20 * 60
export const isLongForm = (item) =>
  !!item && (item.kind === 'episode' || (item.duration || 0) >= LONG_FORM_SEC)

export async function searchPodcasts(term) {
  const url = `https://itunes.apple.com/search?media=podcast&entity=podcast&limit=20&term=${encodeURIComponent(term)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`search-${res.status}`)
  const { results = [] } = await res.json()
  return results
    .filter((r) => r.feedUrl)
    .map((r) => ({
      id: httpsUrl(r.feedUrl),
      title: r.collectionName,
      author: r.artistName,
      image: r.artworkUrl600 || r.artworkUrl100 || null,
    }))
}

/** Fetch, parse and store a feed. Returns the show. Used to subscribe and refresh. */
export async function subscribe(feedUrl) {
  const url = httpsUrl(feedUrl.trim())
  const xml = await fetchText(url)
  const { show, episodes } = parseFeed(xml, url)
  await savePodcast(show, episodes)
  return show
}

/** Refresh shows not fetched in the last hour. Failures are skipped (offline, feed down). */
export async function refreshStale() {
  const shows = await db.podcasts.toArray()
  for (const s of shows) {
    if (Date.now() - (s.refreshedAt || 0) < STALE_MS) continue
    await subscribe(s.id).catch(() => {})
  }
}

// Feeds are fetched from the page, and a mixed-content http:// request would
// be blocked outright, so upgrade first. Nearly every host serves both.
function httpsUrl(url) {
  return url.replace(/^http:\/\//i, 'https://')
}

async function fetchText(url) {
  try {
    const res = await fetch(url)
    if (res.ok) return await res.text()
  } catch {
    // CORS or network failure; try the proxy below
  }
  const res = await fetch(PROXY + encodeURIComponent(url))
  if (!res.ok) throw new Error(`feed-${res.status}`)
  return res.text()
}

// ── RSS parsing ─────────────────────────────────────────────────────────────

export function parseFeed(xmlText, feedUrl) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const channel = doc.querySelector('channel')
  if (!channel || doc.querySelector('parsererror')) throw new Error('not-a-feed')

  const show = {
    id: feedUrl,
    title: text(channel, 'title') || 'Untitled podcast',
    author: text(channel, 'itunes:author') || '',
    image: attr(channel, 'itunes:image', 'href') || text(child(channel, 'image'), 'url') || null,
  }

  const episodes = []
  for (const item of channel.getElementsByTagName('item')) {
    const enclosure = item.getElementsByTagName('enclosure')[0]
    const audioUrl = enclosure?.getAttribute('url')
    if (!audioUrl) continue // text-only posts
    const guid = text(item, 'guid') || audioUrl
    const pub = Date.parse(text(item, 'pubDate'))
    episodes.push({
      id: `ep-${hash(feedUrl)}${hash(guid)}`,
      podcastId: feedUrl,
      title: text(item, 'title') || 'Untitled episode',
      audioUrl: httpsUrl(audioUrl),
      duration: parseDuration(text(item, 'itunes:duration')),
      pubDate: Number.isFinite(pub) ? pub : 0,
      image: attr(item, 'itunes:image', 'href') || null,
      summary: plain(text(item, 'itunes:summary') || text(item, 'description')).slice(0, 400),
    })
  }
  episodes.sort((a, b) => b.pubDate - a.pubDate)
  return { show, episodes: episodes.slice(0, MAX_EPISODES) }
}

// Direct children only, so an item's <title> never picks up a nested one.
function child(el, tag) {
  if (!el) return null
  for (const c of el.children) if (c.tagName === tag) return c
  return null
}
const text = (el, tag) => child(el, tag)?.textContent.trim() || ''
const attr = (el, tag, name) => child(el, tag)?.getAttribute(name) || ''

function plain(html) {
  if (!html) return ''
  return new DOMParser().parseFromString(html, 'text/html').body.textContent.replace(/\s+/g, ' ').trim()
}

/** "1:02:03" | "62:03" | "3723" → seconds. */
export function parseDuration(s) {
  if (!s) return 0
  const parts = s.split(':').map(Number)
  if (parts.some((n) => Number.isNaN(n))) return 0
  return Math.round(parts.reduce((acc, n) => acc * 60 + n, 0))
}

// FNV-1a, 8 hex chars. Only needs to be stable, not secure.
function hash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** Shape an episode like a track so the player can take it. */
export function toPlayable(ep, show) {
  return {
    id: ep.id,
    kind: 'episode',
    podcastId: ep.podcastId,
    title: ep.title,
    artist: show?.title || '',
    duration: ep.duration,
    thumbnailUrl: ep.image || show?.image || null,
    src: ep.audioUrl,
  }
}

// ── Downloads ───────────────────────────────────────────────────────────────
// In-flight progress lives outside React so it survives switching tabs.
// progress: { [episodeId]: 0..1, or -1 while the size is unknown }

let progress = {}
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())
const setProgress = (id, v) => {
  progress = { ...progress }
  if (v === undefined) delete progress[id]
  else progress[id] = v
  emit()
}

const subscribeDownloads = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useDownloads() {
  return useSyncExternalStore(subscribeDownloads, () => progress)
}

// Episode URLs are often wrapped in ad-measurement redirects
// (dts.podtrac.com/redirect.mp3/pdst.fm/e/…/real-host/file.mp3), and one hop
// without CORS headers fails the whole fetch. Each prefix just forwards to
// the rest of the path, so peeling them off reaches the real host directly.
const TRACKING_PREFIXES = [
  /^(dts\.|www\.)?podtrac\.com\/(pts\/)?redirect\.(mp3|m4a|aac)\//,
  /^pdst\.fm\/e\//,
  /^pfx\.vpixl\.com\/[^/]+\//,
  /^(pscrb\.fm|verifi\.podscribe\.com)\/rss\/p\//,
  /^(chrt\.fm|chtbl\.com)\/track\/[^/]+\//,
  /^clrtpod\.com\/m\//,
  /^mgln\.ai\/e\/[^/]+\//,
  /^arttrk\.com\/p\/[^/]+\//,
  /^op3\.dev\/e(,[^/]*)?\//,
  /^prfx\.byspotify\.com\/e\//,
  /^pdcn\.co\/e\//,
  /^tracking\.swap\.fm\/track\/[^/]+\//,
]

export function unwrapTracking(url) {
  let rest = url.replace(/^https?:\/\//i, '')
  for (let changed = true; changed;) {
    changed = false
    for (const re of TRACKING_PREFIXES) {
      if (re.test(rest)) {
        rest = rest.replace(re, '')
        changed = true
      }
    }
  }
  return `https://${rest}`
}

async function fetchAudio(url) {
  try {
    const res = await fetch(url)
    if (res.ok) return res
  } catch {
    // a redirect hop without CORS; retry past the trackers below
  }
  const direct = unwrapTracking(url)
  // Still throws for hosts that send no CORS headers at all. Those episodes
  // stream fine; they just can't be saved for offline.
  if (direct === url) throw new Error('download-blocked')
  const res = await fetch(direct)
  if (!res.ok) throw new Error(`download-${res.status}`)
  return res
}

export async function downloadEpisode(ep) {
  if (progress[ep.id] !== undefined) return
  setProgress(ep.id, -1)
  try {
    const res = await fetchAudio(ep.audioUrl)
    const total = Number(res.headers.get('content-length')) || 0
    const reader = res.body.getReader()
    const chunks = []
    let got = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      got += value.length
      if (total) setProgress(ep.id, got / total)
    }
    const type = res.headers.get('content-type') || 'audio/mpeg'
    await saveEpisodeAudio(ep.id, new Blob(chunks, { type }))
  } finally {
    setProgress(ep.id, undefined)
  }
}
