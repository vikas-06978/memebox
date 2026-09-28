// MemeBox shared constants: tones and the default meme pack.
// Loaded as a classic script by the content scripts, the service worker
// (importScripts), the options page and the offscreen document.
(() => {
  'use strict';

  // espeak: rate = words per minute (80-450), pitch/range 0-99, volume 0-200.
  // playbackRate / gain / effect are applied by mic-hook.js when playing.
  const TONES = {
    normal:   { label: 'Normal',   emoji: '🙂', espeak: { rate: 175, pitch: 50, range: 50, volume: 100 }, playbackRate: 1,    gain: 1 },
    chipmunk: { label: 'Chipmunk', emoji: '🐿️', espeak: { rate: 210, pitch: 95, range: 70, volume: 100 }, playbackRate: 1.3,  gain: 1 },
    villain:  { label: 'Villain',  emoji: '😈', espeak: { rate: 135, pitch: 10, range: 35, volume: 110 }, playbackRate: 0.82, gain: 1.1 },
    robot:    { label: 'Robot',    emoji: '🤖', espeak: { rate: 160, pitch: 40, range: 0,  volume: 100 }, playbackRate: 1,    gain: 1, effect: 'robot' },
    slowmo:   { label: 'Slow-mo',  emoji: '🐢', espeak: { rate: 90,  pitch: 35, range: 50, volume: 100 }, playbackRate: 0.75, gain: 1 },
    excited:  { label: 'Excited',  emoji: '🤩', espeak: { rate: 225, pitch: 78, range: 95, volume: 125 }, playbackRate: 1.1,  gain: 1.35 },
  };

  // `text` is what is shown and `say` (optional) is what eSpeak pronounces.
  // Hinglish lines get a Devanagari `say` so the Hindi voice reads them naturally.
  const LINES = [
    { id: 'd-hi-1', lang: 'hi', tone: 'normal',   fav: 1, text: 'Bhai tu rehne de', say: 'भाई तू रहने दे' },
    { id: 'd-hi-2', lang: 'hi', tone: 'excited',  fav: 0, text: 'Ye college hai ya circus?', say: 'ये कॉलेज है या सर्कस?' },
    { id: 'd-hi-3', lang: 'hi', tone: 'slowmo',   fav: 0, text: 'Aaj bhi WiFi ne dhoka de diya', say: 'आज भी वाईफ़ाई ने धोखा दे दिया' },
    { id: 'd-hi-4', lang: 'hi', tone: 'villain',  fav: 0, text: 'Kal se pakka padhai karunga', say: 'कल से पक्का पढ़ाई करूँगा' },
    { id: 'd-hi-5', lang: 'hi', tone: 'normal',   fav: 0, text: 'Presentation se pehle confidence sau percent, baad mein zero', say: 'प्रेज़ेंटेशन से पहले कॉन्फ़िडेंस सौ परसेंट, बाद में ज़ीरो' },
    { id: 'd-hi-6', lang: 'hi', tone: 'robot',    fav: 2, text: 'Mute kar le bhai', say: 'म्यूट कर ले भाई' },
    { id: 'd-hi-7', lang: 'hi', tone: 'excited',  fav: 3, text: 'Chai break!', say: 'चाय ब्रेक!' },
    { id: 'd-hi-8', lang: 'hi', tone: 'chipmunk', fav: 4, text: 'Bhai kya scene hai?', say: 'भाई क्या सीन है?' },
    { id: 'd-en-1', lang: 'en', tone: 'villain',  fav: 5, text: 'Bruh.' },
    { id: 'd-en-2', lang: 'en', tone: 'robot',    fav: 6, text: "You're on mute!" },
    { id: 'd-en-3', lang: 'en', tone: 'excited',  fav: 7, text: 'Emotional damage!' },
    { id: 'd-en-4', lang: 'en', tone: 'villain',  fav: 8, text: 'Plot twist!' },
    { id: 'd-en-5', lang: 'en', tone: 'normal',   fav: 0, text: "That's what she said... about the deadline" },
    { id: 'd-en-6', lang: 'en', tone: 'chipmunk', fav: 9, text: 'Task failed successfully' },
  ].map((l) => ({ kind: 'tts', category: 'general', volume: 1, ...l }));

  // Live voice changer for YOUR voice (applied in mic-hook.js).
  const VOICES = {
    off:      { emoji: '🎙️' },
    chipmunk: { emoji: '🐿️' },
    deep:     { emoji: '🐻' },
    robot:    { emoji: '🤖' },
    echo:     { emoji: '🏔️' },
    radio:    { emoji: '📻' },
  };

  // Color themes for the panel, popup, Options and welcome page. Same names as the website.
  const THEMES = {
    auto:  { emoji: '🌓' },
    light: { emoji: '☀️' },
    dark:  { emoji: '🌙' },
    sunny: { emoji: '🌻' },
    neon:  { emoji: '🪩' },
    candy: { emoji: '🍬' },
  };

  const SETTINGS = {
    volume: 1,            // meme volume, 0-2
    monitor: true,        // also play memes quietly on your own speakers (untick in the panel)
    autoDuck: true,       // lower meme volume while you are talking
    tabVolume: 1,         // another tab's sound in the call, 0-2
    voiceLast: 'chipmunk', // the voice Alt+V switches on (the voice itself always starts Off)
    camCaptions: false,   // draw meme text on your own camera (applies when the camera starts)
    theme: 'auto',        // colors: one of THEMES (auto follows the computer's light/dark setting)
    timersEnabled: false, // master switch for timed lines (off by default)
    timers: [],           // { id, lineId, mode: 'clock'|'interval', time: 'HH:MM', minutes, enabled }
  };

  const LIMITS = {
    textChars: 300,
    clipBytes: 1024 * 1024,        // a saved clip (trimmed WAV) is at most 1 MB
    sourceBytes: 50 * 1024 * 1024, // uploaded/linked file before trimming
    recordSeconds: 10,             // "record my own clip"
    pictureBytes: 300 * 1024,      // a saved meme picture (resized) is at most 300 KB
    pictureSide: 640,              // longest side of a saved picture, in pixels
    pictureSourceBytes: 20 * 1024 * 1024, // picture file before resizing
    bulkFiles: 50,                 // files per bulk import
    // Uploads: audio files or videos (only the audio track is used).
    clipExtensions: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'mp4', 'webm'],
    // Direct links must point at a file with one of these endings.
    linkExtensions: ['mp3', 'mp4', 'wav', 'ogg', 'webm'],
  };

  // http(s) links only. Returns '' for anything else.
  function cleanUrl(s) {
    try {
      const u = new URL(String(s || '').trim());
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
      u.hash = '';
      return u.href.slice(0, 2000);
    } catch {
      return '';
    }
  }

  // Video/social pages can't be used as links (never downloaded). Point people to "Tab audio".
  const VIDEO_SITES = /(^|\.)(youtube\.com|youtu\.be|instagram\.com|tiktok\.com|facebook\.com|fb\.watch|twitter\.com|x\.com)$/i;
  function isVideoPage(url) {
    try { return VIDEO_SITES.test(new URL(url).hostname); } catch { return false; }
  }

  // A direct file link: http(s) and a path ending in one of LIMITS.linkExtensions.
  function isDirectFileLink(url) {
    try {
      const ext = new URL(url).pathname.toLowerCase().split('.').pop();
      return LIMITS.linkExtensions.includes(ext);
    } catch { return false; }
  }

  // Category ids: built-in packs use lowercase ids (college, cricket?). Users may type their own.
  function cleanCategory(c) {
    const s = String(c || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30);
    return s || 'general';
  }

  // Clean a line coming from storage or an imported file.
  function sanitizeLine(l) {
    if (!l || typeof l !== 'object') return null;
    if (l.kind === 'url') return null; // old streamed links (0.x), re-add them as clips
    const kind = l.kind === 'clip' ? 'clip' : 'tts';
    const text = String(l.text || '').trim().slice(0, LIMITS.textChars);
    if (!text) return null;
    const out = {
      id: String(l.id || '').slice(0, 64) || 'l-' + Math.random().toString(36).slice(2, 10),
      kind,
      text,
      lang: l.lang === 'hi' ? 'hi' : 'en',
      tone: Object.prototype.hasOwnProperty.call(TONES, l.tone) ? l.tone : 'normal',
      fav: Number.isInteger(l.fav) && l.fav >= 1 && l.fav <= 9 ? l.fav : 0,
      category: cleanCategory(l.category),
      volume: Number.isFinite(Number(l.volume)) && l.volume !== null && l.volume !== '' ? Math.min(2, Math.max(0, Number(l.volume))) : 1,
    };
    if (l.star === true) out.star = true;
    const say = String(l.say || '').trim().slice(0, LIMITS.textChars);
    if (say) out.say = say;
    if (kind === 'clip') out.clipId = String(l.clipId || '').slice(0, 64);
    const pictureId = String(l.pictureId || '').slice(0, 64);
    if (pictureId) out.pictureId = pictureId; // meme picture shown while the line plays
    return out;
  }

  globalThis.MEME = Object.freeze({
    TONES, VOICES, THEMES, LINES, SETTINGS, LIMITS, sanitizeLine, cleanUrl, isVideoPage, isDirectFileLink,
    defaultLines: () => LINES.map((l) => ({ ...l })),
    defaultSettings: () => JSON.parse(JSON.stringify(SETTINGS)),
  });
})();
