# MemeBox: Meme Soundboard & Voice Changer for Calls

MemeBox plays meme lines, clips and sound effects **into your microphone** during browser video calls, so everyone in the call hears them. Only you need the extension.

It works in the browser versions of Google Meet, Zoom (web client), Microsoft Teams and Discord.

> 🚧 Being built in steps. See [CHANGELOG.md](CHANGELOG.md) for what's done.

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

## License

GPL-3.0-or-later. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
