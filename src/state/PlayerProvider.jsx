import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { bumpPlayCount, getAudioBlob } from '../lib/db'

const PlayerContext = createContext(null)
export const usePlayer = () => useContext(PlayerContext)

// Loop modes cycle in this order when you tap the loop button:
//   off → all (loop the whole queue/playlist) → one (loop this song) → off
export const LOOP_MODES = ['off', 'all', 'one']

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

  const current = index >= 0 ? queue[index] : null

  // ── Core: load + play a queue starting at a given index ──
  const playQueue = useCallback((tracks, startIndex = 0) => {
    if (!tracks.length) return
    setQueue(tracks)
    setIndex(startIndex)
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
          if (!cancelled) setMissing(true)
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
  }, [index, current?.id])

  // Keep the native loop flag in sync when the mode changes mid-track.
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loopMode === 'one'
  }, [loopMode])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !current) return
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {})
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }, [current])

  const next = useCallback(() => {
    setIndex((i) => {
      if (i + 1 < queue.length) return i + 1
      return loopMode === 'all' ? 0 : i // stay put at the end when not looping all
    })
  }, [queue.length, loopMode])

  const prev = useCallback(() => {
    const audio = audioRef.current
    // Mirror Spotify: if >3s in, restart the song instead of jumping back.
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
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
      // Re-trigger index 0 even if already there.
      setIndex(-1)
      requestAnimationFrame(() => setIndex(0))
    } else {
      setIsPlaying(false)
    }
  }

  // ── Media Session API → iOS lock screen / control center ──
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: current.title || 'Unknown',
      artist: current.artist || '',
      artwork: current.thumbnailUrl
        ? [{ src: current.thumbnailUrl, sizes: '512x512', type: 'image/png' }]
        : [],
    })
    navigator.mediaSession.setActionHandler('play', toggle)
    navigator.mediaSession.setActionHandler('pause', toggle)
    navigator.mediaSession.setActionHandler('previoustrack', prev)
    navigator.mediaSession.setActionHandler('nexttrack', next)
    try {
      navigator.mediaSession.setActionHandler('seekto', (d) => {
        if (d.seekTime != null) seek(d.seekTime)
      })
    } catch {
      /* 'seekto' unsupported on some browsers — non-fatal */
    }
  }, [current, toggle, prev, next, seek])

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    }
  }, [isPlaying])

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
