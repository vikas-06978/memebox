# Release MemeBox without losing existing users

## Current release candidate

Existing Chrome item: https://chromewebstore.google.com/detail/memebox-meme-soundboard-v/bbpfkaedpfabehgikgpagbjhjcmlcpnl

The store screenshot shows version 1.2.2 and about 20 users. The candidate is 1.3.0. Upload it as an update to that same item and publisher account. Do not create another item, uninstall the installed extension, clear storage or replace the production database. The store user count is managed by Google and can fluctuate; keeping the item preserves the installation/update path, reviews and listing identity.

The install/update handler keeps personal lines, media, settings, music and license records. The media database keeps its existing name and version; additions never delete existing stores. An automated upgrade test verifies personal clips, settings and paid ownership survive the update handler. Existing legacy purchases remain honoured by the plan engine.

## Prepared product materials

- Expanded landing page and feature guide, plus existing translated landing pages.
- Welcome screen with a direct Let's go → studio route, complete feature guide and mic test.
- English 110-second product tour, with burned-in captions, optional VTT captions, actual UI screenshots and clearly labelled simulated camera previews. Rebuild with `npm run tutorial`.
- Updated store description, reviewer instructions and usage-data disclosures in `STORE.md` and `store/listing/`.
- Existing exact store links, unchanged permission scope and production package distinct from the unlocked local-review copy.

Advanced new guide text and the tour are currently English. The VTT track and chapter metadata allow translated subtitle tracks later; selecting a different interface language does not currently change the video language.

## Payment status and safe launch sequence

The owner confirmed Razorpay is still rejected/pending. Changing a URL to an already approved site does not itself approve this product. Describe MemeBox accurately and obtain approval for its actual business, payment page and domain. Do not disguise the extension as a different business. A dedicated mykrutidev.com product page can explain the product and link its policies, but Razorpay must confirm the permitted arrangement. memebox.site remains the product's home.

The current gateway implementation accepts test keys only and refuses live keys. This candidate does not enable live Razorpay payments. The deployed legacy `/api/config` reported `payments: true` on 15 October 2026; that flag can represent manual UPI, so it is not evidence of Razorpay approval or live automated checkout.

1. Publish the accurate product landing/privacy/terms/refund/contact information for provider review when the owner authorizes that separate site deployment.
2. Obtain written provider approval for MemeBox and the website that will collect its payments. Set provider secrets only in secure Cloudflare environment settings, never in the extension or chat.
3. Validate test checkout on a separate test D1 database: success, decline, cancellation, pending capture, signed webhook retries, duplicate capture, top-ups, recovery and refunds. Automated fixture tests do not replace these provider tests.
4. After approval, implement and test explicit live-mode gating and production ledger reporting. Keep test receipts/orders separate from production. Review fees, receipts/tax and settlement requirements. This remains required work; setting `RAZORPAY_MODE=live` alone intentionally cannot open this build's checkout.
5. Back up/export the existing D1 database. Apply only missing additive migrations, each once, preserving licenses, orders, feedback and packs. Do not initialise a replacement database or rerun ALTER migrations blindly. Keep legacy usage reports accepted during the older-extension rollout.
6. Deploy the approved website/backend, verify the public domain and API, then open checkout only after the provider and browser flows pass. Preserve existing bindings, admin secrets and keys.
7. Build the production package with `npm run build:release && npm run zip`; upload `memebox-1.3.0.zip` to the existing Chrome item. Never upload `review/extension`: it is deliberately unlocked and points to localhost.
8. Update screenshots, description, privacy declarations (Authentication information and User activity), support links and a real active reviewer key. Store approval cannot be guaranteed. Submit the update and monitor rollout; users receive it through the same store item.

No production deployment, remote database migration, live payment activation or store submission was performed while preparing these materials.

## Validation

- 213 unit tests passed, including payment signatures, retry-safe time billing and existing entitlement rules.
- 39 selected source browser cases passed for the welcome page, themes/languages, landing video, feedback, admin, media and purchase/license flows. The caption-track and exact store-link checks also passed against the real local site CSP. A legacy version-1 media database upgraded without losing saved audio.
- 8 smoke cases passed against the extracted production ZIP, including Let's go, content/license preservation, legacy media migration and license activation/revocation.
- The 110-second 1280×800 video has an audio track; MP4 is about 1.3 MB and WebM about 1.6 MB. The extension uses the identical WebM. Caption and chapter files are local, with no remote player dependency.
- The full 145+ case browser suite and real provider/live-meeting tests were not repeated for this content/launch update. Store and payment-provider approval remain external prerequisites.
