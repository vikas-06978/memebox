# Current local review checklist

Branch: `review/memebox-local-2026-10-14`. Start with [START-HERE](../START-HERE.md). This checklist separates completed local implementation from account/content/release work. No deployment, remote migration, live payment activation or Web Store publication is included.

## Completed locally

- [x] Full-page Playground with the shared camera renderer, all 14 characters, actual species actions, manual reactions, position control, Leave/Return and mobile layout.
- [x] Birds/owl fly; bunny/frog hop; penguin waddles; snake slithers; robot marches. Ground companions use shoulder footholds. Rolling moves around the head and returns home; paused exploration rests on the selected shoulder/head/corner with gentle idle motion.
- [x] Away companions search, miss, cry and float. Happy music does not override absence; a stable return triggers wiping/welcome.
- [x] Three Free filters, 15 Pro filters, ten Max exclusives. Pro uses all 18; Max uses all 28. Standard Pro filters support permanent ownership; Max extras have no individual product.
- [x] Three Free, three Pro and three Max costumes; Pro ownership support and closed draft prices. Max costumes react to emotion. A costume never grants the underlying character.
- [x] Cat/Dog Free, ten standard characters with Pro, all fourteen with Max. Eight extra standard characters are purchasable; Unicorn/Robot/Snake/Bird are Max-only for new sales. Legacy purchases remain supported.
- [x] Local Plans page with server-derived price snapshot, currencies, ownership rules and working navigation; checkout explicitly closed in review. Existing pass/character prices remain unchanged.
- [x] Separate Pictures tab and local picture preview; large pinned call pictures persist until Close/Escape/Stop all. Personal files stay on the device.
- [x] Music discovery from Welcome, Options and Playground; all 16 bundled tunes have tier labels. Three original Phonk arrangements have stronger kick/sub/808 harmonics, offline WAV listening and on-device playback.
- [x] Language can change during a call. Own additions and universal effects remain available; curated speech follows the preference. Country never restricts access. For everyone, Worldwide and India are optional collections.
- [x] Preferred-language and region controls for pack browsing; installed content retains language, region, source and strong-language metadata.
- [x] Default-off self-declared 18+ preference. Text/clip editors can mark strong language; import/export retains markers. Marked items are guarded in discovery, favorites, random/timers, previews and playback. Opting out stops active/pending media. Site Phonk also excludes marked tracks from queues/player.
- [x] Test-only Razorpay order creation/capture confirmation, signed raw webhooks, server prices, atomic fulfillment, recovery, conservative refund handling and admin test ledger.
- [x] Signed pass-usage protocol, retries/offline-debt handling and replay protection implemented locally. This does not establish tamper-proof extension clients.
- [x] Cloudflare file hosting default-off; lower shared storage/delivery ceilings and kill switches. Local originals/private uploads need no R2 hosting. The code cannot guarantee every platform will forever be free.
- [x] Minified shipping candidate and separate unlocked ready-to-load review copy. Source shipping entitlement settings remain enabled. No live secrets are bundled.
- [x] Core new movement/music/picture/adult labels localized across 16 interface bundles. No em dashes in public website text.
- [x] Final validation: 201 unit tests; 125 source browser cases with the single failure fixed and covered by a 12-case rerun; 20 packaged-review cases covered with the timing-sensitive test corrected and passing. Offline WAV playback and desktop/mobile layout verified. See local-review.md for exact run details.

## Owner review, account/content work still pending

- [ ] Listen to the original arrangements; judge musical quality, bass and real-call loudness. Automated audio checks do not replace your listening feedback.
- [ ] Test actual Meet/Zoom/Teams/Discord browser calls, outgoing camera pictures, mic mixing, gestures and tracking on a weak laptop. Current browser tests use controlled/fake calls.
- [ ] Supply original/licensed regional recordings and common-ground memes. Public packs are not populated with third-party copyrighted recordings.
- [ ] Verify official YouTube IDs, embedding, availability and attribution for the editable 30-title shortlist. It is not 30 working licensed songs yet. The visible YouTube player retains its ads/restrictions.
- [ ] Native-speaker review and full translation of longer new helpers/Plans text and four Beta bundles.
- [ ] Finalize draft cosmetic prices before opening any new product. Max-only products remain unsellable individually.
- [ ] Razorpay account/website/bank approval and separate international-payment eligibility. Provider test keys must be supplied securely to an isolated test database/environment; live payment support stays closed.
- [ ] Provider-end refund initiation and settlement reconciliation; actual shared-license refunds need entitlement review.
- [ ] Confirm Cloudflare Free/account/bucket billing and direct bucket access settings before enabling hosting. Alerts/application counters are not hard provider spending caps.
- [ ] Rotate the owner key previously present in Git history before release. Remove/restrict history exposure as appropriate; current working files do not erase old commits.
- [ ] Verify memebox.site/domain connectivity, final API/SEO address, privacy/content rating, licenses, store screenshots/tutorial/listing, reviewer key and final release version.
- [ ] Only after your local approval: separately authorize deployment/migrations and then trusted-tester Web Store release. Never publish the unlocked review folder.

## Quick review path

1. Download this branch as a GitHub ZIP, extract it and load `review/extension` in Chrome Developer mode. If replacing an old review, reload the extension and call tab.
2. Open Playground. Select Bird and species action; try each animal, Roll, Sit and Leave/Return. Leave it absent long enough to cry, then return. Compare the actual movement with a real call.
3. Visit Music and play originals; open `review/listen.html` offline for complete arrangements. YouTube titles are a separate pending catalog.
4. Open Pictures and Options to add a private picture/meme. During a call change language and verify your own content stays discoverable. Check Close/Escape/Stop all.
5. Try a harmless line marked strong-language, confirm it is hidden by default, opt in and play, then turn the toggle off mid-play. It should hide and stop.
6. Open Plans. Confirm the Free/Pro/Max counts, prices and closed checkout. Send consolidated feedback before any deployment.
