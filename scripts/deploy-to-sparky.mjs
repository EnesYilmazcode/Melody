// Copies the production build into the Sparky Firebase project so Melody is
// served at sparkylab.web.app/melody/. Sparky's firebase.json uses
// "public": ".", so anything in <sparky>/melody/ is hosted under /melody/.
//
// Run `npm run deploy:sparky` (builds + copies), then from the sparky folder:
//   firebase deploy --only hosting
import { rmSync, cpSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dist = resolve(here, '../dist')
const target = resolve(here, '../../sparky/melody')

if (!existsSync(dist)) {
  console.error('No dist/ — run `npm run build` first.')
  process.exit(1)
}
if (!existsSync(resolve(here, '../../sparky/firebase.json'))) {
  console.error('Could not find ../../sparky/firebase.json — is the Sparky repo a sibling of melody/?')
  process.exit(1)
}

rmSync(target, { recursive: true, force: true }) // clear stale build
cpSync(dist, target, { recursive: true })
console.log(`Copied build → ${target}`)
console.log('Next: cd ../sparky && firebase deploy --only hosting')
