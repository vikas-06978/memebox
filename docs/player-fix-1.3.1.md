# Player and free discovery fixes in 1.3.1

The 1.3.0 production candidate pointed to the current live domain while the new player had not been deployed there. That server returned the old home page with HTTP 200 for /music-room. The tests had mocked that URL as an arbitrary HTML response and missed this production mismatch. No production deployment is included in this fix.

The extension now checks the current player's explicit version marker before opening an HTTP destination. A 200 homepage is refused. It can use the bundled loopback companion while awaiting release; if neither current endpoint is available, it keeps the included library visible and explains how to start the companion instead of redirecting to the home page. Playlist and meme selection stay in the same player tab, with no license key in its URL.

The previous production ZIP did not include the local player/launcher. The new **test ZIP** includes an extension with paid gates retained, the complete current static player and launchers. On Windows, extract the whole new folder and run Start-MemeBox-Music.cmd once; keep its window open. There is no Node installation or system policy change. The test extension points straight to that player. This is not the store submission package. After the new player is actually deployed, regular users will use the HTTPS player without the review launcher.

Other fixes:

- Music.IDS was created before three Phonk arrangements were registered. All 16 tunes are now discoverable, including Desi, Drift and Midnight Phonk.
- SHOP_OPEN used to hide premium choices entirely for free users. All music, filters, companions and costumes are now discoverable as previews. Actual outgoing paid audio/camera effects still use license/pass gates; checkout remains closed.
- The included catalog contains the supplied video references and excludes known unavailable items. The free meme library loads even when the live catalog is old or unavailable. A valid published catalog can still refresh it; unavailable/private/age/region-restricted YouTube items cannot be made universally playable by this code.
- Music, filters, characters and outfits have separate plan destinations. Item availability expands at the specific product; preview links select that filter/character/outfit in the studio. No purchase button implies payment is active.
- The English video retains its 110-second format and now shows the actual current player for the playlist chapter and explains all 16 tunes.

Release gates remain: validate provider playback on the user's network and real two-device calls; deploy the current HTTP player/catalog before store submission; obtain payment-provider approval before live payments. No security, browser permission, YouTube restriction or payment gate is bypassed.

Validation: 216 unit tests passed; 35 selected source browser cases covered player navigation, free/premium gates, camera effects, audio sharing, picture speech and catalog refresh. The five new routing/preview cases also passed against the minified production package. The complete test ZIP was independently extracted and its own loopback server used to verify the studio → player link, all 16 tunes, 27 clean memes, playlist selection and the supplied Coffin Dance embed. The provider frame was mocked; this verifies routing and selection, not universal live YouTube availability. Native Windows/default-browser launcher interaction was not executed in this Linux environment.
