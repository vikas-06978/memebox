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

## QR Code Generator (website only)

- File: `site/public/assets/vendor/qrcode.js`, used by the website's /buy page to draw the UPI QR code. It is not part of the extension.
- Version: `qrcode-generator` 2.0.4 from npm, unchanged.
- License: MIT. Copyright © 2009 Kazuhiko Arase. https://github.com/kazuhikoarase/qrcode-generator
- "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.

## MediaPipe Tasks Vision and the BlazeFace model (face finding for "Follow me")

- Files: `extension/ml/vision-bundle.js` (the library, wrapped as a classic script), `extension/ml/vision-wasm.js` and `extension/ml/vision-wasm.wasm` (its WebAssembly runtime), `extension/ml/face-detector.tflite` (the BlazeFace short-range face detector).
- Version: `@mediapipe/tasks-vision` 0.10.21 from npm, unchanged apart from the wrapper. The model is Google's `blaze_face_short_range` float16 model from the MediaPipe model collection.
- License: Apache License 2.0. Copyright © Google LLC. https://github.com/google-ai-edge/mediapipe
- It runs in the extension's offscreen document on the person's own computer. Camera pictures are not uploaded or stored.

## Everything else

Everything else is original work for MemeBox, licensed GPL-3.0-or-later: the icons, the default meme lines, and all other code.
