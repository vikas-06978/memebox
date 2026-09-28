# MemeBox: Meme Soundboard & Voice Changer for Calls

MemeBox plays meme lines, clips and sound effects **into your microphone** during browser video calls, so everyone in the call hears them. Only you need the extension.

It works in the browser versions of Google Meet, Zoom (web client), Microsoft Teams and Discord.

Version 1.0.0. See [CHANGELOG.md](CHANGELOG.md) for what's in it, and [STORE.md](STORE.md) for the store listing and publishing checklists.

**Before you publish, fill in these placeholders:**
- `extension/config.js`: `SITE_URL` (your Cloudflare Pages address) and, after approval, `STORE_URL`.
- `site/public/index.html`: the install button (`id="install"`) points to GitHub releases until the store address exists.
- `site/public/privacy.html`, `terms.html`, `index.html` and `PRIVACY.md`: the contact email `hello@example.com`.
- `site/public/sitemap.xml` and `robots.txt`: the site address, if it isn't `memebox.pages.dev`.
- `site/public/assets/demo.png`: a screenshot for now. Swap in a short demo GIF when you have one.

## Project layout

| Path | What it is |
|---|---|
| `extension/` | Chrome extension (Manifest V3, plain JavaScript). Load this folder unpacked. |
| `extension/config.js` | `SITE_URL` (fill in after deploying the site) and `PRO_ENABLED = false` |
| `extension/config.js` | Also `STORE_URL`, the store page "Rate us" opens (fill in after publishing) |
| `site/public/` | Static website for Cloudflare Pages (landing, feedback, uninstall survey, privacy) |
| `site/functions/` | Cloudflare Pages Functions, the site's small API (feedback, admin) |
| `site/src/` | Code shared by the functions (validation, rate limit, admin) |
| `site/db/schema.sql` | The D1 database tables |
| `store/` | Store screenshots, promo tile and the Edge logo |
| `tests/` | Automated tests |
| `tools/` | Maintenance scripts (bundling eSpeak, drawing icons, running the site locally) |

## Load the extension (developer mode)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and pick the **`extension/`** folder.
4. After you change a file, click ⟳ on the MemeBox card, then **close and reopen** the call tab.

If you loaded the old "Meme Button" build from the project root, remove it first. Its folder moved to `extension/`.

## Run the tests

```sh
npm ci                                  # once
npx playwright install chromium         # once
npm test                                # unit tests (node --test)
npm run test:e2e                        # Playwright: real extension on a fake call page
```

The end-to-end tests load the extension into Chromium with a fake microphone and serve a fake call page at `https://meet.google.com/…`. They call `getUserMedia` and measure the volume of the returned stream. Set `MEMEBOX_EXT=<folder>` to test another build, such as the unzipped store package.

The site tests start the real Pages Functions locally against SQLite (a stand-in for D1), with a fake Turnstile, so they need no Cloudflare account and no network.

## Run the site locally

```sh
cp site/.dev.vars.example site/.dev.vars   # once, then change ADMIN_KEY
npm run site:dev                           # http://127.0.0.1:8788
```

Open `/feedback?v=1.0.0&site=meet`, `/uninstall` and `/admin`. The example file uses Cloudflare's Turnstile test keys, which always pass. Local answers are saved in `site/.wrangler/dev.sqlite`.

## Deploy the site (Cloudflare Pages + D1)

You need a free Cloudflare account. Run these from the `site/` folder.

1. Sign in: `npx wrangler login`
2. Create the database: `npx wrangler d1 create memebox-feedback`. Copy the `database_id` it prints into `site/wrangler.toml`.
3. Create the tables: `npx wrangler d1 execute memebox-feedback --remote --file=db/schema.sql`
4. Create the Pages project and first deploy: `npx wrangler pages deploy`. It prints your address, for example `https://memebox.pages.dev`.
5. Turnstile: in the Cloudflare dashboard go to **Turnstile → Add widget**. Add your pages.dev address as the hostname and pick **Invisible**. Keep the site key and secret key.
6. Add the secrets. Each command asks for the value:
   ```sh
   npx wrangler pages secret put TURNSTILE_SITE_KEY
   npx wrangler pages secret put TURNSTILE_SECRET_KEY
   npx wrangler pages secret put ADMIN_KEY     # a long random password for /admin
   npx wrangler pages secret put RATE_SALT     # optional, another long random string
   ```
7. Deploy again so the secrets are used: `npx wrangler pages deploy`
8. Put your address in `extension/config.js` as `SITE_URL` (no slash at the end).

The D1 binding is named `DB` in `wrangler.toml`. If you use the dashboard instead, go to **Pages → memebox → Settings → Bindings**, add a D1 binding called `DB` pointing to `memebox-feedback`, and add the same secrets as encrypted variables.

## Pro, license keys and UPI payments

**Right now Pro is switched off.** `extension/config.js` has `PRO_ENABLED = false`, so every feature is free for everyone. Everything below is built and tested, ready for the day you switch it on.

### What is Pro

Each Pro feature is marked in the code with `// PRO:` next to a `MemePlan.can(...)` check (`extension/lib/plan.js`):

| Pro feature | Free plan keeps | Where |
| --- | --- | --- |
| Picture memes | 1 picture (plus any bought picture slots) | `options.js` (save line) |
| Import many audio files at once | one file at a time | `options.js` (bulk import) |
| Live voice changer | normal voice | `ui.js` (setVoice) |
| Captions and pictures on my camera | captions on your own screen | `ui.js`, `bridge.js` |
| Unlimited clips | 10 clips | `options.js` |
| All packs | General and College | `options.js` |
| Party mode / timed lines | playing by hand | `options.js`, `ui.js` |

Prices are in `site/src/shop.js`: **5 more pictures for ₹29** and **Pro (lifetime, everything) for ₹99**. Change them there and deploy again.

### How buying works (UPI straight to your bank)

1. The buyer clicks **⭐ Buy Pro or more pictures** in Options. `SITE_URL/buy` opens.
2. They pick a product. The page shows a **UPI QR code** with the amount and a note like `MemeBox MB7K2P9QXR4T`, plus a **Pay with UPI app** button for phones.
3. They pay in GPay, PhonePe, Paytm or BHIM. The money goes straight to your UPI ID.
4. They type the 12-digit **UPI transaction ID (UTR)** and press **I've paid**.
5. You open **`/admin`**. Under **Payments waiting for you** you see the amount, the UTR and the note. Check your bank or UPI app. If the money is there, press **Approve**. If not, press **Reject**.
6. The buyer's page shows their license key. They paste it in Options → **MemeBox Pro** → **Activate**.

The extension re-checks the key with your site once a day. If you press **Turn off** on a key in `/admin`, it stops working at the next check. Offline, a key keeps working for up to 30 days.

### You control who gets Pro

In `/admin` → **License keys**:
- **Me (owner)** + **Pro, unlimited** → **Make a key**: your own free key. Paste it into your MemeBox.
- **A friend (gift)**: free keys for friends, either unlimited or a number of picture slots.
- **Turn off / Turn on** any key, for example a key someone shared publicly.

### Your UPI ID

`site/wrangler.toml` has `UPI_ID = "memebox@upi"`, a **placeholder**. Put your real UPI ID there (and `UPI_NAME`, the name buyers see), then deploy again. For many small payments, a free **UPI merchant ID** (PhonePe Business, Paytm for Business or BharatPe) is better than a personal one. It still pays into your main bank account.

### Switching Pro on

1. Deploy the site and make your owner key (above).
2. In `extension/config.js`, set `PRO_ENABLED: true`.
3. Build, zip and publish the update. Free users keep the free plan. Anyone with a key gets what their key gives.

**Good to know:** the extension is open source (GPL), so a technical person could edit their own copy to unlock features. Most people won't. The license check keeps honest users honest, and your server decides every key.
## Build and zip for the store

```sh
npm run build    # -> extension/dist (clean copy + LICENSE + notices)
npm run zip      # -> memebox-<version>.zip, with manifest.json at the zip root
```

CI (`.github/workflows/ci.yml`) runs everything on each push:
1. unit tests
2. end-to-end tests
3. build and zip
4. end-to-end tests again, on the unzipped zip.

It uploads the zip as the **memebox-extension** build artifact.

## Store images

```sh
npm run store-images   # store/screenshot-*.png (1280x800) and store/promo-440x280.png
npm run icons          # extension/icons/*.png and store/icon-300.png (Edge logo)
```

The screenshots are taken from the real extension on a mock call page (coloured tiles, no people or logos).

## Release

1. `npm run version:set -- 1.2.3` sets the version in `package.json` and the manifest.
2. Add a `## [1.2.3]` section to CHANGELOG.md.
3. Run the tests, then `npm run build` and `npm run zip`.
4. Commit, then `git tag v1.2.3` and `git push origin main --tags`.
5. Upload `memebox-1.2.3.zip` to the stores (see STORE.md).

## Step 1: test by hand (the mic hook)

1. Load `extension/` as above, then open a **new** Google Meet tab and join a meeting.
2. Join the same meeting on your phone, **mute the phone**, and turn its volume up.
3. On the laptop, unmute in Meet and wait until the dot on 😂 is **green**.
4. Open the panel with **☰** (or right-click 😂) and click **🔔 Mic test**. The phone plays a "ding-dong".
5. Press F12 → Console and filter for `[MemeBox]`. You should see `hook installed`, `mic intercepted` and `playing into mic: (test beep)`.
6. Mute in Meet and press 🔔 again. The phone hears nothing.

## Step 5: test by hand (tab audio and voice changer)

Use the same laptop and muted phone as in Step 1. Reload the extension, then reload the Meet tab.

**Tab audio**
1. In another tab, play a YouTube video.
2. Click the MemeBox toolbar icon → **Send this tab's sound to my call**. The phone hears the video, and you still hear it on the laptop.
3. Move **Volume in the call** in the popup, or the 🔉 slider in the 😂 panel. The phone gets louder or quieter, but your own copy doesn't change.
4. Click **⏹ Stop** (in the popup or the panel). The phone goes quiet.

**Voice changer**
1. Talk, then press **Alt+V**. The phone hears you as a chipmunk.
2. Press **Alt+V** again, and your normal voice is back straight away.
3. In the panel, try **🎤 My voice**: Deep, Robot, Echo and Radio. Memes still play on top.

**Captions on my camera**
1. In the panel, tick **📷 Caption on my camera**, then turn your camera off and on in Meet.
2. Play a meme. The phone shows the meme text on your video for 3 seconds. Your own preview may show it mirrored.

**Sharing**
1. In Options, click **💾 WAV** on a line. A .wav file is saved.
2. Click **WhatsApp** on a line. WhatsApp opens with the text filled in, and you choose the chat.

## Step 6: test by hand (feedback system)

**Locally, no Cloudflare needed**
1. Run `npm run site:dev` (see "Run the site locally").
2. Open `http://127.0.0.1:8788/feedback?v=0.6.0&site=meet`. Pick a face, tick a few features, write something and press **Send feedback**. You see "Thank you!".
3. Open `http://127.0.0.1:8788/uninstall?v=0.6.0`, pick a reason and press **Send**.
4. Open `http://127.0.0.1:8788/admin`. A wrong key is refused. Sign in with the `ADMIN_KEY` from `.dev.vars`. You see the rating totals, top requests and both messages. **Download CSV** saves a file.
5. Send the feedback form 6 times quickly. The 6th says "Too many messages".

**In the extension**
1. In Options, click **💬 Send feedback**. A tab opens at `SITE_URL/feedback?v=0.6.0`.
2. In a call, open the panel and click **💬**. The link also has `&site=meet`.
3. Play 10 memes. After the 10th, a small "Enjoying MemeBox?" card appears once. It never comes back.
4. Remove the extension from `chrome://extensions`. A tab opens at `SITE_URL/uninstall?v=0.6.0`. Load it again afterwards.

Steps 1 and 4 only show a working page after the site is deployed and `SITE_URL` is filled in.

## Step 8: test by hand (store readiness)

1. Remove MemeBox, then load `extension/` again. The **welcome page** opens by itself. Click **🎙 Start mic test** and talk: it says "We hear you". Click **🔊 Hear a meme**.
2. Open a Meet tab, then reload the extension at `chrome://extensions`. Without reloading the Meet tab, click the MemeBox toolbar icon on it. It says to reload the tab.
3. At `chrome://extensions`, open MemeBox **Details**. Site access lists only the 5 call sites.
4. Run `npm run site:dev` and open `http://127.0.0.1:8788/`. Check the landing page on a phone-sized window too (F12, device toolbar). Open `/terms` and `/privacy`.
5. Look through `store/` and check the images.

## License and credits

MemeBox is free software under the GNU General Public License, version 3 or later (GPL-3.0-or-later). See [LICENSE](LICENSE).

Credits:
- **eSpeak-NG** speech synthesizer (GPL-3.0-or-later) by Jonathan Duddington, Reece H. Dunn and the eSpeak-NG contributors, built for WebAssembly by the Echogarden project. Details in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- The icon, meme lines, packs, pictures and all other code are original work for MemeBox.
