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

**Explore the complete studio**
• Preview characters, outfits, camera filters and music before joining a call. The welcome page includes an English product tour with captions.
• In your call, open five organised pages: Memes, Music, Lights, Pictures and Sound. Search, categories, favourites, recently played and Stop all are close at hand.
• Meme lines are spoken by a voice engine on your computer, with six tones: Normal, Chipmunk, Villain, Robot, Slow-mo and Excited.
• Keyboard shortcuts: Alt+1 to Alt+9 for favourites, Alt+0 to stop, Alt+M to hide. They are ignored while you type.
• Add audio or video files (only their sound is kept), a direct media-file link, or a short recording. Trim in the waveform editor. Website links such as YouTube pages are played in the visible player, not downloaded.
• Upload and preview a picture. Show it silently, add a written caption, or enable Read caption aloud. Caption and speech are optional; filenames are never spoken.
• Choose Only me or Everyone in call for music. Built-in tunes mix into your meeting mic; playlist and video-meme audio requires selecting the player tab and enabling Share tab audio in the browser dialog.
• Browse regional video meme collections in a visible YouTube player. Individual videos remain subject to the provider's age, embedding and region restrictions.
• Preview 14 animated companions, 28 filters, outfits and light shows. Optional local face and hand models support selected gestures and away/return reactions. This is not general sign-language interpretation.
• Optional voice effects: Chipmunk, Deep, Robot, Echo or Radio. Auto-duck lowers sound while you speak. Party mode can schedule a chosen line during a connected call.

**Free and optional paid extras**
The free soundboard includes local speech, sound effects, favourites, tab audio, up to 10 saved clips, one picture meme, Cat and Dog, three colour filters, a still lamp and Chill/Funky music. Personal music uploads are available free.

Pro and Pro Max passes unlock additional features while the pass is switched on in a connected call. Unused time does not expire. Selected standard characters, filters and outfits may also be bought permanently; Max-exclusive items require the matching pass. Existing owner and legacy purchases are retained. Available products, prices and checkout status are shown on the website. Premium features require a valid license; payment availability depends on the payment provider.

**Private by design**
Your live microphone, camera effects and tab-audio mix are processed inside your browser. Personal clips you deliberately record/import stay on your device. There are no accounts or cross-site tracking. License checks and signed pass-time reports go to the MemeBox site. Optional feature counters are optional and off by default; they never contain call content, captions, filenames, meeting URLs or contacts. Optional YouTube playback follows the provider's privacy policy and may include ads. Details are in our privacy policy.

**Good to know**
• Memes are silent while you're muted in the call. That's on purpose.
• Desktop call apps aren't supported. Join your call in the browser instead.
• After installing or updating, reload an open call tab once.
• Keep it friendly and follow the rules of your class or workplace.

MemeBox is free software (GPL-3.0-or-later). The source code is available on request: memebox.help@gmail.com. It uses the eSpeak-NG speech synthesizer. MemeBox is an independent project and isn't affiliated with any of the call services it works on.

## Single purpose

MemeBox is a soundboard for browser video calls. It plays meme lines, sound effects and the user's own clips into the user's outgoing microphone on supported call websites. The voice changer, tab audio, camera captions and Lights & looks (lamp, lights, filters, animated characters and music, optionally following where the user is in the picture) are part of the same purpose: changing what the user sends into their own call.

## Permission justifications

**storage**
Saves the user's lines, favourites, volumes, settings, button position, license and pass balance on the device. Imported clips and pictures are kept in IndexedDB. Also stores pending pass-time reports and optional feature counters, which are sent only when the user enables usage sharing. Call content and personal media are never uploaded to MemeBox servers.

**offscreen**
Creates an offscreen document (reason: WORKERS) that runs the bundled eSpeak-NG text-to-speech engine, compiled to WebAssembly, in a Web Worker. It turns meme text into audio. It also runs the bundled face and hand models for the optional Follow me. A service worker can't run them, and running them in the call page would slow the call down.

**tabCapture**
Used only when the user opens the toolbar popup on a tab (for example a YouTube video) and clicks "Send this tab's sound to my call". The extension gets a stream ID for that tab (chrome.tabCapture.getMediaStreamId, with the user's call tab as the consumer). The call tab mixes that audio live into the outgoing microphone and plays it back to the user. Nothing is recorded, saved, downloaded or transmitted. It stops when the user presses Stop or closes either tab.

**Host permissions: https://meet.google.com/\*, https://app.zoom.us/wc/\*, https://teams.microsoft.com/\*, https://teams.live.com/\*, https://discord.com/\***
Only the 5 call websites MemeBox works on: meet.google.com, app.zoom.us/wc, teams.microsoft.com, teams.live.com and discord.com. There the extension:
1. Wraps getUserMedia so the microphone the site receives is the real microphone mixed with the meme audio the user plays.
2. Shows the floating 😂 button, panel and captions.
3. Only if the user turns them on: applies the voice changer to the user's own microphone, draws meme captions, lights, filters and characters on the user's own camera, and (with "Follow me") runs small bundled face and hand models on the user's own camera picture, on their computer only, to see where they are, a smile or a raised hand. Nobody is identified. Nothing is saved or sent.
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
> 2. Free features work without a key. Welcome → Let's go opens the full studio. To test Pro/Max (voice effects, camera captions, premium companions, filters and timed lines): open Options → MemeBox Pro, paste the reviewer key MBX-XXXX-XXXX-XXXX and press Activate. The publisher must replace this placeholder with a real active owner key before submission.
> 3. Tab audio: open a YouTube video in another tab, click the MemeBox toolbar icon there and press "Send this tab's sound to my call".
> 4. Products and current payment availability appear at https://memebox.site/pricing. A license is checked at the configured MemeBox /api/license endpoint; passes report signed usage to /api/pass-session. Optional /api/usage counters are off unless enabled in Options. Playback does not require other participants to install MemeBox. Use browser calls, not desktop meeting apps.

## Data usage (Privacy practices tab)

- **Data types:** declare **Authentication information** for license keys and **User activity** for signed pass-time reports and optional feature/item counters. Describe optional counters as off by default; they include a pseudonymous installation identifier and may be associated with a license key. Do not claim that the new version collects no usage data.
  - Microphone, camera and tab audio are processed only in the tab and are never collected or sent.
  - Lines, clips and settings are stored only on the device.
  - The extension opens the feedback page with only the extension version and the call site name (for example `?v=1.0.0&site=meet`), and the uninstall survey with only the version. People may choose to type an answer there. That is covered by the website's privacy policy.
- Tick all three certifications:
  - I do not sell or transfer user data to third parties, outside of the approved use cases.
  - I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
  - I do not use or transfer user data to determine creditworthiness or for lending purposes.
- **Privacy policy URL:** `https://memebox.site/privacy` (your `SITE_URL` + `/privacy`).
- **Homepage URL:** `https://memebox.site/`. **Support URL:** `https://memebox.site/feedback`.

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
| `store/screenshot-5-characters.png` | 1280×800 | Actual animated companion and outfit preview |
| `store/screenshot-6-filters.png` | 1280×800 | Actual camera filter and light preview |
| `store/promo-440x280.png` | 440×280 | Small promo tile |

The call scene is a mock-up with coloured tiles and first names only. No real people, no platform logos.

## Publishing checklist: Chrome Web Store

1. Deploy the site first (README, "Deploy the site") and put its address in `extension/config.js` as `SITE_URL`. Check that `/privacy`, `/feedback` and `/uninstall` load.
2. Run `npm test`, `npm run test:e2e`, `npm run build` and `npm run zip`. The file to upload is `memebox-<version>.zip`.
3. Open the Chrome Web Store Developer Dashboard (https://chrome.google.com/webstore/devconsole). Pay the one-time registration fee if you haven't, and verify your contact email.
4. Open the existing item `bbpfkaedpfabehgikgpagbjhjcmlcpnl` → Package → Upload new package. Keep the same item and publisher account so existing users update in place. Do not create a new item for this release.
5. **Store listing** tab: paste the description, pick the category, upload the icon, the 4 screenshots and the promo tile. Add the homepage and support URLs.
6. **Test instructions** tab: paste the steps and the Pro key from "Test instructions" above.
7. **Privacy practices** tab: paste the single purpose and permission justifications. Answer "No" to remote code. Declare Authentication information and User activity as described above, complete the three certifications truthfully and link the updated privacy policy. Approval remains the store review team's decision.
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
