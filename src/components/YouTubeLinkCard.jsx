import { useState, useEffect } from 'react'
import { buildYtDlpCommand, fetchYouTubePreview } from '../lib/youtube'

// The thumbnail URL comes from a third-party (noembed) response, so validate it
// before using it as an <img src>: require https and a YouTube-owned host,
// otherwise drop it (the card still shows the title/author).
function safeThumb(url) {
  try {
    const u = new URL(url)
    // Require a subdomain of ytimg.com / ggpht.com (matches the img-src CSP,
    // which allows *.ytimg.com / *.ggpht.com, not the bare apex).
    if (u.protocol === 'https:' && /\.(ytimg|ggpht)\.com$/i.test(u.hostname)) {
      return url
    }
  } catch {
    /* not a valid URL */
  }
  return null
}

// Shown in Search when a YouTube link is present. Previews the video and offers
// the a-Shell command. The command box itself is the copy control (tap to copy)
// — and pasting via the search bar pre-copies it, so usually it's already done.
export default function YouTubeLinkCard({ yt, copied }) {
  const [preview, setPreview] = useState(null)
  const [tapCopied, setTapCopied] = useState(false)
  const command = buildYtDlpCommand(yt.url)
  const done = copied || tapCopied

  useEffect(() => {
    let alive = true
    setPreview(null)
    setTapCopied(false)
    fetchYouTubePreview(yt.id).then((p) => alive && setPreview(p))
    return () => { alive = false }
  }, [yt.id])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setTapCopied(true)
      setTimeout(() => setTapCopied(false), 1800)
    } catch {
      /* ignore — box content is still readable */
    }
  }

  return (
    <div className="ytcard">
      {preview ? (
        <div className="ytcard__preview">
          {safeThumb(preview.thumbnail) && <img src={safeThumb(preview.thumbnail)} alt="" />}
          <div className="ytcard__pmeta">
            <p className="ytcard__title">{preview.title}</p>
            <p className="dim">{preview.author}</p>
          </div>
        </div>
      ) : (
        <p className="dim">Video {yt.id}</p>
      )}

      <button className={`ytcard__cmd ${done ? 'is-copied' : ''}`} onClick={copy}>
        <code>{command}</code>
        <span className="ytcard__hint">{done ? '✓ Copied — paste in a-Shell' : 'Tap to copy'}</span>
      </button>

      <p className="ytcard__note">Then come back and tap <b>Import</b> in Library.</p>
    </div>
  )
}
