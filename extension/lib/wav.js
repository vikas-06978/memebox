// MemeBox: WAV helpers (ES module, used by tts-worker.js and the tests).

// Int16 chunks (mono) -> 16-bit PCM WAV file.
export function encodeWav16(chunks, sampleRate) {
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

// Reads the header of a 16-bit PCM WAV: { sampleRate, channels, samples, seconds }.
export function wavInfo(buf) {
  const v = new DataView(buf);
  const tag = (o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');
  const channels = v.getUint16(22, true);
  const sampleRate = v.getUint32(24, true);
  const bytes = v.getUint32(40, true);
  const samples = bytes / 2 / channels;
  return { sampleRate, channels, samples, seconds: samples / sampleRate };
}
