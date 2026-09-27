// Step 2 – the bundled eSpeak-NG WASM really speaks Hindi and English with every tone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EXT, loadScript } from './helpers.mjs';
import { synthesizeWav } from '../../extension/lib/tts.js';
import { wavInfo } from '../../extension/lib/wav.js';

const { MEME } = loadScript('defaults.js');

test('bundled eSpeak only ships English + Hindi dictionaries (small, no CDN)', () => {
  const js = fs.readFileSync(path.join(EXT, 'vendor/espeak-ng/espeak-ng.js'), 'utf8');
  const dicts = [...js.matchAll(/espeak-ng-data\/(\w+)_dict"/g)].map((m) => m[1]).sort();
  assert.deepEqual(dicts, ['en', 'hi']);
  assert.doesNotMatch(js, /https?:\/\/[^"'\s]*\.(wasm|data)/, 'no remote wasm/data URLs');
  const size = fs.statSync(path.join(EXT, 'vendor/espeak-ng/espeak-ng.data')).size;
  assert.ok(size < 2e6, `data file is small (${size} bytes)`);
});

for (const lang of ['hi', 'en']) {
  test(`${lang}: every tone produces a valid, non-silent WAV`, async () => {
    const text = lang === 'hi' ? 'भाई तू रहने दे' : 'Emotional damage!';
    for (const [id, tone] of Object.entries(MEME.TONES)) {
      const wav = await synthesizeWav(text, lang, tone.espeak);
      const info = wavInfo(wav);
      assert.equal(info.channels, 1);
      assert.equal(info.sampleRate, 22050);
      assert.ok(info.seconds > 0.3 && info.seconds < 10, `${id}: ${info.seconds.toFixed(2)} s`);
      const pcm = new Int16Array(wav, 44);
      const peak = pcm.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
      assert.ok(peak > 3000, `${id}: audible (peak ${peak})`);
    }
  });
}

test('tones change the speed: slow-mo > normal > chipmunk in length', async () => {
  const len = async (t) => wavInfo(await synthesizeWav('Task failed successfully', 'en', MEME.TONES[t].espeak)).seconds;
  const [slow, normal, chip] = [await len('slowmo'), await len('normal'), await len('chipmunk')];
  assert.ok(slow > normal * 1.4, `slow-mo ${slow.toFixed(2)} vs normal ${normal.toFixed(2)}`);
  assert.ok(normal > chip, `normal ${normal.toFixed(2)} vs chipmunk ${chip.toFixed(2)}`);
});
