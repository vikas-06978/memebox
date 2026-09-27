// MemeBox – options page: lines, clips, timed lines, import/export.
'use strict';

const { TONES, LIMITS, sanitizeLine } = globalThis.MEME;
const $ = (id) => document.getElementById(id);

let lines = [];
let settings = MEME.defaultSettings();

// ---------- helpers ----------

function toast(text, isError) {
  const t = $('toast');
  t.textContent = text;
  t.classList.toggle('error', !!isError);
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 3000);
}

const newId = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  n.append(...kids);
  return n;
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function sanitizeTimer(t) {
  if (!t || typeof t !== 'object' || typeof t.lineId !== 'string') return null;
  const mode = t.mode === 'interval' ? 'interval' : 'clock';
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(t.time) ? t.time : '11:00';
  const minutes = Math.min(240, Math.max(1, Math.round(Number(t.minutes) || 15)));
  return { id: String(t.id || newId('t')).slice(0, 64), lineId: t.lineId.slice(0, 64), mode, time, minutes, enabled: t.enabled !== false };
}

async function saveLines() {
  await chrome.storage.local.set({ lines });
  render();
}

async function saveSettings() {
  // Re-read so a volume change made on the call page isn't overwritten.
  const { settings: current } = await chrome.storage.local.get('settings');
  settings = { ...MEME.defaultSettings(), ...current, timersEnabled: settings.timersEnabled, timers: settings.timers };
  await chrome.storage.local.set({ settings });
  renderTimers();
}

// A favourite slot belongs to one line only.
function claimSlot(slot, ownerId) {
  if (!slot) return;
  for (const l of lines) if (l.fav === slot && l.id !== ownerId) l.fav = 0;
}

// ---------- preview (plays locally in this page only) ----------

let previewCtx = null;
let previewSrc = null;
let worker = null;
const pendingSynth = new Map();

function synth(text, lang, tone) {
  if (!worker) {
    worker = new Worker('tts-worker.js', { type: 'module' });
    worker.onmessage = (e) => {
      const p = pendingSynth.get(e.data.id);
      pendingSynth.delete(e.data.id);
      if (!p) return;
      if (e.data.ok) p.resolve(e.data.wav); else p.reject(new Error(e.data.error));
    };
    worker.onerror = (e) => {
      for (const p of pendingSynth.values()) p.reject(new Error(e.message || 'Speech engine failed'));
      pendingSynth.clear();
      worker = null;
    };
  }
  return new Promise((resolve, reject) => {
    const id = Math.random();
    pendingSynth.set(id, { resolve, reject });
    worker.postMessage({ id, text, lang, espeak: TONES[tone].espeak });
  });
}

async function preview(line) {
  try {
    const tone = TONES[line.tone] ? line.tone : 'normal';
    let bytes;
    if (line.kind === 'clip') {
      const clip = await MemeDB.getClip(line.clipId);
      if (!clip) throw new Error('Clip not found');
      bytes = clip.bytes.slice(0);
    } else if (line.kind === 'url') {
      bytes = await fetchLink(line.url);
    } else {
      bytes = await synth(line.say || line.text, line.lang, tone);
    }
    previewCtx = previewCtx || new AudioContext();
    await previewCtx.resume();
    const buffer = await previewCtx.decodeAudioData(bytes);
    if (previewSrc) try { previewSrc.stop(); } catch {}
    const src = previewCtx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = TONES[tone].playbackRate;
    const gain = previewCtx.createGain();
    gain.gain.value = TONES[tone].gain;
    if (TONES[tone].effect === 'robot') {
      const ring = previewCtx.createGain();
      ring.gain.value = 0;
      const osc = previewCtx.createOscillator();
      osc.frequency.value = 55;
      osc.connect(ring.gain);
      osc.start();
      const dry = previewCtx.createGain();
      dry.gain.value = 0.35;
      src.connect(ring).connect(gain);
      src.connect(dry).connect(gain);
      src.onended = () => osc.stop();
    } else {
      src.connect(gain);
    }
    gain.connect(previewCtx.destination);
    src.start();
    previewSrc = src;
  } catch (err) {
    toast('Preview failed: ' + err.message, true);
  }
}

// ---------- rendering ----------

function fillSelects() {
  for (const sel of document.querySelectorAll('.tone-select')) {
    sel.replaceChildren(...Object.entries(TONES).map(([id, t]) => el('option', { value: id }, `${t.emoji} ${t.label}`)));
  }
  for (const sel of document.querySelectorAll('.fav-select')) {
    sel.replaceChildren(el('option', { value: '0' }, 'None'),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => el('option', { value: String(n) }, 'Alt+' + n)));
  }
}

function render() {
  const body = $('lines-body');
  body.replaceChildren();
  const editingId = $('line-id').value;
  if (!lines.length) {
    body.append(el('tr', {}, el('td', { colSpan: 6, className: 'hint' }, 'No lines. Add one above, or restore the default pack.')));
  }
  for (const line of lines) {
    const tone = TONES[line.tone] || TONES.normal;
    const text = el('td', { className: 'text' }, line.text);
    if (line.say) text.append(el('span', { className: 'say', lang: line.lang }, line.say));
    const play = el('button', { type: 'button', className: 'small', title: 'Preview here (only you hear it)' }, '▶');
    play.addEventListener('click', () => preview(line));
    const edit = el('button', { type: 'button', className: 'small' }, 'Edit');
    edit.addEventListener('click', () => startEdit(line));
    const del = el('button', { type: 'button', className: 'small danger' }, 'Delete');
    del.addEventListener('click', () => removeLine(line));
    const kindTag = line.kind === 'clip' ? '🎵 clip' : line.kind === 'url' ? '🔗 link' : line.lang;
    if (line.kind === 'url') {
      text.append(el('span', { className: 'say' }, new URL(line.url).hostname));
      // Imported links may still need the website permission.
      chrome.permissions.contains({ origins: [MEME.originPattern(line.url)] }).then((ok) => {
        if (ok) return;
        const allow = el('button', { type: 'button', className: 'small primary', title: 'Let MemeBox fetch sounds from this website' }, 'Allow');
        allow.addEventListener('click', async () => {
          if (await askPermission(line.url)) { toast('Allowed'); render(); }
        });
        text.append(' ', allow);
      });
    }
    const tr = el('tr', { className: line.id === editingId ? 'editing' : '' },
      el('td', {}, play),
      text,
      el('td', {}, el('span', { className: 'tag', title: line.url || '' }, kindTag)),
      el('td', {}, el('span', { className: 'tag', title: tone.label }, `${tone.emoji} ${tone.label}`)),
      el('td', {}, line.fav ? el('span', { className: 'tag' }, 'Alt+' + line.fav) : ''),
      el('td', { className: 'right' }, edit, ' ', del));
    body.append(tr);
  }
  renderTimerLineOptions();
  renderTimers();
}

function renderTimerLineOptions() {
  const sel = $('timer-line');
  const keep = sel.value;
  sel.replaceChildren(...lines.map((l) => el('option', { value: l.id }, l.text)));
  if (lines.some((l) => l.id === keep)) sel.value = keep;
}

function renderTimers() {
  $('timers-enabled').checked = !!settings.timersEnabled;
  const list = $('timers-list');
  list.replaceChildren();
  const timers = Array.isArray(settings.timers) ? settings.timers : [];
  if (!timers.length) list.append(el('li', { className: 'empty' }, 'No timers yet.'));
  for (const t of timers) {
    const line = lines.find((l) => l.id === t.lineId);
    const when = t.mode === 'clock' ? `every day at ${t.time}` : `every ${t.minutes} min`;
    const on = el('input', { type: 'checkbox', checked: t.enabled, title: 'Enabled' });
    on.addEventListener('change', () => { t.enabled = on.checked; saveSettings(); });
    const del = el('button', { type: 'button', className: 'small danger' }, 'Delete');
    del.addEventListener('click', () => {
      settings.timers = settings.timers.filter((x) => x !== t);
      saveSettings();
    });
    list.append(el('li', {}, on,
      el('span', { className: 'what' }, `“${line ? line.text : '(deleted line)'}” – ${when}`), del));
  }
}

// ---------- lines ----------

function resetForm() {
  $('line-form').reset();
  $('line-id').value = '';
  $('line-lang').value = 'hi';
  $('line-tone').value = 'normal';
  $('line-fav').value = '0';
  $('line-submit').textContent = 'Add line';
  $('line-cancel').hidden = true;
  render();
}

function startEdit(line) {
  $('line-id').value = line.id;
  $('line-text').value = line.text;
  $('line-say').value = line.say || '';
  $('line-lang').value = line.lang;
  $('line-tone').value = line.tone;
  $('line-fav').value = String(line.fav || 0);
  const isClip = line.kind !== 'tts'; // clips and links have no voice settings
  $('line-say').disabled = isClip;
  $('line-lang').disabled = isClip;
  $('line-submit').textContent = 'Save changes';
  $('line-cancel').hidden = false;
  render();
  $('line-text').focus();
  $('lines-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function formLine() {
  const id = $('line-id').value;
  const existing = lines.find((l) => l.id === id);
  return sanitizeLine({
    ...(existing || { id: newId('l'), kind: 'tts' }),
    text: $('line-text').value,
    say: $('line-say').value,
    lang: $('line-lang').value,
    tone: $('line-tone').value,
    fav: Number($('line-fav').value),
  });
}

$('line-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const line = formLine();
  if (!line) { toast('Please type the line text', true); return; }
  claimSlot(line.fav, line.id);
  const i = lines.findIndex((l) => l.id === line.id);
  if (i >= 0) lines[i] = line; else lines.push(line);
  await saveLines();
  toast(i >= 0 ? 'Line saved' : 'Line added');
  $('line-say').disabled = false;
  $('line-lang').disabled = false;
  resetForm();
});

$('line-cancel').addEventListener('click', () => {
  $('line-say').disabled = false;
  $('line-lang').disabled = false;
  resetForm();
});

$('line-preview').addEventListener('click', () => {
  const line = formLine();
  if (line) preview(line); else toast('Type some text first', true);
});

async function removeLine(line) {
  if (!confirm(`Delete “${line.text}”?`)) return;
  lines = lines.filter((l) => l.id !== line.id);
  if (line.kind === 'clip' && line.clipId) await MemeDB.deleteClip(line.clipId).catch(() => {});
  if ($('line-id').value === line.id) resetForm();
  await saveLines();
  toast('Deleted');
}

// ---------- clips ----------

function looksLikeAudio(file) {
  return LIMITS.clipTypes.includes(file.type) || /\.(mp3|wav|ogg)$/i.test(file.name);
}

async function checkDecodes(bytes) {
  const ctx = new OfflineAudioContext(1, 1, 44100);
  await ctx.decodeAudioData(bytes.slice(0));
}

$('clip-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = $('clip-file').files[0];
  if (!file) return;
  if (!looksLikeAudio(file)) { toast('Only MP3, WAV or OGG files', true); return; }
  if (file.size > LIMITS.clipBytes) { toast(`That file is ${(file.size / 1048576).toFixed(2)} MB – the limit is 1 MB`, true); return; }
  try {
    const bytes = await file.arrayBuffer();
    await checkDecodes(bytes);
    const clipId = newId('c');
    await MemeDB.putClip({ id: clipId, name: file.name, type: file.type || 'audio/mpeg', bytes });
    const line = sanitizeLine({
      id: newId('l'), kind: 'clip', clipId,
      text: $('clip-name').value.trim() || file.name.replace(/\.[^.]+$/, ''),
      lang: 'en', tone: $('clip-tone').value, fav: Number($('clip-fav').value),
    });
    claimSlot(line.fav, line.id);
    lines.push(line);
    await saveLines();
    $('clip-form').reset();
    toast('Clip uploaded');
  } catch (err) {
    toast("Couldn't read that audio file: " + err.message, true);
  }
});

// ---------- links ----------

// Must be called straight from a click (Chrome only shows the prompt during a user gesture).
function askPermission(url) {
  return chrome.permissions.request({ origins: [MEME.originPattern(url)] }).catch(() => false);
}

async function fetchLink(url) {
  let res;
  try {
    res = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch {
    throw new Error(`couldn't reach ${new URL(url).hostname} – check the link`);
  }
  if (!res.ok) throw new Error(`the website answered HTTP ${res.status}`);
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > LIMITS.linkBytes) throw new Error('that file is bigger than 5 MB');
  return bytes;
}

$('link-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = MEME.cleanUrl($('link-url').value);
  if (!url) { toast('Please paste a full link starting with https://', true); return; }
  if (MEME.isVideoPage(url)) {
    toast('YouTube / Instagram pages aren\'t audio files. Open the video in a tab and use the toolbar button → "Send this tab\'s sound".', true);
    return;
  }
  // Ask first, while we still have the click's user gesture.
  if (!(await askPermission(url))) { toast('MemeBox needs your OK to fetch sounds from that website', true); return; }
  try {
    const bytes = await fetchLink(url);
    try { await checkDecodes(bytes); } catch { throw new Error("that link isn't a playable MP3/OGG/WAV file"); }
    let file = new URL(url).pathname.split('/').pop() || 'sound';
    try { file = decodeURIComponent(file); } catch { /* keep it encoded */ }
    const line = sanitizeLine({
      id: newId('l'), kind: 'url', url,
      text: $('link-name').value.trim() || file.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
      lang: 'en', tone: $('link-tone').value, fav: Number($('link-fav').value),
    });
    claimSlot(line.fav, line.id);
    lines.push(line);
    await saveLines();
    $('link-form').reset();
    toast('Link added');
  } catch (err) {
    toast("Couldn't add that link: " + err.message, true);
  }
});

// ---------- timers ----------

$('timer-mode').addEventListener('change', () => {
  const clock = $('timer-mode').value === 'clock';
  $('timer-time-wrap').hidden = !clock;
  $('timer-min-wrap').hidden = clock;
});

$('timers-enabled').addEventListener('change', () => {
  settings.timersEnabled = $('timers-enabled').checked;
  saveSettings();
  toast(settings.timersEnabled ? 'Timed lines on' : 'Timed lines off');
});

$('timer-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!$('timer-line').value) { toast('Add a line first', true); return; }
  const t = sanitizeTimer({
    lineId: $('timer-line').value, mode: $('timer-mode').value,
    time: $('timer-time').value, minutes: $('timer-min').value, enabled: true,
  });
  settings.timers = [...(settings.timers || []), t];
  saveSettings();
  toast(settings.timersEnabled ? 'Timer added' : 'Timer added – switch on “Play timed lines automatically” to use it');
});

// ---------- import / export ----------

$('export').addEventListener('click', async () => {
  const clips = [];
  for (const c of await MemeDB.listClips()) clips.push({ id: c.id, name: c.name, type: c.type, b64: toBase64(c.bytes) });
  const data = {
    format: 'memebox', version: 1, exportedAt: new Date().toISOString(),
    lines, settings: { timersEnabled: settings.timersEnabled, timers: settings.timers, volume: settings.volume }, clips,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = el('a', { href: url, download: `memebox-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});

$('import').addEventListener('change', async () => {
  const file = $('import').files[0];
  $('import').value = '';
  if (!file) return;
  try {
    if (file.size > 60 * 1024 * 1024) throw new Error('file is too large');
    const data = JSON.parse(await file.text());
    if (!data || !['memebox', 'meme-button'].includes(data.format) || !Array.isArray(data.lines)) throw new Error('not a MemeBox export');

    const clipIds = new Set((await MemeDB.listClips()).map((c) => c.id));
    for (const c of Array.isArray(data.clips) ? data.clips : []) {
      if (!c || typeof c.id !== 'string' || typeof c.b64 !== 'string') continue;
      const bytes = fromBase64(c.b64);
      if (bytes.byteLength > LIMITS.clipBytes) continue;
      try { await checkDecodes(bytes); } catch { continue; }
      await MemeDB.putClip({ id: c.id.slice(0, 64), name: String(c.name || 'clip').slice(0, 200), type: String(c.type || 'audio/mpeg'), bytes });
      clipIds.add(c.id.slice(0, 64));
    }

    let added = 0;
    for (const raw of data.lines) {
      const line = sanitizeLine(raw);
      if (!line || (line.kind === 'clip' && !clipIds.has(line.clipId))) continue;
      const i = lines.findIndex((l) => l.id === line.id);
      claimSlot(line.fav, line.id);
      if (i >= 0) lines[i] = line; else lines.push(line);
      added++;
    }
    if (data.settings && Array.isArray(data.settings.timers)) {
      const known = new Set(settings.timers.map((t) => t.id));
      for (const t of data.settings.timers.map(sanitizeTimer).filter(Boolean)) {
        if (!known.has(t.id) && lines.some((l) => l.id === t.lineId)) settings.timers.push(t);
      }
    }
    await saveLines();
    await saveSettings();
    toast(`Imported ${added} line${added === 1 ? '' : 's'}`);
  } catch (err) {
    toast('Import failed: ' + err.message, true);
  }
});

$('reset').addEventListener('click', async () => {
  if (!confirm('Put the default meme pack back? Your own lines and clips stay; default lines you edited are reset.')) return;
  for (const d of MEME.defaultLines()) {
    const i = lines.findIndex((l) => l.id === d.id);
    claimSlot(d.fav, d.id);
    if (i >= 0) lines[i] = d; else lines.push(d);
  }
  await saveLines();
  toast('Default pack restored');
});

$('open-shortcuts').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

// ---------- start ----------

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.settings && changes.settings.newValue) {
    settings = { ...MEME.defaultSettings(), ...changes.settings.newValue };
    renderTimers();
  }
});

(async () => {
  fillSelects();
  const r = await chrome.storage.local.get(['lines', 'settings']);
  lines = Array.isArray(r.lines) ? r.lines.map(sanitizeLine).filter(Boolean) : MEME.defaultLines();
  settings = { ...MEME.defaultSettings(), ...(r.settings || {}) };
  settings.timers = (Array.isArray(settings.timers) ? settings.timers : []).map(sanitizeTimer).filter(Boolean);
  if (!Array.isArray(r.lines)) await chrome.storage.local.set({ lines });
  resetForm();
})();
