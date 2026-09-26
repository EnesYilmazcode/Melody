import { useState, useEffect } from 'react'
import { ytThumbId, ytArtworkChain } from '../lib/youtube'

// Square artwork. Uses the YouTube thumbnail when present; otherwise renders a
// deterministic gradient tile (same track → same colors) so the library still
// looks intentional for the sample tones and any thumbnail-less tracks.
function hueFromId(id = '') {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

// Warm glow color for the Now Playing backdrop, derived from the same id.
export function warmGlow(id) {
  const h = 16 + (hueFromId(id) % 30) // 16°–46°: amber → orange → sienna
  return `hsl(${h} 52% 22%)`
}

export default function Artwork({ track, size = 48, radius = 8 }) {
  const style = { width: size, height: size, borderRadius: radius }
  const url = track?.thumbnailUrl
  const ytId = ytThumbId(url)
  const chain = ytId ? ytArtworkChain(ytId, size) : url ? [url] : []
  // Walk down the chain on failure; past the end means the gradient tile. A
  // present-but-broken URL (expired/offline/deleted video) should fall back,
  // not show the browser's broken-image glyph. Reset when the track changes,
  // since this instance is reused in lists.
  const [step, setStep] = useState(0)
  useEffect(() => setStep(0), [url, size])

  const src = chain[step]
  if (src) {
    return (
      <span className="artwork artwork--img" style={style}>
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
  // Keep the hue in a warm band (deep amber → sienna → olive) and low-ish
  // saturation so placeholders stay cohesive with the palette — never rainbow.
  const h = 16 + (hueFromId(track?.id) % 30) // 16°–46°: amber → orange → sienna
  return (
    <div
      className="artwork artwork--ph"
      style={{
        ...style,
        background: `linear-gradient(150deg, hsl(${h} 32% 26%), hsl(${h - 8} 28% 14%))`,
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width={size * 0.4} height={size * 0.4} fill="none" stroke="rgba(243,239,230,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    </div>
  )
}
