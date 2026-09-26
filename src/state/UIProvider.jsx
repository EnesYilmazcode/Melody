import { createContext, useContext, useState, useCallback } from 'react'

// Tiny global UI state so any TrackRow can open the "Add to playlist" sheet
// without prop-drilling. The sheet itself is rendered once at the app root.
// The toast follows the same pattern: any component can announce a result and
// App renders the single toast host inside the dock.
const UIContext = createContext(null)
export const useUI = () => useContext(UIContext)

export function UIProvider({ children }) {
  const [addTarget, setAddTarget] = useState(null) // track being added, or null
  const [toast, setToast] = useState(null) // { id, message } or null

  const openAddToPlaylist = useCallback((track) => setAddTarget(track), [])
  const closeAddToPlaylist = useCallback(() => setAddTarget(null), [])

  // id changes per call so App can key the Toast — remounting restarts the
  // auto-dismiss timer even when the same message fires twice in a row.
  const showToast = useCallback((message) => setToast({ id: Date.now(), message }), [])
  const clearToast = useCallback(() => setToast(null), [])

  return (
    <UIContext.Provider value={{ addTarget, openAddToPlaylist, closeAddToPlaylist, toast, showToast, clearToast }}>
      {children}
    </UIContext.Provider>
  )
}
