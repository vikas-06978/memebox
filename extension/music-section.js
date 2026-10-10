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
    const chips = el('div', { className: 'fx-chips' });
    const status = el('div', { className: 'fx-status' });
    const stopBtn = el('button', { className: 'btn stop small', type: 'button' }, t('mu_stop'));
    const vol = el('input', { className: 'vol', type: 'range', min: 0, max: 100, step: 5 });
    vol.setAttribute('aria-label', t('mu_vol'));
    const lock = el('div', { className: 'fx-lock', hidden: true });
    const plansBtn = el('button', { className: 'btn small', type: 'button' }, t('fx_plans'));
    plansBtn.addEventListener('click', () => api.openSite('/buy'));
    lock.append(el('span', {}, t('mu_locked')), plansBtn);
    const body = el('div', { className: 'settings-body fx-body' }, how, chips, status, lock,
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

    function render() {
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
      status.textContent = callId ? t('mu_in_call', t('mu_t_' + callId))
        : localId ? t('mu_preview', t('mu_t_' + localId), String(PREVIEW_SECONDS))
        : t(api.inCall() ? 'mu_idle_call' : 'mu_idle');
      status.className = 'fx-status' + (callId ? ' ok' : '');
      stopBtn.hidden = !callId && !localId;
      vol.value = Math.round(volume() * 100);
      sum.textContent = callId ? t('mu_t_' + callId) : localId ? t('mu_t_' + localId) : '';
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
