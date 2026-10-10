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
    const canvas = el('canvas', { className: 'fx-prev', width: 320, height: 180 });
    canvas.setAttribute('aria-hidden', 'true');
    const g = canvas.getContext('2d');
    const renderer = Fx.createRenderer();

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
    const bright = el('input', { className: 'vol', type: 'range', min: 20, max: 100, step: 5 });
    bright.setAttribute('aria-label', t('fx_bright'));
    const lampG = group(t('fx_lamp'));
    const animChips = chipRow();
    const posChips = chipRow();
    const colorsG = group(t('fx_colors'));
    const swatches = el('div', { className: 'fx-swatches' });
    const cornersG = group(t('fx_corners'));
    const patChips = chipRow();
    const looksG = group(t('fx_looks'));
    const filterChips = chipRow();
    const lampLine = el('label', { className: 'check' }, lampBox, t('fx_lamp_show'));
    const cornersLine = el('label', { className: 'check' }, cornersBox, t('fx_corners_show'));
    lampG.append(lampLine, animChips, posChips);
    colorsG.append(swatches);
    cornersG.append(cornersLine, patChips);
    looksG.append(filterChips);
    const extras = el('div', { className: 'checks' },
      el('label', { className: 'check', title: t('fx_focus_tip') }, focusBox, t('fx_focus')),
      el('label', { className: 'check', title: t('fx_sync_tip') }, syncBox, t('fx_sync')),
      el('label', { className: 'check', title: t('fx_safe_tip') }, safeBox, t('fx_safe')),
      el('div', { className: 'row' }, el('span', {}, '☀'), bright));
    const body = el('div', { className: 'settings-body fx-body' },
      el('div', { className: 'fx-how' }, t('fx_how')),
      onRow, canvas, status, lockBar, lampG, colorsG, cornersG, looksG, extras);

    const sum = el('span', { className: 'sum' });
    const details = el('details', { className: 'settings fx' }, el('summary', {}, el('span', {}, t('fx_title')), sum), body);
    api.settingsDetails.after(details);

    const wire = (box, key) => box.addEventListener('change', () => set({ [key]: box.checked }, true));
    wire(onBox, 'on'); wire(lampBox, 'lamp'); wire(cornersBox, 'corners'); wire(focusBox, 'focus'); wire(syncBox, 'sync'); wire(safeBox, 'safe');
    bright.addEventListener('input', () => set({ intensity: Number(bright.value) / 100 }));

    // ---- build the choice lists from what exists ----
    function fill() {
      const c = cfg();
      animChips.replaceChildren(...Fx.LAMP_ANIMS.map((a) =>
        chip(t('fx_anim_' + a), c.lampAnim === a, a !== 'still' && !can('lampAnim'), () => set({ lampAnim: a, lamp: true }, true))));
      posChips.replaceChildren(...['center', 'left', 'right'].map((p) =>
        chip(t('fx_pos_' + p), c.lampPos === p, false, () => set({ lampPos: p }))));
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
      filterChips.replaceChildren(...Fx.FILTERS.map((f) => {
        const locked = f !== 'none' && !Fx.FREE_FILTERS.includes(f)
          && !(Fx.PRO_FILTERS.includes(f) ? can('filtersPro') : can('filter:' + f));
        return chip(t('fx_filter_' + f), c.filter === f, locked, () => set({ filter: f }, true));
      }));
    }

    function render() {
      const c = cfg();
      onBox.checked = c.on; lampBox.checked = c.lamp; cornersBox.checked = c.corners;
      focusBox.checked = c.focus; syncBox.checked = c.sync; safeBox.checked = c.safe;
      bright.value = Math.round(c.intensity * 100);
      body.classList.toggle('fx-off', !c.on);
      sum.textContent = c.on ? t('fx_state_on') : t('fx_state_off');
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
      Fx.drawSample(sample.getContext('2d'), w, h, now);
      // The preview always shows the lights, even if the switch is off, so people see what they would get.
      const mood = ['suspense', 'excited', 'fun', 'surprise'][Math.floor(now / 3500) % 4];
      renderer.render(g, sample, w, h, { ...shown, on: true }, now, { level: 0.3 + 0.2 * Math.sin(now / 300), beat: 0, mood: shown.sync ? mood : '' },
        { preview: trying && Fx.lockedParts(c, can).length > 0, watermark: t('fx_watermark') });
      if (!trying && trialUntil) { trialUntil = 0; render(); }
      raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf && details.open && api.panelIsOpen()) raf = requestAnimationFrame(frame); };
    details.addEventListener('toggle', () => { api.panel.classList.toggle('fx-open', details.open); if (details.open) { renderer.replay && renderer.replay(performance.now()); kick(); } if (api.panelIsOpen()) api.placePanel(); });
    api.onPanelToggle((open) => { if (open) { render(); kick(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; } });
    api.onMessage((msg) => { if (msg.type === 'fx-status') { camActive = msg.active === true; render(); } });
    api.onSettings(render);
    render();
  });
})();
