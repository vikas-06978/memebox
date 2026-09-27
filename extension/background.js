// MemeBox – service worker.
// - Routes messages between the frames of a call tab: the top frame hosts the UI,
//   while the frame that owns the microphone (usually the top one) plays the audio.
// - Turns lines into audio: text via the offscreen eSpeak-NG engine, clips from IndexedDB.
// - Forwards chrome.commands shortcuts (Alt+1…9) to the call tab.
importScripts('defaults.js', 'db.js');

const { TONES, LIMITS } = globalThis.MEME;

chrome.runtime.onInstalled.addListener(async () => {
  const { lines, settings } = await chrome.storage.local.get(['lines', 'settings']);
  const patch = {};
  if (!Array.isArray(lines)) patch.lines = MEME.defaultLines();
  if (!settings || typeof settings !== 'object') patch.settings = MEME.defaultSettings();
  if (Object.keys(patch).length) await chrome.storage.local.set(patch);
});

function sendToTab(tabId, msg, frameId) {
  const opts = frameId == null ? {} : { frameId };
  chrome.tabs.sendMessage(tabId, msg, opts).catch(() => {});
}

// ---------- speech engine (offscreen document) ----------

let creatingOffscreen = null;

async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existing.length) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS'],
      justification: 'Runs the bundled eSpeak-NG speech engine (WebAssembly) in a Web Worker to turn meme text into audio.',
    }).finally(() => { creatingOffscreen = null; });
  }
  await creatingOffscreen;
}

const ttsCache = new Map(); // key -> base64 WAV (small LRU)

async function tts(text, lang, toneId) {
  const key = `${lang}|${toneId}|${text}`;
  if (ttsCache.has(key)) {
    const hit = ttsCache.get(key);
    ttsCache.delete(key);
    ttsCache.set(key, hit);
    return hit;
  }
  await ensureOffscreen();
  const res = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'tts', text, lang, espeak: TONES[toneId].espeak });
  if (!res || !res.ok) throw new Error((res && res.error) || 'Speech engine did not answer');
  ttsCache.set(key, res.b64);
  while (ttsCache.size > 40) ttsCache.delete(ttsCache.keys().next().value);
  return res.b64;
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// ---------- memes from a link (streamed when played, never stored) ----------

const linkCache = new Map(); // url -> base64 (small LRU, memory only)

async function linkAudio(rawUrl) {
  const url = MEME.cleanUrl(rawUrl);
  if (!url) throw new Error('Bad link');
  if (linkCache.has(url)) return linkCache.get(url);
  const host = new URL(url).hostname;
  if (!(await chrome.permissions.contains({ origins: [MEME.originPattern(url)] }))) {
    throw new Error(`Allow ${host} first (Options → Lines → Allow)`);
  }
  let res;
  try {
    res = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch {
    throw new Error(`Couldn't reach ${host}`);
  }
  if (!res.ok) throw new Error(`${host} answered HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > LIMITS.linkBytes) throw new Error('That link is bigger than 5 MB');
  const b64 = toBase64(buf);
  linkCache.set(url, b64);
  while (linkCache.size > 10) linkCache.delete(linkCache.keys().next().value);
  return b64;
}

async function audioFor(item) {
  if (!item || typeof item !== 'object') throw new Error('Nothing to play');
  const tone = Object.prototype.hasOwnProperty.call(TONES, item.tone) ? item.tone : 'normal';
  if (item.kind === 'clip') {
    const clip = await MemeDB.getClip(String(item.clipId));
    if (!clip) throw new Error('Clip not found – re-upload it in Options');
    return { b64: toBase64(clip.bytes), tone };
  }
  if (item.kind === 'url') return { b64: await linkAudio(item.url), tone };
  const text = String(item.say || item.text || '').trim().slice(0, LIMITS.textChars);
  if (!text) throw new Error('Empty line');
  return { b64: await tts(text, item.lang === 'hi' ? 'hi' : 'en', tone), tone };
}

async function handlePlay(tabId, { frameId, reqId, item }) {
  try {
    const { b64, tone } = await audioFor(item);
    const t = TONES[tone];
    sendToTab(tabId, {
      type: 'hook',
      cmd: {
        type: 'play-audio', reqId, b64, playbackRate: t.playbackRate, gain: t.gain, effect: t.effect || '',
        text: String(item.text || '').slice(0, LIMITS.textChars),
      },
    }, frameId);
  } catch (err) {
    sendToTab(tabId, { type: 'play-result', reqId, ok: false, reason: err.message }, 0);
  }
}

// ---------- which tabs are in a call (for the popup) ----------
// Kept in storage.session so it survives the service worker going to sleep.
// { [tabId]: { frames: { [frameId]: true }, since, tabAudioFrom } }

async function getCallTabs() {
  const { callTabs } = await chrome.storage.session.get('callTabs');
  return callTabs && typeof callTabs === 'object' ? callTabs : {};
}

let callTabsQueue = Promise.resolve();
function updateCallTab(tabId, fn) {
  callTabsQueue = callTabsQueue.then(async () => {
    const all = await getCallTabs();
    const entry = all[tabId] || { frames: {}, since: 0, tabAudioFrom: null };
    fn(entry);
    if (Object.keys(entry.frames).length) all[tabId] = entry; else delete all[tabId];
    await chrome.storage.session.set({ callTabs: all });
  }).catch(() => {});
  return callTabsQueue;
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await updateCallTab(tabId, (e) => { e.frames = {}; });
  // A video tab that was feeding a call was closed: the capture ends by itself.
  const all = await getCallTabs();
  for (const [id, e] of Object.entries(all)) {
    if (e.tabAudioFrom === tabId) updateCallTab(Number(id), (x) => { x.tabAudioFrom = null; });
  }
});

// The most recently joined call tab, if any.
async function currentCall() {
  let best = null;
  for (const [id, e] of Object.entries(await getCallTabs())) {
    if (Object.keys(e.frames).length && (!best || e.since > best.since)) best = { tabId: Number(id), ...e };
  }
  return best;
}

// Popup asked to start tab audio; answered when the call tab reports back.
const pendingTabAudio = new Map(); // callTabId -> sendResponse

async function popupMessage(msg, sendResponse) {
  switch (msg.type) {
    case 'popup-info': {
      const call = await currentCall();
      sendResponse({
        callTabId: call ? call.tabId : null,
        thisIsCall: !!call && call.tabId === msg.tabId,
        sendingThisTab: !!call && call.tabAudioFrom === msg.tabId,
        sendingOther: !!call && call.tabAudioFrom != null && call.tabAudioFrom !== msg.tabId,
      });
      break;
    }
    case 'popup-start-tab-audio': {
      if (!Number.isInteger(msg.callTabId) || typeof msg.streamId !== 'string') { sendResponse({ ok: false, error: 'Bad request' }); break; }
      const prev = pendingTabAudio.get(msg.callTabId);
      if (prev) prev({ ok: false, error: 'Replaced by a newer request' });
      pendingTabAudio.set(msg.callTabId, sendResponse);
      setTimeout(() => {
        if (pendingTabAudio.get(msg.callTabId) === sendResponse) {
          pendingTabAudio.delete(msg.callTabId);
          sendResponse({ ok: false, error: "The call tab didn't answer – reload it and try again" });
        }
      }, 6000);
      await updateCallTab(msg.callTabId, (e) => { e.pendingFrom = msg.sourceTabId; });
      sendToTab(msg.callTabId, { type: 'tab-audio-start', streamId: msg.streamId }, 0);
      break;
    }
    case 'popup-stop-tab-audio':
      if (Number.isInteger(msg.callTabId)) sendToTab(msg.callTabId, { type: 'tab-audio-stop' }, 0);
      sendResponse({ ok: true });
      break;
  }
}

// ---------- messages ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !msg || typeof msg !== 'object' || msg.target) return;

  if (msg.type === 'open-options') {
    chrome.runtime.openOptionsPage();
    return;
  }
  if (!sender.tab) {
    // The toolbar popup (an extension page).
    if (/^popup-/.test(msg.type)) {
      popupMessage(msg, sendResponse);
      return true; // async response
    }
    return;
  }
  const tabId = sender.tab.id;

  switch (msg.type) {
    // A frame's mic hook reported something -> tell the UI in the top frame.
    case 'frame-status':
      updateCallTab(tabId, (e) => {
        const had = Object.keys(e.frames).length > 0;
        if (msg.active) e.frames[sender.frameId] = true; else delete e.frames[sender.frameId];
        if (!had && msg.active) e.since = Date.now();
      });
      sendToTab(tabId, { ...msg, frameId: sender.frameId }, 0);
      break;

    case 'play-result':
      sendToTab(tabId, { ...msg, frameId: sender.frameId }, 0);
      break;

    // The call tab started/stopped playing another tab's sound (or failed to).
    case 'tab-audio-state': {
      updateCallTab(tabId, (e) => {
        e.tabAudioFrom = msg.on ? (e.pendingFrom ?? e.tabAudioFrom) : null;
        delete e.pendingFrom;
      });
      const reply = pendingTabAudio.get(tabId);
      if (reply) {
        pendingTabAudio.delete(tabId);
        reply({ ok: msg.on === true, error: msg.error || '' });
      }
      if (!msg.fromUi) sendToTab(tabId, { ...msg, frameId: sender.frameId }, 0);
      break;
    }

    // UI asks every frame to re-announce its state.
    case 'query-status':
      sendToTab(tabId, { type: 'query-status' });
      break;

    // UI sends a simple command (stop, volume) to one frame.
    case 'to-frame':
      if (msg.inner && typeof msg.inner === 'object' && Number.isInteger(msg.frameId)) {
        sendToTab(tabId, msg.inner, msg.frameId);
      }
      break;

    // UI wants a line played into the mic of `frameId`.
    case 'play':
      if (Number.isInteger(msg.frameId)) handlePlay(tabId, msg);
      break;

    // A call started: load the speech engine in advance.
    case 'warmup':
      ensureOffscreen().catch(() => {});
      break;
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  const m = /^fav-([1-9])$/.exec(command);
  if (m && tab && tab.id >= 0) sendToTab(tab.id, { type: 'command', slot: Number(m[1]) }, 0);
});
