// MemeBox site: the try-it soundboard on the landing page. Plays real MemeBox voices
// (assets/demo/*.wav, made by npm run demo-sounds) and three effects built with Web Audio,
// in four tones, with the big caption on the mini call. Sound plays on this page only.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  if (!stage) return;
  const T = (key, ...subs) => (window.MemeSite ? window.MemeSite.t(key, ...subs) : key);

  // rate: speed/pitch. robot: ring modulator (same idea as the extension's Robot tone).
  const TONES = { normal: { rate: 1 }, chipmunk: { rate: 1.35 }, villain: { rate: 0.78 }, robot: { rate: 1, robot: true } };
  let tone = 'normal';
  let ctx = null;
  let playing = [];
  let count = 0;
  const buffers = {};

  function audio() {
    ctx = ctx || new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function loadVoice(id) {
    if (!buffers[id]) {
      buffers[id] = fetch(`/assets/demo/${id}.wav`).then((r) => r.arrayBuffer()).then((b) => audio().decodeAudioData(b));
      buffers[id].catch(() => { delete buffers[id]; });
    }
    return buffers[id];
  }

  // Everything goes through here: tone effect, then the speakers. Returns the input node.
  function output() {
    const c = audio();
    const master = c.createGain();
    master.gain.value = 0.9;
    master.connect(c.destination);
    const input = c.createGain();
    if (TONES[tone].robot) {
      const ring = c.createGain();
      ring.gain.value = 0;
      const osc = c.createOscillator();
      osc.frequency.value = 55;
      osc.connect(ring.gain);
      osc.start();
      const dry = c.createGain();
      dry.gain.value = 0.35;
      input.connect(ring).connect(master);
      input.connect(dry).connect(master);
      playing.push(osc);
    } else {
      input.connect(master);
    }
    return input;
  }

  function track(node, end) {
    playing.push(node);
    node.stop(end);
  }

  // ---------- effects, made on the fly ----------

  function horn(input, t, rate) {
    const c = audio();
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    [0, 0.35, 0.55].forEach((start) => {
      g.gain.linearRampToValueAtTime(0.35, t + start + 0.03);
      g.gain.linearRampToValueAtTime(start === 0.55 ? 0.35 : 0.05, t + start + 0.3);
    });
    g.gain.linearRampToValueAtTime(0, t + 1.3);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    g.connect(lp).connect(input);
    for (const f of [440, 554, 659]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f * rate;
      o.connect(g);
      o.start(t);
      track(o, t + 1.35);
    }
    return 1.35;
  }

  function noise(duration) {
    const c = audio();
    const b = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function rimshot(input, t, rate) {
    const c = audio();
    const hits = [[0, 180], [0.22, 140]];
    for (const [at, f] of hits) {
      const o = c.createOscillator();
      o.frequency.setValueAtTime(f * rate, t + at);
      o.frequency.exponentialRampToValueAtTime(60 * rate, t + at + 0.18);
      const g = c.createGain();
      g.gain.setValueAtTime(0.8, t + at);
      g.gain.exponentialRampToValueAtTime(0.001, t + at + 0.2);
      o.connect(g).connect(input);
      o.start(t + at);
      track(o, t + at + 0.22);
    }
    const cym = c.createBufferSource();
    cym.buffer = noise(1);
    cym.playbackRate.value = rate;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.5, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.25);
    cym.connect(hp).connect(g).connect(input);
    cym.start(t + 0.45);
    track(cym, t + 1.3);
    return 1.3;
  }

  function sad(input, t, rate) {
    const c = audio();
    const notes = [[392, 0.45], [370, 0.45], [349, 0.45], [330, 1.1]];
    let at = 0;
    for (const [f, len] of notes) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f * rate;
      if (len > 1) { // the last, wobbling note
        const lfo = c.createOscillator();
        lfo.frequency.value = 6;
        const depth = c.createGain();
        depth.gain.value = 8 * rate;
        lfo.connect(depth).connect(o.frequency);
        lfo.start(t + at);
        track(lfo, t + at + len);
      }
      const g = c.createGain();
      g.gain.setValueAtTime(0, t + at);
      g.gain.linearRampToValueAtTime(0.28, t + at + 0.05);
      g.gain.setValueAtTime(0.28, t + at + len - 0.08);
      g.gain.linearRampToValueAtTime(0, t + at + len);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      o.connect(lp).connect(g).connect(input);
      o.start(t + at);
      track(o, t + at + len);
      at += len;
    }
    return at;
  }

  const EFFECTS = { horn, rimshot, sad };

  // ---------- playing ----------

  function stopAll() {
    for (const n of playing) { try { n.stop(); } catch { /* already stopped */ } }
    playing = [];
  }

  let captionTimer = 0;
  function showCaption(text) {
    const cap = $('stage-caption');
    cap.textContent = text;
    cap.classList.remove('show');
    void cap.offsetWidth; // restart the pop animation
    cap.classList.add('show');
    stage.classList.add('talking');
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => stage.classList.remove('talking'), 2600);
  }

  async function play(pad) {
    stopAll();
    const id = pad.dataset.sound;
    const rate = TONES[tone].rate;
    const c = audio();
    const input = output();
    try {
      if (EFFECTS[id]) {
        EFFECTS[id](input, c.currentTime + 0.02, rate);
      } else {
        const src = c.createBufferSource();
        src.buffer = await loadVoice(id);
        src.playbackRate.value = rate;
        src.connect(input);
        src.start();
        playing.push(src);
      }
    } catch {
      return; // offline or blocked: just no sound
    }
    showCaption(pad.dataset.caption);
    const r = pad.getBoundingClientRect();
    if (window.MemeFun) window.MemeFun.burst(r.left + r.width / 2, r.top + r.height / 2, 9, [pad.querySelector('.pe').textContent]);
    count++;
    $('try-count').textContent = T('try_count', count);
    pad.classList.remove('hit');
    void pad.offsetWidth;
    pad.classList.add('hit');
  }

  for (const pad of document.querySelectorAll('.pad')) {
    pad.addEventListener('pointerenter', () => { if (!EFFECTS[pad.dataset.sound]) loadVoice(pad.dataset.sound); }, { once: true });
    pad.addEventListener('click', () => play(pad));
  }
  for (const b of document.querySelectorAll('.tone')) {
    b.addEventListener('click', () => {
      tone = b.dataset.tone;
      for (const x of document.querySelectorAll('.tone')) {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-checked', String(x === b));
      }
    });
  }
  $('try-stop').addEventListener('click', () => { stopAll(); stage.classList.remove('talking'); });
})();
