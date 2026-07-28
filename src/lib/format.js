/** Summarize a track list: "5 songs · 12 min" (or "· 48 sec" when short). */
export function summarize(tracks) {
  const n = tracks.length
  const count = `${n} ${n === 1 ? 'song' : 'songs'}`
  const dur = formatTotalDuration(tracks.reduce((s, t) => s + (t.duration || 0), 0))
  return dur ? `${count} · ${dur}` : count
}

/** 10260 → "2 hr 51 min", 2880 → "48 min", 42 → "42 sec". Returns '' for
    null/0/NaN (NaN is falsy) so callers can render the bare count. */
export function formatTotalDuration(totalSeconds) {
  if (!totalSeconds) return ''
  const s = Math.floor(totalSeconds)
  if (s < 60) return `${s} sec`
  // Round to whole minutes before splitting off hours, so 59.5 leftover
  // minutes carries into the hour ("2 hr", never "1 hr 60 min") and 3599 s
  // rounds up to "1 hr", never "60 min".
  const mins = Math.round(s / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} hr ${m} min` : `${h} hr`
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
