# Order of work (agreed 2026-10-13)
1. Finish the app and the site (all features, characters, packs and content, more languages).
2. Buy the domain and put it in `extension/config.js` (SITE_URL) and the site before the first public release.
3. Razorpay: account, test mode, signed webhooks, automatic keys, refunds, dollar payments; then launch to everyone.
Done 2026-10-13: plan ladder (passes 5 h / 8 h, Pro Max-only characters incl. Snake and Bird, filters 3 / 8 / 20, tunes 2 / 7 / 13), pack content files in `docs/pack-content/` (India and Global memes, India and Global dialogues; paste into /admin/packs → Add text memes).

# Launch plan (Wednesday 2026-10-14)

## Already built (in branch claude/affectionate-brown-4sabry, version 1.3.0)
- Panel (4 pages), 26 meme languages with voices, the regional language rule, the How-to-use card, free-only mode (`SHOP_OPEN: false`).
- Lights, characters, tunes, filters, 12 more sounds, Phonk Mode (YouTube links, kill switch `PHONK_MODE=off`), online packs with per-item plans, picture packs, cost caps, admin dashboard, feedback pages.

## Must do for launch day
Me:
1. Plan ladder in code and on the pricing page: characters 2 / 6 / 12, filters 3 / 8 / 15, tunes 2 / 7 / 13, packs 10 / 25 / 50 per plan; Phonk Mode free.
2. Open the shop: `SHOP_OPEN: true`, buy page tested end to end with UPI (order, UTR, approve, key, pass time), clear wording and a refund / support note on /buy, terms and privacy updated (payments, YouTube player and its cookies, packs).
3. Regional meme packs: India (Hinglish, Hindi, regional languages, strong language flagged 18+) and Global (English), plus original "dialogue" lines (our own, never film quotes) for college, office, cricket, festivals-free fun, travel, food.
4. Release build: version 2.0.0 (or keep 1.3.0 if you prefer), remove tests and tools, minify, store listing text, screenshots list, privacy answers, permission explanations.
5. Real-call fixes from your testing.
You:
1. Deploy the site and run all D1 scripts; R2 bucket `memebox-packs`; secrets ADMIN_KEY, UPI_ID (and PACK_DAILY_* / PACKS_MAX_MB if you want other numbers).
2. Upload packs at /admin/packs (only what you own or have written permission for); YouTube links only from official channels.
3. Test on a real Google Meet call (and Zoom / Teams in the browser if you can), on a normal laptop.
4. Record or approve the tutorial video; upload the zip and the listing to the Web Store (trusted testers first if you like).

## Should do (if time allows)
- Original phonk loops (10 free, 15 Pro, 25 Pro Max) made with the music engine.
- Character outfits as one-time buys (Rs 29-49).
- Server-signed pass sessions (anti-cheat), rate limits on /api/license and /api/order.

## After launch
- Razorpay (UPI and cards, automatic keys), monthly plans, gift keys, seasonal drops, creator plan, model download-on-demand, more UI languages, `.site` domain.

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
- Owner key (MBX-294K-D9VF-9BF6): keep it private; it is unlimited, so rotate it if it ever leaks. Our own account is the main (owner) user of the system.

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
