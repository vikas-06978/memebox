# Changelog

All notable changes to MemeBox. The format follows [Keep a Changelog](https://keepachangelog.com/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
