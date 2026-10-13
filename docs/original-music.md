# MemeBox original Phonk

Three synthesized arrangements use original note/rhythm sequences in `extension/lib/music.js`. They contain no imported recordings, ripped vocals or samples from the referenced YouTube playlists.

| Track | BPM | Arrangement |
| --- | ---: | --- |
| Desi Phonk | 108 | 32 bars, syncopated percussion and bright plucks |
| Drift Phonk | 144 | 32 bars, driving kick pattern and metallic cowbell |
| Midnight Phonk | 96 | 32 bars, half-time drums and wider, slower melody |

Each has an intro, build, drop and break. Cowbell partials, bass slides, pads, hats and drum fills are generated with Web Audio. Bell stereo width is modest and works when the call mixes to mono. The drop is denser than the intro/break. Ending oscillator/noise nodes disconnect to limit long-session graph growth. Character/light mood signals now include the three originals.

These arrangements are looped in the extension. Website auto-next uses each arrangement's actual duration. Auto-duck still lowers music while the user talks. No per-play hosting/storage charge is created by the synthesizer, though delivering the extension/site itself uses their respective platforms.

Render full stereo review WAVs with:

```
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright node tools/render-original-music.mjs
```

The helper uses the exact shared engine, a reproducible noise seed, conservative export gain and start/end fades. It checks finite samples, non-silent output and peak levels before writing local review files. Files are not uploaded to R2. Review WAVs are not final mastered release assets: listening on headphones, phone speakers and a real call, plus weak-laptop performance checks, remain necessary before describing their subjective quality as release-ready.
