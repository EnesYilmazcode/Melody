import { useState } from 'react'
import { PlayerProvider } from './state/PlayerProvider'
import { UIProvider } from './state/UIProvider'
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

export default function App() {
  const [tab, setTab] = useState('library')

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
            <Player />
            <nav className="tabbar">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`tab ${tab === id ? 'tab--active' : ''}`}
                onClick={() => setTab(id)}
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
