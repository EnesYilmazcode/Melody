import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Fuse from 'fuse.js'
import { db } from '../lib/db'

// useLiveQuery re-runs and re-renders automatically whenever the underlying
// table changes — so starring a track or adding to a playlist updates every
// view instantly without manual refresh plumbing.

/** All tracks, newest first. `undefined` while the first query is in flight. */
export function useTracks() {
  return useLiveQuery(() => db.tracks.orderBy('dateAdded').reverse().toArray())
}

export function usePlaylists() {
  return useLiveQuery(() => db.playlists.orderBy('createdAt').reverse().toArray())
}

export function useLyrics(trackId) {
  return useLiveQuery(() => (trackId == null ? undefined : db.lyrics.get(trackId)), [trackId])
}

// Live view of a single track (e.g. so Now Playing reflects star toggles
// instantly instead of using the snapshot captured when playback started).
export function useTrack(trackId) {
  return useLiveQuery(() => (trackId == null ? undefined : db.tracks.get(trackId)), [trackId])
}

/**
 * Fuzzy, as-you-type search over a track list. Returns the full list (newest
 * first) when the query is empty, else Fuse-ranked matches on title + artist.
 */
export function useSearch(tracks, query) {
  const fuse = useMemo(
    () =>
      new Fuse(tracks || [], {
        keys: [
          { name: 'title', weight: 0.7 },
          { name: 'artist', weight: 0.3 },
        ],
        threshold: 0.4, // 0 = exact, 1 = match anything; 0.4 is forgiving but sane
        ignoreLocation: true,
      }),
    [tracks],
  )

  return useMemo(() => {
    const q = query.trim()
    if (!q) return tracks || []
    return fuse.search(q).map((r) => r.item)
  }, [fuse, query, tracks])
}
