# Paste-ready store text

Plain text for each Chrome Web Store dashboard box. Open a file, select all, copy, paste. `STORE.md` is the source; the unit tests check these match it.

Update the existing item `bbpfkaedpfabehgikgpagbjhjcmlcpnl`; do not create another item. The current candidate keeps the existing extension storage and license records. See `docs/release-existing-users.md` for payment prerequisites, unchanged-user rollout and the production package distinction.

Privacy practices for this release need Authentication information **and User activity**, because signed pass reports and optional feature counters exist. The optional counters are off by default. Replace the reviewer-key placeholder before submitting. New screenshots 5 and 6 show character/outfit and filter previews. The new English product video has captions; a Chrome listing promotional video requires a separately uploaded YouTube URL, not the local MP4 file. The landing and welcome pages use the local video directly.

| File | Dashboard box |
| --- | --- |
| `description.txt` | Store listing → Description |
| `single-purpose.txt` | Privacy → Single purpose description |
| `permission-storage.txt` | Privacy → storage justification |
| `permission-offscreen.txt` | Privacy → offscreen justification |
| `permission-tabcapture.txt` | Privacy → tabCapture justification |
| `permission-host.txt` | Privacy → Host permission justification (1,000 characters max) |
| `test-instructions.txt` | Test instructions → Additional instructions. Replace `MBX-XXXX-XXXX-XXXX` with a real Pro key from `/admin`. |
