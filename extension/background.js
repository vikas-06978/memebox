// MemeBox: service worker.
// - Routes messages between the frames of a call tab: the top frame hosts the UI,
//   while the frame that owns the microphone (usually the top one) plays the audio.
// - Turns lines into audio: text via the offscreen eSpeak-NG engine, clips from IndexedDB.
// - Forwards chrome.commands shortcuts (Alt+1…9) to the call tab.
importScripts('config.js', 'defaults.js', 'packs.js', 'db.js');

const { TONES, LIMITS } = globalThis.MEME;

// First install: the general pack + every built-in pack. Updates from before packs existed
// get the new packs added once (their own lines are kept).
const PACKS_SEEDED = 1;
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: 'onboarding.html' }).catch(() => {});
  const { lines, settings, seeded } = await chrome.storage.local.get(['lines', 'settings', 'seeded']);
  const patch = {};
  if (!Array.isArray(lines)) {
    patch.lines = MEME_PACKS.all();
  } else if ((seeded || 0) < PACKS_SEEDED) {
    const have = new Set(lines.map((l) => l && l.id));
    patch.lines = [...lines, ...MEME_PACKS.all().filter((l) => !have.has(l.id)).map((l) => ({ ...l, fav: 0 }))];
  }
  patch.seeded = PACKS_SEEDED;
  if (!settings || typeof settings !== 'object') patch.settings = MEME.defaultSettings();
  await chrome.storage.local.set(patch);
});

// ---------- feedback ----------
// The feedback page gets only the version and the call site. The uninstall survey only the version.
const { SITE_URL, STORE_URL } = globalThis.MEMEBOX_CONFIG;
const VERSION = chrome.runtime.getManifest().version;
const FEEDBACK_SITES = ['meet', 'zoom', 'teams', 'discord'];
const ASK_AFTER_PLAYS = 10;

function feedbackUrl(site) {
  const u = new URL(SITE_URL + '/feedback');
  u.searchParams.set('v', VERSION);
  if (FEEDBACK_SITES.includes(site)) u.searchParams.set('site', site);
  return u.href;
}

function openFeedback({ site, rate } = {}) {
  chrome.tabs.create({ url: rate && STORE_URL ? STORE_URL : feedbackUrl(site) });
}

// ---------- license: check the saved key with the site once a day ----------
// A key turned off in /admin stops working at the next check. Offline, the last answer is
// trusted for MemePlan.LICENSE_MAX_AGE_MS. Runs whenever the service worker starts.
const LICENSE_CHECK_MS = 24 * 3600 * 1000;

async function refreshLicense() {
  const { license } = await chrome.storage.local.get('license');
  if (!license || typeof license.key !== 'string' || Date.now() - (Number(license.checkedAt) || 0) < LICENSE_CHECK_MS) return;
  const res = await fetch(SITE_URL + '/api/license', {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key: license.key }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.ok) await chrome.storage.local.set({ license: { ...data.license, checkedAt: Date.now() } });
  else if (res.status === 404) await chrome.storage.local.set({ license: { ...license, status: 'revoked', checkedAt: Date.now() } });
}
refreshLicense().catch(() => {}); // offline: try again next time

chrome.runtime.setUninstallURL(`${SITE_URL}/uninstall?v=${encodeURIComponent(VERSION)}`).catch(() => {});

// Counts plays. After the 10th, asks once (and never again) in that call tab.
async function countPlay(tabId) {
  const { stats } = await chrome.storage.local.get('stats');
  const s = stats && typeof stats === 'object' ? stats : {};
  const plays = (Number(s.plays) || 0) + 1;
  const ask = plays >= ASK_AFTER_PLAYS && !s.askedFeedback;
  await chrome.storage.local.set({ stats: { ...s, plays, ...(ask ? { askedFeedback: true } : {}) } });
  if (ask) sendToTab(tabId, { type: 'ask-feedback' }, 0);
}

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

async function audioFor(item) {
  if (!item || typeof item !== 'object') throw new Error('Nothing to play');
  const tone = Object.prototype.hasOwnProperty.call(TONES, item.tone) ? item.tone : 'normal';
  if (item.kind === 'clip') {
    const clip = await MemeDB.getClip(String(item.clipId));
    if (!clip) throw new Error('Clip not found. Re-upload it in Options.');
    return { b64: toBase64(clip.bytes), tone };
  }
  const text = String(item.say || item.text || '').trim().slice(0, LIMITS.textChars);
  if (!text) throw new Error('Empty line');
  return { b64: await tts(text, item.lang === 'hi' ? 'hi' : 'en', tone), tone };
}

async function handlePlay(tabId, { frameId, reqId, item }) {
  try {
    const { b64, tone } = await audioFor(item);
    const t = TONES[tone];
    const lineVolume = Number.isFinite(Number(item.volume)) ? Math.min(2, Math.max(0, Number(item.volume))) : 1;
    // The line's meme picture: to the UI (your screen) and to the mic frame (your camera).
    let picture = null;
    if (item.pictureId) {
      const p = await MemeDB.getPicture(String(item.pictureId)).catch(() => null);
      if (p && /^image\/(webp|png|jpeg|gif)$/.test(p.type)) picture = { b64: toBase64(p.bytes), type: p.type };
    }
    if (picture) sendToTab(tabId, { type: 'show-picture', reqId, b64: picture.b64, mime: picture.type }, 0);
    sendToTab(tabId, {
      type: 'hook',
      cmd: {
        type: 'play-audio', reqId, b64, playbackRate: t.playbackRate, gain: t.gain * lineVolume, effect: t.effect || '',
        text: String(item.text || '').slice(0, LIMITS.textChars),
        ...(picture ? { picture: picture.b64, pictureType: picture.type } : {}),
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

// Popup asked to start tab audio, answered when the call tab reports back.
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
          sendResponse({ ok: false, error: "The call tab didn't answer. Reload it and try again." });
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
  if (msg.type === 'open-feedback') {
    openFeedback({ site: String(msg.site || ''), rate: msg.rate === true });
    return;
  }
  // The toolbar popup: an extension page (also when popup.html is opened in a tab).
  const fromExtensionPage = typeof sender.url === 'string' && sender.url.startsWith(chrome.runtime.getURL(''));
  if (fromExtensionPage && /^popup-/.test(msg.type)) {
    popupMessage(msg, sendResponse);
    return true; // async response
  }
  if (!sender.tab) return;
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

    // A meme was played (used for the one-time "Enjoying MemeBox?" ask).
    case 'played-one':
      countPlay(tabId).catch(() => {});
      break;

    // A call started: load the speech engine in advance.
    case 'warmup':
      ensureOffscreen().catch(() => {});
      break;
  }
});

// Keyboard shortcuts (chrome://extensions/shortcuts). They go to the tab you are in if it's
// a call tab, otherwise to your current call, so Alt+1 works even from a YouTube tab.
const COMMANDS = /^(fav-[1-9]|stop-all|toggle-ui|toggle-voice)$/;
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!COMMANDS.test(command)) return;
  const all = await getCallTabs();
  const here = tab && all[tab.id] && Object.keys(all[tab.id].frames).length ? tab.id : null;
  const call = here ?? (await currentCall())?.tabId;
  if (call != null) sendToTab(call, { type: 'command', command }, 0);
});
