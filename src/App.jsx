import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PlayerProvider } from './state/PlayerProvider'
import { UIProvider, useUI } from './state/UIProvider'
import { useLongPress } from './lib/useLongPress'
import SearchView from './components/SearchView'
import LibraryView from './components/LibraryView'
import PlaylistsView from './components/PlaylistsView'
import Player from './components/Player'
import AddToPlaylistSheet from './components/AddToPlaylistSheet'
import Icon from './components/Icon'

// Podcasts stay in the codebase (and in backups) but are off the tab bar.
const TABS = [
  { id: 'library', label: 'Library', icon: 'tab_library' },
  { id: 'search', label: 'Search', icon: 'tab_search' },
  { id: 'playlists', label: 'Playlists', icon: 'tab_playlists' },
]

// Hidden build readout: long-press the tab bar to see which deploy is running
// (commit + build time), to confirm the PWA auto-updated. Tap dismisses.
function VersionPeek({ onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [onDismiss])
  const { commit, builtAt } = __BUILD_INFO__
  const built = new Date(builtAt)
  return (
    <button className="versionpeek" onClick={onDismiss}>
      build {commit} · {built.toLocaleDateString()} {built.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
    </button>
  )
}

// Transient status pill above the dock (import summaries, restore results).
function Toast({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [onDismiss])
  return (
    <button className="toast" role="status" onClick={onDismiss}>
      {message}
    </button>
  )
}

function ToastHost() {
  const { toast, clearToast } = useUI()
  return toast && <Toast key={toast.id} message={toast.message} onDismiss={clearToast} />
}

function Shell() {
  const { tab, setTab, playlistId, setPlaylistId } = useUI()
  const [query, setQuery] = useState('') // kept across tab switches
  const [showVersion, setShowVersion] = useState(false)
  const { handlers: versionPress, suppressClick } = useLongPress(() => setShowVersion(true))
  const appRef = useRef(null)
  const dockRef = useRef(null)
  const scrollRef = useRef(null)
  const scrollTops = useRef({})

  // Content scrolls under the translucent dock; pad it by the dock's height.
  useLayoutEffect(() => {
    const dock = dockRef.current
    const set = () => appRef.current?.style.setProperty('--dock-h', `${dock.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(dock)
    return () => ro.disconnect()
  }, [])

  // Each tab comes back where you left it.
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollTops.current[tab] || 0
  }, [tab])

  const pick = (id) => {
    if (suppressClick()) return
    const el = scrollRef.current
    if (id === tab) {
      // iOS convention: re-tapping the active tab pops to its root, then to the top.
      if (id === 'playlists' && playlistId != null) setPlaylistId(null)
      else el?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (el) scrollTops.current[tab] = el.scrollTop
    setTab(id)
  }

  return (
    <div className="app" ref={appRef}>
      <main className="content" ref={scrollRef}>
        {tab === 'library' && <LibraryView />}
        {tab === 'search' && <SearchView query={query} setQuery={setQuery} />}
        {tab === 'playlists' && <PlaylistsView scrollRef={scrollRef} />}
      </main>

      <div className="dock" ref={dockRef}>
        {showVersion && <VersionPeek onDismiss={() => setShowVersion(false)} />}
        <ToastHost />
        <Player />
        {/* Long-press handlers live on the nav; suppressClick keeps the
            long-press from also switching tabs on release. */}
        <nav className="tabs" {...versionPress}>
          {TABS.map(({ id, label, icon }) => (
            <button key={id} className={`tab ${tab === id ? 'tab--on' : ''}`} onClick={() => pick(id)} aria-current={tab === id ? 'page' : undefined}>
              <Icon name={icon} size={26} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      <AddToPlaylistSheet />
    </div>
  )
}

export default function App() {
  return (
    <UIProvider>
      <PlayerProvider>
        <Shell />
      </PlayerProvider>
    </UIProvider>
  )
}
