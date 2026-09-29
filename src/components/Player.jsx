import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { usePlayer, SPEEDS } from '../state/PlayerProvider'
import { useUI } from '../state/UIProvider'
import { toggleStar } from '../lib/db'
import { useLyrics, useTrack } from '../state/useLibrary'
import { ensureLyrics, researchLyrics, activeLine } from '../lib/lyrics'
import { ytThumbId } from '../lib/youtube'
import { seriesTile, displayTitle } from '../lib/series'
import { useDragDismiss } from '../lib/useDragDismiss'
import { motionMs, EASE_SHEET } from '../lib/motion'
import { formatTime } from '../lib/format'
import Artwork from './Artwork'
import Icon from './Icon'
import Sheet from './Sheet'

export default function Player() {
  const p = usePlayer()
  const [open, setOpen] = useState(false)
  const mini = useRef(null)
  useSwipeUp(mini, !!p.current, () => setOpen(true))
  if (!p.current) return null // nothing playing → no bar

  return (
    <>
      {/* A DIV, not a button, so the inner play/next <button>s aren't
          invalidly nested (which broke their taps on iOS). */}
      <div
        className="mini"
        ref={mini}
        role="button"
        tabIndex={0}
        aria-label="Open Now Playing"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
      >
        <Artwork track={p.current} size={42} />
        <span className="mini__t">
          <span className="mini__title">{displayTitle(p.current)}</span>
          {p.missing && <span className="mini__sub">{missingShort(p.current)}</span>}
        </span>
        <span onClick={(e) => e.stopPropagation()} style={{ display: 'flex' }}>
          <button className="iconbtn" onClick={p.toggle} aria-label={p.isPlaying ? 'Pause' : 'Play'} disabled={p.missing}>
            <Icon name={p.isPlaying ? 'pause' : 'play'} size={24} />
          </button>
          <button className="iconbtn" onClick={p.next} aria-label="Next"><Icon name="next" size={26} /></button>
        </span>
        <span className="mini__prog">
          <i style={{ transform: `scaleX(${p.duration ? Math.min(1, p.progress / p.duration) : 0})` }} />
        </span>
      </div>

      {open && <NowPlaying p={p} onClosed={() => setOpen(false)} />}
    </>
  )
}

// Swipe up on the mini player opens Now Playing; a tap still works via click.
// Attached once per mount: progress re-renders must not reset a swipe midway.
function useSwipeUp(ref, mounted, onOpen) {
  const cb = useRef(onOpen)
  cb.current = onOpen
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let start = null
    const down = (e) => { start = { x: e.clientX, y: e.clientY } }
    const move = (e) => {
      if (!start) return
      const dy = e.clientY - start.y
      if (dy < -28 && Math.abs(dy) > Math.abs(e.clientX - start.x)) {
        start = null
        cb.current()
      }
    }
    const up = () => { start = null }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [ref, mounted])
}

// Page-behind recede: 1 = Now Playing fully up. Drives .app via --np.
function setBehind(v, animate) {
  const root = document.documentElement
  root.classList.toggle('np-anim', animate)
  root.style.setProperty('--np', String(v))
}

function NowPlaying({ p, onClosed }) {
  const sheet = useRef(null)
  const closed = useRef(false)
  const [lyricsOn, setLyricsOn] = useState(false)
  const [menu, setMenu] = useState(false)
  const { goToPlaylist, openAddToPlaylist } = useUI()
  const lyrics = useLyrics(p.current.id)
  const live = useTrack(p.current.id) // live star state (the queue snapshot can be stale)
  const starred = live ? live.starred : p.current.starred
  const tile = seriesTile(p.current)

  const slide = (to, ms) => {
    const el = sheet.current
    if (!el) return
    el.style.transition = ms ? `transform ${ms}ms ${EASE_SHEET}` : 'none'
    el.style.transform = to
  }

  useLayoutEffect(() => {
    slide('translateY(100%)', 0)
    sheet.current.getBoundingClientRect()
    slide('', motionMs(420))
    setBehind(1, true)
    return () => setBehind(0, false)
  }, [])

  // Every close path animates down, then unmounts.
  const close = useCallback((then) => {
    if (closed.current) return
    closed.current = true
    const ms = motionMs(340)
    slide('translateY(100%)', ms)
    setBehind(0, true)
    setTimeout(() => {
      document.documentElement.classList.remove('np-anim')
      onClosed()
      if (typeof then === 'function') then()
    }, ms)
  }, [onClosed])

  useDragDismiss(sheet, {
    exclude: 'button, input, .scrub, [data-nodrag]',
    onDrag: (d) => {
      slide(`translateY(${d}px)`, 0)
      setBehind(Math.max(0, 1 - d / (sheet.current.offsetHeight || 800)), false)
    },
    onEnd: (d, v) => {
      if (d > 140 || v > 0.55) close()
      else {
        slide('', motionMs(380))
        setBehind(1, true)
      }
    },
  })

  // Escape closes (hardware keyboards), unless a sheet on top takes it.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !menu && !document.querySelector('.sheet')) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu, close])

  // Fetch + cache lyrics when the track changes (no-op if already cached).
  useEffect(() => {
    ensureLyrics(p.current).catch(() => {})
  }, [p.current.id])

  const sourceName = p.source?.name || 'Library'
  const loopIcon = p.loopMode === 'one' ? 'repeat1' : 'repeat'
  const loopLabel = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' }[p.loopMode]

  return createPortal(
    <div
      className="now"
      ref={sheet}
      role="dialog"
      aria-modal="true"
      aria-label="Now Playing"
      tabIndex={-1}
    >
      <Backdrop track={p.current} tile={tile} />
      <div className="grab" aria-hidden="true" />
      <div className="source">Playing from <b>{sourceName}</b></div>

      {lyricsOn ? (
        <LyricsView lyrics={lyrics} progress={p.progress} onSeek={p.seek} onResearch={() => researchLyrics(p.current)} />
      ) : (
        <div className="now__art">
          <Cover track={p.current} tile={tile} paused={!p.isPlaying && !p.missing} />
        </div>
      )}

      <div className="titlerow">
        <div className="titlerow__t">
          <Title text={displayTitle(p.current)} />
        </div>
        <button
          className={`glass ${starred ? 'glass--on' : ''}`}
          onClick={() => toggleStar(p.current.id).catch(() => {})}
          aria-label={starred ? 'Unfavorite' : 'Favorite'}
          aria-pressed={!!starred}
        >
          <i><Icon name={starred ? 'star' : 'starline'} size={16} /></i>
        </button>
        <button className="glass" onClick={() => setMenu(true)} aria-label="More">
          <i><Icon name="more" size={18} /></i>
        </button>
      </div>

      {p.missing ? (
        <p className="np-missing" role="status">{missingLong(p.current)}</p>
      ) : (
        <Scrubber progress={p.progress} duration={p.duration} onSeek={p.seek} />
      )}

      <div className={`transport ${p.longForm ? 'transport--long' : ''}`}>
        {p.longForm && (
          <button className="tp tp--sm" onClick={() => p.skip(-15)} aria-label="Back 15 seconds"><Icon name="back15" size={30} /></button>
        )}
        <button className="tp" onClick={p.prev} aria-label="Previous"><Icon name="prev" size={36} /></button>
        <button className="tp" onClick={p.toggle} aria-label={p.isPlaying ? 'Pause' : 'Play'} disabled={p.missing}>
          <Icon name={p.isPlaying ? 'pause' : 'play'} size={48} />
        </button>
        <button className="tp" onClick={p.next} aria-label="Next"><Icon name="next" size={36} /></button>
        {p.longForm && (
          <button className="tp tp--sm" onClick={() => p.skip(30)} aria-label="Forward 30 seconds"><Icon name="fwd30" size={30} /></button>
        )}
      </div>

      <div className="foot">
        <button className={`ft ${lyricsOn ? 'ft--on' : ''}`} onClick={() => setLyricsOn((s) => !s)} aria-label="Lyrics" aria-pressed={lyricsOn}>
          <Icon name="lyrics" size={22} />
        </button>
        <button className={`ft ${p.loopMode !== 'off' ? 'ft--on' : ''}`} onClick={p.cycleLoop} aria-label={loopLabel}>
          <Icon name={loopIcon} size={22} />
        </button>
      </div>

      {menu && (
        <Sheet onClose={() => setMenu(false)} label="Track options">
          {(closeMenu) => (
            <>
              <div className="sheet__grp">
                <button className="sheet__row" onClick={() => closeMenu(() => openAddToPlaylist(live || p.current))}>
                  <span>Add to playlist</span><Icon name="plus" size={20} />
                </button>
                {p.source?.playlistId != null && (
                  <button className="sheet__row" onClick={() => closeMenu(() => close(() => goToPlaylist(p.source.playlistId)))}>
                    <span>Go to {p.source.name}</span><Icon name="tab_playlists" size={20} />
                  </button>
                )}
                {/* Speed: no label, the values say what it is. Persists and applies to every track. */}
                <div className="seg" role="radiogroup" aria-label="Playback speed">
                  <div className="seg__track">
                    {SPEEDS.map((v) => (
                      <button
                        key={v}
                        role="radio"
                        aria-checked={p.speed === v}
                        aria-label={`${v}x speed`}
                        className={p.speed === v ? 'on' : ''}
                        onClick={() => p.pickSpeed(v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="sheet__grp">
                <button className="sheet__row sheet__row--c" onClick={() => closeMenu()}>Cancel</button>
              </div>
            </>
          )}
        </Sheet>
      )}
    </div>,
    document.body,
  )
}

// YouTube art is 16:9: fit it whole over a blurred, zoomed copy of itself.
function ytChain(url) {
  const id = ytThumbId(url)
  if (!id) return url ? [url] : []
  const base = `https://i.ytimg.com/vi/${id}`
  return [`${base}/maxresdefault.jpg`, `${base}/mqdefault.jpg`, `${base}/hqdefault.jpg`]
}

function useChain(url) {
  const chain = ytChain(url)
  const [step, setStep] = useState(0)
  useEffect(() => setStep(0), [url])
  return {
    src: chain[step],
    onError: () => setStep((n) => n + 1),
    // A missing maxres answers with a 120px grey placeholder, not an error.
    onLoad: (e) => { if (chain[step]?.includes('maxresdefault') && e.currentTarget.naturalWidth <= 120) setStep((n) => n + 1) },
  }
}

function Cover({ track, tile, paused }) {
  const img = useChain(track.thumbnailUrl)
  const cls = `cover ${paused ? 'cover--paused' : ''}`
  if (img.src) {
    return (
      <div className={cls}>
        <img className="fill" src={img.src} alt="" aria-hidden="true" />
        <img className="fit" src={img.src} alt="" onError={img.onError} onLoad={img.onLoad} />
      </div>
    )
  }
  if (tile) {
    return (
      <div className={`${cls} cover--series`} style={{ '--h': tile.hue }}>
        <div className="big">{tile.num}</div>
        <div className="cap">{tile.label}</div>
      </div>
    )
  }
  return <div className={cls}><Artwork track={track} size={342} radius={0} /></div>
}

function Backdrop({ track, tile }) {
  const img = useChain(track.thumbnailUrl)
  let h = tile?.hue
  if (h == null) {
    let x = 0
    for (const c of track.id || '') x = (x * 31 + c.charCodeAt(0)) % 360
    h = 16 + (x % 30)
  }
  return (
    <div className="now__bg" aria-hidden="true">
      {img.src ? <img src={img.src} alt="" onError={img.onError} /> : <div className="blob" style={{ '--h': h }} />}
    </div>
  )
}

// One line; a title too long for it scrolls once in a while instead of
// losing its end to an ellipsis.
function Title({ text }) {
  const box = useRef(null)
  const inner = useRef(null)
  const [over, setOver] = useState(0)
  useLayoutEffect(() => {
    const measure = () => setOver(Math.max(0, inner.current.scrollWidth - box.current.clientWidth))
    measure()
    document.fonts?.ready.then(measure)
  }, [text])
  const reduce = motionMs(1000) < 1000
  const cls = over > 0 ? (reduce ? 'np-title np-title--clip' : 'np-title np-title--marquee np-title--clip') : 'np-title'
  return (
    <div className={cls} ref={box} style={over ? { '--mq': `${-(over + 24)}px`, '--mq-dur': `${Math.max(8, over / 18)}s` } : undefined}>
      <span ref={inner}>{text}</span>
    </div>
  )
}

// Custom scrubber: no thumb; it thickens while held and seeks on release.
function Scrubber({ progress, duration, onSeek }) {
  const track = useRef(null)
  const [drag, setDrag] = useState(null) // seconds while dragging
  const ratioAt = (x) => {
    const r = track.current.getBoundingClientRect()
    return Math.min(1, Math.max(0, (x - r.left) / r.width))
  }
  const t = drag ?? progress
  const pct = duration ? Math.min(1, t / duration) : 0

  const down = (e) => {
    if (!duration) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag(ratioAt(e.clientX) * duration)
  }
  const move = (e) => { if (drag != null) setDrag(ratioAt(e.clientX) * duration) }
  const up = () => {
    if (drag == null) return
    onSeek(drag)
    setDrag(null)
  }
  const key = (e) => {
    const step = { ArrowLeft: -5, ArrowRight: 5 }[e.key]
    if (step && duration) {
      e.preventDefault()
      onSeek(Math.min(duration, Math.max(0, progress + step)))
    }
  }

  return (
    <div
      className={`scrub ${drag != null ? 'scrub--active' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label="Position"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration || 0)}
      aria-valuenow={Math.round(t)}
      aria-valuetext={formatTime(t)}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => setDrag(null)}
      onKeyDown={key}
    >
      <div className="scrub__track" ref={track}><i style={{ transform: `scaleX(${pct})` }} /></div>
      <div className="scrub__times">
        <span className="num">{formatTime(t)}</span>
        <span className="num">-{formatTime(Math.max(0, (duration || 0) - t))}</span>
      </div>
    </div>
  )
}

function LyricsView({ lyrics, progress, onSeek, onResearch }) {
  const box = useRef(null)
  const activeRef = useRef(null)
  const touchedAt = useRef(0)
  const [researching, setResearching] = useState(false)
  const synced = lyrics?.synced
  const idx = activeLine(synced, progress)

  // Keep the active line centered, unless the reader scrolled in the last few
  // seconds. Scrolls only this box (scrollIntoView would also move the sheet).
  useEffect(() => {
    const el = activeRef.current
    const sc = box.current
    if (!el || !sc || Date.now() - touchedAt.current < 3000) return
    sc.scrollTo({ top: el.offsetTop - sc.clientHeight / 2 + el.offsetHeight / 2, behavior: motionMs(1) > 1 ? 'smooth' : 'auto' })
  }, [idx])
  const touched = () => { touchedAt.current = Date.now() }

  const research = async () => {
    setResearching(true)
    try { await onResearch() } finally { setResearching(false) }
  }
  // "Wrong song?" footer so a bad match is one tap to fix.
  const footer = lyrics !== undefined && (
    <button className="lyrics__research" onClick={research} disabled={researching}>
      {researching ? 'Searching…' : 'Wrong lyrics? Search again'}
    </button>
  )

  if (lyrics === undefined) return <div className="lyrics lyrics--msg">Loading lyrics…</div>
  if (synced && synced.length) {
    return (
      <div className="lyrics" data-scroll ref={box} onTouchStart={touched} onWheel={touched} style={{ position: 'relative' }}>
        {synced.map((line, i) => (
          <p
            key={i}
            ref={i === idx ? activeRef : null}
            className={`lyrics__line ${i === idx ? 'is-active' : ''} ${i < idx ? 'is-past' : ''}`}
            onClick={() => onSeek(line.time)}
          >
            {line.text || '♪'}
          </p>
        ))}
        {footer}
      </div>
    )
  }
  if (lyrics?.plain) {
    return <div className="lyrics lyrics--plain" data-scroll>{lyrics.plain}{footer}</div>
  }
  return (
    <div className="lyrics lyrics--msg">
      <span>No lyrics found for this track.</span>
      {footer}
    </div>
  )
}

// An episode that fails to load is usually just offline, not missing bytes.
function missingShort(item) {
  return item.kind === 'episode' ? "Can't stream right now" : 'Audio missing. Import it again'
}
function missingLong(item) {
  return item.kind === 'episode'
    ? "Can't stream this episode right now. Download it while you have a connection to play it offline."
    : 'The audio file for this track is missing. Import it again from Files to play it.'
}
