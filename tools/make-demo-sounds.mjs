// npm run demo-sounds: renders the landing page's try-it meme voices with the bundled
// eSpeak-NG (the same engine as the extension) into site/public/assets/demo/*.wav.
import fs from 'node:fs';
import path from 'node:path';
import { synthesizeWav } from '../extension/lib/tts.js';

const OUT = path.resolve(import.meta.dirname, '..', 'site', 'public', 'assets', 'demo');
const NORMAL = { rate: 175, pitch: 50, range: 50, volume: 100 };

// id, what eSpeak says, language. The page shows the English caption.
export const DEMO_LINES = [
  ['bruh', 'Bruh.', 'en'],
  ['damage', 'Emotional damage!', 'en'],
  ['twist', 'Plot twist!', 'en'],
  ['chai', 'चाय ब्रेक!', 'hi'],
  ['rehne', 'भाई तू रहने दे', 'hi'],
];

fs.mkdirSync(OUT, { recursive: true });
for (const [id, text, lang] of DEMO_LINES) {
  const wav = await synthesizeWav(text, lang, NORMAL);
  fs.writeFileSync(path.join(OUT, `${id}.wav`), Buffer.from(wav));
  console.log(`assets/demo/${id}.wav  ${(wav.byteLength / 1024).toFixed(0)} KB`);
}
