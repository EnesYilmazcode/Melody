import { useState, useEffect } from 'react'
import { usePodcasts, useEpisodes, useInProgress } from '../state/useLibrary'
import { usePlayer } from '../state/PlayerProvider'
import { unsubscribePodcast, removeEpisodeAudio, setPlayed } from '../lib/db'
import { searchPodcasts, subscribe, refreshStale, toPlayable, downloadEpisode, useDownloads } from '../lib/podcasts'
import { formatTime, timeLeft } from '../lib/format'
import { useDialog } from '../lib/useDialog'
import Artwork from './Artwork'
import PromptModal from './PromptModal'
import ConfirmModal from './ConfirmModal'

export default function PodcastsView() {
  const shows = usePodcasts()
  const [openId, setOpenId] = useState(null)
  const [adding, setAdding] = useState(false)

  // Pick up new episodes when the tab opens (feeds older than an hour).
  useEffect(() => {
    refreshStale()
  }, [])

  const open = shows?.find((s) => s.id === openId)

  return (
    <section className="view">
      {shows === undefined ? (
        <p className="dim">Loading…</p>
      ) : adding ? (
        <AddPodcast subscribed={shows} onBack={() => setAdding(false)} onOpen={(id) => { setAdding(false); setOpenId(id) }} />
      ) : open ? (
        <ShowDetail show={open} onBack={() => setOpenId(null)} />
      ) : (
        <>
          <header className="phead">
            <h1>Podcasts</h1>
            <button className="btn btn--accent" onClick={() => setAdding(true)}>+ Add</button>
          </header>
          <ContinueListening shows={shows} />
          {shows.length === 0 ? (
            <p className="dim">No shows yet. Tap + Add to search for a podcast or paste its RSS link.</p>
          ) : (
            <div className="list">
              {shows.map((s) => (
                <button key={s.id} className="showrow" onClick={() => setOpenId(s.id)}>
                  <Artwork track={{ id: s.id, thumbnailUrl: s.image }} size={56} radius={10} />
                  <span className="row__meta">
                    <span className="row__title">{s.title}</span>
                    <span className="row__artist">{s.author}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function ContinueListening({ shows }) {
  const eps = useInProgress()
  if (!eps?.length) return null
  const byId = new Map(shows.map((s) => [s.id, s]))
  return (
    <>
      <p className="sheet__label">Continue listening</p>
      <div className="list continue">
        {eps.map((ep) => <EpisodeRow key={ep.id} ep={ep} show={byId.get(ep.podcastId)} showName />)}
      </div>
    </>
  )
}

function AddPodcast({ subscribed, onBack, onOpen }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [status, setStatus] = useState('') // search / subscribe errors
  const [busy, setBusy] = useState(null) // feed id being subscribed
  const [pasting, setPasting] = useState(false)
  const have = new Set(subscribed.map((s) => s.id))

  // Search as you type, debounced so each keystroke isn't a request.
  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults(null); setStatus(''); return }
    let stale = false
    const t = setTimeout(() => {
      searchPodcasts(q)
        .then((r) => { if (!stale) { setResults(r); setStatus('') } })
        .catch(() => { if (!stale) setStatus('Search needs a connection. Try again when you are online.') })
    }, 400)
    return () => { stale = true; clearTimeout(t) }
  }, [query])

  const add = async (feedUrl) => {
    setBusy(feedUrl)
    setStatus('')
    try {
      const show = await subscribe(feedUrl)
      onOpen(show.id)
    } catch {
      setStatus("Couldn't read that feed. Check the link, or try again online.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <header className="phead">
        <button className="iconbtn phead__back" onClick={onBack} aria-label="Back"><ChevronLeft /></button>
        <h1>Add a show</h1>
      </header>
      <div className="searchbar">
        <input
          className="searchbar__input"
          type="search"
          inputMode="search"
          placeholder="Search podcasts"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          autoFocus
        />
      </div>
      <button className="btn btn--ghost rsslink" onClick={() => setPasting(true)}>Paste an RSS link instead</button>
      {status && <p className="now__missing" role="status">{status}</p>}
      {results && results.length === 0 && <p className="dim searchhint">No shows match “{query.trim()}”.</p>}
      {results && (
        <div className="list">
          {results.map((r) => (
            <div key={r.id} className="row">
              <span className="row__main row__main--static">
                <Artwork track={{ id: r.id, thumbnailUrl: r.image }} size={48} />
                <span className="row__meta">
                  <span className="row__title">{r.title}</span>
                  <span className="row__artist">{r.author}</span>
                </span>
              </span>
              {have.has(r.id) ? (
                <button className="btn btn--ghost subbtn" onClick={() => onOpen(r.id)}>Open</button>
              ) : (
                <button className="btn btn--accent subbtn" onClick={() => add(r.id)} disabled={busy != null}>
                  {busy === r.id ? '…' : 'Follow'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {pasting && (
        <PromptModal
          title="Podcast RSS link"
          placeholder="https://…"
          confirmLabel="Follow"
          maxLength={2000}
          inputMode="url"
          autoCapitalize="none"
          onClose={() => setPasting(false)}
          onSubmit={(url) => { setPasting(false); add(url) }}
        />
      )}
    </>
  )
}

function ShowDetail({ show, onBack }) {
  const eps = useEpisodes(show.id)
  const [confirm, setConfirm] = useState(false)

  return (
    <>
      <header className="phead">
        <button className="iconbtn phead__back" onClick={onBack} aria-label="Back"><ChevronLeft /></button>
        <h1>{show.title}</h1>
      </header>
      <div className="showhead">
        <Artwork track={{ id: show.id, thumbnailUrl: show.image }} size={96} radius={14} />
        <div className="showhead__meta">
          <p className="dim">{show.author}</p>
          <button className="btn btn--ghost" onClick={() => setConfirm(true)}>Unfollow</button>
        </div>
      </div>
      {eps === undefined ? (
        <p className="dim">Loading…</p>
      ) : eps.length === 0 ? (
        <p className="dim">This feed has no playable episodes.</p>
      ) : (
        <div className="list">
          {eps.map((ep) => <EpisodeRow key={ep.id} ep={ep} show={show} />)}
        </div>
      )}
      {confirm && (
        <ConfirmModal
          title="Unfollow?"
          message={`“${show.title}” and its downloaded episodes will be removed from this phone.`}
          confirmLabel="Unfollow"
          onClose={() => setConfirm(false)}
          onConfirm={async () => { await unsubscribePodcast(show.id); setConfirm(false); onBack() }}
        />
      )}
    </>
  )
}

function EpisodeRow({ ep, show, showName = false }) {
  const { current, isPlaying, playTrack } = usePlayer()
  const downloads = useDownloads()
  const [menu, setMenu] = useState(false)
  const [error, setError] = useState('')
  const isCurrent = current?.id === ep.id
  const dl = downloads[ep.id]
  const pct = ep.duration && ep.position ? Math.min(100, (ep.position / ep.duration) * 100) : 0

  const meta = [
    showName ? show?.title : ep.pubDate ? new Date(ep.pubDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null,
    ep.played ? 'Played' : ep.position > 0 && ep.duration ? timeLeft(ep.duration, ep.position) : ep.duration ? formatTime(ep.duration) : null,
    ep.downloaded ? 'Downloaded' : null,
  ].filter(Boolean).join(' · ')

  const download = () => {
    setError('')
    downloadEpisode(ep).catch(() => setError("This show doesn't allow downloads here. It will still stream."))
  }

  return (
    <div className={`row eprow ${isCurrent ? 'row--active' : ''} ${ep.played ? 'eprow--played' : ''}`}>
      <button className="row__main" onClick={() => playTrack(toPlayable(ep, show))}>
        <span className="row__meta">
          <span className="row__title eprow__title">{ep.title}</span>
          <span className="row__artist">{error || meta}</span>
          {pct > 0 && !ep.played && <span className="eprow__bar"><i style={{ width: `${pct}%` }} /></span>}
        </span>
        {isCurrent && isPlaying && <span className="eq" aria-hidden="true"><i /><i /><i /></span>}
      </button>
      {dl !== undefined ? (
        <span className="eprow__dl" aria-label="Downloading">{dl < 0 ? '…' : `${Math.round(dl * 100)}%`}</span>
      ) : !ep.downloaded ? (
        <button className="iconbtn" onClick={download} aria-label="Download"><DownloadIcon /></button>
      ) : null}
      <button className="iconbtn" onClick={() => setMenu(true)} aria-label="Episode options"><Dots /></button>
      {menu && (
        <EpisodeSheet
          ep={ep}
          onClose={() => setMenu(false)}
          onDownload={() => { setMenu(false); download() }}
        />
      )}
    </div>
  )
}

function EpisodeSheet({ ep, onClose, onDownload }) {
  const dialog = useDialog(onClose)
  const act = (fn) => async () => { await fn().catch(() => {}); onClose() }
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" ref={dialog.ref} onKeyDown={dialog.onKeyDown} role="dialog" aria-modal="true" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grip" />
        <p className="sheet__title">{ep.title}</p>
        {ep.summary && <p className="dim episheet__summary">{ep.summary}</p>}
        <button className="sheet__item" onClick={act(() => setPlayed({ ...ep, kind: 'episode' }, !ep.played))}>
          {ep.played ? 'Mark as unplayed' : 'Mark as played'}
        </button>
        {ep.downloaded ? (
          <button className="sheet__item sheet__item--danger" onClick={act(() => removeEpisodeAudio(ep.id))}>Remove download</button>
        ) : (
          <button className="sheet__item" onClick={onDownload}>Download for offline</button>
        )}
        <button className="btn btn--ghost sheet__cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

function ChevronLeft() { return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg> }
function Dots() { return <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg> }
function DownloadIcon() { return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg> }
