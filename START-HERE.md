# Chrome mein local review

This branch is for local testing. Do not deploy it or publish the unlocked review build.

1. On GitHub select **review/memebox-local-2026-10-14**, then **Code > Download ZIP**.
2. Extract the entire ZIP onto your computer. Opening files inside a ZIP is insufficient.
3. For music, open **review/listen.html** in Chrome and press Play. All three original tracks play offline.
4. Open **chrome://extensions**, turn on **Developer mode**, click **Load unpacked**, and select **review/extension** inside the extracted folder. This is the folder containing the review manifest.json.
5. If you loaded an earlier copy, replace it with this extracted **review/extension** folder and click Reload in chrome://extensions. Reload the call tab too.
6. Pin **MemeBox Local Review**, open its options and choose **Preview/Playground**. Try the species action, Jump, Roll, Sit, Leave/Return and Head/Shoulder/Corner controls. Preview all 28 filters and nine costumes. Music, Pictures and Plans have their own visible links.
7. Try a real browser call: switch meme language, add a private meme, play all three original Phonks, show/close a picture and use Stop all. Mark a benign test line as strong language and check it stays hidden until the 18+ preference is on.

No Node installation, build command or payment is required for the supplied extension and music player. The review extension has paid features unlocked just for testing and uses a local site address. Buy is hidden. Plans shows the proposed tiers and prices with checkout clearly closed. Draft individual Pro filter/outfit prices are not activated. Original shipping settings remain in extension/config.js; do not load extension/ expecting the same unlocked experience.

The full development source is also in this repository. If you want to run the website locally, use a supported Node version, run npm ci, then PORT=8789 npm run site:dev (on Windows PowerShell: $env:PORT=8789; npm run site:dev). The site listens only on loopback. See site/.dev.vars.example for local configuration and docs/payment-testing.md for provider testing. No secrets or live payment credentials are bundled.

The 30-song YouTube collection is a shortlist. Official video links and embedding/rights verification are still pending. The offline player contains three original arrangements, not those YouTube songs. Backend/provider testing, native translations and real-call performance still need review before release.

Hosted file uploads, playback and stored file deletion are paused unless deliberately enabled with HOSTED_FILES_ENABLED=on. Audio needs HOSTED_AUDIO_ENABLED=on as well. These application guards do not guarantee that third-party pricing or policies will never change.

For developers: npm run review:build rebuilds the ready-to-load review extension. Rendering the audio drafts separately uses node tools/render-original-music.mjs review/music with Playwright Chromium installed. Nothing in these commands deploys the site or extension.

See [the current checklist](docs/local-review-checklist.md) for what was completed locally and what still requires your account, content or real-call review. [Meme publishing](docs/meme-publishing.md) explains private uploads, regional packs and the 18+ marker; [the companion model](docs/companion-model.md) explains permanent ownership and Max exclusives.
