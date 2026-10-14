# Companion review model

This is local development on the review branch. No deployment, live checkout or new cosmetic sale is activated.

| Library | Free | With Pro | With Pro Max | Permanent purchase |
| --- | --- | --- | --- | --- |
| Characters | Cat, Dog | All 10 standard characters | All 14, including Unicorn, Robot, Snake, Bird | The eight standard extras; four Max exclusives never individually sold |
| Filters | 3 | 18 total: 3 Free + 15 Pro | 28 total: +10 Max exclusives | The 15 Pro filters, draft products only |
| Outfits | Party hat, crown, scarf | Also hoodie, bow tie and glasses | Also space explorer, magic stars and hero cape | The three Pro designs, draft products only |
| Bundled music | Chill, Funky | 7 regular tunes plus original Desi Phonk | All 13 regular tunes and 3 original Phonk arrangements | No new music purchase product |

Draft prices in site/src/shop.js: Pro filter ₹19 / $0.99, Pro outfit ₹29 / $0.99. All these products are closed and excluded from the public sale catalog until the owner chooses final prices and explicitly authorizes sales. Max-only filters and outfits have no individual product, including closed drafts. Existing character prices and pass prices remain unchanged. A costume never grants its underlying character. Owned standard filters and costumes work without an active pass; automatic face-follow, gesture and away/return behavior still require the applicable pass. Legacy owner/unlimited keys retain access.

Every companion has its own gait and signature action. Birds and owls fly, bunny and frog hop, penguin waddles, snake slithers, robot marches, unicorn prances, and the others use distinct steps and idle actions. Ground animals use the shoulder as a foothold to reach the head. Rolling travels around the head and returns to the selected resting place. Pause exploring keeps gentle idle actions at that place. Basic manual emotes work on usable free or owned characters, even with follow disabled.

Absence takes priority over music and manual happy actions. The character searches, misses you, cries and floats in its tears. It does not enter party mode after a timeout. A face must be stably present for about 0.9 seconds before a welcome; tears then drain. Head and shoulder positions are estimated from the tracked face, not full skeletal tracking.

Playground uses the same renderer as the outgoing camera, with explicit leave/return and position controls. Its picture preview remains on the device. The call panel has a Pictures tab showing picture memes across languages, and a route to add them in Options. Welcome, Options and Playground expose Music directly; all 16 bundled tunes have visible tier labels in Playground. Local-review Phonk Mode opens the bundled listening room instead of an unavailable loopback website. Free verified YouTube playlists remain separate and require official video IDs and an available site.

Regions are optional collections, not country restrictions. For everyone is the common collection; India stays available to anyone. Interface language and meme language remain independent. Core new controls are localized in all 16 interface bundles; longer new helper/personality text still needs native translation/review outside English and the selected Hindi controls.

Original Phonk now layers sub-bass with saturated 808 harmonics, stronger kicks and controlled kick ducking. It remains synthesized on-device with no sampled third-party audio or R2 download. Updated stereo WAVs in review/music are listening drafts. Their rendered peaks remain below 0.5 at the conservative export gain; musical quality and real-call loudness still need the owner's listening feedback. Real Meet calls and weak-laptop tracking remain unverified by fake-call tests.
