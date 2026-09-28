// MemeBox: on-page UI (content script, ISOLATED world, top frame only).
// Floating 😂 button, panel (categories, search, ⭐ favourites, recent), captions,
// shortcuts, auto-duck switch and timed lines. Everything lives in a closed Shadow DOM
// so the call site's CSS can't touch it. Text comes from the language picked in Options
// (langPack in storage) or, on "Auto", from chrome.i18n.
(async () => {
  'use strict';
  if (window !== window.top || globalThis.__memeboxUi || !globalThis.MemeBridge) return;
  globalThis.__memeboxUi = true;

  let langPack = null;
  try { langPack = (await chrome.storage.local.get('langPack')).langPack || null; } catch { /* orphaned */ }

  const { TONES, VOICES, THEMES, sanitizeLine } = globalThis.MEME;
  const bridge = globalThis.MemeBridge;
  const plan = globalThis.MemePlan;
  const HOST = location.hostname;
  const SITE = /meet\.google/.test(HOST) ? 'meet' : /zoom/.test(HOST) ? 'zoom' : /teams/.test(HOST) ? 'teams' : /discord/.test(HOST) ? 'discord' : '';

  // The picked language, else chrome.i18n, with a safe fallback (after an extension reload the
  // old script is orphaned).
  const t = (key, ...subs) => {
    const s = subs.map(String);
    const m = langPack && langPack.messages && langPack.messages[key];
    if (m) return s.reduce((acc, v, i) => acc.split('$' + (i + 1)).join(v), m);
    try { return chrome.i18n.getMessage(key, s) || key; } catch { return key; }
  };

  const RECENT_MAX = 12;
  const state = {
    lines: MEME.defaultLines(),
    settings: MEME.defaultSettings(),
    pos: null,              // { x, y } of the floating button on THIS site
    recent: [],             // line ids, newest first
    frames: new Map(),      // frameId -> { active, muted, ctxState, since }
    wasLive: false,
    hidden: false,          // Alt+M
    reqId: 0,
    pending: new Map(),     // reqId -> line
    lastRandomId: null,
    nowPlayingId: null,     // highlighted in the list for 3 s
    tabAudio: false,        // another tab's sound is going into the mic
    voice: 'off',           // live voice changer, always starts Off on a new page
    query: '',
    filter: 'all',          // 'all' | 'star' | 'recent' | <category>
  };

  // ---------- storage ----------

  function applyStored(r) {
    if (Array.isArray(r.lines)) state.lines = r.lines.map(sanitizeLine).filter(Boolean);
    if (r.settings && typeof r.settings === 'object') state.settings = { ...MEME.defaultSettings(), ...r.settings };
    const p = r.buttonPos && r.buttonPos[HOST];
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) state.pos = p;
    if (Array.isArray(r.recent)) state.recent = r.recent.filter((id) => typeof id === 'string').slice(0, RECENT_MAX);
  }

  function save(obj) {
    try { chrome.storage.local.set(obj).catch(() => {}); } catch { /* orphaned */ }
  }

  // Read-modify-write of one key so other tabs' changes aren't lost.
  function update(key, fn) {
    try {
      chrome.storage.local.get(key).then((r) => save({ [key]: fn(r[key]) })).catch(() => {});
    } catch { /* orphaned */ }
  }

  function saveSetting(key, value) {
    update('settings', (s) => ({ ...MEME.defaultSettings(), ...(s || {}), [key]: value }));
  }

  try {
    chrome.storage.local.get(['lines', 'settings', 'buttonPos', 'recent']).then((r) => {
      applyStored(r);
      placeFab();
      renderAll();
      sendAudioSettings();
    }).catch(() => {});
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      // A new language needs the panel rebuilt: ask for a reload (the texts are fixed once built).
      if (changes.langPack) toast(t('lang_reload'));
      const r = {};
      for (const k of Object.keys(changes)) r[k] = changes[k].newValue;
      if ('lines' in r && !Array.isArray(r.lines)) r.lines = MEME.defaultLines();
      applyStored(r);
      renderAll();
      if ('settings' in r) sendAudioSettings();
    });
  } catch { /* orphaned */ }

  // ---------- status of the mic hook(s) ----------

  function activeFrame() {
    let best = null;
    for (const [id, f] of state.frames) {
      if (f.active && (!best || f.since > best.since)) best = { id, ...f };
    }
    return best;
  }

  // 'none' | 'suspended' | 'muted' | 'live'
  function status() {
    const f = activeFrame();
    if (!f) return 'none';
    if (f.ctxState !== 'running') return 'suspended';
    return f.muted ? 'muted' : 'live';
  }

  const STATUS_COLOR = { none: '#9aa0a6', suspended: '#f9ab00', muted: '#f9ab00', live: '#1e8e3e' };

  function onFrameStatus(msg) {
    if (typeof msg.frameId !== 'number') return;
    const prev = state.frames.get(msg.frameId);
    const active = msg.active === true;
    const since = active && !(prev && prev.active) ? Date.now() : prev ? prev.since : 0;
    state.frames.set(msg.frameId, { active, muted: msg.muted === true, ctxState: String(msg.ctxState), since });

    const live = !!activeFrame();
    if (live && !state.wasLive) {
      bridge.toRuntime({ type: 'warmup' });
      sendAudioSettings();
    }
    if (!live && state.wasLive) timerState.clear();
    state.wasLive = live;
    renderStatus();
  }

  // ---------- playing ----------

  function orphaned() {
    toast(t('err_reload'));
  }

  function playLine(line) {
    if (!line) return;
    const f = activeFrame();
    if (!f) { toast(t('join_first')); return; }
    const reqId = ++state.reqId;
    state.pending.set(reqId, line);
    setTimeout(() => state.pending.delete(reqId), 20000);
    if (!bridge.toRuntime({ type: 'play', frameId: f.id, reqId, item: line })) orphaned();
  }

  // Meme pictures arrive just before the sound (by request id) and show with the caption.
  const pictures = new Map(); // reqId -> Promise<ImageBitmap|null>
  function keepPicture(msg) {
    const bin = atob(msg.b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    pictures.set(msg.reqId, createImageBitmap(new Blob([bytes], { type: msg.mime })).catch(() => null));
    setTimeout(() => pictures.delete(msg.reqId), 20000);
  }

  async function onPlayResult(msg) {
    const line = state.pending.get(msg.reqId);
    state.pending.delete(msg.reqId);
    const picture = pictures.has(msg.reqId) ? await pictures.get(msg.reqId) : null;
    pictures.delete(msg.reqId);
    if (msg.ok) {
      celebrate();
      if (line) {
        showCaption(line.text, picture);
        if (line.id !== 'beep') rememberPlayed(line.id);
        state.nowPlayingId = line.id;
        renderList();
        clearTimeout(onPlayResult.t);
        onPlayResult.t = setTimeout(() => { state.nowPlayingId = null; renderList(); }, 3000);
      }
      if (msg.muted) toast(t('muted_nobody'));
    } else {
      toast(msg.reason === 'no-call' ? t('join_first') : t('err_play', msg.reason));
    }
  }

  function rememberPlayed(id) {
    state.recent = [id, ...state.recent.filter((x) => x !== id)].slice(0, RECENT_MAX);
    save({ recent: state.recent });
    bridge.toRuntime({ type: 'played-one' }); // counts plays (for the one-time feedback ask)
  }

  // Hard-coded "ding-dong" straight into the mic, the quickest way to check the hook.
  function playBeep() {
    const f = activeFrame();
    if (!f) { toast(t('join_first')); return; }
    const reqId = ++state.reqId;
    state.pending.set(reqId, { id: 'beep', text: t('mic_test_caption') });
    setTimeout(() => state.pending.delete(reqId), 20000);
    sendToHook({ type: 'beep', reqId });
  }

  function visibleLines() {
    const q = state.query.trim().toLowerCase();
    let items = state.lines;
    if (state.filter === 'star') items = items.filter((l) => l.star);
    else if (state.filter === 'recent') items = state.recent.map((id) => items.find((l) => l.id === id)).filter(Boolean);
    else if (state.filter !== 'all') items = items.filter((l) => l.category === state.filter);
    if (q) items = items.filter((l) => l.text.toLowerCase().includes(q) || (l.say || '').toLowerCase().includes(q));
    return items;
  }

  function playRandom() {
    // In the panel, Random respects the current filter/search, while the 😂 click uses everything.
    const base = panelOpen ? visibleLines() : state.lines;
    const pool = base.length > 1 ? base.filter((l) => l.id !== state.lastRandomId) : base;
    if (!pool.length) { toast(t('no_lines')); return; }
    const line = pool[Math.floor(Math.random() * pool.length)];
    state.lastRandomId = line.id;
    playLine(line);
  }

  function playFavourite(slot) {
    const line = state.lines.find((l) => l.fav === slot);
    if (line) playLine(line);
    else toast(t('slot_empty', slot));
  }

  function stopAll() {
    sendToHook({ type: 'stop' });
    if (state.tabAudio) sendToHook({ type: 'tab-audio-stop' });
  }

  function sendToHook(cmd) {
    const f = activeFrame();
    if (f) bridge.toRuntime({ type: 'to-frame', frameId: f.id, inner: { type: 'hook', cmd } });
  }

  // Meme volume, "hear it myself" monitor, auto-duck, tab-sound volume and the voice.
  function sendAudioSettings() {
    sendToHook({ type: 'volume', value: state.settings.volume });
    sendToHook({ type: 'monitor', value: state.settings.monitor === true });
    sendToHook({ type: 'duck', value: state.settings.autoDuck !== false });
    sendToHook({ type: 'tab-audio-volume', value: state.settings.tabVolume });
    sendToHook({ type: 'voice', value: state.voice }); // no-op in the hook if unchanged
  }

  function setVoice(fx) {
    if (!Object.prototype.hasOwnProperty.call(VOICES, fx)) fx = 'off';
    if (fx !== 'off' && !plan.can('voiceChanger')) { // PRO: voice changer
      renderVoice();
      toast(t('pro_only'));
      return;
    }
    state.voice = fx;
    if (fx !== 'off' && state.settings.voiceLast !== fx) {
      state.settings = { ...state.settings, voiceLast: fx };
      saveSetting('voiceLast', fx);
    }
    sendToHook({ type: 'voice', value: fx });
    renderVoice();
    if (!activeFrame()) toast(t('voice_after_join'));
    else toast(fx === 'off' ? t('voice_now_off') : t('voice_now_on', VOICES[fx].emoji + ' ' + t('voice_' + fx)));
  }

  function toggleVoice() {
    const last = Object.prototype.hasOwnProperty.call(VOICES, state.settings.voiceLast) && state.settings.voiceLast !== 'off'
      ? state.settings.voiceLast : 'chipmunk';
    setVoice(state.voice === 'off' ? last : 'off');
  }

  function toggleStar(line) {
    const star = !line.star;
    update('lines', (lines) => (Array.isArray(lines) ? lines : state.lines).map((l) => (l.id === line.id ? { ...l, star } : l)));
    line.star = star; // instant feedback, storage.onChanged re-renders too
    renderList();
  }

  function setHidden(hidden) {
    state.hidden = hidden;
    for (const n of [fab, monBtn, listBtn]) n.hidden = hidden;
    if (hidden) closePanel();
    toast(hidden ? t('ui_hidden') : t('ui_shown'));
  }

  bridge.onUiMessage = (msg) => {
    if (msg.type === 'frame-status') onFrameStatus(msg);
    else if (msg.type === 'play-result') onPlayResult(msg);
    else if (msg.type === 'tab-audio-start' && typeof msg.streamId === 'string') {
      if (!activeFrame()) {
        bridge.toRuntime({ type: 'tab-audio-state', on: false, error: 'no-call', fromUi: true });
        toast(t('join_first'));
      } else {
        sendToHook({ type: 'tab-audio-start', value: msg.streamId });
      }
    } else if (msg.type === 'tab-audio-stop') {
      sendToHook({ type: 'tab-audio-stop' });
    } else if (msg.type === 'tab-audio-state') {
      const was = state.tabAudio;
      state.tabAudio = msg.on === true;
      renderTabAudio();
      if (msg.on) toast(t('tab_on'));
      else if (msg.error) toast(msg.error === 'no-call' ? t('join_first') : t('tab_err', msg.error));
      else if (was) toast(t('tab_off'));
    } else if (msg.type === 'command' && typeof msg.command === 'string') {
      runCommand(msg.command);
    } else if (msg.type === 'ask-feedback') {
      showAsk();
    } else if (msg.type === 'show-picture' && typeof msg.b64 === 'string' && /^image\/(webp|png|jpeg|gif)$/.test(msg.mime)) {
      keepPicture(msg);
    }
  };

  // chrome.commands (global shortcuts) and in-page Alt keys end up here.
  function runCommand(command, fromKeyboardInPage) {
    if (!fromKeyboardInPage && isTyping(document.activeElement)) return;
    const fav = /^fav-([1-9])$/.exec(command);
    if (fav) playFavourite(Number(fav[1]));
    else if (command === 'stop-all') { stopAll(); toast(t('stopped')); }
    else if (command === 'toggle-ui') setHidden(!state.hidden);
    else if (command === 'toggle-voice') toggleVoice();
  }

  // ---------- keyboard ----------

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') return !/^(button|checkbox|radio|range|submit|reset|color|file|image)$/i.test(el.type);
    const role = el.getAttribute('role');
    return role === 'textbox' || role === 'combobox' || role === 'searchbox';
  }

  function isTyping(el) {
    // Walk into (open) shadow roots and our own closed one.
    while (el) {
      if (el === host) el = shadow.activeElement;
      else if (el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
      else break;
    }
    return isEditable(el);
  }

  const KEY_COMMANDS = { Digit0: 'stop-all', KeyM: 'toggle-ui', KeyV: 'toggle-voice' };
  for (let i = 1; i <= 9; i++) KEY_COMMANDS['Digit' + i] = 'fav-' + i;

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelOpen) { closePanel(); return; }
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const command = KEY_COMMANDS[e.code];
    if (!command) return;
    // Ignore while typing in a text box or the call's chat.
    if (isEditable(e.composedPath()[0]) || isTyping(document.activeElement)) return;
    e.preventDefault();
    e.stopPropagation();
    runCommand(command, true);
  }, true);

  // ---------- timed lines / party mode ----------

  const timerState = new Map(); // timer id -> { day, base }
  const pad = (n) => String(n).padStart(2, '0');

  setInterval(() => {
    const s = state.settings;
    if (!s.timersEnabled || !Array.isArray(s.timers) || status() === 'none') return;
    if (!plan.can('partyMode')) return; // PRO: party mode
    const now = new Date();
    const hhmm = pad(now.getHours()) + ':' + pad(now.getMinutes());
    const today = now.toDateString();
    for (const tm of s.timers) {
      if (!tm || !tm.enabled) continue;
      const line = state.lines.find((l) => l.id === tm.lineId);
      if (!line) continue;
      const st = timerState.get(tm.id) || {};
      timerState.set(tm.id, st);
      if (tm.mode === 'clock') {
        if (tm.time === hhmm && st.day !== today) { st.day = today; playLine(line); }
      } else {
        const every = Math.max(1, Number(tm.minutes) || 0) * 60000;
        if (!st.base) st.base = Date.now();
        else if (Date.now() - st.base >= every) { st.base = Date.now(); playLine(line); }
      }
    }
  }, 10000);

  // ---------- DOM ----------

  const host = document.createElement('div');
  host.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;';
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    /* Colors: one set of variables per theme (settings.theme sets data-theme on the host). */
    :host, :host([data-theme="light"]) {
      --p-bg: #ffffff; --p-text: #1c1b20; --p-muted: #5f6368; --p-line: #e3e5e8; --p-soft: #f6f7f9; --p-field: #ffffff;
      --p-hover: #fff8db; --p-now: #ffec99; --p-chip-bg: #1c1b20; --p-chip-fg: #ffffff; --p-b1: #ffd43b; --p-b2: #ffa94d; --p-on-b: #1c1b20;
      --p-blue-bg: #e8f0fe; --p-blue-fg: #174ea6; --p-red-bg: #fdecea; --p-red-fg: #c5221f; --p-star: #f59f00; --p-glow: rgba(255, 146, 43, .45);
    }
    @media (prefers-color-scheme: dark) {
      :host(:not([data-theme])), :host([data-theme="auto"]) {
        --p-bg: #1f1f24; --p-text: #ecebf0; --p-muted: #a3a4ad; --p-line: #3a3a42; --p-soft: #2a2a31; --p-field: #18181c;
        --p-hover: #2e2a1c; --p-now: #4a3f16; --p-chip-bg: #ffd43b; --p-chip-fg: #1c1b20;
        --p-blue-bg: #1f3354; --p-blue-fg: #aecbfa; --p-red-bg: #5c2b29; --p-red-fg: #f6aea9;
      }
    }
    :host([data-theme="dark"]) {
      --p-bg: #1f1f24; --p-text: #ecebf0; --p-muted: #a3a4ad; --p-line: #3a3a42; --p-soft: #2a2a31; --p-field: #18181c;
      --p-hover: #2e2a1c; --p-now: #4a3f16; --p-chip-bg: #ffd43b; --p-chip-fg: #1c1b20;
      --p-blue-bg: #1f3354; --p-blue-fg: #aecbfa; --p-red-bg: #5c2b29; --p-red-fg: #f6aea9;
    }
    :host([data-theme="sunny"]) {
      --p-bg: #fffdf0; --p-text: #3d2c00; --p-muted: #7a6320; --p-line: #f3dd8a; --p-soft: #fff3bf; --p-field: #fffef7;
      --p-hover: #ffec99; --p-now: #ffe066; --p-chip-bg: #e67700; --p-chip-fg: #ffffff; --p-b1: #ffd43b; --p-b2: #ff922b; --p-on-b: #3d2c00;
      --p-star: #e67700;
    }
    :host([data-theme="neon"]) {
      --p-bg: #1a1238; --p-text: #f3eaff; --p-muted: #b8a6e6; --p-line: #3b2d6e; --p-soft: #241a4d; --p-field: #130d2c;
      --p-hover: #2c2160; --p-now: #4a2a8a; --p-chip-bg: #f72585; --p-chip-fg: #ffffff; --p-b1: #f72585; --p-b2: #7209b7; --p-on-b: #ffffff;
      --p-blue-bg: #13325a; --p-blue-fg: #4cc9f0; --p-red-bg: #4a1030; --p-red-fg: #ff8fab; --p-star: #4cc9f0; --p-glow: rgba(247, 37, 133, .55);
    }
    :host([data-theme="candy"]) {
      --p-bg: #ffffff; --p-text: #3b1030; --p-muted: #8c4a73; --p-line: #fcc2d7; --p-soft: #fff0f6; --p-field: #fffafd;
      --p-hover: #ffdeeb; --p-now: #fcc2d7; --p-chip-bg: #d6336c; --p-chip-fg: #ffffff; --p-b1: #faa2c1; --p-b2: #f06595; --p-on-b: #3b1030;
      --p-blue-bg: #f3f0ff; --p-blue-fg: #6741d9; --p-star: #d6336c; --p-glow: rgba(240, 101, 149, .5);
    }

    .fab { position: fixed; width: 54px; height: 54px; border-radius: 50%; border: 0; padding: 0;
      background: radial-gradient(circle at 30% 25%, #fff3bf, var(--p-b1) 45%, var(--p-b2)); cursor: grab; touch-action: none;
      box-shadow: 0 6px 18px var(--p-glow), 0 2px 6px rgba(0,0,0,.25);
      font: 29px/54px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif; text-align: center;
      user-select: none; -webkit-user-select: none; transition: transform .12s ease, box-shadow .12s ease; }
    .fab:hover { transform: scale(1.08) rotate(-6deg); box-shadow: 0 10px 24px var(--p-glow), 0 2px 6px rgba(0,0,0,.25); }
    .fab:active { transform: scale(.94); cursor: grabbing; }
    .fab:focus-visible { outline: 3px solid #1a73e8; outline-offset: 3px; }
    .fab.playing { animation: laugh .5s ease-in-out 3; }
    .fab.playing::after { content: ""; position: absolute; inset: -6px; border-radius: 50%; border: 3px solid var(--p-b2); animation: ring 1s ease-out infinite; }
    @keyframes laugh { 0%, 100% { transform: rotate(0) scale(1); } 25% { transform: rotate(-12deg) scale(1.1); } 75% { transform: rotate(12deg) scale(1.1); } }
    @keyframes ring { from { opacity: .9; transform: scale(1); } to { opacity: 0; transform: scale(1.5); } }
    .fab .dot { position: absolute; right: 1px; bottom: 1px; width: 15px; height: 15px; border-radius: 50%;
      border: 2.5px solid #fff; background: #9aa0a6; }

    /* Emoji burst when a meme plays (interactive and fun, off with reduced motion). */
    .burst { position: fixed; pointer-events: none; font: 24px/1 "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif;
      animation: fly .95s cubic-bezier(.2, .7, .3, 1) forwards; }
    @keyframes fly {
      0% { opacity: 0; transform: translate(0, 0) scale(.4) rotate(0); }
      15% { opacity: 1; }
      100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1.2) rotate(var(--rot)); }
    }

    .mon { position: fixed; width: 24px; height: 24px; padding: 0; border-radius: 50%; border: 2px solid #fff;
      background: #1a73e8; box-shadow: 0 2px 6px rgba(0,0,0,.3); cursor: pointer; text-align: center;
      font: 12px/20px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif; transition: transform .1s; }
    .mon.off { background: #5f6368; }
    .mon.pickbtn { background: #1c1b20; color: #fff; font: 700 13px/20px system-ui, sans-serif; }
    .mon:hover { transform: scale(1.12); }
    .mon:focus-visible { outline: 3px solid #1a73e8; outline-offset: 2px; }

    .panel { position: fixed; width: 356px; max-height: min(600px, calc(100vh - 24px)); display: none;
      flex-direction: column; gap: 10px; padding: 14px; border-radius: 20px; background: var(--p-bg); color: var(--p-text);
      border: 1px solid var(--p-line); box-shadow: 0 18px 48px rgba(0,0,0,.28), 0 2px 8px rgba(0,0,0,.12);
      font: 13.5px/1.4 system-ui, -apple-system, "Segoe UI", "Nirmala UI", sans-serif; }
    .panel.open { display: flex; animation: rise .16s ease-out; }
    @keyframes rise { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }
    .panel > * { flex: none; }
    .panel > .list { flex: 1 1 auto; min-height: 90px; }
    .head { display: flex; align-items: center; gap: 2px; }
    .head h1 { flex: 1; margin: 0; font-size: 17px; font-weight: 800; letter-spacing: -.01em; }
    .icon { border: 0; background: transparent; cursor: pointer; font-size: 16px; width: 32px; height: 32px; border-radius: 10px; color: inherit;
      display: grid; place-items: center; padding: 0; transition: background .1s; }
    .icon:hover { background: var(--p-soft); }
    .status { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 12px; background: var(--p-soft); font-weight: 600; }
    .status .dot { width: 10px; height: 10px; flex: none; border-radius: 50%; background: #9aa0a6; box-shadow: 0 0 0 3px rgba(127,127,127,.15); }
    .search { width: 100%; padding: 10px 14px; border: 1px solid var(--p-line); border-radius: 12px; font: inherit; color: inherit; background: var(--p-field);
      transition: border-color .1s, box-shadow .1s; }
    .search:focus { outline: none; border-color: #1a73e8; box-shadow: 0 0 0 4px rgba(26, 115, 232, .15); }
    .chips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
    .chips::-webkit-scrollbar { display: none; }
    .chip { flex: none; border: 1px solid var(--p-line); background: var(--p-bg); color: inherit; border-radius: 999px;
      padding: 5px 12px; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background .1s; }
    .chip:hover { background: var(--p-soft); }
    .chip.on { background: var(--p-chip-bg); border-color: var(--p-chip-bg); color: var(--p-chip-fg); }
    .row { display: flex; gap: 8px; align-items: center; }
    .btn { flex: 1; border: 0; border-radius: 12px; padding: 9px 8px; font: inherit; font-weight: 700; cursor: pointer;
      background: linear-gradient(135deg, var(--p-b1), var(--p-b2)); color: var(--p-on-b); white-space: nowrap; transition: transform .1s, filter .1s; }
    .btn:hover { filter: brightness(1.03); transform: translateY(-1px); }
    .btn:active { transform: none; }
    .btn.stop { background: var(--p-red-bg); color: var(--p-red-fg); }
    .btn.test { background: var(--p-blue-bg); color: var(--p-blue-fg); }
    .btn.small { flex: none; padding: 5px 12px; font-size: 12px; }
    .tabbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 12px; background: var(--p-blue-bg); color: var(--p-blue-fg); font-weight: 600; }
    .tabbar { flex-wrap: wrap; }
    .tabbar > span { flex: 1; }
    .row.full { flex-basis: 100%; }
    .voice { flex: 1; padding: 6px 8px; border: 1px solid var(--p-line); border-radius: 10px; font: inherit; color: inherit; background: transparent; }
    .voice option { background: var(--p-bg); }
    .voice.on { border-color: var(--p-b2); background: color-mix(in srgb, var(--p-b1) 25%, transparent); font-weight: 700; }
    .vol { flex: 1; accent-color: var(--p-b2); }
    .checks { display: flex; flex-direction: column; gap: 6px; }
    .check { display: flex; align-items: center; gap: 8px; cursor: pointer; color: inherit; }
    .check input { margin: 0; width: 16px; height: 16px; accent-color: var(--p-b2); }
    .volval { width: 42px; text-align: right; font-variant-numeric: tabular-nums; color: var(--p-muted); font-weight: 600; }
    .list { list-style: none; margin: 0 -4px; padding: 0 4px; overflow-y: auto; min-height: 60px; }
    .list li { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 12px; transition: background .1s; }
    .list li + li { margin-top: 2px; }
    .list li.pick { cursor: pointer; }
    .list li.pick:hover { background: var(--p-hover); }
    .list li.now { background: var(--p-now); }
    .list li.now .play { transform: scale(1.1); }
    .play { flex: none; width: 32px; height: 32px; border-radius: 50%; border: 0; cursor: pointer; font-size: 12px; color: var(--p-on-b);
      background: linear-gradient(135deg, var(--p-b1), var(--p-b2)); box-shadow: 0 2px 6px var(--p-glow); transition: transform .1s; }
    .play:hover { transform: scale(1.12) rotate(-8deg); }
    .star { flex: none; border: 0; background: transparent; cursor: pointer; font-size: 17px; padding: 2px; color: var(--p-muted); opacity: .6; transition: transform .1s; }
    .star:hover { transform: scale(1.25); opacity: 1; }
    .star.on { color: var(--p-star); opacity: 1; }
    .txt { flex: 1; min-width: 0; overflow-wrap: anywhere; font-weight: 600; }
    .tags { flex: none; display: flex; gap: 4px; color: var(--p-muted); font-size: 11px; align-items: center; }
    .tag { padding: 2px 6px; border-radius: 6px; background: var(--p-soft); font-weight: 600; }
    .empty { padding: 16px 8px; color: var(--p-muted); text-align: center; }
    .settings { border-top: 1px solid var(--p-line); padding-top: 8px; }
    .settings summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 700; padding: 4px 2px; border-radius: 8px; }
    .settings summary::-webkit-details-marker { display: none; }
    .settings summary::after { content: "▾"; color: var(--p-muted); transition: transform .15s; }
    .settings[open] summary::after { transform: rotate(180deg); }
    .settings summary .sum { flex: 1; text-align: right; color: var(--p-muted); font-weight: 600; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .settings-body { display: grid; gap: 10px; padding: 10px 2px 2px; }
    .foot { color: var(--p-muted); font-size: 11px; }

    .ask { position: fixed; width: 260px; padding: 14px; border-radius: 16px; background: var(--p-bg); color: var(--p-text); border: 1px solid var(--p-line);
      box-shadow: 0 12px 32px rgba(0,0,0,.3); font: 13px/1.35 system-ui, -apple-system, "Segoe UI", "Nirmala UI", sans-serif;
      display: grid; gap: 10px; }
    .ask b { font-size: 15px; padding-right: 26px; }
    .ask .x { position: absolute; top: 6px; right: 6px; }
    .toast { position: fixed; max-width: 280px; padding: 9px 14px; border-radius: 12px; background: #1c1b20; color: #fff;
      font: 13px/1.35 system-ui, -apple-system, "Segoe UI", "Nirmala UI", sans-serif; box-shadow: 0 6px 18px rgba(0,0,0,.3);
      opacity: 0; transform: translateY(4px); transition: opacity .15s, transform .15s; pointer-events: none; }
    .toast.show { opacity: 1; transform: none; }

    .caption { position: fixed; left: 50%; top: 14vh; transform: translateX(-50%); width: max-content; max-width: 90vw;
      text-align: center; pointer-events: none; font: 900 clamp(30px, 6vw, 72px)/1.05 Impact, "Anton", "Arial Black", "Nirmala UI", sans-serif;
      text-transform: uppercase; color: #fff; -webkit-text-stroke: 2px #000; paint-order: stroke fill;
      text-shadow: 0 0 2px #000, 3px 3px 0 #000, -1px -1px 0 #000, 0 6px 16px rgba(0,0,0,.5); overflow-wrap: anywhere;
      animation: pop 3s ease forwards; }
    .caption .meme-pic { display: block; margin: 0 auto 10px; max-width: min(46vw, 520px); max-height: 38vh; width: auto; height: auto;
      border-radius: 14px; box-shadow: 0 8px 26px rgba(0,0,0,.45); }
    @keyframes pop {
      0% { opacity: 0; transform: translateX(-50%) scale(.6) rotate(-3deg); }
      10% { opacity: 1; transform: translateX(-50%) scale(1.08) rotate(1deg); }
      18% { transform: translateX(-50%) scale(1) rotate(0); }
      85% { opacity: 1; }
      100% { opacity: 0; transform: translateX(-50%) scale(1); }
    }    @media (prefers-reduced-motion: reduce) {
      .caption { animation: fade 3s linear forwards; } @keyframes fade { 0%, 85% { opacity: 1; } 100% { opacity: 0; } }
      .burst { display: none; } .fab.playing, .fab.playing::after { animation: none; }
    }
  `;

  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.assign(n, props);
    n.append(...kids);
    return n;
  };

  // Floating button + its two corner buttons
  const fabDot = el('span', { className: 'dot' });
  const fab = el('button', { className: 'fab', type: 'button' }, '😂', fabDot);
  fab.setAttribute('aria-label', t('fab_label'));
  const monBtn = el('button', { className: 'mon', type: 'button' }, '🎧');
  monBtn.setAttribute('aria-label', t('monitor_label'));
  const listBtn = el('button', { className: 'mon pickbtn', type: 'button', title: t('list_btn') }, '☰');
  listBtn.setAttribute('aria-label', t('list_btn'));

  // Panel
  const statusDot = el('span', { className: 'dot' });
  const statusText = el('span');
  const search = el('input', { className: 'search', type: 'search', placeholder: t('search_ph') });
  search.setAttribute('aria-label', t('search_ph'));
  const chips = el('div', { className: 'chips', role: 'tablist' });
  const randomBtn = el('button', { className: 'btn', type: 'button' }, t('btn_random'));
  const beepBtn = el('button', { className: 'btn test', type: 'button', title: t('btn_mic_test_tip') }, t('btn_mic_test'));
  const stopBtn = el('button', { className: 'btn stop', type: 'button', title: 'Alt+0' }, t('btn_stop_all'));
  const vol = el('input', { className: 'vol', type: 'range', min: 0, max: 200, step: 5, title: t('volume') });
  vol.setAttribute('aria-label', t('volume'));
  const volVal = el('span', { className: 'volval' });
  const tabStopBtn = el('button', { className: 'btn stop small', type: 'button' }, t('tab_stop'));
  const tabVol = el('input', { className: 'vol', type: 'range', min: 0, max: 200, step: 5, title: t('tab_volume') });
  tabVol.setAttribute('aria-label', t('tab_volume'));
  const tabBar = el('div', { className: 'tabbar', hidden: true },
    el('span', {}, t('tab_bar')), tabStopBtn,
    el('div', { className: 'row full' }, el('span', { title: t('tab_volume') }, '🔉'), tabVol));
  const voiceSel = el('select', { className: 'voice', title: t('voice_tip') },
    ...Object.entries(VOICES).map(([id, v]) => el('option', { value: id }, `${v.emoji} ${t('voice_' + id)}`)));
  voiceSel.setAttribute('aria-label', t('voice_label'));
  const monitorBox = el('input', { type: 'checkbox' });
  const duckBox = el('input', { type: 'checkbox' });
  const camBox = el('input', { type: 'checkbox' });
  const list = el('ul', { className: 'list' });
  const optionsBtn = el('button', { className: 'icon', type: 'button', title: t('options') }, '⚙️');
  const feedbackBtn = el('button', { className: 'icon', type: 'button', title: t('feedback') }, '💬');
  feedbackBtn.setAttribute('aria-label', t('feedback'));
  const closeBtn = el('button', { className: 'icon', type: 'button', title: t('close') }, '✕');
  const timerNote = el('div', { className: 'foot' });
  // Sound and voice settings fold away, so the memes stay the focus. The summary line
  // shows the current volume and voice when it's closed.
  const settingsSum = el('span', { className: 'sum' });
  const settings = el('details', { className: 'settings' },
    el('summary', {}, el('span', {}, t('settings_label')), settingsSum),
    el('div', { className: 'settings-body' },
      el('div', { className: 'row' }, el('span', { title: t('volume') }, '🔊'), vol, volVal),
      el('label', { className: 'row', title: t('voice_tip') }, el('span', {}, t('voice_label')), voiceSel,
        el('span', { className: 'foot' }, 'Alt+V')),
      el('div', { className: 'checks' },
        el('label', { className: 'check', title: t('monitor_tip') }, monitorBox, t('monitor_label')),
        el('label', { className: 'check', title: t('duck_tip') }, duckBox, t('duck_label')),
        el('label', { className: 'check', title: t('cam_tip') }, camBox, t('cam_label')))));
  settings.addEventListener('toggle', () => {
    if (state.settings.soundOpen !== settings.open) {
      state.settings = { ...state.settings, soundOpen: settings.open };
      saveSetting('soundOpen', settings.open);
    }
    if (panelOpen) placePanel();
  });
  const panel = el('div', { className: 'panel' },
    el('div', { className: 'head' }, el('h1', {}, '😂 MemeBox'), feedbackBtn, optionsBtn, closeBtn),
    el('div', { className: 'status' }, statusDot, statusText),
    tabBar,
    search,
    chips,
    el('div', { className: 'row' }, randomBtn, beepBtn, stopBtn),
    list,
    settings,
    el('div', { className: 'foot' }, t('panel_foot')),
    timerNote,
  );
  panel.setAttribute('role', 'dialog');
  // Right-to-left languages (Arabic) lay the panel out from the right.
  const DIR = t('text_dir') === 'rtl' ? 'rtl' : 'ltr';
  panel.dir = DIR;
  panel.setAttribute('aria-label', 'MemeBox');

  const toastEl = el('div', { className: 'toast', role: 'status' });

  // One-time "Enjoying MemeBox?" card (the service worker decides when, after 10 plays).
  const askRate = el('button', { className: 'btn', type: 'button' }, t('ask_rate'));
  const askSend = el('button', { className: 'btn test', type: 'button' }, t('ask_feedback'));
  const askClose = el('button', { className: 'icon x', type: 'button', title: t('close') }, '✕');
  const ask = el('div', { className: 'ask', hidden: true, role: 'dialog' },
    el('b', {}, t('ask_title')), el('div', { className: 'row' }, askRate, askSend), askClose);
  ask.setAttribute('aria-label', t('ask_title'));
  ask.dir = DIR;

  shadow.append(style, fab, monBtn, listBtn, panel, ask, toastEl);

  // ---------- rendering ----------

  function renderAll() {
    const theme = state.settings.theme;
    host.dataset.theme = Object.prototype.hasOwnProperty.call(THEMES, theme) ? theme : 'auto';
    renderStatus();
    renderChips();
    renderList();
    renderVolume();
    renderVoice();
  }

  function renderVoice() {
    voiceSel.value = state.voice;
    voiceSel.classList.toggle('on', state.voice !== 'off');
    renderSettingsSummary();
  }

  function renderSettingsSummary() {
    const pct = Math.round((Number(state.settings.volume) || 0) * 100);
    const v = VOICES[state.voice] || VOICES.off;
    settingsSum.textContent = `🔊 ${pct}% · ${v.emoji} ${t('voice_' + state.voice)}`;
    if (settings.open !== (state.settings.soundOpen === true)) settings.open = state.settings.soundOpen === true;
  }

  function renderStatus() {
    const s = status();
    fabDot.style.background = STATUS_COLOR[s];
    statusDot.style.background = STATUS_COLOR[s];
    statusText.textContent = t('st_' + s);
    fab.title = 'MemeBox: ' + t('st_' + s) + '\n' + t('fab_tip');
  }

  function renderTabAudio() {
    tabBar.hidden = !state.tabAudio;
    if (panelOpen) placePanel();
  }

  function categoryLabel(id) {
    const known = t('cat_' + id);
    return known === 'cat_' + id ? id : known;
  }

  function renderChips() {
    const cats = [...new Set(state.lines.map((l) => l.category).filter(Boolean))];
    const filters = [['all', t('chip_all')], ['star', '⭐ ' + t('chip_star')], ['recent', '🕘 ' + t('chip_recent')],
      ...cats.map((c) => [c, categoryLabel(c)])];
    if (!filters.some(([id]) => id === state.filter)) state.filter = 'all';
    chips.replaceChildren(...filters.map(([id, label]) => {
      const b = el('button', { className: 'chip' + (id === state.filter ? ' on' : ''), type: 'button', role: 'tab' }, label);
      b.setAttribute('aria-selected', String(id === state.filter));
      b.addEventListener('click', () => { state.filter = id; renderChips(); renderList(); });
      return b;
    }));
  }

  function renderVolume() {
    const pct = Math.round((Number(state.settings.volume) || 0) * 100);
    vol.value = pct;
    volVal.textContent = pct + '%';
    renderSettingsSummary();
    const on = state.settings.monitor === true;
    monitorBox.checked = on;
    duckBox.checked = state.settings.autoDuck !== false;
    camBox.checked = state.settings.camCaptions === true;
    if (!shadow.activeElement || shadow.activeElement !== tabVol) {
      tabVol.value = Math.round((Number(state.settings.tabVolume ?? 1) || 0) * 100);
    }
    monBtn.textContent = on ? '🎧' : '🔇';
    monBtn.classList.toggle('off', !on);
    monBtn.title = on ? t('monitor_on_tip') : t('monitor_off_tip');
    monBtn.setAttribute('aria-pressed', String(on));
    const s = state.settings;
    const n = Array.isArray(s.timers) ? s.timers.filter((x) => x && x.enabled).length : 0;
    timerNote.textContent = s.timersEnabled && n ? t('timers_on', n) : '';
  }

  function renderList() {
    const items = visibleLines();
    const scroll = list.scrollTop;
    queueMicrotask(() => { list.scrollTop = scroll; });
    list.replaceChildren();
    if (!items.length) {
      const why = state.filter === 'star' ? t('empty_star') : state.filter === 'recent' ? t('empty_recent')
        : state.lines.length ? t('empty_search') : t('no_lines');
      list.append(el('li', { className: 'empty' }, why));
      return;
    }
    for (const line of items) {
      const tone = TONES[line.tone] || TONES.normal;
      const tags = el('span', { className: 'tags' },
        line.kind === 'clip' ? el('span', { className: 'tag', title: t('tag_clip') }, '🎵')
          : el('span', { className: 'tag', title: t('tag_lang') }, line.lang.toUpperCase()),
        el('span', { title: tone.label }, tone.emoji));
      if (line.fav) tags.append(el('span', { className: 'tag', title: t('tag_shortcut') }, 'Alt+' + line.fav));
      const play = el('button', { className: 'play', type: 'button', title: t('play') }, '▶');
      play.setAttribute('aria-label', t('play') + ': ' + line.text);
      const star = el('button', { className: 'star' + (line.star ? ' on' : ''), type: 'button', title: line.star ? t('unstar') : t('star') }, line.star ? '★' : '☆');
      star.setAttribute('aria-pressed', String(!!line.star));
      star.addEventListener('click', (e) => { e.stopPropagation(); toggleStar(line); });
      // The whole row plays the line (the ▶ button's click bubbles up to here).
      const li = el('li', { className: 'pick' + (line.id === state.nowPlayingId ? ' now' : ''), title: t('play') + ': ' + line.text },
        play, el('span', { className: 'txt' }, line.text), tags, star);
      li.addEventListener('click', () => playLine(line));
      list.append(li);
    }
  }

  let toastTimer = 0;
  function toast(text) {
    toastEl.textContent = text;
    const anchor = state.hidden ? { left: 16, width: 0, top: window.innerHeight - 60, bottom: window.innerHeight - 60 } : fab.getBoundingClientRect();
    const w = Math.min(280, window.innerWidth - 16);
    toastEl.style.left = Math.max(8, Math.min(anchor.left + anchor.width / 2 - w / 2, window.innerWidth - w - 8)) + 'px';
    toastEl.style.maxWidth = w + 'px';
    const above = anchor.top > 80;
    toastEl.style.top = above ? '' : anchor.bottom + 8 + 'px';
    toastEl.style.bottom = above ? window.innerHeight - anchor.top + 8 + 'px' : '';
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  // The 😂 button laughs and a few emoji burst out of it whenever a meme plays.
  // Only on your screen. The CSS hides the burst for people who prefer less motion.
  const BURST = ['😂', '🤣', '😆', '🔊', '🎉', '😹', '💥', '🤪'];
  let playingTimer = 0;
  function celebrate() {
    if (state.hidden) return;
    fab.classList.add('playing');
    clearTimeout(playingTimer);
    playingTimer = setTimeout(() => fab.classList.remove('playing'), 1600);
    const r = fab.getBoundingClientRect();
    for (let i = 0; i < 9; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;
      const dist = 70 + Math.random() * 70;
      const b = el('span', { className: 'burst' }, BURST[Math.floor(Math.random() * BURST.length)]);
      b.setAttribute('aria-hidden', 'true');
      b.style.left = r.left + r.width / 2 - 12 + 'px';
      b.style.top = r.top + r.height / 2 - 12 + 'px';
      b.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      b.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      b.style.setProperty('--rot', (Math.random() - 0.5) * 120 + 'deg');
      b.style.animationDelay = i * 25 + 'ms';
      shadow.append(b);
      setTimeout(() => b.remove(), 1300);
    }
  }

  // A canvas (not an <img>), so the call site's image rules (CSP) can't block the picture.
  function showCaption(text, picture) {
    for (const c of shadow.querySelectorAll('.caption')) c.remove();
    const c = el('div', { className: 'caption' });
    if (picture) {
      const canvas = el('canvas', { className: 'meme-pic', width: picture.width, height: picture.height });
      canvas.getContext('2d').drawImage(picture, 0, 0);
      picture.close();
      c.append(canvas);
    }
    c.append(text);
    c.setAttribute('aria-hidden', 'true');
    shadow.append(c);
    setTimeout(() => c.remove(), 3000);
  }

  // ---------- floating button: position (per site), drag, click, long-press ----------

  const FAB = 54;

  function placeFab() {
    const x = state.pos ? state.pos.x : 16;
    const y = state.pos ? state.pos.y : window.innerHeight - FAB - 120;
    const cx = Math.max(4, Math.min(x, window.innerWidth - FAB - 4));
    const cy = Math.max(4, Math.min(y, window.innerHeight - FAB - 4));
    fab.style.left = cx + 'px';
    fab.style.top = cy + 'px';
    monBtn.style.left = cx + FAB - 18 + 'px';
    monBtn.style.top = cy - 6 + 'px';
    listBtn.style.left = cx - 6 + 'px';
    listBtn.style.top = cy - 6 + 'px';
    if (panelOpen) placePanel();
  }

  let drag = null;
  let longPressTimer = 0;

  fab.addEventListener('pointerdown', (e) => {
    // A click on 😂 is a user gesture: wake the mic hook's AudioContext if the browser suspended it.
    sendToHook({ type: 'resume' });
    if (e.button !== 0) return;
    const r = fab.getBoundingClientRect();
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, moved: false, long: false };
    fab.setPointerCapture(e.pointerId);
    longPressTimer = setTimeout(() => {
      if (drag && !drag.moved) { drag.long = true; openPanel(); }
    }, 500);
  });

  fab.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
    drag.moved = true;
    clearTimeout(longPressTimer);
    state.pos = { x: e.clientX - drag.ox, y: e.clientY - drag.oy };
    placeFab();
  });

  function endDrag(e, cancelled) {
    if (!drag || e.pointerId !== drag.id) return;
    clearTimeout(longPressTimer);
    const d = drag;
    drag = null;
    if (cancelled) return;
    if (d.moved) update('buttonPos', (all) => ({ ...(all && typeof all === 'object' && !('x' in all) ? all : {}), [HOST]: state.pos }));
    else if (!d.long) playRandom();
  }
  fab.addEventListener('pointerup', (e) => endDrag(e, false));
  fab.addEventListener('pointercancel', (e) => endDrag(e, true));

  // Keyboard users: Enter/Space = random (pointer clicks are handled above).
  fab.addEventListener('click', (e) => { if (e.detail === 0) playRandom(); });
  fab.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (panelOpen) closePanel(); else openPanel();
  });

  window.addEventListener('resize', placeFab);

  // ---------- panel ----------

  let panelOpen = false;

  function placePanel() {
    const r = fab.getBoundingClientRect();
    const pw = Math.min(340, window.innerWidth - 16);
    panel.style.width = pw + 'px';
    const ph = panel.offsetHeight || 400;
    let left = r.right + 10;
    if (left + pw > window.innerWidth - 8) left = r.left - pw - 10;
    if (left < 8) left = Math.max(8, Math.min(r.left, window.innerWidth - pw - 8));
    const top = Math.min(r.top, window.innerHeight - ph - 8);
    panel.style.left = left + 'px';
    panel.style.top = Math.max(8, top) + 'px';
  }

  function openPanel() {
    panelOpen = true;
    panel.classList.add('open');
    renderAll();
    placePanel();
    search.focus({ preventScroll: true });
  }

  function closePanel() {
    panelOpen = false;
    panel.classList.remove('open');
  }

  closeBtn.addEventListener('click', closePanel);
  listBtn.addEventListener('pointerdown', () => sendToHook({ type: 'resume' }));
  listBtn.addEventListener('click', () => { if (panelOpen) closePanel(); else openPanel(); });
  optionsBtn.addEventListener('click', () => { if (!bridge.toRuntime({ type: 'open-options' })) orphaned(); });

  function openFeedback(rate) {
    if (!bridge.toRuntime({ type: 'open-feedback', site: SITE, rate })) orphaned();
  }
  feedbackBtn.addEventListener('click', () => openFeedback(false));

  let askTimer = 0;
  function showAsk() {
    if (state.hidden) return;
    const r = fab.getBoundingClientRect();
    ask.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 268)) + 'px';
    ask.style.top = '';
    ask.style.bottom = window.innerHeight - r.top + 10 + 'px';
    ask.hidden = false;
    clearTimeout(askTimer);
    askTimer = setTimeout(() => { ask.hidden = true; }, 30000);
  }
  askRate.addEventListener('click', () => { ask.hidden = true; openFeedback(true); });
  askSend.addEventListener('click', () => { ask.hidden = true; openFeedback(false); });
  askClose.addEventListener('click', () => { ask.hidden = true; });
  randomBtn.addEventListener('click', playRandom);
  stopBtn.addEventListener('click', stopAll);
  beepBtn.addEventListener('click', playBeep);
  tabStopBtn.addEventListener('click', () => sendToHook({ type: 'tab-audio-stop' }));
  search.addEventListener('input', () => { state.query = search.value; renderList(); });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = visibleLines()[0];
      if (first) playLine(first);
    }
  });

  let volSaveTimer = 0;
  vol.addEventListener('input', () => {
    state.settings = { ...state.settings, volume: Number(vol.value) / 100 };
    volVal.textContent = vol.value + '%';
    renderSettingsSummary();
    sendAudioSettings();
    clearTimeout(volSaveTimer);
    volSaveTimer = setTimeout(() => saveSetting('volume', state.settings.volume), 300);
  });

  // "Hear memes myself": switches instantly, even in the middle of a meme.
  function setMonitor(on) {
    state.settings = { ...state.settings, monitor: on };
    sendAudioSettings();
    renderVolume();
    saveSetting('monitor', on);
    toast(on ? t('monitor_on') : t('monitor_off'));
  }

  monitorBox.addEventListener('change', () => setMonitor(monitorBox.checked));
  monBtn.addEventListener('pointerdown', () => sendToHook({ type: 'resume' }));
  monBtn.addEventListener('click', () => setMonitor(state.settings.monitor !== true));
  duckBox.addEventListener('change', () => {
    state.settings = { ...state.settings, autoDuck: duckBox.checked };
    sendAudioSettings();
    saveSetting('autoDuck', duckBox.checked);
  });
  voiceSel.addEventListener('change', () => setVoice(voiceSel.value));
  // The bridge in every frame reads this setting. It applies the next time the camera starts.
  camBox.addEventListener('change', () => {
    if (camBox.checked && !plan.can('captions')) { // PRO: camera captions
      camBox.checked = false;
      toast(t('pro_only'));
      return;
    }
    state.settings = { ...state.settings, camCaptions: camBox.checked };
    saveSetting('camCaptions', camBox.checked);
    toast(camBox.checked ? t('cam_on') : t('cam_off'));
  });
  let tabVolTimer = 0;
  tabVol.addEventListener('input', () => {
    state.settings = { ...state.settings, tabVolume: Number(tabVol.value) / 100 };
    sendToHook({ type: 'tab-audio-volume', value: state.settings.tabVolume });
    clearTimeout(tabVolTimer);
    tabVolTimer = setTimeout(() => saveSetting('tabVolume', state.settings.tabVolume), 300);
  });

  // Click outside the panel closes it. Our shadow root is closed, so from `window` every
  // click inside our UI shows up as the host element.
  window.addEventListener('pointerdown', (e) => {
    if (panelOpen && !e.composedPath().includes(host)) closePanel();
  }, true);

  // ---------- mount ----------

  function mount() {
    const parent = document.fullscreenElement && document.fullscreenElement.tagName !== 'VIDEO'
      ? document.fullscreenElement : document.documentElement;
    if (host.parentNode !== parent) parent.appendChild(host);
  }

  function start() {
    mount();
    placeFab();
    renderAll();
    bridge.toRuntime({ type: 'query-status' });
    document.addEventListener('fullscreenchange', mount);
    setInterval(() => { if (!host.isConnected) mount(); }, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
