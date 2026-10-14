# One consolidated local review

Download **review/memebox-local-2026-10-14** on GitHub using **Code > Download ZIP**, then extract the entire archive. This is a local review, with no deployment or real checkout.

## Review the full page first

On Windows, double-click **review/Start-MemeBox-Music.cmd** and keep its console window open. It opens **http://127.0.0.1:8790/music-room.html** in your browser. No Node installation is needed. It serves only the supplied public preview files on loopback, without administrator privileges, software installation or Windows policy changes. Closing that console stops the server.

On macOS/Linux, use **python3 review/start-music.py** if Python 3 is installed. The supplied .command launcher does the same. The Chrome review extension and standalone listen.html work without Python.

The music room contains:

- Your five supplied YouTube playlist references, with a visible web player, Play/Pause/Next/Previous/Shuffle/Stop and volume. Internet is required; YouTube controls the tracks, ads and availability.
- Private collection add/rename/remove/restore controls, search and a default-off strong-language preference. These changes are not automatically published to other users.
- All sixteen bundled tunes, including the three revised original Phonk arrangements. Paid tunes are unlocked in this review. First Phonk drops land around 12–13 seconds; each has a build, pause, drop, breakdown and layered second drop.
- **Characters** opens the shared Playground: all fourteen companions, real species actions, Head/Shoulder/Corner, Roll/Sit, Leave/Return, nine outfits and 28 filters. This previews the same engine used on the call camera.
- **Plans, prices and how to buy** shows pass/character prices and draft individual Pro cosmetic prices. Max music links select Max passes, not Pro. Checkout remains explicitly closed.
- **Browse published collections** can read a running local/backend catalog or, later, the deployed owner-managed catalog. A backend is not included in the read-only launcher. Without one, your five private references and local originals remain available. Owner catalog edits through /admin/packs do not require an extension release.
- **Video memes** opens a separate admin-controlled catalog with Worldwide, India & Regional, Gaming, Trending and After Dark folders. Users cannot edit these shared folders. The video stays visible in YouTube's player; MemeBox stores only its video ID and metadata. During a call, use the toolbar action **Send this tab’s sound** so other participants hear the player tab.

YouTube requires a web referrer: opening its player directly from an extension or file page can produce Error 153. The local launcher provides the HTTP website player. The extension’s Phonk button opens the music room; choosing a playlist there opens its web player. No remote-player code executes in the extension itself.

The editable 30-title song shortlist is still a separate curation document. It is not thirty individually verified/published tracks. The supplied five playlist references are embedded as playlists; their contents remain controlled by YouTube. Availability, official sources, rights/credits and regional content still need review before release. Cloud proxy restrictions prevented full YouTube media-stream verification here; see docs/local-review.md for exact evidence.

For a quick offline listen, double-click **review/listen.html**. Its three complete WAV drafts have **Hear the first drop** buttons that start two seconds before the drop. Subjective sound quality remains for your listening feedback.

## Then test a call once

1. Temporarily disable the Web Store copy while testing, to avoid two copies wrapping the same call.
2. Open **chrome://extensions**, enable Developer mode, choose **Load unpacked** and select **review/extension**. No Pro key is needed: this copy unlocks both tiers for review. Never publish it.
3. If replacing an older review, use the same extracted folder path, reload the extension and refresh the call tab. That preserves the review copy’s stored local data.
4. In a real browser call, test mic mixing, species movement/gestures, language switching, private memes/music and persistent pictures. Close/Escape/Stop all removes a picture. For YouTube, keep the website player tab open, click the MemeBox toolbar icon and choose **Send this tab’s sound**; YouTube ad audio would be sent too.
5. Your own uploaded music is available on Free; premium bundled tunes keep their tiers. Private files stay on the device. Marked adult memes/collections are hidden until explicit self-declared opt-in; opting out stops active marked playback/call mixing.

For developer/backend tests only, use npm ci then PORT=8789 npm run site:dev (PowerShell: $env:PORT=8789; npm run site:dev). See site/.dev.vars.example and docs/payment-testing.md; no live secrets are supplied. Hosted Cloudflare files remain default-off. Application limits do not guarantee provider pricing will never change.

To prepare the default video catalog locally, sign in to `/admin`, open `/admin/packs`, press **Create five YouTube video meme folders**, open a folder and paste one item per line as `YouTube link | title | creator`. Mark the official-upload checkbox only after verifying the upload may be embedded, then make the folder Live. Region controls discovery order only; every country can browse every Live folder.

See [the checklist](docs/local-review-checklist.md), [the companion/tier model](docs/companion-model.md) and [meme publishing](docs/meme-publishing.md). Account approval, real provider tests, original regional recordings, native copy review, owner-key rotation and actual call/weak-laptop checks remain release prerequisites. No remote migrations, main merge, site deployment or Web Store publication was performed.
