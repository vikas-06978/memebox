# Third-party software and credits

## eSpeak-NG (speech synthesizer)

- Files: `vendor/espeak-ng/espeak-ng.js` (JavaScript glue with the WebAssembly binary embedded) and `vendor/espeak-ng/espeak-ng.data` (phoneme data plus the English and Hindi dictionaries).
- License: GNU General Public License v3.0 or later. The full text is in `vendor/espeak-ng/COPYING` and in `LICENSE`.
- Copyright: © 2005-2014 Jonathan Duddington (original eSpeak), © 2015 onwards Reece H. Dunn and the eSpeak-NG contributors.
- Upstream project: https://github.com/espeak-ng/espeak-ng
- Emscripten build: `@echogarden/espeak-ng-emscripten` version 0.3.5, from the Echogarden project, licensed GPL-3.0.
  - Build scripts: https://github.com/echogarden-project/espeak-ng-emscripten
  - Source fork: https://github.com/echogarden-project/espeak-ng (branch `fork`)

### Changes we made

`tools/vendor-espeak.mjs` repackages the published npm build. It removes every dictionary except `en_dict` and `hi_dict`, and removes the MBROLA voice stubs. It then rewrites the file-package table in `espeak-ng.js` to match. The WebAssembly code is not modified. Run `npm run vendor` to reproduce the bundled files exactly.

## Everything else

Everything else is original work for MemeBox, licensed GPL-3.0-or-later: the icons, the default meme lines, and all other code.
