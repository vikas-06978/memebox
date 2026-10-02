// Step 5: the live voice changer's pitch shifter (lib/pitch-shift.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScript } from './helpers.mjs';

const { MemePitchShifter } = loadScript('lib/pitch-shift.js');
const SR = 48000;

function sine(freq, seconds, amp = 0.5) {
  const x = new Float32Array(Math.round(SR * seconds));
  for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return x;
}

// Runs the shifter in 128-sample blocks, like an AudioWorklet does.
function run(ratio, input) {
  const ps = new MemePitchShifter(SR);
  ps.ratio = ratio;
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += 128) ps.process(input.subarray(i, i + 128), out.subarray(i, i + 128));
  return out;
}

// Dominant frequency by DFT magnitude over a range (after the first 0.2 s settle).
function dominantHz(x, lo = 50, hi = 2000) {
  const seg = x.subarray(Math.round(SR * 0.2));
  let best = 0;
  let bestHz = 0;
  for (let f = lo; f <= hi; f += 2) {
    let re = 0;
    let im = 0;
    const w = (2 * Math.PI * f) / SR;
    for (let i = 0; i < seg.length; i += 2) { re += seg[i] * Math.cos(w * i); im += seg[i] * Math.sin(w * i); }
    const mag = re * re + im * im;
    if (mag > best) { best = mag; bestHz = f; }
  }
  return bestHz;
}

test('ratio 1 passes the voice through unchanged', () => {
  const x = sine(300, 0.3);
  const y = run(1, x);
  assert.deepEqual(Array.from(y), Array.from(x));
});

for (const [name, ratio, input, expected] of [
  ['Chipmunk raises the pitch (200 → 320 Hz)', 1.6, 200, 320],
  ['Deep lowers the pitch (300 → 216 Hz)', 0.72, 300, 216],
]) {
  test(name, () => {
    const hz = dominantHz(run(ratio, sine(input, 1)));
    assert.ok(Math.abs(hz - expected) <= expected * 0.03, `got ${hz} Hz, expected ~${expected}`);
  });
}

test('output stays in range and keeps its loudness (no clicks, no boost)', () => {
  for (const ratio of [0.72, 1.6]) {
    const y = run(ratio, sine(250, 1, 0.8));
    let peak = 0;
    let sum = 0;
    for (const v of y.subarray(SR * 0.2)) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
    const rms = Math.sqrt(sum / (y.length - SR * 0.2));
    assert.ok(peak <= 0.8 + 1e-6, `ratio ${ratio}: peak ${peak}`);
    assert.ok(rms > 0.8 / Math.SQRT2 * 0.6, `ratio ${ratio}: rms ${rms} too quiet`);
  }
});

test('bad ratios are clamped instead of breaking the audio', () => {
  for (const ratio of [0, -3, NaN, 100]) {
    const y = run(ratio, sine(200, 0.2));
    assert.ok(y.every(Number.isFinite), `ratio ${ratio} gives finite samples`);
  }
});

test('the write position wraps without a glitch', () => {
  const ps = new MemePitchShifter(SR);
  ps.ratio = 1.6;
  ps.write = 0x3fffffff - 64; // just before the counter wraps
  const out = new Float32Array(256);
  ps.process(sine(200, 256 / SR), out);
  assert.ok(out.every(Number.isFinite));
});
