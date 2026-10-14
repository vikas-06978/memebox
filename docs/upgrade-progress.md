# MemeBox upgrade

The current local review is on `review/memebox-local-2026-10-14`; older development started on `feature/memebox-2-global`. The live site and Web Store release are separate deployments.

## Product decisions

- Keep the current colourful themes and make screens understandable on mobile and with keyboard navigation.
- Free third-party music uses an official visible YouTube player. YouTube ads cannot be removed by MemeBox.
- Only original or appropriately licensed music can be hosted and included in paid plans.
- Unicorn, Robot, Snake and Bird are Pro Max exclusives for new users. Eight other characters can be purchased permanently. Previously purchased Unicorn/Robot and legacy bundle orders remain compatible.
- Regional dialogue content and interface translations are different catalogs. Unsupported speech voices must not be advertised as supported.
- No em dashes in website text.
- A complete beta needs browser validation before asking the owner to load it.

## Implemented in this branch

- Playlist selection and search, continuous queue playback, a visible embedded player, translated controls.
- Large pinned pictures with close and Escape controls, Stop all cleanup and protection against late image decoding.
- Playful settings shortcuts and responsive music-library styling.
- Full-page local Playground with 14 characters, reactions, lights, filters and original music previews.
- Original Snake and Bird artwork and reactions. New exclusive-character sales are closed, the eight-character bundle is ₹199 / $4.99, and 5-hour Pro / 8-hour Max passes match the handover.
- Regional/foreign language metadata for recorded packs; unsupported text-only voices are refused instead of silently switching to English.
- Shared hosted-file budgets: 500 downloads and 512 MB per UTC day, 5,000 downloads and 4,096 MB per UTC month.
- Atomic catalog caps: 10 YouTube playlists, 50 tracks per playlist, 500 total including drafts.
- Admin pack page displays daily/monthly reserved usage and whether hosted audio is paused.
- Storage maximum of 500 MB and default per-user limits of 5 files and 30 MB per day.
- Shared reservations are atomic, happen before R2 access and remain consumed if delivery fails. This intentionally errs toward lower capacity.
- `PACKS_ENABLED=off` pauses hosted file delivery/catalog. All hosted file uploads, playback and file deletion are disabled unless `HOSTED_FILES_ENABLED=on` is explicitly set. This is an application guard, not a Cloudflare billing cap. Hosted audio additionally remains disabled unless `HOSTED_AUDIO_ENABLED=on` is explicitly set after billing review. `PHONK_MODE=off` pauses YouTube links.
- Three locally synthesized original Phonk loops: Desi (Pro), Drift and Midnight (Max). They work in the extension's outgoing mic, Playground and website player without hosted audio files. YouTube tracks are always free, including old paid catalog labels.
- Test-only Razorpay checkout with server prices, signed raw-byte webhooks, captured-payment confirmation, atomic fulfillment, browser recovery for the last 100 orders and an authenticated admin ledger. Live mode is deliberately refused.
- Idempotent refund records and conservative review for shared purchases; manual UPI approval also grants atomically under retries.
- Signed cumulative usage receipts, atomic Max-first deductions, session renewal, persistent retry targets and offline-debt reconciliation before changing keys.
- Sixteen interface choices: twelve complete languages and German, Italian, Japanese and Punjabi Beta bundles with native core controls and English advanced fallbacks. See `language-review.md`.
- Regional recording scripts are prepared in `pack-content/`; nothing has been uploaded or published.
- The free music review shortlist contains 30 tracks across style-based collections. Specific YouTube IDs/embedding/credit checks are still pending; the review manifest is not seeded as live content.
- Owner-managed playlists remain editable through `/admin/packs`. Free playlists appear first, with optional localized Shuffle and unchanged catalog caps. New free catalog video IDs remove per-play D1 lookups/writes; old clients can still use the legacy endpoint.
- Original Phonk arrangements now have 32-bar sections, synthesized cowbell, fills, pads, stereo detail and audio-node cleanup. Full local review WAVs are rendered from the shared engine. See `original-music.md` and `pack-content/manage-phonk.md`.
- Three free accessories for every available character: party hat, crown and scarf. They use the shared preview/outgoing-camera renderer and preserve the character's reactions.
- `npm run build:release` prepares a minified extension locally, preserves license notices and emits no source maps. This is packaging preparation, not publication or copy protection.

## Cost limits and their boundaries

The application counters cap successful file deliveries. They do **not** guarantee zero platform bills: rejected requests still consume Functions and D1 operations, and administrator uploads, bucket operations, other apps and direct bucket access are outside these delivery counters. Caching alone is not a billing limit. Budget alerts are not hard spending caps.

Keep Workers/Pages Functions and D1 on the Free plan. Confirm current limits in Cloudflare before launch. R2 can be billed for usage beyond its free allocation, so hosted premium music must stay disabled until account billing settings and the bucket's access configuration are reviewed. Disable r2.dev/public/custom-domain access to the bucket and serve content only through guarded endpoints. Do not enable automatic paid upgrades. If a strict no-billing arrangement for R2 cannot be confirmed, launch with hosted music disabled and use bundled original loops plus free official YouTube embeds.

The settings `PACK_GLOBAL_DAILY_FILES`, `PACK_GLOBAL_DAILY_MB`, `PACK_GLOBAL_MONTHLY_FILES`, `PACK_GLOBAL_MONTHLY_MB`, and `PACKS_MAX_MB` can lower the code's ceilings. Invalid or zero global settings fail closed. Global periods use UTC, not the buyer's timezone. Narrow caps can interrupt service; communicate that before selling access.

Razorpay fees, domain renewals and store fees are separate costs. Payment approval does not establish international card acceptance.

## Still pending

- Full translation and native review of beta bundles, localized gateway states, and original regional recordings.
- Specific official YouTube/NCS playlists with verified embedding permissions and required attribution.
- Actual Razorpay test-environment validation with securely supplied test credentials and a separate test database. Live gateway support remains a later explicitly authorized change, following account/international approval.
- Refund initiation and settlement reconciliation through the provider; shared-license refunds still need manual entitlement review.
- Final store wording/screenshots/video and the final owner-selected version number. Existing source/license obligations need review before promising a closed-source release.
- Real Meet/weak-laptop validation. Automated fake-call stream tests do not establish real-call performance.

No live payment activation, production migration, site deployment or Web Store publication is included in local development.

## Validation for this development milestone

- 193 unit tests passed, including payment signatures, bounded request bodies, unrelated-site webhooks, transactional rollback, concurrent/manual fulfillment, shared refunds, signed replay/renewal, content caps, language fallbacks, outfits and legacy purchases.
- A full Chromium run passed all 110 tests available at that point. The later minified-ZIP run executed 115 tests: 113 passed initially. The language-menu test still expected 12 languages plus Auto, and the shared renderer did not forward the forced standing-pose option. Both were corrected. A final 19-test run against the rebuilt/extracted minified ZIP passed, covering both failures, all 14 characters' outfit rendering, language/theme switching, checkout, recovery and signed/offline usage.
- Playground, Phonk, pack browsing, pricing and outgoing-camera picture behavior passed focused browser tests. Picture tests inspect the actual outgoing stream after the old timeout, then verify Escape and Stop all remove it.
- Desktop/mobile screenshots reviewed. The production copy build and ZIP succeeded. This ZIP still uses development version 1.3.0 and is not the final release package.
- Playground and outgoing-picture browser tests also passed against the extracted ZIP, verifying the packaged files.
- The local site was restarted on an unused port with the current Functions/schema, and landing, feedback, checkout, config and admin responded correctly. Gateway test checkout is still disabled without credentials. Frozen-lockfile installation was rechecked with a writable npm cache.
- Cloud environment install/start instructions were refreshed in the saved draft, including the working pinned Chromium setup. Custom-domain/Razorpay network destinations were added to the draft without dropping existing domains. These changes have not been applied or published. The current proxy refused the memebox.site check, so custom-domain health remains unverified and the extension API/SEO address was not changed.
- The full beta remains incomplete until the pending provider, content, full localization, release and real-call work is done. Do not ask the owner to repeatedly load each development milestone.

## Music follow-up, 2026-10-14

- 193 unit tests passed after the free catalog/video-ID and music-engine changes.
- 12 focused browser tests passed for shuffle, zero per-play link-API requests on the new catalog, 30 free fixture songs, owner metadata updates, original/call-stream playback, Stop all and Playground.
- Full stereo review WAVs for all three originals were rendered locally from the shared engine. Peaks were below 0.34 at the conservative export gain; samples were finite/non-silent, and drop RMS was higher than intro/break RMS. These technical checks do not replace listening/mastering or real-call performance review.
- The updated minified extension build/ZIP succeeded, and all four music browser tests passed against the packaged build, including actual synthesized Phonk in the outgoing fake-call stream and Stop all cleanup.
- The review manifest has 30 selections, not 30 verified playable YouTube uploads. All actual video IDs and embedding/credit checks remain pending. No remote catalog, hosted audio, deployment or publication was performed.

## GitHub local review, 2026-10-14

- Dedicated download branch: `review/memebox-local-2026-10-14`. `START-HERE.md` explains loading `review/extension` without any build commands and opening `review/listen.html` offline. The source license settings are unchanged; only the explicitly named review copy is unlocked. Never publish that copy.
- All hosted-file uploads, delivery and admin previews are default-off behind `HOSTED_FILES_ENABLED=on`; hosted audio additionally requires `HOSTED_AUDIO_ENABLED=on`. Stored-object deletion is paused with hosting disabled to preserve cleanup records. This does not change Cloudflare account billing settings.
- 195 unit tests passed. The full browser run exercised 117 cases: 116 passed and the old admin-upload fixture failed because it did not opt into the new default-off hosting flag. Both hosted browser fixtures now explicitly opt in. The failing admin-upload case passed on its targeted rerun. No unresolved failure remains from that run.
- The separate ready-to-load review folder was checked in Chrome with no license: exclusive characters, filters and original music are unlocked, Buy is hidden and the site address uses loopback. Its three local WAVs play one at a time without external HTTP requests.
- Review build and separate shipping ZIP succeeded. Environment secrets, local databases and previously documented plaintext license keys are excluded from the current files. Git history still needs the previously noted owner-key rotation.
- Push uses the `[skip ci]` commit prefix. Cloudflare's official Pages GitHub integration documentation lists `[Skip CI]` as a deployment-skip prefix (case insensitive): https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/ . GitHub Actions also skips this push. Repository workflows only test/build/upload artifacts; they contain no deploy job. No pull request, merge, production migration, site deployment or store publication is requested.
- Actual provider payment tests, verified official YouTube IDs/embedding rights, full native-language review and real-call/weak-laptop testing remain pending.

## Companion and core-library follow-up, 2026-10-14

The current checklist is `local-review-checklist.md`. Shared preview/camera movement now has species gaits/signatures, explicit emote commands and shoulder/head resting. Absence remains sad through long sessions, including happy music, until a stable return. Filters use 3 Free + 15 Pro + 10 Max; Max extras have no individual product. Nine costumes follow the same tier structure. Pro includes ten standard characters; Max includes all fourteen. New individual cosmetic prices are closed drafts.

Pictures has its own call-panel tab. Local Plans shows prices, ownership rules and checkout availability without depending on the website. Music is exposed from Welcome/Options/Playground and the review Phonk button opens the bundled listening room. Bass-heavy original revisions remain synthesized locally. Regional collections are optional for everybody; a user can change meme language during a call while personal/universal additions remain available. Adult content is default-off, self-declared and retains its marker on installation/import/export; hiding it stops active/pending audio. Longer new translations, original regional recordings, verified YouTube links, provider tests and real calls remain external review work.

Final follow-up validation: 201 unit tests passed. The source browser run covered 125 cases (124 passed initially); the failed shoulder override was corrected and all 12 focused source cases passed. The packaged review covered 20 Music/Playground/UI/content cases: 19 passed initially, then all three content cases passed after replacing a timing-sensitive decode-delay test with a controlled pending-decode gate. All three offline WAVs play from the supplied GitHub folder, with no HTTP requests. Details and remaining owner work are in `local-review.md` and `local-review-checklist.md`.

## Dance/drop music revision, 2026-10-14

Owner feedback: the previous tracks felt like minimal slow loops without a convincing drop. The three originals now run at 150/156/144 BPM and have intro, accelerating snare/noise build, two-beat pause, eight-bar full bass/drum drop, breakdown and a layered second drop. First drops land within the 20-second panel preview. No third-party notes/audio were copied. The offline listening room exposes a first-drop comparison button; the renderer measures actual waveform energy before/after both drops and checks finite, non-clipping samples. Review WAV peaks are below 0.5 at the conservative export gain. Musical quality still needs the owner’s listening feedback. No deployment or payment settings changed.

Validation for the dance/drop revision: 201 unit tests and seven focused browser cases passed against the rebuilt minified review extension. Both drops in all three rendered WAVs passed waveform contrast/non-clipping checks. The offline first-drop buttons seek and play one track at a time without HTTP requests or page errors. Review rebuild and separate shipping ZIP succeeded.

## Consolidated music/playlist/price flow, 2026-10-14

The former review Phonk link opened only the original-tune Playground, so playlists were absent from that review. Welcome, Options, Playground and the actual call-panel Phonk button now lead to one room containing sixteen tunes and the five supplied playlist references. Private collections have add/edit/remove/restore/search controls and a ten-reference cap. The HTTP loopback launcher supplies the web referrer YouTube requires; no remote-player scripts execute in the extension. Published owner collections load on demand, include names/credits/adult flags, refresh without a new release and need no per-play database call.

Max music links select Max passes. Closed cosmetic drafts and permanent standard ownership retain their model. Future opened standard cosmetic products can be selected through buy deep links; no draft sale/live checkout is enabled. Personal audio uploads are Free: an accidental Max-only music:own gate was fixed and tested through the actual Free call-panel file chooser and outgoing stream.

Private selection labels/markers use a URL fragment, are removed from the address after reading and known markers survive website reloads. Privacy text now distinguishes on-device processing from call-service transmission and optional YouTube ads/data handling. No backend, credentials, databases or recordings are served by the static launcher.

Validation: 205 unit tests; 133/133 full source browser cases; 21 focused packaged cases; an additional Free personal-upload outgoing-call test; five checkout cases and the new real-site/CSP/catalog case. The PowerShell launcher parsed/served the real files under portable PowerShell/.NET on Linux, including read-only/path-boundary checks. The Windows .cmd/default-browser launch still needs platform review. A real NCS frame loaded without Error 153, but googlevideo.com deliveries failed through the cloud proxy, so full live streaming was not established. No deployment, migration, main merge, provider activation or store publication occurred.
