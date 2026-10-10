// node tools/fx-sheet.mjs <out.png> [section]: draws a contact sheet of Lights & looks (lamp, patterns, filters,
// moods) with the sample picture, so a change to extension/lib/fx.js can be checked by eye.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const out = process.argv[2] || path.join(ROOT, 'tests', '.tmp', 'fx-sheet.png');
const only = process.argv[3] || '';
const fxSource = fs.readFileSync(path.join(ROOT, 'extension', 'lib', 'fx.js'), 'utf8');
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1700, height: 1200 } });
await page.setContent('<body style="margin:0;background:#111;color:#ddd;font:12px system-ui"></body>');
await page.addScriptTag({ content: fxSource });
await page.evaluate((only) => {
  const W = 320, H = 180, FX = globalThis.MemeFx;
  const rows = [];
  const base = { ...FX.DEFAULTS, on: true };
  const lit = document.createElement('canvas'); lit.width = W; lit.height = H;
  FX.drawSample(lit.getContext('2d'), W, H, 0);
  const sample = lit;
  const dim = document.createElement('canvas'); dim.width = W; dim.height = H; // the same picture in a dark room
  { const dg = dim.getContext('2d'); dg.drawImage(sample, 0, 0); dg.fillStyle = 'rgba(0,0,0,0.82)'; dg.fillRect(0, 0, W, H); }
  // a soft, grainy, slightly dim camera picture (what a cheap webcam gives), to see what HD enhance does
  const cheap = document.createElement('canvas'); cheap.width = W; cheap.height = H;
  { const cg = cheap.getContext('2d'); cg.filter = 'blur(1.3px) brightness(0.8) saturate(0.8)'; cg.drawImage(lit, 0, 0); cg.filter = 'none';
    const id = cg.getImageData(0, 0, W, H); for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 34; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; } cg.putImageData(id, 0, 0); }
  const add = (title, tiles) => rows.push({ title, tiles });
  add('dark room: plain, lamp, disco ball, lantern, moon, no lamp (the light must show on the face)', [
    { label: 'plain dark room', cfg: { ...base, on: false }, dark: true },
    { label: 'lamp', cfg: { ...base }, dark: true, at: 1500 },
    { label: 'discoball', cfg: { ...base, fixture: 'discoball' }, dark: true, at: 1500 },
    { label: 'lantern', cfg: { ...base, fixture: 'lantern' }, dark: true, at: 1500 },
    { label: 'moon blue', cfg: { ...base, fixture: 'moon', color: 'blue' }, dark: true, at: 1500 },
    { label: 'no lamp', cfg: { ...base, lamp: false }, dark: true, at: 1500 }]);
  const ANIM = FX.ACTIONS;
  for (const kind of FX.CHARACTERS) {
    const tiles = [...ANIM[kind].map((a) => ({ label: kind + ': ' + a, cfg: { ...base, lamp: false, character: kind, charPos: 'left' }, at: 2500, opts: { charAct: a, charT: 0.9, charU: 0.5 } })),
      { label: kind + ': dance (1)', cfg: { ...base, lamp: false, character: kind, charPos: 'left' }, at: 2500, opts: { charAct: 'dance', charT: 0.35 } },
      { label: kind + ': dance (2)', cfg: { ...base, lamp: false, character: kind, charPos: 'left' }, at: 2500, opts: { charAct: 'dance', charT: 0.62 } }];
    add('animal ' + kind + ': its own things, then its dance', tiles);
  }
  add('follow me: lamp and cat go with you (centre, left, right, standing up, gone, back)', [1200, 3000, 5000, 7200, 10500, 14600, 18000, 21000, 23000].map((ms) => ({ label: 'at ' + ms + ' ms', cfg: { ...base, follow: true, character: 'cat', charPos: 'left' }, sim: ms })));
  add('follow me: disco ball and frog', [1200, 3000, 5000, 7200, 10500, 14600, 18000, 21000, 23000].map((ms) => ({ label: 'at ' + ms + ' ms', cfg: { ...base, follow: true, fixture: 'discoball', character: 'frog', charPos: 'right' }, sim: ms })));
  const spec = [0.8, 0.9, 0.75, 0.6, 0.55, 0.5, 0.4, 0.45, 0.35, 0.3, 0.3, 0.25, 0.2, 0.2, 0.15, 0.1];
  const loud = { level: 0.8, bass: 0.85, mid: 0.5, high: 0.4, spec, beat: 1, mood: '', tune: 'club' };
  add('music reactive (sync on, loud music with a beat): laser, party, club, equalizer, disco, fire, aurora', ['laser', 'party', 'club', 'equalizer', 'disco', 'fire', 'aurora'].map((p) => ({ label: p, cfg: { ...base, sync: true, corners: true, pattern: p, lamp: false }, at: 2500, audio: loud })));
  add('pattern Auto follows the tune: club, disco, bass, desi, suspense, jazz', ['club', 'disco', 'bass', 'desi', 'suspense', 'jazz'].map((tn) => ({ label: 'auto + ' + tn, cfg: { ...base, sync: true, pattern: 'auto', lamp: false }, at: 2500, audio: { ...loud, tune: tn } })));
  add('camera quality: a cheap webcam picture, then HD enhance 40 %, 70 %, 100 %, and in a dark room', [
    { label: 'cheap webcam (plain)', cfg: { ...base, on: false }, cheap: true },
    { label: 'HD enhance 40%', cfg: { ...base, on: false, enhance: 0.4 }, cheap: true, at: 1500 },
    { label: 'HD enhance 70%', cfg: { ...base, on: false, enhance: 0.7 }, cheap: true, at: 1500 },
    { label: 'HD enhance 100%', cfg: { ...base, on: false, enhance: 1 }, cheap: true, at: 1500 },
    { label: 'dark room + HD enhance 70%', cfg: { ...base, on: false, enhance: 0.7 }, dark: true, cheap: true, at: 2500 }]);
  add('lamp drop (0.4s, 1.2s, 2.0s, 2.8s, 3.3s, 5s)', [0.4, 1.2, 2.0, 2.8, 3.3, 5].map((s) => ({ label: s + 's', cfg: { ...base, lampAnim: 'drop' }, at: s * 1000, anim: true })));
  add('free: still lamp (warm, white, blue) + swing + flicker + no lamp', [
    { label: 'warm', cfg: { ...base } }, { label: 'white', cfg: { ...base, color: 'white' } }, { label: 'blue', cfg: { ...base, color: 'blue' } },
    { label: 'swing', cfg: { ...base, lampAnim: 'swing' }, at: 900 }, { label: 'flicker', cfg: { ...base, lampAnim: 'flicker' }, at: 700 }, { label: 'no lamp', cfg: { ...base, lamp: false } }]);
  add('fixtures (that hang like the lamp), after the drop', FX.FIXTURES.map((f) => ({ label: f, cfg: { ...base, fixture: f, lampAnim: 'drop' }, at: 4200, anim: true })));
  add('new animations: sway, pendulum, bounce, beat (two moments each)', [['sway', 700], ['sway', 2600], ['pendulum', 700], ['pendulum', 2300], ['bounce', 300], ['bounce', 900], ['beat', 700], ['beat', 1400]].map(([a, ms]) => ({ label: a + ' ' + ms, cfg: { ...base, lampAnim: a, fixture: 'discoball' }, at: ms, audio: { level: 0.5, beat: ms === 700 ? 1 : 0, mood: '' } })));
  add('patterns (corners on)', FX.PATTERNS.map((p) => ({ label: p, cfg: { ...base, corners: true, pattern: p, color: 'rose' }, at: 3000 })));
  add('filters', FX.FILTERS.map((f) => ({ label: f, cfg: { ...base, on: false, filter: f } })));
  add('moods (sync on)', FX.MOODS.map((m) => ({ label: m, cfg: { ...base, sync: true, corners: true }, at: 4000, audio: { level: 0.6, beat: 0, mood: m } })));
  add('characters (idle, after the pop-up)', FX.CHARACTERS.map((c) => ({ label: c, cfg: { ...base, lamp: false, character: c }, at: 2500 })));
  add('characters: a cat and a dog feel the sound (excited, fun, surprise, sad, suspense, awkward)', ['excited', 'fun', 'surprise', 'sad', 'suspense', 'awkward'].map((m, i) => ({ label: m, cfg: { ...base, lamp: false, character: i % 2 ? 'dog' : 'cat', charPos: 'left' }, at: 2500, audio: { level: 0.6, beat: 0, mood: m } })));
  add('new characters: idle and in moods', [['penguin', ''], ['lion', ''], ['monkey', ''], ['frog', ''], ['unicorn', ''], ['robot', ''], ['penguin', 'excited'], ['lion', 'surprise'], ['monkey', 'awkward'], ['frog', 'sad'], ['unicorn', 'fun'], ['robot', 'suspense']].map(([c, m]) => ({ label: c + ' ' + m, cfg: { ...base, lamp: false, character: c }, at: 2500, audio: m ? { level: 0.6, beat: 0, mood: m } : null })));
  add('characters: bunny, panda, owl, fox in moods', [['bunny', 'excited'], ['panda', 'surprise'], ['owl', 'sad'], ['fox', 'awkward'], ['bunny', 'sad'], ['owl', 'suspense']].map(([c, m]) => ({ label: c + ' ' + m, cfg: { ...base, lamp: false, character: c }, at: 2500, audio: { level: 0.6, beat: 0, mood: m } })));
  for (const row of rows) {
    if (only && !row.title.includes(only)) continue;
    const h = document.createElement('div'); h.textContent = row.title; h.style.cssText = 'padding:4px 8px;font-weight:700'; document.body.append(h);
    const line = document.createElement('div'); line.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:0 8px'; document.body.append(line);
    for (const t of row.tiles) {
      const wrap = document.createElement('div'); const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'); const r = FX.createRenderer();
      const cfg = FX.sanitize(t.cfg);
      const sample = t.dark ? (t.cheap ? (() => { const d2 = document.createElement('canvas'); d2.width = W; d2.height = H; const x2 = d2.getContext('2d'); x2.drawImage(cheap, 0, 0); x2.fillStyle = 'rgba(0,0,0,0.78)'; x2.fillRect(0, 0, W, H); return d2; })() : dim) : (t.cheap ? cheap : lit);
      const start = 100000;
      if (t.sim != null) {
        const c0 = 24000 * 40; // a whole number of cycles later, so the history before the first frame is "previous cycle"
        const frame = document.createElement('canvas'); frame.width = W; frame.height = H;
        for (let ms = Math.max(0, t.sim - 6000); ms <= t.sim; ms += 50) {
          const sm = FX.simulate(c0 + ms);
          FX.drawSample(frame.getContext('2d'), W, H, ms, sm.person);
          r.render(g, frame, W, H, cfg, c0 + ms, { level: 0, voice: sm.voice }, { track: sm.track });
        }
      } else if (t.anim) { for (let ms = 0; ms <= t.at; ms += 33) r.render(g, sample, W, H, cfg, start + ms, null, t.opts || {}); }
      else { const steps = t.at ? Math.round(t.at / 33) : 3; for (let i = 0; i <= steps; i++) r.render(g, sample, W, H, cfg, start + i * 33, t.audio || null, t.opts || {}); }
      wrap.append(c); const l = document.createElement('div'); l.textContent = t.label; wrap.append(l); line.append(wrap);
    }
  }
}, only);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(out);
