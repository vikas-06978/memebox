# Review fixes, 15 October 2026

Local review branch only. No production deployment, remote migration or live payment activation.

## Requested changes and implementation

- Library loads the local review catalog in both the extension and localhost copy. Music view also includes meme cards; Video memes filters to meme packs. Backend libraries load automatically on entry.
- Preview catalog has 38 meme references after removing Dance Meme. Five owner-reported broken links are excluded from playable lists and new admin imports: Abhijeet, Technologia, Russian Kid Dancing, Boy Cries Over Exam Grade and Chinese Meme Template. Their metadata is retained for replacement. This leaves 27 clean and six strong-language candidates, plus Money Follows. These counts describe candidates, not verified provider availability.
- Coffin Dance uses dHER3Vc9GBI. Its former reference is replaced. Provider age/region/embed restrictions cannot be overridden by an app preference.
- The same iframe receives loadVideoById after it is ready, avoiding teardown between individual memes. First selection shows loading feedback; provider errors disable that selection for the session and explain the restriction.
- Strong-language control sits next to the catalog; enabling it changes the visible count. After Dark has one pack label. Long technical library copy and repeated picture-tab consent controls are removed.
- Phonk and Video memes buttons in a call open the HTTP player directly in one tab. Older extension-page selections replace their own tab rather than opening another.
- Player has its own Only me / Everyone in call controls. Everyone asks for browser tab-audio sharing consent, then sends only audio over local WebRTC to the active meeting mic bus. No video track is sent, no hosted relay is used, and stopping/closing/leaving disconnects it. Meeting microphone mute still applies; meeting codecs and noise processing can affect music quality.
- Three synthesized MemeBox phonk choices are removed from Music room, call panel, Playground and the older standalone Phonk page. Existing recordings/engine definitions are retained internally for compatibility.
- Picture upload is a draft: choose, inspect preview, remove/replace, optionally enter caption, then Add. Filename is never made into speech. Read caption aloud supports picture-only, picture + caption silently, or picture + spoken caption. The preference survives editing/storage and pack export metadata.
- Camera captions off now prevents outgoing text/picture rendering. With an own-camera tile visible, only the camera picture remains, with a nearby Close control; the duplicate page bitmap is suppressed. Pictures are centered in the outgoing frame.
- Camera lights and characters are independent. Selecting a usable character activates camera rendering without switching on lamps or corner lights.
- Face-frame resizing preserves aspect ratio. High sensitivity runs hands on each processed frame. Supported hand poses are not a general sign-language interpreter; guidance asks for a full visible hand held beside the face.
- Auto defaults to English; English examples and pronunciation placeholders are English. Timer choices use the selected language and explain clock times versus intervals. Direct-file URL placeholder explicitly excludes YouTube pages.
- Checkboxes align with their labels. Five call tabs fit on one row, and Sound tab explains microphone effects, local monitoring, ducking and camera captions.

## Local review

Run review/Start-MemeBox-Music.cmd first. Reload review/extension in Chrome and reload the meeting tab. Open Music or Video memes from the call panel. Inside the player choose Everyone in call, select THIS tab, and enable Share tab audio. Keep the meeting mic unmuted. Only me stops outgoing player audio.

Provider embeds, browser sharing consent on the owner's Windows machine, real meeting codec quality, poor-light hand detection and weak-laptop performance still need normal platform review. No guaranteed playback claim is made for third-party links.

## Validation and provider evidence

- 211 unit cases pass. Full source run: 139 passed; two old language expectations were corrected and both source cases separately pass, including retaining Auto in the dropdown while displaying English.
- 17 focused cases pass on the rebuilt minified review package, including the actual outgoing audio stream, cancellation/disconnect, picture save/preview, independent characters, catalog updates and language switching.
- The older standalone Phonk page passes all seven playback/queue/strong-language cases after removing the originals.
- Final post-review label changes are rechecked in the packaged library/picture cases. Screenshots were visually inspected for checkbox alignment, English examples, picture preview and meme button states.
- Read-only YouTube oEmbed checks for the supplied Coffin link and five reported broken links were blocked by the cloud CONNECT proxy with HTTP 403, including an escalated retry. Their live stream availability is not verified here.
