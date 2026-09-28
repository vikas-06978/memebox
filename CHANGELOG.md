# Changelog

All notable changes to MemeBox. The format follows [Keep a Changelog](https://keepachangelog.com/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added in Step 6: feedback system (0.6.0)
- **Site layout:** static pages in `site/public`, Pages Functions in `site/functions`, shared code in `site/src`, D1 schema in `site/db/schema.sql`, and `site/wrangler.toml`.
- **/feedback page:**
  - rating with 😞 😐 🙂 😍, "What did you use?" (Soundboard, Voices, Clips, Tab audio, Voice changer, Captions), "What should we add?", a message and an optional email.
  - English and Hindi.
  - It takes only `v` and `site` from the link, and drops them if they look wrong.
- **/uninstall page:** one question, "Why did you remove it?", stored in the same table with `type = 'uninstall'`.
- **POST /api/feedback:**
  - strict validation: unknown fields rejected, types and lengths checked, JSON only, 16 KB maximum
  - invisible Cloudflare Turnstile plus a honeypot
  - at most 5 answers per IP per hour. Only SHA-256(salt | hour | IP) is stored, and it is deleted after the hour.
  - No raw IP or user agent is ever stored.
- **/admin:**
  - sign in with `ADMIN_KEY` (a Cloudflare secret) for an 8-hour HMAC-signed session cookie (HttpOnly, Secure, SameSite=Strict)
  - sign-in tries are rate limited
  - shows totals per rating, features used, uninstall reasons, top requests and the latest 50 messages
  - **Download CSV**, with spreadsheet formulas neutralised
  - every admin response has `X-Robots-Tag: noindex`, a strict CSP and no scripts.
- **Site security headers** (`_headers`): CSP allowing only the site itself and Turnstile, nosniff and a referrer policy. `robots.txt` keeps /admin, /api and /uninstall out of search.
- **Extension:**
  - 💬 Feedback in the panel and **💬 Send feedback** in Options open the feedback page with `?v=<version>&site=<meet|zoom|teams|discord>` only
  - after the 10th meme, a small "Enjoying MemeBox?" card appears once and never again
  - `chrome.runtime.setUninstallURL(SITE_URL + "/uninstall?v=<version>")`
  - `STORE_URL` in `config.js` for "Rate us" (the feedback page until it's filled in).
- **Local run:** `npm run site:dev` runs the real functions with a node:sqlite stand-in for D1 (`tools/d1-sqlite.mjs`). The README has the Cloudflare deploy steps.
- **Privacy:** PRIVACY.md and a simple `/privacy` page explain exactly what the forms store.
- Node 22.13 or newer is needed (for node:sqlite in tests). CI now uses Node 24.

### Tests
- **Unit tests** (17):
  - validation: good posts, more than 15 bad ones, and the honeypot
  - the rate limit: 5 per hour, per IP, the next hour, old rows deleted, and no raw IP stored
  - the admin session: expiry, tampering, the wrong key, and brute-force limits
  - CSV escaping
  - the real Functions against SQLite, checking stored fields, no IP or user agent, and 405/413/415/400/403/429/503
  - admin sign-in, cookie flags, dashboard escaping, CSV, sign-out, and noindex on every response.
- **Browser tests** of the real pages with their CSP:
  - feedback, the Hindi page, client checks, and dropping odd link parameters
  - the uninstall survey
  - admin sign-in, dashboard, CSV download and sign-out.
- **Extension tests:** Options opens the feedback link, and the ask appears once after the 10th play.

### Added in Step 5: tab audio and voice changer (0.5.0)
- **Tab audio to the mic:**
  - The tab you send stays audible for you. Capturing a tab silences it, so a local copy is played back.
  - The tab sound has its own volume (0-200%). It can be set in the toolbar popup and in the 😂 panel, and both share one setting.
- **Live voice changer** for your own voice: Chipmunk and Deep, plus Robot, Echo and Radio.
  - Chipmunk and Deep use an AudioWorklet pitch shifter (`voice-worklet.js` + `lib/pitch-shift.js`). If a page blocks the worklet, the same maths runs on the main thread as a fallback.
  - It sits between the real mic and the mixer. Auto-duck still reads your raw voice.
  - **Alt+V** switches between Off and your last voice. **Off** reconnects the plain mic instantly.
  - It always starts Off on a new call page.
  - It is kept when the call re-opens the mic.
- **Captions on my camera** (optional, off by default):
  - Path: camera → canvas (frame + meme text) → `canvas.captureStream(30)`.
  - Only your own video is changed.
  - It applies when the camera starts.
  - The canvas track mirrors the real camera: label, settings, `enabled`, `stop` and clones.
- **Share (manual):**
  - **💾 WAV** saves a line as it sounds in the call, with its tone and line volume.
  - **WhatsApp** opens `https://wa.me/?text=…` with the caption and the site link.
  - WhatsApp is never automated.
- `web_accessible_resources` has only the worklet files, and only for the 5 call sites. There are no new permissions.

### Fixed
- The panel's 🦆 Auto-duck switch had no effect. The bridge dropped `duck` commands.
- PRIVACY.md still described the removed optional link permission.

### Tests
- Unit tests for the pitch shifter: passthrough, 200→320 Hz and 300→216 Hz, level, clamping, and counter wrap. Manifest tests for the worklet resources and load order.
- End-to-end tests:
  - Alt+V raises the sent voice's pitch through the AudioWorklet and restores it.
  - Deep works through the fallback. Robot, Echo and Radio keep the voice flowing, with memes on top.
  - Camera captions are off by default. When on, the camera goes through a canvas that ends when stopped.
  - The popup's tab volume is saved.
  - WAV download and the WhatsApp link work.

### Added in Step 4: lines, clips, files, packs (0.4.0)
- Rewritten Options page, in English and Hindi. Each line has text, "pronounce as", language, tone, category, favourite slot (1-9), per-line volume (0-200%) and ⭐. It also has search and a category filter.
- Clips from:
  - an audio file (MP3/WAV/OGG/M4A)
  - a **video file** (MP4/WEBM, only its sound is kept)
  - a **direct file link** (.mp3 .mp4 .wav .ogg .webm), fetched with the normal browser rules. If the server blocks it (CORS), a clear message says to download the file and upload it instead
  - **recording yourself** (up to 10 s).
- YouTube, Instagram and other video page links are refused, with a pointer to "Send this tab's sound".
- Waveform trimmer: drag the edges or use the sliders, preview the selection, and save as a mono WAV at the best sample rate that fits in **1 MB**.
- Built-in **College, Cricket, Office and Party** packs (original, friendly Hinglish and English lines) alongside the general pack. Each pack can be added, reset or removed.
- Export and import `.memepack.json` (a category, or all lines, with their clips). Validation is strict: unknown fields, types, lengths, counts, ids, clip references, base64, WAV-only and 1 MB per clip are all checked, and the page lists every problem it finds.
- Timed lines / party mode is kept (off by default).

### Changed
- Removed the 0.x "stream from link" line type and its optional "access any website" permission. That permission is outside the final permission list.

### Fixed
- A per-line volume of 0 was treated as 100%. The bridge used `|| 1`.

### Tests
- Unit tests for the trimmer maths, pack validation (valid, round trip, and more than 20 invalid cases), and the built-in pack content, including a check for words about groups or looks.
- End-to-end tests for installing packs, WAV and webm uploads through the trimmer into the call, direct links with a real CORS-open and CORS-closed server, YouTube refusal, recording, pack export → wipe → import, invalid packs, and per-line volume in the call.

### Added in Step 3: on-call UI (0.3.0)
- Panel:
  - category chips, plus ⭐ Favourites and 🕘 Recent (the last 12 played)
  - search, where Enter plays the first match
  - 🎲 Random, which respects the current filter
  - 🔔 Mic test, ⏹ Stop all, and the master volume
  - "Hear memes myself" and 🦆 Auto-duck switches.
- The 😂 position is saved per site.
- Status dot: green = in the call and hooked, yellow = muted (or click once to enable), grey = no call.
- Shortcuts:
  - Alt+1…9 play favourites, Alt+0 stops all, Alt+M shows or hides the UI.
  - They're ignored while you type in text boxes or chat.
  - The global shortcuts (chrome.commands) reach your call tab even from another tab.
- Auto-duck: memes drop to 35% while your real mic is loud. This includes the very first moment of a meme.
- Lines gain `category`, `star` and per-line `volume` fields.
- English and Hindi UI through `chrome.i18n` (`_locales/en` and `_locales/hi`) for the panel, popup, manifest and shortcut names.
- Friendlier messages: "Reload the call tab after updating", and "You are muted, so memes are silent too".
- Tests: i18n completeness (same keys, placeholders, every key used exists). End-to-end tests for auto-duck, Alt+0, Alt+M, per-site position and the Hindi popup.

### Added in Step 2: voices (0.2.0)
- eSpeak-NG WebAssembly (bundled locally, English + Hindi only, about 1.8 MB) runs in an offscreen document's module worker. The page CSP allows only `'self'` and `'wasm-unsafe-eval'`.
- `lib/tts.js` and `lib/wav.js` are shared by the worker and the tests. The offscreen document returns WAV bytes, which go through the bridge to the mic hook, which decodes them into the soundboard node.
- Six tones, each combining eSpeak pitch/speed/range with a playbackRate: Normal, Chipmunk, Villain, Robot (monotone plus ring modulator), Slow-mo and Excited.
- Tests: real eSpeak synthesis in Node for every tone × {hi, en}, checking format, length and volume, and that tone speed is in the right order. The bundle is checked for having no remote URLs.

### Added in Step 1: mic hook
- `mic-hook.js` (MAIN world, `document_start`, all frames, on the 5 call sites) wraps `getUserMedia`:
  - Mixes real mic → micGain → MediaStreamDestination, plus a soundboard GainNode, in one shared AudioContext.
  - Returns the mixed audio together with the original video tracks.
- The mixed track mirrors the real mic: its label, settings and constraints, the call's mute state, stop, and clones.
- `getUserMedia` is re-wrapped if a site replaces it (checked on `devicechange` and on user gestures). Streams we already mixed are never mixed twice.
- Fallback to the plain real mic when anything fails. The call never breaks.
- Same-origin iframe realms (a "pristine getUserMedia" trick) are patched too.
- `bridge.js` (ISOLATED world) relays page ↔ extension messages with unique, checked sources (`memebox-hook-9c1e` and `memebox-bridge-9c1e`).
- **🔔 Mic test** in the panel plays a hard-coded ding-dong into the mic.
- Console logs: `[MemeBox] hook installed`, `mic intercepted`, `playing into mic`.
- The existing Meme Button code (voices, panel, options, tab audio) came in as the base for the later steps and was renamed to MemeBox.
- Tooling:
  - `npm run build` produces `extension/dist`, and `npm run zip` produces `memebox-<version>.zip` (no dependencies).
  - Unit tests: tones, line validation, manifest and hook rules.
  - Playwright end-to-end tests: mixing, beep, mute, 😂 → eSpeak, devicechange re-wrap, and fallback.
  - GitHub Actions CI that uploads the store zip.

### Added in Step 0
- Project skeleton: `/extension`, `/site`, `/site/functions` and `/tests`, plus `extension/config.js` (`SITE_URL`, `PRO_ENABLED = false`).
