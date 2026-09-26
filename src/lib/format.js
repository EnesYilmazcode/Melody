/** Summarize a track list: "5 tracks · 12 min" (or "· 48 sec" when short). */
export function summarize(tracks) {
  const n = tracks.length
  const total = tracks.reduce((s, t) => s + (t.duration || 0), 0)
  const count = `${n} ${n === 1 ? 'track' : 'tracks'}`
  if (!total) return count
  const dur = total >= 60 ? `${Math.round(total / 60)} min` : `${Math.round(total)} sec`
  return `${count} · ${dur}`
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

/** Remaining listening time, rounded to minutes: "42m left", "1h 5m left". */
export function timeLeft(duration, position) {
  const m = Math.max(1, Math.round(((duration || 0) - (position || 0)) / 60))
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m left` : `${m}m left`
}
