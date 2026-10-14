# MemeBox original Phonk

Three synthesized arrangements use original note/rhythm sequences in `extension/lib/music.js`. They contain no imported recordings, ripped vocals or samples from the referenced YouTube playlists.

| Track | BPM | Arrangement |
| --- | ---: | --- |
| Desi Phonk | 150 | 32 bars, syncopated percussion, rolling bass and layered hook |
| Drift Phonk | 156 | 32 bars, four-on-the-floor drops, 808 slides and metallic hook |
| Midnight Phonk | 144 | 32 bars, darker dance groove with full-time drums |

Each now has 4 intro bars, 4 build bars, 8 drop bars, 4 breakdown bars, 4 build bars and 8 second-drop bars. Snare subdivision accelerates and filtered noise rises during each build; the last two beats pause before an impact, crash, full kick/snare groove and bass. Second drops add octave/answer layers. First drops land at 12.8 / 12.31 / 13.33 seconds, inside the panel’s 20-second preview. Cowbell partials, bass slides, pads, hats and drum fills are generated with Web Audio. Bell stereo width is modest and works when the call mixes to mono. The drop is denser than the intro/break. Ending oscillator/noise nodes disconnect to limit long-session graph growth. Character/light mood signals now include the three originals.

These arrangements are looped in the extension. Website auto-next uses each arrangement's actual duration. Auto-duck still lowers music while the user talks. No per-play hosting/storage charge is created by the synthesizer, though delivering the extension/site itself uses their respective platforms.

Render full stereo review WAVs with:

```
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright node tools/render-original-music.mjs
```

The helper uses the exact shared engine, a reproducible noise seed, conservative export gain and start/end fades. It checks finite samples, non-silent output and peak levels before writing local review files. Files are not uploaded to R2. Review WAVs are not final mastered release assets: listening on headphones, phone speakers and a real call, plus weak-laptop performance checks, remain necessary before describing their subjective quality as release-ready.

The renderer also checks the actual waveform before/after each drop, requiring an audible drop level and at least fourfold RMS contrast. This verifies arrangement contrast, not subjective musical quality or professional mastering. The offline listening room has buttons that start two seconds before the first drop so the pause and impact can be compared quickly.
