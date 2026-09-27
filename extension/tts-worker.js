// MemeBox – eSpeak-NG text-to-speech worker (module worker inside the offscreen document).
// Input:  { id, text, lang: 'hi'|'en', espeak: { rate, pitch, range, volume } }
// Output: { id, ok: true, wav: ArrayBuffer } or { id, ok: false, error }
import createModule from './vendor/espeak-ng/espeak-ng.js';

let enginePromise = null;

function engine() {
  if (!enginePromise) {
    enginePromise = createModule({}).then((m) => new m.eSpeakNGWorker());
    enginePromise.catch(() => { enginePromise = null; });
  }
  return enginePromise;
}

function clamp(v, lo, hi, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : dflt;
}

function encodeWav(chunks, sampleRate) {
  const samples = chunks.reduce((n, c) => n + c.length, 0);
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples * 2, true);
  const out = new Int16Array(buf, 44);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return buf;
}

self.onmessage = async (e) => {
  const { id, text, lang, espeak = {} } = e.data || {};
  try {
    const w = await engine();
    w.set_voice(lang === 'hi' ? 'hi' : 'en-us');
    w.set_rate(clamp(espeak.rate, 80, 450, 175));
    w.set_pitch(clamp(espeak.pitch, 0, 99, 50));
    w.set_range(clamp(espeak.range, 0, 99, 50));
    w.set_volume(clamp(espeak.volume, 0, 200, 100));
    const chunks = [];
    w.synthesize(String(text), (samples) => {
      if (samples && samples.length) chunks.push(samples);
      return false; // false = keep going
    });
    if (!chunks.length) throw new Error('eSpeak produced no audio');
    const wav = encodeWav(chunks, w.get_samplerate());
    self.postMessage({ id, ok: true, wav }, [wav]);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
