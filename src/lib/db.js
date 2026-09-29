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

// v4: podcast subscriptions and their episodes. Episodes live apart from
// `tracks` so a show's back catalog doesn't flood the music library. A
// downloaded episode keeps its bytes in `audioBlobs` under the episode id.
db.version(4).stores({
  podcasts: 'id, title, subscribedAt', // id = feed URL
  episodes: 'id, podcastId, pubDate',
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

// `modify` re-reads the live row inside an implicit transaction and applies the
// mutator, so concurrent calls can't lose each other's update (which a
// get-then-update pair, with an await gap between them, would). A no-match id
// simply modifies nothing — no error — so the old `if (!t) return` guard is
// unnecessary.
export async function toggleStar(trackId) {
  await db.tracks.where('id').equals(trackId).modify((t) => {
    t.starred = t.starred ? 0 : 1
  })
}

export async function bumpPlayCount(trackId) {
  await db.tracks.where('id').equals(trackId).modify((t) => {
    t.playCount = (t.playCount || 0) + 1
    t.lastPlayedAt = Date.now()
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

/**
 * Store an imported audio file as a new local track, unless an identical track
 * is already imported. Returns `{ id, duplicate }`: `duplicate` is true when an
 * existing track matched and nothing was written.
 */
export async function addLocalTrack({ title, artist, duration, blob, thumbnailUrl = null, youtubeId = null, dateAdded = Date.now() }) {
  const nTitle = title || 'Unknown'
  const nArtist = artist || 'Imported'
  const nDuration = duration || 0
  let result
  await db.transaction('rw', db.tracks, db.audioBlobs, async () => {
    // Dedup: re-importing the same file shouldn't duplicate the row AND its
    // (heavy) audio Blob — that just doubles storage toward the ~1GB iOS
    // eviction cap. Match on YouTube id when present, else title+artist+duration.
    const dup = await db.tracks
      .filter((t) =>
        t.srcType === 'idb' &&
        ((youtubeId && t.youtubeId === youtubeId) ||
          (t.title === nTitle && t.artist === nArtist && t.duration === nDuration)),
      )
      .first()
    if (dup) {
      // A restored backup row carries metadata only — no audioBlobs entry. When
      // the user re-imports the same file, the dedup match lands here; attach
      // the bytes to the EXISTING id so playlists and stars keep pointing at
      // it, and report duplicate:false so the import summary counts it as
      // added (which, from the user's point of view, it just was).
      const hasBlob = await db.audioBlobs.get(dup.id)
      if (hasBlob) {
        result = { id: dup.id, duplicate: true }
      } else {
        await db.audioBlobs.add({ id: dup.id, blob })
        result = { id: dup.id, duplicate: false }
      }
      return
    }

    const id = `local-${crypto.randomUUID()}`
    await db.audioBlobs.add({ id, blob })
    await db.tracks.add({
      id,
      title: nTitle,
      artist: nArtist,
      duration: nDuration,
      thumbnailUrl,
      youtubeId,
      filePath: null,
      src: null,
      srcType: 'idb', // play() resolves the Blob from audioBlobs
      starred: 0,
      playCount: 0,
      lastPlayedAt: null,
      dateAdded,
    })
    result = { id, duplicate: false }
  })
  return result
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

// ── Backup / restore ────────────────────────────────────────────────────────
// A backup is the catalog + playlists as plain JSON. Audio Blobs live only in
// the separate audioBlobs store, so track rows serialize as-is; lyrics are
// skipped because ensureLyrics re-fetches them lazily. Rows are exported
// VERBATIM — `duration` especially is the exact float readDuration produced
// and one leg of addLocalTrack's dedup triple-match, so rounding it would
// break blob relink after a restore.

export async function exportBackup() {
  return {
    schema: 4,
    exportedAt: new Date().toISOString(),
    tracks: await db.tracks.toArray(),
    playlists: await db.playlists.toArray(),
    // v4: followed shows and episode progress. Downloads aren't in the file,
    // so every episode comes back as not downloaded.
    podcasts: await db.podcasts.toArray(),
    episodes: (await db.episodes.toArray()).map((e) => ({ ...e, downloaded: 0 })),
  }
}

/**
 * Merge a backup produced by exportBackup() into the live database. Tracks
 * merge by id (the live row keeps its catalog metadata, user state combines);
 * playlists merge by name, appending unseen track ids. Restored tracks have no
 * audio bytes yet — re-importing the same files reattaches them via the dedup
 * match in addLocalTrack. Returns row counts for the status message.
 */
export async function importBackup(data) {
  // Validate before the transaction opens: awaiting any non-Dexie promise
  // inside the transaction zone would kill it, so everything here — and the
  // JSON parsing in the UI handler — stays outside.
  if (!data || !Array.isArray(data.tracks) || !Array.isArray(data.playlists)) {
    throw new Error('invalid-backup')
  }
  // Refuse backups from a future schema — importing one silently could apply
  // this version's merge semantics to fields it doesn't understand.
  if (typeof data.schema === 'number' && data.schema > 4) {
    throw new Error('invalid-backup')
  }
  // Beyond the id check, coerce the fields the UI and dedup depend on — a
  // hand-edited or foreign-schema backup row missing `title` would otherwise
  // crash the Library A-Z sort on every launch. The fallbacks are exactly
  // addLocalTrack's normalizations, so re-importing the real file still
  // triple-matches this row; a numeric `duration` passes through verbatim
  // because rounding it would break that same match.
  const trackRows = data.tracks
    .filter((t) => t && typeof t.id === 'string')
    .map((t) => ({
      ...t,
      title: typeof t.title === 'string' ? t.title : 'Unknown',
      artist: typeof t.artist === 'string' ? t.artist : 'Imported',
      duration: typeof t.duration === 'number' ? t.duration : 0,
    }))
  const playlistRows = data.playlists.filter((p) => p && typeof p.name === 'string')
  // Schema 3 backups have no podcasts; treat them as empty.
  const podcastRows = (Array.isArray(data.podcasts) ? data.podcasts : []).filter((p) => p && typeof p.id === 'string')
  const episodeRows = (Array.isArray(data.episodes) ? data.episodes : []).filter(
    (e) => e && typeof e.id === 'string' && typeof e.podcastId === 'string' && typeof e.audioUrl === 'string',
  )

  await db.transaction('rw', db.tracks, db.playlists, db.podcasts, db.episodes, async () => {
    for (const row of trackRows) {
      const existing = await db.tracks.get(row.id)
      if (existing) {
        // Merge only user state — the live row's catalog metadata wins, same
        // ownership split as upsertCatalog, just from the other side.
        const lastPlayedAt =
          existing.lastPlayedAt == null && row.lastPlayedAt == null
            ? null
            : Math.max(existing.lastPlayedAt ?? -Infinity, row.lastPlayedAt ?? -Infinity)
        await db.tracks.update(row.id, {
          playCount: Math.max(existing.playCount || 0, row.playCount || 0),
          starred: (existing.starred || row.starred) ? 1 : 0, // 0/1 — Dexie can't index booleans
          lastPlayedAt,
          dateAdded: Math.min(existing.dateAdded ?? Date.now(), row.dateAdded ?? Date.now()),
        })
      } else {
        // The restored row keeps its original id and srcType ('idb' for
        // imported tracks) — that is what lets a later re-import of the same
        // file relink its bytes to this exact row. Until then the player shows
        // its graceful "Audio unavailable" state.
        await db.tracks.add({
          playCount: 0,
          lastPlayedAt: null,
          dateAdded: Date.now(),
          ...row,
          starred: row.starred ? 1 : 0,
        })
      }
    }

    for (const pl of playlistRows) {
      const existing = await db.playlists.where('name').equals(pl.name).first()
      if (existing) {
        // Append restored ids the playlist doesn't have yet, atomically (see
        // addToPlaylist). Dangling ids are fine — PlaylistDetail filters them.
        await db.playlists.where('id').equals(existing.id).modify((p) => {
          for (const tid of pl.trackIds || []) {
            if (!p.trackIds.includes(tid)) p.trackIds.push(tid)
          }
          if (!p.resume && pl.resume) p.resume = pl.resume
        })
      } else {
        // NEVER restore the old id: playlist ids are ++id auto-increment
        // numbers, and inserting a foreign id collides with or corrupts the
        // counter. Let Dexie assign a fresh one.
        await db.playlists.add({
          name: pl.name,
          trackIds: [...(pl.trackIds || [])],
          createdAt: pl.createdAt ?? Date.now(),
          ...(pl.resume ? { resume: pl.resume } : {}),
        })
      }
    }

    // Shows merge by feed URL. For episodes the further-along progress wins,
    // and a live download is never marked as missing.
    for (const show of podcastRows) {
      if (!(await db.podcasts.get(show.id))) await db.podcasts.add(show)
    }
    for (const ep of episodeRows) {
      const existing = await db.episodes.get(ep.id)
      if (!existing) {
        await db.episodes.add({ ...ep, downloaded: 0 })
      } else {
        await db.episodes.update(ep.id, {
          played: existing.played || ep.played ? 1 : 0,
          position: Math.max(existing.position || 0, ep.position || 0),
          lastPlayedAt: Math.max(existing.lastPlayedAt || 0, ep.lastPlayedAt || 0) || null,
        })
      }
    }
  })

  return { tracks: trackRows.length, playlists: playlistRows.length, podcasts: podcastRows.length }
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

// Atomic read-modify-write via `modify` (see toggleStar above): two overlapping
// edits to the same playlist each rewrite the whole trackIds array, so without
// this a get-then-update pair would let the second write clobber the first.
export async function addToPlaylist(id, trackId) {
  await db.playlists.where('id').equals(id).modify((pl) => {
    if (!pl.trackIds.includes(trackId)) pl.trackIds.push(trackId)
  })
}

export async function removeFromPlaylist(id, trackId) {
  await db.playlists.where('id').equals(id).modify((pl) => {
    pl.trackIds = pl.trackIds.filter((t) => t !== trackId)
  })
}

// ── Listening position (podcast mode) ───────────────────────────────────────
// Long-form items remember where you stopped. A track or an episode can be
// playing, so pick the table by the item's kind.
const tableFor = (item) => (item.kind === 'episode' ? db.episodes : db.tracks)

export async function getPosition(item) {
  const row = await tableFor(item).get(item.id)
  return row?.position || 0
}

export async function savePosition(item, position) {
  await tableFor(item).update(item.id, { position, lastPlayedAt: Date.now() })
}

export async function setPlayed(item, played) {
  await tableFor(item).update(item.id, { played: played ? 1 : 0, position: 0 })
}

// ── Podcasts ────────────────────────────────────────────────────────────────
// Feed fields to refresh on every fetch; everything else on an episode row
// (position, played, downloaded) is user state and survives a refresh.
const EPISODE_FEED_FIELDS = ['title', 'audioUrl', 'duration', 'pubDate', 'image', 'summary']

export async function savePodcast(show, episodes) {
  await db.transaction('rw', db.podcasts, db.episodes, async () => {
    const existing = await db.podcasts.get(show.id)
    await db.podcasts.put({ subscribedAt: Date.now(), ...existing, ...show, refreshedAt: Date.now() })
    for (const ep of episodes) {
      const old = await db.episodes.get(ep.id)
      if (old) {
        const patch = {}
        for (const f of EPISODE_FEED_FIELDS) if (ep[f] !== undefined) patch[f] = ep[f]
        await db.episodes.update(ep.id, patch)
      } else {
        await db.episodes.add({ position: 0, played: 0, downloaded: 0, lastPlayedAt: null, ...ep })
      }
    }
  })
}

/** Drop a show, its episodes, and any downloaded audio. */
export async function unsubscribePodcast(podcastId) {
  await db.transaction('rw', db.podcasts, db.episodes, db.audioBlobs, async () => {
    const ids = await db.episodes.where('podcastId').equals(podcastId).primaryKeys()
    await db.audioBlobs.bulkDelete(ids)
    await db.episodes.bulkDelete(ids)
    await db.podcasts.delete(podcastId)
  })
}

export async function saveEpisodeAudio(episodeId, blob) {
  await db.transaction('rw', db.episodes, db.audioBlobs, async () => {
    await db.audioBlobs.put({ id: episodeId, blob })
    await db.episodes.update(episodeId, { downloaded: 1 })
  })
}

export async function removeEpisodeAudio(episodeId) {
  await db.transaction('rw', db.episodes, db.audioBlobs, async () => {
    await db.audioBlobs.delete(episodeId)
    await db.episodes.update(episodeId, { downloaded: 0 })
  })
}

// ── Series (numbered episodes imported as files) ────────────────────────────
// "Show - 012 Episode title" style imports become one playlist, kept in
// episode-number order, so a whole series plays through without hand-sorting.

/** Leading episode number of a title ("012 Something" → 12), or null. */
export function seriesNumber(title) {
  const m = /^(\d{1,4})(?:[\s.)_-]|$)/.exec(title || '')
  return m ? Number(m[1]) : null
}

/**
 * Create or extend the playlist named `name` with `trackIds`, ordered by each
 * track's leading number. Returns the playlist id.
 */
export async function upsertSeriesPlaylist(name, trackIds) {
  let id
  await db.transaction('rw', db.playlists, db.tracks, async () => {
    const existing = await db.playlists.where('name').equals(name).first()
    const ids = [...new Set([...(existing?.trackIds || []), ...trackIds])]
    const rows = await db.tracks.bulkGet(ids)
    const num = new Map(rows.filter(Boolean).map((t) => [t.id, seriesNumber(t.title) ?? Infinity]))
    const ordered = ids.filter((i) => num.has(i)).sort((a, b) => num.get(a) - num.get(b))
    if (existing) {
      await db.playlists.update(existing.id, { trackIds: ordered })
      id = existing.id
    } else {
      id = await db.playlists.add({ name, trackIds: ordered, createdAt: Date.now() })
    }
  })
  return id
}

/** Remember where a playlist was left: which track, and how far in. */
export async function savePlaylistResume(playlistId, trackId, position) {
  await db.playlists.update(playlistId, { resume: { trackId, position, at: Date.now() } })
}
