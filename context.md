# PROJECT BRIEF: "Local YouTube Audio Player" (personal iPhone music app)

> Paste this whole file into Claude Code (or a new chat) as the starting context.
> It contains the goal, the locked-in architecture, decisions already made, the iOS
> constraints that shape every design choice, the build order, and open questions
> to confirm with me before writing code.

---

## 0. Who I am / how I work (so you calibrate)

- I'm Enes, CS & Engineering junior at Ohio State, strong with React, Python, FastAPI, JS/TS.
- I learn best from concrete, copy-paste-ready code WITH explanations of *why* (architecture, tradeoffs), not just *how*.
- No fluff. Practical, implementation-focused. Fast-paced and structured.
- I've shipped React + Firebase projects before (a 3D circuit designer called Sparky, a text-to-3D engine called Kinetik), so assume working knowledge of React, hooks, Vite, GitHub, deploying static sites.
- Dev environment: **Windows laptop + VS Code + Node.js**. Target device: **my own iPhone**.
- I have Claude Max, so we can do long multi-file build sessions.

---

## 1. What I'm building (the vision in my words)

A personal, mostly-on-my-phone music app for YouTube audio. The core loop:

1. I open the app and **search a video/song title**.
2. It does **real-time fuzzy search over my already-downloaded local library** as I type.
3. **If it's not in my library**, I tap a button to **search YouTube**, and it shows me
   results (with thumbnails + titles).
4. I **tap a result**, it **downloads the audio to my phone**, and I can listen.
5. I want to **loop** tracks, **make playlists**, **star/favorite** things, and have all
   of that **saved on my phone**.

Think: a makeshift, personal Spotify but the source is regular YouTube videos, audio-only,
stored locally, free, no App Store publishing.

NOTE: I understand the YouTube ToS implications and am taking full responsibility/caution.
Do NOT spend output re-explaining ToS. I've got it. Focus on building.

---

## 2. Architecture (LOCKED IN: don't re-litigate unless something's technically wrong)

The hard iOS reality that forces this design:
- A web page / PWA **cannot run yt-dlp** and **cannot fetch YouTube's signed media URLs**
  directly (CORS + signing). So the *download step* must run in a real Python environment.
- On iPhone with no separate server, that environment is **a-Shell** (free terminal app
  that runs Python + yt-dlp fully on-device).
- Safari PWAs are **sandboxed**: they can't freely read the Files-app folder where a-Shell
  saves audio. So we split storage: lightweight catalog/metadata lives in the PWA; the
  actual audio files live in the a-Shell/Files folder and get loaded on play.

Resulting stack:

```
┌─────────────────────────────────────────────────────────────┐
│ PWA  (Safari "Add to Home Screen" → real app icon, fullscreen) │
│  • Fuzzy search over local catalog (instant, as-you-type)      │
│  • "Not found → Search YouTube" → results list with thumbnails │
│  • Player: play/pause, LOOP, scrub                              │
│  • Playlists, star/favorite, library view                      │
│  • Media Session API → lock-screen controls + background audio │
│  • Stores catalog + playlists + stars locally (IndexedDB)       │
└───────────────┬─────────────────────────────────────────────┘
                │ tap a YouTube result → hand URL/ID to a Shortcut
                ▼
┌─────────────────────────────────────────────────────────────┐
│ iOS SHORTCUT  (the glue / "download button")                   │
│  • Receives video URL + ID, opens a-Shell, runs download cmd    │
└───────────────┬─────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────┐
│ a-SHELL + yt-dlp  (the download engine, on-device Python)      │
│  • yt-dlp -x --audio-format m4a → writes audio to Files folder  │
│  • writes a sidecar .json per track (title, duration, thumb)    │
│  • updates a master index.json catalog                          │
└───────────────┬─────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────┐
│ FILES APP STORAGE  (local, uncapped)                           │
│  • /library/<id>.m4a      audio                                 │
│  • /library/<id>.json     per-track metadata                    │
│  • /library/index.json    master catalog                        │
│  PWA reads catalog in, loads audio on demand when I hit play.   │
└─────────────────────────────────────────────────────────────┘
```

Division of labor:
- **PWA** = everything I see and feel (search, player, playlists, stars, UI). ~90% of code.
  Built and tested ENTIRELY on the Windows laptop in a browser using sample MP3s.
- **a-Shell script + Shortcut** = the download pipeline. Can ONLY be built/tested on the
  iPhone itself. Done LAST.

---

## 3. Decisions already made (don't ask me again)

- **Framework:** React + Vite. (I know React; cleaner code.)
- **Hosting:** GitHub Pages (free, HTTPS, I already use GitHub as EnesYilmazCode). Firebase
  Hosting is an acceptable alt but NOT required. No Firebase backend at all, no Firestore,
  no Auth, no Storage. Everything is local to the phone.
- **YouTube search source:** **YouTube Data API v3** (free key via Google Cloud, fast,
  returns thumbnails + titles, 100 searches/day quota = plenty for personal use). yt-dlp's
  own `ytsearch` is the fallback only if I refuse to set up a Google Cloud key.
- **Audio format:** m4a (AAC), small, native to iOS.
- **Catalog/state storage in PWA:** IndexedDB for the catalog + playlists + stars (NOT for
  the audio blobs, those stay in Files to avoid the ~1GB IndexedDB eviction ceiling).
- **Background audio:** Media Session API. Accepted limitation: audio stops if I FORCE-QUIT
  the PWA (fine for screen-off-in-pocket listening; not trying to beat native apps here).

---

## 4. Known iOS constraints baked into the design (so you don't fight them)

1. PWA must be served over **HTTPS** with a valid `manifest.json` + service worker to be
   installable via Add to Home Screen. Localhost is exempt for dev.
2. PWA **cannot silently trigger a download and get a callback**. The handoff to the
   Shortcut is one-directional; after download I tap back into the PWA and it re-scans the
   catalog. No live progress bar across the boundary, accept this.
3. PWA **cannot freely read arbitrary Files-app folders** (sandbox). Audio is loaded via
   user file-picker grant or a file-handle flow, OR we accept importing once. Flag the
   cleanest approach for current iOS when we get there.
4. IndexedDB/Cache storage in iOS PWAs is **capped (~1GB, evictable)**. That's exactly why
   audio lives in Files, not in the PWA.
5. **Media Session API** lock-screen controls work only while the PWA process is alive.
6. **yt-dlp breaks periodically** when YouTube changes things; fix is `yt-dlp -U`. Build an
   "update engine" one-tap Shortcut so this is painless.

---

## 5. Build order (follow this)

**Phase 1 — App shell + installability (laptop)**
- Vite + React project scaffold.
- `manifest.json`, icons, service worker → confirm it's installable / passes Lighthouse PWA.
- Basic layout/nav, dark UI.

**Phase 2 — Library + catalog + fuzzy search (laptop)**
- Define the catalog schema (track: id, title, artist/uploader, duration, thumbnailUrl,
  filePath, dateAdded, starred, playCount).
- Seed with 3–5 sample MP3/m4a files in a local folder to develop against.
- IndexedDB layer (suggest `idb` or `Dexie`).
- Real-time fuzzy search (suggest Fuse.js) over the catalog as I type.

**Phase 3 — Player + organization (laptop)**
- HTML5 `<audio>` player: play/pause, scrub, **loop/repeat**, next/prev.
- **Star/favorite** toggle persisted to IndexedDB.
- **Playlists**: create, add/remove tracks, reorder; persisted.
- **Media Session API**: title/artist/artwork + lock-screen play/pause/next/prev.

**Phase 4 — YouTube search integration (laptop, needs API key)**
- "Search YouTube" UI when a query has no good local match.
- Call YouTube Data API v3 (search.list), render results (thumb + title + channel).
- On tap: stage the video for download (hand off to the phone pipeline).
- Keep the API key out of source (env var); note GitHub Pages is static so the key is
  client-side — discuss how to restrict the key (HTTP referrer restriction) since there's
  no server to hide it. THIS IS AN IMPORTANT SECURITY NOTE TO RAISE WITH ME.

**Phase 5 — Deploy + install (laptop → phone)**
- Build, push, GitHub Pages, HTTPS URL.
- iPhone Safari → Add to Home Screen → confirm it runs as an app.

**Phase 6 — Download engine (PHONE ONLY, do last)**
- a-Shell: `pip install -U yt-dlp`.
- Download script: takes a video ID/URL, runs
  `yt-dlp -x --audio-format m4a -o "<id>.%(ext)s"`, writes sidecar metadata JSON,
  updates index.json.
- iOS Shortcut: Share-sheet / URL-scheme entry that passes the chosen video to a-Shell.
- "Update engine" Shortcut wrapping `yt-dlp -U`.
- Wire the PWA's "tap a result" to open this Shortcut.

---

## 6. Open questions to confirm with me FIRST (before writing Phase 1)

1. Is **Node.js** installed? (`node -v`) If not, that's step zero (nodejs.org LTS).
2. My **iPhone model + iOS version** (affects Media Session + file-handle behavior).
   I'll provide this.
3. Am I OK creating a **free Google Cloud project** for the YouTube Data API key? (If hard
   no, fall back to yt-dlp `ytsearch` and the YouTube results list loses thumbnails.)
4. Do I want this in a **public or private GitHub repo**? (Public = easy GitHub Pages +
   build-in-public material; but then the API key restriction matters more.)

---

## 7. What I think I need that I might be underestimating (flag/help me with these)

- **API key exposure on a static host.** No server = the YouTube API key ships to the client.
  Need referrer/key restrictions in Google Cloud console. Walk me through locking it down.
- **The PWA↔Files audio-loading mechanism** is the riskiest unknown on current iOS. When we
  hit Phase 3/6, research/confirm the actual working approach (File System Access API support
  on iOS Safari is limited) and tell me the real options, not the theoretical ones.
- **Service worker caching strategy** so the app shell works offline but I don't cache stale
  builds. Suggest a sane default (e.g. Workbox or hand-rolled).
- **Catalog sync**: since a-Shell writes index.json and the PWA also tracks state, define one
  source of truth and a merge strategy so stars/playlists (PWA-owned) don't get clobbered by
  catalog updates (engine-owned). Suggest: engine owns track existence/metadata; PWA owns
  user state keyed by track id; merge on load.

---

## 8. Stretch ideas (NOT now — note for later)

- Search-as-you-type that blends local + YouTube results in one list.
- Auto-generated playlists (recently added, most played, starred).
- Simple waveform/seekbar art.
- Export/import catalog as JSON backup.
- A "Bismuth"-style branded build-in-public writeup of the architecture (this is a genuinely
  interesting systems-integration project: sandboxed web app + on-device Python + OS glue).

---

## 9. First action for you (the assistant)

Confirm the 4 open questions in §6, then start **Phase 1**: scaffold the Vite + React PWA,
make it installable (manifest + icons + service worker), and give me copy-paste-ready files
with a short explanation of *why* each piece exists. Then stop and let me get it running
before Phase 2.