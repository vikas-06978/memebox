// "＋" in the panel header: add a sound from a file while you are in the call. The clip is made right here
// (decoded, cut to what fits, saved as a small WAV), saved by the service worker, and the list updates by itself:
// no trip to Options, no reload, no logout. Works for audio files and for videos (their sound).
(() => {
  'use strict';
  const mounts = (globalThis.MemeUiMounts = globalThis.MemeUiMounts || []);
  mounts.push((api) => {
    const Trim = globalThis.MemeTrim;
    const plan = globalThis.MemePlan;
    if (!Trim || !plan) return;
    const { el, t, LIMITS } = api;

    const input = el('input', { type: 'file', accept: 'audio/*,video/mp4,video/webm', multiple: true });
    input.hidden = true;
    const btn = el('button', { className: 'icon add', type: 'button', title: t('as_btn') }, '＋');
    btn.setAttribute('aria-label', t('as_btn'));
    const head = api.panel.querySelector('.head');
    if (!head) return;
    head.insertBefore(btn, head.querySelector('.icon'));
    head.append(input);
    btn.addEventListener('click', () => input.click());

    const toBase64 = (buf) => {
      const bytes = new Uint8Array(buf);
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s);
    };

    async function clipFrom(file) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      const ac = new AC();
      try {
        const buffer = await ac.decodeAudioData(await file.arrayBuffer());
        if (!buffer.duration) throw new Error('empty');
        const maxLen = Trim.maxSeconds(16000, LIMITS.clipBytes);
        const len = Math.min(buffer.duration, maxLen);
        const rate = Trim.fitSampleRate(len, LIMITS.clipBytes, buffer.sampleRate);
        if (!rate) throw new Error('long');
        const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(len * rate)), rate);
        const src = off.createBufferSource();
        src.buffer = buffer;
        src.connect(off.destination);
        src.start(0, 0, len);
        const rendered = await off.startRendering();
        return { wav: Trim.floatToWav16(rendered.getChannelData(0), rate), cut: buffer.duration > maxLen, seconds: len };
      } finally {
        ac.close().catch(() => {});
      }
    }

    input.addEventListener('change', async () => {
      const files = [...input.files];
      input.value = '';
      let added = 0;
      for (const file of files.slice(0, 10)) {
        if (!plan.can('unlimitedClips') && api.clipCount() + added >= plan.FREE_LIMITS.clips) { api.toast(t('pro_only'), 4200); break; }
        const ext = file.name.toLowerCase().split('.').pop();
        if ((!LIMITS.clipExtensions.includes(ext) && !/^(audio|video)\//.test(file.type)) || file.size > LIMITS.sourceBytes) { api.toast(t('as_bad', file.name), 4200); continue; }
        try {
          api.toast(t('as_working', file.name), 6000);
          const { wav, cut, seconds } = await clipFrom(file);
          const res = await api.ask({ type: 'clip-add', name: file.name, b64: toBase64(wav) });
          if (!res || !res.ok) throw new Error((res && res.error) || 'failed');
          added++;
          api.toast(cut ? t('as_added_cut', file.name, String(Math.round(seconds))) : t('as_added', file.name), 4200);
        } catch {
          api.toast(t('as_fail', file.name), 4200);
        }
      }
    });
  });
})();
