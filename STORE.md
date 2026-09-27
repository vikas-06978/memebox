# Chrome Web Store listing draft

## Name

MemeBox

## Short description (132 characters max)

> Meme soundboard for video calls: click 😂 and a meme line plays through your mic so everyone hears it. Hindi + English. No accounts.

(131 characters, or 132 UTF-16 units because of the emoji. Both are within the limit.)

## Category

Fun (or: Social & Communication)

## Full description

Make every video call a little more fun. 😂

MemeBox adds a small floating 😂 button to your call page. Click it, and a meme line is spoken **into your microphone**, so everyone in the call hears it. The other people in the call don't need the extension.

**Works in the browser versions of popular calling apps:**
Google Meet, Zoom (web client), Microsoft Teams (web) and Discord (web).

**Features**
• One click = a random meme line. Hold or right-click the button for the full panel: search, play any line, Random, Stop, and a meme volume slider.
• Hindi/Hinglish and English voices, built right in. The speech engine runs on your own computer.
• Six tones: Normal, Chipmunk, Villain, Robot, Slow-mo and Excited.
• A big meme-style caption appears on your screen for 3 seconds, so you know what everyone just heard.
• Keyboard shortcuts Alt+1 … Alt+9 for your favourite lines. They're ignored while you're typing.
• Add your own lines, or upload short sound clips (MP3/WAV/OGG, up to 1 MB).
• Play a meme straight from a video tab (YouTube, Instagram and more): click the toolbar icon and "Send this tab's sound", with nothing downloaded. You can also save direct MP3 links, for example from myinstants.com.
• Optional timed lines: "Chai break!" every day at 11:00, or a line every N minutes while a call is open. Off by default.
• Import and export everything as a JSON file.
• A status dot shows green when memes go into your mic, and grey when you haven't joined a call yet.

**Default meme pack (friendly roasts only)**
"Bhai tu rehne de", "Ye college hai ya circus?", "Aaj bhi WiFi ne dhoka de diya", "Mute kar le bhai", "Chai break!", "Bruh.", "You're on mute!", "Emotional damage!", "Plot twist!", "Task failed successfully" and more.

**Private by design**
Your microphone audio is only mixed inside your browser. Nothing is recorded, saved or sent anywhere. There are no accounts, servers, analytics or ads. Your lines and clips are stored only on your device.

**Good to know**
• Memes are silent while you're muted in the call. That's on purpose.
• The desktop apps for Zoom and Teams aren't supported. Use the browser versions.
• Please meme responsibly. Keep it friendly, and follow the rules of your class or workplace.

MemeBox is free and open source (GPL-3.0-or-later). It uses the eSpeak-NG speech synthesizer.

## Single purpose

MemeBox is a soundboard for browser-based video calls. It plays short meme lines or user-uploaded clips into the user's outgoing microphone audio on supported call websites.

## Permission justifications

**storage**
Saves the user's meme lines, favourite shortcuts, meme volume, timed-line settings and the position of the floating button on the user's device (chrome.storage.local). Nothing is synced or sent anywhere.

**offscreen**
Creates an offscreen document (reason: WORKERS) that runs the bundled eSpeak-NG text-to-speech engine, compiled to WebAssembly, inside a Web Worker. It turns meme text into audio. A service worker can't run this engine, and running it inside the call page would slow the call down.

**tabCapture**
Used only when the user opens the toolbar popup on a tab (for example a YouTube video) and clicks "Send this tab's sound into my call". The extension creates a tab-capture stream ID for that tab (chrome.tabCapture.getMediaStreamId, with the user's call tab as consumer). The call tab mixes that audio live into the outgoing microphone. Nothing is recorded, saved, downloaded or transmitted by the extension. Capture stops when the user presses Stop or closes either tab.

**Optional host permissions (https://\*/\*, http://\*/\*)**
Not granted at install. When the user adds a meme from a direct audio-file link (MP3/OGG/WAV) in Options, the extension requests access for that one website only (chrome.permissions.request), so it can fetch the file when the user plays it. The request uses no cookies. Nothing is sent to that site except the normal file request.

**Host permissions / content scripts: https://meet.google.com/\*, https://app.zoom.us/wc/\*, https://teams.microsoft.com/\*, https://teams.live.com/\*, https://discord.com/\***
On these video-call websites only, the extension:
(1) wraps navigator.mediaDevices.getUserMedia so the microphone track the site receives is a mix of the real microphone plus the meme audio the user chooses to play, and
(2) shows the floating 😂 button, panel and captions.
Microphone audio is processed only locally with the Web Audio API. It is never recorded, stored or transmitted by the extension. The extension doesn't run on any other site.

**Remote code**
No. All code is packaged with the extension. eSpeak-NG's WebAssembly binary is bundled locally and needs `'wasm-unsafe-eval'` in the extension-page CSP. Nothing is downloaded or evaluated at runtime.

**Content Security Policy**
`script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`. This is needed to instantiate the bundled eSpeak-NG WebAssembly module.

## Data usage disclosures (Privacy practices tab)

- Does the extension collect or use user data? **No.**
  - Microphone audio is only mixed locally in the tab and is never collected or transmitted.
  - User-created lines and clips are stored only on the device.
- Tick all three certifications:
  - not sold to third parties,
  - not used for unrelated purposes,
  - not used for creditworthiness or lending.
- Privacy policy URL: publish `PRIVACY.md`, for example as a GitHub page or gist, and paste its URL here.

## Assets checklist

- Icon 128×128: `icons/icon128.png`.
- At least one screenshot, 1280×800 or 640×400. Suggested shots:
  1. a call with the 😂 button and a caption,
  2. the panel,
  3. the options page.
  Use a test call with only your own devices and don't show other people's faces.
- Small promo tile, 440×280 (optional).

## Package for upload

Zip the extension files only. Leave out `tools/`, `node_modules/`, `package.json` and `.git`, although including them is harmless. The zip must have `manifest.json` at its root.

PowerShell:
```powershell
Compress-Archive -Force -DestinationPath meme-button.zip -Path manifest.json,*.js,*.html,*.css,icons,vendor,LICENSE,THIRD_PARTY_NOTICES.md,PRIVACY.md
# (*.js / *.html / *.css include popup.* and options.*)
```
macOS / Linux:
```sh
zip -r meme-button.zip manifest.json *.js *.html *.css icons vendor LICENSE THIRD_PARTY_NOTICES.md PRIVACY.md
```

**GPL note:** the extension is GPL-3.0-or-later. Link the source repository from the listing, or offer the source on request.
