# Prompt for Codex (copy everything below the line)

---

You are continuing work on **MemeBox**, a product I (the owner) have been building with another AI assistant. Read `docs/HANDOVER.md`, `PENDING.md` and `CHANGELOG.md` in the repo first, then follow this brief.

## Repo and branches
- GitHub repo `vikas-06978/memebox` (currently public; I will make it private before release).
- Work on branch `claude/affectionate-brown-4sabry` (version 1.3.0, latest work). `main` is behind it. Branch `release/1.2.7` is obsolete: never merge it.
- Commit small and clear. Never push secrets. Do not open a pull request unless I ask.

## The product
- A **Chrome extension (Manifest V3)** for video calls (Google Meet, Zoom / Teams in the browser, Discord). It plays memes (text lines spoken by offline eSpeak-NG voices, my own clips, sound effects, music) into the call through the microphone path, and it adds camera effects: lamp and corner lights, filters, 14 animated characters that react to sounds and to my face, and music that the lights follow. Panel has 4 pages (Memes, Music, Lights, Sound) and a "How to use" card.
- 26 meme languages with bundled offline voices (UI texts in 12 languages: en, hi, bn, mr, ta, te, gu, es, ar, pt_BR, fr, id). A regional language picked in Options shows built-in lines in that language only.
- A **site** on Cloudflare Pages + Functions (`site/`), D1 database `memebox-feedback`, R2 bucket `memebox-packs`. Pages: landing (many languages, SEO), pricing, buy (manual UPI), feedback and uninstall pages, `/admin` dashboard (payments, keys, activity, feedback, packs), `/phonk` (Phonk Mode: YouTube's own embedded player, tracks added as links).
- Key files: `extension/lib/fx.js` (lights, filters, characters; edit this, then run `npm run sync-fx` because `lib/fx-ui.js` is generated), `extension/lib/music.js`, `extension/lib/plan.js` (what each plan can use), `extension/ui.js`, `extension/lights-ui.js`, `extension/music-section.js`, `extension/options.js`, `extension/online-packs.js`, `extension/background.js`, `site/src/shop.js` (products and prices), `site/src/packs.js`, `site/src/admin.js`, `site/functions/**`, `tools/seo.mjs`.

## Plans and prices (already implemented; do not change without asking me)
- **Free:** Cat and Dog, one still lamp with 3 colours, 3 filters, 2 tunes, soundboard, free pack items, own clips.
- **Pro (hourly pass, no expiry, runs only in a call):** all lights, voice changer, camera captions, Follow me and gestures, 6 characters (Cat, Dog, Bunny, Panda, Owl, Fox), 8 filters, 7 tunes, Pro pack items.
- **Pro Max:** everything: 14 characters (Unicorn, Robot, Snake, Bird are Pro Max only and never sold), 20 filters, 13 tunes, all packs.
- Passes: Pro 30 min / 1 h / 2 h / 5 h = Rs 9 / 15 / 25 / 49 ($1.49 / 2.49 / 3.99 / 7.99). Pro Max 1 h / 3 h / 8 h = Rs 25 / 49 / 99 ($3.49 / 6.49 / 14.99). Pro Max must always cost more per hour than Pro in both currencies.
- Characters for sale, kept for ever: Bunny, Panda, Owl, Fox Rs 29 ($0.99); Penguin, Lion, Monkey, Frog Rs 39 ($1.49); all 8 Rs 199 ($4.99). An owned character still needs a running pass for Follow me, gestures and tears.
- Existing key holders and the owner key keep everything. `SHOP_OPEN` in `extension/config.js` is `false` (paid things hidden); set it to `true` at launch.

## Hard rules
1. **No new extension permissions or host permissions** in `manifest.json` (a new permission disables the extension for existing users until they accept). Optional permissions requested at runtime are allowed.
2. **Prices, plans and entitlements are decided on the server.** The extension only asks.
3. **Copyright:** upload or host only what I own or have written permission for. Never add downloaded songs, film dialogue or well-known copyrighted characters. YouTube links only from official uploads that allow embedding (Phonk Mode). Draw only original characters.
4. Payments today are manual UPI: the admin must check the bank statement before approving. Never auto-approve.
5. Keep the cost caps (50 files and 300 MB per person per day, 5000 MB bucket budget, 300 MB of packs per browser) and the `PHONK_MODE=off` kill switch.
6. Secrets only in Cloudflare (`ADMIN_KEY`, `UPI_ID`, Turnstile keys, later Razorpay keys). Never write the owner license key or any secret into the repo or tests.
7. Keep the admin CSP strict: only `/assets/admin.js` may run on the dashboard; no inline scripts or styles.
8. Do not bump the extension version, build the final store zip or make store listing/video unless I say so.
9. Be honest about limits: nothing has been tested on a real Meet call yet; speed of face and hand tracking on weak laptops is unknown.

## How to work
- Run `node --test "tests/unit/**/*.test.mjs"` (currently 165 pass) and the relevant Playwright files (`npx playwright test tests/e2e/<file>`; some are flaky under load, rerun alone). One test, "Options sends feedback to the site", fails in a sandbox without internet; that is expected.
- After editing `fx.js` or `music.js` run `npm run sync-fx`; after changing site pages or prices run `npm run seo`.
- Check visual changes with `node tools/fx-sheet.mjs out.png "<section>"` or Playwright screenshots.
- Build a test zip with `npm run build && npm run zip`.
- I read Hinglish and prefer short, plain English answers with clear steps. Explain what you did and what I must do myself.

## State right now (2026-10-13)
- Done: panel, languages, lights, filters, 14 characters, tunes, packs with per-item plans and picture packs, Phonk Mode, online packs screen, admin dashboard (interactive), feedback pages, cost caps, plan ladder, pack content files in `docs/pack-content/`.
- I bought the domain **memebox.site** but have not linked it yet. Order of work: (1) I link it in Cloudflare Pages (Custom domains); (2) you set `SITE_URL` in `extension/config.js` to `https://memebox.site`, run `npm run seo`, update tests that mention `memebox.pages.dev`, keep `memebox.pages.dev` working for old versions; (3) finish the app; (4) Razorpay; (5) release.

## Your tasks, in order
1. **Domain switch** (only after I confirm `https://memebox.site` opens): config, SEO/sitemap, tests, docs.
2. **Finish the app:** character outfits as one-time buys (Rs 29-49, not hourly); original phonk-style loops made with the music engine (10 Free, 15 Pro, 25 Pro Max); more interface languages (I will name the top 5); regional meme packs (India, Global, dialogues) are ready to paste from `docs/pack-content/`.
3. **Razorpay** (I will give test keys): Orders API, checkout (UPI, cards, netbanking; international cards for dollar prices), signed webhook endpoint that verifies the HMAC, idempotent per payment id, creates or tops up the license key automatically, refund handling (revoke / reduce), admin view of payments, daily reconcile helper, tests. Keep manual UPI as a fallback behind a flag.
4. **Security and release prep:** server-signed pass sessions (anti-cheat), rate limits on `/api/license` and `/api/order`, Cloudflare Access in front of `/admin`, release build (minified, no tests or tools in the zip), store listing text in English, privacy and terms updates (Razorpay, YouTube player cookies, packs), reviewer test key and steps.
5. **After launch:** monthly plans (no yearly), gift keys, seasonal drops, creator plan.

Start by reading the three docs, running the tests, and telling me in 10 lines what you understood and what you will do first.
