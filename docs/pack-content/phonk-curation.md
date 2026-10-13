# Global Phonk starter selection

Status: selection draft, not uploaded or deployed. YouTube and NCS requests returned HTTP 403 from the current cloud network. No third-party track has been marked verified or cleared on that basis.

## Storage decision

For a small fixed starter collection, bundle a JSON catalog of video IDs, titles, artists, official upload URLs and credits with the site. No audio files or per-play D1 lookup are needed for that catalog. The visible official YouTube player handles playback. Static site requests still exist; this is not a guarantee of zero platform costs at unlimited traffic.

Use the existing D1 pack catalog for owner-managed playlists that should change without rebuilding the site. Store metadata only. R2 is unnecessary for YouTube links and for the three existing locally synthesized MemeBox originals.

## Starter playlists to curate

- Drift: energetic cowbell and driving beats, five tracks.
- Brazilian: rhythmic, upbeat tracks, five tracks.
- Night drive: calmer, darker tracks, five tracks.

All third-party YouTube tracks remain free. Keep MemeBox Originals separate: Desi Phonk for Pro; Desi, Drift and Midnight for Pro Max. Genre labels and branding must match the actual tracks, not just trending titles.

## Verification before adding each track

Record the specific official upload and channel, exact title and artist, working embed, source/license policy URL, required attribution and the verification date. Prefer official NCS releases that fit the selected genre and whose current policy permits this use. An NCS name, an unofficial repost or the phrase copyright-free is insufficient verification. Do not download, rehost, strip ads or hide the player.

The current cloud environment configuration draft includes NCS and YouTube domain additions, preserving its existing destinations. Saving that draft does not activate network access or publish the website. Verification can continue after those network settings are applied.

## Verification update, 2026-10-14

NCS is now accessible. Its official search catalog lists Mortals Funk Remix by Warriyo and LXNGVX. The user's second pasted list contains 23 NCS-labelled tracks; its view counts and uploader labels remain a user-supplied snapshot, not live verification. Store it in `ncs-user-playlist-snapshot.json`.

The official policy at https://ncs.io/usage-policy explicitly describes free use for independent creators' videos/livestreams with credit. It says game developers should contact its commercial licensing form, and brands/services making promotional content should contact its partnerships team. Those statements are not a blanket permission for audio hosting or every application use. A visible YouTube embed and separately hosting/distributing music are different uses; check applicable YouTube terms and publisher embedding settings for the former, and obtain the necessary permission before considering the latter. Do not infer a licensing fee or permission grant from the pasted Copyright Free label.

YouTube playlist and oEmbed requests still return cloud-proxy CONNECT 403 despite the saved domain permissions. No YouTube IDs, embedding checks or current video views have been verified. No third-party music has been downloaded or added to the live app.
