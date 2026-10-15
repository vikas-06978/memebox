// MemeBox site: Phonk Mode. A list of official tracks and YouTube's own embedded player (visible, never hidden, no audio-only tricks).
// YouTube audio is never hosted here. The free catalog carries video IDs; older catalogs use /api/pack-link. The extension opens this page with the
// license key in the part of the link after "#" (it is never sent to any server) and this script removes it from the address right away.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const t = (key) => (window.MemeSite ? window.MemeSite.t(key) : key);
  const EMBED = 'https://www.youtube-nocookie.com';
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const KEY = /^MBX-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(params.get('k') || '') ? params.get('k') : '';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);

  const player = $('player'), box = $('player-box'), now = $('now'), msg = $('msg'), list = $('tracks'), status = $('status'), openYt = $('open-yt');
  const playlistBox = $('playlists'), listTitle = $('list-title'), search = $('search');
  let playlists = [], tracks = [], current = -1, activePlaylist = 'all', query = '', shopOpen = false, license = null, playing = false;
  let playQueue = [], playSequence = 0, pendingPlay = null, skipTimer = 0;
  let showAdult = false;
  try { showAdult=localStorage.getItem('memebox-phonk-adult')==='on'; } catch {}
  $('adult-content').checked=showAdult;
  let shuffle = false;
  try { shuffle = localStorage.getItem('memebox-phonk-shuffle') === 'on'; } catch { /* optional storage */ }
  $('shuffle').setAttribute('aria-pressed', String(shuffle));
  function shuffled(values) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  const availableIndexes = () => visibleIndexes().filter(index => tierOk(tracks[index].tier));
  let originalContext = null, originalPlayer = null, originalTimer = 0;
  function stopOriginal() { clearTimeout(originalTimer); if (originalPlayer) originalPlayer.stop(); }

  function setPlaying(value) {
    playing = value;
    $('toggle').textContent = value ? '⏸' : '▶';
    $('toggle').setAttribute('aria-pressed', String(value));
  }

  const tierOk = (tier) => tier === 'free' || (!!license && license.status === 'active'
    && (tier === 'pro' ? license.unlimited || license.maxSeconds > 0 || license.proSeconds > 0 : license.unlimited || license.maxSeconds > 0));
  const tierName = (x) => t(x === 'max' ? 'ph_max' : x === 'pro' ? 'ph_pro' : 'ph_free');
  const say = (text) => { msg.textContent = text || ''; };

  const visibleIndexes = () => tracks.map((_, i) => i).filter((i) => {
    const tr = tracks[i];
    if(tr.explicit && !showAdult)return false;
    if (activePlaylist !== 'all' && tr.playlist !== activePlaylist) return false;
    const q = query.trim().toLocaleLowerCase();
    return !q || `${tr.title} ${tr.artist}`.toLocaleLowerCase().includes(q);
  });

  function renderPlaylists() {
    playlistBox.replaceChildren();
    const choices = [{ id: 'all', title: t('ph_all'), count: tracks.filter(track=>showAdult||!track.explicit).length }, ...playlists.map((p) => ({ id: p.id, title: p.title, count: tracks.filter(track=>track.playlist===p.id&&(showAdult||!track.explicit)).length }))];
    for (const p of choices) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'playlist' + (p.id === activePlaylist ? ' on' : '');
      b.setAttribute('aria-pressed', String(p.id === activePlaylist));
      b.append(document.createTextNode(p.title), Object.assign(document.createElement('span'), { textContent: String(p.count) }));
      b.addEventListener('click', () => { activePlaylist = p.id; render(); });
      playlistBox.append(b);
    }
  }

  function render() {
    renderPlaylists();
    const shown = visibleIndexes();
    const selected = playlists.find((p) => p.id === activePlaylist);
    listTitle.textContent = selected ? selected.title : t('ph_all');
    list.replaceChildren();
    for (const i of shown) {
      const tr = tracks[i];
      const ok = tierOk(tr.tier);
      const li = document.createElement('li');
      li.className = 'track' + (i === current ? ' on' : '') + (ok ? '' : ' locked');
      const b = document.createElement('button');
      b.type = 'button';
      b.disabled = !ok;
      if (i === current) b.setAttribute('aria-current', 'true');
      const icon = document.createElement('span');
      icon.className = 'track-play';
      icon.textContent = i === current ? '♫' : ok ? '▶' : '🔒';
      icon.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = tr.title;
      const by = document.createElement('span');
      by.className = 'by muted';
      by.textContent = tr.artist ? ' · ' + tr.artist : '';
      const copy = document.createElement('span');
      copy.className = 'track-copy';
      copy.append(name, by);
      b.append(icon, copy);
      b.addEventListener('click', () => play(i, true));
      const tag = document.createElement('span');
      tag.className = 'tier tier-' + tr.tier;
      tag.textContent = ok ? tierName(tr.tier) : shopOpen ? t(tr.tier === 'max' ? 'ph_needs_max' : 'ph_needs_pro') : t('ph_soon');
      li.append(b, tag);
      list.append(li);
    }
    status.hidden = shown.length > 0;
    status.textContent = shown.length ? '' : query ? t('ph_no_match') : t('ph_none');
  }

  async function play(i, startQueue = false) {
    if (i < 0 || i >= tracks.length) return;
    const tr = tracks[i];
    if(tr.explicit&&!showAdult)return;
    if (!tierOk(tr.tier)) { advance(1); return; }
    if (startQueue) {
      const available = availableIndexes();
      playQueue = shuffle ? [i, ...shuffled(available.filter(index => index !== i))] : available;
    }
    const seq = ++playSequence;
    if (pendingPlay) pendingPlay.abort();
    pendingPlay = new AbortController();
    clearTimeout(skipTimer);
    stopOriginal();
    say('');
    try {
      if (tr.original) {
        player.removeAttribute('src'); box.hidden = true; openYt.hidden = true;
        $('player-idle').hidden = false;
        if (!originalContext) { originalContext = new AudioContext(); originalPlayer = MemeMusic.createPlayer(originalContext, originalContext.destination); }
        await originalContext.resume();
        if (seq !== playSequence) return;
        originalPlayer.setVolume(Number($('volume').value) / 200);
        originalPlayer.play(tr.id);
        current = i; now.textContent = tr.title + ' · MemeBox'; setPlaying(true); render();
        const tune = MemeMusic.TUNES[tr.id];
        originalTimer = setTimeout(() => { stopOriginal(); setPlaying(false); advance(1); }, tune.bars * 4 * 60000 / tune.bpm);
        return;
      }
      let videoId = tr.videoId;
      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || '')) {
        // Compatibility with the older deployed catalog; new catalogs need no per-play database request.
        const res = await fetch('/api/pack-link?item=' + encodeURIComponent(tr.id), { signal: pendingPlay.signal });
        if (seq !== playSequence) return;
        if (res.status === 429) { say(t('ph_limit')); return; }
        const data = await res.json();
        if (seq !== playSequence) return;
        if (!res.ok || !data.ok || !/^[A-Za-z0-9_-]{11}$/.test(data.id)) throw new Error('bad');
        videoId = data.id;
      }
      current = i;
      box.hidden = false;
      $('player-idle').hidden = true;
      player.src = `${EMBED}/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0&playsinline=1&origin=${encodeURIComponent(location.origin)}`;
      openYt.href = `https://www.youtube.com/watch?v=${videoId}`;
      openYt.hidden = false;
      now.textContent = tr.title + (tr.artist ? ' · ' + tr.artist : '');
      setPlaying(true);
      render();
    } catch (error) {
      if (seq === playSequence && error.name !== 'AbortError') say(t('ph_error'));
    }
  }

  function advance(step) {
    const queue = playQueue.length ? playQueue : visibleIndexes().filter((i) => tierOk(tracks[i].tier));
    if (!queue.length) { setPlaying(false); return; }
    const at = queue.indexOf(current);
    const next = at < 0 ? (step > 0 ? 0 : queue.length - 1) : at + step;
    if (next >= 0 && next < queue.length) { play(queue[next]); return; }
    // Reaching the end does not pause a still-playing track. The player's ended event
    // updates the control, while a manual Next at the last track leaves playback alone.
  }

  // The player is controlled with YouTube's documented postMessage commands (no script is loaded from YouTube).
  const command = (func, args = []) => { if (player.contentWindow) player.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), EMBED); };
  player.addEventListener('load', () => { if (player.contentWindow) player.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), EMBED); });
  window.addEventListener('message', (e) => {
    if (tracks[current]?.original) return;
    if (e.origin !== EMBED || e.source !== player.contentWindow) return;
    let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
    if (!d || typeof d !== 'object') return;
    if (d.event === 'onStateChange' && d.info === 0) advance(1); // ended: the next track you may play
    if (d.event === 'onStateChange' && [0, 1, 2].includes(d.info)) setPlaying(d.info === 1);
    if (d.event === 'onError') { const seq = playSequence; say(t('ph_blocked')); skipTimer = setTimeout(() => { if (seq === playSequence) advance(1); }, 1500); } // the owner does not allow embedding
  });
  $('toggle').addEventListener('click', () => {
    if (current < 0) { const available = availableIndexes(); playQueue = shuffle ? shuffled(available) : available; advance(1); return; }
    if (tracks[current]?.original) { if (playing) { stopOriginal(); setPlaying(false); } else play(current); return; }
    command(playing ? 'pauseVideo' : 'playVideo'); setPlaying(!playing);
  });
  $('next').addEventListener('click', () => advance(1));
  $('prev').addEventListener('click', () => advance(-1));
  $('shuffle').addEventListener('click', () => {
    shuffle = !shuffle; $('shuffle').setAttribute('aria-pressed', String(shuffle));
    try { localStorage.setItem('memebox-phonk-shuffle', shuffle ? 'on' : 'off'); } catch { /* optional storage */ }
    const at = playQueue.indexOf(current);
    if (at >= 0) {
      const remaining = playQueue.slice(at + 1);
      playQueue = [...playQueue.slice(0, at + 1), ...(shuffle ? shuffled(remaining) : remaining.sort((a, b) => a - b))];
    }
  });
  $('volume').addEventListener('input', (e) => { command('setVolume', [Number(e.target.value)]); if (originalPlayer) originalPlayer.setVolume(Number(e.target.value) / 200); });
  window.addEventListener('pagehide', () => { stopOriginal(); originalContext?.close(); });
  $('adult-content').addEventListener('change',()=>{showAdult=$('adult-content').checked;try{localStorage.setItem('memebox-phonk-adult',showAdult?'on':'off')}catch{};if(!showAdult){playSequence++;pendingPlay?.abort();playQueue=playQueue.filter(i=>!tracks[i].explicit);if(current>=0&&tracks[current].explicit){player.removeAttribute('src');openYt.hidden=true;box.hidden=true;current=-1;setPlaying(false);now.textContent='';}}render()});
  search.addEventListener('input', () => { query = search.value; render(); });

  async function start() {
    try {
      const [packs, cfg, lic] = await Promise.all([
        fetch('/api/packs').then((r) => r.json()),
        fetch('/api/config').then((r) => r.json()).catch(() => ({})),
        KEY ? fetch('/api/license', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: KEY }) }).then((r) => r.json()).catch(() => null) : null,
      ]);
      shopOpen = !!(cfg && cfg.payments);
      license = lic && lic.ok && lic.license ? lic.license : null;
      const linkPacks = (packs.packs || []).filter((p) => p.kind === 'links');
      playlists = linkPacks.map((p) => ({ id: p.id, title: p.title, count: p.items.length }));
      tracks = linkPacks.flatMap((p) => p.items.map((i) => ({ id: i.id, title: i.title, artist: i.credit, tier: 'free', explicit:i.explicit===true, videoId: i.videoId, playlist: p.id })));
      if (!tracks.length) { status.textContent = t('ph_none'); return; }
      status.hidden = true;
      render();
    } catch {
      status.textContent = t('ph_error');
    }
  }
  const go = window.MemeSite && window.MemeSite.ready ? window.MemeSite.ready : Promise.resolve();
  go.then(start, start);
})();
