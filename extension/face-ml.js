// MemeBox: face finding for "Follow me" (content script, ISOLATED world).
//
// mic-hook.js (the page) sends a small camera frame about 10 times a second while Follow me is on. This turns it into a small
// JPEG and asks the extension (background.js -> the offscreen document, where a small face model runs on this computer) where the
// face is, then tells the page. Nothing is uploaded, nothing is stored. It lives here, not in the page, so a call site's security
// policy cannot block the model.
(() => {
  'use strict';
  if (globalThis.MemeFaceMl) return;
  globalThis.MemeFaceMl = true;
  const HOOK = 'memebox-hook-9c1e';
  const BRIDGE = 'memebox-bridge-9c1e';
  let canvas = null, ctx = null;

  const reply = (face) => window.postMessage({ source: BRIDGE, type: 'face-result', face }, '*');

  async function toJpegBase64(bm) {
    if (!canvas || canvas.width !== bm.width || canvas.height !== bm.height) {
      canvas = new OffscreenCanvas(bm.width, bm.height);
      ctx = canvas.getContext('2d');
    }
    ctx.drawImage(bm, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  window.addEventListener('message', async (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || typeof d !== 'object' || d.source !== HOOK || d.type !== 'face-frame') return;
    const bm = d.bitmap;
    if (!bm || typeof bm.width !== 'number') return;
    try {
      const b64 = await toJpegBase64(bm);
      const res = await chrome.runtime.sendMessage({ type: 'face-detect', b64 });
      if (res && res.ok) reply(res.face && Number.isFinite(res.face.x) ? res.face : null); // no answer on failure: the picture falls back to skin colour
    } catch { /* the extension was reloaded or is busy: no answer */ }
    try { bm.close(); } catch { /* ignore */ }
  });
})();
