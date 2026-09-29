import { useRef } from 'react'
import { exportBackup, importBackup } from './db'
import { useUI } from '../state/UIProvider'

// Export / restore the library as JSON. Returns the hidden restore <input> to
// render (it must stay mounted while the picker is up) plus the two actions.
export function useBackup() {
  const { showToast } = useUI()
  const restoreRef = useRef(null)

  const exportFile = async () => {
    try {
      const data = await exportBackup()
      const name = `melody-backup-${new Date().toISOString().slice(0, 10)}.json`
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      // On iPhone the share sheet is the reliable way out ("Save to Files");
      // a home-screen app can't follow a download link.
      const file = new File([blob], name, { type: 'application/json' })
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] })
        } catch (err) {
          if (err?.name !== 'AbortError') throw err
        }
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      // Revoke once the download has had a moment to start: leaked object
      // URLs pin their Blobs in memory for the app's whole lifetime.
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch {
      showToast("Couldn't export the backup.")
    }
  }

  const onRestore = async (e) => {
    const file = e.target.files[0]
    e.target.value = '' // reset so the same file can be re-picked later
    if (!file) return
    try {
      // Parse here, outside importBackup's Dexie transaction: awaiting
      // file.text() inside the transaction zone would kill it.
      const parsed = JSON.parse(await file.text())
      const { tracks, playlists, podcasts } = await importBackup(parsed)
      showToast(`${tracks} songs · ${playlists} playlists${podcasts ? ` · ${podcasts} shows` : ''} restored`)
    } catch {
      showToast("Couldn't read that backup file.")
    }
  }

  const input = <input ref={restoreRef} type="file" accept=".json,application/json" hidden onChange={onRestore} />
  return { input, exportFile, restore: () => restoreRef.current?.click() }
}
