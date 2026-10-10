// MemeBox music: eight small original tunes played by Web Audio (oscillators and noise), no audio files.
// So there is no copyright to worry about, nothing to download, and the same engine plays
//   - in the call page (mic-hook.js mixes it into your mic), and
//   - in the panel (the 20 s preview on your own speakers).
// Classic script. The panel gets a generated copy, lib/music-ui.js (`npm run sync-fx` makes it).
//
//   const p = MemeMusic.createPlayer(audioContext, destinationNode);
//   p.play('chill');  p.setVolume(0.4);  p.stop();
(() => {
  'use strict';

  const midi = (n) => 440 * 2 ** ((n - 69) / 12);

  // Free: chill and funky. The rest is Pro.
  const FREE_TUNES = ['chill', 'funky'];

  // `h` is a helper for one tune: h.note(midiNote, startSec, lengthSec, wave, gain), h.kick / snare / hat / clap(start, gain).
  // `s` is the 16th-note step counted from 0 (it loops by itself), `t` is when that step sounds.
  function makeHelpers(ctx, out, noiseBuf) {
    const env = (g, t, a, len, peak) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.02, len));
    };
    const h = {
      note(n, t, len, wave = 'triangle', peak = 0.2, opts = {}) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = wave;
        o.frequency.setValueAtTime(midi(n), t);
        if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(midi(opts.slideTo), t + len);
        if (opts.detune) o.detune.value = opts.detune;
        env(g, t, opts.attack || 0.012, len, peak);
        let node = g;
        if (opts.lowpass) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lowpass; g.connect(f); node = f; }
        o.connect(g); node.connect(out);
        o.start(t); o.stop(t + len + 0.05);
      },
      kick(t, peak = 0.7, low = 48) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(low, t + 0.12);
        g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3);
      },
      noise(t, len, peak, type, freq, q = 0.8) {
        const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
        g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
        s.connect(f); f.connect(g); g.connect(out);
        s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
      },
    };
    h.snare = (t, peak = 0.35) => { h.noise(t, 0.16, peak, 'bandpass', 1900, 0.7); h.note(52, t, 0.1, 'triangle', peak * 0.5, { slideTo: 44 }); };
    h.clap = (t, peak = 0.3) => { for (let i = 0; i < 3; i++) h.noise(t + i * 0.011, 0.09, peak, 'bandpass', 1500, 1.1); };
    h.hat = (t, peak = 0.12, open = false) => h.noise(t, open ? 0.14 : 0.04, peak, 'highpass', 7000, 0.5);
    return h;
  }

  const chord = (root, tones) => tones.map((x) => root + x);

  const TUNES = {
    // Slow and warm: soft chords, a gentle beat.
    chill: {
      bpm: 76, swing: 0.1,
      step(s, t, h, q) {
        const bar = Math.floor(s / 16) % 4, i = s % 16;
        const roots = [57, 53, 60, 55];
        const kinds = [[0, 3, 7, 10, 14], [0, 4, 7, 11, 14], [0, 4, 7, 11, 14], [0, 4, 7, 10, 14]];
        const ch = chord(roots[bar], kinds[bar]);
        if (i === 0) ch.forEach((n, k) => h.note(n, t + k * 0.012, q * 15, 'sine', 0.09, { attack: 0.03 }));
        if (i === 6 || i === 10) ch.slice(1, 4).forEach((n) => h.note(n + 12, t, q * 3, 'triangle', 0.05));
        if (i === 0 || i === 8) h.note(roots[bar] - 24, t, q * 6, 'sine', 0.3);
        if (i === 0 || i === 10) h.kick(t, 0.4, 52);
        if (i === 8) h.snare(t, 0.16);
        if (i % 2 === 0) h.hat(t, i % 4 === 2 ? 0.05 : 0.03);
        if (i === 14 && bar % 2 === 1) h.note(roots[bar] + 19, t, q * 4, 'sine', 0.05);
      },
    },
    // Upbeat groove: a bouncy bass line and little chord stabs.
    funky: {
      bpm: 104, swing: 0.06,
      step(s, t, h, q) {
        const i = s % 16, bar = Math.floor(s / 16) % 4;
        const bass = [40, 40, 43, 45, 40, 47, 45, 43];
        const pat = [0, 3, 6, 8, 10, 12, 14];
        const k = pat.indexOf(i);
        if (k >= 0) h.note(bass[(k + bar) % bass.length], t, q * 2.4, 'sawtooth', 0.2, { lowpass: 520 });
        if ([2, 7, 10, 15].includes(i)) [64, 67, 71].forEach((n) => h.note(n + (bar % 2 ? 5 : 0), t, q * 1.2, 'square', 0.03, { lowpass: 2400 }));
        if (i === 0 || i === 6 || i === 10) h.kick(t, 0.55);
        if (i === 4 || i === 12) h.snare(t, 0.3);
        h.hat(t, i % 2 ? 0.05 : 0.09, i === 14);
      },
    },
    // Dance floor: four on the floor, off-beat bass, bright stabs.
    party: {
      bpm: 124, swing: 0,
      step(s, t, h, q) {
        const i = s % 16, bar = Math.floor(s / 16) % 4;
        const roots = [53, 49, 56, 51];
        if (i % 4 === 0) h.kick(t, 0.75, 46);
        if (i === 4 || i === 12) h.clap(t, 0.26);
        if (i % 4 === 2) { h.hat(t, 0.13, true); h.note(roots[bar] - 12, t, q * 3, 'sawtooth', 0.22, { lowpass: 700 }); }
        if ([0, 3, 6, 10, 13].includes(i)) chord(roots[bar] + 12, [0, 3, 7]).forEach((n) => h.note(n, t, q * 1.5, 'sawtooth', 0.045, { lowpass: 3200 }));
        if (i % 2 === 1) h.hat(t, 0.04);
        if (i === 0 && bar === 3) h.note(roots[bar] + 24, t, q * 8, 'square', 0.04, { slideTo: roots[bar] + 36 });
      },
    },
    // Slow and uneasy: a low drone, a heartbeat, an eerie note now and then.
    suspense: {
      bpm: 60, swing: 0,
      step(s, t, h, q) {
        const i = s % 16, bar = Math.floor(s / 16) % 4;
        if (i === 0) {
          h.note(33, t, q * 15, 'sine', 0.28, { attack: 0.4 });
          h.note(34, t, q * 15, 'sine', 0.16, { attack: 0.8 });
          h.note(45 + (bar % 2) * 2, t, q * 15, 'triangle', 0.05, { attack: 0.9, lowpass: 600 });
        }
        if (i === 0 || i === 3) h.kick(t, i ? 0.35 : 0.55, 42); // thump-thump
        if (i === 8 && bar % 2 === 1) h.note(81, t, q * 7, 'sine', 0.05, { slideTo: 79, attack: 0.2 });
        if (i === 12 && bar === 3) h.noise(t, 0.9, 0.04, 'bandpass', 3200, 6);
        if (i % 4 === 2) h.hat(t, 0.015);
      },
    },
    // 8-bit game: square lead, arpeggio bass, noise drums.
    retro: {
      bpm: 132, swing: 0,
      step(s, t, h, q) {
        const i = s % 16, bar = Math.floor(s / 16) % 4;
        const roots = [60, 56, 53, 55];
        const arp = [0, 4, 7, 12];
        h.note(roots[bar] - 12 + arp[i % 4], t, q * 0.9, 'square', 0.09, { attack: 0.003 });
        const mel = [0, 4, 7, 4, 12, 7, 4, 7, 9, 7, 4, 2, 4, 0, 2, 4];
        if (i % 2 === 0 || i % 4 === 3) h.note(roots[bar] + 12 + mel[i], t, q * 1.8, 'square', 0.08, { attack: 0.003 });
        if (i % 4 === 0) h.kick(t, 0.5, 60);
        if (i === 4 || i === 12) h.noise(t, 0.07, 0.2, 'highpass', 3000, 0.4);
        if (i % 2 === 1) h.hat(t, 0.05);
      },
    },
    // Swing: a walking bass, a ride cymbal, soft chord hits on 2 and 4.
    jazz: {
      bpm: 118, swing: 0.34,
      step(s, t, h, q) {
        const i = s % 16, bar = Math.floor(s / 16) % 4;
        const chords = [[50, [0, 3, 7, 10]], [43, [0, 4, 7, 10]], [48, [0, 4, 7, 11]], [48, [0, 4, 7, 11]]];
        const [root, tones] = chords[bar];
        const walk = [0, 4, 7, 9];
        if (i % 4 === 0) h.note(root - 12 + [0, 4, 7, 10][(i / 4 + bar) % 4] % 12 + (i / 4 === 3 ? 0 : 0), t, q * 3.6, 'triangle', 0.3, { lowpass: 700 });
        if (i % 4 === 0) h.hat(t, 0.05, true);
        if (i % 4 === 2 || i === 3 || i === 11) h.hat(t, 0.035, true);
        if (i === 4 || i === 12) tones.forEach((x) => h.note(root + 12 + x, t, q * 3, 'sine', 0.07));
        if (i === 7 && bar % 2 === 0) h.snare(t, 0.07);
        if (i === 0) h.kick(t, 0.18, 55);
        if (i === 10 && bar === 3) h.note(root + 24 + walk[1], t, q * 5, 'triangle', 0.06);
      },
    },
    // Big and cinematic: slow strings, deep drum hits, a rising line.
    epic: {
      bpm: 88, swing: 0,
      step(s, t, h, q) {
        const i = s % 16, bar = Math.floor(s / 16) % 4;
        const roots = [50, 46, 53, 48];
        if (i === 0) {
          chord(roots[bar], [0, 7, 12, 15]).forEach((n, k) => {
            h.note(n, t, q * 15.5, 'sawtooth', 0.06, { attack: 0.9, lowpass: 900, detune: k % 2 ? 7 : -7 });
          });
          h.note(roots[bar] - 24, t, q * 15.5, 'sine', 0.32, { attack: 0.3 });
        }
        if (i === 0 || i === 10) h.kick(t, 0.9, 38);
        if (i === 8) h.kick(t, 0.5, 44);
        if (i === 14) h.noise(t, 0.5, 0.06, 'bandpass', 800, 1);
        if (i % 4 === 0 && bar >= 2) h.note(roots[bar] + 24 + (i / 4) * 2, t, q * 3.5, 'triangle', 0.05);
      },
    },
    // Sunny and bouncy: plucks, a rolling bass, a shaker.
    tropical: {
      bpm: 100, swing: 0.04,
      step(s, t, h, q) {
        const i = s % 16, bar = Math.floor(s / 16) % 4;
        const roots = [60, 65, 67, 60];
        const scale = [0, 2, 4, 7, 9, 12, 9, 7];
        if ([0, 3, 6, 8, 11, 14].includes(i)) h.note(roots[bar] + 12 + scale[(i + bar * 3) % scale.length], t, q * 1.4, 'sine', 0.12, { attack: 0.004 });
        if ([0, 3, 6, 8, 11, 14].includes(i)) h.note(roots[bar] + 12 + scale[(i + bar * 3) % scale.length] + 12, t, q * 0.9, 'triangle', 0.035, { attack: 0.004 });
        if (i === 0 || i === 6 || i === 8 || i === 14) h.note(roots[bar] - 24, t, q * 3, 'triangle', 0.3, { lowpass: 500 });
        if (i % 8 === 0) h.kick(t, 0.5, 52);
        if (i === 4 || i === 12) h.snare(t, 0.14);
        if (i % 2 === 0) h.hat(t, 0.06); else h.hat(t, 0.035);
      },
    },
  };
  const IDS = Object.keys(TUNES);

  function makeNoise(ctx) {
    const len = Math.floor(ctx.sampleRate * 0.8);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // Schedules one tune on any (real or offline) AudioContext. `until` is how many seconds of music to queue.
  function scheduleTune(ctx, out, id, from, until, startStep = 0, noiseBuf = null) {
    const tune = TUNES[id];
    const h = makeHelpers(ctx, out, noiseBuf || makeNoise(ctx));
    const q = 60 / tune.bpm / 4; // a 16th note
    let s = startStep;
    let t = from;
    while (t < until) {
      const swing = s % 2 ? tune.swing * q : 0;
      tune.step(s, t + swing, h, q);
      s++; t += q;
    }
    return { nextStep: s, nextTime: t };
  }

  // A player: keeps a little ahead of the clock, loops forever until stop(). Each play() gets its own
  // "bus" so stop() can fade it out and cut off everything already queued.
  function createPlayer(ctx, destination) {
    const master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(destination);
    const noiseBuf = makeNoise(ctx);
    let timer = 0, id = '', next = null, stopAt = 0, bus = null;
    const AHEAD = 0.6;

    function pump() {
      if (!id) return;
      if (stopAt && ctx.currentTime >= stopAt) { stop(); return; }
      if (next.nextTime < ctx.currentTime + AHEAD) {
        next = scheduleTune(ctx, bus, id, next.nextTime, ctx.currentTime + AHEAD + 0.5, next.nextStep, noiseBuf);
      }
    }
    // `seconds` (optional) = stop by itself after that long (the 20 s preview).
    function play(tuneId, seconds = 0) {
      if (!TUNES[tuneId]) return false;
      stop();
      id = tuneId;
      stopAt = seconds ? ctx.currentTime + seconds : 0;
      bus = ctx.createGain();
      bus.connect(master);
      next = { nextStep: 0, nextTime: ctx.currentTime + 0.08 };
      pump();
      timer = setInterval(pump, 120);
      return true;
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = 0; id = ''; stopAt = 0;
      if (bus) {
        const old = bus;
        old.gain.cancelScheduledValues(ctx.currentTime);
        old.gain.setValueAtTime(old.gain.value, ctx.currentTime);
        old.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
        setTimeout(() => { try { old.disconnect(); } catch { /* already gone */ } }, 250);
        bus = null;
      }
    }
    function setVolume(v) { master.gain.setTargetAtTime(Math.min(1, Math.max(0, Number(v) || 0)), ctx.currentTime, 0.05); }
    return { play, stop, setVolume, get id() { return id; }, get playing() { return !!id; } };
  }

  globalThis.MemeMusic = Object.freeze({ IDS, FREE_TUNES, TUNES, createPlayer, scheduleTune });
})();
