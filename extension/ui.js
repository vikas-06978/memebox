// MemeBox: on-page UI (content script, ISOLATED world, top frame only).
// Floating 😂 button, panel (categories, search, ⭐ favourites, recent), captions,
// shortcuts, auto-duck switch and timed lines. Everything lives in a closed Shadow DOM
// so the call site's CSS can't touch it. All text goes through chrome.i18n (en / hi).
(() => {
  'use strict';
  if (window !== window.top || globalThis.__memeboxUi || !globalThis.MemeBridge) return;
  globalThis.__memeboxUi = true;

  const { TONES, VOICES, sanitizeLine } = globalThis.MEME;
  const bridge = globalThis.MemeBridge;
  const HOST = location.hostname;
  const SITE = /meet\.google/.test(HOST) ? 'meet' : /zoom/.test(HOST) ? 'zoom' : /teams/.test(HOST) ? 'teams' : /discord/.test(HOST) ? 'discord' : '';

  // chrome.i18n with a safe fallback (after an extension reload the old script is orphaned).
  const t = (key, ...subs) => {
    try { return chrome.i18n.getMessage(key, subs.map(String)) || key; } catch { return key; }
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

  function onPlayResult(msg) {
    const line = state.pending.get(msg.reqId);
    state.pending.delete(msg.reqId);
    if (msg.ok) {
      if (line) {
        showCaption(line.text);
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
    // In the panel, Random respects the current filter/search; the 😂 click uses everything.
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
    .fab { position: fixed; width: 52px; height: 52px; border-radius: 50%; border: 0; padding: 0;
      background: #ffd43b; box-shadow: 0 3px 10px rgba(0,0,0,.35); cursor: grab; touch-action: none;
      font: 28px/52px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif; text-align: center;
      user-select: none; -webkit-user-select: none; transition: transform .1s; }
    .fab:hover { transform: scale(1.06); }
    .fab:active { transform: scale(.94); cursor: grabbing; }
    .fab:focus-visible { outline: 3px solid #1a73e8; outline-offset: 2px; }
    .fab .dot { position: absolute; right: 1px; bottom: 1px; width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid #fff; background: #9aa0a6; }

    .mon { position: fixed; width: 24px; height: 24px; padding: 0; border-radius: 50%; border: 2px solid #fff;
      background: #1a73e8; box-shadow: 0 1px 4px rgba(0,0,0,.35); cursor: pointer; text-align: center;
      font: 12px/20px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif; }
    .mon.off { background: #5f6368; }
    .mon.pickbtn { background: #202124; color: #fff; font: 700 13px/20px system-ui, sans-serif; }
    .mon:hover { transform: scale(1.1); }
    .mon:focus-visible { outline: 3px solid #1a73e8; outline-offset: 2px; }

    .panel { position: fixed; width: 340px; max-height: min(560px, calc(100vh - 24px)); display: none;
      flex-direction: column; gap: 8px; padding: 12px; border-radius: 14px; background: #fff; color: #202124;
      box-shadow: 0 8px 28px rgba(0,0,0,.35); font: 13px/1.35 system-ui, -apple-system, "Segoe UI", "Nirmala UI", sans-serif; }
    .panel.open { display: flex; }
    .panel > * { flex: none; }
    .panel > .list { flex: 1 1 auto; min-height: 80px; }
    .head { display: flex; align-items: center; gap: 4px; }
    .head h1 { flex: 1; margin: 0; font-size: 15px; font-weight: 650; }
    .icon { border: 0; background: transparent; cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 6px; color: inherit; }
    .icon:hover { background: #f1f3f4; }
    .status { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; background: #f8f9fa; }
    .status .dot { width: 10px; height: 10px; flex: none; border-radius: 50%; background: #9aa0a6; }
    .search { width: 100%; padding: 7px 10px; border: 1px solid #dadce0; border-radius: 8px; font: inherit; color: inherit; background: #fff; }
    .search:focus { outline: 2px solid #1a73e8; border-color: transparent; }
    .chips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: thin; }
    .chip { flex: none; border: 1px solid #dadce0; background: transparent; color: inherit; border-radius: 999px;
      padding: 3px 10px; font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap; }
    .chip.on { background: #202124; border-color: #202124; color: #fff; }
    .row { display: flex; gap: 6px; align-items: center; }
    .btn { flex: 1; border: 0; border-radius: 8px; padding: 7px 6px; font: inherit; font-weight: 600; cursor: pointer; background: #ffd43b; color: #202124; white-space: nowrap; }
    .btn.stop { background: #fce8e6; color: #c5221f; }
    .btn.test { background: #e8f0fe; color: #174ea6; }
    .btn.small { flex: none; padding: 4px 10px; font-size: 12px; }
    .btn:hover { filter: brightness(.96); }
    .tabbar { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; background: #e8f0fe; color: #174ea6; }
    .tabbar { flex-wrap: wrap; }
    .tabbar > span { flex: 1; }
    .row.full { flex-basis: 100%; }
    .voice { flex: 1; padding: 4px 6px; border: 1px solid #dadce0; border-radius: 8px; font: inherit; color: inherit; background: transparent; }
    .voice.on { border-color: #f59f00; background: rgba(255, 212, 59, .25); font-weight: 600; }
    .vol { flex: 1; accent-color: #f59f00; }
    .checks { display: flex; flex-wrap: wrap; gap: 4px 14px; }
    .check { display: flex; align-items: center; gap: 6px; cursor: pointer; color: inherit; }
    .check input { margin: 0; width: 15px; height: 15px; accent-color: #f59f00; }
    .volval { width: 40px; text-align: right; font-variant-numeric: tabular-nums; color: #5f6368; }
    .list { list-style: none; margin: 0; padding: 0; overflow-y: auto; min-height: 60px; border-top: 1px solid #eee; }
    .list li { display: flex; align-items: center; gap: 8px; padding: 5px 4px; border-bottom: 1px solid #f1f3f4; border-radius: 8px; }
    .list li.pick { cursor: pointer; }
    .list li.pick:hover { background: rgba(255, 212, 59, .18); }
    .list li.now { background: rgba(255, 212, 59, .38); }
    .list li.now .play { background: #ffd43b; }
    .play { flex: none; width: 30px; height: 30px; border-radius: 50%; border: 0; cursor: pointer; background: #fff4cc; font-size: 13px; color: #202124; }
    .play:hover { background: #ffd43b; }
    .star { flex: none; border: 0; background: transparent; cursor: pointer; font-size: 16px; padding: 2px; color: #bdc1c6; }
    .star.on { color: #f9ab00; }
    .txt { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .tags { flex: none; display: flex; gap: 4px; color: #5f6368; font-size: 11px; }
    .tag { padding: 1px 5px; border-radius: 6px; background: #f1f3f4; }
    .empty { padding: 12px 4px; color: #5f6368; }
    .foot { color: #5f6368; font-size: 11px; }

    .toast { position: fixed; max-width: 280px; padding: 8px 12px; border-radius: 10px; background: #202124; color: #fff;
      font: 13px/1.35 system-ui, -apple-system, "Segoe UI", "Nirmala UI", sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,.3);
      opacity: 0; transform: translateY(4px); transition: opacity .15s, transform .15s; pointer-events: none; }
    .toast.show { opacity: 1; transform: none; }

    .caption { position: fixed; left: 50%; top: 14vh; transform: translateX(-50%); width: max-content; max-width: 90vw;
      text-align: center; pointer-events: none; font: 900 clamp(30px, 6vw, 72px)/1.05 Impact, "Anton", "Arial Black", "Nirmala UI", sans-serif;
      text-transform: uppercase; color: #fff; -webkit-text-stroke: 2px #000; paint-order: stroke fill;
      text-shadow: 0 0 2px #000, 3px 3px 0 #000, -1px -1px 0 #000, 0 6px 16px rgba(0,0,0,.5); overflow-wrap: anywhere;
      animation: pop 3s ease forwards; }
    @keyframes pop {
      0% { opacity: 0; transform: translateX(-50%) scale(.6) rotate(-3deg); }
      10% { opacity: 1; transform: translateX(-50%) scale(1.08) rotate(1deg); }
      18% { transform: translateX(-50%) scale(1) rotate(0); }
      85% { opacity: 1; }
      100% { opacity: 0; transform: translateX(-50%) scale(1); }
    }
    @media (prefers-color-scheme: dark) {
      .panel { background: #202124; color: #e8eaed; }
      .status { background: #2d2e31; }
      .icon:hover, .tag { background: #3c4043; }
      .search { background: #202124; border-color: #5f6368; }
      .voice { border-color: #5f6368; }
      .voice option { background: #202124; }
      .chip { border-color: #5f6368; }
      .chip.on { background: #ffd43b; border-color: #ffd43b; color: #202124; }
      .list { border-color: #3c4043; }
      .list li { border-color: #2d2e31; }
      .play { background: #3c3a2a; color: #fff; }
      .tags, .volval, .empty, .foot { color: #9aa0a6; }
      .btn.stop { background: #5c2b29; color: #f6aea9; }
      .btn.test, .tabbar { background: #1f3354; color: #aecbfa; }
    }
    @media (prefers-reduced-motion: reduce) { .caption { animation: fade 3s linear forwards; } @keyframes fade { 0%, 85% { opacity: 1; } 100% { opacity: 0; } } }
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
  const closeBtn = el('button', { className: 'icon', type: 'button', title: t('close') }, '✕');
  const timerNote = el('div', { className: 'foot' });
  const panel = el('div', { className: 'panel' },
    el('div', { className: 'head' }, el('h1', {}, '😂 MemeBox'), optionsBtn, closeBtn),
    el('div', { className: 'status' }, statusDot, statusText),
    tabBar,
    search,
    chips,
    el('div', { className: 'row' }, randomBtn, beepBtn, stopBtn),
    el('div', { className: 'row' }, el('span', { title: t('volume') }, '🔊'), vol, volVal),
    el('label', { className: 'row', title: t('voice_tip') }, el('span', {}, t('voice_label')), voiceSel,
      el('span', { className: 'foot' }, 'Alt+V')),
    el('div', { className: 'checks' },
      el('label', { className: 'check', title: t('monitor_tip') }, monitorBox, t('monitor_label')),
      el('label', { className: 'check', title: t('duck_tip') }, duckBox, t('duck_label')),
      el('label', { className: 'check', title: t('cam_tip') }, camBox, t('cam_label'))),
    list,
    el('div', { className: 'foot' }, t('panel_foot')),
    timerNote,
  );
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'MemeBox');

  const toastEl = el('div', { className: 'toast', role: 'status' });
  shadow.append(style, fab, monBtn, listBtn, panel, toastEl);

  // ---------- rendering ----------

  function renderAll() {
    renderStatus();
    renderChips();
    renderList();
    renderVolume();
    renderVoice();
  }

  function renderVoice() {
    voiceSel.value = state.voice;
    voiceSel.classList.toggle('on', state.voice !== 'off');
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

  function showCaption(text) {
    for (const c of shadow.querySelectorAll('.caption')) c.remove();
    const c = el('div', { className: 'caption' }, text);
    c.setAttribute('aria-hidden', 'true');
    shadow.append(c);
    setTimeout(() => c.remove(), 3000);
  }

  // ---------- floating button: position (per site), drag, click, long-press ----------

  const FAB = 52;

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
