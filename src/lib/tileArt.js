// Draws a numbered series tile to a PNG data URL for the lock screen, which
// can't render our CSS tile. Cached per number + hue.
const cache = new Map()

export function tileArtwork({ num, hue }) {
  const key = `${num}:${hue}`
  if (cache.has(key)) return cache.get(key)
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')
  const bg = g.createRadialGradient(80, 40, 0, 80, 40, 620)
  bg.addColorStop(0, `hsl(${hue} 55% 40%)`)
  bg.addColorStop(0.7, `hsl(${hue - 4} 48% 18%)`)
  bg.addColorStop(1, `hsl(${hue - 8} 40% 11%)`)
  g.fillStyle = bg
  g.fillRect(0, 0, 512, 512)
  g.fillStyle = 'rgba(250, 236, 212, .95)'
  g.font = `800 ${num.length > 3 ? 170 : 230}px "Bricolage Grotesque Variable", system-ui, sans-serif`
  if ('fontStretch' in g) g.fontStretch = 'condensed'
  g.textBaseline = 'alphabetic'
  g.fillText(num, 34, 472)
  const url = c.toDataURL('image/png')
  cache.set(key, url)
  return url
}
