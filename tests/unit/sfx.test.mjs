// The built-in sound effects: every effect the packs use has a file, the files are loud, clean mono WAVs,
// and they are exactly what tools/lib/sfx.mjs renders (so nobody edits a .wav by hand and loses the recipe).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EXT, loadScript } from './helpers.mjs';
import { EFFECTS, render, SR } from '../../tools/lib/sfx.mjs';

const dir = path.join(EXT, 'sfx');
const G = loadScript(['config.js', 'defaults.js', 'packs.js']);

function stats(buf) {
  assert.equal(buf.toString('latin1', 0, 4), 'RIFF');
  assert.equal(buf.readUInt16LE(20), 1, 'PCM');
  assert.equal(buf.readUInt16LE(22), 1, 'mono');
  assert.equal(buf.readUInt32LE(24), SR);
  assert.equal(buf.readUInt16LE(34), 16);
  const n = (buf.length - 44) / 2;
  let peak = 0, sum = 0, active = 0;
  for (let i = 0; i < n; i++) { const v = buf.readInt16LE(44 + i * 2) / 32768; peak = Math.max(peak, Math.abs(v)); if (Math.abs(v) > 0.02) { sum += v * v; active++; } }
  return { seconds: n / SR, peak, rmsDb: 20 * Math.log10(Math.sqrt(sum / Math.max(1, active))) };
}

test('every effect has a WAV file, and every file is an effect', () => {
  const ids = Object.keys(EFFECTS).sort();
  assert.deepEqual(fs.readdirSync(dir).map((f) => f.replace(/\.wav$/, '')).sort(), ids);
  if (G) assert.deepEqual([...G.MEME.SFX].sort(), ids, 'defaults.js lists the same effects');
});

test('effects are short, loud and even', () => {
  for (const id of Object.keys(EFFECTS)) {
    const s = stats(fs.readFileSync(path.join(dir, `${id}.wav`)));
    assert.ok(s.seconds >= 0.8 && s.seconds <= 3.2, `${id} is ${s.seconds.toFixed(1)} s`);
    assert.ok(s.peak >= 0.35 && s.peak <= 0.95, `${id} peak ${s.peak.toFixed(2)}`); // dense effects (airhorn) are capped by loudness, not peak
    assert.ok(s.rmsDb >= -12 && s.rmsDb <= -9, `${id} loudness ${s.rmsDb.toFixed(1)} dB`);
  }
});

test('the files are exactly what the recipe renders', () => {
  for (const id of Object.keys(EFFECTS)) {
    assert.ok(fs.readFileSync(path.join(dir, `${id}.wav`)).equals(render(id)), `${id}.wav is out of date: run npm run sfx`);
  }
});

test('the Sound effects pack plays every effect once, with a friendly caption', () => {
  if (!G) return;
  const lines = [...G.MEME_PACKS.lines('effects')];
  assert.deepEqual([...lines.map((l) => l.sfx)].sort(), Object.keys(EFFECTS).sort());
  for (const l of lines) { assert.equal(l.kind, 'sfx'); assert.equal(l.category, 'effects'); assert.ok(l.text.length <= 40, l.text); }
});
