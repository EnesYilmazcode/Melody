import { useState } from 'react'
import { useTracks } from '../state/useLibrary'
import { useImporter } from '../lib/useImporter'
import { useBackup } from '../lib/useBackup'
import TrackRow from './TrackRow'
import Sheet from './Sheet'
import Icon from './Icon'

const SORT_KEY = 'melody:librarySort'
const FAV_KEY = 'melody:libraryFavorites'
const SORTS = [
  { value: 'recent', label: 'Recently added' },
  { value: 'plays', label: 'Most played' },
  { value: 'alpha', label: 'Title' },
]

// Reads must be try/catch-wrapped (private-mode Safari throws) and live in a
// pure lazy initializer so StrictMode's double render stays side-effect free.
function readSaved(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private-mode Safari: the choice still applies for this session.
  }
}

export default function LibraryView() {
  const tracks = useTracks()
  const importer = useImporter()
  const backup = useBackup()
  const [menu, setMenu] = useState(false)
  const [sort, setSort] = useState(() => {
    const v = readSaved(SORT_KEY, 'recent')
    return SORTS.some((o) => o.value === v) ? v : 'recent'
  })
  const [favOnly, setFavOnly] = useState(() => readSaved(FAV_KEY, '0') === '1')

  const pickSort = (value) => { setSort(value); save(SORT_KEY, value) }
  const toggleFav = () => { setFavOnly((f) => { save(FAV_KEY, f ? '0' : '1'); return !f }) }

  const filtered = tracks && (favOnly ? tracks.filter((t) => t.starred) : tracks)
  // useTracks already returns dateAdded-desc, so 'recent' is the array as-is.
  // The others must copy first: live-query arrays must never be sorted in place.
  const shown = !filtered
    ? []
    : sort === 'plays'
      ? [...filtered].sort((a, b) => (b.playCount || 0) - (a.playCount || 0) || b.dateAdded - a.dateAdded)
      : sort === 'alpha'
        ? [...filtered].sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base', numeric: true }))
        : filtered
  const source = { name: favOnly ? 'Favorites' : 'Library' }

  return (
    <section className="view">
      <div className="topbar">
        <button className="iconbtn" onClick={() => setMenu(true)} aria-label="Library options">
          <Icon name="more" size={22} />
        </button>
      </div>
      {importer.progress && (
        <p className="importing" role="status">
          Importing <span className="num">{Math.min(importer.progress.done + 1, importer.progress.total)}</span> of <span className="num">{importer.progress.total}</span>
          <span className="importing__bar"><i style={{ transform: `scaleX(${importer.progress.done / importer.progress.total})` }} /></span>
        </p>
      )}

      {tracks === undefined ? null : shown.length > 0 ? (
        <div className="list">
          {shown.map((t) => (
            <TrackRow key={t.id} track={t} list={shown} playOpts={{ source }} />
          ))}
        </div>
      ) : favOnly && tracks.length > 0 ? (
        <div className="emptystate">
          <Icon name="starline" size={44} />
          <h2>No favorites yet</h2>
          <p>Tap the star in Now Playing to keep a song here.</p>
          <button className="btn btn--ghost" onClick={toggleFav}>Show all songs</button>
        </div>
      ) : (
        <div className="emptystate">
          <Icon name="note" size={44} />
          <h2>Your library is empty</h2>
          <p>Download songs in a-Shell, then import them from the Files app.</p>
          <button className="btn btn--accent" onClick={importer.open}>Import from Files</button>
        </div>
      )}

      {importer.input}
      {backup.input}

      {menu && (
        // Pickers and the share sheet need the tap's user activation, so each
        // action runs first and the sheet animates away after.
        <Sheet onClose={() => setMenu(false)} label="Library options">
          {(close) => (
            <>
              <div className="sheet__grp">
                <button className="sheet__row" onClick={() => { importer.open(); close() }}>
                  <span>Import from Files</span><Icon name="import" size={20} />
                </button>
                <button className="sheet__row" onClick={() => { backup.exportFile(); close() }}>
                  <span>Export backup</span><Icon name="export" size={20} />
                </button>
                <button className="sheet__row" onClick={() => { backup.restore(); close() }}>
                  <span>Restore backup</span><Icon name="restore" size={20} />
                </button>
              </div>
              <div className="sheet__grp">
                {SORTS.map((o) => (
                  <button key={o.value} className="sheet__row" onClick={() => pickSort(o.value)} aria-pressed={sort === o.value}>
                    <span>{o.label}</span>
                    {sort === o.value && <Icon name="check" size={20} className="check" />}
                  </button>
                ))}
                <button className="sheet__row" onClick={toggleFav} aria-pressed={favOnly}>
                  <span>Favorites only</span>
                  {favOnly && <Icon name="check" size={20} className="check" />}
                </button>
              </div>
              <div className="sheet__grp">
                <button className="sheet__row sheet__row--c" onClick={() => close()}>Cancel</button>
              </div>
            </>
          )}
        </Sheet>
      )}
    </section>
  )
}
