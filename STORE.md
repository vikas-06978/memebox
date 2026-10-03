# Store listing (Chrome Web Store and Microsoft Edge Add-ons)

Everything you need to paste into the store forms, plus the publishing checklists at the end.

## Name

MemeBox: Meme Soundboard & Voice Changer for Calls

(From `_locales/en/messages.json` → `extName`. 50 characters, the limit is 75. No platform names or logos in the name or icon.)

## Short description (132 characters max)

> Meme soundboard & voice changer for calls: play meme sounds and sound effects into your mic on Google Meet, Zoom, Teams, Discord.

(129 characters. It's the manifest `description`, from `extDesc`. The Hindi listing uses the Hindi `extDesc`.)

## Category

- Chrome Web Store: **Lifestyle → Just for Fun**. Second choice: **Productivity → Communication**.
- Edge Add-ons: **Entertainment**.

Language: English. The package has 12 languages (en, hi, bn, mr, ta, te, gu, es, ar, pt_BR, fr, id). The stores show the translated name and short description from `_locales` automatically. For the full description, add listing languages as you like, starting with Hindi.

## Full description

(The store field is plain text. Copy from the raw file, not the rendered page, and leave out the `**` marks. Each call service is named once, in a sentence: a repeated list of platform names was rejected as keyword spam, "Yellow Argon".)

Make every video call a little more fun. 😂

MemeBox is a meme soundboard and voice changer for your calls. Click the floating 😂 button and meme sounds, funny lines and sound effects play **through your microphone**, so everyone in the call hears them. The other people don't need to install anything.

**Where it works**
In Chrome or Edge, on the web versions of Google Meet, Zoom, Microsoft Teams and Discord.

**Free features**
• One click plays a random meme. Right-click the button for the full panel: search, categories, favourites, recently played, Random and Stop all.
• Hindi, Hinglish and English meme lines, spoken by a voice engine that runs on your own computer.
• Six tones: Normal, Chipmunk, Villain, Robot, Slow-mo and Excited.
• A big meme caption appears on your screen for 3 seconds.
• Keyboard shortcuts: Alt+1 to Alt+9 for favourites, Alt+0 to stop, Alt+M to hide. They're ignored while you type.
• Auto-duck lowers the meme sounds while you're talking.
• Your own sound effects: upload audio or video files (only the sound is kept), use a direct file link, or record yourself for up to 10 seconds. Trim with the waveform editor. Up to 10 saved clips.
• The College pack of friendly roasts. Share your own packs as a file.
• Send any tab's sound into the call. Start a YouTube video at the funny moment, click the MemeBox icon on that tab, and everyone hears it. Nothing is downloaded.
• One picture meme: give a line a picture (a monkey, a reaction face, anything) and it flashes on your screen while the line plays.
• Save any meme as a WAV file, or share its text on WhatsApp (you pick the chat).

**MemeBox Pro (optional, paid)**
Pro is a one-time purchase on the MemeBox website, paid by UPI. You get a license key and paste it into MemeBox Options. Pro unlocks:
• Live voice changer for your own voice: Chipmunk, Deep, Robot, Echo or Radio. Alt+V switches it on and off.
• Meme captions and pictures on your own camera.
• Unlimited saved clips, and importing many audio files at once.
• The Cricket, Office and Party packs.
• Party mode: a line at a set time or every few minutes.
• Unlimited picture memes. Extra picture memes can also be bought on their own, without Pro.
Everything in the free list keeps working without paying.

**Private by design**
Your microphone, camera and tab audio are only mixed inside your browser. They are never recorded, saved or uploaded. No accounts, no ads, no analytics. If you enter a Pro license key, only that key is sent to the MemeBox website to check it, about once a day.

**Good to know**
• Memes are silent while you're muted in the call. That's on purpose.
• Desktop call apps aren't supported. Join your call in the browser instead.
• After installing or updating, reload an open call tab once.
• Keep it friendly and follow the rules of your class or workplace.

MemeBox is open source (GPL-3.0-or-later): https://github.com/vikas-06978/memebox. It uses the eSpeak-NG speech synthesizer. MemeBox is an independent project and isn't affiliated with any of the call services it works on.

## Single purpose

MemeBox is a soundboard for browser video calls. It plays meme lines, sound effects and the user's own clips into the user's outgoing microphone on supported call websites. The voice changer, tab audio and camera captions are part of the same purpose: changing what the user sends into their own call.

## Permission justifications

**storage**
Saves the user's lines, favourite shortcuts, volumes and settings, the button position, and the play count for a one-time feedback question. Stored on the device with chrome.storage.local. Uploaded clips are kept in the extension's IndexedDB. Nothing is synced or sent anywhere.

**offscreen**
Creates an offscreen document (reason: WORKERS) that runs the bundled eSpeak-NG text-to-speech engine, compiled to WebAssembly, in a Web Worker. It turns meme text into audio. A service worker can't run it, and running it in the call page would slow the call down.

**tabCapture**
Used only when the user opens the toolbar popup on a tab (for example a YouTube video) and clicks "Send this tab's sound to my call". The extension gets a stream ID for that tab (chrome.tabCapture.getMediaStreamId, with the user's call tab as the consumer). The call tab mixes that audio live into the outgoing microphone and plays it back to the user. Nothing is recorded, saved, downloaded or transmitted. It stops when the user presses Stop or closes either tab.

**Host permissions: https://meet.google.com/\*, https://app.zoom.us/wc/\*, https://teams.microsoft.com/\*, https://teams.live.com/\*, https://discord.com/\***
Only the 5 call websites MemeBox works on: meet.google.com, app.zoom.us/wc, teams.microsoft.com, teams.live.com and discord.com. There the extension:
1. Wraps getUserMedia so the microphone the site receives is the real microphone mixed with the meme audio the user plays.
2. Shows the floating 😂 button, panel and captions.
3. Only if the user turns them on: applies the voice changer to the user's own microphone and draws meme captions on the user's own camera.
4. In the popup, checks whether the current tab is one of these sites, to say "reload this tab" after install or update.
Audio and video are processed only locally with Web Audio and Canvas. They are never recorded, stored or sent anywhere. No other sites are accessed.

**Remote code**
No. All code is in the package. eSpeak-NG's WebAssembly is bundled and needs `'wasm-unsafe-eval'` in the extension-page CSP. Nothing is downloaded or evaluated at runtime.

**Content Security Policy**
`script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`. This allows only the bundled WebAssembly speech engine.

## Test instructions (Test instructions tab)

Reviewers need to try the Pro features, so give them a working key. Make a Pro key in `/admin` on the site (it's free to make there), and keep it active until the review is done.

- **Username:** leave empty (MemeBox has no accounts).
- **Password:** leave empty.
- **Additional instructions:**

> 1. Open a Google Meet call in the browser (meet.new works with any Google account). The 😂 button appears in the bottom corner. Click it to play a meme through your microphone. Right-click it for the full panel.
> 2. Free features work without a key. To test MemeBox Pro (voice changer, camera captions, extra packs, party mode, unlimited clips and pictures): open Options (⚙️ in the panel, or right-click the toolbar icon → Options), go to "MemeBox Pro", paste the key MBX-XXXX-XXXX-XXXX and press Activate.
> 3. Tab audio: open a YouTube video in another tab, click the MemeBox toolbar icon there and press "Send this tab's sound to my call".
> 4. Pro is sold on https://memebox.pages.dev/buy as a one-time UPI payment. The key is checked with https://memebox.pages.dev/api/license. Apart from audio links the user adds themselves, MemeBox makes no other network requests.

## Data usage (Privacy practices tab)

- **Data types:** tick only **Authentication information**. That's the MemeBox license key a user may type in Options: it is sent to the MemeBox site only to check it (about once a day). Leave every other data type unticked.
  - Microphone, camera and tab audio are processed only in the tab and are never collected or sent.
  - Lines, clips and settings are stored only on the device.
  - The extension opens the feedback page with only the extension version and the call site name (for example `?v=1.0.0&site=meet`), and the uninstall survey with only the version. People may choose to type an answer there. That is covered by the website's privacy policy.
- Tick all three certifications:
  - I do not sell or transfer user data to third parties, outside of the approved use cases.
  - I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
  - I do not use or transfer user data to determine creditworthiness or for lending purposes.
- **Privacy policy URL:** `https://memebox.pages.dev/privacy` (your `SITE_URL` + `/privacy`).
- **Homepage URL:** `https://memebox.pages.dev/`. **Support URL:** `https://memebox.pages.dev/feedback`.

## Images

All made by `npm run store-images` from the real extension (in `store/`):

| File | Size | Use |
| --- | --- | --- |
| `extension/icons/icon128.png` | 128×128 | Chrome store icon |
| `store/icon-300.png` | 300×300 | Edge store logo (from `npm run icons`) |
| `store/screenshot-1-call.png` | 1280×800 | A call with the panel and a caption |
| `store/screenshot-2-options.png` | 1280×800 | Lines and settings |
| `store/screenshot-3-welcome.png` | 1280×800 | Welcome page and mic test |
| `store/screenshot-4-tab-audio.png` | 1280×800 | Sending a tab's sound |
| `store/promo-440x280.png` | 440×280 | Small promo tile |

The call scene is a mock-up with coloured tiles and first names only. No real people, no platform logos.

## Publishing checklist: Chrome Web Store

1. Deploy the site first (README, "Deploy the site") and put its address in `extension/config.js` as `SITE_URL`. Check that `/privacy`, `/feedback` and `/uninstall` load.
2. Run `npm test`, `npm run test:e2e`, `npm run build` and `npm run zip`. The file to upload is `memebox-<version>.zip`.
3. Open the Chrome Web Store Developer Dashboard (https://chrome.google.com/webstore/devconsole). Pay the one-time registration fee if you haven't, and verify your contact email.
4. **Add new item** → upload the zip.
5. **Store listing** tab: paste the description, pick the category, upload the icon, the 4 screenshots and the promo tile. Add the homepage and support URLs.
6. **Test instructions** tab: paste the steps and the Pro key from "Test instructions" above.
7. **Privacy practices** tab: paste the single purpose and each permission justification from this file. Answer "No" to remote code, tick only **Authentication information** under data types (see "Data usage"), tick the three certifications, and paste the privacy policy URL.
8. **Distribution:** Payments: **Contains in-app purchases** while `PRO_ENABLED` is `true` in `extension/config.js` (MemeBox Pro is sold on the site and unlocked with a license key). Pick "Free of charge" only if Pro is switched off. Visibility: Public, all regions (or the ones you want).
9. **Submit for review.** Reviews usually take a few days. Permissions like tabCapture and host permissions can take longer.
10. After approval, copy the store address into `extension/config.js` as `STORE_URL` and into the landing page's install button (`site/public/index.html`, `id="install"`). Release a small update with those.

## Publishing checklist: Microsoft Edge Add-ons

1. The same zip works in Edge. No changes needed.
2. Open Partner Center (https://partner.microsoft.com/dashboard/microsoftedge) and register as an Edge developer. It's free.
3. **Create new extension** → upload the zip.
4. **Availability:** Public, all markets. If Pro is on, say in the listing and the tester note that the extension offers optional in-app purchases.
5. **Properties:** category Entertainment, privacy policy URL, website URL, support URL. Say that the extension doesn't need an account.
6. **Store listings:** English (and Hindi if you like). Paste the description and short description, and upload the logo `store/icon-300.png` (300×300), the screenshots and the promo tile.
7. **Submit.** In the notes for testers, paste the steps and the Pro key from "Test instructions" above.
8. After approval, you can add the Edge address to the landing page next to the Chrome one.

## GPL note

The extension is GPL-3.0-or-later, because eSpeak-NG is GPL-3.0. The source is public on GitHub and linked from the listing, which meets the license.
