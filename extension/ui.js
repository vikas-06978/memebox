// MemeBox – on-page UI (content script, ISOLATED world, top frame only).
// Floating 😂 button, panel, captions, Alt+1…9 shortcuts and timed lines.
// Everything lives in a closed Shadow DOM so the call site's CSS can't touch it.
(() => {
  'use strict';
  if (window !== window.top || globalThis.__memeboxUi || !globalThis.MemeBridge) return;
  globalThis.__memeboxUi = true;

  const { TONES, sanitizeLine } = globalThis.MEME;
  const bridge = globalThis.MemeBridge;
  const JOIN_FIRST = 'Join the call first, then press 😂';

  const state = {
    lines: MEME.defaultLines(),
    settings: MEME.defaultSettings(),
    pos: null,              // { x, y } of the floating button
    frames: new Map(),      // frameId -> { active, muted, ctxState, since }
    wasLive: false,
    reqId: 0,
    pending: new Map(),     // reqId -> line
    lastRandomId: null,
    nowPlayingId: null,     // highlighted in the list for 3 s
    tabAudio: false,        // another tab's sound is going into the mic
    query: '',
  };

  // ---------- storage ----------

  function applyStored(r) {
    if (Array.isArray(r.lines)) state.lines = r.lines.map(sanitizeLine).filter(Boolean);
    if (r.settings && typeof r.settings === 'object') state.settings = { ...MEME.defaultSettings(), ...r.settings };
    if (r.buttonPos && Number.isFinite(r.buttonPos.x) && Number.isFinite(r.buttonPos.y)) state.pos = r.buttonPos;
  }

  function save(obj) {
    try { chrome.storage.local.set(obj).catch(() => {}); } catch { /* orphaned */ }
  }

  try {
    chrome.storage.local.get(['lines', 'settings', 'buttonPos']).then((r) => {
      applyStored(r);
      placeFab();
      renderList();
      renderVolume();
      sendVolume();
    }).catch(() => {});
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const r = {};
      for (const k of Object.keys(changes)) r[k] = changes[k].newValue;
      if ('lines' in r && !Array.isArray(r.lines)) r.lines = MEME.defaultLines();
      applyStored(r);
      renderList();
      if ('settings' in r) { renderVolume(); sendVolume(); }
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

  const STATUS_INFO = {
    none: { color: '#9aa0a6', text: 'No call joined yet – join the call, then press 😂' },
    suspended: { color: '#f29900', text: 'Click anywhere on the page once to switch memes on' },
    muted: { color: '#f29900', text: "You're muted in the call – memes are silent until you unmute" },
    live: { color: '#1e8e3e', text: 'Memes go into your mic' },
  };

  function onFrameStatus(msg) {
    if (typeof msg.frameId !== 'number') return;
    const prev = state.frames.get(msg.frameId);
    const active = msg.active === true;
    const since = active && !(prev && prev.active) ? Date.now() : prev ? prev.since : 0;
    state.frames.set(msg.frameId, { active, muted: msg.muted === true, ctxState: String(msg.ctxState), since });

    const live = !!activeFrame();
    if (live && !state.wasLive) {
      bridge.toRuntime({ type: 'warmup' });
      sendVolume();
    }
    if (!live && state.wasLive) timerState.clear();
    state.wasLive = live;
    renderStatus();
  }

  // ---------- playing ----------

  function playLine(line) {
    if (!line) return;
    const f = activeFrame();
    if (!f) { toast(JOIN_FIRST); return; }
    const reqId = ++state.reqId;
    state.pending.set(reqId, line);
    setTimeout(() => state.pending.delete(reqId), 20000);
    if (!bridge.toRuntime({ type: 'play', frameId: f.id, reqId, item: line })) {
      toast('MemeBox was updated – reload this page');
    }
  }

  function onPlayResult(msg) {
    const line = state.pending.get(msg.reqId);
    state.pending.delete(msg.reqId);
    if (msg.ok) {
      if (line) {
        showCaption(line.text);
        state.nowPlayingId = line.id;
        renderList();
        clearTimeout(onPlayResult.t);
        onPlayResult.t = setTimeout(() => { state.nowPlayingId = null; renderList(); }, 3000);
      }
      if (msg.muted) toast("You're muted in the call – nobody heard that");
    } else {
      toast(msg.reason === 'no-call' ? JOIN_FIRST : 'Could not play: ' + msg.reason);
    }
  }

  // Hard-coded "ding-dong" straight into the mic – the quickest way to check the hook.
  function playBeep() {
    const f = activeFrame();
    if (!f) { toast(JOIN_FIRST); return; }
    const reqId = ++state.reqId;
    state.pending.set(reqId, { id: 'beep', text: '🔔 Mic test' });
    setTimeout(() => state.pending.delete(reqId), 20000);
    sendToHook({ type: 'beep', reqId });
  }

  function playRandom() {
    const pool = state.lines.length > 1 ? state.lines.filter((l) => l.id !== state.lastRandomId) : state.lines;
    if (!pool.length) { toast('No lines yet – add some in Options'); return; }
    const line = pool[Math.floor(Math.random() * pool.length)];
    state.lastRandomId = line.id;
    playLine(line);
  }

  function playFavourite(slot) {
    const line = state.lines.find((l) => l.fav === slot);
    if (line) playLine(line);
    else toast(`Nothing on Alt+${slot} yet – pick a favourite in Options`);
  }

  function stopAll() {
    sendToHook({ type: 'stop' });
    if (state.tabAudio) sendToHook({ type: 'tab-audio-stop' });
  }

  function sendToHook(cmd) {
    const f = activeFrame();
    if (f) bridge.toRuntime({ type: 'to-frame', frameId: f.id, inner: { type: 'hook', cmd } });
  }

  // Meme volume + "hear it myself" monitor.
  function sendVolume() {
    sendToHook({ type: 'volume', value: state.settings.volume });
    sendToHook({ type: 'monitor', value: state.settings.monitor === true });
  }

  function saveSetting(key, value) {
    try {
      chrome.storage.local.get('settings').then(({ settings }) => {
        save({ settings: { ...MEME.defaultSettings(), ...settings, [key]: value } });
      }).catch(() => {});
    } catch { /* orphaned */ }
  }

  bridge.onUiMessage = (msg) => {
    if (msg.type === 'frame-status') onFrameStatus(msg);
    else if (msg.type === 'play-result') onPlayResult(msg);
    else if (msg.type === 'tab-audio-start' && typeof msg.streamId === 'string') {
      if (!activeFrame()) {
        bridge.toRuntime({ type: 'tab-audio-state', on: false, error: 'no-call', fromUi: true });
        toast(JOIN_FIRST);
      } else {
        sendToHook({ type: 'tab-audio-start', value: msg.streamId });
      }
    } else if (msg.type === 'tab-audio-stop') {
      sendToHook({ type: 'tab-audio-stop' });
    } else if (msg.type === 'tab-audio-state') {
      const was = state.tabAudio;
      state.tabAudio = msg.on === true;
      renderTabAudio();
      if (msg.on) toast("📺 Your other tab's sound is going into the call");
      else if (msg.error) toast(msg.error === 'no-call' ? JOIN_FIRST : "Couldn't use that tab's sound: " + msg.error);
      else if (was) toast("📺 Stopped the other tab's sound");
    } else if (msg.type === 'command' && Number.isInteger(msg.slot)) {
      if (!isTyping(document.activeElement)) playFavourite(msg.slot);
    }
  };

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

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelOpen) { closePanel(); return; }
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !/^Digit[1-9]$/.test(e.code)) return;
    if (isEditable(e.composedPath()[0]) || isTyping(document.activeElement)) return;
    e.preventDefault();
    e.stopPropagation();
    playFavourite(Number(e.code.slice(5)));
  }, true);

  // ---------- timed lines ----------

  const timerState = new Map(); // timer id -> { day, base }
  const pad = (n) => String(n).padStart(2, '0');

  setInterval(() => {
    const s = state.settings;
    if (!s.timersEnabled || !Array.isArray(s.timers) || status() === 'none') return;
    const now = new Date();
    const hhmm = pad(now.getHours()) + ':' + pad(now.getMinutes());
    const today = now.toDateString();
    for (const t of s.timers) {
      if (!t || !t.enabled) continue;
      const line = state.lines.find((l) => l.id === t.lineId);
      if (!line) continue;
      const st = timerState.get(t.id) || {};
      timerState.set(t.id, st);
      if (t.mode === 'clock') {
        if (t.time === hhmm && st.day !== today) { st.day = today; playLine(line); }
      } else {
        const every = Math.max(1, Number(t.minutes) || 0) * 60000;
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

    .panel { position: fixed; width: 320px; max-height: min(520px, calc(100vh - 24px)); display: none;
      flex-direction: column; gap: 8px; padding: 12px; border-radius: 14px; background: #fff; color: #202124;
      box-shadow: 0 8px 28px rgba(0,0,0,.35); font: 13px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; }
    .panel.open { display: flex; }
    .head { display: flex; align-items: center; gap: 6px; }
    .head h1 { flex: 1; margin: 0; font-size: 15px; font-weight: 650; }
    .icon { border: 0; background: transparent; cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 6px; color: inherit; }
    .icon:hover { background: #f1f3f4; }
    .status { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; background: #f8f9fa; }
    .status .dot { width: 10px; height: 10px; flex: none; border-radius: 50%; background: #9aa0a6; }
    .search { width: 100%; padding: 7px 10px; border: 1px solid #dadce0; border-radius: 8px; font: inherit; color: inherit; background: #fff; }
    .search:focus { outline: 2px solid #1a73e8; border-color: transparent; }
    .row { display: flex; gap: 6px; align-items: center; }
    .btn { flex: 1; border: 0; border-radius: 8px; padding: 7px 8px; font: inherit; font-weight: 600; cursor: pointer; background: #ffd43b; color: #202124; }
    .btn.stop { background: #fce8e6; color: #c5221f; }
    .btn.test { background: #e8f0fe; color: #174ea6; }
    .btn.small { flex: none; padding: 4px 10px; font-size: 12px; }
    [hidden] { display: none !important; }
    .tabbar { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; background: #e8f0fe; color: #174ea6; }
    .tabbar span { flex: 1; }
    .btn:hover { filter: brightness(.96); }
    .vol { flex: 1; accent-color: #f59f00; }
    .check { cursor: pointer; color: inherit; }
    .check input { margin: 0; width: 15px; height: 15px; accent-color: #f59f00; }
    .volval { width: 40px; text-align: right; font-variant-numeric: tabular-nums; color: #5f6368; }
    .list { list-style: none; margin: 0; padding: 0; overflow-y: auto; min-height: 60px; border-top: 1px solid #eee; }
    .list li { display: flex; align-items: center; gap: 8px; padding: 6px 4px; border-bottom: 1px solid #f1f3f4; border-radius: 8px; }
    .list li.pick { cursor: pointer; }
    .list li.pick:hover { background: rgba(255, 212, 59, .18); }
    .list li.now { background: rgba(255, 212, 59, .38); }
    .list li.now .play { background: #ffd43b; }
    .play { flex: none; width: 30px; height: 30px; border-radius: 50%; border: 0; cursor: pointer; background: #fff4cc; font-size: 13px; color: #202124; }
    .play:hover { background: #ffd43b; }
    .txt { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .tags { flex: none; display: flex; gap: 4px; color: #5f6368; font-size: 11px; }
    .tag { padding: 1px 5px; border-radius: 6px; background: #f1f3f4; }
    .empty { padding: 12px 4px; color: #5f6368; }
    .foot { color: #5f6368; font-size: 11px; }

    .toast { position: fixed; max-width: 280px; padding: 8px 12px; border-radius: 10px; background: #202124; color: #fff;
      font: 13px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,.3);
      opacity: 0; transform: translateY(4px); transition: opacity .15s, transform .15s; pointer-events: none; }
    .toast.show { opacity: 1; transform: none; }

    .caption { position: fixed; left: 50%; top: 14vh; transform: translateX(-50%); width: max-content; max-width: 90vw;
      text-align: center; pointer-events: none; font: 900 clamp(30px, 6vw, 72px)/1.05 Impact, "Anton", "Arial Black", sans-serif;
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
      .list { border-color: #3c4043; }
      .list li { border-color: #2d2e31; }
      .play { background: #3c3a2a; color: #fff; }
      .tags, .volval, .empty, .foot { color: #9aa0a6; }
      .btn.stop { background: #5c2b29; color: #f6aea9; }
      .tabbar { background: #1f3354; color: #aecbfa; }
    }
    @media (prefers-reduced-motion: reduce) { .caption { animation: fade 3s linear forwards; } @keyframes fade { 0%, 85% { opacity: 1; } 100% { opacity: 0; } } }
  `;

  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.assign(n, props);
    n.append(...kids);
    return n;
  };

  // Floating button
  const fabDot = el('span', { className: 'dot' });
  const fab = el('button', { className: 'fab', type: 'button', title: 'MemeBox – click: random meme · hold or right-click: panel' }, '😂', fabDot);
  fab.setAttribute('aria-label', 'MemeBox: play a random meme');
  // One-click "hear memes myself" switch that sits on the 😂 button's corner.
  const monBtn = el('button', { className: 'mon', type: 'button' }, '🎧');
  // One-click "choose a meme" list button on the other corner.
  const listBtn = el('button', { className: 'mon pickbtn', type: 'button', title: 'Choose a meme to play' }, '☰');
  listBtn.setAttribute('aria-label', 'Choose a meme to play');
  monBtn.setAttribute('aria-label', 'Hear memes myself');

  // Panel
  const statusDot = el('span', { className: 'dot' });
  const statusText = el('span');
  const search = el('input', { className: 'search', type: 'search', placeholder: 'Search lines…' });
  const randomBtn = el('button', { className: 'btn', type: 'button' }, '🎲 Random');
  const stopBtn = el('button', { className: 'btn stop', type: 'button' }, '⏹ Stop');
  const beepBtn = el('button', { className: 'btn test', type: 'button', title: 'Plays a short ding-dong into your mic – ask someone in the call if they heard it' }, '🔔 Mic test');
  const vol = el('input', { className: 'vol', type: 'range', min: 0, max: 200, step: 5, title: 'Meme volume' });
  const volVal = el('span', { className: 'volval' });
  const tabStopBtn = el('button', { className: 'btn stop small', type: 'button' }, '⏹ Stop tab');
  const tabBar = el('div', { className: 'tabbar', hidden: true },
    el('span', {}, "📺 Another tab's sound is playing into your mic"), tabStopBtn);
  const monitorBox = el('input', { type: 'checkbox' });
  const list = el('ul', { className: 'list' });
  const optionsBtn = el('button', { className: 'icon', type: 'button', title: 'Options' }, '⚙️');
  const closeBtn = el('button', { className: 'icon', type: 'button', title: 'Close (Esc)' }, '✕');
  const timerNote = el('div', { className: 'foot' });
  const panel = el('div', { className: 'panel' },
    el('div', { className: 'head' }, el('h1', {}, '😂 MemeBox'), optionsBtn, closeBtn),
    el('div', { className: 'status' }, statusDot, statusText),
    tabBar,
    search,
    el('div', { className: 'row' }, randomBtn, beepBtn, stopBtn),
    el('div', { className: 'row' }, el('span', { title: 'Meme volume' }, '🔊'), vol, volVal),
    el('label', { className: 'row check', title: 'The call always gets the meme through your mic. This only adds a quiet copy on your own speakers.' },
      monitorBox, '🎧 Hear memes myself (quiet)'),
    list,
    el('div', { className: 'foot' }, 'Click a line to play it · 😂 = random · Alt+1…9 = favourites'),
    timerNote,
  );
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'MemeBox');

  const toastEl = el('div', { className: 'toast', role: 'status' });
  shadow.append(style, fab, monBtn, listBtn, panel, toastEl);

  // ---------- rendering ----------

  function renderStatus() {
    const info = STATUS_INFO[status()];
    fabDot.style.background = info.color;
    statusDot.style.background = info.color;
    statusText.textContent = info.text;
    fab.title = 'MemeBox – ' + info.text + '\nClick: random meme · hold or right-click: panel';
  }

  function renderTabAudio() {
    tabBar.hidden = !state.tabAudio;
    if (panelOpen) placePanel();
  }

  function renderVolume() {
    const pct = Math.round((Number(state.settings.volume) || 0) * 100);
    vol.value = pct;
    volVal.textContent = pct + '%';
    const on = state.settings.monitor === true;
    monitorBox.checked = on;
    monBtn.textContent = on ? '🎧' : '🔇';
    monBtn.classList.toggle('off', !on);
    monBtn.title = on
      ? 'You hear memes too (click to stop hearing them – the call still hears them)'
      : "You don't hear memes (click to hear them too – the call hears them either way)";
    monBtn.setAttribute('aria-pressed', String(on));
    const s = state.settings;
    const n = Array.isArray(s.timers) ? s.timers.filter((t) => t && t.enabled).length : 0;
    timerNote.textContent = s.timersEnabled && n ? `⏰ ${n} timed line${n > 1 ? 's' : ''} on (while a call is open)` : '';
  }

  function renderList() {
    const q = state.query.trim().toLowerCase();
    const items = state.lines.filter((l) => !q || l.text.toLowerCase().includes(q) || (l.say || '').toLowerCase().includes(q));
    const scroll = list.scrollTop;
    queueMicrotask(() => { list.scrollTop = scroll; });
    list.replaceChildren();
    if (!items.length) {
      list.append(el('li', { className: 'empty' }, state.lines.length ? 'No line matches your search.' : 'No lines yet – add some in Options.'));
      return;
    }
    for (const line of items) {
      const tone = TONES[line.tone] || TONES.normal;
      const tags = el('span', { className: 'tags' },
        line.kind === 'clip' ? el('span', { className: 'tag', title: 'Uploaded clip' }, '🎵')
          : line.kind === 'url' ? el('span', { className: 'tag', title: 'From a link: ' + line.url }, '🔗')
            : el('span', { className: 'tag', title: 'Language' }, line.lang.toUpperCase()),
        el('span', { title: tone.label }, tone.emoji));
      if (line.fav) tags.append(el('span', { className: 'tag', title: 'Shortcut' }, 'Alt+' + line.fav));
      const play = el('button', { className: 'play', type: 'button', title: 'Play' }, '▶');
      play.setAttribute('aria-label', 'Play: ' + line.text);
      // The whole row plays the line (the ▶ button's click bubbles up to here).
      const li = el('li', { className: 'pick' + (line.id === state.nowPlayingId ? ' now' : ''), title: 'Play: ' + line.text },
        play, el('span', { className: 'txt' }, line.text), tags);
      li.addEventListener('click', () => playLine(line));
      list.append(li);
    }
  }

  let toastTimer = 0;
  function toast(text) {
    toastEl.textContent = text;
    const r = fab.getBoundingClientRect();
    const w = Math.min(280, window.innerWidth - 16);
    toastEl.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8)) + 'px';
    toastEl.style.maxWidth = w + 'px';
    const above = r.top > 80;
    toastEl.style.top = above ? '' : r.bottom + 8 + 'px';
    toastEl.style.bottom = above ? window.innerHeight - r.top + 8 + 'px' : '';
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

  // ---------- floating button: position, drag, click, long-press ----------

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
    if (d.moved) save({ buttonPos: state.pos });
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
    const pw = Math.min(320, window.innerWidth - 16);
    panel.style.width = pw + 'px';
    const ph = panel.offsetHeight || 400;
    let left = r.right + 10;
    if (left + pw > window.innerWidth - 8) left = r.left - pw - 10;
    if (left < 8) left = Math.max(8, Math.min(r.left, window.innerWidth - pw - 8));
    let top = Math.min(r.top, window.innerHeight - ph - 8);
    panel.style.left = left + 'px';
    panel.style.top = Math.max(8, top) + 'px';
  }

  function openPanel() {
    panelOpen = true;
    panel.classList.add('open');
    renderStatus();
    renderList();
    renderVolume();
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
  optionsBtn.addEventListener('click', () => bridge.toRuntime({ type: 'open-options' }));
  randomBtn.addEventListener('click', playRandom);
  stopBtn.addEventListener('click', stopAll);
  beepBtn.addEventListener('click', playBeep);
  tabStopBtn.addEventListener('click', () => sendToHook({ type: 'tab-audio-stop' }));
  search.addEventListener('input', () => { state.query = search.value; renderList(); });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = state.query.trim().toLowerCase();
      const first = state.lines.find((l) => !q || l.text.toLowerCase().includes(q) || (l.say || '').toLowerCase().includes(q));
      if (first) playLine(first);
    }
  });

  let volSaveTimer = 0;
  vol.addEventListener('input', () => {
    state.settings = { ...state.settings, volume: Number(vol.value) / 100 };
    volVal.textContent = vol.value + '%';
    sendVolume();
    clearTimeout(volSaveTimer);
    volSaveTimer = setTimeout(() => saveSetting('volume', state.settings.volume), 300);
  });

  // "Hear memes myself" – switches instantly, even in the middle of a meme.
  function setMonitor(on) {
    state.settings = { ...state.settings, monitor: on };
    sendVolume();
    renderVolume();
    saveSetting('monitor', on);
    toast(on ? '🎧 You and the call both hear memes' : '🔇 Only the call hears memes now');
  }

  monitorBox.addEventListener('change', () => setMonitor(monitorBox.checked));
  monBtn.addEventListener('pointerdown', () => sendToHook({ type: 'resume' }));
  monBtn.addEventListener('click', () => setMonitor(state.settings.monitor !== true));

  // Click outside the panel closes it (events from inside our shadow root are retargeted to `host`).
  window.addEventListener('pointerdown', (e) => {
    // Our shadow root is closed, so from `window` every click inside our UI shows up as the
    // host element (the panel/buttons themselves are hidden from composedPath here).
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
    renderStatus();
    renderList();
    renderVolume();
    bridge.toRuntime({ type: 'query-status' });
    document.addEventListener('fullscreenchange', mount);
    setInterval(() => { if (!host.isConnected) mount(); }, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
