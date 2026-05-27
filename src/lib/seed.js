import { db, upsertCatalog, deleteTrack } from './db'

// Dev fixtures: maps the generated WAV tones (scripts/make-samples.mjs) into
// catalog rows so we can build search + player without any phone downloads.
// `import.meta.env.BASE_URL` keeps the paths correct under the /melody/ subpath.
const base = import.meta.env.BASE_URL

const SAMPLE_TRACKS = [
  { id: 'sample-a', title: 'Morning Drift', artist: 'Test Tones', duration: 12, file: 'sample-a.wav' },
  { id: 'sample-b', title: 'Neon Platform', artist: 'Test Tones', duration: 14, file: 'sample-b.wav' },
  { id: 'sample-c', title: 'Express Track', artist: 'Subway Sessions', duration: 10, file: 'sample-c.wav' },
  { id: 'sample-d', title: 'Tunnel Hum', artist: 'Subway Sessions', duration: 16, file: 'sample-d.wav' },
  { id: 'sample-e', title: 'Last Stop', artist: 'Test Tones', duration: 11, file: 'sample-e.wav' },
].map((t) => ({
  id: t.id,
  title: t.title,
  artist: t.artist,
  duration: t.duration,
  thumbnailUrl: null, // no thumb for dev tones; UI falls back to a gradient tile
  filePath: `samples/${t.file}`,
  src: `${base}samples/${t.file}`,
  srcType: 'url',
}))

/** Seed sample tracks once, only if the library is empty (dev only). */
export async function seedIfEmpty() {
  const count = await db.tracks.count()
  if (count === 0) {
    await upsertCatalog(SAMPLE_TRACKS)
    console.info('[melody] seeded sample library')
  }
}

/** Remove the dev sample tracks from a real library (prod). */
export async function removeSamples() {
  const samples = await db.tracks.where('id').startsWith('sample-').toArray()
  for (const t of samples) await deleteTrack(t.id) // also clears playlist refs
}
