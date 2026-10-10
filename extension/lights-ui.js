// MemeBox "Lights & looks" section of the on-call panel. ui.js hands it the panel tools
// (globalThis.MemeUiMounts); this file only builds the section, draws the live preview and saves choices.
// The preview uses the same drawing code as the call (lib/fx-ui.js = lib/fx.js), so it shows what others will see.
(() => {
  'use strict';
  const mounts = (globalThis.MemeUiMounts = globalThis.MemeUiMounts || []);
  mounts.push((api) => {
    const Fx = globalThis.MemeFx;
    const plan = globalThis.MemePlan;
    if (!Fx || !plan) return;
    const { el, t } = api;

    const can = (f) => plan.canFx(f);
    const TRIAL_MS = 20000;            // a locked choice can be tried on your own screen for 20 s at a time
    let trialUntil = 0;
    let camActive = false;
    let raf = 0;

    const cfg = () => Fx.sanitize(api.getSettings().fx, () => true); // what was chosen (even if locked)
    const set = (patch, tryIt) => {
      const next = { ...cfg(), ...patch };
      if (patch.on === true) next.armed = true;
      api.saveSetting('fx', next);
      api.setLocal('fx', next);
      if (tryIt && Fx.lockedParts(next, can).length) trialUntil = Date.now() + TRIAL_MS;
      render();
    };

    // ---- pieces ----
    const canvas = el('canvas', { className: 'fx-prev', width: 640, height: 360 });
    canvas.setAttribute('aria-hidden', 'true');
    const g = canvas.getContext('2d');
    const renderer = Fx.createRenderer();

    let darkPreview = false; // the preview shows a dark room, to see how Lights lifts it
    const darkBtn = el('button', { className: 'chip', type: 'button' }, t('fx_darkprev'));
    darkBtn.addEventListener('click', () => { darkPreview = !darkPreview; darkBtn.classList.toggle('on', darkPreview); });
    const onBox = el('input', { type: 'checkbox' });
    const onRow = el('label', { className: 'check fx-main' }, onBox, el('b', {}, t('fx_on')));
    const status = el('div', { className: 'fx-status' });
    const lockBar = el('div', { className: 'fx-lock', hidden: true });
    const plansBtn = el('button', { className: 'btn small', type: 'button' }, t('fx_plans'));
    plansBtn.addEventListener('click', () => api.openSite('/buy'));
    lockBar.append(el('span', {}, t('fx_locked')), plansBtn);

    const group = (title) => el('div', { className: 'fx-group' }, el('div', { className: 'fx-label' }, title));
    const chipRow = () => el('div', { className: 'fx-chips' });
    const chip = (label, on, locked, onClick) => {
      const b = el('button', { className: 'chip' + (on ? ' on' : '') + (locked ? ' locked' : ''), type: 'button' }, (locked ? '🔒 ' : '') + label);
      b.addEventListener('click', onClick);
      return b;
    };
    const lampBox = el('input', { type: 'checkbox' });
    const cornersBox = el('input', { type: 'checkbox' });
    const focusBox = el('input', { type: 'checkbox' });
    const syncBox = el('input', { type: 'checkbox' });
    const safeBox = el('input', { type: 'checkbox' });
    const followBox = el('input', { type: 'checkbox' });
    const studioBox = el('input', { type: 'checkbox' });
    const hdBox = el('input', { type: 'checkbox' });
    const hdRange = el('input', { className: 'vol', type: 'range', min: 20, max: 100, step: 5 });
    hdRange.setAttribute('aria-label', t('fx_hd_amt'));
    hdRange.addEventListener('input', () => liveSet({ enhance: Number(hdRange.value) / 100 }));
    hdRange.addEventListener('change', () => render());
    const awayBox = el('input', { type: 'checkbox' });
    const bright = el('input', { className: 'vol', type: 'range', min: 20, max: 100, step: 5 });
    bright.setAttribute('aria-label', t('fx_bright'));
    // ---- quick looks: one tap sets lamp, lights, music-reaction and more together ----
    const PRESETS = {
      party:  { fixture: 'discoball', lampAnim: 'sway', lamp: true, pattern: 'auto', corners: true, sync: true, color: 'rose', intensity: 0.9, filter: 'none', studio: true, focus: true, safe: true },
      studio: { fixture: 'lamp', lampAnim: 'still', lamp: true, pattern: 'steady', corners: false, sync: false, color: 'warm', intensity: 0.85, filter: 'glam', studio: true, focus: true },
      disco:  { fixture: 'discoball', lampAnim: 'bounce', lamp: true, pattern: 'disco', corners: true, sync: true, color: 'purple', intensity: 1, filter: 'none', studio: true, focus: true },
      cozy:   { fixture: 'lantern', lampAnim: 'sway', lamp: true, pattern: 'candle', corners: true, sync: false, color: 'warm', intensity: 0.8, filter: 'warm', studio: true, focus: true },
      cinema: { fixture: 'moon', lampAnim: 'still', lamp: true, pattern: 'steady', corners: false, sync: false, color: 'blue', intensity: 0.8, filter: 'film', studio: true, focus: true },
      live:   { fixture: 'spotlight', lampAnim: 'sway', lamp: true, pattern: 'club', corners: true, sync: true, follow: true, color: 'white', intensity: 0.9, filter: 'none', studio: true, focus: true },
    };
    const presetG = group(t('fx_presets'));
    const presetChips = chipRow();
    for (const id of Object.keys(PRESETS)) {
      const b = el('button', { className: 'chip preset', type: 'button' }, t('fx_pre_' + id));
      b.addEventListener('click', () => set({ ...PRESETS[id], lampX: null, lampHang: 0, lampSize: 1, on: true }, true));
      presetChips.append(b);
    }
    presetG.append(presetChips);
    // ---- drag the lamp in the preview: it hangs exactly where you drop it ----
    let saveTimer = 0, pending = null, dragging = false;
    const liveSet = (patch) => {
      const next = { ...cfg(), ...patch };
      api.setLocal('fx', next);
      pending = next;
      if (!saveTimer) saveTimer = setTimeout(() => { saveTimer = 0; api.saveSetting('fx', pending); }, 160);
    };
    const dragTo = (ev) => {
      const r = canvas.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      const off = Fx.FIX_OFF[cfg().fixture] || 0.175;
      liveSet({ lampX: Math.min(0.94, Math.max(0.06, x)), lampHang: Math.min(0.4, Math.max(0, y - off)), lamp: true, on: true });
    };
    canvas.classList.add('fx-drag');
    canvas.addEventListener('pointerdown', (ev) => { if (ev.button !== 0) return; dragging = true; canvas.setPointerCapture(ev.pointerId); dragTo(ev); });
    canvas.addEventListener('pointermove', (ev) => { if (dragging) dragTo(ev); });
    const endDrag = () => { if (!dragging) return; dragging = false; render(); };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    const dragHint = el('div', { className: 'fx-status' }, t('fx_drag'));
    const sizeRange = el('input', { className: 'vol', type: 'range', min: 60, max: 160, step: 5 });
    sizeRange.setAttribute('aria-label', t('fx_lampsize'));
    sizeRange.addEventListener('input', () => liveSet({ lampSize: Number(sizeRange.value) / 100 }));
    sizeRange.addEventListener('change', () => render());
    const resetPos = el('button', { className: 'chip', type: 'button' }, t('fx_lampreset'));
    resetPos.addEventListener('click', () => set({ lampX: null, lampHang: 0, lampSize: 1 }));
    const lampG = group(t('fx_lamp'));
    const fixChips = chipRow();
    const animChips = chipRow();
    const posChips = chipRow();
    const angChips = chipRow();
    const colorsG = group(t('fx_colors'));
    const swatches = el('div', { className: 'fx-swatches' });
    const cornersG = group(t('fx_corners'));
    const patChips = chipRow();
    const looksG = group(t('fx_looks'));
    const filterChips = chipRow();
    const charG = group(t('fx_character'));
    const charChips = chipRow();
    const charPosChips = chipRow();
    const lampLine = el('label', { className: 'check' }, lampBox, t('fx_lamp_show'));
    const cornersLine = el('label', { className: 'check' }, cornersBox, t('fx_corners_show'));
    lampG.append(lampLine, fixChips, animChips, posChips, el('div', { className: 'fx-how' }, t('fx_angle')), angChips, el('div', { className: 'row' }, el('span', {}, t('fx_lampsize')), sizeRange, resetPos));
    colorsG.append(swatches);
    cornersG.append(cornersLine, patChips);
    looksG.append(filterChips);
    charG.append(charChips, charPosChips);
    const extras = el('div', { className: 'checks' },
      el('label', { className: 'check', title: t('fx_focus_tip') }, focusBox, t('fx_focus')),
      el('label', { className: 'check', title: t('fx_sync_tip') }, syncBox, t('fx_sync')),
      el('label', { className: 'check', title: t('fx_safe_tip') }, safeBox, t('fx_safe')),
      el('label', { className: 'check', title: t('fx_hd_tip') }, hdBox, t('fx_hd')),
      el('div', { className: 'row' }, el('span', {}, '✨'), hdRange),
      el('label', { className: 'check', title: t('fx_studio_tip') }, studioBox, t('fx_studio')),
      el('label', { className: 'check', title: t('fx_follow_tip') }, followBox, t('fx_follow')),
      el('label', { className: 'check', title: t('fx_away_tip') }, awayBox, t('fx_away')),
      el('div', { className: 'row' }, el('span', {}, '☀'), bright));
    const body = el('div', { className: 'settings-body fx-body' },
      el('div', { className: 'fx-how' }, t('fx_how')),
      onRow, presetG, canvas, dragHint, darkBtn, status, lockBar, lampG, colorsG, cornersG, looksG, charG, extras);

    // ---- the time pass: Pro / Pro Max hours of use (the service worker counts them while you are in a call) ----
    const passText = el('div', { className: 'fx-pass-text' });
    const passBtn = el('button', { className: 'btn small', type: 'button' });
    const passRow = el('div', { className: 'fx-pass' }, passText, passBtn);
    body.insertBefore(passRow, body.firstChild);
    let passOn = false;
    const clock = (s) => {
      s = Math.max(0, Math.floor(s));
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
      return h ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
    };
    function renderPass() {
      const l = plan.validLicense();
      const left = plan.passLeft();
      passRow.classList.toggle('on', passOn && left > 0);
      if (l && l.unlimited) { passText.textContent = t('fx_pass_forever'); passBtn.hidden = true; return; }
      passBtn.hidden = false;
      if (left > 0) {
        const tier = l.maxSeconds > 0 ? 'Pro Max' : 'Pro';
        passText.textContent = `${tier} · ${t('fx_pass_left', clock(left))}${passOn ? ' · ' + t('fx_pass_running') : ''}`;
        passBtn.textContent = passOn ? t('fx_pass_pause') : t('fx_pass_start');
        passBtn.dataset.mode = passOn ? 'pause' : 'start';
      } else {
        passText.textContent = t('fx_pass_none');
        passBtn.textContent = t('fx_plans');
        passBtn.dataset.mode = 'buy';
      }
    }
    passBtn.addEventListener('click', () => {
      if (passBtn.dataset.mode === 'buy') { api.openSite('/buy'); return; }
      const on = passBtn.dataset.mode === 'start';
      try { chrome.storage.local.set({ pass: { on, unsynced: 0, syncedAt: 0 } }); } catch { /* orphaned */ }
      passOn = on; renderPass();
    });
    try {
      chrome.storage.local.get('pass').then((r) => { passOn = !!(r.pass && r.pass.on === true); renderPass(); }).catch(() => {});
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes.pass) passOn = !!(changes.pass.newValue && changes.pass.newValue.on === true);
        if (changes.pass || changes.license) { renderPass(); render(); }
      });
    } catch { /* orphaned */ }
    // Tell the service worker every 10 s that a call is running with the pass on (it does the counting).
    setInterval(() => { if (passOn && plan.passLeft() > 0 && api.inCall()) api.send({ type: 'pass-tick' }); }, 10000);
    setInterval(renderPass, 15000);

    const sum = el('span', { className: 'sum' });
    const details = el('details', { className: 'settings fx' }, el('summary', {}, el('span', {}, t('fx_title')), sum), body);
    api.settingsDetails.after(details);

    const wire = (box, key) => box.addEventListener('change', () => set({ [key]: box.checked }, true));
    wire(onBox, 'on'); wire(lampBox, 'lamp'); wire(cornersBox, 'corners'); wire(focusBox, 'focus'); wire(syncBox, 'sync'); wire(safeBox, 'safe'); wire(followBox, 'follow'); hdBox.addEventListener('change', () => set({ enhance: hdBox.checked ? Math.max(0.6, cfg().enhance || 0) : 0, on: true }, true)); wire(studioBox, 'studio'); wire(awayBox, 'awayDance');
    bright.addEventListener('input', () => set({ intensity: Number(bright.value) / 100 }));

    // ---- build the choice lists from what exists ----
    function fill() {
      const c = cfg();
      fixChips.replaceChildren(...Fx.FIXTURES.map((f) =>
        chip(t('fx_fix_' + f), c.fixture === f, f !== 'lamp' && !can('fixtures'), () => set({ fixture: f, lamp: true }, true))));
      animChips.replaceChildren(...Fx.LAMP_ANIMS.map((a) =>
        chip(t('fx_anim_' + a), c.lampAnim === a, a !== 'still' && !can('lampAnim'), () => set({ lampAnim: a, lamp: true }, true))));
      posChips.replaceChildren(...['center', 'left', 'right'].map((p) =>
        chip(t('fx_pos_' + p), c.lampPos === p, false, () => set({ lampPos: p, lampX: null }))));
      angChips.replaceChildren(...['auto', 90, 60, 45, 30].map((a) =>
        chip(a === 'auto' ? t('fx_angle_auto') : a + '°', c.lightAngle === a, false, () => set({ lightAngle: a }))));
      swatches.replaceChildren(...Object.keys(Fx.COLORS).map((name) => {
        const locked = !Fx.FREE_COLORS.includes(name) && !can('colors');
        const b = el('button', { className: 'fx-sw' + (c.color === name ? ' on' : '') + (locked ? ' locked' : ''), type: 'button' });
        b.style.background = Fx.COLORS[name];
        b.setAttribute('aria-label', name + (locked ? ' 🔒' : ''));
        b.title = (locked ? '🔒 ' : '') + name;
        b.addEventListener('click', () => set({ color: name }, true));
        return b;
      }));
      patChips.replaceChildren(...Fx.PATTERNS.map((p) =>
        chip(t('fx_pat_' + p), c.pattern === p, p !== 'steady' && !can('corners'), () => set({ pattern: p, corners: true }, true))));
      charChips.replaceChildren(...['none', ...Fx.CHARACTERS].map((id) =>
        chip(t('fx_char_' + id), c.character === id, id !== 'none' && !can('character:' + id), () => set({ character: id }, true))));
      charPosChips.replaceChildren(...['left', 'right'].map((p) =>
        chip(t('fx_pos_' + p), c.charPos === p, false, () => set({ charPos: p }))));
      filterChips.replaceChildren(...Fx.FILTERS.map((f) => {
        const locked = f !== 'none' && !Fx.FREE_FILTERS.includes(f)
          && !(Fx.PRO_FILTERS.includes(f) ? can('filtersPro') : can('filter:' + f));
        return chip(t('fx_filter_' + f), c.filter === f, locked, () => set({ filter: f }, true));
      }));
    }

    function render() {
      const c = cfg();
      onBox.checked = c.on; lampBox.checked = c.lamp; cornersBox.checked = c.corners;
      focusBox.checked = c.focus; syncBox.checked = c.sync; safeBox.checked = c.safe; followBox.checked = c.follow; hdBox.checked = c.enhance > 0; hdRange.value = Math.round((c.enhance || 0.6) * 100); hdRange.disabled = !(c.enhance > 0); sizeRange.value = Math.round((c.lampSize || 1) * 100); studioBox.checked = c.studio; awayBox.checked = c.awayDance;
      bright.value = Math.round(c.intensity * 100);
      body.classList.toggle('fx-off', !c.on);
      sum.textContent = c.on ? t('fx_state_on') : t('fx_state_off');
      renderPass();
      fill();
      const locked = Fx.lockedParts(c, can);
      lockBar.hidden = locked.length === 0;
      status.textContent = !c.on ? t('fx_hint_off') : camActive ? t('fx_active') : t('fx_restart');
      status.className = 'fx-status' + (c.on && camActive ? ' ok' : '');
      if (api.panelIsOpen()) api.placePanel();
    }

    // ---- the live preview: only runs while the section is open and the panel is visible ----
    function frame() {
      raf = 0;
      if (!details.open || !api.panelIsOpen()) return;
      const now = performance.now();
      const c = cfg();
      const trying = Date.now() < trialUntil;
      const shown = trying ? c : Fx.sanitize(c, can);
      const w = canvas.width, h = canvas.height;
      const sample = frame.src || (frame.src = document.createElement('canvas'));
      sample.width = w; sample.height = h;
      const sim = shown.follow ? Fx.simulate(now) : null; // the preview "you" walks around when Follow me is on
      const sg = sample.getContext('2d');
      Fx.drawSample(sg, w, h, now, sim ? sim.person : {});
      if (darkPreview) { sg.fillStyle = 'rgba(0,0,0,0.82)'; sg.fillRect(0, 0, w, h); }
      // The preview always shows the lights, even if the switch is off, so people see what they would get.
      const mood = ['suspense', 'excited', 'fun', 'surprise'][Math.floor(now / 3500) % 4];
      renderer.render(g, sample, w, h, { ...shown, on: true }, now, { level: 0.45 + 0.3 * Math.sin(now / 300), bass: 0.5 + 0.4 * Math.max(0, Math.sin(now / 260)), mid: 0.4, high: 0.3, spec: Array.from({ length: 16 }, (_, k) => 0.55 * Math.abs(Math.sin(now / 420 + k * 0.7)) * (1 - k / 22)), tune: shown.sync ? 'club' : '', voice: sim ? sim.voice : 0, beat: now % 520 < 40 ? 1 : 0, mood: shown.sync || shown.character !== 'none' ? mood : '' },
        { preview: trying && Fx.lockedParts(c, can).length > 0, watermark: t('fx_watermark'), ...(sim ? { track: sim.track } : {}) });
      if (!trying && trialUntil) { trialUntil = 0; render(); }
      raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf && details.open && api.panelIsOpen()) raf = requestAnimationFrame(frame); };
    details.addEventListener('toggle', () => { api.panel.classList.toggle('fx-open', !!api.panel.querySelector('details.fx[open]')); if (details.open) { renderer.replay && renderer.replay(performance.now()); kick(); } if (api.panelIsOpen()) api.placePanel(); });
    api.onPanelToggle((open) => { if (open) { render(); kick(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; } });
    api.onMessage((msg) => { if (msg.type === 'fx-status') { camActive = msg.active === true; render(); } });
    api.onSettings(render);
    render();
  });
})();
