// MemeBox onboarding page (opened once after install): 3 steps and a mic test.
// The mic test only measures the level on this page. Nothing is recorded or sent.
'use strict';

const $ = (id) => document.getElementById(id);
const { t } = globalThis.MemeI18n;
const { TONES } = globalThis.MEME;

let ctx = null;
let stream = null;
let raf = 0;

function audioCtx() {
  ctx = ctx || new AudioContext();
  ctx.resume();
  return ctx;
}

function status(text, kind) {
  $('mic-status').textContent = text;
  $('mic-status').className = 'mic-status ' + (kind || '');
}

async function startMic() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    status(err && err.name === 'NotFoundError' ? t('ob_mic_none') : t('ob_mic_blocked'), 'err');
    return;
  }
  const c = audioCtx();
  const an = c.createAnalyser();
  an.fftSize = 1024;
  c.createMediaStreamSource(stream).connect(an); // not connected to the speakers
  const buf = new Float32Array(an.fftSize);
  let heard = false;
  $('mic-start').hidden = true;
  $('mic-stop').hidden = false;
  status(t('ob_mic_talk'));
  const tick = () => {
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    const pct = Math.min(100, Math.round(Math.sqrt(rms) * 220));
    $('meter-fill').style.width = pct + '%';
    if (!heard && rms > 0.02) {
      heard = true;
      status(t('ob_mic_ok'), 'ok');
    }
    raf = requestAnimationFrame(tick);
  };
  tick();
}

function stopMic() {
  cancelAnimationFrame(raf);
  if (stream) stream.getTracks().forEach((x) => x.stop());
  stream = null;
  $('meter-fill').style.width = '0';
  $('mic-start').hidden = false;
  $('mic-stop').hidden = true;
}

// Plays one built-in line here (your speakers only) so you know what the call will hear.
let worker = null;
function hearMeme() {
  const hindi = chrome.i18n.getUILanguage().startsWith('hi');
  const line = MEME.defaultLines().find((l) => l.lang === (hindi ? 'hi' : 'en') && l.tone !== 'robot') || MEME.defaultLines()[0];
  const tone = TONES[line.tone] || TONES.normal;
  worker = worker || new Worker('tts-worker.js', { type: 'module' });
  $('hear').disabled = true;
  worker.onmessage = async (e) => {
    $('hear').disabled = false;
    if (!e.data.ok) { status(e.data.error, 'err'); return; }
    const c = audioCtx();
    const src = c.createBufferSource();
    src.buffer = await c.decodeAudioData(e.data.wav);
    src.playbackRate.value = tone.playbackRate;
    src.connect(c.destination);
    src.start();
    status('“' + line.text + '”');
  };
  worker.postMessage({ id: 1, text: line.say || line.text, lang: line.lang, espeak: tone.espeak });
}

// Color swatches: one tap previews and saves the theme (Settings has the same choice).
async function pickTheme(theme) {
  const { settings } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...MEME.defaultSettings(), ...settings, theme } });
}

function renderSwatches(current) {
  $('swatches').replaceChildren(...Object.entries(MEME.THEMES).map(([id, x]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch sw-' + id + (id === current ? ' on' : '');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(id === current));
    b.dataset.theme = id;
    b.append(Object.assign(document.createElement('span'), { className: 'chipcolor' }), `${x.emoji} ${t('theme_' + id)}`);
    b.addEventListener('click', () => pickTheme(id));
    return b;
  }));
}
chrome.storage.local.get('settings').then((r) => renderSwatches((r.settings && r.settings.theme) || 'auto'));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings && changes.settings.newValue) renderSwatches(changes.settings.newValue.theme || 'auto');
});

$('mic-start').addEventListener('click', startMic);
$('mic-stop').addEventListener('click', stopMic);
$('hear').addEventListener('click', hearMeme);
$('open-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('close').addEventListener('click', () => window.close());
window.addEventListener('pagehide', stopMic);
