// Dev-only: writes a few short WAV tones into public/samples so we have real,
// playable audio to build the player against on the laptop. WAV needs no
// encoder (we write the PCM bytes by hand), so this runs with zero extra deps.
// These are throwaway dev fixtures — real tracks come from the phone (Phase 6).
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../public/samples')
mkdirSync(outDir, { recursive: true })

const SAMPLE_RATE = 22050

function toneWav(freq, seconds) {
  const n = Math.floor(SAMPLE_RATE * seconds)
  const data = Buffer.alloc(n * 2) // 16-bit mono
  for (let i = 0; i < n; i++) {
    // gentle fade in/out so it doesn't click
    const fade = Math.min(1, i / 2000, (n - i) / 2000)
    const v = Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE) * 0.3 * fade
    data.writeInt16LE((v * 32767) | 0, i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(SAMPLE_RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

const samples = [
  { file: 'sample-a.wav', freq: 261.63, sec: 12 },
  { file: 'sample-b.wav', freq: 329.63, sec: 14 },
  { file: 'sample-c.wav', freq: 392.0, sec: 10 },
  { file: 'sample-d.wav', freq: 440.0, sec: 16 },
  { file: 'sample-e.wav', freq: 523.25, sec: 11 },
]

for (const s of samples) {
  writeFileSync(resolve(outDir, s.file), toneWav(s.freq, s.sec))
  console.log('wrote', s.file)
}
console.log('Done. Sample tones in public/samples/')
