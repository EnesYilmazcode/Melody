import { useState, useDeferredValue } from 'react'
import { useTracks, useSearch } from '../state/useLibrary'
import { parseYouTube, buildYtDlpCommand } from '../lib/youtube'
import TrackRow from './TrackRow'
import YouTubeLinkCard from './YouTubeLinkCard'
import Icon from './Icon'

export default function SearchView({ query, setQuery }) {
  const [autoCopied, setAutoCopied] = useState(false)
  const tracks = useTracks()
  // Defer the query fed to the (synchronous) fuzzy search so fast typing over a
  // large library doesn't drop input frames.
  const deferredQuery = useDeferredValue(query)
  const results = useSearch(tracks, deferredQuery)
  const q = query.trim() // immediate: drives the clear button
  const dq = deferredQuery.trim() // matches `results`, so the list stays consistent
  const yt = parseYouTube(query) // non-null when a YouTube link is pasted

  // One tap: read the link from the clipboard AND copy the a-Shell command back,
  // so the user can switch straight to a-Shell and paste. (Same gesture, so the
  // clipboard write is allowed.)
  const handlePaste = async () => {
    let text = ''
    try {
      text = await navigator.clipboard.readText()
    } catch {
      return // clipboard read blocked: the user can type instead
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
      <div className="searchbar" style={{ marginTop: 14 }}>
        <Icon name="search" size={18} />
        <input
          className="searchbar__input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          placeholder="Songs or a YouTube link"
          aria-label="Search"
          value={query}
          onChange={onType}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        {q && (
          <button className="searchbar__icon" onClick={() => { setQuery(''); setAutoCopied(false) }} aria-label="Clear"><Icon name="xfill" size={18} /></button>
        )}
      </div>

      {yt ? (
        <YouTubeLinkCard yt={yt} copied={autoCopied} />
      ) : tracks === undefined ? null : dq && results.length > 0 ? (
        <div className="list">
          {results.map((t) => (
            <TrackRow key={t.id} track={t} list={results} playOpts={{ source: { name: 'Search' } }} />
          ))}
        </div>
      ) : dq ? (
        <div className="noresults">
          <Icon name="search" size={44} />
          <h2>No results</h2>
          <p>Check the spelling, or paste a YouTube link.</p>
        </div>
      ) : (
        <>
          <div className="list">
            <button className="row pasterow" onClick={handlePaste} aria-label="Paste link">
              <span className="row__art"><Icon name="paste" size={22} /></span>
              <span className="row__text"><span className="row__title">Paste a YouTube link</span></span>
            </button>
          </div>
          <p className="searchnote">Or type to find a song in your library.</p>
        </>
      )}
    </section>
  )
}
