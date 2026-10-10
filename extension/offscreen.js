// MemeBox: offscreen document. Hosts the eSpeak-NG worker and answers
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

// ---- face finding for "Follow me" (a small bundled face model, MediaPipe BlazeFace; runs here, on this computer) ----
let faceDetector = null, faceLoading = null;
function loadFace() {
  if (faceDetector) return Promise.resolve(faceDetector);
  if (!faceLoading) {
    faceLoading = (async () => {
      const wasm = await (await fetch(chrome.runtime.getURL('ml/vision-wasm.wasm'))).arrayBuffer();
      const model = new Uint8Array(await (await fetch(chrome.runtime.getURL('ml/face-detector.tflite'))).arrayBuffer());
      globalThis.Module = { wasmBinary: wasm }; // the loader script is already on this page, so give it the bytes directly
      faceDetector = await globalThis.MemeVision.FaceDetector.createFromOptions(
        { wasmLoaderPath: '', wasmBinaryPath: 'vision-wasm.wasm' },
        { baseOptions: { modelAssetBuffer: model, delegate: 'CPU' }, runningMode: 'IMAGE', minDetectionConfidence: 0.5 });
      return faceDetector;
    })().catch((e) => { faceLoading = null; throw e; });
  }
  return faceLoading;
}

// A small JPEG of the camera picture in, the biggest face out (position and size, 0..1), or null for an empty picture.
async function findFace(b64) {
  const det = await loadFace();
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const bm = await createImageBitmap(new Blob([u], { type: 'image/jpeg' }));
  try {
    let best = null;
    for (const d of det.detect(bm).detections || []) {
      const b = d.boundingBox;
      if (b && (!best || b.width * b.height > best.w * best.h)) best = { w: b.width, h: b.height, ox: b.originX, oy: b.originY };
    }
    const W = bm.width, H = bm.height;
    return best ? { x: (best.ox + best.w / 2) / W, y: (best.oy + best.h / 2) / H, w: best.w / W, h: best.h / H } : null;
  } finally { bm.close(); }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !msg || msg.target !== 'offscreen') return;
  if (msg.type === 'face') {
    findFace(String(msg.b64 || ''))
      .then((face) => sendResponse({ ok: true, face }))
      .catch((err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));
    return true; // async response
  }
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
