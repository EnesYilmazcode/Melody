import { useState, useEffect, useRef } from 'react'
import { usePlayer } from '../state/PlayerProvider'
import { toggleStar } from '../lib/db'
import { useLyrics, useTrack } from '../state/useLibrary'
import { ensureLyrics, researchLyrics, activeLine } from '../lib/lyrics'
import Artwork, { warmGlow } from './Artwork'
import { formatTime } from '../lib/format'

export default function Player() {
  const p = usePlayer()
  const [expanded, setExpanded] = useState(false)
  if (!p.current) return null // nothing playing → no bar

  return (
    <>
      {/* Mini bar — a button-like card, but a DIV so the inner play/next
          <button>s aren't invalidly nested (which broke their taps on iOS). */}
      <div
        className="mini"
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(true)
          }
        }}
      >
        <Artwork track={p.current} size={40} />
        <span className="mini__meta">
          <span className="mini__title">{p.current.title}</span>
          <span className="mini__artist">
            {p.missing ? missingShort(p.current) : p.current.artist}
          </span>
        </span>
        <span className="mini__controls" onClick={(e) => e.stopPropagation()}>
          <button className="iconbtn" onClick={p.toggle} aria-label={p.isPlaying ? 'Pause' : 'Play'} disabled={p.missing}>
            {p.isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button className="iconbtn" onClick={p.next} aria-label="Next"><NextIcon /></button>
        </span>
        <span className="mini__progress" style={{ width: `${(p.progress / (p.duration || 1)) * 100}%` }} />
      </div>

      {expanded && <NowPlaying p={p} onClose={() => setExpanded(false)} />}
    </>
  )
}

function NowPlaying({ p, onClose }) {
  const loopLabel = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' }[p.loopMode]
  const [showLyrics, setShowLyrics] = useState(false)
  const lyrics = useLyrics(p.current.id)
  const live = useTrack(p.current.id) // live star state (snapshot can be stale)
  const starred = live ? live.starred : p.current.starred

  // Fetch + cache lyrics when the track changes (no-op if already cached).
  useEffect(() => {
    ensureLyrics(p.current).catch(() => {})
  }, [p.current.id])

  const pct = p.duration ? (p.progress / p.duration) * 100 : 0

  return (
    <div className="now" style={{ '--np-glow': warmGlow(p.current.id) }}>
      <div className="now__bar">
        <button className="iconbtn" onClick={onClose} aria-label="Minimize"><ChevronDown /></button>
        <span className="now__eyebrow">Now Playing</span>
        <button
          className={`iconbtn ${showLyrics ? 'iconbtn--on' : ''}`}
          onClick={() => setShowLyrics((s) => !s)}
          aria-label="Lyrics"
        >
          <LyricsIcon />
        </button>
      </div>

      {showLyrics ? (
        <LyricsView lyrics={lyrics} progress={p.progress} onSeek={p.seek} onResearch={() => researchLyrics(p.current)} />
      ) : (
        <div className="now__art"><Artwork track={p.current} size={280} radius={22} /></div>
      )}

      <div className="now__info">
        <div className="now__text">
          <h2>{p.current.title}</h2>
          <p>{p.current.artist}</p>
        </div>
        <button
          className={`iconbtn ${starred ? 'iconbtn--star-on' : ''}`}
          onClick={() => toggleStar(p.current.id).catch(() => {})}
          aria-label="Favorite"
        >
          <StarIcon filled={!!starred} />
        </button>
      </div>

      {p.missing ? (
        <p className="now__missing" role="status">{missingLong(p.current)}</p>
      ) : (
        <div className="scrub">
          <input
            type="range"
            min="0"
            max={p.duration || 0}
            step="0.1"
            value={p.progress}
            onChange={(e) => p.seek(Number(e.target.value))}
            style={{ background: `linear-gradient(to right, var(--accent) ${pct}%, var(--surface-2) ${pct}%)` }}
          />
          <div className="scrub__times">
            <span>{formatTime(p.progress)}</span>
            <span>{formatTime(p.duration)}</span>
          </div>
        </div>
      )}

      <div className="transport">
        {p.longForm ? (
          <button className="iconbtn skipbtn" onClick={() => p.skip(-15)} aria-label="Back 15 seconds"><SkipIcon back n={15} /></button>
        ) : (
          <button className="iconbtn" onClick={p.prev} aria-label="Previous"><PrevIcon /></button>
        )}
        <button className="playbtn" onClick={p.toggle} aria-label={p.isPlaying ? 'Pause' : 'Play'} disabled={p.missing}>
          {p.isPlaying ? <PauseIcon big /> : <PlayIcon big />}
        </button>
        {p.longForm ? (
          <button className="iconbtn skipbtn" onClick={() => p.skip(30)} aria-label="Forward 30 seconds"><SkipIcon n={30} /></button>
        ) : (
          <button className="iconbtn" onClick={p.next} aria-label="Next"><NextIcon /></button>
        )}
      </div>

      <div className="now__pills">
        <button
          className={`loopbtn loopbtn--${p.loopMode}`}
          onClick={p.cycleLoop}
          aria-label={loopLabel}
        >
          <RepeatIcon /> <span>{loopLabel}</span>
          {p.loopMode === 'one' && <em className="loopbtn__one">1</em>}
        </button>
        <button className={`loopbtn speedbtn${p.speed !== 1 ? ' speedbtn--on' : ''}`} onClick={p.cycleSpeed} aria-label={`Playback speed ${p.speed}x`}>
          <span>{p.speed}×</span>
        </button>
      </div>
    </div>
  )
}

function LyricsView({ lyrics, progress, onSeek, onResearch }) {
  const activeRef = useRef(null)
  const [researching, setResearching] = useState(false)
  const synced = lyrics?.synced
  const idx = activeLine(synced, progress)

  // Keep the active line centered as the song plays.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [idx])

  const research = async () => {
    setResearching(true)
    try { await onResearch() } finally { setResearching(false) }
  }
  // "Wrong song?" footer so a bad match is one tap to fix.
  const footer = lyrics !== undefined && (
    <button className="lyrics__research" onClick={research} disabled={researching}>
      {researching ? 'Searching…' : 'Wrong lyrics? Re-search'}
    </button>
  )

  if (lyrics === undefined) return <div className="lyrics lyrics--msg">Loading lyrics…</div>
  if (synced && synced.length) {
    return (
      <div className="lyrics">
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
    return <div className="lyrics lyrics--plain">{lyrics.plain}{footer}</div>
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
  return item.kind === 'episode' ? "Can't stream right now" : 'Audio unavailable — re-import'
}
function missingLong(item) {
  return item.kind === 'episode'
    ? "Can't stream this episode right now. Download it while you have a connection to play it offline."
    : 'Audio unavailable — the file for this track is missing. Re-import it to play.'
}

/* icons */
const s = { fill: 'currentColor' }
function LyricsIcon() { return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h11M4 12h9M4 18h7" /><path d="M16 17V9l4-1.5V15" /><circle cx="14.5" cy="17" r="1.6" fill="currentColor" stroke="none" /><circle cx="18.5" cy="15" r="1.6" fill="currentColor" stroke="none" /></svg> }
function PlayIcon({ big }) { const n = big ? 30 : 20; return <svg viewBox="0 0 24 24" width={n} height={n} {...s}><path d="M8 5v14l11-7z" /></svg> }
function PauseIcon({ big }) { const n = big ? 30 : 20; return <svg viewBox="0 0 24 24" width={n} height={n} {...s}><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg> }
function NextIcon() { return <svg viewBox="0 0 24 24" width="22" height="22" {...s}><path d="M6 5v14l9-7zM16 5h3v14h-3z" /></svg> }
function PrevIcon() { return <svg viewBox="0 0 24 24" width="22" height="22" {...s}><path d="M18 5v14l-9-7zM5 5h3v14H5z" /></svg> }
function RepeatIcon() { return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg> }
function ChevronDown() { return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg> }
function StarIcon({ filled }) { return <svg viewBox="0 0 24 24" width="24" height="24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 3.5l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 20l1-6L3.3 9.9l6-.9z" /></svg> }
function SkipIcon({ back, n }) {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <g transform={back ? undefined : 'translate(24 0) scale(-1 1)'}>
        <path d="M4 12a8 8 0 1 0 2.3-5.7" />
        <path d="M4 3v4h4" />
      </g>
      <text x="12" y="15.6" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">{n}</text>
    </svg>
  )
}
