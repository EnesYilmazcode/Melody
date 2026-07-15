import { useState, useEffect } from 'react'

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
  // A present-but-broken thumbnail URL (expired/offline/deleted video) should
  // fall back to the gradient tile, not the browser's broken-image glyph.
  // Reset the flag when the URL changes since this instance is reused in lists.
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [track?.thumbnailUrl])

  if (track?.thumbnailUrl && !failed) {
    return (
      <img
        className="artwork"
        src={track.thumbnailUrl}
        alt=""
        style={style}
        onError={() => setFailed(true)}
      />
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
