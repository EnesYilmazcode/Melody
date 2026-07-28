import { useState } from 'react'
import { useTracks } from '../state/useLibrary'
import { usePlayer } from '../state/PlayerProvider'
import { shuffle } from '../lib/shuffle'
import { summarize } from '../lib/format'
import TrackRow from './TrackRow'
import ImportButton from './ImportButton'

const SORT_KEY = 'melody:librarySort'
const SORTS = [
  { value: 'recent', label: 'Recent' },
  { value: 'plays', label: 'Most played' },
  { value: 'alpha', label: 'A–Z' },
]

// Reads must be try/catch-wrapped (private-mode Safari throws) and live in a
// pure lazy initializer so StrictMode's double render stays side-effect free.
function readSavedSort() {
  try {
    const v = localStorage.getItem(SORT_KEY)
    return v === 'plays' || v === 'alpha' ? v : 'recent'
  } catch {
    return 'recent'
  }
}

export default function LibraryView() {
  const tracks = useTracks()
  const { playQueue } = usePlayer()
  const [showStarred, setShowStarred] = useState(false)
  const [sort, setSort] = useState(readSavedSort)

  const pickSort = (value) => {
    setSort(value)
    try {
      localStorage.setItem(SORT_KEY, value)
    } catch {
      // Private-mode Safari: the choice still applies for this session.
    }
  }

  if (tracks === undefined) return <p className="dim">Loading…</p>

  const filtered = showStarred ? tracks.filter((t) => t.starred) : tracks
  // useTracks already returns dateAdded-desc, so 'recent' is the array as-is.
  // The others must copy first — live-query arrays must never be sorted in place.
  const shown =
    sort === 'plays'
      ? [...filtered].sort((a, b) => (b.playCount || 0) - (a.playCount || 0) || b.dateAdded - a.dateAdded)
      : sort === 'alpha'
        ? [...filtered].sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }))
        : filtered

  return (
    <section className="view">
      <div className="view__head">
        <div className="view__titlerow">
          <div>
            <p className="eyebrow">Your music</p>
            <h1>Library</h1>
            <p className="view__meta dim">{summarize(tracks)}</p>
          </div>
          <ImportButton />
        </div>
        <div className="segrow">
          <div className="segmented">
            <button className={!showStarred ? 'on' : ''} onClick={() => setShowStarred(false)}>All</button>
            <button className={showStarred ? 'on' : ''} onClick={() => setShowStarred(true)}>Favorites</button>
          </div>
          <div className="segmented">
            {SORTS.map(({ value, label }) => (
              <button key={value} className={sort === value ? 'on' : ''} onClick={() => pickSort(value)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {shown.length > 0 ? (
        <>
          <div className="row-actions">
            <button className="btn btn--accent playall" onClick={() => playQueue(shown, 0)}>
              <PlayGlyph /> Play
            </button>
            <button className="btn btn--ghost playall" onClick={() => playQueue(shuffle(shown), 0)}>
              <ShuffleGlyph /> Shuffle
            </button>
          </div>
          <div className="list">
            {shown.map((t) => (
              <TrackRow key={t.id} track={t} list={shown} />
            ))}
          </div>
        </>
      ) : showStarred ? (
        <p className="dim">No favorites yet — tap the star on any track.</p>
      ) : (
        <div className="emptystate">
          <NotesGlyph />
          <p className="dim">Nothing here yet. Import songs from the Files app to build your library.</p>
          <ImportButton />
        </div>
      )}
    </section>
  )
}

function PlayGlyph() {
  return <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
}
function ShuffleGlyph() {
  return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5M21 3l-7 7M4 20l16-16M16 21h5v-5M15 15l6 6M4 4l5 5" /></svg>
}
function NotesGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-faint)' }} aria-hidden="true">
      <path d="M9 18V6l10-2v12" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  )
}
