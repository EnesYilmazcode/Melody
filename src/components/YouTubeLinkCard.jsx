import { useState, useEffect } from 'react'
import { buildYtDlpCommand, fetchYouTubePreview } from '../lib/youtube'
import Icon from './Icon'

// The thumbnail URL comes from a third-party (noembed) response, so validate it
// before using it as an <img src>: require https and a YouTube-owned host,
// otherwise drop it (the card still shows the title).
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

// Shown in Search when a YouTube link is present: previews the video and copies
// the a-Shell command. Pasting via the search bar pre-copies it, so usually
// it's already done.
export default function YouTubeLinkCard({ yt, copied }) {
  const [preview, setPreview] = useState(undefined) // undefined = loading
  const [tapCopied, setTapCopied] = useState(false)
  const command = buildYtDlpCommand(yt.url)
  const done = copied || tapCopied

  useEffect(() => {
    let alive = true
    setPreview(undefined)
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
      /* ignore: the command stays readable below */
    }
  }

  const thumb = preview && safeThumb(preview.thumbnail)
  return (
    <div className="ytcard">
      <div className="ytcard__preview">
        {thumb ? <img src={thumb} alt="" /> : <span className="ytcard__skel" />}
        <p className="ytcard__title">{preview === undefined ? '' : preview?.title || `Video ${yt.id}`}</p>
      </div>

      <button className={`btn ${done ? '' : 'btn--accent'} ytcard__copy`} onClick={copy}>
        <Icon name={done ? 'check' : 'paste'} size={20} />
        {done ? 'Copied, paste it in a-Shell' : 'Copy for a-Shell'}
      </button>
      <p className="ytcard__cmd">{command}</p>

      <p className="ytcard__note">Then come back, tap <b>⋯</b> in Library and choose <b>Import from Files</b>.</p>
    </div>
  )
}
