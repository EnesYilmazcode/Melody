import { useState, useEffect } from 'react'
import { buildYtDlpCommand, fetchYouTubePreview } from '../lib/youtube'

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
          <img src={preview.thumbnail} alt="" />
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
