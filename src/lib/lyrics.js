import { db } from './db'

// Strip the cruft YouTube titles carry so lyric lookups actually match:
// "(Official Video)", "[4K]", "feat. …", trailing "lyrics/audio/HD", etc.
export function cleanTitle(title = '') {
  return title
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(official|video|audio|lyrics?|music|hd|hq|4k|mv|visualizer|remaster(ed)?)\b/gi, ' ')
    .replace(/\bfeat\.?\b.*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Parse LRC ("[mm:ss.xx] line") into sorted {time(sec), text} entries.
export function parseLRC(lrc) {
  if (!lrc) return null
  const out = []
  for (const raw of lrc.split('\n')) {
    const m = raw.match(/^((?:\[\d{1,2}:\d{1,2}(?:\.\d{1,3})?\])+)(.*)$/)
    if (!m) continue
    const text = m[2].trim()
    for (const stamp of m[1].match(/\[\d{1,2}:\d{1,2}(?:\.\d{1,3})?\]/g) || []) {
      const t = stamp.match(/\[(\d{1,2}):(\d{1,2}(?:\.\d{1,3})?)\]/)
      if (t) out.push({ time: parseInt(t[1], 10) * 60 + parseFloat(t[2]), text })
    }
  }
  out.sort((a, b) => a.time - b.time)
  return out.length ? out : null
}

const norm = (s = '') => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Search LRCLIB and return the best-scored candidate (or null). The scoring
// leans hard on duration — the track's length is a strong fingerprint — plus
// title exactness and whether synced lyrics exist.
async function searchScored(query, title, dur) {
  let arr
  try {
    const r = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`)
    if (!r.ok) return null
    arr = await r.json()
  } catch {
    return null
  }
  if (!Array.isArray(arr) || !arr.length) return null
  const wt = norm(title)
  const scored = arr.map((it) => ({
    it,
    durDiff: dur ? Math.abs((it.duration || 0) - dur) : 999,
    titleRank: norm(it.trackName) === wt ? 0 : norm(it.trackName).includes(wt) ? 1 : 2,
    noSynced: it.syncedLyrics ? 0 : 1,
  }))
  scored.sort((a, b) => a.titleRank - b.titleRank || a.durDiff - b.durDiff || a.noSynced - b.noSynced)
  return scored[0]
}

// LRCLIB: free, no key, CORS-friendly. Exact get (when we have an artist),
// else duration-scored search. Rejects wildly-wrong matches → "no lyrics"
// beats showing some random song's words.
async function lookup(track) {
  const artist = track.artist && track.artist !== 'Imported' ? track.artist : ''
  const title = cleanTitle(track.title)
  if (!title) return null
  const dur = Math.round(track.duration || 0)

  if (artist) {
    try {
      const p = new URLSearchParams({ track_name: title, artist_name: artist, duration: String(dur) })
      const r = await fetch(`https://lrclib.net/api/get?${p}`)
      if (r.ok) {
        const d = await r.json()
        if (d && (d.syncedLyrics || d.plainLyrics)) return d
      }
    } catch { /* fall through */ }
  }

  const candidates = []
  const withArtist = await searchScored(`${artist} ${title}`.trim(), title, dur)
  if (withArtist) candidates.push(withArtist)
  // If the artist-qualified search wasn't a confident hit, also try title-only.
  if (!withArtist || withArtist.durDiff > 5 || withArtist.titleRank === 2) {
    const titleOnly = await searchScored(title, title, dur)
    if (titleOnly) candidates.push(titleOnly)
  }
  if (!candidates.length) return null

  candidates.sort((a, b) => a.titleRank - b.titleRank || a.durDiff - b.durDiff || a.noSynced - b.noSynced)
  const best = candidates[0]
  // Sanity gate: a far-off duration AND a non-exact title means we're guessing.
  if (best.durDiff > 15 && best.titleRank > 0) return null
  return best.it
}

// Fetch + cache lyrics for a track if we haven't tried before. Always writes a
// record (even an empty one) so we don't re-hit the network every play.
export async function ensureLyrics(track) {
  const existing = await db.lyrics.get(track.id)
  if (existing) return existing
  const data = await lookup(track)
  const rec = {
    id: track.id,
    synced: parseLRC(data?.syncedLyrics),
    plain: data?.plainLyrics || null,
    fetchedAt: Date.now(),
  }
  await db.lyrics.put(rec)
  return rec
}

// Drop the cached entry and look again — for when the match was wrong.
export async function researchLyrics(track) {
  await db.lyrics.delete(track.id)
  return ensureLyrics(track)
}

// Index of the line that should be highlighted at time `t`.
export function activeLine(synced, t) {
  if (!synced) return -1
  let lo = 0
  let hi = synced.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (synced[mid].time <= t) { ans = mid; lo = mid + 1 } else hi = mid - 1
  }
  return ans
}
