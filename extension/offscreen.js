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

// ---- face and hands for "Follow me" (small bundled models, MediaPipe; they run here, on this computer) ----
// The face model gives where your face is and how it looks (smile, blink, mouth open, tongue out, kiss);
// the hand model gives raised hands (wave, thumbs up, peace). Both load only when the first picture arrives.
const vision = { factory: null, wasm: null, face: null, hand: null, loading: {} };
async function bytes(path) { return (await fetch(chrome.runtime.getURL(path))).arrayBuffer(); }
async function loadTask(name, Cls, modelPath, extra) {
  if (vision[name]) return vision[name];
  if (!vision.loading[name]) {
    vision.loading[name] = (async () => {
      if (!vision.wasm) { vision.wasm = await bytes('ml/vision-wasm.wasm'); vision.factory = globalThis.ModuleFactory; }
      const model = new Uint8Array(await bytes(modelPath));
      // The loader script is already on this page; it forgets itself after each use, so give it back with the wasm bytes.
      globalThis.ModuleFactory = vision.factory; globalThis.Module = { wasmBinary: vision.wasm };
      vision[name] = await Cls.createFromOptions({ wasmLoaderPath: '', wasmBinaryPath: 'vision-wasm.wasm' },
        { baseOptions: { modelAssetBuffer: model, delegate: 'CPU' }, runningMode: 'VIDEO', ...extra });
      return vision[name];
    })().catch((e) => { vision.loading[name] = null; throw e; });
  }
  return vision.loading[name];
}
const loadFace = () => loadTask('face', globalThis.MemeVision.FaceLandmarker, 'ml/face-landmarker.task', { numFaces: 1, outputFaceBlendshapes: true });
const loadHand = () => loadTask('hand', globalThis.MemeVision.HandLandmarker, 'ml/hand-landmarker.task', { numHands: 2 });

const BS = { blinkL: ['eyeBlinkLeft'], blinkR: ['eyeBlinkRight'], jaw: ['jawOpen'], smile: ['mouthSmileLeft', 'mouthSmileRight'], tongue: ['tongueOut'], brow: ['browInnerUp'], pucker: ['mouthPucker'], wide: ['eyeWideLeft', 'eyeWideRight'] };
let lastTs = 0;

// A small JPEG of the camera picture in; out: the face (position, size and how it looks), and raised hands when asked.
async function findFace(b64, wantHands) {
  const faceTask = await loadFace();
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const bm = await createImageBitmap(new Blob([u], { type: 'image/jpeg' }));
  try {
    lastTs = Math.max(lastTs + 1, Math.round(performance.now()));
    const fr = faceTask.detectForVideo(bm, lastTs);
    let face = null, bs = null;
    const lm = fr.faceLandmarks && fr.faceLandmarks[0];
    if (lm && lm.length) {
      let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
      for (const p of lm) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
      face = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, pose: globalThis.MemeHands.headPose(lm) };
      const cats = fr.faceBlendshapes && fr.faceBlendshapes[0] && fr.faceBlendshapes[0].categories || [];
      const m = {}; for (const c of cats) m[c.categoryName] = c.score;
      bs = {}; for (const [k, names] of Object.entries(BS)) bs[k] = names.reduce((a, n) => a + (m[n] || 0), 0) / names.length;
    }
    let hands = null;
    if (wantHands) {
      try {
        const handTask = await loadHand();
        lastTs = Math.max(lastTs + 1, Math.round(performance.now()));
        hands = (handTask.detectForVideo(bm, lastTs).landmarks || []).map(globalThis.MemeHands.handInfo);
        if (globalThis.MemeHands.twoHandHeart(hands)) for (const h of hands) h.heart2 = true;
      } catch { hands = null; }
    }
    return { face, bs, hands };
  } finally { bm.close(); }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !msg || msg.target !== 'offscreen') return;
  if (msg.type === 'face') {
    findFace(String(msg.b64 || ''), msg.hands === true)
      .then((r) => sendResponse({ ok: true, ...r }))
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
