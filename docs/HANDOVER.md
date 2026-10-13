# MemeBox handover (2026-10-13)

Everything needed to continue the work with any developer or assistant. No secrets are written here: they live in Cloudflare.

## What it is
- **Chrome extension** (`extension/`, Manifest V3): a soundboard and camera lights for calls (Google Meet, Zoom / Teams in the browser, Discord). Memes (26 languages, offline voices), lights and filters, 14 animated characters, music tunes, own clips, packs, Phonk Mode.
- **Site** (`site/`, Cloudflare Pages + Functions): landing, pricing, buy, feedback / uninstall pages, admin, and the APIs the extension calls.
- **Database**: Cloudflare D1 `memebox-feedback`. **File storage**: Cloudflare R2 bucket `memebox-packs`.

## Branches
- `claude/affectionate-brown-4sabry`: the current work (version 1.3.0). Merge this into `main` with a normal PR when releasing.
- `release/1.2.7`: obsolete (an early partial update). Do not merge.

## Run and test
- `npm install`, then `npm test` style commands: unit `node --test "tests/unit/**/*.test.mjs"`, browser `npx playwright test tests/e2e/<file>`.
- Local site: `npm run site:dev`. Build the extension zip: `npm run build && npm run zip` (writes `memebox-<version>.zip`).
- `npm run sync-fx` after editing `extension/lib/fx.js` or `music.js` (they have generated copies).
- Preview characters and lights: `node tools/fx-sheet.mjs out.png "<section>"`.

## Cloudflare setup
- Pages project `memebox`; D1 binding `DB`; R2 binding `PACKS` (both in `site/wrangler.toml`).
- Secrets / variables (Settings → Variables and Secrets): `ADMIN_KEY` (admin password), `UPI_ID` (opens /buy; remove to close payments), optional `UPI_NAME`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `RATE_SALT`.
- Switches: `PHONK_MODE=off` turns Phonk Mode off for everybody at once; `PACK_DAILY_LIMIT` (files per person per day, default 50), `PACK_DAILY_MB` (MB per person per day, default 300), `PACKS_MAX_MB` (bucket budget, default 5000).
- D1 scripts, in this order: `site/db/migrations/2026-10-platform-device.sql`, `2026-10-time-pass.sql`, `2026-10-characters.sql`, `2026-10-packs.sql`, `2026-10-packs-v2.sql` (an "already exists" error means it ran before).
- Deploy: in `site/`, `npx wrangler pages deploy --branch=main`.
- Recommended: protect `/admin` with Cloudflare Access (email login) as a second lock.

## Plans and prices (`site/src/shop.js`, `extension/lib/plan.js`, `extension/lib/fx.js`)
- Free: Cat and Dog, one still lamp (3 colours), 3 filters, 2 tunes, free packs, own clips, soundboard.
- Pro (hourly pass, no expiry, only counts in a call): lights, voice changer, captions, Follow me, 6 characters, 8 filters, 7 tunes, Pro pack items.
- Pro Max: everything: 14 characters (4 only here: Unicorn, Robot, Snake, Bird), 20 filters, 13 tunes, all packs.
- Passes: Pro 30 min / 1 h / 2 h / 5 h = Rs 9 / 15 / 25 / 49 ($1.49 / 2.49 / 3.99 / 7.99). Pro Max 1 h / 3 h / 8 h = Rs 25 / 49 / 99 ($3.49 / 6.49 / 14.99).
- Characters for sale (kept for ever): Bunny, Panda, Owl, Fox Rs 29 ($0.99); Penguin, Lion, Monkey, Frog Rs 39 ($1.49); all 8 Rs 199 ($4.99). An owned character still needs a running pass for Follow me, gestures and tears.
- `SHOP_OPEN` in `extension/config.js`: `false` hides everything paid (no locks, no prices); `true` shows locks and Buy buttons. Existing key holders and the owner key always keep everything.
- Payments today: manual UPI (the buyer pays, enters the UTR, the admin checks the bank and approves). Dollar payments are not open yet.

## Packs and Phonk Mode
- Admin: `/admin/packs`. Types: Music, Memes, Pictures (files in R2) and Phonk Mode (YouTube links only, nothing hosted). Each item can be Free, Pro or Pro Max on its own.
- Only upload what you own or have written permission for. YouTube links: official uploads that allow embedding.
- Content ready to paste: `docs/pack-content/*.txt`.

## Security notes
- Prices and entitlements are decided on the server. The extension only asks.
- Keep the owner key private (turn it off in admin and make a new one if it leaks). Make the GitHub repo private before release.
- Cost caps exist for packs (see switches). Webhooks (Razorpay) must verify signatures.

## Next steps (in order)
1. Link `memebox.site` to the Pages project (Custom domains), check it opens, then set `SITE_URL` in `extension/config.js` and the site address in the SEO tool (`npm run seo` reads it), run all tests, deploy the site.
2. Finish the app: outfits for characters, original phonk loops, more interface languages, the regional meme packs uploaded.
3. Razorpay: account, test mode, signed webhooks, automatic keys, refunds, dollar payments, admin view.
4. Release: version number, minified build without tests and tools, store listing text, screenshots, tutorial video, privacy answers, reviewer test key, trusted testers first.
5. After launch: server-signed pass sessions, monthly plans if wanted, gift keys, seasonal drops.

## Limits to remember
- No test has been done on a real Meet call yet; the face and hand tracking speed on weak laptops is unknown.
- The offline voices are robotic by nature; browser speech cannot be routed into the call.
