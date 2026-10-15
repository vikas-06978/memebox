# Download and try MemeBox 1.3.1

These files are for review. No website deployment or live payment activation is included.

- [Download the complete 1.3.1 test bundle](https://github.com/vikas-06978/memebox/blob/review/memebox-local-2026-10-14/review/downloads/memebox-1.3.1-test.zip?raw=true)
- [Production candidate, for the later store release](https://github.com/vikas-06978/memebox/blob/review/memebox-local-2026-10-14/review/downloads/memebox-1.3.1.zip?raw=true)
- [Download the English captioned video](https://github.com/vikas-06978/memebox/blob/review/memebox-local-2026-10-14/site/public/assets/tutorial.mp4?raw=true)

Use the **complete test bundle** while the new website player has not been deployed. It contains the current player and launcher as well as the extension. The old 1.3.0 production download is superseded. Extract the whole new version folder, run Start-MemeBox-Music.cmd on Windows and keep that window open, then load the extension subfolder in a separate Chrome profile. macOS/Linux can use Python 3 and start-music.py. No Node installation or Windows execution-policy change is required. The extension still has paid gates and checkout remains closed; premium items are discoverable as previews.

If GitHub asks you to sign in, use the account with access to this repository. Each ZIP is about 18 MB; video is about 1.3 MB. Checksums are in SHA256SUMS.txt. The eventual public production release needs the current HTTP player deployed first; ordinary users will not need the local review launcher after that deployment.

For the ZIP, extract into a new folder, open chrome://extensions, enable Developer mode and choose Load unpacked for the folder containing manifest.json. This is the production candidate: paid gates stay enabled and it uses memebox.site. The separate review/extension folder is unlocked for local feature testing. A locally loaded production ZIP does not automatically replace the existing store extension or share its saved data. Use a separate Chrome profile for this manual test so you can keep the installed store extension and its data intact. The eventual update must be uploaded to the existing store item bbpfkaedpfabehgikgpagbjhjcmlcpnl so users receive the normal in-place update.

Open the loaded extension's menu → Options to explore it. Paid features need a valid owner/license key; existing store licenses can be activated in the test profile without uninstalling the store extension. Keep an active time pass off except when intentionally testing it: the production candidate can report real pass usage to the current backend.
