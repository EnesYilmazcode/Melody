// Numbered series tracks ("037 Wrap Up") without cover art get a generated
// number tile instead, and drop the number from the displayed title since the
// tile already shows it. Tracks with real artwork keep their title as-is.
const NUMBERED = /^(\d{1,4})[\s.)_-]+(.*\S.*)$/

export function seriesTile(track) {
  if (!track || track.thumbnailUrl || track.kind === 'episode') return null
  const m = NUMBERED.exec(track.title || '')
  if (!m) return null
  return { num: m[1].padStart(3, '0'), label: m[2].trim(), hue: tileHue(track.artist || track.id) }
}

export const displayTitle = (track) => seriesTile(track)?.label ?? track?.title ?? ''

// One warm hue per series (keyed on the show name), 22°–40°.
export function tileHue(key = '') {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360
  return 22 + (h % 19)
}
