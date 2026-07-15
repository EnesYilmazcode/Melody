import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { bumpPlayCount, getAudioBlob } from '../lib/db'

const PlayerContext = createContext(null)
export const usePlayer = () => useContext(PlayerContext)

// Loop modes cycle in this order when you tap the loop button:
//   off → all (loop the whole queue/playlist) → one (loop this song) → off
export const LOOP_MODES = ['off', 'all', 'one']

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

  const current = index >= 0 ? queue[index] : null

  // ── Core: load + play a queue starting at a given index ──
  const playQueue = useCallback((tracks, startIndex = 0) => {
    if (!tracks.length) return
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
    (track, list) => {
      const q = list && list.length ? list : [track]
      const i = q.findIndex((t) => t.id === track.id)
      playQueue(q, i < 0 ? 0 : i)
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
      let url = current.src
      if (!url) {
        const blob = await getAudioBlob(current.id)
        if (!blob) {
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
        if (cancelled) return
        url = URL.createObjectURL(blob)
      }
      if (cancelled) {
        if (!current.src) URL.revokeObjectURL(url)
        return
      }
      revokePrev()
      if (!current.src) objectUrlRef.current = url
      audio.src = url
      audio.loop = loopMode === 'one'
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.id, playToken])

  // Keep the native loop flag in sync when the mode changes mid-track.
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loopMode === 'one'
  }, [loopMode])

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

  const cycleLoop = useCallback(() => {
    setLoopMode((m) => LOOP_MODES[(LOOP_MODES.indexOf(m) + 1) % LOOP_MODES.length])
  }, [])

  // ── <audio> event wiring ──
  const onTimeUpdate = (e) => {
    const a = e.target
    setProgress(a.currentTime)
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
    // Count a play shortly after it successfully starts.
    if (current && !countedRef.current) {
      countedRef.current = true
      bumpPlayCount(current.id)
    }
  }
  const onEnded = () => {
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

    ms.metadata = new window.MediaMetadata({
      title: current.title || 'Unknown',
      artist: current.artist || '',
      artwork: current.thumbnailUrl
        ? [{ src: current.thumbnailUrl, sizes: '512x512', type: 'image/png' }]
        : [],
    })

    const set = (action, handler) => {
      try { ms.setActionHandler(action, handler) } catch { /* action unsupported */ }
    }
    set('play', play)
    set('pause', pause)
    set('previoustrack', prev)
    set('nexttrack', next)
    set('stop', () => {
      pause()
      if (audioRef.current) audioRef.current.currentTime = 0
    })
    set('seekbackward', (d) => seek(Math.max(0, (audioRef.current?.currentTime || 0) - (d.seekOffset || 10))))
    set('seekforward', (d) => {
      const a = audioRef.current
      if (!a) return
      const target = (a.currentTime || 0) + (d.seekOffset || 10)
      seek(a.duration ? Math.min(a.duration, target) : target)
    })
    set('seekto', (d) => { if (d.seekTime != null) seek(d.seekTime) })

    // Clear handlers when the track changes or the provider unmounts, so no
    // remote press ever fires a closure bound to the previous track.
    return clearAll
  }, [current, play, pause, prev, next, seek])

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
    current, queue, index, isPlaying, loopMode, progress, duration, missing,
    playTrack, playQueue, playNext, addToQueue, toggle, next, prev, seek, cycleLoop,
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
        onPause={() => setIsPlaying(false)}
      />
    </PlayerContext.Provider>
  )
}
