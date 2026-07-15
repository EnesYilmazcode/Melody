import Artwork from './Artwork'
import { formatTime } from '../lib/format'
import { toggleStar } from '../lib/db'
import { usePlayer } from '../state/PlayerProvider'
import { useUI } from '../state/UIProvider'

// A single tappable track. Tap the row → play (within `list` as the queue).
// Star button toggles favorite; the ⋯ button opens the add-to-playlist sheet.
export default function TrackRow({ track, list }) {
  const { current, isPlaying, playTrack } = usePlayer()
  const { openAddToPlaylist } = useUI()
  const isCurrent = current?.id === track.id

  return (
    <div className={`row ${isCurrent ? 'row--active' : ''}`}>
      <button className="row__main" onClick={() => playTrack(track, list)}>
        <Artwork track={track} />
        <span className="row__meta">
          <span className="row__title">{track.title}</span>
          <span className="row__artist">{track.artist}</span>
        </span>
        {isCurrent && isPlaying && <EqBars />}
      </button>

      <span className="row__dur">{formatTime(track.duration)}</span>

      <button
        className={`iconbtn ${track.starred ? 'iconbtn--star-on' : ''}`}
        onClick={() => toggleStar(track.id).catch(() => {})}
        aria-label={track.starred ? 'Unfavorite' : 'Favorite'}
      >
        <StarIcon filled={!!track.starred} />
      </button>

      <button className="iconbtn" onClick={() => openAddToPlaylist(track)} aria-label="Add to playlist">
        <DotsIcon />
      </button>
    </div>
  )
}

function EqBars() {
  return (
    <span className="eq" aria-hidden="true">
      <i /><i /><i />
    </span>
  )
}
function StarIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 3.5l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 20l1-6L3.3 9.9l6-.9z" />
    </svg>
  )
}
function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
    </svg>
  )
}
