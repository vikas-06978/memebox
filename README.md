# MemeBox – Meme Soundboard & Voice Changer for Calls

MemeBox plays meme lines, clips and sound effects **into your microphone** during browser video calls, so everyone in the call hears them. Only you need the extension.

It works in the browser versions of Google Meet, Zoom (web client), Microsoft Teams and Discord.

> 🚧 Being built in steps. See [CHANGELOG.md](CHANGELOG.md) for what's done.

## Project layout

| Path | What it is |
|---|---|
| `extension/` | Chrome extension (Manifest V3, plain JavaScript). Load this folder unpacked. |
| `extension/config.js` | `SITE_URL` (fill in after deploying the site) and `PRO_ENABLED = false` |
| `site/` | Static website for Cloudflare Pages |
| `site/functions/` | Cloudflare Pages Functions, the site's small API (feedback, admin) |
| `tests/` | Automated tests |
| `tools/` | Maintenance scripts (bundling eSpeak, drawing icons) |

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

## Build and zip for the store

```sh
npm run build    # -> extension/dist (clean copy + LICENSE + notices)
npm run zip      # -> memebox-<version>.zip, with manifest.json at the zip root
```

CI (`.github/workflows/ci.yml`) runs everything on each push:
1. unit tests;
2. end-to-end tests;
3. build and zip;
4. end-to-end tests again, on the unzipped zip.

It uploads the zip as the **memebox-extension** build artifact.

## Step 1 – test by hand (the mic hook)

1. Load `extension/` as above, then open a **new** Google Meet tab and join a meeting.
2. Join the same meeting on your phone, **mute the phone**, and turn its volume up.
3. On the laptop, unmute in Meet and wait until the dot on 😂 is **green**.
4. Open the panel with **☰** (or right-click 😂) and click **🔔 Mic test**. The phone plays a "ding-dong".
5. Press F12 → Console and filter for `[MemeBox]`. You should see `hook installed`, `mic intercepted` and `playing into mic: (test beep)`.
6. Mute in Meet and press 🔔 again. The phone hears nothing.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
