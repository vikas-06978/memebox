# Download and try MemeBox 1.3.0

These files are for review. No website deployment or live payment activation is included.

- [Download the production ZIP](https://github.com/vikas-06978/memebox/blob/review/memebox-local-2026-10-14/review/downloads/memebox-1.3.0.zip?raw=true)
- [Download the English captioned video](https://github.com/vikas-06978/memebox/blob/review/memebox-local-2026-10-14/site/public/assets/tutorial.mp4?raw=true)

If GitHub asks you to sign in, use the account with access to this repository. File sizes: ZIP about 18 MB; video about 1.3 MB. Checksums are in SHA256SUMS.txt.

For the ZIP, extract into a new folder, open chrome://extensions, enable Developer mode and choose Load unpacked for the folder containing manifest.json. This is the production candidate: paid gates stay enabled and it uses memebox.site. The separate review/extension folder is unlocked for local feature testing. A locally loaded production ZIP does not automatically replace the existing store extension or share its saved data. Use a separate Chrome profile for this manual test so you can keep the installed store extension and its data intact. The eventual update must be uploaded to the existing store item bbpfkaedpfabehgikgpagbjhjcmlcpnl so users receive the normal in-place update.

Open the loaded extension's menu → Options to explore it. Paid features need a valid owner/license key; existing store licenses can be activated in the test profile without uninstalling the store extension. Keep an active time pass off except when intentionally testing it: the production candidate can report real pass usage to the current backend.
