# Local review before release

This review is pushed only to the dedicated testing branch, with a deployment-skip commit prefix. No site, production database or Web Store deployment is requested. For GitHub Download ZIP, follow `../START-HERE.md`: the ready-to-load folder is `review/extension`, and the offline player is `review/listen.html`. The earlier standalone review archive contains:

- `extension/`: a separate unpacked build named **MemeBox Local Review**, with paid features unlocked only in this copy and purchases unavailable. Its site address is loopback; production license settings remain unchanged in source.
- `listen.html` and `music/`: three full original synthesized arrangements with native audio controls. Extract the archive, then open `listen.html` in Chrome. No server or internet is required.
- `source/`: current development source, tests and documentation, without Git history, environment secrets, local databases or dependencies.

In Chrome open `chrome://extensions`, enable Developer mode, choose Load unpacked and select `extension/`. Open extension options and Playground to review characters, accessories, reactions, lights and music. Then test a real call. Do not publish the unlocked review build.

Backend pages require a local server. From the source folder run `npm ci` and `npm run site:dev` with a supported Node version. Copy `site/.dev.vars.example` only for local configuration. See `payment-testing.md` before provider testing; test credentials are not included and live payments remain disabled.

The 30 YouTube titles are an editable shortlist, not verified playable additions. Official video IDs and embedding/rights checks remain pending. The embedded player cannot remove YouTube advertisements or guarantee permanent availability.

Hosted uploads, public hosted-file delivery and admin file previews require explicit `HOSTED_FILES_ENABLED=on`. Stored file deletion is also paused while that flag is off, so deleting catalog records cannot orphan the corresponding objects. Hosted audio additionally requires `HOSTED_AUDIO_ENABLED=on`. Ordinary disabled file requests return before database/bucket access; text memes and verified YouTube links remain independent of hosted files. These guards do not cap a provider's billing or change the account plan. Original music executes on the device.

Validation for this review: 195 unit tests passed; six browser tests passed against the separate review extension, covering original outgoing audio and Playground. All three local WAVs decoded and played in Chrome from `file://`, one at a time, with no external HTTP requests or page errors. Actual Meet calls and weak-laptop performance remain owner review tasks.

For this GitHub review, the final 195 unit tests passed. The full browser run covered 117 cases: 116 passed initially, and the single old hosted-upload fixture failed because it had not opted into the new default-off flag. After that fixture was updated, the same admin-upload case passed on its targeted rerun. Both hosted fixtures now opt in explicitly. The new GitHub review folder was independently tested unlocked with no license and all three offline WAVs played from its actual path.
