# Local review before release

Download the GitHub branch `review/memebox-local-2026-10-14` using Code > Download ZIP, then extract the entire archive. Follow [START-HERE](../START-HERE.md). No installation of Node or build commands is needed for the supplied Chrome extension and offline listening room.

- **review/extension**: ready-to-load minified extension named MemeBox Local Review. Paid features are unlocked only in this copy; checkout is closed and the site address is loopback. Load this folder through chrome://extensions > Developer mode > Load unpacked. Never publish the unlocked copy.
- **review/listen.html** and **review/music**: three original arrangements with native audio controls. Double-click listen.html in Chrome. No server or internet is needed.
- **extension**, **site**, **tests**, **tools** and **docs**: development source, backend, tests and guidance. Source shipping entitlement settings remain enabled; do not load extension expecting the same unlocked review experience.

If replacing an earlier review, replace the extracted folder, reload the extension and reload your call tab. Use Playground to review actual species actions, emotes, Leave/Return, resting positions, all 28 filters and nine costumes. Music, Pictures and Plans have visible links. See [the checklist](local-review-checklist.md), [the tier model](companion-model.md) and [meme publishing](meme-publishing.md).

Backend pages require a local server: npm ci, then PORT=8789 npm run site:dev (PowerShell: $env:PORT=8789; npm run site:dev). Use a supported Node version. Local configuration is documented in site/.dev.vars.example; no secrets/live credentials are supplied. The UPI setting is blank by default. See payment-testing.md before isolated provider tests. Live payments remain closed.

The 30 YouTube titles are an editable shortlist, not verified playable additions. Official video IDs, embedding and rights/credit checks remain pending. The embedded player retains YouTube ads and restrictions. Original music is synthesized on the device; owner listening and actual call review remain necessary.

Hosted uploads/delivery/previews need HOSTED_FILES_ENABLED=on; hosted audio additionally needs HOSTED_AUDIO_ENABLED=on. Stored file deletion is paused while hosting is disabled to preserve cleanup records. These guards do not change account plans or cap provider billing. No deployment, remote database migration, main merge or Web Store publication is requested.

## Current validation, 2026-10-14

- Final unit run: 201 passed, no failures. Site fallback copy now matches the updated ten-character Pro model and all English translation keys.
- Full source Chromium run: 125 cases, 124 passed initially. The one failed shoulder-preview override was fixed; the resting-position expectation was updated to the requested paused-exploration behavior. A targeted source run passed all 12 cases, covering that failure, tracker/absence/tears, outgoing pictures, local Plans and adult call/Options cancellation.
- Packaged unlocked review: 20 cases covered for Music, Playground, call-panel UI and content. Nineteen passed initially; the new delayed Options-preview test used a fixed delay that expired while the user click scrolled the page. It now holds decoding until opt-out is confirmed instead. All three packaged content tests passed on rerun, including that case; the other nineteen checks already passed. No unresolved failure remains.
- All three WAVs play from the actual GitHub review folder without external HTTP requests. The review opens without a license, exposes exclusive previews and keeps purchases unavailable. Stereo render peaks remain below 0.5 at conservative export gain.
- Desktop/mobile layout checked for Playground and mobile Plans without horizontal overflow. Shipping minified build, review copy and separate shipping ZIP build successfully. Packaging is not publication.

Actual Razorpay account/provider tests, verified official YouTube links, original regional recordings, full native translation/review, real Meet/weak-laptop performance and release approvals remain pending. Previously exposed owner-key rotation must happen before release. See the current checklist rather than old PENDING.md release commands.
