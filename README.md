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

## License

GPL-3.0-or-later. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
