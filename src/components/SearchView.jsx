import { useState, useDeferredValue } from 'react'
import { useTracks, useSearch } from '../state/useLibrary'
import { parseYouTube, buildYtDlpCommand } from '../lib/youtube'
import TrackRow from './TrackRow'
import YouTubeLinkCard from './YouTubeLinkCard'

export default function SearchView() {
  const [query, setQuery] = useState('')
  const [autoCopied, setAutoCopied] = useState(false)
  const tracks = useTracks()
  // Defer the query fed to the (synchronous) fuzzy search so fast typing over a
  // large library doesn't drop input frames — React can skip intermediate list
  // renders and catch up when idle.
  const deferredQuery = useDeferredValue(query)
  const results = useSearch(tracks, deferredQuery)
  const q = query.trim() // immediate — drives the clear button
  const dq = deferredQuery.trim() // matches `results`, so the list/hint stay consistent
  const yt = parseYouTube(query) // non-null when a YouTube link is pasted

  // One tap: read the link from the clipboard AND copy the a-Shell command back,
  // so the user can switch straight to a-Shell and paste. (Same gesture, so the
  // clipboard write is allowed.)
  const handlePaste = async () => {
    let text = ''
    try {
      text = await navigator.clipboard.readText()
    } catch {
      return // clipboard read blocked — user can type instead
    }
    if (!text) return
    setQuery(text)
    const y = parseYouTube(text)
    if (y) {
      try {
        await navigator.clipboard.writeText(buildYtDlpCommand(y.url))
        setAutoCopied(true)
      } catch {
        setAutoCopied(false)
      }
    }
  }

  const onType = (e) => {
    setQuery(e.target.value)
    setAutoCopied(false)
  }

  return (
    <section className="view">
      <div className="view__head">
        <p className="eyebrow">Add music</p>
        <h1>Search</h1>
      </div>

      <div className="searchbar">
        <SearchIcon />
        <input
          className="searchbar__input"
          type="search"
          inputMode="search"
          placeholder="Paste a YouTube link, or search"
          value={query}
          onChange={onType}
          autoCapitalize="none"
          autoCorrect="off"
        />
        {q ? (
          <button className="searchbar__icon" onClick={() => { setQuery(''); setAutoCopied(false) }} aria-label="Clear">×</button>
        ) : (
          <button className="searchbar__icon" onClick={handlePaste} aria-label="Paste link"><PasteIcon /></button>
        )}
      </div>

      {yt ? (
        <YouTubeLinkCard yt={yt} copied={autoCopied} />
      ) : tracks === undefined ? (
        <p className="dim">Loading…</p>
      ) : dq && results.length > 0 ? (
        <div className="list">
          {results.map((t) => (
            <TrackRow key={t.id} track={t} list={results} />
          ))}
        </div>
      ) : (
        <p className="dim searchhint">
          {dq ? `Nothing matches “${dq}”.` : 'Tap the paste icon to drop in a YouTube link, or type to search your library.'}
        </p>
      )}
    </section>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
    </svg>
  )
}
function PasteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" />
    </svg>
  )
}
