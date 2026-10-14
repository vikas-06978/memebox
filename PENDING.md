# Pending (for Wednesday)

## Current local review, 2026-10-14

**Deployment is paused until the owner explicitly requests it.** The historical notes below contain old versions, prices and release commands; use `docs/upgrade-progress.md` for current implementation status and `site/src/shop.js` for prices.

- Latest consolidated review: the unified music room shows the five supplied playlist references and sixteen tunes, with a localhost launcher, private manager, published-catalog refresh, correct Max pass links and Free personal audio uploads. Source UI/logic is tested; live gateway/content/real-call release prerequisites remain. See START-HERE.md and docs/local-review.md.
- Testing branch: `review/memebox-local-2026-10-14` (local review only, do not deploy). Start with `START-HERE.md`.
- Implemented locally: shared Playground/call companion movement, species signatures, manual controls, shoulder/head resting, waiting/crying/floating and stable welcome; 28 filters (3 Free + 15 Pro + 10 Max), nine costumes, a separate Pictures tab, stronger original synthesized Phonk, offline music listening, local Plans/prices links, preferred-language discovery, optional regional collections and default-off strong-language content with playback cancellation. Test-only Razorpay, signed captured/refund webhooks, atomic fulfillment/recovery, admin test ledger, signed usage receipts and default-off hosted files remain in place.
- Interface choices: 16 bundles, including four Beta choices. Core new movement/music/picture/adult controls have native strings; longer new helper, personality and pricing text still uses English fallbacks in several languages. Full native review remains.
- Before payment testing with the provider: configure test secrets securely in an isolated preview/local environment with a separate test D1 database. See `docs/payment-testing.md`. No live keys are accepted by the new gateway integration.
- Owner tasks remain: Razorpay approval and international-payment eligibility, bank/account verification, native-speaker content review, original regional recordings, verified official playlist links, real Meet/weak-laptop checks, final version and store assets.
- Repository history previously contained an owner key. Remove plaintext from working files and rotate the old key in the live admin before release; deleting text does not remove it from Git history.


## Historical handover below: not the current checklist

These entries describe previous plans, including superseded counts/prices and old deploy commands. Do not execute the commands as part of this local review. Use `docs/local-review-checklist.md`, `docs/companion-model.md` and the server catalog for the current state.

## You (owner)
- Run the D1 migration once, then deploy the site:
  `npx wrangler d1 execute memebox-feedback --remote --file=db/migrations/2026-10-time-pass.sql`, then `npx wrangler pages deploy --branch=main` from `site/`.
- Set the `UPI_ID` secret in Cloudflare (a free UPI merchant ID is better than a personal one), so /buy opens.
- Buy the `.site` domain; give the Chrome Web Store URL for the install buttons.
- Make the GitHub repo private (the site must not link to it).
- Test the latest zips on a real Google Meet call: camera quality, lamp follow, animals, own music, adding sounds in a call.

## Me (after your go-ahead)
- ML tracking is done (face position, smile, blink, tongue, kiss, wave, thumbs up, peace; bundled MediaPipe models). It must be tested in a real Meet call: speed on a weak laptop, tongue and wave thresholds, lighting.
- Razorpay in test mode first: signed webhooks, server-side prices, secrets via wrangler; card payment for dollars.
- Server-signed pass sessions (anti-cheat for the time passes).
- Live Lights demo on the website.
- Store listing wording, version 2.0.0 (this is the 2nd big version; the number stays 1.2.6 until you say), final tutorial video and store zip (only when you say).
- Dollar prices stay $1.49 / 2.49 / 3.99 / 5.49 (rupees ₹9 / 15 / 25 / 35).
- Check if the "Start here" card is too tall; shrink if needed.

## Store listing, update notice and video (at release, when told)
- Rewrite the Chrome Web Store description and screenshots (the live listing still describes the old free app): headline, free / Pro / Pro Max with rupees and dollars, 26 languages, characters. English first, translations later.
- No "coming soon" teaser. Instead: a one-time "What's new in 2.0" card after the update (existing key holders keep unlimited, say it clearly) and a short note on the website home page.
- Main video, 60-90 s, no voice-over and big captions so it works in every language: install, play a meme in a Meet call, lights, characters, music, Pro / Pro Max and prices. Recorded from the final 2.0 build. Captions in other languages later.
- Pro / Pro Max explanation in each language for the store listing and video captions (the pricing page already has 12 languages).
- Update the old dollar prices in this file: now Pro 30 min $1.49, 1 h $2.49, 2 h $3.99; Pro Max 1 h $3.49, 3 h $6.49; characters $0.99-$1.99, bundle $5.99.

## Security and copy protection (before the store release)
- Honest limit: extension code can always be read by anyone who installs it. We can only make copying slow and the paid parts useless without us.
- Release build: minify and obfuscate the JS, strip comments, no source maps, no tests or tools in the store zip.
- Keep the value on the server: pass balance, prices, key checks and the Razorpay webhooks are checked server-side. The extension only asks, it never decides. A copied extension without our server gets only the free part.
- Server-signed pass sessions, rate limits and abuse checks on /api/license and /api/order; secrets only through wrangler, never in the repo.
- GitHub repo private, no repo link on the site or store; the source stays out of the public store listing.
- Copyright notice and terms ("all rights reserved"), our own music, voices, characters and artwork are ours; check the licences of the third-party parts (THIRD_PARTY_NOTICES).
- Owner key: keep it only in private storage. Rotate the previously documented key in the live admin before release.

## Packs (music and memes)
- Once: `npx wrangler r2 bucket create memebox-packs`, then `npx wrangler d1 execute memebox-feedback --remote --file=db/migrations/2026-10-packs.sql` and then `--file=db/migrations/2026-10-packs-v2.sql` (per-item plans and picture packs), then deploy the site. Open `/admin/packs`.
- You upload: the common-ground music and memes, the phonk tracks (10 free, the rest Pro / Pro Max), India memes, Global memes. For every file write the licence and tick "I may share this" only when it is true.
- Done in 1.3.0: the panel layout and the packs screen inside the extension (Options → Online packs, with size, add / remove, Coming soon for paid packs, strong-language switch, India / Global first by region).

## Feedback to act on (from /admin, version 1.2.2)
- French user (2026-10-10, "Other"): "il n'y a pas beaucoup de choix de langue" (not many language choices). Memes and the voice engine only have Hindi and English. Plan: language packs (French, Spanish, Portuguese, Indonesian, Arabic...) as downloadable meme packs; voices need a decision (bundled eSpeak has only en and hi; more voices cost MB, so either download on demand, or use pre-recorded clips in the packs).
- English user (2026-10-07, "Too hard to use"): already answered from 1.2.3 on (Start here card, mute badge, reload button); check again with the new panel layout.

## How a release works
- Deploying the site (`wrangler pages deploy`) changes only the website and its server: installed extensions do not change. The site stays compatible with the old extension (same /api/license).
- Installed extensions change only when a new version is published in the Chrome Web Store (Chrome then updates people by itself, usually within hours). Order: 1) test the site and the extension locally, 2) deploy the site, 3) publish the extension (use the Web Store's staged / trusted-testers option first if you want a trial run).
