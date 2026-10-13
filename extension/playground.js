'use strict';
const { t } = MemeI18n;
const canvas = document.getElementById('preview');
const g = canvas.getContext('2d');
const source = document.createElement('canvas'); source.width = canvas.width; source.height = canvas.height;
const renderer = MemeFx.createRenderer();
let cfg = { ...MemeFx.DEFAULTS, on: true, character: 'cat', charPos: 'right', lamp: true };
let action = '', actionAt = 0, running = true, lastFrame = 0;
let audio = null, player = null, musicTimer = 0;
const symbols = { cat: '🐱', dog: '🐶', bunny: '🐰', panda: '🐼', owl: '🦉', fox: '🦊', penguin: '🐧', lion: '🦁', monkey: '🐵', frog: '🐸', unicorn: '🦄', robot: '🤖', snake: '🐍', bird: '🐦' };
const exclusive = new Set(['unicorn', 'robot', 'snake', 'bird']);

function draw(now) {
  MemeFx.drawSample(source.getContext('2d'), source.width, source.height, now);
  const elapsed = (now - actionAt) / 1000;
  const opts = action && elapsed < 4 ? { charAct: action, charT: elapsed, charU: Math.min(1, elapsed / 4), charStand: 0.6 } : { charStand: 0.6 };
  renderer.render(g, source, canvas.width, canvas.height, cfg, now, player?.playing ? { tune: player.id, level: .35, bass: .5, beat: Math.sin(now / 160) > .8 ? 1 : 0, mood: 'fun' } : null, opts);
  if (elapsed >= 4 && action) { action = ''; for (const b of document.querySelectorAll('[data-action]')) b.setAttribute('aria-pressed', 'false'); }
}
function frame(now) {
  if (running && !document.hidden && now - lastFrame > 50) { lastFrame = now; draw(now); }
  requestAnimationFrame(frame);
}

for (const id of MemeFx.CHARACTERS) {
  const button = document.createElement('button'); button.type = 'button'; button.dataset.character = id;
  button.setAttribute('aria-pressed', String(id === cfg.character));
  const icon = document.createElement('span'); icon.className = 'character-emoji'; icon.textContent = symbols[id]; icon.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span'); name.textContent = t('fx_char_' + id);
  button.append(icon, name);
  if (exclusive.has(id)) { const label = document.createElement('span'); label.className = 'exclusive'; label.textContent = 'Pro Max'; button.append(label); }
  button.addEventListener('click', () => {
    cfg.character = id; action = 'greet'; actionAt = performance.now();
    for (const b of document.querySelectorAll('[data-character]')) b.setAttribute('aria-pressed', String(b === button));
    document.getElementById('selected-character').textContent = t('fx_char_' + id);
    draw(performance.now());
  });
  document.getElementById('characters').append(button);
}
document.getElementById('selected-character').textContent = t('fx_char_cat');
for (const button of document.querySelectorAll('[data-action]')) {
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', t('pg_' + button.dataset.action));
  button.title = t('pg_' + button.dataset.action);
  button.addEventListener('click', () => {
    action = button.dataset.action; actionAt = performance.now();
    for (const b of document.querySelectorAll('[data-action]')) b.setAttribute('aria-pressed', String(b === button));
    draw(performance.now());
  });
}
for (const [element, property, values, prefix] of [
  ['fixture', 'fixture', MemeFx.FIXTURES, 'fx_fix_'],
  ['filter', 'filter', MemeFx.FILTERS, 'fx_filter_'],
  ['colour', 'color', Object.keys(MemeFx.COLORS), 'fx_color_'],
  ['outfit', 'outfit', MemeFx.OUTFITS, 'fx_outfit_'],
]) {
  const select = document.getElementById(element);
  for (const value of values) { const label = t(prefix + value); select.add(new Option(label === prefix + value ? value : label, value, false, value === cfg[property])); }
  select.addEventListener('change', () => { cfg[property] = select.value; draw(performance.now()); });
}
for (const option of document.querySelectorAll('#colour option')) {
  const symbol = { warm: '🟠', white: '⚪', blue: '🔵', rose: '🌸', purple: '🟣', green: '🟢', red: '🔴', cyan: '💎', gold: '🟡' }[option.value];
  if (symbol) option.textContent = symbol + ' ' + option.textContent;
}
const animate = document.getElementById('animate');
running = !matchMedia('(prefers-reduced-motion: reduce)').matches; animate.checked = running;
animate.addEventListener('change', () => { running = animate.checked; if (!running) draw(performance.now()); });

function stopMusic() {
  if (player) player.stop(); clearTimeout(musicTimer);
  document.getElementById('music-status').textContent = '';
  for (const b of document.querySelectorAll('[data-tune]')) b.setAttribute('aria-pressed', 'false');
}
for (const id of [...MemeMusic.IDS, ...MemeMusic.PHONK_IDS]) {
  const button = document.createElement('button'); button.type = 'button'; button.dataset.tune = id; button.textContent = t('mu_t_' + id); button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', async () => {
    stopMusic();
    if (!audio) { audio = new AudioContext(); player = MemeMusic.createPlayer(audio, audio.destination); player.setVolume(.25); }
    await audio.resume(); player.play(id, 10); button.setAttribute('aria-pressed', 'true');
    document.getElementById('music-status').textContent = t('mu_preview', t('mu_t_' + id), 10);
    musicTimer = setTimeout(stopMusic, 10500);
  });
  document.getElementById('tunes').append(button);
}
document.getElementById('stop-music').addEventListener('click', stopMusic);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopMusic(); });
window.addEventListener('pagehide', () => { stopMusic(); if (audio) audio.close(); });
draw(performance.now()); requestAnimationFrame(frame);
