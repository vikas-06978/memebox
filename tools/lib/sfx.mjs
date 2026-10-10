// MemeBox sound effects: original, synthesized in plain JavaScript (no samples, no licences to worry
// about). Every effect is rendered the same way every time (seeded noise), loud and clear on purpose:
// the call has to hear it over a microphone. Used by tools/make-sfx.mjs (writes extension/sfx/*.wav)
// and by tools/make-tutorial.mjs (the file it uploads in the video).
export const SR = 24000;
const TAU = Math.PI * 2;
const T = (sec) => Math.round(sec * SR);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// RBJ biquad filters. type: lp, hp, bp (0 dB at the centre), peak.
class Biquad {
  constructor(type, f, q = 0.707, gainDb = 0) { this.type = type; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f, q, gainDb); }
  set(f, q = this.q, gainDb = this.gainDb) {
    this.q = q; this.gainDb = gainDb;
    const w = (TAU * Math.min(f, SR * 0.45)) / SR, cos = Math.cos(w), alpha = Math.sin(w) / (2 * q), A = 10 ** (gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    if (this.type === 'lp') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; }
    else if (this.type === 'hp') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; }
    else if (this.type === 'bp') { b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; }
    else { b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  p(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

const saw = (ph) => 2 * (ph - Math.floor(ph)) - 1;
const square = (ph) => (ph - Math.floor(ph) < 0.5 ? 1 : -1);
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const decay = (t, tau) => Math.exp(-t / tau);
// Attack then release inside a note of length `len`.
const adsr = (t, len, a, r) => Math.min(1, t / a) * Math.min(1, Math.max(0, (len - t) / r));

function buffer(sec) { return new Float32Array(T(sec)); }
function addAt(out, src, at, gain = 1) {
  const o = T(at);
  for (let i = 0; i < src.length && o + i < out.length; i++) out[o + i] += src[i] * gain;
}
function drive(x, amount) { const n = Math.tanh(amount); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * amount) / n; return x; }

// Small room: four combs and two allpasses. Adds a tail, so give the buffer room for it.
function reverb(x, mix = 0.25, size = 1) {
  const combs = [0.0297, 0.0371, 0.0411, 0.0437].map((d) => ({ d: T(d * size), buf: new Float32Array(T(d * size)), i: 0 }));
  const aps = [0.005, 0.0017].map((d) => ({ d: T(d), buf: new Float32Array(T(d)), i: 0 }));
  const out = new Float32Array(x.length);
  for (let n = 0; n < x.length; n++) {
    let wet = 0;
    for (const c of combs) { const y = c.buf[c.i]; c.buf[c.i] = x[n] + y * 0.78; c.i = (c.i + 1) % c.d; wet += y; }
    wet *= 0.25;
    for (const a of aps) { const y = a.buf[a.i]; const v = wet + y * 0.5; a.buf[a.i] = v; wet = y - v * 0.5; a.i = (a.i + 1) % a.d; }
    out[n] = x[n] + wet * mix * 2.2;
  }
  return out;
}

// ---------- drums ----------
function snare(len = 0.3, pitch = 200, seed = 1) {
  const r = rng(seed), out = buffer(len), bp = new Biquad('bp', 2600, 0.6), hp = new Biquad('hp', 900);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, f = pitch * (0.78 + 0.22 * decay(t, 0.03));
    ph += f / SR;
    const noise = hp.p(bp.p(r() * 2 - 1)) * decay(t, 0.07) * 2.6;
    out[i] = noise + Math.sin(TAU * ph) * decay(t, 0.05) * 0.9;
  }
  return out;
}
function tom(len = 0.4, f0 = 140) {
  const out = buffer(len); let ph = 0;
  for (let i = 0; i < out.length; i++) { const t = i / SR; ph += (f0 * (0.65 + 0.35 * decay(t, 0.08))) / SR; out[i] = Math.sin(TAU * ph) * decay(t, 0.13) * 1.2; }
  return out;
}
function kick(len = 0.4) {
  const out = buffer(len); let ph = 0;
  for (let i = 0; i < out.length; i++) { const t = i / SR; ph += (48 + 110 * decay(t, 0.03)) / SR; out[i] = Math.tanh(Math.sin(TAU * ph) * decay(t, 0.16) * 2.2); }
  return out;
}
function cymbal(len = 1.2, seed = 3, tau = 0.4) {
  const r = rng(seed), out = buffer(len), hp = new Biquad('hp', 5200, 0.8), hp2 = new Biquad('hp', 5200, 0.8);
  const fr = [263, 400, 421, 474, 587, 845], ph = fr.map(() => 0);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR; let m = 0;
    for (let k = 0; k < fr.length; k++) { ph[k] += (fr[k] * 5.3) / SR; m += square(ph[k]); }
    out[i] = (hp2.p(m / 4) * 0.7 + hp.p(r() * 2 - 1) * 1.1) * decay(t, tau) * Math.min(1, t / 0.002);
  }
  return out;
}

// ---------- the effects ----------
function airhorn() {
  const out = buffer(1.9);
  // Three blasts, like the one every soundboard has: short, short, long (and it droops at the end).
  const blasts = [[0, 0.2], [0.27, 0.49], [0.58, 1.75]];
  const freqs = [349, 415, 466, 622, 932];
  for (const [s, e] of blasts) {
    const len = e - s, n = T(len), ph = freqs.map(() => 0), seg = new Float32Array(n);
    const last = e > 1.5;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const bend = last ? 1 - 0.1 * smooth((t - (len - 0.6)) / 0.6) : 1;
      let v = 0;
      for (let k = 0; k < freqs.length; k++) {
        ph[k] += (freqs[k] * bend * (1 + (k - 2) * 0.004)) / SR;
        v += (saw(ph[k]) * 0.7 + square(ph[k]) * 0.3) * (k === 4 ? 0.5 : 1);
      }
      seg[i] = v * (1 + 0.1 * Math.sin(TAU * 17 * t)) * adsr(t, len, 0.008, 0.06) * 0.35;
    }
    addAt(out, seg, s);
  }
  const body = new Biquad('peak', 1900, 0.9, 10);
  for (let i = 0; i < out.length; i++) out[i] = body.p(out[i]);
  return drive(out, 3.5);
}

function sadTrombone() {
  const notes = [[233.08, 0.0, 0.5], [220.0, 0.5, 1.0], [207.65, 1.0, 1.5], [196.0, 1.5, 2.9]];
  const out = buffer(3.0), r = rng(7), lp = new Biquad('lp', 600, 2.2);
  let ph = 0, ph2 = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let f = 196, amp = 0, openness = 0, nt = 0;
    for (let k = 0; k < notes.length; k++) {
      const [nf, s, e] = notes[k];
      if (t >= s && t < e) {
        nt = t - s; f = nf; amp = adsr(nt, e - s, 0.05, k === 3 ? 0.35 : 0.04) * (0.8 + 0.2 * decay(nt, 0.4));
        if (k > 0 && nt < 0.07) f = notes[k - 1][0] + (nf - notes[k - 1][0]) * smooth(nt / 0.07); // slide in
        if (k === 3) f *= 1 - 0.14 * smooth((nt - 0.35) / 1.05) + 0.013 * Math.sin(TAU * 5.4 * nt) * smooth(nt / 0.5); // sag + vibrato
        openness = k === 3 ? Math.min(1, nt / 0.12) * (0.35 + 0.65 * decay(nt, 0.7)) : Math.min(1, nt / 0.1) * decay(nt, 0.3) ; // the "wah"
      }
    }
    ph += f / SR; ph2 += (f * 1.003) / SR;
    lp.set(300 + 1700 * openness, 2.2);
    const src = saw(ph) * 0.6 + saw(ph2) * 0.4 + (r() * 2 - 1) * 0.03;
    out[i] = lp.p(src) * amp * 1.6;
  }
  return drive(out, 1.8);
}

function rimshot() {
  const out = buffer(1.7);
  addAt(out, snare(0.3, 210, 11), 0, 1);
  addAt(out, tom(0.45, 125), 0.17, 1.1);
  addAt(out, snare(0.3, 215, 12), 0.17, 0.6);
  addAt(out, kick(0.4), 0.44, 1.1);
  addAt(out, cymbal(1.2, 5, 0.38), 0.44, 0.95);
  return drive(out, 1.6);
}

function drumroll() {
  const out = buffer(3.0), r = rng(21);
  let t = 0, n = 0;
  while (t < 1.85) {
    const p = t / 1.85, rate = 13 + 19 * p, amp = 0.28 + 0.72 * p;
    addAt(out, snare(0.09, 190 + (n % 2) * 12, 100 + n), t, amp * (0.8 + 0.4 * r()));
    t += 1 / rate; n++;
  }
  addAt(out, kick(0.4), 1.9, 1.2);
  addAt(out, snare(0.3, 205, 3), 1.9, 1.0);
  addAt(out, cymbal(1.1, 9, 0.45), 1.9, 1.0);
  return drive(out, 1.6);
}

function wrongBuzzer() {
  const out = buffer(1.15), lp = new Biquad('lp', 1500, 0.9);
  const hits = [[0, 0.36, 110], [0.46, 1.1, 104]];
  for (const [s, e, f] of hits) {
    const len = e - s, n = T(len), seg = new Float32Array(n); let a = 0, b = 0, c = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR; a += f / SR; b += (f * 1.025) / SR; c += (f * 2) / SR;
      seg[i] = lp.p(square(a) * 0.5 + square(b) * 0.5 + saw(c) * 0.4) * adsr(t, len, 0.004, 0.03);
    }
    addAt(out, seg, s);
  }
  return drive(out, 2.6);
}

function tada() {
  const out = buffer(2.3), lp = new Biquad('lp', 2200, 0.8);
  const note = (f, at, len, g) => {
    const n = T(len), seg = new Float32Array(n); let a = 0, b = 0, c = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR; a += f / SR; b += (f * 1.004) / SR; c += (f * 2) / SR;
      seg[i] = (saw(a) * 0.5 + saw(b) * 0.4 + Math.sin(TAU * c) * 0.2) * adsr(t, len, 0.012, Math.min(0.25, len * 0.6)) * (0.75 + 0.25 * decay(t, 0.3)) * g;
    }
    addAt(out, seg, at);
  };
  note(523.25, 0.0, 0.14, 0.7); note(659.25, 0.12, 0.14, 0.75); note(783.99, 0.24, 0.14, 0.8);
  for (const f of [523.25, 659.25, 783.99, 1046.5]) note(f, 0.42, 1.2, 0.6);
  for (let i = 0; i < out.length; i++) out[i] = lp.p(out[i]);
  return drive(reverb(out, 0.22), 1.5);
}

function boing() {
  const out = buffer(1.2); let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const f = 190 + 520 * decay(t, 0.45) + 160 * Math.sin(TAU * 13 * t) * decay(t, 0.25);
    ph += f / SR;
    out[i] = (Math.sin(TAU * ph) + 0.55 * Math.sin(TAU * ph * 2) + 0.25 * Math.sin(TAU * ph * 3)) * decay(t, 0.4) * Math.min(1, t / 0.004) * 0.7;
  }
  return drive(out, 1.4);
}

function slideWhistle() {
  const out = buffer(1.7), r = rng(31); let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let f;
    if (t < 0.6) f = 420 * (1900 / 420) ** smooth(t / 0.6);
    else if (t < 0.75) f = 1900;
    else f = 1900 * (560 / 1900) ** smooth((t - 0.75) / 0.7);
    f *= 1 + 0.018 * Math.sin(TAU * 6.2 * t) * smooth(t / 0.3);
    ph += f / SR;
    out[i] = (Math.sin(TAU * ph) * 0.9 + (r() * 2 - 1) * 0.03) * adsr(t, 1.5, 0.03, 0.12);
  }
  return drive(out, 1.5);
}

function crickets() {
  const out = buffer(2.8);
  const voice = (f, period, offset, g) => {
    for (let s = offset; s < 2.6; s += period) {
      for (let p = 0; p < 3; p++) { // a chirp is three quick pulses
        const at = s + p * 0.04, n = T(0.026), seg = new Float32Array(n); let ph = 0;
        for (let i = 0; i < n; i++) { const t = i / SR; ph += (f * (1 + 0.02 * (t / 0.026))) / SR; seg[i] = Math.sin(TAU * ph) * Math.sin((Math.PI * t) / 0.026) ** 1.5; }
        addAt(out, seg, at, g);
      }
    }
  };
  voice(4300, 0.33, 0.05, 0.8); voice(4900, 0.43, 0.2, 0.6); voice(3900, 0.57, 0.12, 0.45);
  return drive(out, 1.2);
}

function applause() {
  const out = buffer(3.0), r = rng(41), bed = new Biquad('bp', 2500, 0.4);
  const dens = (t) => smooth(t / 0.5) * (1 - smooth((t - 2.1) / 0.8));
  for (let i = 0; i < out.length; i++) out[i] = bed.p(r() * 2 - 1) * dens(i / SR) * 0.55;
  for (let t = 0; t < 3.0; t += 0.002) {
    if (r() < 0.002 * 1.0 * 110 * dens(t)) {
      const n = T(0.012 + r() * 0.02), f = 1100 + r() * 2600, seg = new Float32Array(n), bp = new Biquad('bp', f, 0.9);
      for (let i = 0; i < n; i++) seg[i] = bp.p(r() * 2 - 1) * decay(i / SR, 0.006) * 3;
      addAt(out, seg, t, 0.3 + r() * 0.9);
    }
  }
  return drive(out, 1.8);
}

function evilLaugh() {
  const out = buffer(3.0), r = rng(51);
  const formants = [new Biquad('bp', 720, 7), new Biquad('bp', 1150, 9), new Biquad('bp', 2500, 11)], gains = [1, 0.75, 0.35];
  const syll = [[0.0, 0.55, 118, 175], [0.7, 0.28, 178, 120], [1.05, 0.28, 172, 115], [1.4, 0.28, 165, 110], [1.75, 0.4, 158, 98]];
  let ph = 0;
  for (const [s, len, f0, f1] of syll) {
    const n = T(len), seg = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR, p = t / len;
      const f = (f0 + (f1 - f0) * smooth(p)) * (1 + 0.012 * Math.sin(TAU * 5.5 * t));
      ph += f / SR;
      const glottal = saw(ph) * 0.8 + (r() * 2 - 1) * (0.12 + 0.5 * decay(t, 0.025)); // breathy at the start of each "ha"
      let v = 0;
      for (let k = 0; k < 3; k++) v += formants[k].p(glottal) * gains[k];
      seg[i] = v * adsr(t, len, 0.02, 0.1) * (0.7 + 0.3 * (1 - p));
    }
    addAt(out, seg, s);
  }
  return drive(reverb(out, 0.2), 4);
}

function dramatic() {
  const out = buffer(3.0), lp = new Biquad('lp', 1100, 1.1);
  const hit = (f, at, len, g) => {
    const n = T(len), seg = new Float32Array(n); let a = 0, b = 0, c = 0, th = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR; a += f / SR; b += (f * 1.005) / SR; c += (f * 2) / SR; th += (f * 0.5 * (1 + 0.5 * decay(t, 0.08))) / SR;
      const brass = (saw(a) * 0.5 + saw(b) * 0.4 + square(c) * 0.25) * adsr(t, len, 0.02, Math.min(0.5, len * 0.5)) * (0.55 + 0.45 * decay(t, len * 0.6));
      seg[i] = (brass + Math.sin(TAU * th) * decay(t, 0.3) * 1.1) * g;
    }
    addAt(out, seg, at);
  };
  hit(130.8, 0.0, 0.5, 0.9); hit(130.8, 0.55, 0.5, 0.95); hit(98.0, 1.1, 1.85, 1.1);
  for (let i = 0; i < out.length; i++) out[i] = lp.p(out[i]);
  return drive(reverb(out, 0.3, 1.4), 1.8);
}

function recordScratch() {
  const out = buffer(1.1), r = rng(61), bp = new Biquad('bp', 1000, 2.5);
  let ph = 0;
  const strokes = [[0.0, 0.3, 300, 2600], [0.3, 0.58, 2600, 400], [0.62, 0.95, 350, 3200]];
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    for (const [s, e, f0, f1] of strokes) {
      if (t >= s && t < e) {
        const p = (t - s) / (e - s), f = f0 * (f1 / f0) ** smooth(p);
        bp.set(f * 1.4, 2.5); ph += f / SR;
        const v = bp.p(r() * 2 - 1) * 1.8 + saw(ph) * 0.6 + (r() < 0.002 ? 1.5 : 0);
        out[i] = v * Math.sin(Math.PI * p) ** 0.6;
      }
    }
  }
  return drive(out, 2.2);
}

// Only used in the tutorial video (a file to upload): a deep movie "boom".
function boom() {
  const out = buffer(1.6); let ph = 0; const r = rng(71), lp = new Biquad('lp', 400);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR; ph += (42 + 170 * decay(t, 0.05)) / SR;
    out[i] = Math.sin(TAU * ph) * decay(t, 0.45) * 1.6 + lp.p(r() * 2 - 1) * decay(t, 0.12) * 1.2;
  }
  return drive(reverb(out, 0.25, 1.2), 2.4);
}

export const EFFECTS = {
  airhorn, 'sad-trombone': sadTrombone, rimshot, drumroll, 'wrong-buzzer': wrongBuzzer, tada, boing,
  'slide-whistle': slideWhistle, crickets, applause, 'evil-laugh': evilLaugh, dramatic, 'record-scratch': recordScratch,
};
export const EXTRA = { boom };

// Loud and even: bring the active part to about -12 dBFS RMS, soft-limit, then peak at -1 dBFS.
export function master(x) {
  let dc = 0; for (const v of x) dc += v; dc /= x.length;
  for (let i = 0; i < x.length; i++) x[i] -= dc;
  let sum = 0, n = 0; for (const v of x) if (Math.abs(v) > 0.02) { sum += v * v; n++; }
  const rms = Math.sqrt(sum / Math.max(1, n)), gain = 0.25 / Math.max(rms, 1e-4);
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * gain * 0.9);
  let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < x.length; i++) x[i] *= 0.89 / peak;
  // Square-ish effects (airhorn, buzzer) come out much denser than the rest: pull those down to the same level.
  sum = 0; n = 0; for (const v of x) if (Math.abs(v) > 0.02) { sum += v * v; n++; }
  const rms2 = Math.sqrt(sum / Math.max(1, n));
  if (rms2 > 0.3) for (let i = 0; i < x.length; i++) x[i] *= 0.3 / rms2;
  let end = x.length; while (end > 0 && Math.abs(x[end - 1]) < 0.003) end--; // trim the silent tail
  const fade = Math.min(T(0.03), end);
  for (let i = 0; i < fade; i++) x[end - 1 - i] *= i / fade;
  return x.subarray(0, Math.min(x.length, end + T(0.05)));
}

export function toWav(samples) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return b;
}

export const render = (name) => toWav(master((EFFECTS[name] || EXTRA[name])()));
