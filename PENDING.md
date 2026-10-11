# Pending (for Wednesday)

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

## Security and copy protection (before the store release)
- Honest limit: extension code can always be read by anyone who installs it. We can only make copying slow and the paid parts useless without us.
- Release build: minify and obfuscate the JS, strip comments, no source maps, no tests or tools in the store zip.
- Keep the value on the server: pass balance, prices, key checks and the Razorpay webhooks are checked server-side. The extension only asks, it never decides. A copied extension without our server gets only the free part.
- Server-signed pass sessions, rate limits and abuse checks on /api/license and /api/order; secrets only through wrangler, never in the repo.
- GitHub repo private, no repo link on the site or store; the source stays out of the public store listing.
- Copyright notice and terms ("all rights reserved"), our own music, voices, characters and artwork are ours; check the licences of the third-party parts (THIRD_PARTY_NOTICES).
- Owner key (MBX-294K-D9VF-9BF6): keep it private; it is unlimited, so rotate it if it ever leaks. Our own account is the main (owner) user of the system.

## Packs (music and memes)
- Once: `npx wrangler r2 bucket create memebox-packs`, then `npx wrangler d1 execute memebox-feedback --remote --file=db/migrations/2026-10-packs.sql`, then deploy the site. Open `/admin/packs`.
- You upload: the common-ground music and memes, the phonk tracks (10 free, the rest Pro / Pro Max), India memes, Global memes. For every file write the licence and tick "I may share this" only when it is true.
- Me, next: the new panel layout (tabs, calmer look) and the packs screen inside the extension (browse, download with size shown, delete, Pro lock, "strong language" switch, suggested by browser language).

## Feedback to act on (from /admin, version 1.2.2)
- French user (2026-10-10, "Other"): "il n'y a pas beaucoup de choix de langue" (not many language choices). Memes and the voice engine only have Hindi and English. Plan: language packs (French, Spanish, Portuguese, Indonesian, Arabic...) as downloadable meme packs; voices need a decision (bundled eSpeak has only en and hi; more voices cost MB, so either download on demand, or use pre-recorded clips in the packs).
- English user (2026-10-07, "Too hard to use"): already answered from 1.2.3 on (Start here card, mute badge, reload button); check again with the new panel layout.

## How a release works
- Deploying the site (`wrangler pages deploy`) changes only the website and its server: installed extensions do not change. The site stays compatible with the old extension (same /api/license).
- Installed extensions change only when a new version is published in the Chrome Web Store (Chrome then updates people by itself, usually within hours). Order: 1) test the site and the extension locally, 2) deploy the site, 3) publish the extension (use the Web Store's staged / trusted-testers option first if you want a trial run).
