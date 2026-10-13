// Options → Online packs: free music and memes made for everyone, downloaded from the site on request.
// Nothing is contacted until "Browse packs" is pressed. A pack's music goes to "My music" (Music page of the panel), its meme lines
// and clips go to the lines list. Paid packs are shown as "Coming soon" while the shop is closed. Shares the options.js globals.
(() => {
  'use strict';
  const SITE = MEMEBOX_CONFIG.SITE_URL;
  const MAX_MEME_CLIP = 4 * 1024 * 1024;
  const MAX_PACK_TRACKS = 40;
  const MAX_PACK_BYTES = 300 * 1048576; // all downloaded packs together on this computer
  const REGIONS = ['', 'common', 'in', 'global'];
  const box = $('online-card');
  if (!box) return;
  const list = $('online-list'), status = $('online-status'), browse = $('online-browse'), regionSel = $('online-region'), strongBox = $('online-strong');
  let catalog = null, installed = {}, showStrong = false;

  const usedBytes = () => Object.values(installed).reduce((a, p) => a + (Number(p.bytes) || 0), 0);
  const mb = (bytes) => (bytes / 1048576 >= 0.1 ? (bytes / 1048576).toFixed(1) : '<0.1') + ' MB';
  const suffix = (id) => String(id).replace(/^i-/, '');
  const inIndia = () => {
    const l = String(navigator.language || '').toLowerCase();
    let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* ignore */ }
    return /^(hi|mr|gu|bn|ta|te|pa|kn|ml|ur)/.test(l) || tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta';
  };
  const tierOk = (tier) => tier === 'free' || (tier === 'pro' ? plan.isPro() : plan.hasLicense() || plan.passTier() === 'max');
  const itemLang = (l) => (l === 'hinglish' ? 'en' : !l ? 'en' : MEME.isLang(l) ? l : null);

  async function load() {
    const r = await chrome.storage.local.get(['packsInstalled', 'settings']);
    installed = r.packsInstalled && typeof r.packsInstalled === 'object' ? r.packsInstalled : {};
    showStrong = !!(r.settings && r.settings.showStrong === true);
    strongBox.checked = showStrong;
  }
  const saveInstalled = () => chrome.storage.local.set({ packsInstalled: installed });

  // What a pack offers: the items you may see (strong language is off by default), the ones you can add now (their plan allows it),
  // and the rest (a Pro or Pro Max item: "Coming soon" while the shop is closed).
  const visible = (pack) => pack.items.filter((i) => showStrong || !i.explicit);
  const openItems = (pack) => visible(pack).filter((i) => tierOk(i.tier || pack.tier));
  const isNew = (pack, i) => !((installed[pack.id] || {}).items || []).includes(i.id);
  const regionName = (r) => t('pk_region_' + (REGIONS.includes(r) ? r || 'all' : 'global'));

  function render() {
    list.replaceChildren();
    if (!catalog) return;
    const want = regionSel.value;
    const mine = inIndia() ? ['in', 'common', 'global'] : ['common', 'global', 'in'];
    const packs = catalog.filter((p) => visible(p).length && (!want || p.region === want))
      .sort((a, b) => mine.indexOf(a.region) - mine.indexOf(b.region));
    if (!packs.length) { status.textContent = t('op_online_none'); return; }
    status.textContent = t('op_online_space', (usedBytes() / 1048576).toFixed(1), String(MAX_PACK_BYTES / 1048576));
    for (const p of packs) {
      const all = visible(p), open = openItems(p), locked = all.length - open.length, have = installed[p.id];
      const fresh = open.filter((i) => isNew(p, i)), bytes = fresh.reduce((a, i) => a + (i.bytes || 0), 0);
      const tags = [t(p.kind === 'music' ? 'op_online_music' : p.kind === 'pictures' ? 'op_online_pictures' : 'op_online_memes'), regionName(p.region),
        t('op_online_free_n', String(open.length))];
      if (locked) tags.push(t(plan.shopOpen() ? 'op_online_paid_n' : 'op_online_soon_n', String(locked)));
      if (p.items.some((i) => i.explicit)) tags.push(t('op_online_strong_tag'));
      const languageNames = [...new Set(all.filter((i) => i.lang).map((i) => i.languageName || MEME.LANGS[i.lang] || i.lang))];
      const note = [p.description, languageNames.join(' · '), [...new Set(all.map((i) => i.licence).filter(Boolean))].join(' · ')].filter(Boolean).join(' · ');
      const act = el('div', { className: 'actions' });
      if (have) act.append(el('span', { className: 'tag' }, t('op_online_added')));
      if (fresh.length) {
        const add = el('button', { type: 'button', className: 'small primary' }, t(have ? 'op_online_more' : 'op_online_add', ...(have ? [String(fresh.length), mb(bytes)] : [mb(bytes)])));
        add.addEventListener('click', () => addPack(p, add));
        act.append(add);
      } else if (!have) {
        act.append(el('button', { type: 'button', className: 'small', disabled: true }, plan.shopOpen() ? t('op_online_needs') : t('op_online_soon')));
      }
      if (have) {
        const rm = el('button', { type: 'button', className: 'small danger' }, t('op_online_remove'));
        rm.addEventListener('click', () => remove(p));
        act.append(rm);
      }
      list.append(el('li', {}, el('div', { className: 'pack-name' }, el('b', {}, p.title), ' ', ...tags.map((x) => el('span', { className: 'tag' }, x))),
        note ? el('div', { className: 'hint' }, note) : '', act));
    }
  }

  async function fetchFile(item) {
    const headers = {};
    const key = plan.license && plan.license.key;
    if (key) headers['X-MemeBox-Key'] = key;
    const res = await fetch(`${SITE}/api/pack-file?item=${encodeURIComponent(item.id)}`, { headers });
    if (res.status === 429) { const e = new Error('limit'); e.limit = true; throw e; } // the daily cap on files
    if (!res.ok) throw new Error(`${res.status}`);
    return res.arrayBuffer();
  }

  async function addPack(pack, btn) {
    const items = openItems(pack).filter((i) => isNew(pack, i));
    const ids = { lines: [], clips: [], music: [], pictures: [], items: [], bytes: 0 };
    btn.disabled = true;
    let done = 0, failed = 0, limited = false;
    const { myMusic } = await chrome.storage.local.get('myMusic');
    let tracks = Array.isArray(myMusic) ? [...myMusic] : [];
    const category = String(pack.title).slice(0, 30);
    let full = false;
    for (const item of items) {
      if (usedBytes() + ids.bytes + (item.bytes || 0) > MAX_PACK_BYTES) { full = true; break; } // this computer's share for packs is used up
      btn.textContent = t('op_online_busy', String(done + 1), String(items.length));
      try {
        if (item.kind === 'line') {
          const lang = itemLang(item.lang);
          if (!lang) throw new Error('This dialogue needs a recorded voice.');
          const line = sanitizeLine({ id: 'pk-' + suffix(item.id), kind: 'tts', text: item.text || item.title, lang, tone: 'normal', category, fav: 0, volume: 1 });
          if (line) { ids.lines.push(line.id); lines = [...lines.filter((x) => x.id !== line.id), line]; }
        } else if (item.kind === 'image') { // a meme picture: a line that shows it on your camera while it plays
          const bytes = await fetchFile(item);
          const shrunk = await shrinkPicture(new File([bytes], item.title + '.img', { type: item.mime || 'image/png' }));
          const pictureId = 'p-pk' + suffix(item.id);
          await MemeDB.putPicture({ id: pictureId, name: item.title.slice(0, 120), ...shrunk });
          const line = sanitizeLine({ id: 'pk-' + suffix(item.id), kind: 'tts', text: item.title, lang: 'en', tone: 'normal', category, fav: 0, volume: 1 });
          if (line) { line.pictureId = pictureId; ids.pictures.push(pictureId); ids.lines.push(line.id); lines = [...lines.filter((x) => x.id !== line.id), line]; }
        } else if (pack.kind === 'music') {
          if (tracks.filter((x) => x.pack).length >= MAX_PACK_TRACKS) throw new Error('too many');
          const bytes = await fetchFile(item);
          const id = 'm-' + suffix(item.id);
          await MemeDB.putClip({ id, name: item.title.slice(0, 120), type: item.mime || 'audio/mpeg', bytes });
          tracks = [...tracks.filter((x) => x.id !== id), { id, name: item.title.slice(0, 60), size: bytes.byteLength, pack: pack.id }];
          ids.music.push(id);
        } else { // an audio meme: a clip line
          if (item.bytes > MAX_MEME_CLIP) throw new Error('too big');
          const bytes = await fetchFile(item);
          const clipId = 'c-pk' + suffix(item.id);
          await MemeDB.putClip({ id: clipId, name: item.title.slice(0, 120), type: item.mime || 'audio/mpeg', bytes });
          const line = sanitizeLine({ id: 'pk-' + suffix(item.id), kind: 'clip', clipId, text: item.title, lang: 'en', tone: 'normal', category, fav: 0, volume: 1 });
          if (line) { ids.clips.push(clipId); ids.lines.push(line.id); lines = [...lines.filter((x) => x.id !== line.id), line]; }
        }
        done++; ids.items.push(item.id); ids.bytes += item.bytes || 0;
      } catch (e) {
        if (e && e.limit) { limited = true; break; } // today's limit is reached: keep what was added, the rest can be added tomorrow
        failed++;
      }
    }
    if (ids.music.length) await chrome.storage.local.set({ myMusic: tracks });
    if (ids.lines.length) await saveLines();
    if (done) {
      const was = installed[pack.id] || {};
      const join = (k) => [...new Set([...(was[k] || []), ...ids[k]])];
      installed[pack.id] = { bytes: (was.bytes || 0) + ids.bytes, lines: join('lines'), clips: join('clips'), music: join('music'), pictures: join('pictures'), items: join('items'), at: new Date().toISOString().slice(0, 10) };
      await saveInstalled();
    }
    toast(full && done ? t('op_online_full', String(done), String(MAX_PACK_BYTES / 1048576)) : full ? t('op_online_full', '0', String(MAX_PACK_BYTES / 1048576)) : limited ? t('op_online_limit', String(done)) : done ? t('op_online_done', pack.title, String(done)) + (failed ? ` (${failed} ✗)` : '') : t('op_online_fail'), limited || full ? false : !done);
    render();
  }

  async function remove(pack) {
    const have = installed[pack.id];
    if (!have) return;
    const gone = new Set(have.lines || []);
    if (gone.size) { lines = lines.filter((l) => !gone.has(l.id)); await saveLines(); }
    for (const id of [...(have.clips || []), ...(have.music || [])]) await MemeDB.deleteClip(id).catch(() => {});
    for (const id of have.pictures || []) await MemeDB.deletePicture(id).catch(() => {});
    if ((have.music || []).length) {
      const { myMusic } = await chrome.storage.local.get('myMusic');
      await chrome.storage.local.set({ myMusic: (Array.isArray(myMusic) ? myMusic : []).filter((x) => !have.music.includes(x.id)) });
    }
    delete installed[pack.id];
    await saveInstalled();
    toast(t('op_pack_removed', pack.title));
    render();
  }

  async function open() {
    browse.disabled = true;
    status.textContent = t('op_online_loading');
    try {
      await load();
      const res = await fetch(`${SITE}/api/packs`);
      const data = await res.json();
      if (!res.ok || !data.ok || !Array.isArray(data.packs)) throw new Error('bad answer');
      catalog = data.packs;
      render();
    } catch {
      status.textContent = t('op_online_fail');
    } finally {
      browse.disabled = false;
      browse.textContent = t('op_online_refresh');
    }
  }

  regionSel.replaceChildren(...REGIONS.map((r) => el('option', { value: r }, regionName(r))));
  regionSel.addEventListener('change', render);
  strongBox.addEventListener('change', async () => {
    showStrong = strongBox.checked;
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...MEME.defaultSettings(), ...(settings || {}), showStrong } });
    render();
  });
  browse.addEventListener('click', open);
  if (location.hash === '#online-card') open(); // opened from the panel's "Free packs" button
})();
