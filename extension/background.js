// MemeBox: service worker.
// - Routes messages between the frames of a call tab: the top frame hosts the UI,
//   while the frame that owns the microphone (usually the top one) plays the audio.
// - Turns lines into audio: text via the offscreen eSpeak-NG engine, clips from IndexedDB.
// - Forwards chrome.commands shortcuts (Alt+1…9) to the call tab.
importScripts('config.js', 'defaults.js', 'packs.js', 'db.js');

const { TONES, LIMITS } = globalThis.MEME;

// First install: the general pack + every built-in pack. Updates from before packs existed
// get the new packs added once (their own lines are kept).
const PACKS_SEEDED = 2;
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: 'onboarding.html' }).catch(() => {});
  const { lines, settings, seeded } = await chrome.storage.local.get(['lines', 'settings', 'seeded']);
  const patch = {};
  if (!Array.isArray(lines)) {
    patch.lines = MEME_PACKS.all();
  } else if ((seeded || 0) < PACKS_SEEDED) {
    patch.lines = [...lines, ...MEME_PACKS.missing(lines, seeded || 0)];
  }
  patch.seeded = PACKS_SEEDED;
  if (!settings || typeof settings !== 'object') patch.settings = MEME.defaultSettings();
  await chrome.storage.local.set(patch);
});

async function addLangLines(lang) {
  const { lines } = await chrome.storage.local.get('lines');
  if (!Array.isArray(lines)) return;
  const have = new Set(lines.map((l) => l && l.id));
  const add = MEME_PACKS.worldFor(lang).filter((l) => !have.has(l.id));
  if (add.length) await chrome.storage.local.set({ lines: [...lines, ...add] });
}

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
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.ok) await chrome.storage.local.set({ license: { ...data.license, checkedAt: Date.now() } });
  else if (res.status === 404) await chrome.storage.local.set({ license: { ...license, status: 'revoked', checkedAt: Date.now() } });
}
refreshLicense().then(() => { passQueue = passQueue.then(() => flushPassDebt()).catch(() => {}); }).catch(() => {});

// ---------- time pass (Pro / Pro Max hours) ----------
// The panel in the call tab reports "a call with the pass on" every PASS_TICK_MS. The seconds are taken off
// the saved balance here (Pro Max first); every PASS_SYNC_MS they are also reported to the site, which keeps
// the real balance. When it reaches 0 the pass switches itself off. Nothing runs outside a call.
const PASS_TICK_MS = 10000;
const PASS_SYNC_MS = 5 * 60 * 1000;
let lastPassTick = 0;
let passQueue = Promise.resolve();

async function reportPassTime(license, seconds) {
  try {
    if (license.usageProtocol === 'signed-v1') {
      const post = async body => {
        const response = await fetch(SITE_URL + '/api/pass-session', {
          method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key: license.key, ...body }),
          signal: AbortSignal.timeout(15000),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error('Usage report failed');
        return data;
      };
      let { passUsage: usage } = await chrome.storage.local.get('passUsage');
      if (!usage || usage.key !== license.key) {
        const { session } = await post({ action: 'open' });
        usage = { key: license.key, token: session.token, acknowledged: 0, pending: 0 };
      }
      if (Number(usage.token.split('.')[1]) <= Date.now() + 60000) {
        const { session } = await post({ action: 'open', token: usage.token });
        usage.token = session.token;
        // Preserve acknowledged/pending totals: the renewed session retains its server receipt.
      }
      if (!usage.pending && usage.acknowledged + Math.min(600, seconds) > 864000) {
        const { session } = await post({ action: 'open' });
        usage = { key: license.key, token: session.token, acknowledged: 0, pending: 0 };
      }
      // Persist the cumulative target BEFORE sending. A lost response retries the same target.
      const amount = usage.pending || Math.min(600, seconds);
      usage.pending = amount;
      await chrome.storage.local.set({ passUsage: usage });
      const data = await post({ action: 'report', token: usage.token, total: usage.acknowledged + amount });
      usage.acknowledged += amount; usage.pending = 0;
      await chrome.storage.local.set({ passUsage: usage });
      return { license: data.license, acknowledged: amount };
    }
    const amount = Math.min(600, seconds);
    const res = await fetch(SITE_URL + '/api/license', {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key: license.key, spend: amount }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.ok ? { license: data.license, acknowledged: amount } : null;
  } catch { return null; } // offline: keep counting, report later
}

async function flushPassDebt(maxChunks = 60) {
  for (let i = 0; i < maxChunks; i++) {
    const { license, pass } = await chrome.storage.local.get(['license', 'pass']);
    const owed = Math.max(0, Number(pass?.unsynced) || 0);
    if (!owed) return true;
    if (!license || (pass.debtKey && pass.debtKey !== license.key)) return false;
    if (license.status !== 'active') {
      await chrome.storage.local.set({ pass: { ...pass, on: false, unsynced: 0 } });
      return true;
    }
    const result = await reportPassTime(license, owed);
    if (!result) return false;
    const remaining = Math.max(0, owed - result.acknowledged);
    const fresh = { ...license, ...result.license, checkedAt: Date.now() };
    const fromMax = Math.min(fresh.maxSeconds, remaining);
    fresh.maxSeconds -= fromMax;
    fresh.proSeconds = Math.max(0, fresh.proSeconds - (remaining - fromMax));
    await chrome.storage.local.set({ license: fresh, pass: { ...pass, debtKey: license.key, unsynced: remaining, syncedAt: Date.now(), on: pass.on && fresh.maxSeconds + fresh.proSeconds > 0 } });
  }
  return false; // Large backlogs stay recorded; another worker wake can continue.
}

async function passTick(now = Date.now()) {
  const { license, pass } = await chrome.storage.local.get(['license', 'pass']);
  if (!pass || pass.on !== true || !license || license.status !== 'active') return;
  if (pass.unsynced > 0 && pass.debtKey && pass.debtKey !== license.key) return;
  if (now - lastPassTick < PASS_TICK_MS * 0.8) return; // another frame of the same call already counted this
  const seconds = lastPassTick ? Math.min(30, Math.round((now - lastPassTick) / 1000)) : PASS_TICK_MS / 1000;
  lastPassTick = now;
  let max = Math.max(0, Number(license.maxSeconds) || 0);
  let pro = Math.max(0, Number(license.proSeconds) || 0);
  const fromMax = Math.min(max, seconds);
  max -= fromMax;
  pro = Math.max(0, pro - (seconds - fromMax));
  const unsynced = (Number(pass.unsynced) || 0) + seconds;
  let next = { ...license, maxSeconds: max, proSeconds: pro };
  let owed = unsynced;
  if (max + pro <= 0 || now - (Number(pass.syncedAt) || 0) >= PASS_SYNC_MS) {
    const fresh = await reportPassTime(license, unsynced);
    if (fresh) {
      owed = Math.max(0, unsynced - fresh.acknowledged);
      next = { ...license, ...fresh.license, checkedAt: now };
      // Keep unreported offline usage deducted locally, instead of restoring time after a partial sync.
      const pendingMax = Math.min(next.maxSeconds, owed);
      next.maxSeconds -= pendingMax;
      next.proSeconds = Math.max(0, next.proSeconds - (owed - pendingMax));
    }
  }
  const empty = next.maxSeconds + next.proSeconds <= 0;
  await chrome.storage.local.set({
    license: next,
    pass: { on: !empty, debtKey: license.key, unsynced: owed, syncedAt: owed === 0 ? now : Number(pass.syncedAt) || 0 },
  });
}

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
      justification: 'Runs the bundled eSpeak-NG speech engine (WebAssembly) in a Web Worker to turn meme text into audio, and the bundled face and hand models (WebAssembly) for the optional Follow me.',
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
  const {settings,lines} = await chrome.storage.local.get(['settings','lines']);
  const stored = Array.isArray(lines) ? lines.find(line=>line?.id===item.id || (item.clipId && line.clipId===item.clipId) || (item.pictureId && line.pictureId===item.pictureId)) : null;
  if (!MEME.contentAllowed({ explicit: stored?.explicit === true || item.explicit === true }, settings)) throw new Error('Adult memes are hidden. Enable the 18+ preference first.');
  const tone = Object.prototype.hasOwnProperty.call(TONES, item.tone) ? item.tone : 'normal';
  if (item.kind === 'sfx') {
    if (!MEME.SFX.includes(item.sfx)) throw new Error('Unknown sound effect');
    const res = await fetch(chrome.runtime.getURL(`sfx/${item.sfx}.wav`));
    return { b64: toBase64(await res.arrayBuffer()), tone };
  }
  if (item.kind === 'clip') {
    const clip = await MemeDB.getClip(String(item.clipId));
    if (!clip) throw new Error('Clip not found. Re-upload it in Options.');
    return { b64: toBase64(clip.bytes), tone };
  }
  const text = String(item.say || item.text || '').trim().slice(0, LIMITS.textChars);
  if (!text) throw new Error('Empty line');
  return { b64: await tts(text, MEME.isLang(item.lang) ? item.lang : 'en', tone), tone };
}

const playbackEpoch = new Map();

async function handlePlay(tabId, { frameId, reqId, item }) {
  const epoch = playbackEpoch.get(tabId) || 0;
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
    if (epoch !== (playbackEpoch.get(tabId) || 0)) return;
    // Storage can change while synthesis or picture loading is pending.
    const { settings, lines } = await chrome.storage.local.get(['settings', 'lines']);
    const stored = Array.isArray(lines) ? lines.find(line => line?.id === item.id || (item.clipId && line.clipId === item.clipId) || (item.pictureId && line.pictureId === item.pictureId)) : null;
    if (!MEME.contentAllowed({ explicit: stored?.explicit === true || item.explicit === true }, settings)) throw new Error('Adult memes are hidden. Enable the 18+ preference first.');
    if (epoch !== (playbackEpoch.get(tabId) || 0)) return;
    if (picture) sendToTab(tabId, { type: 'show-picture', reqId, b64: picture.b64, mime: picture.type }, 0);
    sendToTab(tabId, {
      type: 'hook',
      cmd: {
        type: 'play-audio', reqId, b64, playbackRate: t.playbackRate, gain: t.gain * lineVolume, effect: t.effect || '',
        text: String(item.text || '').slice(0, LIMITS.textChars), mood: MEME.moodFor(item),
        ...(picture ? { picture: picture.b64, pictureType: picture.type } : {}),
      },
    }, frameId);
  } catch (err) {
    sendToTab(tabId, { type: 'play-result', reqId, ok: false, reason: err.message }, 0);
  }
}

// ---------- adding sounds and music from the call panel ----------
// The panel (in the call page) makes the clip or reads the music file and sends it here, because only the extension
// itself can write to its database. The lists in storage change, and every open panel and Options page updates by itself.
const MUSIC_MAX_BYTES = 8 * 1024 * 1024;
const MUSIC_MAX_TRACKS = 12;
const b64ToBytes = (b64) => { const bin = atob(String(b64)); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
const newId = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

async function callPanelStore(msg) {
  if (msg.type === 'clip-add') {
    const bytes = b64ToBytes(msg.b64);
    const head = new Uint8Array(bytes, 0, 4);
    if (bytes.byteLength > LIMITS.clipBytes || String.fromCharCode(...head) !== 'RIFF') return { ok: false, error: 'This clip is not a valid saved sound.' };
    const name = String(msg.name || 'My sound').slice(0, 120);
    const clipId = newId('c');
    await MemeDB.putClip({ id: clipId, name, type: 'audio/wav', bytes });
    const { lines } = await chrome.storage.local.get('lines');
    const list = Array.isArray(lines) ? lines : MEME.defaultLines();
    const line = MEME.sanitizeLine({ id: newId('l'), kind: 'clip', clipId, lang: 'en', explicit:msg.explicit===true, text: name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 300) || name, tone: 'normal', category: 'clips', fav: 0 });
    await chrome.storage.local.set({ lines: [...list, line] });
    return { ok: true, id: line.id };
  }
  const { myMusic } = await chrome.storage.local.get('myMusic');
  const tracks = Array.isArray(myMusic) ? myMusic : [];
  if (msg.type === 'music-add') {
    const bytes = b64ToBytes(msg.b64);
    if (bytes.byteLength > MUSIC_MAX_BYTES) return { ok: false, error: 'too-big' };
    if (tracks.length >= MUSIC_MAX_TRACKS) return { ok: false, error: 'too-many' };
    const mime = /^audio\/[a-z0-9.+-]{1,30}$/i.test(msg.mime) ? msg.mime : 'audio/mpeg';
    const id = newId('m');
    await MemeDB.putClip({ id, name: String(msg.name || 'My music').slice(0, 120), type: mime, bytes });
    await chrome.storage.local.set({ myMusic: [...tracks, { id, name: String(msg.name || 'My music').replace(/\.[^.]+$/, '').slice(0, 60), size: bytes.byteLength }] });
    return { ok: true, id };
  }
  // music-del
  const id = String(msg.id || '');
  if (!/^m-[a-z0-9]+$/i.test(id)) return { ok: false, error: 'bad id' };
  await MemeDB.deleteClip(id).catch(() => {});
  await chrome.storage.local.set({ myMusic: tracks.filter((x) => x.id !== id) });
  return { ok: true };
}

async function playMine(tabId, { frameId, id, volume }) {
  const epoch = playbackEpoch.get(tabId) || 0;
  const {settings,myMusic}=await chrome.storage.local.get(['settings','myMusic']);
  const track=Array.isArray(myMusic)?myMusic.find(track=>track.id===id):null;
  if (!MEME.contentAllowed(track,settings)) throw new Error('Adult music is hidden. Enable the 18+ preference first.');
  const clip = /^m-[a-z0-9]+$/i.test(String(id)) ? await MemeDB.getClip(String(id)) : null;
  if (!clip) throw new Error('That track was not found.');
  const fresh = await chrome.storage.local.get('settings');
  if (!MEME.contentAllowed(track, fresh.settings)) throw new Error('Adult music is hidden. Enable the 18+ preference first.');
  if (epoch !== (playbackEpoch.get(tabId) || 0)) return;
  sendToTab(tabId, { type: 'hook', cmd: { type: 'music-bytes', mid: String(id), b64: toBase64(clip.bytes), volume: Number.isFinite(Number(volume)) ? Number(volume) : 0.5 } }, frameId);
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
  playbackEpoch.delete(tabId);
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
    if (msg.hash === 'online') chrome.tabs.create({ url: chrome.runtime.getURL('options.html#online-card') }).catch(() => {});
    else if (msg.hash === 'pictures') chrome.tabs.create({ url: chrome.runtime.getURL('options.html#lines-card') }).catch(() => {});
    else if (msg.hash === 'plans') chrome.tabs.create({ url: chrome.runtime.getURL('plans.html') }).catch(() => {});
    else if (msg.hash === 'music-room') chrome.tabs.create({ url: chrome.runtime.getURL('music-room.html') }).catch(() => {});
    else if (msg.hash === 'music-preview') chrome.tabs.create({ url: chrome.runtime.getURL('playground.html#music-library') }).catch(() => {});
    else chrome.runtime.openOptionsPage();
    return;
  }
  if (msg.type === 'open-site') {
    // Only our own few pages, never a path the page chose.
    const path = ['/buy', '/pricing', '/phonk'].includes(msg.path) ? msg.path : '/buy';
    if (path === '/phonk') {
      // Phonk Mode (a page on our site with YouTube's own player): the key goes after the "#", so it is never sent to any server.
      chrome.storage.local.get('license').then(({ license }) => {
        const key = license && /^MBX-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(license.key || '') ? license.key : '';
        chrome.tabs.create({ url: SITE_URL + path + (key ? '#k=' + key : '') });
      }).catch(() => chrome.tabs.create({ url: SITE_URL + path }));
      return;
    }
    chrome.tabs.create({ url: SITE_URL + path });
    return;
  }
  if (msg.type === 'open-feedback') {
    openFeedback({ site: String(msg.site || ''), rate: msg.rate === true });
    return;
  }
  // The toolbar popup: an extension page (also when popup.html is opened in a tab).
  const fromExtensionPage = typeof sender.url === 'string' && sender.url.startsWith(chrome.runtime.getURL(''));
  if (fromExtensionPage && msg.type === 'license-prepare') {
    passQueue = passQueue.then(async () => {
      const ok = await flushPassDebt();
      if (ok) {
        const { pass } = await chrome.storage.local.get('pass');
        await chrome.storage.local.set({ pass: { ...pass, on: false } });
      }
      sendResponse({ ok });
    }).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (fromExtensionPage && /^popup-/.test(msg.type)) {
    popupMessage(msg, sendResponse);
    return true; // async response
  }
  if (!sender.tab) return;
  const tabId = sender.tab.id;

  // "Follow me": a small camera picture from the call tab, answered with where the face is (the face model lives in the offscreen document).
  if (msg.type === 'face-detect' && typeof msg.b64 === 'string' && msg.b64.length < 300000) {
    ensureOffscreen()
      .then(() => chrome.runtime.sendMessage({ target: 'offscreen', type: 'face', b64: msg.b64, hands: msg.hands === true }))
      .then((r) => sendResponse(r && r.ok ? { ok: true, face: r.face, bs: r.bs, hands: r.hands } : { ok: false }), () => sendResponse({ ok: false }));
    return true; // async response
  }

  // Added from inside the call (the panel): a sound clip, or a whole music track. Saved at once, the panel updates live.
  if (msg.type === 'clip-add' || msg.type === 'music-add' || msg.type === 'music-del') {
    callPanelStore(msg).then((r) => sendResponse(r), (err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));
    return true; // async response
  }
  if (msg.type === 'play-mine' && Number.isInteger(msg.frameId)) {
    playMine(tabId, msg).catch((err) => sendToTab(tabId, { type: 'music-state', id: '', error: String(err.message || err) }, 0));
    return;
  }

  switch (msg.type) {
    // A frame's mic hook reported something -> tell the UI in the top frame.
    // The call tab says: a call is running with the pass switched on.
    case 'pass-tick':
      {
        const at = Date.now();
        passQueue = passQueue.then(() => passTick(at)).catch(() => {});
      }
      break;

    case 'music-state':
      sendToTab(tabId, { type: 'music-state', id: typeof msg.id === 'string' ? msg.id : '', frameId: sender.frameId }, 0);
      break;

    case 'fx-status':
      sendToTab(tabId, { type: 'fx-status', active: msg.active === true, frameId: sender.frameId }, 0);
      break;

    case 'cam-caption':
      sendToTab(tabId, { type: 'cam-caption', fixed: msg.fixed === true }, 0);
      break;

    case 'fx-seen':
      sendToTab(tabId, { type: 'fx-seen', ml: msg.ml === true, face: msg.face === true, hands: Number(msg.hands) || 0, did: typeof msg.did === 'string' ? msg.did.slice(0, 4) : '', waiting: msg.waiting === true, fps: Number(msg.fps) || 0, ms: Number(msg.ms) || 0 }, 0);
      break;

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

    case 'caption-clear':
      // The camera can be owned by a different frame from the microphone.
      sendToTab(tabId, { type: 'hook', cmd: { type: 'caption-clear' } });
      break;

    // UI sends a simple command (stop, volume) to one frame.
    case 'to-frame':
      if (msg.inner && typeof msg.inner === 'object' && Number.isInteger(msg.frameId)) {
        if (msg.inner.type === 'hook' && ['stop', 'music-stop'].includes(msg.inner.cmd?.type)) playbackEpoch.set(tabId, (playbackEpoch.get(tabId) || 0) + 1);
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

    // The panel's language list picked a language: add that language's built-in lines once (nothing else is added).
    case 'add-lang-lines':
      if (MEME.isLang(msg.lang)) addLangLines(msg.lang).catch(() => {});
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
