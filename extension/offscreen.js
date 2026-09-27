// MemeBox – offscreen document. Hosts the eSpeak-NG worker and answers
// { target: 'offscreen', type: 'tts', text, lang, espeak } with { ok, b64 } (a WAV file).
'use strict';

const worker = new Worker('tts-worker.js', { type: 'module' });
const pending = new Map();
let nextId = 1;

worker.onmessage = (e) => {
  const { id, ok, wav, error } = e.data;
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  if (ok) p.resolve(wav);
  else p.reject(new Error(error));
};
worker.onerror = (e) => {
  for (const p of pending.values()) p.reject(new Error('Speech engine crashed: ' + (e.message || 'unknown')));
  pending.clear();
};

function synth(text, lang, espeak) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, text, lang, espeak });
  });
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !msg || msg.target !== 'offscreen') return;
  if (msg.type === 'ping') {
    sendResponse({ ok: true });
    return;
  }
  if (msg.type === 'tts') {
    synth(msg.text, msg.lang, msg.espeak)
      .then((wav) => sendResponse({ ok: true, b64: toBase64(wav) }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // async response
  }
});

// Load the WASM engine right away so the first meme is quick.
synth('.', 'en', {}).catch(() => {});
