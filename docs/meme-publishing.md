# Meme library and publishing flow

## What each user sees

The call panel's language chips and language selector change meme discovery during the call. Interface language is a separate preference. Recommended follows the chosen meme/interface/browser language, without using the country or timezone as a restriction. English/common sounds can be browsed alongside the preferred language; Explore all languages makes every supported language available. Choosing an explicit language narrows curated speech while keeping personal additions and universal effects available.

Regions are optional collections. For everyone appears first; Worldwide and India are both available to anybody. India is never an access gate or the mandatory default. The online pack browser has region and language filters; music and pictures are available regardless of spoken-language selection. A meme belongs to its relevant category, rather than being copied into every category. The All view includes eligible memes across categories.

A user's own text, recordings, music and pictures are private local additions. They do not publish into other users' libraries, and selecting another interface/meme language does not hide their own additions. Saved public-pack copies retain their source language/region and adult marker. Import/export retains those markers too. Country labels do not imply a restriction, translation or authentic voice.

## Adding personal content

1. Open MemeBox Options, then Lines. Write caption/text, choose the voice language and category, and add a picture if desired. Use Pronounce as for text that needs a different written pronunciation.
2. For a recorded regional dialogue, use Clips and save the recording with its caption. Recordings retain their actual voice; tagging a dialect does not make the offline synthesizer speak it authentically.
3. In a call, use the + button to add a sound file or Music > Add my music. Files remain on that device. Use Options to mark a saved meme as strong-language content.
4. Share deliberately using a .memepack.json export. Current exports support text and WAV clips; attached pictures are not embedded into that legacy share format. The adult marker is retained. This is a manual file exchange, not an automatic public upload.

## Publishing curated packs as the owner

No remote catalog is changed by this development work. Publishing happens later through the protected /admin/packs page:

1. Create a pack with a clear title and purpose, for example Everyday English, Tamil Reactions, India Regional or Worldwide Work Memes. Choose Memes, Pictures, Music or YouTube links and a region.
2. For text memes, use one row per dialogue: `text | language | strong`. `strong` is optional. Native script works best for offline text speech. Hinglish/dialect pronunciation may need an original recording or the user's Pronounce as field; a language tag does not guarantee an authentic accent.
3. For uploaded recordings/pictures, choose the relevant language, tags, Free/Pro/Pro Max tier, attribution and actual license. Mark Strong language where appropriate. Only select permission/cleared when you really own the content or have suitable permission.
4. Review each draft and publish it live when ready. Users press Browse packs, choose their filters and Add. Changing an admin catalog does not require an extension release. Refresh their catalog to see updates; updates do not silently replace a user's private recordings.
5. YouTube items are always free and use the visible official embedded player. Verify the official video, embedding permission, availability and attribution before publishing. NCS naming alone is not blanket commercial redistribution permission.

Hosted uploads/playback remain disabled by default. Text packs can use the catalog without R2 file hosting. Hosted files need a deliberate billing/access review and HOSTED_FILES_ENABLED=on; hosted audio additionally needs HOSTED_AUDIO_ENABLED=on. Local personal uploads do not need these switches or a Cloudflare bucket.

## Strong-language / adult content

- Off by default. The user opts in with “I’m 18+; show strong-language memes”. This is self-declared, not verified age.
- The marker survives saved lines, public-pack installation and .memepack.json import/export. Turning it off hides marked memes and stops current call audio and Options previews; favorites, random playback and timers cannot use marked items while disabled.
- Owners and users can mark text, recorded dialogues and picture memes. Unmarked recordings cannot be classified automatically; mark them accurately before distributing them.
- Phonk's site has its own explicit preference for marked tracks, excluding them from playback queues when off. It does not hide or bypass YouTube age restrictions/advertisements.
- Store content rating, listing disclosures and review must reflect the actual content before release. A checkbox does not guarantee store approval or establish verified adulthood.

## Music collections

The music room displays five supplied YouTube references and a private ten-collection manager. These preferences are separate from the public catalog. Native/website views have separate browser storage. Choosing a native collection transfers its selected reference/label/known adult marker in the URL fragment, never a license key. The fragment is removed after reading; known markers survive reloads.

Use /admin/packs for public collections as described in pack-content/manage-phonk.md, then Browse published collections in the room. It consumes names/credits, validated video IDs and adult flags without additional per-song database calls. Private collection edits never automatically publish for other users.
