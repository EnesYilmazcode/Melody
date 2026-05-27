import Dexie from 'dexie'

// ── Melody's local database ─────────────────────────────────────────────────
// Two stores, deliberately split along the ownership line from context.md §7:
//
//   tracks    → CATALOG. On the phone this is owned by the a-Shell download
//               engine (it writes title/duration/filePath into index.json).
//   playlists → USER STATE. Owned entirely by the PWA.
//
//   Per-track USER STATE (starred, playCount, lastPlayedAt) also lives on the
//   track row, but `upsertCatalog()` below is careful NEVER to overwrite it when
//   the engine's catalog is re-imported. That's the merge strategy: engine owns
//   metadata, PWA owns user state, keyed by track id.
//
// Audio bytes live in the `audioBlobs` store (imported via the file picker,
// since iOS has no File System Access API). Tracks reference them by id; on
// play we read the Blob and hand the player an object URL. Sample/dev tracks
// instead carry a `src` URL (/samples/*.wav).

export const db = new Dexie('melody')

db.version(1).stores({
  // Only list INDEXED fields here. Other fields (title, thumbnailUrl, src…)
  // are stored too, just not indexed.
  tracks: 'id, title, artist, dateAdded, starred, playCount',
  playlists: '++id, name, createdAt',
})

// v2: a place to keep the actual audio bytes for imported tracks.
db.version(2).stores({
  audioBlobs: 'id', // { id: trackId, blob: Blob }
})

// v3: cached lyrics per track (synced LRC + plain), so they work offline.
db.version(3).stores({
  lyrics: 'id', // { id: trackId, synced: [{time,text}]|null, plain: string|null, fetchedAt }
})

// Fields the download engine "owns" — safe to overwrite on catalog re-import.
const CATALOG_FIELDS = ['title', 'artist', 'duration', 'thumbnailUrl', 'filePath', 'src']

/**
 * Insert/refresh tracks from a catalog without clobbering user state.
 * @param {Array<object>} catalogTracks
 */
export async function upsertCatalog(catalogTracks) {
  await db.transaction('rw', db.tracks, async () => {
    for (const incoming of catalogTracks) {
      const existing = await db.tracks.get(incoming.id)
      if (existing) {
        // Update only engine-owned metadata; preserve starred/playCount/etc.
        const patch = {}
        for (const f of CATALOG_FIELDS) {
          if (incoming[f] !== undefined) patch[f] = incoming[f]
        }
        await db.tracks.update(incoming.id, patch)
      } else {
        await db.tracks.add({
          starred: 0, // Dexie can't index booleans; use 0/1
          playCount: 0,
          lastPlayedAt: null,
          dateAdded: Date.now(),
          ...incoming,
        })
      }
    }
  })
}

export async function toggleStar(trackId) {
  const t = await db.tracks.get(trackId)
  if (!t) return
  await db.tracks.update(trackId, { starred: t.starred ? 0 : 1 })
}

export async function bumpPlayCount(trackId) {
  const t = await db.tracks.get(trackId)
  if (!t) return
  await db.tracks.update(trackId, {
    playCount: (t.playCount || 0) + 1,
    lastPlayedAt: Date.now(),
  })
}

// ── Imported audio (file picker → IndexedDB) ─────────────────────────────────

/** Ask iOS to keep our storage durable (less likely to be evicted). */
export async function requestPersistentStorage() {
  try {
    return navigator.storage?.persist ? await navigator.storage.persist() : false
  } catch {
    return false
  }
}

/** Approx storage used + quota, in bytes. */
export async function storageEstimate() {
  try {
    return navigator.storage?.estimate ? await navigator.storage.estimate() : null
  } catch {
    return null
  }
}

/** Store an imported audio file as a new local track. Returns the track id. */
export async function addLocalTrack({ title, artist, duration, blob, thumbnailUrl = null, youtubeId = null }) {
  const id = `local-${crypto.randomUUID()}`
  await db.transaction('rw', db.tracks, db.audioBlobs, async () => {
    await db.audioBlobs.add({ id, blob })
    await db.tracks.add({
      id,
      title: title || 'Unknown',
      artist: artist || 'Imported',
      duration: duration || 0,
      thumbnailUrl,
      youtubeId,
      filePath: null,
      src: null,
      srcType: 'idb', // play() resolves the Blob from audioBlobs
      starred: 0,
      playCount: 0,
      lastPlayedAt: null,
      dateAdded: Date.now(),
    })
  })
  return id
}

/** The raw audio Blob for a track, or null. */
export async function getAudioBlob(trackId) {
  const rec = await db.audioBlobs.get(trackId)
  return rec?.blob || null
}

/** Remove a track entirely: row, its audio bytes, and any playlist references. */
export async function deleteTrack(trackId) {
  await db.transaction('rw', db.tracks, db.audioBlobs, db.playlists, async () => {
    await db.tracks.delete(trackId)
    await db.audioBlobs.delete(trackId)
    const pls = await db.playlists.toArray()
    for (const pl of pls) {
      if (pl.trackIds.includes(trackId)) {
        await db.playlists.update(pl.id, { trackIds: pl.trackIds.filter((t) => t !== trackId) })
      }
    }
  })
}

// ── Playlist mutations ──────────────────────────────────────────────────────
export async function createPlaylist(name) {
  return db.playlists.add({ name: name.trim() || 'Untitled', trackIds: [], createdAt: Date.now() })
}

export async function renamePlaylist(id, name) {
  await db.playlists.update(id, { name: name.trim() || 'Untitled' })
}

export async function deletePlaylist(id) {
  await db.playlists.delete(id)
}

export async function addToPlaylist(id, trackId) {
  const pl = await db.playlists.get(id)
  if (!pl) return
  if (!pl.trackIds.includes(trackId)) {
    await db.playlists.update(id, { trackIds: [...pl.trackIds, trackId] })
  }
}

export async function removeFromPlaylist(id, trackId) {
  const pl = await db.playlists.get(id)
  if (!pl) return
  await db.playlists.update(id, { trackIds: pl.trackIds.filter((t) => t !== trackId) })
}
