# Changelog

All notable changes to MemeBox. The format follows [Keep a Changelog](https://keepachangelog.com/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.2.0] - 2026-09-28

### Added
- **12 languages** in the extension and on the website:
  - English and Hindi
  - Bengali, Marathi, Tamil, Telugu and Gujarati
  - Spanish, Arabic, Portuguese (Brazil), French and Indonesian.
  - The extension follows Chrome's language. The website picks one from the link (`?lang=`), your last choice or the browser, and has a 🌐 menu.
  - Arabic is laid out right to left. The meme voices stay Hindi and English.
- **Color themes:** Auto (follows the computer), Light, Dark, Sunny, Neon and Candy.
  - In the extension: a 🎨 Colors menu in Options and swatches on the welcome page. The panel, popup, Options and welcome page all follow it.
  - On the site: a 🎨 menu. The choice is remembered and applied before the page paints.
- **Try it on the landing page:** a mini soundboard plays real MemeBox voices (made with the bundled eSpeak by `npm run demo-sounds`) and three live effects (air horn, "ba dum tss", sad trombone). It has four tones, a pop-up caption on a mini call, and a counter.
- **Interactive emoji:**
  - the landing page's floating emoji burst into more emoji when clicked, and so do the demo pads
  - in the extension, the 😂 button laughs and emoji burst out whenever a meme plays (only on your screen).
  - Both are off for people who prefer reduced motion.
- The site's feedback form stores any of the 12 language codes.
- **SEO** (`npm run seo`, `tools/seo.mjs`):
  - a real landing page per language (`/hi/`, `/es/`, …) with the translated text in the HTML, and the right `lang`/`dir`
  - four pages for common searches (Google Meet, Zoom, Teams and Discord soundboard)
  - on every page: title, description, canonical, `hreflang` (12 languages + x-default), Open Graph and Twitter cards, and JSON-LD (SoftwareApplication with the free and ₹99 offers, FAQPage, BreadcrumbList)
  - a sitemap with language alternates, and a 1200×630 social preview image (`og-card.png`).
  - On landing pages, the 🌐 menu now goes to the real language page. The README explains Google Search Console and Bing.

### Tests
- Every extension language and every site language has exactly the English keys and placeholders. Names and descriptions fit the store limits in every language. The English in the site HTML matches `en.json`, and every key the scripts use exists.
- End-to-end:
  - theme from Options reaches the panel and is remembered, and the welcome swatches work
  - the popup in Arabic is right to left, and Options works in Spanish
  - the site's theme and language menus work (Tamil, and Arabic right to left)
  - the try-it soundboard plays, shows the caption and counts, and the emoji bursts appear.

### Changed
- **Fresh look across the site and the extension.**
  - Landing page: a sticky header with an install button, a bolder hero with a framed demo, floating emoji and an "Everyone heard" bubble, "works with" chips, feature cards with icons, numbered steps, a Free vs Pro section, a privacy note, an expandable FAQ and a final call to action.
  - Site pages (feedback, uninstall, buy, privacy, terms, admin) share one design system: soft brand background, rounder cards, gradient buttons, labelled rating faces, highlighted choices, and full dark mode.
  - On-call panel: memes come first. Volume, voice and the three switches fold into a "🎛 Sound & voice" section with a one-line summary, and it remembers whether it's open. Bigger play buttons, cleaner rows, a gradient 😂 button and a smooth open animation.
  - Toolbar popup and Options: a matching header, gradient main buttons and softer cards.
  - Store screenshots and the landing demo image were regenerated.
- `UPI_ID` and `UPI_NAME` are no longer in `site/wrangler.toml`. Add them as secrets in the Cloudflare dashboard, where the file can't overwrite them. The local example `site/.dev.vars.example` keeps the placeholder `memebox@upi` for testing.

## [1.1.0] - 2026-09-28

### Added
- **Picture memes.** Any line can have a picture (PNG, JPG, WEBP or GIF, shrunk to 640 px and 300 KB WEBP). While the line plays:
  - the picture flashes above the big caption on your screen, drawn on a canvas so call sites' CSP can't block it
  - it also shows on your camera picture if "Caption on my camera" is on.
  - Pictures are stored only in the browser (a new IndexedDB store). They are deleted when no line uses them and are left out of exported packs.
- **Import many audio files at once** (📂 in Options → Clips). Each file becomes a clip, cut to what fits in 1 MB, named after the file, in "clips". A summary lists skipped files. Up to 50 files at a time.
- **License keys** you control:
  - `/admin` → License keys makes owner keys (for yourself) and gift keys (unlimited, or a number of picture slots), and turns any key off or on.
  - Options → **MemeBox Pro** activates a key.
  - The service worker re-checks it once a day. A turned-off key stops at the next check, and offline a key is trusted for 30 days.
  - `POST /api/license` is CORS-open. It stores only the day of the last check.
- **UPI payments straight to your bank** (`/buy`):
  - 5 more pictures for ₹29, Pro (lifetime) for ₹99
  - a UPI QR code and a "Pay with UPI app" link with the amount and the note `MemeBox <order code>`
  - the buyer types the 12-digit UTR, and you approve or reject on `/admin` after checking your bank app
  - approving creates a key or tops up an existing one, and the buyer's page shows the key
  - each UTR can be used once, orders are rate limited, and unclaimed orders are deleted after 2 days.
  - `UPI_ID` / `UPI_NAME` are in `site/wrangler.toml` (placeholder `memebox@upi`).
- `/admin` now starts with **Payments waiting for you** (with "Earned so far") and **License keys**, above the feedback.
- Two new Pro features, `bulkImport` and `pictures`, marked `// PRO:`. They stay free while `PRO_ENABLED` is false.
- Terms and privacy (site and PRIVACY.md) cover pictures, purchases and license checks. STORE.md declares the license key (Authentication information). The README explains the whole Pro and UPI flow.
- The website vendors `qrcode-generator` 2.0.4 (MIT) for the QR code. It is not part of the extension.

### Fixed
- The picture message from the service worker could lose its type field.

### Tests
- **Unit:**
  - keys and order codes, the UPI link format, and prices
  - `/api/license` (active, unknown, malformed, turned off, CORS)
  - the full order flow (create, claim, approve, key), top-ups, UTR reuse, rejecting, and admin-only actions
  - rate limits, and payments closed without a UPI ID
  - plan limits with and without licenses, 30-day expiry, and turned-off keys.
- **End-to-end** against the real site functions:
  - bulk import of 4 files (3 added, 1 skipped)
  - a picture meme saved as WEBP and shown on the camera, then removed and cleaned up
  - the buy page QR for `memebox@upi` with ₹99 and the order note, the UTR check, admin approval and the key shown
  - an owner key made in `/admin` activates in Options, and turning it off is picked up.

## [1.0.0] - 2026-09-28

The first store release. It includes everything from Steps 0 to 8 below.

### Added in Step 8: store readiness and polish
- **Welcome page** after install:
  - 3 illustrated steps (inline pictures)
  - a **Mic test** with a live level meter that stays on the page
  - **Hear a meme**, which plays a sample line on your own speakers
  - English and Hindi.
- **Permissions:** exactly `storage`, `offscreen`, `tabCapture` and host permissions for the 5 call sites. There is no `<all_urls>`, no optional permissions, no analytics and no remote code. Each one is explained in STORE.md.
- **Friendlier errors:** the popup now says "reload this tab" when a call tab was open before MemeBox was installed or updated. It checks this with a ping to the tab.
- **Store images:** `npm run store-images` takes real screenshots of the extension:
  - 4 screenshots at 1280×800 (a mock call with the panel and a caption, Options, the welcome page, the tab audio popup)
  - the 440×280 promo tile.
  - `npm run icons` also makes the 300×300 Edge logo.
- **Website:**
  - a landing page (features, how it works, FAQ, an install button, and a screenshot standing in for the demo GIF)
  - terms of use and an updated privacy page
  - `sitemap.xml`, with robots.txt pointing to it.
  - All pages are mobile-friendly and use no inline scripts or styles, so they fit the strict CSP.
- **STORE.md rewritten:**
  - the name, and a 129-character short description (also the manifest description)
  - a full description with the keywords "soundboard", "meme sounds", "voice changer", "sound effects" and "Google Meet, Zoom, Teams, Discord"
  - categories, single purpose, and a justification for each permission
  - the data-use answers, and publishing checklists for the Chrome Web Store and Edge Add-ons.
- **README:**
  - a placeholders list to fill in before publishing
  - store images, release steps, and Step 8 manual tests
  - license and credits (GPL-3.0-or-later, eSpeak-NG).

### Fixed
- The background ignored popup messages when popup.html was open in a tab. It now accepts them from any extension page.

### Tests
- **Unit tests:**
  - the short description matches the manifest and fits 132 characters, and the full description has the keywords
  - the exact permission list, with a justification for each
  - no analytics, remote scripts or eval
  - no brand names in the extension name
  - the icon and store image sizes
  - the site pages have a viewport, lang and title, only local scripts, and no inline script or style
  - the sitemap matches the real pages, and the landing page has its links.
- **End-to-end:**
  - the welcome page opens by itself after install and the mic test hears the fake mic
  - "Hear a meme" speaks
  - the popup can read a call tab's URL and a running call tab answers the ping.
- The test setup waits for the welcome tab and leaves it open, so later "new page" waits can't catch it. Closing it caused a rare test-only race where the next extension page got no translations.

### Added in Step 7: Pro prepared, switched off (0.7.0)
- `extension/lib/plan.js` defines `MemePlan.isPro()`, `MemePlan.can(feature)`, the five future Pro features and the future free limits (10 clips, the General and College packs).
- While `PRO_ENABLED` is false (as shipped), `isPro()` is true for everyone, so nothing changes for users.
- Gates marked `// PRO:` for the voice changer, camera captions, unlimited clips, all packs and party mode. Each gate shows "This is a MemeBox Pro feature." (English and Hindi) once Pro is switched on.
- `hasLicense()` is a TODO that returns false. `config.js` warns not to switch Pro on before it exists.
- README "Pro and payments": the later plan. Razorpay Payment Page, then a `/thanks` function that verifies the payment with Cloudflare secrets, then a license key in D1, then `/activate` returns a signed token, then the extension verifies it.
- No payment code, no new permissions.

### Tests
- Unit tests: Pro is off in the shipped config and everything is allowed, the five features are exactly the planned ones, and with Pro on but no license only Pro features lock. Only an explicit `true` turns Pro on. Every gate names a real feature and is marked `// PRO:`, and plan.js loads before the scripts that use it.

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
