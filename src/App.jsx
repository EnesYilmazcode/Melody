import { useEffect, useState } from 'react'
import { PlayerProvider } from './state/PlayerProvider'
import { UIProvider, useUI } from './state/UIProvider'
import { useLongPress } from './lib/useLongPress'
import SearchView from './components/SearchView'
import LibraryView from './components/LibraryView'
import PlaylistsView from './components/PlaylistsView'
import Player from './components/Player'
import AddToPlaylistSheet from './components/AddToPlaylistSheet'

const TABS = [
  { id: 'search', label: 'Search', icon: SearchIcon },
  { id: 'library', label: 'Library', icon: LibraryIcon },
  { id: 'playlists', label: 'Playlists', icon: PlaylistIcon },
]

// Hidden build readout: invisible in normal use; long-press anywhere on the
// tab bar to peek at which deploy is running (commit + build time), so you can
// confirm the PWA auto-updated without a version string cluttering the UI.
// Auto-hides; tapping it dismisses it immediately.
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
// Same lifecycle as VersionPeek: auto-hides, tap dismisses. Keyed by toast id
// in ToastHost so a repeat of the same message restarts the timer.
function Toast({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])
  return (
    <button className="toast" role="status" onClick={onDismiss}>
      {message}
    </button>
  )
}

// Rendered inside the dock, above VersionPeek. Must stay conditional — a
// permanently-mounted element before the tabbar would break the
// .dock > .tabbar:first-child divider rule.
function ToastHost() {
  const { toast, clearToast } = useUI()
  return toast && <Toast key={toast.id} message={toast.message} onDismiss={clearToast} />
}

export default function App() {
  const [tab, setTab] = useState('library')
  const [showVersion, setShowVersion] = useState(false)
  const { handlers: versionPress, suppressClick } = useLongPress(() => setShowVersion(true))

  return (
    <UIProvider>
      <PlayerProvider>
        <div className="app">
          <main className="content">
            {tab === 'search' && <SearchView />}
            {tab === 'library' && <LibraryView />}
            {tab === 'playlists' && <PlaylistsView />}
          </main>

          {/* Floating dock: mini-player card stacked above the tab bar */}
          <div className="dock">
            {showVersion && <VersionPeek onDismiss={() => setShowVersion(false)} />}
            <ToastHost />
            <Player />
            {/* Long-press handlers live on the nav; suppressClick keeps the
                long-press from also switching tabs on release. */}
            <nav className="tabbar" {...versionPress}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`tab ${tab === id ? 'tab--active' : ''}`}
                onClick={() => {
                  if (suppressClick()) return
                  setTab(id)
                }}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
            </nav>
          </div>

          <AddToPlaylistSheet />
        </div>
      </PlayerProvider>
    </UIProvider>
  )
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
}
function LibraryIcon() {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V6l10-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></svg>
}
function PlaylistIcon() {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h13M3 12h9M3 18h9" /><path d="M16 13v6" /><circle cx="19" cy="19" r="2.5" /></svg>
}
