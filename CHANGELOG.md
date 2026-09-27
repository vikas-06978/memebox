# Changelog

All notable changes to MemeBox. The format follows [Keep a Changelog](https://keepachangelog.com/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added – Step 3: on-call UI (0.3.0)
- Panel:
  - category chips, plus ⭐ Favourites and 🕘 Recent (the last 12 played);
  - search, where Enter plays the first match;
  - 🎲 Random, which respects the current filter;
  - 🔔 Mic test, ⏹ Stop all, and the master volume;
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
- Friendlier messages: "Reload the call tab after updating", and "You are muted – memes are silent too".
- Tests: i18n completeness (same keys, placeholders, every key used exists). End-to-end tests for auto-duck, Alt+0, Alt+M, per-site position and the Hindi popup.

### Added – Step 2: voices (0.2.0)
- eSpeak-NG WebAssembly (bundled locally, English + Hindi only, about 1.8 MB) runs in an offscreen document's module worker. The page CSP allows only `'self'` and `'wasm-unsafe-eval'`.
- `lib/tts.js` and `lib/wav.js` are shared by the worker and the tests. The offscreen document returns WAV bytes, which go through the bridge to the mic hook, which decodes them into the soundboard node.
- Six tones, each combining eSpeak pitch/speed/range with a playbackRate: Normal, Chipmunk, Villain, Robot (monotone plus ring modulator), Slow-mo and Excited.
- Tests: real eSpeak synthesis in Node for every tone × {hi, en}, checking format, length and volume, and that tone speed is in the right order. The bundle is checked for having no remote URLs.

### Added – Step 1: mic hook
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

### Added – Step 0
- Project skeleton: `/extension`, `/site`, `/site/functions` and `/tests`, plus `extension/config.js` (`SITE_URL`, `PRO_ENABLED = false`).
