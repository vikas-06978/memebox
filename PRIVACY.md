# MemeBox – Privacy Policy

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

## Memes from links

If you add a meme from a link (an MP3, OGG or WAV address), Chrome first asks your permission for that website. MemeBox then fetches the file from that address each time you play the line, without cookies. Like any web request, that website can see your IP address. MemeBox contacts no other website, and the audio isn't stored.

## Permissions

- **storage** – saves your lines and settings on your device.
- **offscreen** – runs the bundled speech engine in a hidden extension page.
- **tabCapture** – sends the sound of a tab you pick into your call, only after you click the button in the toolbar popup.
- **Optional access to other websites** – asked for one website at a time, only when you add a meme from a link on that site.
- **Access to meet.google.com, app.zoom.us/wc, teams.microsoft.com, teams.live.com and discord.com** – needed to show the 😂 button on those call pages and to mix meme audio into the microphone there. MemeBox doesn't run on any other website.

## Children

MemeBox isn't directed at children under 13 and doesn't knowingly collect any data from anyone.

## Changes

If this policy changes, the new version will be published at the same address, with a new "Last updated" date.

## Contact

Questions? Contact the developer through the support link on the Chrome Web Store listing.
