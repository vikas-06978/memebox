// Step 4: waveform trimmer maths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScript } from './helpers.mjs';

const { MemeTrim: T } = loadScript('lib/trim.js');
// Values from the sandbox have another realm's prototypes, so compare plain copies.
const plain = (v) => JSON.parse(JSON.stringify(v));
const MB = 1024 * 1024;

test('maxSeconds: how much mono 16-bit audio fits in 1 MB', () => {
  assert.equal(T.maxSeconds(22050, MB).toFixed(2), '23.78');
  assert.equal(T.maxSeconds(44100, MB).toFixed(2), '11.89');
  assert.equal(T.maxSeconds(8000, 44), 0);
});

test('fitSampleRate picks the best rate that fits and never upsamples', () => {
  assert.equal(T.fitSampleRate(5, MB, 48000), 44100);   // short clip: full quality
  assert.equal(T.fitSampleRate(20, MB, 48000), 24000);  // 20 s needs a lower rate
  assert.equal(T.fitSampleRate(5, MB, 16000), 16000);   // source is only 16 kHz
  assert.equal(T.fitSampleRate(60, MB, 48000), 8000);   // just fits at 8 kHz
  assert.equal(T.fitSampleRate(70, MB, 48000), 0);      // too long for 1 MB
  const r = T.fitSampleRate(11.89, MB, 48000);
  assert.ok(Math.ceil(11.89 * r) * 2 + 44 <= MB);
});

test('clampRange keeps the selection inside, ordered and long enough', () => {
  assert.deepEqual(plain(T.clampRange(2, 5, 10)), { start: 2, end: 5 });
  assert.deepEqual(plain(T.clampRange(5, 2, 10)), { start: 2, end: 5 });
  assert.deepEqual(plain(T.clampRange(-3, 50, 10)), { start: 0, end: 10 });
  const tiny = T.clampRange(9.99, 9.99, 10);
  assert.ok(tiny.end - tiny.start >= 0.1 - 1e-9 && tiny.end <= 10);
  assert.deepEqual(plain(T.clampRange('x', undefined, 4)), { start: 0, end: 0.1 });
});

test('pixel <-> time conversions round-trip and clamp', () => {
  assert.equal(T.pxToTime(150, 300, 12), 6);
  assert.equal(T.timeToPx(6, 300, 12), 150);
  assert.equal(T.pxToTime(-5, 300, 12), 0);
  assert.equal(T.pxToTime(999, 300, 12), 12);
  assert.equal(T.timeToPx(3, 300, 0), 0);
});

test('peaks gives one min/max pair per column', () => {
  const s = new Float32Array([0, 0.5, -0.25, 1, -1, 0.1, 0, 0]);
  assert.deepEqual(plain(T.peaks(s, 4)), [[0, 0.5], [-0.25, 1], [-1, Math.fround(0.1)], [0, 0]]);
  assert.equal(T.peaks(s, 3).length, 3);
  assert.equal(T.peaks(new Float32Array(0), 5).length, 5);
});

test('floatToWav16 writes a valid WAV with click-free fades', () => {
  const n = 1000;
  const wav = T.floatToWav16(new Float32Array(n).fill(0.5), 8000, 5);
  const v = new DataView(wav);
  assert.equal(wav.byteLength, 44 + n * 2);
  assert.equal(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3)), 'RIFF');
  assert.equal(v.getUint32(24, true), 8000);
  assert.equal(v.getInt16(44, true), 0, 'fades in from silence');
  assert.equal(v.getInt16(44 + 500 * 2, true), Math.round(0.5 * 0x7fff), 'full level in the middle');
  assert.equal(v.getInt16(44 + (n - 1) * 2, true), 0, 'fades out to silence');
  const clipped = new DataView(T.floatToWav16(new Float32Array([0, 3, -3, 0]), 8000, 0));
  assert.equal(clipped.getInt16(46, true), 0x7fff);
  assert.equal(clipped.getInt16(48, true), -0x8000);
});

test('formatTime', () => {
  assert.equal(T.formatTime(0), '0:00.0');
  assert.equal(T.formatTime(65.34), '1:05.3');
});
