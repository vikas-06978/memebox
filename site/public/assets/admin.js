// MemeBox admin dashboard: small helpers that make the page interactive (a separate file because the admin
// pages allow no inline scripts). Nothing here sends data anywhere; "handled" ticks and settings stay in this browser.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem('mbx-admin-' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('mbx-admin-' + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  // ---- charts: 7 / 14 / 30 day buttons (the server draws all 30 days; this redraws the bars for the range picked) ----
  const NS = 'http://www.w3.org/2000/svg';
  function draw(box, days) {
    const series = JSON.parse(box.dataset.series).slice(-days);
    const max = Math.max(1, ...series.map((x) => x.n)), W = 300, H = 56, bw = W / series.length;
    const svg = $('svg', box);
    svg.replaceChildren();
    series.forEach((x, i) => {
      const bh = x.n ? Math.max(2, (x.n / max) * (H - 4)) : 1;
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('class', 'bar' + (x.n ? '' : ' zero'));
      r.setAttribute('x', (i * bw + 1).toFixed(1)); r.setAttribute('y', (H - bh).toFixed(1));
      r.setAttribute('width', Math.max(1, bw - 2).toFixed(1)); r.setAttribute('height', bh.toFixed(1)); r.setAttribute('rx', '1.5');
      const t = document.createElementNS(NS, 'title'); t.textContent = `${x.d}: ${x.n}`; r.append(t);
      svg.append(r);
    });
    const ax = $('.chart-axis', box);
    if (ax) ax.replaceChildren(...[series[0].d.slice(5), series[series.length - 1].d.slice(5)].map((s) => Object.assign(document.createElement('span'), { textContent: s })));
    const total = $('.chart-total', box);
    if (total) total.textContent = String(series.reduce((a, x) => a + x.n, 0));
  }
  const rangeBar = $('#range');
  if (rangeBar) {
    const set = (days) => {
      store.set('range', days);
      for (const b of $$('button', rangeBar)) b.classList.toggle('on', Number(b.dataset.days) === days);
      for (const box of $$('.chartbox')) draw(box, days);
    };
    for (const b of $$('button', rangeBar)) b.addEventListener('click', () => set(Number(b.dataset.days)));
    set([7, 14, 30].includes(store.get('range', 30)) ? store.get('range', 30) : 30);
  }

  // ---- messages: search, type, rating, reason; click a bar or a face above to filter; open a row; tick "answered" ----
  const table = $('#messages');
  if (table) {
    const rows = $$('tbody tr', table);
    const q = $('#m-q'), type = $('#m-type'), rating = $('#m-rating'), reason = $('#m-reason'), count = $('#m-count');
    const done = new Set(store.get('done', []));
    const apply = () => {
      const text = q.value.trim().toLowerCase();
      let shown = 0;
      for (const r of rows) {
        const d = r.dataset;
        const ok = (!text || d.q.includes(text)) && (!type.value || d.type === type.value) && (!rating.value || d.rating === rating.value)
          && (!reason.value || d.reason === reason.value) && !(hideDone.checked && done.has(d.id));
        r.hidden = !ok;
        if (ok) shown++;
      }
      count.textContent = `${shown} of ${rows.length}`;
      for (const li of $$('[data-pick]')) li.classList.toggle('picked', li.dataset.pick === 'rating:' + rating.value || li.dataset.pick === 'reason:' + reason.value);
    };
    const hideDone = $('#m-hide-done');
    for (const el of [q, type, rating, reason, hideDone]) el.addEventListener('input', apply);
    $('#m-clear').addEventListener('click', () => { q.value = ''; type.value = rating.value = reason.value = ''; hideDone.checked = false; apply(); });
    for (const li of $$('[data-pick]')) {
      li.addEventListener('click', () => {
        const [k, v] = li.dataset.pick.split(':');
        const sel = k === 'rating' ? rating : reason;
        sel.value = sel.value === v ? '' : v;
        if (k === 'reason') type.value = sel.value ? 'uninstall' : type.value;
        if (k === 'rating') type.value = sel.value ? 'feedback' : type.value;
        apply();
        table.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    for (const r of rows) {
      const box = $('input.done', r);
      box.checked = done.has(r.dataset.id);
      r.classList.toggle('is-done', box.checked);
      box.addEventListener('change', () => {
        if (box.checked) done.add(r.dataset.id); else done.delete(r.dataset.id);
        r.classList.toggle('is-done', box.checked);
        store.set('done', [...done].slice(-2000));
        apply();
      });
      r.addEventListener('click', (e) => { if (!e.target.closest('input, button, a')) r.classList.toggle('open'); });
    }
    for (const b of $$('button.copy')) b.addEventListener('click', () => { navigator.clipboard.writeText(b.dataset.copy).then(() => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy email'; }, 1500); }).catch(() => {}); });
    apply();
  }

  // ---- keys: filter and copy ----
  const kq = $('#k-q');
  if (kq) {
    const rows = $$('#keys tbody tr');
    kq.addEventListener('input', () => { const t = kq.value.trim().toLowerCase(); for (const r of rows) r.hidden = !!t && !r.dataset.q.includes(t); });
    for (const b of $$('button.copy-key')) b.addEventListener('click', () => { navigator.clipboard.writeText(b.dataset.key).then(() => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1500); }).catch(() => {}); });
  }

  // ---- top bar: refresh now, auto-refresh every minute, waiting payments in the tab title ----
  const waiting = Number(document.body.dataset.waiting || 0);
  if (waiting > 0) document.title = `(${waiting}) ${document.title}`;
  const auto = $('#auto-refresh');
  if (auto) {
    auto.checked = store.get('auto', false) === true;
    let timer = 0;
    const arm = () => { clearTimeout(timer); if (auto.checked) timer = setTimeout(() => location.reload(), 60000); };
    auto.addEventListener('change', () => { store.set('auto', auto.checked); arm(); });
    arm();
  }
  const now = $('#updated');
  if (now) now.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  $('#refresh')?.addEventListener('click', () => location.reload());

  // ---- pack audio trimmer: local-only preparation before the normal upload form ----
  const trimSource = $('#trim-source');
  if (trimSource) {
    const audio = $('#trim-preview'), start = $('#trim-start'), end = $('#trim-end');
    const play = $('#trim-play'), use = $('#trim-use'), status = $('#trim-status'), upload = $('#pack-upload-files');
    let sourceFile = null, sourceUrl = '', previewEnd = 0;
    const seconds = (v) => Math.max(0, Number(v) || 0);
    const range = () => {
      const duration = Number(audio.duration) || 0;
      const from = Math.min(seconds(start.value), duration);
      const to = Math.min(Math.max(seconds(end.value), from + 0.1), duration);
      return { from, to, duration };
    };
    const wav = (samples, sampleRate) => {
      const buf = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buf);
      const text = (at, s) => { for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i)); };
      text(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      text(36, 'data'); v.setUint32(40, samples.length * 2, true);
      const fade = Math.min(Math.floor(samples.length / 2), Math.round(sampleRate * 0.005));
      for (let i = 0; i < samples.length; i++) {
        let n = Math.max(-1, Math.min(1, samples[i]));
        if (fade && i < fade) n *= i / fade;
        else if (fade && i >= samples.length - fade) n *= (samples.length - 1 - i) / fade;
        v.setInt16(44 + i * 2, n < 0 ? Math.round(n * 32768) : Math.round(n * 32767), true);
      }
      return buf;
    };
    trimSource.addEventListener('change', () => {
      sourceFile = trimSource.files[0] || null;
      previewEnd = 0;
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (!sourceFile) { audio.removeAttribute('src'); status.textContent = 'Choose an audio file first.'; return; }
      if (sourceFile.size > 50 * 1048576) { sourceFile = null; audio.removeAttribute('src'); status.textContent = 'That source is over 50 MB. Use a shorter audio file.'; return; }
      sourceUrl = URL.createObjectURL(sourceFile); audio.src = sourceUrl;
      status.textContent = 'Reading the audio…';
    });
    audio.addEventListener('loadedmetadata', () => {
      if (!sourceFile) return;
      if (!Number.isFinite(audio.duration) || audio.duration <= 0 || audio.duration > 600) {
        status.textContent = 'Use an audio file between 0.1 seconds and 10 minutes. Movies and long recordings are rejected.';
        return;
      }
      start.max = end.max = String(audio.duration);
      start.value = '0'; end.value = String(Math.min(3, audio.duration).toFixed(1));
      status.textContent = `Loaded ${audio.duration.toFixed(1)} seconds. Select a main part up to 10 seconds.`;
    });
    audio.addEventListener('timeupdate', () => {
      if (previewEnd && audio.currentTime >= previewEnd) { audio.pause(); previewEnd = 0; }
    });
    play.addEventListener('click', async () => {
      const r = range();
      if (!sourceFile || !r.duration || r.duration > 600) { status.textContent = 'Choose a valid audio file first.'; return; }
      if (r.to - r.from > 10) { status.textContent = 'The main meme part can be at most 10 seconds.'; return; }
      audio.currentTime = r.from; previewEnd = r.to;
      try { await audio.play(); } catch { status.textContent = 'Press play in the audio control, then try Preview again.'; }
    });
    use.addEventListener('click', async () => {
      const r = range();
      if (!sourceFile || !r.duration || r.duration > 600) { status.textContent = 'Choose a valid audio file first.'; return; }
      if (r.to - r.from > 10) { status.textContent = 'Choose 10 seconds or less.'; return; }
      use.disabled = true; status.textContent = 'Trimming locally in your browser…';
      let context;
      try {
        context = new AudioContext();
        const decoded = await context.decodeAudioData(await sourceFile.arrayBuffer());
        const from = Math.floor(r.from * decoded.sampleRate), to = Math.min(decoded.length, Math.ceil(r.to * decoded.sampleRate));
        const mono = new Float32Array(Math.max(1, to - from));
        for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
          const data = decoded.getChannelData(channel);
          for (let i = 0; i < mono.length; i++) mono[i] += data[from + i] / decoded.numberOfChannels;
        }
        const base = sourceFile.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9 _-]+/gi, '').trim() || 'meme';
        const file = new File([wav(mono, decoded.sampleRate)], `${base}-clip.wav`, { type: 'audio/wav' });
        const transfer = new DataTransfer(); transfer.items.add(file); upload.files = transfer.files;
        upload.scrollIntoView({ behavior: 'smooth', block: 'center' });
        status.textContent = `${file.name} is ready in Files below (${(file.size / 1024).toFixed(0)} KB). Fill credit/source/licence, then Upload.`;
      } catch {
        status.textContent = 'Chrome could not decode this file. Convert it to MP3 or WAV and try again.';
      } finally {
        if (context) await context.close().catch(() => {});
        use.disabled = false;
      }
    });
  }

  // ---- section nav: highlight the section in view ----
  const links = $$('.admin-nav a[href^="#"]');
  const targets = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window && targets.length) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) for (const a of links) a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id);
    }, { rootMargin: '-20% 0px -70% 0px' });
    for (const t of targets) io.observe(t);
  }
})();
