import { createContext, useContext, useState, useCallback } from 'react'

// Tiny global UI state so any TrackRow can open the "Add to playlist" sheet
// without prop-drilling. The sheet itself is rendered once at the app root.
const UIContext = createContext(null)
export const useUI = () => useContext(UIContext)

export function UIProvider({ children }) {
  const [addTarget, setAddTarget] = useState(null) // track being added, or null

  const openAddToPlaylist = useCallback((track) => setAddTarget(track), [])
  const closeAddToPlaylist = useCallback(() => setAddTarget(null), [])

  return (
    <UIContext.Provider value={{ addTarget, openAddToPlaylist, closeAddToPlaylist }}>
      {children}
    </UIContext.Provider>
  )
}
