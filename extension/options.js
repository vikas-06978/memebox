// MemeBox options page: lines, clips (file / video / link / recording + trimmer), packs,
// timed lines (party mode). Lines live in chrome.storage.local, clips in IndexedDB.
'use strict';

const { TONES, LIMITS, sanitizeLine } = globalThis.MEME;
const { t } = globalThis.MemeI18n;
const Trim = globalThis.MemeTrim;
const plan = globalThis.MemePlan;
const $ = (id) => document.getElementById(id);

let lines = [];
let settings = MEME.defaultSettings();

// ---------- helpers ----------

function toast(text, isError) {
  const el = $('toast');
  el.textContent = text;
  el.classList.toggle('error', !!isError);
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), isError ? 6000 : 3000);
}

const newId = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  n.append(...kids);
  return n;
}

function categoryLabel(id) {
  const m = t('cat_' + id);
  return m === 'cat_' + id ? id : m;
}

function sanitizeTimer(x) {
  if (!x || typeof x !== 'object' || typeof x.lineId !== 'string') return null;
  const mode = x.mode === 'interval' ? 'interval' : 'clock';
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(x.time) ? x.time : '11:00';
  const minutes = Math.min(240, Math.max(1, Math.round(Number(x.minutes) || 15)));
  return { id: String(x.id || newId('t')).slice(0, 64), lineId: x.lineId.slice(0, 64), mode, time, minutes, enabled: x.enabled !== false };
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

function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ---------- audio: preview (plays here only, never into a call) ----------

let ctx = null;
let previewSrc = null;
let worker = null;
const pendingSynth = new Map();

function audioCtx() {
  ctx = ctx || new AudioContext();
  ctx.resume();
  return ctx;
}

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

// Bytes (WAV/MP3/…) for a line: synthesized speech or the stored clip.
async function lineBytes(line) {
  if (line.kind === 'clip') {
    const clip = await MemeDB.getClip(line.clipId);
    if (!clip) throw new Error(t('op_err_clip_missing'));
    return clip.bytes.slice(0);
  }
  return synth(line.say || line.text, line.lang, TONES[line.tone] ? line.tone : 'normal');
}

function stopPreview() {
  if (previewSrc) try { previewSrc.stop(); } catch { /* already stopped */ }
  previewSrc = null;
}

// A tone's speed/gain (+ robot effect) for `buffer` in context `c`, ending at c.destination.
// Returns the (not yet started) source. Same sound as mic-hook.js plays into the call.
function toneGraph(c, buffer, toneId, volume = 1) {
  const tone = TONES[toneId] || TONES.normal;
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = tone.playbackRate;
  const gain = c.createGain();
  gain.gain.value = tone.gain * volume;
  if (tone.effect === 'robot') {
    const ring = c.createGain();
    ring.gain.value = 0;
    const osc = c.createOscillator();
    osc.frequency.value = 55;
    osc.connect(ring.gain);
    osc.start();
    const dry = c.createGain();
    dry.gain.value = 0.35;
    src.connect(ring).connect(gain);
    src.connect(dry).connect(gain);
    src.addEventListener('ended', () => osc.stop());
  } else {
    src.connect(gain);
  }
  gain.connect(c.destination);
  return src;
}

// Plays an AudioBuffer here with a tone, optionally a slice.
function playBuffer(buffer, toneId, volume = 1, from = 0, dur) {
  stopPreview();
  const src = toneGraph(audioCtx(), buffer, toneId, volume);
  src.start(0, from, dur);
  previewSrc = src;
}

// ---------- share: save as a WAV file / share the text on WhatsApp (both manual) ----------

function fileSlug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'meme';
}

// The line exactly as it sounds in the call (tone + line volume), as a mono 16-bit WAV.
async function lineWav(line) {
  const buffer = await audioCtx().decodeAudioData(await lineBytes(line));
  const tone = TONES[line.tone] || TONES.normal;
  const rate = buffer.sampleRate;
  const frames = Math.max(1, Math.ceil((buffer.duration / tone.playbackRate) * rate));
  const off = new OfflineAudioContext(1, frames, rate);
  toneGraph(off, buffer, line.tone, line.volume ?? 1).start();
  const rendered = await off.startRendering();
  return Trim.floatToWav16(rendered.getChannelData(0), rate);
}

async function saveWav(line) {
  try {
    const name = fileSlug(line.text) + '.wav';
    download(name, new Blob([await lineWav(line)], { type: 'audio/wav' }));
    toast(t('op_wav_saved', name));
  } catch (err) {
    toast(t('op_err_preview', err.message), true);
  }
}

// Opens WhatsApp's own share page with the text filled in. You pick the chat and press send.
function shareWhatsApp(line) {
  const text = t('op_share_text', line.text, MEMEBOX_CONFIG.SITE_URL);
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
}

async function preview(line) {
  try {
    const buffer = await audioCtx().decodeAudioData(await lineBytes(line));
    playBuffer(buffer, line.tone, line.volume ?? 1);
  } catch (err) {
    toast(t('op_err_preview', err.message), true);
  }
}

// ---------- rendering ----------

function fillSelects() {
  for (const sel of document.querySelectorAll('.tone-select')) {
    sel.replaceChildren(...Object.entries(TONES).map(([id, x]) => el('option', { value: id }, `${x.emoji} ${x.label}`)));
  }
  for (const sel of document.querySelectorAll('.fav-select')) {
    sel.replaceChildren(el('option', { value: '0' }, t('op_none')),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => el('option', { value: String(n) }, 'Alt+' + n)));
  }
}

function categories() {
  return [...new Set(lines.map((l) => l.category))];
}

function render() {
  const cats = categories();
  $('cat-list').replaceChildren(...cats.map((c) => el('option', { value: c }, categoryLabel(c))));
  for (const [sel, first] of [[$('lines-filter'), t('op_all_categories')], [$('export-which'), t('op_export_all')]]) {
    const keep = sel.value;
    sel.replaceChildren(el('option', { value: '' }, first), ...cats.map((c) => el('option', { value: c }, categoryLabel(c))));
    if (cats.includes(keep)) sel.value = keep;
  }
  renderLines();
  renderPacks();
  renderTimerLineOptions();
  renderTimers();
}

function renderLines() {
  const body = $('lines-body');
  body.replaceChildren();
  const q = $('lines-search').value.trim().toLowerCase();
  const cat = $('lines-filter').value;
  const shown = lines.filter((l) => (!cat || l.category === cat) && (!q || l.text.toLowerCase().includes(q) || (l.say || '').toLowerCase().includes(q)));
  $('lines-count').textContent = t('op_count', shown.length, lines.length);
  const editingId = $('line-id').value;
  if (!shown.length) body.append(el('tr', {}, el('td', { colSpan: 6, className: 'hint' }, lines.length ? t('empty_search') : t('op_no_lines'))));
  for (const line of shown) {
    const tone = TONES[line.tone] || TONES.normal;
    const text = el('td', { className: 'text' }, line.text);
    if (line.say) text.append(el('span', { className: 'say', lang: line.lang }, line.say));
    const play = el('button', { type: 'button', className: 'small', title: t('op_preview_tip') }, '▶');
    play.addEventListener('click', () => preview(line));
    const star = el('button', { type: 'button', className: 'small star' + (line.star ? ' on' : ''), title: line.star ? t('unstar') : t('star') }, line.star ? '★' : '☆');
    star.addEventListener('click', async () => { line.star = !line.star || undefined; if (!line.star) delete line.star; await saveLines(); });
    const edit = el('button', { type: 'button', className: 'small' }, t('op_edit'));
    edit.addEventListener('click', () => startEdit(line));
    const del = el('button', { type: 'button', className: 'small danger' }, t('op_delete'));
    del.addEventListener('click', () => removeLine(line));
    const wav = el('button', { type: 'button', className: 'small', title: t('op_save_wav_tip') }, t('op_save_wav'));
    wav.addEventListener('click', () => saveWav(line));
    const wa = el('button', { type: 'button', className: 'small', title: t('op_share_wa_tip') }, t('op_share_wa'));
    wa.addEventListener('click', () => shareWhatsApp(line));
    const vol = Math.round((line.volume ?? 1) * 100);
    const about = el('td', { className: 'about' },
      el('span', { className: 'tag' }, line.kind === 'clip' ? '🎵 ' + t('tag_clip') : line.lang),
      ' ', el('span', { className: 'tag', title: tone.label }, `${tone.emoji} ${tone.label}`),
      ' ', el('span', { className: 'tag' }, categoryLabel(line.category)),
      vol !== 100 ? el('span', { className: 'tag' }, `🔊 ${vol}%`) : '',
      line.pictureId ? el('span', { className: 'tag', title: t('tag_picture') }, '🖼') : '');
    body.append(el('tr', { className: line.id === editingId ? 'editing' : '' },
      el('td', {}, play),
      text,
      about,
      el('td', {}, line.fav ? el('span', { className: 'tag' }, 'Alt+' + line.fav) : ''),
      el('td', {}, star),
      el('td', { className: 'right' }, wav, ' ', wa, ' ', edit, ' ', del)));
  }
}

// ---------- lines ----------

function resetForm() {
  $('line-form').reset();
  $('line-id').value = '';
  $('line-lang').value = 'hi';
  $('line-tone').value = 'normal';
  $('line-fav').value = '0';
  $('line-cat').value = 'mine';
  $('line-vol').value = '100';
  $('line-vol-out').value = '100%';
  $('line-say').disabled = false;
  $('line-lang').disabled = false;
  $('line-submit').textContent = t('op_add_line');
  $('line-cancel').hidden = true;
  pic = { mode: 'keep', data: null };
  setPicPreview(null);
  renderLines();
}

// ---------- meme pictures (shown while a line plays) ----------

let pic = { mode: 'keep', data: null }; // mode: keep | new | remove
let picUrl = '';

function setPicPreview(blob) {
  if (picUrl) URL.revokeObjectURL(picUrl);
  picUrl = blob ? URL.createObjectURL(blob) : '';
  const img = $('line-pic-preview');
  if (picUrl) img.src = picUrl; else img.removeAttribute('src');
  img.hidden = !picUrl;
  $('line-pic-remove').hidden = !picUrl;
}

// Any image -> at most LIMITS.pictureSide px and LIMITS.pictureBytes (WEBP). GIFs keep their first frame.
async function shrinkPicture(file) {
  if (file.size > LIMITS.pictureSourceBytes) throw new Error(t('op_err_picture_big'));
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { throw new Error(t('op_err_picture')); }
  const scale = Math.min(1, LIMITS.pictureSide / Math.max(bmp.width, bmp.height));
  const width = Math.max(1, Math.round(bmp.width * scale));
  const height = Math.max(1, Math.round(bmp.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d').drawImage(bmp, 0, 0, width, height);
  bmp.close();
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
    if (blob.size <= LIMITS.pictureBytes) return { bytes: await blob.arrayBuffer(), type: blob.type || 'image/webp', width, height };
  }
  throw new Error(t('op_err_picture_big'));
}

async function dropPictureIfUnused(pictureId) {
  if (pictureId && !lines.some((l) => l.pictureId === pictureId)) await MemeDB.deletePicture(pictureId).catch(() => {});
}

$('line-pic').addEventListener('change', async () => {
  const file = $('line-pic').files[0];
  $('line-pic').value = '';
  if (!file) return;
  try {
    const data = await shrinkPicture(file);
    pic = { mode: 'new', data };
    setPicPreview(new Blob([data.bytes], { type: data.type }));
  } catch (err) {
    toast(err.message, true);
  }
});

$('line-pic-remove').addEventListener('click', () => {
  pic = { mode: 'remove', data: null };
  setPicPreview(null);
});

function startEdit(line) {
  $('line-id').value = line.id;
  $('line-text').value = line.text;
  $('line-say').value = line.say || '';
  $('line-lang').value = line.lang;
  $('line-tone').value = line.tone;
  $('line-fav').value = String(line.fav || 0);
  $('line-cat').value = line.category;
  $('line-vol').value = String(Math.round((line.volume ?? 1) * 100));
  $('line-vol-out').value = $('line-vol').value + '%';
  const isClip = line.kind !== 'tts'; // clips have no voice settings
  $('line-say').disabled = isClip;
  $('line-lang').disabled = isClip;
  $('line-submit').textContent = t('op_save_changes');
  $('line-cancel').hidden = false;
  pic = { mode: 'keep', data: null };
  setPicPreview(null);
  if (line.pictureId) {
    MemeDB.getPicture(line.pictureId).then((p) => {
      if (p && $('line-id').value === line.id && pic.mode === 'keep') setPicPreview(new Blob([p.bytes], { type: p.type }));
    }).catch(() => {});
  }
  renderLines();
  $('line-text').focus();
  $('lines-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function formLine() {
  const existing = lines.find((l) => l.id === $('line-id').value);
  return sanitizeLine({
    ...(existing || { id: newId('l'), kind: 'tts' }),
    text: $('line-text').value,
    say: $('line-say').value,
    lang: $('line-lang').value,
    tone: $('line-tone').value,
    category: $('line-cat').value,
    fav: Number($('line-fav').value),
    volume: Number($('line-vol').value) / 100,
  });
}

$('line-vol').addEventListener('input', () => { $('line-vol-out').value = $('line-vol').value + '%'; });

$('line-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const line = formLine();
  if (!line) { toast(t('op_err_text'), true); return; }
  const before = lines.find((l) => l.id === line.id);
  if (pic.mode === 'new') {
    const others = new Set(lines.filter((l) => l.id !== line.id && l.pictureId).map((l) => l.pictureId));
    if (!plan.can('pictures') && others.size >= plan.pictureLimit()) { // PRO: picture memes beyond the free/bought slots
      toast(t('pro_pictures', plan.pictureLimit()), true);
      return;
    }
    line.pictureId = newId('p');
    await MemeDB.putPicture({ id: line.pictureId, name: line.text.slice(0, 120), ...pic.data });
  } else if (pic.mode === 'remove') {
    delete line.pictureId;
  }
  claimSlot(line.fav, line.id);
  const i = lines.findIndex((l) => l.id === line.id);
  if (i >= 0) lines[i] = line; else lines.push(line);
  await saveLines();
  if (before && before.pictureId !== line.pictureId) await dropPictureIfUnused(before.pictureId);
  toast(i >= 0 ? t('op_saved') : t('op_added'));
  resetForm();
});

$('line-cancel').addEventListener('click', resetForm);
$('line-preview').addEventListener('click', () => {
  const line = formLine();
  if (line) preview(line); else toast(t('op_err_text'), true);
});
$('lines-search').addEventListener('input', renderLines);
$('lines-filter').addEventListener('change', renderLines);

async function removeLine(line) {
  if (!confirm(t('op_confirm_delete', line.text))) return;
  lines = lines.filter((l) => l.id !== line.id);
  if (line.kind === 'clip' && line.clipId && !lines.some((l) => l.clipId === line.clipId)) {
    await MemeDB.deleteClip(line.clipId).catch(() => {});
  }
  await dropPictureIfUnused(line.pictureId);
  if ($('line-id').value === line.id) resetForm();
  await saveLines();
  toast(t('op_deleted'));
}

// ---------- clips: sources ----------

let source = null; // { buffer: AudioBuffer, name }
let sel = { start: 0, end: 0 };

async function loadSource(bytes, name) {
  if (bytes.byteLength > LIMITS.sourceBytes) throw new Error(t('op_err_too_big_source'));
  let buffer;
  try {
    buffer = await audioCtx().decodeAudioData(bytes);
  } catch {
    throw new Error(t('op_err_no_audio'));
  }
  if (!buffer.duration) throw new Error(t('op_err_no_audio'));
  source = { buffer, name };
  // Start with the longest selection that fits at decent quality (≥ 16 kHz), from the beginning.
  const fitAt16k = Trim.maxSeconds(16000, LIMITS.clipBytes);
  sel = Trim.clampRange(0, Math.min(buffer.duration, fitAt16k), buffer.duration);
  $('clip-name').value = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 300);
  $('trimmer').hidden = false;
  syncSliders();
  drawWave();
  $('trimmer').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

$('clip-file').addEventListener('change', async () => {
  const file = $('clip-file').files[0];
  $('clip-file').value = '';
  if (!file) return;
  const ext = file.name.toLowerCase().split('.').pop();
  if (!LIMITS.clipExtensions.includes(ext) && !/^(audio|video)\//.test(file.type)) { toast(t('op_err_type'), true); return; }
  try { await loadSource(await file.arrayBuffer(), file.name); } catch (err) { toast(err.message, true); }
});

$('link-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = MEME.cleanUrl($('link-url').value);
  if (!url) { toast(t('op_err_url'), true); return; }
  if (MEME.isVideoPage(url)) { toast(t('op_err_video_page'), true); return; }
  if (!MEME.isDirectFileLink(url)) { toast(t('op_err_not_file'), true); return; }
  let res;
  try {
    // No extra permissions: the website itself must allow other sites to fetch the file (CORS).
    res = await fetch(url, { credentials: 'omit', mode: 'cors', referrerPolicy: 'no-referrer' });
  } catch {
    toast(t('op_err_blocked', new URL(url).hostname), true);
    return;
  }
  if (!res.ok) { toast(t('op_err_http', res.status), true); return; }
  const len = Number(res.headers.get('content-length'));
  if (len > LIMITS.sourceBytes) { toast(t('op_err_too_big_source'), true); return; }
  try {
    await loadSource(await res.arrayBuffer(), decodeURIComponent(new URL(url).pathname.split('/').pop() || 'clip'));
    $('link-url').value = '';
  } catch (err) { toast(err.message, true); }
});

// Record my own clip (max 10 s), only while this page is open, straight into the trimmer.
let recorder = null;
$('rec-btn').addEventListener('click', async () => {
  if (recorder) { recorder.stop(); return; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    toast(t('op_err_mic'), true);
    return;
  }
  const chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const started = Date.now();
  const tick = setInterval(() => {
    const left = LIMITS.recordSeconds - Math.floor((Date.now() - started) / 1000);
    $('rec-btn').textContent = t('op_recording', Math.max(0, left));
    if (left <= 0 && recorder) recorder.stop();
  }, 200);
  recorder.onstop = async () => {
    clearInterval(tick);
    stream.getTracks().forEach((x) => x.stop());
    recorder = null;
    $('rec-btn').textContent = t('op_record');
    try {
      await loadSource(await new Blob(chunks, { type: chunks[0] ? chunks[0].type : 'audio/webm' }).arrayBuffer(), t('op_my_recording'));
    } catch (err) { toast(err.message, true); }
  };
  recorder.start(250);
  $('rec-btn').textContent = t('op_recording', LIMITS.recordSeconds);
});

// ---------- clips: trimmer ----------

function syncSliders() {
  const d = source.buffer.duration;
  $('trim-start').value = String(Math.round((sel.start / d) * 1000));
  $('trim-end').value = String(Math.round((sel.end / d) * 1000));
  const len = sel.end - sel.start;
  $('trim-label').textContent = t('op_selection', Trim.formatTime(sel.start), Trim.formatTime(sel.end), len.toFixed(1));
  const rate = Trim.fitSampleRate(len, LIMITS.clipBytes, source.buffer.sampleRate);
  $('trim-fit').textContent = rate ? t('op_fit', Math.round(rate / 100) / 10) : t('op_too_long', Trim.maxSeconds(8000, LIMITS.clipBytes).toFixed(0));
  $('trim-fit').classList.toggle('bad', !rate);
}

function drawWave() {
  const canvas = $('wave');
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(200, canvas.clientWidth);
  const h = 120;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement);
  g.fillStyle = css.getPropertyValue('--wave-bg') || '#f1f3f4';
  g.fillRect(0, 0, w, h);
  const data = source.buffer.getChannelData(0);
  const pk = Trim.peaks(data, w);
  const x0 = Trim.timeToPx(sel.start, w, source.buffer.duration);
  const x1 = Trim.timeToPx(sel.end, w, source.buffer.duration);
  g.fillStyle = css.getPropertyValue('--sel') || 'rgba(255,212,59,.35)';
  g.fillRect(x0, 0, x1 - x0, h);
  for (let x = 0; x < pk.length; x++) {
    const [lo, hi] = pk[x];
    g.fillStyle = x >= x0 && x <= x1 ? '#f59f00' : '#9aa0a6';
    g.fillRect(x, h / 2 - hi * (h / 2), 1, Math.max(1, (hi - lo) * (h / 2)));
  }
  g.fillStyle = '#202124';
  g.fillRect(x0 - 1, 0, 3, h);
  g.fillRect(x1 - 1, 0, 3, h);
}

function setSel(start, end) {
  sel = Trim.clampRange(start, end, source.buffer.duration);
  syncSliders();
  drawWave();
}

$('trim-start').addEventListener('input', () => {
  const d = source.buffer.duration;
  setSel((Number($('trim-start').value) / 1000) * d, sel.end);
});
$('trim-end').addEventListener('input', () => {
  const d = source.buffer.duration;
  setSel(sel.start, (Number($('trim-end').value) / 1000) * d);
});

// Drag on the waveform: moves whichever edge is nearer.
let dragEdge = null;
$('wave').addEventListener('pointerdown', (e) => {
  if (!source) return;
  const r = e.currentTarget.getBoundingClientRect();
  const time = Trim.pxToTime(e.clientX - r.left, r.width, source.buffer.duration);
  dragEdge = Math.abs(time - sel.start) < Math.abs(time - sel.end) ? 'start' : 'end';
  e.currentTarget.setPointerCapture(e.pointerId);
  moveEdge(time);
});
$('wave').addEventListener('pointermove', (e) => {
  if (!dragEdge) return;
  const r = e.currentTarget.getBoundingClientRect();
  moveEdge(Trim.pxToTime(e.clientX - r.left, r.width, source.buffer.duration));
});
$('wave').addEventListener('pointerup', () => { dragEdge = null; });
function moveEdge(time) {
  if (dragEdge === 'start') setSel(time, sel.end); else setSel(sel.start, time);
}
window.addEventListener('resize', () => { if (source) drawWave(); });

$('trim-play').addEventListener('click', () => {
  if (source) playBuffer(source.buffer, $('clip-tone').value, 1, sel.start, sel.end - sel.start);
});
$('trim-stop').addEventListener('click', stopPreview);
$('trim-cancel').addEventListener('click', () => { stopPreview(); source = null; $('trimmer').hidden = true; });

// A part of `buffer` -> mono WAV at the best sample rate that fits in 1 MB.
async function renderClip(buffer, start, len) {
  const rate = Trim.fitSampleRate(len, LIMITS.clipBytes, buffer.sampleRate);
  if (!rate) throw new Error(t('op_too_long', Trim.maxSeconds(8000, LIMITS.clipBytes).toFixed(0)));
  const frames = Math.max(1, Math.ceil(len * rate));
  const off = new OfflineAudioContext(1, frames, rate);
  const src = off.createBufferSource();
  src.buffer = buffer; // multi-channel is mixed down to mono by the 1-channel context
  src.connect(off.destination);
  src.start(0, start, len);
  const rendered = await off.startRendering();
  const wav = Trim.floatToWav16(rendered.getChannelData(0), rate);
  if (wav.byteLength > LIMITS.clipBytes) throw new Error(t('op_too_long', Trim.maxSeconds(8000, LIMITS.clipBytes).toFixed(0)));
  return wav;
}

const renderSelection = () => renderClip(source.buffer, sel.start, sel.end - sel.start);

// ---------- clips: import many files at once ----------
// Each file becomes a clip from its start, cut to what fits in 1 MB at 16 kHz, named after the file.

const clipCount = () => lines.filter((l) => l.kind === 'clip').length;
const nameFromFile = (name) => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 300) || name;

$('bulk-files').addEventListener('change', async () => {
  const files = [...$('bulk-files').files];
  $('bulk-files').value = '';
  if (!files.length) return;
  if (!plan.can('bulkImport')) { toast(t('pro_only'), true); return; } // PRO: bulk import
  const status = $('bulk-status');
  const added = [];
  const skipped = [];
  const maxLen = Trim.maxSeconds(16000, LIMITS.clipBytes);
  for (const [i, file] of files.entries()) {
    status.textContent = t('op_bulk_working', i + 1, files.length);
    if (i >= LIMITS.bulkFiles) { skipped.push(file.name); continue; }
    if (!plan.can('unlimitedClips') && clipCount() >= plan.FREE_LIMITS.clips) { skipped.push(file.name); continue; } // PRO: unlimited clips
    const ext = file.name.toLowerCase().split('.').pop();
    if ((!LIMITS.clipExtensions.includes(ext) && !/^(audio|video)\//.test(file.type)) || file.size > LIMITS.sourceBytes) {
      skipped.push(file.name);
      continue;
    }
    try {
      const buffer = await audioCtx().decodeAudioData(await file.arrayBuffer());
      if (!buffer.duration) throw new Error('empty');
      const wav = await renderClip(buffer, 0, Math.min(buffer.duration, maxLen));
      const clipId = newId('c');
      await MemeDB.putClip({ id: clipId, name: file.name.slice(0, 120), type: 'audio/wav', bytes: wav });
      lines.push(sanitizeLine({ id: newId('l'), kind: 'clip', clipId, lang: 'en', text: nameFromFile(file.name), tone: 'normal', category: 'clips', fav: 0 }));
      added.push(file.name);
    } catch {
      skipped.push(file.name);
    }
  }
  if (added.length) await saveLines();
  status.textContent = t('op_bulk_done', added.length, skipped.length) + (skipped.length ? ' ' + t('op_bulk_skipped', skipped.join(', ')) : '');
  toast(t('op_bulk_done', added.length, skipped.length), !added.length);
});

$('clip-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!source) return;
  // PRO: unlimited clips (the free plan will keep FREE_LIMITS.clips)
  if (!plan.can('unlimitedClips') && lines.filter((l) => l.kind === 'clip').length >= plan.FREE_LIMITS.clips) {
    toast(t('pro_only'), true);
    return;
  }
  try {
    const wav = await renderSelection();
    const clipId = newId('c');
    await MemeDB.putClip({ id: clipId, name: source.name.slice(0, 120), type: 'audio/wav', bytes: wav });
    const line = sanitizeLine({
      id: newId('l'), kind: 'clip', clipId, lang: 'en',
      text: $('clip-name').value.trim() || source.name,
      tone: $('clip-tone').value, category: $('clip-cat').value || 'clips', fav: Number($('clip-fav').value),
    });
    claimSlot(line.fav, line.id);
    lines.push(line);
    await saveLines();
    stopPreview();
    source = null;
    $('trimmer').hidden = true;
    $('clip-form').reset();
    $('clip-cat').value = 'clips';
    toast(t('op_clip_saved', (wav.byteLength / 1024).toFixed(0)));
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- packs ----------

function renderPacks() {
  const list = $('builtin-packs');
  list.replaceChildren();
  const have = new Set(lines.map((l) => l.id));
  for (const id of MEME_PACKS.ids) {
    const packLines = MEME_PACKS.lines(id);
    const n = packLines.filter((l) => have.has(l.id)).length;
    const add = el('button', { type: 'button', className: 'small primary' }, n === packLines.length ? t('op_pack_reset') : t('op_pack_add'));
    add.addEventListener('click', async () => {
      if (!plan.can('allPacks') && !plan.FREE_LIMITS.packs.includes(id)) { toast(t('pro_only'), true); return; } // PRO: all packs
      for (const l of packLines) {
        const i = lines.findIndex((x) => x.id === l.id);
        if (l.fav && lines.some((x) => x.fav === l.fav && x.id !== l.id)) l.fav = 0; // don't steal your shortcuts
        if (i >= 0) lines[i] = l; else lines.push(l);
      }
      await saveLines();
      toast(t('op_pack_added', categoryLabel(id)));
    });
    const remove = el('button', { type: 'button', className: 'small danger', disabled: n === 0 }, t('op_pack_remove'));
    remove.addEventListener('click', async () => {
      const ids = new Set(packLines.map((l) => l.id));
      lines = lines.filter((l) => !ids.has(l.id));
      await saveLines();
      toast(t('op_pack_removed', categoryLabel(id)));
    });
    list.append(el('li', {},
      el('span', { className: 'what' }, el('b', {}, categoryLabel(id)), ' ', el('span', { className: 'hint' }, t('op_pack_count', n, packLines.length))),
      add, remove));
  }
}

$('export').addEventListener('click', async () => {
  const cat = $('export-which').value;
  const chosen = lines.filter((l) => !cat || l.category === cat);
  if (!chosen.length) { toast(t('op_no_lines'), true); return; }
  const clips = [];
  let skipped = 0;
  for (const c of await MemeDB.listClips()) {
    if (c.type === 'audio/wav') clips.push(c); else skipped++;
  }
  const usable = chosen.filter((l) => l.kind !== 'clip' || clips.some((c) => c.id === l.clipId));
  const name = cat ? categoryLabel(cat) : t('op_my_library');
  const pack = MemePack.build(name, usable, clips);
  const slug = name.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, '-').replace(/^-|-$/g, '') || 'memebox';
  download(`${slug}.memepack.json`, new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' }));
  toast(skipped || usable.length < chosen.length ? t('op_export_partial', usable.length) : t('op_exported', usable.length));
});

$('import').addEventListener('change', async () => {
  const file = $('import').files[0];
  $('import').value = '';
  const errList = $('import-errors');
  errList.hidden = true;
  errList.replaceChildren();
  if (!file) return;
  let data;
  try {
    if (file.size > 60 * 1024 * 1024) throw new Error(t('op_err_too_big_source'));
    data = JSON.parse(await file.text());
  } catch (err) {
    toast(t('op_import_failed', err.message), true);
    return;
  }
  const res = MemePack.validate(data);
  if (!res.ok) {
    errList.replaceChildren(...res.errors.map((x) => el('li', {}, x)));
    errList.hidden = false;
    toast(t('op_import_invalid'), true);
    return;
  }
  for (const c of res.pack.clips) await MemeDB.putClip(c);
  for (const line of res.pack.lines) {
    claimSlot(line.fav, line.id);
    const i = lines.findIndex((l) => l.id === line.id);
    if (i >= 0) lines[i] = line; else lines.push(line);
  }
  await saveLines();
  toast(t('op_imported', res.pack.lines.length, res.pack.clips.length, res.pack.name));
});

// ---------- timed lines / party mode ----------

function renderTimerLineOptions() {
  const s = $('timer-line');
  const keep = s.value;
  s.replaceChildren(...lines.map((l) => el('option', { value: l.id }, l.text)));
  if (lines.some((l) => l.id === keep)) s.value = keep;
}

function renderTimers() {
  $('timers-enabled').checked = !!settings.timersEnabled;
  const list = $('timers-list');
  list.replaceChildren();
  const timers = Array.isArray(settings.timers) ? settings.timers : [];
  if (!timers.length) list.append(el('li', { className: 'empty' }, t('op_no_timers')));
  for (const x of timers) {
    const line = lines.find((l) => l.id === x.lineId);
    const when = x.mode === 'clock' ? t('op_daily_at', x.time) : t('op_every', x.minutes);
    const on = el('input', { type: 'checkbox', checked: x.enabled, title: t('op_enabled') });
    on.addEventListener('change', () => { x.enabled = on.checked; saveSettings(); });
    const del = el('button', { type: 'button', className: 'small danger' }, t('op_delete'));
    del.addEventListener('click', () => {
      settings.timers = settings.timers.filter((y) => y !== x);
      saveSettings();
    });
    list.append(el('li', {}, on, el('span', { className: 'what' }, `“${line ? line.text : t('op_deleted_line')}”: ${when}`), del));
  }
}

$('timer-mode').addEventListener('change', () => {
  const clock = $('timer-mode').value === 'clock';
  $('timer-time-wrap').hidden = !clock;
  $('timer-min-wrap').hidden = clock;
});

$('timers-enabled').addEventListener('change', () => {
  if ($('timers-enabled').checked && !plan.can('partyMode')) { // PRO: party mode
    $('timers-enabled').checked = false;
    toast(t('pro_only'), true);
    return;
  }
  settings.timersEnabled = $('timers-enabled').checked;
  saveSettings();
  toast(settings.timersEnabled ? t('op_party_on') : t('op_party_off'));
});

$('timer-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!$('timer-line').value) { toast(t('op_no_lines'), true); return; }
  const x = sanitizeTimer({ lineId: $('timer-line').value, mode: $('timer-mode').value, time: $('timer-time').value, minutes: $('timer-min').value, enabled: true });
  settings.timers = [...(settings.timers || []), x];
  saveSettings();
  toast(settings.timersEnabled ? t('op_timer_added') : t('op_timer_added_off'));
});

$('feedback').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'open-feedback' }).catch(() => {}));

// ---------- MemeBox Pro: license key ----------
// The key is checked with the MemeBox site. The answer is saved as `license` and read by
// lib/plan.js everywhere (the service worker checks it again once a day).

function renderPro() {
  const l = plan.license;
  let text;
  if (MEMEBOX_CONFIG.PRO_ENABLED !== true) text = t('op_pro_off');
  else if (plan.hasLicense()) text = t('op_pro_active');
  else text = t('op_pro_free', plan.pictureLimit());
  if (l) {
    if (l.status !== 'active') text += ' ' + t('op_license_revoked', l.key);
    else if (!plan.validLicense()) text += ' ' + t('op_license_stale', l.key);
    else text += ' ' + (l.unlimited ? t('op_license_pro', l.key) : t('op_license_slots', l.key, l.pictureSlots));
  }
  $('pro-status').textContent = text;
  $('license-remove').hidden = !l;
}

async function checkLicense(key) {
  const res = await fetch(MEMEBOX_CONFIG.SITE_URL + '/api/license', {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || t('op_license_offline'));
  return data.license;
}

$('license-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = $('license-key').value.trim();
  if (!key) return;
  let license;
  try {
    license = await checkLicense(key);
  } catch (err) {
    toast(err instanceof TypeError ? t('op_license_offline') : err.message, true);
    return;
  }
  await chrome.storage.local.set({ license: { ...license, checkedAt: Date.now() } });
  $('license-key').value = '';
  toast(license.status === 'active' ? t('op_license_ok') : t('op_license_revoked', license.key), license.status !== 'active');
});

$('license-remove').addEventListener('click', () => chrome.storage.local.remove('license'));
$('buy').addEventListener('click', () => {
  chrome.tabs.create({ url: `${MEMEBOX_CONFIG.SITE_URL}/buy?v=${encodeURIComponent(chrome.runtime.getManifest().version)}` });
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.license) setTimeout(renderPro); // after plan.js has taken the new value
});
plan.ready.then(renderPro);

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
  if (changes.lines && Array.isArray(changes.lines.newValue)) {
    lines = changes.lines.newValue.map(sanitizeLine).filter(Boolean);
    render();
  }
});

(async () => {
  fillSelects();
  const r = await chrome.storage.local.get(['lines', 'settings']);
  lines = Array.isArray(r.lines) ? r.lines.map(sanitizeLine).filter(Boolean) : MEME_PACKS.all();
  settings = { ...MEME.defaultSettings(), ...(r.settings || {}) };
  settings.timers = (Array.isArray(settings.timers) ? settings.timers : []).map(sanitizeTimer).filter(Boolean);
  if (!Array.isArray(r.lines)) await chrome.storage.local.set({ lines });
  render();
  resetForm();
  $('clip-cat').value = 'clips';
})();
