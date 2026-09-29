import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { bumpPlayCount, getAudioBlob, getPosition, savePosition, setPlayed, savePlaylistResume } from '../lib/db'
import { isLongForm } from '../lib/podcasts'
import { ytThumbId } from '../lib/youtube'
import { seriesTile, displayTitle } from '../lib/series'
import { tileArtwork } from '../lib/tileArt'

const PlayerContext = createContext(null)
export const usePlayer = () => useContext(PlayerContext)

// Loop modes cycle in this order when you tap the loop button:
//   off → all (loop the whole queue/playlist) → one (loop this song) → off
export const LOOP_MODES = ['off', 'all', 'one']

// Playback speeds offered in Now Playing's menu. Applies to everything.
export const SPEEDS = [0.75, 1, 1.25, 1.5, 2]
const SKIP_BACK = 15
const SKIP_FORWARD = 30

function loadSpeed() {
  try {
    const v = Number(localStorage.getItem('melody.speed'))
    return SPEEDS.includes(v) ? v : 1
  } catch {
    return 1
  }
}

// Every MediaSession action we ever register — used to tear them all down on
// cleanup / when nothing is playing, so the lock screen never keeps stale
// handlers bound to a previous track's closures.
const MEDIA_ACTIONS = [
  'play', 'pause', 'previoustrack', 'nexttrack',
  'stop', 'seekbackward', 'seekforward', 'seekto',
]

export function PlayerProvider({ children }) {
  const audioRef = useRef(null)
  const countedRef = useRef(false) // so each play only bumps playCount once
  const loadedRef = useRef(null) // the item the <audio> element is loaded with
  const lastSavedRef = useRef(0) // position last written to the db (long-form only)
  const sourceRef = useRef(null) // playlist id the queue came from, for resume
  const startAtRef = useRef(null) // one-shot start position for the next load
  const lastResumeRef = useRef(0)
  const objectUrlRef = useRef(null) // current blob: URL, revoked when track changes
  const [missing, setMissing] = useState(false) // audio bytes not found

  const [queue, setQueue] = useState([]) // array of track objects
  const [index, setIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loopMode, setLoopMode] = useState('off')
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  // Bumped to force the load effect to re-run even when index/current.id are
  // unchanged — i.e. restart the current track on re-tap or a single-track
  // loop-all wrap, without the setIndex(-1) bounce that made `current` briefly
  // null (which flashed the Now Playing screen closed).
  const [playToken, setPlayToken] = useState(0)
  const [speed, setSpeed] = useState(loadSpeed)
  // Where the queue came from, for "Playing from …": { name, playlistId }.
  const [source, setSource] = useState(null)
  const speedRef = useRef(speed)
  speedRef.current = speed

  const current = index >= 0 ? queue[index] : null
  const longForm = isLongForm(current)

  // Everything plays at the chosen speed. Safari resets playbackRate on
  // every load, so this also runs from loadedmetadata.
  const applyRate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    const rate = speedRef.current
    audio.defaultPlaybackRate = rate
    audio.playbackRate = rate
  }, [])

  // ── Core: load + play a queue starting at a given index ──
  // opts.playlistId: remember progress on that playlist as it plays.
  // opts.startAt: begin the first track at this position (seconds).
  // opts.source: { name, playlistId } shown as "Playing from <name>".
  const playQueue = useCallback((tracks, startIndex = 0, opts = {}) => {
    if (!tracks.length) return
    sourceRef.current = opts.playlistId ?? null
    setSource(opts.source ?? null)
    startAtRef.current = opts.startAt ?? null
    setQueue(tracks)
    setIndex(startIndex)
    setPlayToken((t) => t + 1) // reload even if startIndex === the current index
  }, [])

  // Insert a track right after the current one (Spotify's "Play next").
  const playNext = useCallback((track) => {
    setQueue((q) => {
      if (!q.length) return [track]
      const copy = [...q]
      copy.splice(index + 1, 0, track)
      return copy
    })
    setIndex((i) => (i < 0 ? 0 : i)) // start playing if the queue was empty
  }, [index])

  // Append a track to the end of the queue ("Add to queue").
  const addToQueue = useCallback((track) => {
    setQueue((q) => [...q, track])
    setIndex((i) => (i < 0 ? 0 : i))
  }, [])

  // Convenience: play a single track, optionally within a list as its queue.
  const playTrack = useCallback(
    (track, list, opts) => {
      const q = list && list.length ? list : [track]
      const i = q.findIndex((t) => t.id === track.id)
      playQueue(q, i < 0 ? 0 : i, opts)
    },
    [playQueue],
  )

  // When index/current changes, resolve the audio source and play.
  // Sample tracks carry a `src` URL; imported tracks store bytes in IndexedDB,
  // so we read the Blob and create an object URL (revoking the previous one).
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !current) return
    let cancelled = false
    countedRef.current = false
    // Blank the loaded-id until the element actually switches to this track, so
    // a timeupdate from the still-playing PREVIOUS track (during the async blob
    // read) can't be credited to it a second time.
    loadedRef.current = null
    setMissing(false)
    // Reset the scrubber immediately so it doesn't show the previous track's
    // position/length until the new metadata arrives.
    setProgress(0)
    setDuration(0)

    const revokePrev = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }

    ;(async () => {
      // Imported tracks only exist as a Blob. Episodes stream from their URL
      // unless they've been downloaded, in which case the Blob wins (offline).
      let blob = null
      if (!current.src || current.kind === 'episode') blob = await getAudioBlob(current.id)
      if (!blob && !current.src) {
        // Bytes are gone (cleared storage / failed import). Stop the element
        // so it doesn't keep playing the PREVIOUS track under a now-missing
        // `current`, and reset state so the UI can show an honest message.
        if (!cancelled) {
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
          revokePrev() // release the previous track's blob URL too
          setIsPlaying(false)
          setMissing(true)
        }
        return
      }
      const startAt = startAtRef.current
      startAtRef.current = null
      const resumeAt = startAt != null ? startAt : isLongForm(current) ? await getPosition(current).catch(() => 0) : 0
      if (cancelled) return
      const url = blob ? URL.createObjectURL(blob) : current.src
      revokePrev()
      if (blob) objectUrlRef.current = url
      audio.src = url
      loadedRef.current = current // element is now this track → safe to count
      lastSavedRef.current = resumeAt
      lastResumeRef.current = resumeAt
      if (sourceRef.current != null) savePlaylistResume(sourceRef.current, current.id, resumeAt).catch(() => {})
      applyRate()
      if (resumeAt > 5) {
        // Pick up where you left off, unless that was the last few seconds.
        audio.addEventListener('loadedmetadata', () => {
          if (!audio.duration || resumeAt < audio.duration - 15) audio.currentTime = resumeAt
        }, { once: true })
      }
      audio.loop = loopMode === 'one'
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.id, playToken])

  useEffect(() => {
    applyRate()
    try { localStorage.setItem('melody.speed', String(speed)) } catch { /* private mode */ }
  }, [speed, applyRate])

  // Keep the native loop flag in sync when the mode changes mid-track.
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loopMode === 'one'
  }, [loopMode])

  // Revoke the last object URL when the provider unmounts (the per-track effect
  // only revokes the PREVIOUS one on the next load).
  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
  }, [])

  // Resume playback. Idempotent (play() while already playing is a no-op), so
  // it can never invert iOS's own control of the element — this is what makes
  // AirPods/lock-screen resume reliable. On reject we sync isPlaying=false so
  // mediaSession.playbackState doesn't drift (which would route the wrong
  // remote action next press).
  const play = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !current) return
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
  }, [current])

  // Pause playback. Idempotent for the same reason.
  const pause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    setIsPlaying(false)
  }, [])

  // In-app play/pause button: toggles based on the element's live state. The
  // MediaSession remote actions must NOT use this — they get the dedicated,
  // semantic play/pause handlers above.
  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !current) return
    if (audio.paused) play()
    else pause()
  }, [current, play, pause])

  const next = useCallback(() => {
    // Single-track queue: the only "advance" is restarting the lone track, and
    // only when looping all (otherwise stay put). A token bump handles it since
    // the index can't change.
    if (queue.length <= 1) {
      if (loopMode === 'all') setPlayToken((t) => t + 1)
      return
    }
    // Multi-track: functional updater keeps advances atomic under rapid taps.
    setIndex((i) => (i + 1 < queue.length ? i + 1 : loopMode === 'all' ? 0 : i))
  }, [queue.length, loopMode])

  const prev = useCallback(() => {
    const audio = audioRef.current
    // Mirror Spotify: if >3s in, restart the song instead of jumping back.
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    if (queue.length <= 1) {
      if (loopMode === 'all') setPlayToken((t) => t + 1)
      return
    }
    setIndex((i) => (i > 0 ? i - 1 : loopMode === 'all' ? queue.length - 1 : i))
  }, [queue.length, loopMode])

  const seek = useCallback((t) => {
    if (audioRef.current) audioRef.current.currentTime = t
  }, [])

  const skip = useCallback((sec) => {
    const a = audioRef.current
    if (!a) return
    const t = (a.currentTime || 0) + sec
    a.currentTime = Math.max(0, a.duration ? Math.min(a.duration, t) : t)
  }, [])

  const pickSpeed = useCallback((v) => {
    if (SPEEDS.includes(v)) setSpeed(v)
  }, [])

  // Write the listening position for long-form items. Skipped in the last
  // stretch so finishing an episode doesn't leave it "resume at 59:58", and in
  // the first seconds, which is where a fresh load sits before the resume seek.
  const persistPosition = (a) => {
    const item = loadedRef.current
    if (!isLongForm(item) || !a.duration) return
    if (a.currentTime < 5 || a.currentTime > a.duration - 15) return
    lastSavedRef.current = a.currentTime
    savePosition(item, a.currentTime).catch(() => {})
  }

  // Playlist bookmark: the track and spot, for the Resume button.
  const persistResume = (a) => {
    const item = loadedRef.current
    if (sourceRef.current == null || !item) return
    lastResumeRef.current = a.currentTime
    savePlaylistResume(sourceRef.current, item.id, a.currentTime).catch(() => {})
  }

  const cycleLoop = useCallback(() => {
    setLoopMode((m) => LOOP_MODES[(LOOP_MODES.indexOf(m) + 1) % LOOP_MODES.length])
  }, [])

  // ── <audio> event wiring ──
  const onTimeUpdate = (e) => {
    const a = e.target
    setProgress(a.currentTime)
    // Count a play only after real listening — a few seconds in, or halfway
    // through a short track. Doing it here (not on loadedmetadata) means
    // skipping past tracks no longer inflates playCount, and we credit the
    // track the element is actually loaded with, not a since-changed `current`.
    if (!countedRef.current && loadedRef.current && a.currentTime >= Math.min(5, (a.duration || 10) * 0.5)) {
      countedRef.current = true
      bumpPlayCount(loadedRef.current.id).catch(() => {})
    }
    if (Math.abs(a.currentTime - lastSavedRef.current) >= 5) persistPosition(a)
    if (Math.abs(a.currentTime - lastResumeRef.current) >= 5) persistResume(a)
    // Feed the lock-screen scrubber on iOS.
    if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && a.duration && Number.isFinite(a.duration)) {
      try {
        navigator.mediaSession.setPositionState({
          duration: a.duration,
          position: a.currentTime,
          playbackRate: a.playbackRate || 1,
        })
      } catch {
        /* setPositionState throws if values are momentarily inconsistent — ignore */
      }
    }
  }
  const onLoadedMeta = (e) => {
    setDuration(e.target.duration || 0)
    applyRate()
  }
  const onEnded = () => {
    if (isLongForm(loadedRef.current)) setPlayed(loadedRef.current, true).catch(() => {})
    // loop === 'one' is handled by audio.loop (no 'ended' fires).
    if (index + 1 < queue.length) {
      setIndex((i) => i + 1)
    } else if (loopMode === 'all') {
      // Wrap to the top and restart even if already at index 0 (single-track
      // queue). The playToken bump forces the reload without nulling `current`,
      // so Now Playing no longer flashes closed on every loop.
      setIndex(0)
      setPlayToken((t) => t + 1)
    } else {
      setIsPlaying(false)
    }
  }

  // ── Media Session API → iOS lock screen / control center / AirPods ──
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    // setActionHandler throws for actions an engine doesn't support, so wrap
    // each one; likewise nulling handlers on cleanup.
    const clearAll = () => {
      for (const a of MEDIA_ACTIONS) {
        try { ms.setActionHandler(a, null) } catch { /* action unsupported */ }
      }
    }

    // Nothing loaded → tear down so the lock screen doesn't keep stale controls.
    if (!current) {
      ms.metadata = null
      clearAll()
      return
    }

    // The lock screen crops to a square too, so skip the letterboxed
    // hqdefault; a numbered track without art gets its number tile drawn.
    const yt = ytThumbId(current.thumbnailUrl)
    const tile = seriesTile(current)
    const artwork = yt
      ? [
          { src: `https://i.ytimg.com/vi/${yt}/maxresdefault.jpg`, sizes: '1280x720', type: 'image/jpeg' },
          { src: `https://i.ytimg.com/vi/${yt}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' },
        ]
      : current.thumbnailUrl
        ? [{ src: current.thumbnailUrl, sizes: 'any', type: 'image/jpeg' }]
        : tile
          ? [{ src: tileArtwork(tile), sizes: '512x512', type: 'image/png' }]
          : []
    ms.metadata = new window.MediaMetadata({
      title: displayTitle(current) || 'Unknown',
      artist: '',
      album: source?.name || '',
      artwork,
    })

    const set = (action, handler) => {
      try { ms.setActionHandler(action, handler) } catch { /* action unsupported */ }
    }
    set('play', play)
    set('pause', pause)
    // Long-form gets skip buttons on the lock screen instead of prev/next:
    // iOS only shows them when the track actions are left unset.
    if (!longForm) {
      set('previoustrack', prev)
      set('nexttrack', next)
    }
    set('stop', () => {
      pause()
      if (audioRef.current) audioRef.current.currentTime = 0
    })
    set('seekbackward', (d) => skip(-(d.seekOffset || (longForm ? SKIP_BACK : 10))))
    set('seekforward', (d) => skip(d.seekOffset || (longForm ? SKIP_FORWARD : 10)))
    set('seekto', (d) => { if (d.seekTime != null) seek(d.seekTime) })

    // Clear handlers when the track changes or the provider unmounts, so no
    // remote press ever fires a closure bound to the previous track.
    return clearAll
  }, [current, source, longForm, play, pause, prev, next, seek, skip])

  // Single source of truth for playbackState: 'none' when nothing is loaded,
  // else mirror isPlaying. iOS uses this to decide whether a remote press maps
  // to the play or the pause action, so it must stay in sync.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.playbackState = !current ? 'none' : isPlaying ? 'playing' : 'paused'
    } catch { /* older browsers */ }
  }, [isPlaying, current])

  const value = {
    current, queue, index, isPlaying, loopMode, progress, duration, missing, longForm, speed, source,
    playTrack, playQueue, playNext, addToQueue, toggle, next, prev, seek, cycleLoop, skip, pickSpeed,
  }

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        playsInline
        preload="metadata"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMeta}
        onEnded={onEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={(e) => {
          setIsPlaying(false)
          persistPosition(e.target)
          persistResume(e.target)
        }}
        onError={(e) => {
          // A stream that can't load (offline, feed host down). Code 1 is an
          // abort from switching tracks, which isn't a failure.
          if (e.target.error?.code === 1 || !loadedRef.current) return
          setIsPlaying(false)
          setMissing(true)
        }}
      />
    </PlayerContext.Provider>
  )
}
