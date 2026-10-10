// MemeBox "Lights & looks": the picture on YOUR OWN camera. A hanging lamp, coloured corner lights,
// a spotlight on you, filters, and lights that follow the sounds. Pure canvas drawing, no dependencies.
// Classic script: loaded in the call page (mic-hook.js draws the camera with it) and in the panel
// (the live preview draws the same thing), so what you preview is exactly what the call sees.
//
//   const r = MemeFx.createRenderer();
//   r.render(ctx2d, source, w, h, config, performance.now(), { level, beat, mood }, { preview: true });
//
// The renderer keeps a little state (the lamp's drop animation, sparkles), so make one per camera.
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const easeOutCubic = (t) => 1 - (1 - clamp(t)) ** 3;

  // ---------- what exists, and what is free ----------

  const COLORS = {
    warm: '#ffc46b', white: '#fff3da', blue: '#8ec5ff',               // free
    rose: '#ff7eb6', purple: '#b194ff', green: '#6ee7b7', red: '#ff6b6b', cyan: '#5de1ff', gold: '#ffd54a', // Pro
  };
  const FREE_COLORS = ['warm', 'white', 'blue'];
  const LAMP_ANIMS = ['still', 'swing', 'drop', 'flicker'];        // "still" is free, the rest are Pro
  const PATTERNS = ['steady', 'pulse', 'candle', 'rainbow', 'disco', 'sweep', 'sparkle']; // corner light shows (Pro)
  const FILTERS = ['none', 'warm', 'bw', 'glow', 'vintage', 'cool', 'neon', 'noir', 'dream', 'sunset', 'pixel', 'vhs', 'cyber', 'comic', 'matrix', 'glam'];
  const FREE_FILTERS = ['none', 'warm', 'bw', 'glow'];             // 3 free
  const PRO_FILTERS = ['vintage', 'cool'];                         // + 2 in Pro = 5
  const ADDON_FILTERS = ['neon', 'noir', 'dream', 'sunset', 'pixel', 'vhs', 'cyber', 'comic', 'matrix', 'glam']; // Pro Max (or one by one)
  // Characters that sit in a bottom corner and react to the sounds. Pro: one of the standard three at a time.
  // Pro Max: all six. Every one is drawn with code (no pictures), so they are small and original.
  const STANDARD_CHARACTERS = ['cat', 'dog', 'bunny'];
  const PREMIUM_CHARACTERS = ['panda', 'owl', 'fox'];
  const CHARACTERS = [...STANDARD_CHARACTERS, ...PREMIUM_CHARACTERS];
  const MOODS = ['suspense', 'excited', 'surprise', 'sad', 'fun', 'awkward'];

  const DEFAULTS = Object.freeze({
    on: false,          // the Lights switch
    armed: false,       // the camera is prepared in the next call (set once Lights has been used)
    lamp: true,         // the hanging lamp
    lampPos: 'center',  // center | left | right (so it does not cover your face)
    lampAnim: 'still',  // still | swing | drop | flicker
    color: 'warm',      // a name from COLORS or '#rrggbb'
    pattern: 'steady',  // corner light show
    corners: false,     // coloured corner lights
    focus: true,        // darker edges, light on you
    sync: false,        // lights follow the sounds (mood, level, beat)
    safe: true,         // no flashing: slow, gentle changes only
    filter: 'none',
    character: 'none',  // none | cat | dog | bunny | panda | owl | fox
    charPos: 'right',   // left | right (bottom corner)
    intensity: 0.8,
  });

  const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

  // `can(feature)` says what the person may use: 'lampAnim', 'colors', 'corners', 'sync', 'filtersPro',
  // and for a single add-on filter 'filter:neon'. Anything locked falls back to the free choice.
  function sanitize(cfg, can = () => true) {
    const c = { ...DEFAULTS, ...(cfg && typeof cfg === 'object' ? cfg : {}) };
    const out = {
      on: c.on === true,
      armed: c.armed === true,
      lamp: c.lamp !== false,
      lampPos: ['center', 'left', 'right'].includes(c.lampPos) ? c.lampPos : 'center',
      lampAnim: LAMP_ANIMS.includes(c.lampAnim) ? c.lampAnim : 'still',
      color: Object.prototype.hasOwnProperty.call(COLORS, c.color) || isHex(c.color) ? c.color : 'warm',
      pattern: PATTERNS.includes(c.pattern) ? c.pattern : 'steady',
      corners: c.corners === true,
      focus: c.focus !== false,
      sync: c.sync === true,
      safe: c.safe !== false,
      filter: FILTERS.includes(c.filter) ? c.filter : 'none',
      character: CHARACTERS.includes(c.character) ? c.character : 'none',
      charPos: c.charPos === 'left' ? 'left' : 'right',
      intensity: Number.isFinite(Number(c.intensity)) ? clamp(Number(c.intensity), 0.2, 1) : 0.8,
    };
    if (out.lampAnim !== 'still' && !can('lampAnim')) out.lampAnim = 'still';
    if (!FREE_COLORS.includes(out.color) && !can('colors')) out.color = 'warm';
    if (out.corners && !can('corners')) out.corners = false;
    if (out.pattern !== 'steady' && !can('corners')) out.pattern = 'steady';
    if (out.sync && !can('sync')) out.sync = false;
    if (PRO_FILTERS.includes(out.filter) && !can('filtersPro')) out.filter = 'none';
    if (ADDON_FILTERS.includes(out.filter) && !can('filter:' + out.filter)) out.filter = 'none';
    if (out.character !== 'none' && !can('character:' + out.character)) out.character = 'none';
    return out;
  }

  // What would be locked in `cfg` (so the panel can say "this is a preview").
  function lockedParts(cfg, can) {
    const want = sanitize(cfg, () => true);
    const have = sanitize(cfg, can);
    const locked = [];
    for (const k of ['lampAnim', 'color', 'corners', 'pattern', 'sync', 'filter', 'character']) if (want[k] !== have[k]) locked.push(k);
    return locked;
  }

  // ---------- small helpers ----------

  function hexToRgb(hex) {
    const h = (COLORS[hex] || hex).replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgba = (rgb, a) => `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${clamp(a)})`;
  function hsl(h, s, l, a = 1) { return `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${clamp(a)})`; }
  const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  // A smooth wobble in [-1, 1]: a few sines, so it needs no random state and is the same every run.
  const wobble = (t, seed = 0) => (Math.sin(t * 2.1 + seed) + 0.6 * Math.sin(t * 3.7 + seed * 1.7 + 1.3) + 0.3 * Math.sin(t * 7.9 + seed * 2.3 + 2.2)) / 1.9;

  function glow(g, x, y, r, rgb, alpha) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(rgb, alpha));
    gr.addColorStop(0.45, rgba(rgb, alpha * 0.42));
    gr.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // A soft cone of light from (x, y) opening downwards. dir is an angle in radians (0 = straight down).
  function cone(g, x, y, length, spread, dir, rgb, alpha) {
    g.save();
    g.translate(x, y);
    g.rotate(dir);
    const grad = g.createLinearGradient(0, 0, 0, length);
    grad.addColorStop(0, rgba(rgb, alpha));
    grad.addColorStop(0.6, rgba(rgb, alpha * 0.28));
    grad.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(-spread * 0.07, 0);
    g.lineTo(spread * 0.07, 0);
    g.lineTo(spread / 2, length);
    g.lineTo(-spread / 2, length);
    g.closePath();
    g.fill();
    g.restore();
  }

  // ---------- filters ----------

  const FILTER_CSS = {
    warm: 'sepia(0.22) saturate(1.2) hue-rotate(-8deg) brightness(1.05)',
    bw: 'grayscale(1) contrast(1.12)',
    vintage: 'sepia(0.55) contrast(1.1) saturate(0.95) brightness(0.97)',
    cool: 'saturate(1.1) hue-rotate(14deg) brightness(1.03)',
    neon: 'saturate(2.1) contrast(1.28) brightness(1.08) hue-rotate(-18deg)',
    noir: 'grayscale(1) contrast(1.65) brightness(0.86)',
    sunset: 'sepia(0.45) saturate(1.7) hue-rotate(-24deg) brightness(1.04)',
    dream: 'blur(1.1px) saturate(1.3) brightness(1.08)',
    vhs: 'saturate(1.35) contrast(1.08) brightness(1.03)',
    cyber: 'saturate(1.5) contrast(1.18) brightness(0.96)',
    comic: 'saturate(1.9) contrast(1.55) brightness(1.02)',
    matrix: 'grayscale(1) contrast(1.35) brightness(0.9)',
    glam: 'brightness(1.12) contrast(0.92) saturate(1.2) sepia(0.12)',
  };

  function makeScratch(w, h) {
    return typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  }

  // The "styled" filters: a base colour grade (FILTER_CSS) plus overlays drawn on top.
  function drawStyled(R, g, src, w, h, filter, now) {
    const t = now / 1000;
    g.save();
    if (filter === 'vhs') {
      if ('filter' in g) { // colour fringes: a red ghost to the left, a cyan one to the right
        const off = Math.max(2, Math.round(w / 200));
        g.globalCompositeOperation = 'screen';
        g.globalAlpha = 0.22;
        g.filter = 'sepia(1) saturate(7) hue-rotate(-45deg) brightness(0.8)';
        g.drawImage(src, -off, 0, w, h);
        g.filter = 'sepia(1) saturate(7) hue-rotate(150deg) brightness(0.8)';
        g.drawImage(src, off, 0, w, h);
        g.filter = 'none';
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 0.16;
      g.fillStyle = '#000';
      const step = Math.max(3, Math.round(h / 140));
      for (let y = 0; y < h; y += step) g.fillRect(0, y, w, 1);
      const band = ((t * 0.18) % 1.3 - 0.15) * h; // a slow tracking band rolling down
      const bg = g.createLinearGradient(0, band, 0, band + h * 0.09);
      bg.addColorStop(0, 'rgba(255,255,255,0)'); bg.addColorStop(0.5, 'rgba(255,255,255,0.10)'); bg.addColorStop(1, 'rgba(255,255,255,0)');
      g.globalAlpha = 1; g.fillStyle = bg; g.fillRect(0, band, w, h * 0.09);
      const fs = Math.max(11, Math.round(h * 0.05));
      g.font = `700 ${fs}px "Courier New", monospace`; g.textBaseline = 'top';
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillText('PLAY \u25B6', fs * 0.7, fs * 0.6);
      if (Math.floor(t) % 2 === 0) { g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(w - fs * 1.1, fs * 1.1, fs * 0.32, 0, TAU); g.fill(); }
    } else if (filter === 'cyber') {
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#00e5ff'); gr.addColorStop(0.5, '#6a4cff'); gr.addColorStop(1, '#ff2bd6');
      g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.7; g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.1; g.fillRect(0, 0, w, h);
    } else if (filter === 'comic') {
      const dot = Math.max(5, Math.round(h / 55));
      if (!R.dots || R.dotsH !== h) {
        R.dotsH = h; R.dots = makeScratch(w, h);
        const dg = R.dots.getContext('2d');
        dg.fillStyle = '#fff'; dg.fillRect(0, 0, w, h); dg.fillStyle = '#000';
        for (let y = 0, r = 0; y < h + dot; y += dot, r++) for (let x = (r % 2) * dot / 2; x < w + dot; x += dot) { dg.beginPath(); dg.arc(x, y, dot * 0.2, 0, TAU); dg.fill(); }
      }
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.2; g.drawImage(R.dots, 0, 0, w, h);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.strokeStyle = 'rgba(20,20,30,0.85)'; g.lineWidth = Math.max(3, h * 0.012); g.strokeRect(0, 0, w, h); // a comic panel border
    } else if (filter === 'matrix') {
      g.globalCompositeOperation = 'multiply'; g.fillStyle = '#19ff7a'; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
      const fs = Math.max(10, Math.round(h / 28)), cols = Math.ceil(w / fs);
      if (!R.rain || R.rain.length !== cols) R.rain = Array.from({ length: cols }, (_, i) => ({ y: ((i * 7919) % 97) / 97 * h, v: 0.35 + ((i * 31) % 13) / 13 }));
      g.font = `${fs}px "Courier New", monospace`; g.textBaseline = 'top';
      const dt = Math.min(0.1, R.matrixAt ? t - R.matrixAt : 0.033); R.matrixAt = t;
      R.rain.forEach((c, i) => {
        c.y = (c.y + c.v * h * 0.35 * dt) % (h + fs * 8);
        for (let k = 0; k < 7; k++) {
          const y = c.y - k * fs; if (y < -fs || y > h) continue;
          g.fillStyle = k === 0 ? 'rgba(210,255,225,0.95)' : `rgba(40,255,120,${0.55 - k * 0.07})`;
          g.fillText(String.fromCharCode(0x30A0 + ((i * 13 + k * 7 + Math.floor(t * 6)) % 60)), i * fs, y);
        }
      });
    } else if (filter === 'glam') {
      g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.42;
      if ('filter' in g) g.filter = `blur(${Math.max(4, Math.round(h / 60))}px) brightness(1.25)`;
      g.drawImage(src, 0, 0, w, h);
      g.filter = 'none';
      g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.3; g.fillStyle = '#ff8fb8'; g.fillRect(0, 0, w, h);
      const vg = g.createRadialGradient(w / 2, h * 0.45, h * 0.3, w / 2, h * 0.45, h * 0.95); // a soft golden vignette
      vg.addColorStop(0, 'rgba(255,200,120,0)'); vg.addColorStop(1, 'rgba(255,170,90,0.35)');
      g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 1; g.fillStyle = vg; g.fillRect(0, 0, w, h);
    }
    g.restore();
  }

  function drawFiltered(R, g, src, w, h, filter, now = 0) {
    const css = FILTER_CSS[filter];
    if (filter === 'pixel') {
      const sw = Math.max(24, Math.round(w / 14)), sh = Math.max(18, Math.round(h / 14));
      if (!R.pix || R.pix.width !== sw || R.pix.height !== sh) R.pix = makeScratch(sw, sh);
      const pg = R.pix.getContext('2d');
      pg.imageSmoothingEnabled = true;
      pg.drawImage(src, 0, 0, sw, sh);
      g.save();
      g.imageSmoothingEnabled = false;
      g.drawImage(R.pix, 0, 0, sw, sh, 0, 0, w, h);
      g.restore();
      return;
    }
    if (css && 'filter' in g) {
      g.filter = css;
      g.drawImage(src, 0, 0, w, h);
      g.filter = 'none';
    } else {
      g.drawImage(src, 0, 0, w, h);
    }
    if (filter === 'glow' || filter === 'dream') {
      g.save();
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = filter === 'glow' ? 0.32 : 0.22;
      if ('filter' in g) g.filter = `blur(${Math.max(4, Math.round(h / 60))}px) brightness(1.25)`;
      g.drawImage(src, 0, 0, w, h);
      g.restore();
    } else if (filter === 'vhs' || filter === 'cyber' || filter === 'comic' || filter === 'matrix' || filter === 'glam') {
      drawStyled(R, g, src, w, h, filter, now);
    } else if (filter === 'cool' || filter === 'sunset' || filter === 'vintage') {
      g.save();
      g.globalCompositeOperation = 'soft-light';
      g.globalAlpha = filter === 'cool' ? 0.22 : 0.28;
      g.fillStyle = filter === 'cool' ? '#4a7bd0' : filter === 'sunset' ? '#ff8a3d' : '#b08a5a';
      g.fillRect(0, 0, w, h);
      g.restore();
    }
  }

  // ---------- moods: what the lights do for the sound that is playing ----------

  const MOOD = {
    suspense: { rgb: [122, 92, 255], pattern: 'pulse', period: 3.8, focus: 0.3, dim: 0.9, swing: 0.05 },
    excited:  { rgb: null, pattern: 'rainbow', period: 1, focus: 0, dim: 1.15, beats: true },
    surprise: { rgb: [255, 226, 140], pattern: 'steady', period: 1, focus: 0.05, dim: 1.2, burst: true },
    sad:      { rgb: [91, 141, 239], pattern: 'steady', period: 1, focus: 0.22, dim: 0.5 },
    fun:      { rgb: null, pattern: 'sparkle', period: 1, focus: 0, dim: 1 },
    awkward:  { rgb: [140, 175, 230], pattern: 'steady', period: 1, focus: 0.42, dim: 0.35 },
  };

  // ---------- the renderer ----------

  function createRenderer() {
    const R = {
      dropStart: -1, lastKey: '', mood: '', moodBlend: 0, moodStart: 0, lastSeen: 0,
      beat: 0, lastBeat: 0, burstAt: -1, sparkles: [], lastT: 0, pix: null,
      charStart: -1, charKey: '', cMood: '', cSeen: -1e9, cStart: 0,
    };

    // Lamp: drawn around (0,0) = the point where the cord hangs.
    function drawLamp(g, w, h, st) {
      const { cx, rgb, bright, angle, dy } = st;
      const lampW = h * 0.23, lampH = h * 0.14, cord = h * 0.12 + dy;
      g.save();
      g.translate(cx, 0);
      g.rotate(angle);
      // cord and cap
      g.strokeStyle = '#17171c';
      g.lineWidth = Math.max(2, h * 0.0045);
      g.beginPath(); g.moveTo(0, -h * 0.1 + dy); g.lineTo(0, cord); g.stroke();
      g.fillStyle = '#2a2b33';
      g.fillRect(-lampW * 0.07, cord - lampH * 0.1, lampW * 0.14, lampH * 0.16);
      // shade
      g.translate(0, cord);
      const sg = g.createLinearGradient(-lampW / 2, 0, lampW / 2, 0);
      sg.addColorStop(0, '#1d1e2b'); sg.addColorStop(0.35, '#4d5170'); sg.addColorStop(0.55, '#3a3d58'); sg.addColorStop(1, '#171824');
      g.fillStyle = sg;
      g.beginPath();
      g.moveTo(-lampW / 2, lampH);
      g.bezierCurveTo(-lampW / 2, lampH * 0.28, -lampW * 0.22, 0, 0, 0);
      g.bezierCurveTo(lampW * 0.22, 0, lampW / 2, lampH * 0.28, lampW / 2, lampH);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.lineWidth = Math.max(1, h * 0.0025);
      g.beginPath();
      g.moveTo(-lampW * 0.33, lampH * 0.62);
      g.bezierCurveTo(-lampW * 0.33, lampH * 0.3, -lampW * 0.15, lampH * 0.1, -lampW * 0.02, lampH * 0.09);
      g.stroke();
      // lit opening and bulb
      const og = g.createRadialGradient(0, lampH, 0, 0, lampH, lampW * 0.5);
      og.addColorStop(0, rgba([255, 252, 240], 0.55 + 0.45 * bright));
      og.addColorStop(0.5, rgba(rgb, 0.75 * bright + 0.15));
      og.addColorStop(1, rgba(rgb, 0.05));
      g.fillStyle = og;
      g.beginPath(); g.ellipse(0, lampH, lampW / 2, lampH * 0.13, 0, 0, TAU); g.fill();
      const bulb = lampH * 0.17;
      const bg = g.createRadialGradient(0, lampH + bulb * 0.2, 0, 0, lampH + bulb * 0.2, bulb * 2.6);
      bg.addColorStop(0, rgba([255, 255, 255], 0.95 * bright));
      bg.addColorStop(0.28, rgba(rgb, 0.9 * bright));
      bg.addColorStop(1, rgba(rgb, 0));
      g.globalCompositeOperation = 'screen';
      g.fillStyle = bg;
      g.beginPath(); g.arc(0, lampH + bulb * 0.2, bulb * 2.6, 0, TAU); g.fill();
      g.restore();
    }

    // Where the lamp is, and how it moves, at time `now`.
    function lampState(cfg, h, now, e) {
      const anim = cfg.lampAnim;
      let dy = 0, angle = 0, bright = 1, focusRamp = 1;
      const t = now / 1000;
      if (anim === 'swing' || e.swing) {
        const a = e.swing || 0.11;
        angle = a * Math.sin(t * (TAU / (e.swingPeriod || 3.4)));
      } else if (anim === 'still') {
        angle = 0;
      }
      if (anim === 'flicker') bright = clamp(0.78 + 0.28 * wobble(t * 3.2, 4), 0.35, 1);
      if (anim === 'drop' && R.dropStart >= 0) {
        const D = 2.8; // seconds: a slow, smooth drop from above
        const tau = (now - R.dropStart) / 1000;
        const travel = h * 0.46;
        dy = -travel * (1 - easeOutCubic(tau / D));
        if (tau > D) {
          const s = tau - D;
          dy += h * 0.012 * Math.exp(-3.2 * s) * Math.sin(TAU * 2.3 * s);
          angle = 0.15 * Math.exp(-1.5 * s) * Math.sin(TAU * 0.85 * s) + 0.012 * Math.sin(t * 1.7);
        }
        bright = tau < D ? 0.2 : clamp(0.2 + (tau - D) / 0.45, 0, 1) * (tau < D + 0.5 ? 0.78 + 0.22 * wobble(t * 18) : 1);
        focusRamp = smooth((tau - D * 0.35) / (D * 0.9));
      }
      return { dy, angle, bright: clamp(bright), focusRamp };
    }

    function corner(g, x, y, r, rgb, a) { glow(g, x, y, r, rgb, a); }

    function drawCorners(g, w, h, pattern, rgb, I, now, e) {
      const t = now / 1000, r = Math.max(w, h) * 0.58;
      const pts = [[0, 0], [w, 0], [0, h], [w, h]];
      g.save();
      g.globalCompositeOperation = 'screen';
      const beat = e.beat || 0;
      const lvl = e.level || 0;
      if (pattern === 'steady') {
        for (const [x, y] of pts) corner(g, x, y, r, rgb, 0.5 * I + 0.25 * lvl);
      } else if (pattern === 'pulse') {
        const k = 0.5 + 0.5 * Math.sin(t * (TAU / (e.period || 2.6)));
        for (const [x, y] of pts) corner(g, x, y, r, rgb, (0.2 + 0.4 * k) * I + 0.25 * lvl);
      } else if (pattern === 'candle') {
        const warm = hexToRgb('warm');
        pts.forEach(([x, y], i) => corner(g, x, y, r * (0.92 + 0.08 * wobble(t * 2.4, i)), warm, clamp(0.34 + 0.2 * wobble(t * 3.1, i * 3)) * I));
      } else if (pattern === 'rainbow') {
        pts.forEach(([x, y], i) => {
          const hue = (t * 38 + i * 90) % 360;
          glow(g, x, y, r, hexToRgb(hslHex(hue)), (0.5 * I) + 0.3 * lvl + 0.3 * beat);
        });
      } else if (pattern === 'sweep') {
        const hue = (t * 22) % 360;
        const c1 = hexToRgb(hslHex(hue)), c2 = hexToRgb(hslHex(hue + 140));
        const x = (0.5 + 0.5 * Math.sin(t * 0.55)) * w;
        glow(g, x, 0, w * 0.7, c1, 0.45 * I + 0.25 * lvl);
        glow(g, w - x, h, w * 0.7, c2, 0.45 * I + 0.25 * lvl);
        glow(g, 0, h * 0.5, r * 0.6, c2, 0.18 * I);
        glow(g, w, h * 0.5, r * 0.6, c1, 0.18 * I);
      } else if (pattern === 'sparkle') {
        for (const [x, y] of pts) corner(g, x, y, r * 0.8, rgb, 0.22 * I);
        drawSparkles(g, w, h, rgb, I, t, e);
      } else if (pattern === 'disco') {
        const sway = e.safe ? 0.5 : 0.9;
        for (let side = 0; side < 2; side++) {
          const x = side ? w : 0;
          for (let b = 0; b < 3; b++) {
            const hue = (t * 30 + side * 120 + b * 80) % 360;
            const base = side ? 0.2 : -0.2;
            const dir = base + 0.62 * Math.sin(t * sway + b * 1.9 + side * 1.2);
            cone(g, x, -h * 0.02, h * 1.25, w * 0.42, dir * (side ? 1 : 1) , hexToRgb(hslHex(hue)), (0.36 * I) + 0.2 * lvl + 0.2 * beat);
          }
        }
        corner(g, 0, h, r * 0.7, hexToRgb(hslHex((t * 30 + 200) % 360)), 0.28 * I);
        corner(g, w, h, r * 0.7, hexToRgb(hslHex((t * 30 + 300) % 360)), 0.28 * I);
      }
      g.restore();
    }

    function hslHex(hue) {
      // hsl(hue, 90%, 62%) as #rrggbb
      const s = 0.9, l = 0.62, c = (1 - Math.abs(2 * l - 1)) * s, hp = (((hue % 360) + 360) % 360) / 60, x = c * (1 - Math.abs((hp % 2) - 1));
      const [r1, g1, b1] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
      const m = l - c / 2, to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
      return '#' + to(r1) + to(g1) + to(b1);
    }

    function drawSparkles(g, w, h, rgb, I, t, e) {
      if (t - R.lastT > 0.05) {
        R.lastT = t;
        if (R.sparkles.length < 44 && Math.random() < 0.55 + (e.level || 0)) {
          const edge = Math.random();
          R.sparkles.push({
            x: edge < 0.5 ? Math.random() * w : (Math.random() < 0.5 ? Math.random() * w * 0.2 : w - Math.random() * w * 0.2),
            y: edge < 0.5 ? (Math.random() < 0.5 ? Math.random() * h * 0.25 : h - Math.random() * h * 0.25) : Math.random() * h,
            born: t, life: 0.8 + Math.random() * 0.9, size: h * (0.012 + Math.random() * 0.022), hue: Math.random() * 360,
          });
        }
      }
      R.sparkles = R.sparkles.filter((s) => t - s.born < s.life);
      for (const s of R.sparkles) {
        const p = (t - s.born) / s.life, a = Math.sin(Math.PI * p) * I;
        g.fillStyle = hsl(s.hue, 95, 80, a);
        const len = s.size * (0.6 + 0.4 * a);
        g.beginPath();
        g.moveTo(s.x, s.y - len); g.lineTo(s.x + len * 0.18, s.y - len * 0.18); g.lineTo(s.x + len, s.y); g.lineTo(s.x + len * 0.18, s.y + len * 0.18);
        g.lineTo(s.x, s.y + len); g.lineTo(s.x - len * 0.18, s.y + len * 0.18); g.lineTo(s.x - len, s.y); g.lineTo(s.x - len * 0.18, s.y - len * 0.18);
        g.closePath(); g.fill();
      }
    }

    // One burst of rays from the middle (the "surprise" mood).
    function drawBurst(g, w, h, now) {
      const tau = (now - R.burstAt) / 1000;
      if (tau < 0 || tau > 1.1) return;
      const a = (1 - tau / 1.1) ** 1.4;
      g.save();
      g.globalCompositeOperation = 'screen';
      g.translate(w / 2, h * 0.45);
      for (let i = 0; i < 14; i++) {
        g.rotate(TAU / 14);
        const grad = g.createLinearGradient(0, 0, 0, h * (0.35 + tau * 0.5));
        grad.addColorStop(0, `rgba(255,236,160,${0.5 * a})`);
        grad.addColorStop(1, 'rgba(255,236,160,0)');
        g.fillStyle = grad;
        g.fillRect(-h * 0.012, h * 0.04, h * 0.024, h * (0.35 + tau * 0.5));
      }
      g.restore();
    }

    // ---- characters ----
    const easeOutBack = (x) => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
    const FUR = {
      cat:   { fur: '#f4a259', light: '#fff0dc', dark: '#b8651f', ear: '#ff9fb5' },
      dog:   { fur: '#c98d5c', light: '#f5dfc3', dark: '#7a4a28', ear: '#8a5430' },
      bunny: { fur: '#f6f1ee', light: '#ffffff', dark: '#cfc3bd', ear: '#ffb3c6' },
      panda: { fur: '#fbfbfb', light: '#ffffff', dark: '#26262b', ear: '#26262b' },
      owl:   { fur: '#9a7452', light: '#e8d3b0', dark: '#5f452c', ear: '#7d5b3b' },
      fox:   { fur: '#ee7b30', light: '#fff4e6', dark: '#3a2418', ear: '#3a2418' },
    };

    // How the character feels for the sound that is playing (it holds the feeling for 1.6 s).
    function characterMood(audio, now) {
      const lvl = audio ? clamp(audio.level || 0) : 0;
      if (audio && MOODS.includes(audio.mood) && lvl > 0.02) {
        if (R.cMood !== audio.mood) R.cStart = now;
        R.cMood = audio.mood; R.cSeen = now;
      }
      const m = now - R.cSeen < 1600 ? R.cMood : '';
      return { mood: m, lvl, since: (now - R.cStart) / 1000 };
    }

    function ell(g, x, y, rx, ry, fill, rot = 0) {
      g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); g.fill();
    }
    function tri(g, a, b, c, fill) {
      g.fillStyle = fill; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.closePath(); g.fill();
    }

    // The character is drawn in a 100-unit box: the ground is y = 0, the head is around y = -62.
    function drawCharacter(g, w, h, kind, pos, now, audio) {
      const P = FUR[kind];
      const t = now / 1000;
      const S = h * 0.4, u = S / 100;
      const { mood, lvl, since } = characterMood(audio, now);
      const ex = mood === 'excited' || mood === 'fun' ? 'happy' : mood === 'surprise' ? 'wow' : mood === 'sad' ? 'sad'
        : mood === 'suspense' ? 'wary' : mood === 'awkward' ? 'awk' : 'idle';
      const rise = (1 - easeOutBack((now - R.charStart) / 900)) * 125; // pops up from the bottom with a little bounce
      let bob = Math.sin(t * 1.7) * 1.2 + lvl * 2.5;                  // breathing
      let tilt = 0, lift = 0;
      if (ex === 'happy') { bob = -Math.abs(Math.sin(t * (mood === 'fun' ? 5 : 7))) * 9; tilt = Math.sin(t * (mood === 'fun' ? 5 : 7)) * 0.07; }
      if (ex === 'wow') { lift = Math.max(0, Math.sin(clamp(since * 3.2, 0, Math.PI))) * 16; }
      if (ex === 'sad') bob = 6 + Math.sin(t * 1.1);
      if (ex === 'wary') tilt = Math.sin(t * 1.3) * 0.04;
      const blink = (now % 3600) < 130 && ex !== 'happy';
      const wag = Math.sin(t * (ex === 'happy' ? 11 : 3.2));
      const x = pos === 'left' ? S * 0.6 : w - S * 0.6;
      g.save();
      g.translate(x, h + rise * u + 4 * u);
      g.scale(u, u);
      g.translate(0, bob - lift);
      g.rotate(tilt);
      g.lineCap = 'round'; g.lineJoin = 'round';

      // tail (behind)
      if (kind === 'cat' || kind === 'dog' || kind === 'fox') {
        g.save(); g.translate(28, -18); g.rotate(-0.5 + wag * 0.35);
        g.strokeStyle = P.fur; g.lineWidth = kind === 'fox' ? 17 : 9;
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(26, -8, 24, -38); g.stroke();
        if (kind === 'fox') { g.strokeStyle = P.light; g.lineWidth = 12; g.beginPath(); g.moveTo(21, -24); g.quadraticCurveTo(25, -30, 24, -38); g.stroke(); }
        g.restore();
      }
      // body
      ell(g, 0, -14, 37, 36, P.fur);
      if (kind === 'owl') ell(g, 0, -12, 25, 28, P.light);
      else if (kind !== 'panda' || true) ell(g, 0, -6, 21, 24, kind === 'panda' ? P.fur : P.light);
      // arms: they wave when the sound is fun
      const wave = ex === 'happy' ? Math.sin(t * 9) * 0.5 : 0;
      for (const s of [-1, 1]) {
        g.save(); g.translate(s * 30, -20); g.rotate(s * (0.35 + (ex === 'happy' ? 0.9 + wave * s : 0)));
        ell(g, 0, 8, 9, 17, kind === 'panda' ? P.dark : P.fur);
        g.restore();
      }
      // ears that sit behind the head
      const earY = -86;
      if (kind === 'cat' || kind === 'fox') {
        for (const s of [-1, 1]) {
          const d = ex === 'sad' ? 8 : 0;
          tri(g, [s * 8, earY + 8], [s * 30, earY - 14 + d], [s * 31, earY + 14], kind === 'fox' ? P.fur : P.fur);
          tri(g, [s * 14, earY + 8], [s * 27, earY - 6 + d], [s * 28, earY + 11], P.ear);
          if (kind === 'fox') tri(g, [s * 22, earY - 4 + d], [s * 30, earY - 14 + d], [s * 31, earY + 6], P.dark);
        }
      } else if (kind === 'bunny') {
        for (const s of [-1, 1]) {
          const droop = ex === 'sad' ? 0.9 : 0, sway = Math.sin(t * 2 + s) * 0.05;
          g.save(); g.translate(s * 13, -88); g.rotate(s * (0.12 + droop) + sway);
          ell(g, 0, -22, 10, 30, P.fur); ell(g, 0, -20, 5.5, 22, P.ear);
          g.restore();
        }
      } else if (kind === 'panda') {
        for (const s of [-1, 1]) ell(g, s * 27, -88, 12, 12, P.ear);
      } else if (kind === 'owl') {
        for (const s of [-1, 1]) tri(g, [s * 12, -90], [s * 30, -108], [s * 32, -80], P.dark);
      }

      // head
      ell(g, 0, -62, 36, 33, P.fur);
      if (kind === 'owl') { ell(g, 0, -58, 30, 26, P.light); }
      if (kind === 'dog') { for (const s of [-1, 1]) { g.save(); g.translate(s * 31, -74); g.rotate(s * (ex === 'sad' ? 0.1 : -0.15) + wag * 0.04 * s); ell(g, 0, 12, 11, 24, P.ear); g.restore(); } }
      if (kind === 'panda') for (const s of [-1, 1]) { g.save(); g.translate(s * 14, -64); g.rotate(s * 0.45); ell(g, 0, 0, 8, 11, P.dark); g.restore(); }
      if (kind === 'fox') { for (const s of [-1, 1]) tri(g, [s * 36, -62], [s * 12, -42], [s * 30, -42], P.light); ell(g, 0, -44, 15, 10, P.light); }
      if (kind === 'cat') { // stripes
        g.strokeStyle = P.dark; g.lineWidth = 2.4;
        for (const dx of [-8, 0, 8]) { g.beginPath(); g.moveTo(dx, -94); g.lineTo(dx * 0.8, -86); g.stroke(); }
      }
      if (kind === 'cat' || kind === 'dog' || kind === 'bunny') ell(g, 0, -50, 17, 12, P.light); // muzzle

      // eyes
      const ey = -64, ed = kind === 'owl' ? 15 : 14;
      const dark = '#23222b';
      for (const s of [-1, 1]) {
        const cx = s * ed;
        if (kind === 'panda') { g.save(); g.translate(cx, ey); g.rotate(s * 0.5); ell(g, 0, 0, 7.5, 10, P.dark); g.restore(); }
        if (kind === 'owl') ell(g, cx, ey, 12, 12, '#fffdf5');
        if (blink) {
          g.strokeStyle = kind === 'panda' ? '#fff' : dark; g.lineWidth = 2.6; g.beginPath(); g.moveTo(cx - 5, ey); g.lineTo(cx + 5, ey); g.stroke();
          continue;
        }
        if (ex === 'happy') {
          g.strokeStyle = kind === 'panda' ? '#fff' : dark; g.lineWidth = 3; g.beginPath(); g.arc(cx, ey + 2, 5.5, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
          continue;
        }
        const r = ex === 'wow' ? 8 : kind === 'owl' ? 7 : 5.5;
        const look = ex === 'awk' ? 3 * Math.sign(Math.sin(t * 0.8)) : 0;
        if (kind !== 'panda' && kind !== 'owl') ell(g, cx, ey, r + 1.5, r + 2, '#ffffff');
        ell(g, cx + look, ey, kind === 'panda' ? r - 1 : r - 1.2, kind === 'panda' ? r - 1 : r, kind === 'panda' ? '#fff' : dark);
        ell(g, cx + look + (kind === 'panda' ? 0 : 0), ey, r * 0.62, r * 0.62, dark);
        ell(g, cx + look + 1.6, ey - 2, 1.8, 1.8, '#fff'); // sparkle in the eye
        if (ex === 'wary') { g.fillStyle = P.fur; g.fillRect(cx - 10, ey - 11, 20, 10); g.strokeStyle = dark; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 8, ey - 1); g.lineTo(cx + 8, ey - 1); g.stroke(); }
        if (ex === 'sad') { g.strokeStyle = dark; g.lineWidth = 2.4; g.beginPath(); g.moveTo(cx - s * 9, ey - 11 - s * 0); g.lineTo(cx + s * 7, ey - 7 - 4 * 0); g.stroke(); }
      }
      if (ex === 'sad') { // a tear
        const k = (t * 0.7) % 1;
        ell(g, -ed - 2, -56 + k * 16, 2.6, 3.8, 'rgba(110,180,255,' + (0.9 - k * 0.7) + ')');
      }
      if (ex === 'awk') { // a sweat drop
        const k = (t * 0.9) % 1;
        ell(g, 32, -82 + k * 10, 3.4, 5, 'rgba(120,190,255,' + (0.95 - k * 0.5) + ')');
      }

      // nose and mouth
      if (kind === 'owl') {
        tri(g, [-5, -52], [5, -52], [0, -42], '#f2a33a');
      } else {
        if (kind === 'cat') tri(g, [-4, -53], [4, -53], [0, -48], '#ff8fa8');
        else if (kind === 'bunny') ell(g, 0, -52, 4, 3, '#ff9bb3');
        else ell(g, 0, -53, kind === 'dog' ? 6 : 4.5, kind === 'dog' ? 4.5 : 3.4, dark);
        g.strokeStyle = dark; g.fillStyle = dark; g.lineWidth = 2.2;
        const my = -48;
        if (ex === 'happy') {
          g.beginPath(); g.moveTo(-8, my); g.quadraticCurveTo(0, my + 16, 8, my); g.closePath(); g.fill();
          if (kind === 'dog' || kind === 'cat') ell(g, 0, my + 7, 4.5, 4, '#ff7a8f');
        } else if (ex === 'wow') {
          ell(g, 0, my + 4, 4, 6, dark);
        } else if (ex === 'sad') {
          g.beginPath(); g.arc(0, my + 9, 7, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
        } else if (ex === 'wary') {
          g.beginPath(); g.moveTo(-5, my + 2); g.lineTo(5, my + 2); g.stroke();
        } else if (ex === 'awk') {
          g.beginPath(); g.moveTo(-6, my + 3); g.quadraticCurveTo(-3, my - 1, 0, my + 3); g.quadraticCurveTo(3, my + 7, 6, my + 3); g.stroke();
        } else {
          g.beginPath();
          if (kind === 'cat') { g.arc(-3.5, my, 3.5, 0.1 * Math.PI, 0.9 * Math.PI); g.moveTo(10.5, my + 1); g.arc(3.5, my, 3.5, 0.1 * Math.PI, 0.9 * Math.PI); }
          else g.arc(0, my - 3, 8, 0.2 * Math.PI, 0.8 * Math.PI);
          g.stroke();
        }
        if (kind === 'bunny' && (ex === 'idle' || ex === 'happy')) { g.fillStyle = '#fff'; g.strokeStyle = P.dark; g.lineWidth = 1; g.fillRect(-3.4, my + (ex === 'happy' ? 6 : 1.5), 3.2, 5); g.fillRect(0.2, my + (ex === 'happy' ? 6 : 1.5), 3.2, 5); }
        if (kind === 'cat' || kind === 'fox') { // whiskers
          g.strokeStyle = 'rgba(40,36,46,0.55)'; g.lineWidth = 1.3;
          for (const s of [-1, 1]) for (const dy of [-1.5, 3]) { g.beginPath(); g.moveTo(s * 15, -50 + dy); g.lineTo(s * 33, -52 + dy * 1.8); g.stroke(); }
        }
      }
      // cheeks
      if (ex === 'happy' || ex === 'awk' || kind === 'bunny') for (const s of [-1, 1]) ell(g, s * 25, -52, 5.5, 3.4, 'rgba(255,120,150,0.35)');
      g.restore();
    }

    // The effective look right now: the settings, nudged by the mood of the sound that is playing.
    function effective(cfg, audio, now) {
      const e = { rgb: hexToRgb(cfg.color), pattern: cfg.pattern, corners: cfg.corners, focus: cfg.focus ? 0.4 : 0,
        dim: 1, level: 0, beat: 0, period: 2.6, safe: cfg.safe, swing: 0, swingPeriod: 3.4 };
      if (cfg.sync && audio) {
        e.level = clamp(audio.level || 0);
        const mood = MOODS.includes(audio.mood) ? audio.mood : '';
        if (mood && e.level > 0.02) { if (R.mood !== mood) { R.mood = mood; R.moodStart = now; if (MOOD[mood].burst) R.burstAt = now; } R.lastSeen = now; }
        const hold = now - R.lastSeen < 1500 && R.mood;
        R.moodBlend = lerp(R.moodBlend, hold ? 1 : 0, 0.12);
        if (R.moodBlend < 0.02) { R.moodBlend = 0; if (!hold) R.mood = ''; }
        if (R.mood && R.moodBlend > 0) {
          const m = MOOD[R.mood], k = R.moodBlend;
          if (m.rgb) e.rgb = mixRgb(e.rgb, m.rgb, k);
          e.corners = true;
          if (k > 0.45) e.pattern = m.pattern;
          if (m.period > 1) e.period = m.period;
          e.focus = lerp(e.focus, e.focus + m.focus, k);
          e.dim = lerp(1, m.dim, k);
          if (m.swing) { e.swing = m.swing * k; e.swingPeriod = 4.2; }
          if (m.beats && !cfg.safe) e.beat = R.beat;
          if (m.beats && cfg.safe) e.beat = R.beat * 0.45;
        }
        // one gentle beat pulse at most about 3 times a second (never a strobe)
        const b = clamp(audio.beat || 0);
        if (b > 0.5 && now - R.lastBeat > 330) { R.lastBeat = now; R.beat = 1; }
        R.beat *= 0.86;
      } else {
        R.moodBlend = 0; R.mood = ''; R.beat = 0;
      }
      return e;
    }

    R.render = function render(g, src, w, h, cfgIn, now, audio, opts = {}) {
      const cfg = cfgIn;
      drawFiltered(R, g, src, w, h, cfg.filter, now);
      if (cfg.on) {
        // restart the lamp's drop each time Lights is switched on or "Slow drop" is picked
        const key = cfg.lampAnim + '|' + (cfg.on ? 1 : 0);
        if (key !== R.lastKey) { R.lastKey = key; R.dropStart = now; }
        const e = effective(cfg, audio, now);
        const I = cfg.intensity * e.dim;
        const lampPos = { cx: w * (cfg.lampPos === 'left' ? 0.22 : cfg.lampPos === 'right' ? 0.78 : 0.5) };
        const ls = lampState(cfg, h, now, e);
        const focus = e.focus * ls.focusRamp;

        g.save();
        if (focus > 0.01) { // darker edges, light on you
          const vg = g.createRadialGradient(w / 2, h * 0.46, h * 0.18, w / 2, h * 0.46, Math.hypot(w, h) * 0.58);
          vg.addColorStop(0, 'rgba(0,0,0,0)');
          vg.addColorStop(0.55, `rgba(0,0,0,${0.18 * focus * 2})`);
          vg.addColorStop(1, `rgba(0,0,0,${clamp(focus * 1.5, 0, 0.82)})`);
          g.fillStyle = vg;
          g.fillRect(0, 0, w, h);
        }
        if (e.corners) drawCorners(g, w, h, e.pattern, e.rgb, I, now, e);
        g.globalCompositeOperation = 'screen';
        const bulbY = h * 0.12 + h * 0.14 + ls.dy;
        const sway = ls.angle * 1.2;
        const bx = lampPos.cx + Math.sin(ls.angle) * (h * 0.12 + h * 0.14);
        if (cfg.lamp) {
          cone(g, bx, bulbY, h * 1.05, w * 0.78, -sway * 0.9 + (bx - w / 2) / w * 0.55, e.rgb, 0.46 * I * ls.bright);
          glow(g, w / 2 + (bx - w / 2) * 0.3, h * 0.5, h * 0.62, e.rgb, 0.28 * I * ls.bright); // light on your face
        } else {
          glow(g, w / 2, h * 0.46, h * 0.62, e.rgb, 0.2 * I); // no lamp: a soft light on you
        }
        g.restore();

        if (R.mood && MOOD[R.mood] && MOOD[R.mood].burst && R.burstAt >= 0) drawBurst(g, w, h, now);
        if (cfg.lamp) drawLamp(g, w, h, { cx: lampPos.cx, rgb: e.rgb, bright: ls.bright * clamp(0.55 + I), angle: ls.angle, dy: ls.dy });
        if (cfg.character !== 'none') {
          const ck = cfg.character + '|' + cfg.charPos;
          if (ck !== R.charKey) { R.charKey = ck; R.charStart = now; }
          drawCharacter(g, w, h, cfg.character, cfg.charPos, now, audio);
        } else R.charKey = '';
      }
      if (opts.preview) {
        const fs = Math.max(11, Math.round(h * 0.045));
        g.save();
        g.font = `700 ${fs}px system-ui, "Segoe UI", sans-serif`;
        const text = opts.watermark || 'PREVIEW', tw = g.measureText(text).width + fs, th = fs * 1.6;
        g.fillStyle = 'rgba(15,15,20,0.62)';
        g.beginPath(); g.roundRect ? g.roundRect(w - tw - fs * 0.5, h - th - fs * 0.5, tw, th, th / 2) : g.rect(w - tw - fs * 0.5, h - th - fs * 0.5, tw, th); g.fill();
        g.fillStyle = '#ffd43b';
        g.textBaseline = 'middle'; g.textAlign = 'center';
        g.fillText(text, w - tw / 2 - fs * 0.5, h - th / 2 - fs * 0.5);
        g.restore();
      }
    };

    // Run the lamp's drop again (the "Replay" button in the panel).
    R.replay = (now) => { R.dropStart = now; };
    return R;
  }

  // A friendly stand-in for "you" when no camera is used (the panel preview, and the website demo).
  function drawSample(g, w, h, t = 0) {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#3a3f5c'); bg.addColorStop(1, '#23253a');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(w * 0.06, h * 0.12, w * 0.2, h * 0.5); g.fillRect(w * 0.74, h * 0.2, w * 0.2, h * 0.42); // a shelf and a window
    const cx = w / 2, cy = h * 0.5, bob = Math.sin(t / 700) * h * 0.006;
    g.fillStyle = '#6b7aa8'; // shoulders
    g.beginPath(); g.ellipse(cx, h * 1.02, w * 0.3, h * 0.38, 0, Math.PI, TAU); g.fill();
    g.fillStyle = '#d9b99b'; // neck
    g.fillRect(cx - w * 0.04, cy + h * 0.14 + bob, w * 0.08, h * 0.16);
    g.beginPath(); g.ellipse(cx, cy + bob, w * 0.115, h * 0.2, 0, 0, TAU); g.fill(); // head
    g.fillStyle = '#2d2a3a'; // hair
    g.beginPath(); g.ellipse(cx, cy - h * 0.07 + bob, w * 0.125, h * 0.17, 0, Math.PI, TAU); g.fill();
    g.fillRect(cx - w * 0.125, cy - h * 0.07 + bob, w * 0.03, h * 0.12);
    g.fillStyle = '#2b2b33'; // eyes and smile
    g.beginPath(); g.arc(cx - w * 0.04, cy + h * 0.01 + bob, h * 0.014, 0, TAU); g.arc(cx + w * 0.04, cy + h * 0.01 + bob, h * 0.014, 0, TAU); g.fill();
    g.strokeStyle = '#2b2b33'; g.lineWidth = Math.max(1.5, h * 0.008); g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy + h * 0.055 + bob, w * 0.04, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }

  globalThis.MemeFx = Object.freeze({
    COLORS, FREE_COLORS, LAMP_ANIMS, CHARACTERS, STANDARD_CHARACTERS, PREMIUM_CHARACTERS, PATTERNS, FILTERS, FREE_FILTERS, PRO_FILTERS, ADDON_FILTERS, MOODS, DEFAULTS,
    sanitize, lockedParts, createRenderer, drawSample,
  });
})();
