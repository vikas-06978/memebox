// MemeBox: bridge (content script, ISOLATED world, every frame).
//
// page (mic-hook.js)  <-- window.postMessage, checked `source` -->  this script
// this script         <-- chrome.runtime messaging            -->  service worker
//
// In the top frame, ui.js (same world) registers MemeBridge.onUiMessage to get UI messages.
(() => {
  'use strict';
  if (globalThis.MemeBridge) return;

  const HOOK = 'memebox-hook-9c1e';
  const BRIDGE = 'memebox-bridge-9c1e';
  const HOOK_COMMANDS = new Set(['query-status', 'beep', 'stop', 'volume', 'duck', 'monitor', 'resume',
    'tab-audio-start', 'tab-audio-stop', 'tab-audio-volume']);

  function toRuntime(msg) {
    try {
      chrome.runtime.sendMessage(msg).catch(() => {});
      return true;
    } catch {
      return false; // Extension was reloaded. This old content script is orphaned.
    }
  }

  function toHook(msg, transfer) {
    window.postMessage({ ...msg, source: BRIDGE }, '*', transfer || []);
  }

  // A real number or the default (0 is a valid gain, so no `|| 1`).
  const num = (v, dflt) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : dflt);

  function base64ToBuffer(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  // Page -> extension. Only accept messages from our own mic hook in this frame.
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || typeof d !== 'object' || d.source !== HOOK) return;
    if (d.type === 'status') {
      toRuntime({ type: 'frame-status', active: d.active === true, muted: d.muted === true, ctxState: String(d.ctxState) });
    } else if (d.type === 'played') {
      toRuntime({ type: 'play-result', reqId: d.reqId, ok: d.ok === true, muted: d.muted === true, reason: d.reason ? String(d.reason) : '' });
    } else if (d.type === 'tab-audio') {
      toRuntime({ type: 'tab-audio-state', on: d.on === true, error: d.error ? String(d.error) : '' });
    }
  });

  // Extension -> page.
  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (sender.id !== chrome.runtime.id || !msg || typeof msg !== 'object' || msg.target) return;
    if (msg.type === 'query-status') {
      toHook({ type: 'query-status' });
    } else if (msg.type === 'hook' && msg.cmd && typeof msg.cmd === 'object') {
      const cmd = msg.cmd;
      if (cmd.type === 'play-audio' && typeof cmd.b64 === 'string') {
        const bytes = base64ToBuffer(cmd.b64);
        toHook({
          type: 'play-audio', reqId: cmd.reqId, bytes,
          playbackRate: num(cmd.playbackRate, 1), gain: num(cmd.gain, 1), effect: String(cmd.effect || ''),
          text: String(cmd.text || '').slice(0, 300),
        }, [bytes]);
      } else if (cmd.type === 'voice') {
        // The hook (page world) can't look up extension URLs itself.
        toHook({ type: 'voice', value: String(cmd.value), url: chrome.runtime.getURL('voice-worklet.js') });
      } else if (HOOK_COMMANDS.has(cmd.type)) {
        toHook({ type: cmd.type, reqId: cmd.reqId, value: cmd.value });
      }
    } else if (window === window.top && typeof MemeBridge.onUiMessage === 'function') {
      MemeBridge.onUiMessage(msg);
    }
  });

  // Camera captions must be known before the call asks for the camera, and in every
  // frame (the camera may be opened by an iframe), so each bridge passes the setting on.
  try {
    const allowed = () => !globalThis.MemePlan || globalThis.MemePlan.can('captions'); // PRO: camera captions
    const sendCam = (settings) => toHook({ type: 'cam-captions', value: !!(settings && settings.camCaptions === true) && allowed() });
    chrome.storage.local.get('settings').then((r) => sendCam(r.settings)).catch(() => {});
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.settings) sendCam(changes.settings.newValue);
    });
  } catch { /* orphaned */ }

  globalThis.MemeBridge = { toRuntime, onUiMessage: null };
})();
