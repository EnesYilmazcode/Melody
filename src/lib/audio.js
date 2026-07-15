// Read an audio file's duration (seconds) by loading its metadata into a
// throwaway <audio> element. Works for any format the device can decode.
export function readDuration(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('audio')
    a.preload = 'metadata'
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(a.duration) ? a.duration : 0)
    }
    // A decode error means the device can't play this file. Reject so the
    // importer can refuse it, instead of silently storing an unplayable
    // 0-duration track that fails the moment you press play.
    a.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('unreadable-audio'))
    }
    a.src = url
  })
}

// Turn a filename into {title, artist, youtubeId}. Recognizes a trailing
// " [VIDEOID]" (added by our yt-dlp command) and "Artist - Title".
export function parseFilename(filename) {
  let base = filename.replace(/\.[^/.]+$/, '')

  // pull a trailing YouTube id: "Song Title [dQw4w9WgXcQ]"
  let youtubeId = null
  const idMatch = base.match(/\s*\[([\w-]{11})\]\s*$/)
  if (idMatch) {
    youtubeId = idMatch[1]
    base = base.slice(0, idMatch.index)
  }

  base = base.replace(/_/g, ' ').trim()
  const m = base.match(/^(.+?)\s*[-–—]\s*(.+)$/)
  if (m && m[1] && m[2]) return { artist: m[1].trim(), title: m[2].trim(), youtubeId }
  return { artist: 'Imported', title: base || 'Unknown', youtubeId }
}
