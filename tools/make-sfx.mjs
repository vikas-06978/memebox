// npm run sfx: renders the built-in sound effects into extension/sfx/*.wav (24 kHz, 16-bit, mono).
// They are synthesized (see tools/lib/sfx.mjs), so there are no samples and no licences. Run it again
// after changing an effect, then commit the .wav files.
import fs from 'node:fs';
import path from 'node:path';
import { EFFECTS, render, SR } from './lib/sfx.mjs';

const out = path.resolve(import.meta.dirname, '..', 'extension', 'sfx');
fs.mkdirSync(out, { recursive: true });
let total = 0;
for (const name of Object.keys(EFFECTS)) {
  const wav = render(name);
  fs.writeFileSync(path.join(out, `${name}.wav`), wav);
  total += wav.length;
  console.log(`sfx/${name}.wav  ${((wav.length - 44) / 2 / SR).toFixed(2)} s  ${(wav.length / 1024).toFixed(0)} KB`);
}
console.log(`total ${(total / 1024).toFixed(0)} KB`);
