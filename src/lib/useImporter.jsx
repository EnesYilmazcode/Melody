import { useRef, useState } from 'react'
import { addLocalTrack, requestPersistentStorage, storageEstimate, seriesNumber, upsertSeriesPlaylist } from './db'
import { useUI } from '../state/UIProvider'
import { readDuration, parseFilename } from './audio'
import { ensureLyrics } from './lyrics'
import { fetchYouTubePreview } from './youtube'

// Imports audio files from the Files app via a native file picker (the only way
// to read user files on iOS: no File System Access API). Each file's bytes are
// stored in IndexedDB and added to the library; useLiveQuery refreshes the list.
// Returns the hidden <input> to render, open() to show the picker, and progress.
export function useImporter() {
  const inputRef = useRef(null)
  const [progress, setProgress] = useState(null) // { done, total } while importing
  const { showToast } = useUI() // results surface in the app-wide toast

  const onPick = async (e) => {
    // Name order with numbers compared as numbers, so a numbered series lands
    // in the library (and its playlist) in episode order.
    const picked = [...e.target.files].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    e.target.value = '' // reset so the same file can be re-picked later
    if (!picked.length) return

    // Select-All in the a-Shell folder sweeps in .json/.txt sidecars alongside
    // the audio. The accept attr is advisory only on iOS, so filter here,
    // before the quota pre-flight and the progress counter see the list.
    const files = picked.filter(
      (f) => f.type.startsWith('audio/') || /\.(m4a|mp3|aac|wav|flac|ogg)$/i.test(f.name)
    )
    if (!files.length) {
      showToast('No audio files in that selection.')
      return
    }

    await requestPersistentStorage() // ask iOS to keep the library durable

    // Pre-flight storage check: if the picked files clearly won't fit in the
    // remaining budget, bail with a message instead of letting the blob write
    // fail silently partway through (iOS ~1GB, evictable).
    const totalBytes = files.reduce((n, f) => n + (f.size || 0), 0)
    const est = await storageEstimate()
    if (est?.quota && est.usage + totalBytes > est.quota * 0.95) {
      showToast('Not enough storage to import these. Free up space and try again.')
      return
    }

    setProgress({ done: 0, total: files.length })
    // One timestamp per import, counting down in pick order, so "Recent"
    // (newest first) still lists a series 1, 2, 3 rather than backwards.
    const batchAt = Date.now()
    let added = 0
    let skipped = 0
    let failed = 0
    let outOfSpace = false
    const series = new Map() // artist → ids of numbered tracks from this import
    for (const [i, file] of files.entries()) {
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

        const { id, duplicate } = await addLocalTrack({
          title, artist, duration, blob: file, thumbnailUrl, youtubeId, dateAdded: batchAt - i,
        })
        if (artist !== 'Imported' && seriesNumber(title) != null) {
          if (!series.has(artist)) series.set(artist, [])
          series.get(artist).push(id)
        }
        if (duplicate) {
          skipped++
          continue
        }
        // Counted explicitly rather than derived: the out-of-space break below
        // exits the loop early, which would make length arithmetic lie.
        added++
        // fetch lyrics in the background (cached for offline); don't block import
        ensureLyrics({ id, title, artist, duration }).catch(() => {})
      } catch (err) {
        failed++
        if (err?.name === 'QuotaExceededError') {
          outOfSpace = true
          break // storage is full, no point trying the rest
        }
        console.error('import failed for', file.name, err)
      } finally {
        setProgress((p) => p && { ...p, done: p.done + 1 })
      }
    }
    setProgress(null)

    // Three or more numbered files from one show make (or extend) a playlist.
    const made = []
    for (const [name, ids] of series) {
      if (ids.length < 3) continue
      await upsertSeriesPlaylist(name, ids).catch(() => {})
      made.push(`Playlist “${name}” is ready, in order`)
    }

    // Always leave a summary: a re-pick of the whole folder is a sync, and
    // "nothing happened" must still be an answer, never a silent no-op.
    if (outOfSpace) {
      showToast('Ran out of storage. Not all tracks were imported.')
    } else if (added === 0 && failed === 0) {
      showToast(['No new songs, everything is already in your library', ...made].join(' · '))
    } else {
      const parts = [`${added} added`]
      if (skipped) parts.push(`${skipped} already in your library`)
      if (failed) parts.push(`${failed} couldn't be imported`)
      showToast([...parts, ...made].join(' · '))
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="audio/*,.m4a,.mp3,.aac,.wav,.flac,.ogg"
      multiple
      hidden
      onChange={onPick}
    />
  )
  return { input, open: () => inputRef.current?.click(), progress }
}
