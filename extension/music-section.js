// MemeBox "Music" section of the panel: original tunes (lib/music.js) that play into your call like a meme,
// and a 20 s preview on your own speakers for the Pro ones. ui.js hands over the panel tools (MemeUiMounts).
(() => {
  'use strict';
  const mounts = (globalThis.MemeUiMounts = globalThis.MemeUiMounts || []);
  mounts.push((api) => {
    const Music = globalThis.MemeMusic;
    const plan = globalThis.MemePlan;
    if (!Music || !plan) return;
    const { el, t } = api;
    const PREVIEW_SECONDS = 20;
    let callId = '';      // the tune playing into the call (the hook tells us)
    let localId = '';     // the tune playing on your own speakers only
    let local = null;     // { ctx, player }

    const can = (id) => plan.canFx('music:' + id);
    const volume = () => {
      const v = Number(api.getSettings().musicVolume);
      return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
    };

    const how = el('div', { className: 'fx-how' }, t('mu_how'));
    // ---- my own music: added right here, played into the call on repeat ----
    let mine = [];
    const mineBox = el('div', { className: 'fx-group' });
    const mineChips = el('div', { className: 'fx-chips' });
    const addInput = el('input', { type: 'file', accept: 'audio/*' });
    addInput.hidden = true;
    const addBtn = el('button', { className: 'chip add-music', type: 'button' }, t('mu_add'));
    mineBox.append(el('div', { className: 'fx-label' }, t('mu_mine')), mineChips, addInput);
    const chips = el('div', { className: 'fx-chips' });
    const status = el('div', { className: 'fx-status' });
    const stopBtn = el('button', { className: 'btn stop small', type: 'button' }, t('mu_stop'));
    const vol = el('input', { className: 'vol', type: 'range', min: 0, max: 100, step: 5 });
    vol.setAttribute('aria-label', t('mu_vol'));
    const lock = el('div', { className: 'fx-lock', hidden: true });
    const plansBtn = el('button', { className: 'btn small', type: 'button' }, t('fx_plans'));
    plansBtn.addEventListener('click', () => api.openSite('/buy'));
    lock.append(el('span', {}, t('mu_locked')), plansBtn);
    const body = el('div', { className: 'settings-body fx-body' }, how, chips, mineBox, status, lock,
      el('div', { className: 'row' }, el('span', {}, '\u{1F50A}'), vol, stopBtn));
    const sum = el('span', { className: 'sum' });
    const details = el('details', { className: 'settings fx' }, el('summary', {}, el('span', {}, t('mu_title')), sum), body);
    const anchor = api.panel.querySelector('details.fx') || api.settingsDetails;
    anchor.after(details);

    function localPlayer() {
      if (!local) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return null;
        const ctx = new AC();
        local = { ctx, player: Music.createPlayer(ctx, ctx.destination) };
      }
      if (local.ctx.state === 'suspended') local.ctx.resume().catch(() => {});
      return local;
    }
    function stopLocal() {
      if (local && local.player.playing) local.player.stop();
      localId = '';
    }

    const toBase64 = (buf) => {
      const bytes = new Uint8Array(buf);
      let s2 = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s2 += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s2);
    };
    const MAX_MUSIC = 8 * 1024 * 1024;
    addBtn.addEventListener('click', () => {
      if (!can('own')) { lock.hidden = false; api.toast(t('mu_locked'), 3500); return; }
      addInput.click();
    });
    addInput.addEventListener('change', async () => {
      const file = addInput.files[0];
      addInput.value = '';
      if (!file) return;
      if (file.size > MAX_MUSIC) { api.toast(t('mu_big'), 4200); return; }
      api.toast(t('as_working', file.name), 6000);
      const res = await api.ask({ type: 'music-add', name: file.name, mime: file.type, b64: toBase64(await file.arrayBuffer()) }).catch(() => null);
      if (res && res.ok) api.toast(t('as_added', file.name), 3500);
      else api.toast(res && res.error === 'too-many' ? t('mu_many') : res && res.error === 'too-big' ? t('mu_big') : t('as_fail', file.name), 4200);
    });
    function renderMine() {
      mineChips.replaceChildren(...mine.map((m) => {
        const on = callId === 'mine:' + m.id;
        const b = el('button', { className: 'chip' + (on ? ' on' : ''), type: 'button', title: m.name }, (on ? '▶ ' : '🎵 ') + (m.name.length > 16 ? m.name.slice(0, 15) + '…' : m.name));
        b.addEventListener('click', () => playMine(m.id));
        const x = el('button', { className: 'chip del', type: 'button', title: t('mu_del') }, '✕');
        x.addEventListener('click', async () => { if (callId === 'mine:' + m.id) stopAll(); await api.ask({ type: 'music-del', id: m.id }).catch(() => {}); });
        return el('span', { className: 'fx-pair' }, b, x);
      }), addBtn);
    }
    function playMine(id) {
      if (callId === 'mine:' + id) { stopAll(); return; }
      if (!can('own')) { lock.hidden = false; return; }
      const f = api.frameId();
      if (f == null) { api.toast(t('mu_join'), 3500); return; }
      stopAll();
      api.send({ type: 'play-mine', frameId: f, id, volume: volume() });
    }
    try {
      chrome.storage.local.get('myMusic').then((r) => { mine = Array.isArray(r.myMusic) ? r.myMusic : []; renderMine(); }).catch(() => {});
      chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.myMusic) { mine = Array.isArray(changes.myMusic.newValue) ? changes.myMusic.newValue : []; renderMine(); } });
    } catch { /* orphaned */ }

    function render() {
      renderMine();
      chips.replaceChildren(...Music.IDS.map((id) => {
        const locked = !can(id);
        const on = id === callId || id === localId;
        const b = el('button', { className: 'chip' + (on ? ' on' : '') + (locked ? ' locked' : ''), type: 'button' },
          (locked ? '\u{1F512} ' : on ? '\u25B6 ' : '') + t('mu_t_' + id));
        b.addEventListener('click', () => pick(id));
        return b;
      }));
      const locked = localId && !can(localId);
      lock.hidden = !locked;
      const callName = callId.startsWith('mine:') ? ((mine.find((m) => 'mine:' + m.id === callId) || {}).name || t('mu_mine')) : callId ? t('mu_t_' + callId) : '';
      status.textContent = callId ? t('mu_in_call', callName)
        : localId ? t('mu_preview', t('mu_t_' + localId), String(PREVIEW_SECONDS))
        : t(api.inCall() ? 'mu_idle_call' : 'mu_idle');
      status.className = 'fx-status' + (callId ? ' ok' : '');
      stopBtn.hidden = !callId && !localId;
      vol.value = Math.round(volume() * 100);
      sum.textContent = callId ? callName : localId ? t('mu_t_' + localId) : '';
      if (api.panelIsOpen()) api.placePanel();
    }

    function pick(id) {
      if (id === callId || id === localId) { stopAll(); return; }
      stopAll();
      if (can(id) && api.inCall()) {
        api.sendToHook({ type: 'music-play', value: id, volume: volume() });
      } else {
        const l = localPlayer();
        if (!l) return;
        l.player.setVolume(volume());
        l.player.play(id, PREVIEW_SECONDS);
        localId = id;
        setTimeout(() => { if (localId === id && !l.player.playing) { localId = ''; render(); } }, PREVIEW_SECONDS * 1000 + 400);
      }
      render();
    }

    function stopAll() {
      if (callId) api.sendToHook({ type: 'music-stop' });
      callId = '';
      stopLocal();
      render();
    }

    stopBtn.addEventListener('click', stopAll);
    vol.addEventListener('input', () => {
      const v = Number(vol.value) / 100;
      api.setLocal('musicVolume', v);
      api.saveSetting('musicVolume', v);
      if (callId) api.sendToHook({ type: 'music-volume', value: v });
      if (local) local.player.setVolume(v);
    });
    details.addEventListener('toggle', () => {
      api.panel.classList.toggle('fx-open', details.open || !!api.panel.querySelector('details.fx[open]'));
      if (api.panelIsOpen()) api.placePanel();
    });
    api.onPanelToggle((open) => { if (!open) stopLocal(); else render(); });
    api.onMessage((msg) => { if (msg.type === 'music-state') { callId = typeof msg.id === 'string' ? msg.id : ''; if (callId) stopLocal(); render(); } });
    render();
  });
})();
