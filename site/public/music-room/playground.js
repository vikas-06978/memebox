MemeRoomI18n.ready.then(() => {
'use strict';
const { t } = MemeI18n;
const canvas = document.getElementById('preview');
const g = canvas.getContext('2d');
const source = document.createElement('canvas'); source.width = canvas.width; source.height = canvas.height;
const renderer = MemeFx.createRenderer();
let cfg = { ...MemeFx.DEFAULTS, on: true, character: 'cat', charPos: 'right', lamp: true };
let present = true, personX = .5, exitAt = -1e9, enterAt = -1e9;
let action = '', actionAt = 0, running = true, lastFrame = 0;
let audio = null, player = null, musicTimer = 0;
const symbols = { cat: '🐱', dog: '🐶', bunny: '🐰', panda: '🐼', owl: '🦉', fox: '🦊', penguin: '🐧', lion: '🦁', monkey: '🐵', frog: '🐸', unicorn: '🦄', robot: '🤖', snake: '🐍', bird: '🐦' };
const exclusive = new Set(['unicorn', 'robot', 'snake', 'bird']);

function draw(now) {
  const track = { present, live: true, ml: true, x: personX, y: .5, fw: .23, fh: .4, energy: 0, vx: 0, vy: 0, rise: 0, away: present ? 0 : (now-exitAt)/1000, exitAt, enterAt, riseAt: -1e9, waveAt: -1e9 };
  MemeFx.drawSample(source.getContext('2d'), source.width, source.height, now, { dx: personX-.5, visible: present });
  const elapsed = (now - actionAt) / 1000;
  renderer.render(g, source, canvas.width, canvas.height, cfg, now, player?.playing ? { tune: player.id, level: .35, bass: .5, beat: Math.sin(now / 160) > .8 ? 1 : 0, mood: 'fun' } : null, { track });
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
    cfg.character = id; action = ''; cfg.command = ''; cfg.commandSeq = 0; actionAt = performance.now();
    document.getElementById('personality').textContent = t('pg_persona_'+id);
    for (const b of document.querySelectorAll('[data-character]')) b.setAttribute('aria-pressed', String(b === button));
    document.getElementById('selected-character').textContent = t('fx_char_' + id);
    draw(performance.now());
  });
  document.getElementById('characters').append(button);
}
document.getElementById('selected-character').textContent = t('fx_char_cat');
document.getElementById('personality').textContent = t('pg_persona_cat');
for (const button of document.querySelectorAll('[data-action]')) {
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', t('pg_' + (button.dataset.action === 'signature' ? 'personality' : button.dataset.action)));
  button.title = t('pg_' + (button.dataset.action === 'signature' ? 'personality' : button.dataset.action));
  if(['wave','cheer','heartbeat','cry','raspberry','dance'].includes(button.dataset.action)) button.append(document.createTextNode(' '+t('pg_'+button.dataset.action)));
  button.addEventListener('click', () => {
    action = button.dataset.action; actionAt = performance.now(); cfg.command = action; cfg.commandSeq = Date.now();
    if (['head','shoulder','corner'].includes(action)) cfg.charHome = action;
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
  for (const value of values) { const label = t(prefix + value); const tier = element === 'filter' ? (MemeFx.FREE_FILTERS.includes(value) ? 'free' : MemeFx.PRO_FILTERS.includes(value) ? 'pro' : 'max') : element === 'outfit' ? (MemeFx.FREE_OUTFITS.includes(value) ? 'free' : MemeFx.PRO_OUTFITS.includes(value) ? 'pro' : 'max') : ''; select.add(new Option((label === prefix + value ? value : label) + (tier ? ' · '+t('fx_tier_'+tier) : ''), value, false, value === cfg[property])); }
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
for (const id of [...MemeMusic.IDS]) {
  const button = document.createElement('button'); button.type = 'button'; button.dataset.tune = id; button.textContent = t('mu_t_' + id) + ' · ' + (MemeMusic.FREE_TUNES.includes(id) ? t('fx_tier_free') : ['phonk_drift','phonk_midnight','epic','disco','club','bass','house','desi'].includes(id) ? 'Pro Max' : 'Pro'); button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', async () => {
    stopMusic();
    if (!audio) { audio = new AudioContext(); player = MemeMusic.createPlayer(audio, audio.destination); player.setVolume(Number(document.getElementById('music-volume').value)/100); }
    const seconds = Number(document.getElementById('music-length').value);
    await audio.resume(); player.play(id, seconds); button.setAttribute('aria-pressed', 'true');
    document.getElementById('music-status').textContent = t('mu_preview', t('mu_t_' + id), seconds);
    musicTimer = setTimeout(stopMusic, seconds*1000+200);
  });
  document.getElementById('tunes').append(button);
}
document.getElementById('stop-music').addEventListener('click', stopMusic);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopMusic(); });
window.addEventListener('pagehide', () => { stopMusic(); if (audio) audio.close(); });
draw(performance.now()); requestAnimationFrame(frame);

document.getElementById('music-volume').addEventListener('input', e => player?.setVolume(Number(e.target.value)/100));
const presence = document.getElementById('presence');
function syncPresence() { presence.textContent = t(present ? 'pg_leave' : 'pg_return'); presence.setAttribute('aria-pressed', String(!present)); document.getElementById('presence-status').textContent = t(present ? 'pg_home_status' : 'pg_away_status'); for (const b of document.querySelectorAll('[data-action]')) b.disabled = !present; }
presence.addEventListener('click', () => { present = !present; if(present) enterAt = performance.now(); else exitAt = performance.now(); syncPresence(); draw(performance.now()); });
document.getElementById('person-x').addEventListener('input', e => { personX = Number(e.target.value)/100; draw(performance.now()); });
syncPresence();
let pictureUrl = '';
function closePicture() { document.getElementById('picture-preview').hidden = true; document.getElementById('picture-image').removeAttribute('src'); if(pictureUrl) URL.revokeObjectURL(pictureUrl); pictureUrl = ''; document.getElementById('picture-file').value = ''; }
document.getElementById('picture-file').addEventListener('change', e => { const file=e.target.files[0]; if(!file) return; const status=document.getElementById('picture-status'); status.textContent=''; if(file.size>8*1024*1024) { status.textContent=t('pg_picture_too_big'); e.target.value=''; return; } if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) { status.textContent=t('pg_picture_invalid'); e.target.value=''; return; } closePicture(); pictureUrl=URL.createObjectURL(file); document.getElementById('picture-image').src=pictureUrl; document.getElementById('picture-preview').hidden=false; });
document.getElementById('picture-close').addEventListener('click', closePicture);
document.addEventListener('keydown', e=>{if(e.key==='Escape')closePicture()});
window.addEventListener('pagehide', closePicture);

// Product links select the exact preview instead of sending every user to the top.
const requested=new URLSearchParams(location.search);
const wantedCharacter=requested.get('character');
if(MemeFx.CHARACTERS.includes(wantedCharacter))document.querySelector(`[data-character="${wantedCharacter}"]`).click();
for(const [property,element,values] of [['filter','filter',MemeFx.FILTERS],['outfit','outfit',MemeFx.OUTFITS]]) {
  const value=requested.get(property);
  if(values.includes(value)){const select=document.getElementById(element);select.value=value;select.dispatchEvent(new Event('change'));}
}

document.getElementById('picture-image').addEventListener('error',()=>{closePicture();document.getElementById('picture-status').textContent=t('pg_picture_invalid')});

});
