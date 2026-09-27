// MemeBox – eSpeak-NG text-to-speech worker (module worker inside the offscreen document).
// Input:  { id, text, lang: 'hi'|'en', espeak: { rate, pitch, range, volume } }
// Output: { id, ok: true, wav: ArrayBuffer } or { id, ok: false, error }
import { synthesizeWav } from './lib/tts.js';

self.onmessage = async (e) => {
  const { id, text, lang, espeak = {} } = e.data || {};
  try {
    const wav = await synthesizeWav(text, lang, espeak);
    self.postMessage({ id, ok: true, wav }, [wav]);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
