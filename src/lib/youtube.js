// Recognize a pasted YouTube URL and pull out the 11-char video id. Handles
// the share-sheet forms (youtu.be/ID?si=...), watch?v=, shorts/, live/, embed/.
export function parseYouTube(input) {
  const s = (input || '').trim()
  if (!/youtu\.?be/i.test(s)) return null
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`)
    let id = null
    if (u.hostname.includes('youtu.be')) {
      id = u.pathname.slice(1).split('/')[0]
    } else if (u.pathname.startsWith('/watch')) {
      id = u.searchParams.get('v')
    } else {
      const m = u.pathname.match(/\/(?:shorts|live|embed)\/([^/?]+)/)
      if (m) id = m[1]
    }
    if (id && /^[\w-]{11}$/.test(id)) {
      return { id, url: `https://www.youtube.com/watch?v=${id}` }
    }
  } catch {
    /* not a URL — fall through */
  }
  return null
}

// The exact a-Shell command. `-f 140` = YouTube's native m4a audio stream, so
// no ffmpeg/conversion is needed (a-Shell has none) and iOS plays it directly.
// The "[%(id)s]" suffix embeds the video id in the filename so that on import
// Melody can recover it and fetch the cover art. Melody strips it from the
// displayed title.
export function buildYtDlpCommand(url) {
  return `yt-dlp -f 140 -o "%(title)s [%(id)s].m4a" "${url}"`
}

// Lightweight, key-free preview (title/author/thumbnail) via noembed, which —
// unlike YouTube's own oEmbed — sends CORS headers so the browser can read it.
export async function fetchYouTubePreview(id) {
  try {
    const res = await fetch(
      `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`,
    )
    if (!res.ok) return null
    const d = await res.json()
    if (d.error) return null
    return { title: d.title, author: d.author_name, thumbnail: d.thumbnail_url }
  } catch {
    return null
  }
}
