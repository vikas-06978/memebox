# Free music collection and owner controls

The local starter review manifest now contains 30 distinct artist/title selections in three collections: Phonk Essentials, Funk Selection and Discovery. Views are from user-pasted snapshots. This is not 30 playable/verified uploads yet: the specific video URLs, credits and embedding checks are still pending. No production records or deployment were changed.

## Change the collection after the site is deployed

1. Sign into your own `/admin/packs` using the private admin password.
2. Create or choose a Phonk Mode / YouTube links playlist. Use a style-based title, Free and the common/global region. Everyone sees the same free catalog; do not make access depend on nationality.
3. Add one specific official upload per line: `YouTube URL | song title | artist`. Keep unverified entries as drafts. Confirm the official source and allowed embedding before marking them cleared/live.
4. Use each item's Edit controls to update title, credit, visibility and sort number. Lower sort numbers appear first. To replace a video's URL, remove that item and add the newly verified upload; changing a title must not silently swap the source.
5. Remove tracks whenever needed. Existing caps allow 50 tracks per playlist, 10 playlists and 500 total, including drafts. A 30-track starter fits without raising these limits. Cached catalogs may take up to one minute or a fresh request to show changes.

These catalog edits do not need a new extension release. Owner controls require authentication. Never paste admin credentials into chat.

## Playback and inclusion

Free YouTube collections appear before paid MemeBox originals. Shuffle is optional, remembered on the device and keeps played-history order while randomizing the remaining queue. Searching/browsing another playlist does not replace the active queue. Basic shuffle labels are translated across the available interface languages.

The selection includes multiple credited artists and Phonk, Funk, Phouse and other discovery labels from the supplied metadata. Those labels are not a substitute for listening review. The first collection is a starting point, not a claim to represent every country or every listener. Keep song titles/credits intact and let people choose a style, search and shuffle. Future collections can broaden styles based on real feedback.

## Costs and rights

The new free catalog contains validated video IDs, so normal playback needs no separate `/api/pack-link` database query or write per song. The legacy endpoint remains for older catalogs/clients. D1 still serves the owner-managed catalog and metadata. Original loops run on-device; YouTube serves its own player/audio. Nothing is downloaded to or rehosted in R2 for these playlists.

Keep Cloudflare's account on its free service plans, hosted audio disabled and existing application caps in place. This design reduces operations; it cannot guarantee zero bills for arbitrary traffic or changes to account/provider pricing. R2's usage alerts are not hard spending caps. Payment gateway/domain/store costs are separate. Real account billing settings must be checked before release.

YouTube can show ads and publishers can disable embedding or remove videos. NCS's creator-video policy is not blanket permission for music distribution/application use. Check the applicable terms and credits before approval. Paid music here is the separately synthesized MemeBox collection, not a paywall on third-party embeds.

## Consolidated local player, 2026-10-14

The review includes a unified room with the five exact playlist references supplied in chat, not invented individual song IDs. On Windows run review/Start-MemeBox-Music.cmd. Its HTTP loopback page provides a valid web referrer; direct extension/file embedding may produce Error 153. The launcher does not deploy or enable hosting.

Manage my playlists edits private browser preferences. Public collections are maintained in /admin/packs and loaded by Browse published collections, without reinstalling. The thirty-title shortlist still needs exact official video URLs/rights checks before becoming that public catalog.

A real NCS frame loaded without Error 153, but googlevideo.com deliveries failed through the cloud proxy and its clock did not advance. Full live playback was not verified. Controlled browser fixtures verify application routing, embedding, privacy, adult opt-out and catalog updates; they do not establish provider availability.
