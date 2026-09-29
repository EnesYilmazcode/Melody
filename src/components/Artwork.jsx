import { useState, useEffect } from 'react'
import { ytThumbId, ytArtworkChain } from '../lib/youtube'
import { seriesTile } from '../lib/series'
import Icon from './Icon'

// Square artwork. YouTube thumbnail when present; a numbered series track gets
// its number tile; anything else a warm gradient tile (same track → same
// colors) so the library still looks intentional.
function hueFromId(id = '') {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

export default function Artwork({ track, size = 44, radius = 6 }) {
  const style = { width: size, height: size, borderRadius: radius }
  const url = track?.thumbnailUrl
  const ytId = ytThumbId(url)
  const chain = ytId ? ytArtworkChain(ytId, size) : url ? [url] : []
  // Walk down the chain on failure; past the end means the fallback tile. A
  // present-but-broken URL (expired/offline/deleted video) should fall back,
  // not show the browser's broken-image glyph. Reset when the track changes,
  // since this instance is reused in lists.
  const [step, setStep] = useState(0)
  useEffect(() => setStep(0), [url, size])

  const src = chain[step]
  if (src) {
    return (
      <span className="artwork" style={style}>
        <img
          src={src}
          alt=""
          // hqdefault still carries its letterbox; zoom past the bars.
          className={src.endsWith('/hqdefault.jpg') ? 'artwork__zoom' : undefined}
          onError={() => setStep((n) => n + 1)}
          // A missing maxres answers with a 120px grey placeholder, not an error.
          onLoad={(e) => { if (src.includes('maxresdefault') && e.currentTarget.naturalWidth <= 120) setStep((n) => n + 1) }}
        />
      </span>
    )
  }

  const tile = seriesTile(track)
  if (tile) {
    return (
      <span className="artwork tile" style={{ ...style, '--h': tile.hue }} aria-hidden="true">
        <b style={{ fontSize: Math.round(size * 0.39) }}>{tile.num}</b>
      </span>
    )
  }

  // Keep the hue in a warm band (amber → sienna) at low saturation so
  // placeholders stay cohesive with the palette, never rainbow.
  const h = 16 + (hueFromId(track?.id) % 30)
  return (
    <span
      className="artwork artwork--ph"
      style={{ ...style, background: `linear-gradient(150deg, hsl(${h} 30% 27%), hsl(${h - 8} 26% 15%))` }}
      aria-hidden="true"
    >
      <Icon name="note" size={Math.round(size * 0.42)} />
    </span>
  )
}
