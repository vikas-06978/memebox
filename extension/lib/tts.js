// MemeBox – eSpeak-NG text-to-speech core (ES module).
// Used by tts-worker.js inside the offscreen document, and directly by the Node tests.
import createModule from '../vendor/espeak-ng/espeak-ng.js';
import { encodeWav16 } from './wav.js';

let enginePromise = null;

export function engine() {
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

export const VOICES = { hi: 'hi', en: 'en-us' };

// text + language + tone's eSpeak settings -> WAV ArrayBuffer (mono, 16-bit, 22050 Hz).
export async function synthesizeWav(text, lang, espeak = {}) {
  const w = await engine();
  w.set_voice(VOICES[lang] || VOICES.en);
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
  return encodeWav16(chunks, w.get_samplerate());
}
