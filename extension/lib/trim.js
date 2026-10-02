// MemeBox: clip trimmer maths (pure functions, classic script, also loaded by unit tests).
(() => {
  'use strict';

  const WAV_HEADER = 44;
  const RATES = [44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000];

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // Longest mono 16-bit WAV (seconds) that fits in `limitBytes` at `sampleRate`.
  function maxSeconds(sampleRate, limitBytes) {
    return Math.max(0, (limitBytes - WAV_HEADER) / 2 / sampleRate);
  }

  // Best (highest) sample rate at which `seconds` of mono 16-bit audio fits the limit,
  // never above the source rate. Returns 0 if even 8 kHz is too big.
  function fitSampleRate(seconds, limitBytes, sourceRate = 48000) {
    for (const r of RATES) {
      if (r > sourceRate && r !== RATES[RATES.length - 1]) continue;
      if (Math.ceil(seconds * r) * 2 + WAV_HEADER <= limitBytes) return r;
    }
    return 0;
  }

  // Keep a selection inside the clip, in order, and at least `minLen` long.
  function clampRange(start, end, duration, minLen = 0.1) {
    let s = clamp(Number(start) || 0, 0, duration);
    let e = clamp(Number(end) || 0, 0, duration);
    if (e < s) [s, e] = [e, s];
    if (e - s < minLen) {
      e = Math.min(duration, s + minLen);
      s = Math.max(0, e - minLen);
    }
    return { start: s, end: e };
  }

  const pxToTime = (px, width, duration) => (width > 0 ? clamp(px / width, 0, 1) * duration : 0);
  const timeToPx = (time, width, duration) => (duration > 0 ? clamp(time / duration, 0, 1) * width : 0);

  // Min/max pairs for drawing a waveform with `buckets` columns.
  function peaks(samples, buckets) {
    const n = Math.max(1, Math.floor(buckets));
    const out = new Array(n);
    const per = samples.length / n;
    for (let i = 0; i < n; i++) {
      const from = Math.floor(i * per);
      const to = Math.max(from + 1, Math.floor((i + 1) * per));
      let lo = 0, hi = 0;
      for (let j = from; j < to && j < samples.length; j++) {
        const v = samples[j];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      out[i] = [lo, hi];
    }
    return out;
  }

  // Float samples (-1..1) -> 16-bit mono WAV, with a short fade in/out to avoid clicks.
  function floatToWav16(samples, sampleRate, fadeMs = 5) {
    const n = samples.length;
    const buf = new ArrayBuffer(WAV_HEADER + n * 2);
    const v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    const fade = Math.min(Math.floor(n / 2), Math.round((sampleRate * fadeMs) / 1000));
    for (let i = 0; i < n; i++) {
      let s = clamp(samples[i], -1, 1);
      if (i < fade) s *= i / fade;
      else if (i >= n - fade) s *= (n - 1 - i) / fade;
      v.setInt16(WAV_HEADER + i * 2, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
    }
    return buf;
  }

  // "1:05.3" style labels.
  function formatTime(sec) {
    const s = Math.max(0, Number(sec) || 0);
    const m = Math.floor(s / 60);
    const r = s - m * 60;
    return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
  }

  globalThis.MemeTrim = Object.freeze({ WAV_HEADER, RATES, maxSeconds, fitSampleRate, clampRange, pxToTime, timeToPx, peaks, floatToWav16, formatTime });
})();
