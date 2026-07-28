/** Summarize a track list: "5 tracks · 12 min" (or "· 48 sec" when short). */
export function summarize(tracks) {
  const n = tracks.length
  const total = tracks.reduce((s, t) => s + (t.duration || 0), 0)
  const count = `${n} ${n === 1 ? 'track' : 'tracks'}`
  if (!total) return count
  const dur = total >= 60 ? `${Math.round(total / 60)} min` : `${Math.round(total)} sec`
  return `${count} · ${dur}`
}

/** 10260 → "2 hr 51 min", 2880 → "48 min", 42 → "42 sec". Returns '' for
    null/0/NaN so callers can render the bare count, mirroring summarize. */
export function formatTotalDuration(totalSeconds) {
  if (!totalSeconds || Number.isNaN(totalSeconds)) return ''
  const s = Math.floor(totalSeconds)
  if (s >= 3600) {
    // Round to whole minutes first so 59.5 leftover minutes carries into the
    // hour instead of rendering as "1 hr 60 min".
    const mins = Math.round(s / 60)
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m ? `${h} hr ${m} min` : `${h} hr`
  }
  if (s >= 60) return `${Math.round(s / 60)} min`
  return `${s} sec`
}

/** 73 → "1:13", 605 → "10:05", 3661 → "1:01:01". Handles null/NaN gracefully. */
export function formatTime(sec) {
  if (sec == null || Number.isNaN(sec)) return '0:00'
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = (s % 60).toString().padStart(2, '0')
  if (h) return `${h}:${m.toString().padStart(2, '0')}:${r}`
  return `${m}:${r}`
}
