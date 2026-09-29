import { createContext, useContext, useState, useCallback } from 'react'

// Tiny global UI state so any row can open the track sheet without
// prop-drilling. The sheet itself is rendered once at the app root. The toast
// follows the same pattern, and navigation lives here so Now Playing's
// "Go to <playlist>" can switch tabs and open a playlist.
const UIContext = createContext(null)
export const useUI = () => useContext(UIContext)

export function UIProvider({ children }) {
  const [addTarget, setAddTarget] = useState(null) // track in the sheet, or null
  const [toast, setToast] = useState(null) // { id, message } or null
  const [tab, setTab] = useState('library')
  const [playlistId, setPlaylistId] = useState(null) // open playlist detail

  // fromPlaylist: the playlist the row belongs to, so the sheet can offer removal.
  const [fromPlaylist, setFromPlaylist] = useState(null)
  const openAddToPlaylist = useCallback((track, playlist = null) => {
    setAddTarget(track)
    setFromPlaylist(playlist)
  }, [])
  const closeAddToPlaylist = useCallback(() => setAddTarget(null), [])

  // id changes per call so App can key the Toast: remounting restarts the
  // auto-dismiss timer even when the same message fires twice in a row.
  const showToast = useCallback((message) => setToast({ id: Date.now(), message }), [])
  const clearToast = useCallback(() => setToast(null), [])

  const goToPlaylist = useCallback((id) => {
    setTab('playlists')
    setPlaylistId(id)
  }, [])

  return (
    <UIContext.Provider
      value={{
        addTarget, fromPlaylist, openAddToPlaylist, closeAddToPlaylist, toast, showToast, clearToast,
        tab, setTab, playlistId, setPlaylistId, goToPlaylist,
      }}
    >
      {children}
    </UIContext.Provider>
  )
}
