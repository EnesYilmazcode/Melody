import Sheet from './Sheet'
import Icon from './Icon'

// Sheet for a single playlist, opened by holding a playlist row or tapping ⋯
// inside a playlist. Offers Rename and Delete.
export default function PlaylistActionsSheet({ playlist, count, onRename, onDelete, onClose }) {
  return (
    <Sheet onClose={onClose} label={playlist.name}>
      {(close) => (
        <>
          <div className="sheet__grp">
            <div className="sheet__head">
              <span className="sheet__headtitle">
                {playlist.name}
                <span className="sheet__headsub">{count} {count === 1 ? 'song' : 'songs'}</span>
              </span>
            </div>
            <button className="sheet__row" onClick={() => { onRename(); close() }}>
              <span>Rename</span><Icon name="pencil" size={20} />
            </button>
            <button className="sheet__row sheet__row--danger" onClick={() => { onDelete(); close() }}>
              <span>Delete playlist</span><Icon name="trash" size={20} />
            </button>
          </div>
          <div className="sheet__grp">
            <button className="sheet__row sheet__row--c" onClick={() => close()}>Cancel</button>
          </div>
        </>
      )}
    </Sheet>
  )
}
