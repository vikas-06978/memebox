# MemeBox Privacy Policy

_Last updated: 28 September 2026_

MemeBox is a browser extension. It plays short meme lines or sound clips into your microphone during a video call, so the other people in the call can hear them.

## The short version

- MemeBox **does not collect, record, store or send** any of your audio.
- It has **no servers, no accounts, no analytics, no ads and no tracking**.
- Everything you create (your lines, clips and settings) stays **in your own browser**.

## Your microphone

When a supported call website (Google Meet, Zoom's web client, Microsoft Teams on the web, or Discord on the web) asks your browser for the microphone, MemeBox mixes two sounds together inside your browser tab:

1. your real microphone, and
2. any meme audio you choose to play.

The call website receives this mixed sound and sends it to the call, exactly as it would send your normal microphone. MemeBox never saves, records, analyses or uploads your microphone audio, and it can't listen to the other people in the call.

MemeBox doesn't turn on your microphone by itself. It only takes part when the call website asks for the microphone, which your browser controls with its usual permission prompt. When you mute yourself in the call, the memes are muted too.

## Data stored on your device

MemeBox stores these things locally with the browser's extension storage (`chrome.storage.local` and IndexedDB):

- the meme lines you add or edit (text, language, tone, keyboard shortcut),
- audio clips you upload (up to 1 MB each),
- your settings (meme volume, timed lines, and the position of the 😂 button).

This data never leaves your device unless you choose **Export**, which saves a JSON file to your computer. Uninstalling the extension deletes all of it.

## Text-to-speech

Meme lines are turned into speech by eSpeak-NG. This engine is bundled inside the extension and runs entirely on your computer. Your text isn't sent to any online speech service.

## Sending another tab's sound

If you open a video in another tab (for example YouTube or Instagram) and click **Send this tab's sound into my call** in the MemeBox toolbar popup, MemeBox mixes that one tab's sound live into your call microphone. This happens only for the tab you chose, only after that click, and only until you press Stop or close the tab. The sound isn't recorded, saved or uploaded by MemeBox, and nothing is downloaded.

## Voice changer and camera captions

The **voice changer** (Chipmunk, Deep, Robot, Echo, Radio) changes your live microphone sound inside your browser tab before the call website receives it. It is always off when a call page opens, and "Off" gives your plain voice back at once. Nothing is recorded or uploaded.

**Captions on my camera** is off by default. When you switch it on, MemeBox draws the meme text onto your own camera picture inside your browser tab, and the call website sends that picture instead of the plain one. Only your own video is changed. MemeBox never saves, records or uploads your camera picture.

## Sharing

**Save as WAV** saves a meme's sound as a file on your computer. **WhatsApp** opens WhatsApp's own share page (wa.me) with the meme text filled in. You choose the chat and press send yourself. MemeBox never sends messages for you and never controls WhatsApp.

## Clips from links

If you add a clip from a direct file link (.mp3, .mp4, .wav, .ogg or .webm), MemeBox fetches that file once, without cookies, when you click Fetch. You then trim it and save it on your device. Like any web request, that website can see your IP address. MemeBox contacts no other website.

## Feedback form and uninstall survey

MemeBox has a **Feedback** button, and after your 10th meme it asks once if you'd like to rate it. Both open our feedback page. The link carries only the MemeBox version and which call site you were on (for example `?v=1.0.0&site=meet`). It carries nothing about you.

When you uninstall MemeBox, the browser opens a one-question page asking why. Answering is optional.

If you send either form, we store only:
- what you picked or typed (rating, features used, your ideas, your message, and your email only if you type one),
- the MemeBox version, the call site from the link, and the page language,
- the date and time.

We don't store your IP address or browser details. To stop spam, the site counts messages per hour using a one-way hash of your IP address, and deletes that count after the hour. The form also uses Cloudflare Turnstile, a privacy-friendly spam check. The answers are stored in a Cloudflare D1 database that only the developer can read. To have your message deleted, write to us with the text you sent.

## Permissions

- **storage**: saves your lines and settings on your device.
- **offscreen**: runs the bundled speech engine in a hidden extension page.
- **tabCapture**: sends the sound of a tab you pick into your call, only after you click the button in the toolbar popup.
- **Access to meet.google.com, app.zoom.us/wc, teams.microsoft.com, teams.live.com and discord.com**: needed to show the 😂 button on those call pages and to mix meme audio into the microphone there. The toolbar popup also checks whether the current tab is one of these sites, so it can tell you to reload a tab that was open before MemeBox was installed. MemeBox doesn't run on any other website.

## Children

MemeBox isn't directed at children under 13 and doesn't knowingly collect any data from anyone.

## Changes

If this policy changes, the new version will be published at the same address, with a new "Last updated" date.

## Contact

Questions, or want a feedback message deleted? Email hello@example.com or use the feedback page.
