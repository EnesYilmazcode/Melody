import { useRef, useState } from 'react'
import { addLocalTrack, requestPersistentStorage, storageEstimate } from '../lib/db'
import { readDuration, parseFilename } from '../lib/audio'
import { ensureLyrics } from '../lib/lyrics'
import { fetchYouTubePreview } from '../lib/youtube'

// Imports audio files from the Files app via a native file picker (the only way
// to read user files on iOS — no File System Access API). Each file's bytes are
// stored in IndexedDB and added to the library; useLiveQuery refreshes the list.
export default function ImportButton() {
  const inputRef = useRef(null)
  const [remaining, setRemaining] = useState(0)
  const [notice, setNotice] = useState(null) // user-facing result/errors

  const onPick = async (e) => {
    const files = [...e.target.files]
    e.target.value = '' // reset so the same file can be re-picked later
    if (!files.length) return
    setNotice(null)

    await requestPersistentStorage() // ask iOS to keep the library durable

    // Pre-flight storage check: if the picked files clearly won't fit in the
    // remaining budget, bail with a message instead of letting the blob write
    // fail silently partway through (iOS ~1GB, evictable).
    const totalBytes = files.reduce((n, f) => n + (f.size || 0), 0)
    const est = await storageEstimate()
    if (est?.quota && est.usage + totalBytes > est.quota * 0.95) {
      setNotice("Not enough storage to import these. Free up space and try again.")
      return
    }

    setRemaining(files.length)
    let imported = 0
    let skipped = 0
    let failed = 0
    let outOfSpace = false
    for (const file of files) {
      try {
        const { title, youtubeId } = parseFilename(file.name)
        let { artist } = parseFilename(file.name)
        const duration = await readDuration(file) // rejects if undecodable
        const thumbnailUrl = youtubeId
          ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
          : null

        // No artist in the filename? Use the YouTube channel (strip the
        // auto-channel suffixes), which makes lyric matching far more accurate.
        if (youtubeId && artist === 'Imported') {
          const pv = await fetchYouTubePreview(youtubeId).catch(() => null)
          const chan = pv?.author?.replace(/\s*-\s*topic$/i, '').replace(/vevo$/i, '').trim()
          if (chan) artist = chan
        }

        const { id, duplicate } = await addLocalTrack({ title, artist, duration, blob: file, thumbnailUrl, youtubeId })
        if (duplicate) {
          skipped++
          continue
        }
        imported++
        // fetch lyrics in the background (cached for offline); don't block import
        ensureLyrics({ id, title, artist, duration }).catch(() => {})
      } catch (err) {
        failed++
        if (err?.name === 'QuotaExceededError') {
          outOfSpace = true
          break // storage is full — no point trying the rest
        }
        console.error('import failed for', file.name, err)
      } finally {
        setRemaining((n) => n - 1)
      }
    }
    setRemaining(0)

    // Only surface something when it's worth telling the user about.
    if (outOfSpace) {
      setNotice("Ran out of storage — not all tracks were imported.")
    } else {
      const parts = []
      if (skipped) parts.push(`${skipped} already in your library`)
      if (failed) parts.push(`${failed} couldn't be imported`)
      setNotice(parts.length ? parts.join(' · ') : null)
    }
  }

  const busy = remaining > 0
  return (
    <>
      <button
        className="btn btn--ghost importbtn"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {busy ? <Spinner /> : <TrayIcon />}
        {busy ? `Importing… (${remaining})` : 'Import'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.m4a,.mp3,.aac,.wav,.flac,.ogg"
        multiple
        hidden
        onChange={onPick}
      />
      {notice && (
        <p className="importnote" role="status">
          {notice}
        </p>
      )}
    </>
  )
}

function TrayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v10m0 0l-4-4m4 4l4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}
function Spinner() {
  return <span className="spinner" aria-hidden="true" />
}
