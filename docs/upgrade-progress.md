# MemeBox upgrade

Work stays on `feature/memebox-2-global`. The live site and Web Store release are separate deployments.

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
- `PACKS_ENABLED=off` pauses hosted file delivery/catalog. Hosted audio is disabled unless `HOSTED_AUDIO_ENABLED=on` is explicitly set after billing review. `PHONK_MODE=off` pauses YouTube links.

## Cost limits and their boundaries

The application counters cap successful file deliveries. They do **not** guarantee zero platform bills: rejected requests still consume Functions and D1 operations, and administrator uploads, bucket operations, other apps and direct bucket access are outside these delivery counters. Caching alone is not a billing limit. Budget alerts are not hard spending caps.

Keep Workers/Pages Functions and D1 on the Free plan. Confirm current limits in Cloudflare before launch. R2 can be billed for usage beyond its free allocation, so hosted premium music must stay disabled until account billing settings and the bucket's access configuration are reviewed. Disable r2.dev/public/custom-domain access to the bucket and serve content only through guarded endpoints. Do not enable automatic paid upgrades. If a strict no-billing arrangement for R2 cannot be confirmed, launch with hosted music disabled and use bundled original loops plus free official YouTube embeds.

The settings `PACK_GLOBAL_DAILY_FILES`, `PACK_GLOBAL_DAILY_MB`, `PACK_GLOBAL_MONTHLY_FILES`, `PACK_GLOBAL_MONTHLY_MB`, and `PACKS_MAX_MB` can lower the code's ceilings. Invalid or zero global settings fail closed. Global periods use UTC, not the buyer's timezone. Narrow caps can interrupt service; communicate that before selling access.

Razorpay fees, domain renewals and store fees are separate costs. Payment approval does not establish international card acceptance.

## Still pending

- Additional reviewed interface translations and curated regional dialogue content.
- Original music and free playlists with attribution and confirmed rights.
- Razorpay test orders, verified idempotent webhooks, automatic fulfillment and recovery.
- Signed pass sessions, admin payment reporting, refund handling.
- Live call/weak laptop tests and final integrated beta validation.

No live payment activation, production migration, site deployment or Web Store publication is included in local development.

## Validation for this development milestone

- 173 unit tests passed, including atomic shared caps, concurrent playlist limits, regional voice handling and legacy purchases.
- A full Chromium run executed 104 tests: 101 passed initially. Three failures were diagnosed: live feedback navigation under restricted networking, a language reload race in the test, and a hosted-audio test fixture needing explicit opt-in. All three passed on targeted reruns after correction.
- Playground, Phonk, pack browsing, pricing and outgoing-camera picture behavior passed focused browser tests. Picture tests inspect the actual outgoing stream after the old timeout, then verify Escape and Stop all remove it.
- Desktop/mobile screenshots reviewed. The production copy build and ZIP succeeded. This ZIP still uses development version 1.3.0 and is not the final release package.
- Playground and outgoing-picture browser tests also passed against the extracted ZIP, verifying the packaged files.
- The full beta remains incomplete until the pending payment, content, localization and real-call work is done. Do not ask the owner to repeatedly load each development milestone.
