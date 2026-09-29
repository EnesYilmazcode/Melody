import Artwork from './Artwork'
import Icon from './Icon'
import { formatTime } from '../lib/format'
import { displayTitle } from '../lib/series'
import { useLongPress } from '../lib/useLongPress'
import { usePlayer } from '../state/PlayerProvider'
import { useUI } from '../state/UIProvider'

// A single track: tap plays it (within `list` as the queue), press and hold
// opens the track sheet (playlists, favorite, delete). Title only; the
// trailing edge carries a favorite star and the duration, or the eq bars on
// the playing row.
export default function TrackRow({ track, list, playOpts, playlist, sub }) {
  const { current, isPlaying, playTrack } = usePlayer()
  const { openAddToPlaylist } = useUI()
  const lp = useLongPress(() => openAddToPlaylist(track, playlist))
  const isCurrent = current?.id === track.id

  return (
    <button
      className={`row row__main ${isCurrent ? 'row--playing' : ''}`}
      {...lp.handlers}
      onClick={() => {
        if (!lp.suppressClick()) playTrack(track, list, playOpts)
      }}
    >
      <Artwork track={track} />
      <span className="row__text">
        <span className="row__title">{displayTitle(track)}</span>
        {sub && <span className="row__sub">{sub}</span>}
      </span>
      <span className="row__end">
        {isCurrent ? (
          <EqBars paused={!isPlaying} />
        ) : (
          <>
            {!!track.starred && <Icon name="star" size={12} className="star" />}
            <span className="num">{formatTime(track.duration)}</span>
          </>
        )}
      </span>
    </button>
  )
}

export function EqBars({ paused }) {
  return (
    <span className={`eq ${paused ? 'eq--paused' : ''}`} aria-label={paused ? 'Paused' : 'Now playing'}>
      <i /><i /><i /><i />
    </span>
  )
}
