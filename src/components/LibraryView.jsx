import { useState } from 'react'
import { useTracks } from '../state/useLibrary'
import { usePlayer } from '../state/PlayerProvider'
import TrackRow from './TrackRow'
import ImportButton from './ImportButton'

export default function LibraryView() {
  const tracks = useTracks()
  const { playQueue } = usePlayer()
  const [showStarred, setShowStarred] = useState(false)

  if (tracks === undefined) return <p className="dim">Loading…</p>

  const shown = showStarred ? tracks.filter((t) => t.starred) : tracks

  return (
    <section className="view">
      <div className="view__head">
        <div className="view__titlerow">
          <div>
            <p className="eyebrow">Your music</p>
            <h1>Library</h1>
          </div>
          <ImportButton />
        </div>
        <div className="segmented">
          <button className={!showStarred ? 'on' : ''} onClick={() => setShowStarred(false)}>All</button>
          <button className={showStarred ? 'on' : ''} onClick={() => setShowStarred(true)}>Favorites</button>
        </div>
      </div>

      {shown.length > 0 ? (
        <>
          <div className="row-actions">
            <button className="btn btn--accent playall" onClick={() => playQueue(shown, 0)}>
              <PlayGlyph /> Play
            </button>
            <button className="btn btn--ghost playall" onClick={() => playQueue([...shown].sort(() => Math.random() - 0.5), 0)}>
              <ShuffleGlyph /> Shuffle
            </button>
          </div>
          <div className="list">
            {shown.map((t) => (
              <TrackRow key={t.id} track={t} list={shown} />
            ))}
          </div>
        </>
      ) : (
        <p className="dim">{showStarred ? 'No favorites yet — tap the star on any track.' : 'Your library is empty.'}</p>
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
