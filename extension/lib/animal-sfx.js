// MemeBox: the little sounds the animals make (sobbing, sniffing, a cheer, a heartbeat...). Made with the Web Audio API, no files.
// MemeSfx.play(ctx, out, kind, animal) schedules one sound into `out` (a gain node) starting now.
(() => {
  'use strict';
  // How high or low each animal's voice is.
  const PITCH = { cat: 1.15, dog: 0.8, bunny: 1.3, panda: 0.7, owl: 0.95, fox: 1.05, penguin: 1.0, lion: 0.55, monkey: 1.2, frog: 0.65, unicorn: 1.3, robot: 0.9 };
  const KINDS = ['sob', 'whimper', 'sniff', 'cheer', 'boing', 'heart', 'crack', 'blep', 'hi', 'clap', 'gasp'];

  function noiseBuffer(ctx, sec) {
    const b = ctx.createBuffer(1, Math.max(1, Math.round(ctx.sampleRate * sec)), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function play(ctx, out, kind, animal, at) {
    const t0 = (at == null ? ctx.currentTime : at) + 0.005, p = PITCH[animal] || 1, robot = animal === 'robot';
    const g = ctx.createGain(); g.gain.value = 0; g.connect(out);
    const env = (peak, a, d, start = 0, hold = 0) => { // attack, hold, then decay to silence
      g.gain.cancelScheduledValues(t0 + start);
      g.gain.setValueAtTime(0.0001, t0 + start);
      g.gain.linearRampToValueAtTime(peak, t0 + start + a);
      g.gain.setValueAtTime(peak, t0 + start + a + hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + a + hold + d);
    };
    const tone = (type, f0, f1, start, dur, vib = 0, vibHz = 0) => {
      const o = ctx.createOscillator(); o.type = robot ? 'square' : type;
      o.frequency.setValueAtTime(f0 * p, t0 + start);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, f1 * p), t0 + start + dur);
      if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vibHz; lg.gain.value = vib * p; l.connect(lg).connect(o.frequency); l.start(t0 + start); l.stop(t0 + start + dur + 0.05); }
      o.connect(g); o.start(t0 + start); o.stop(t0 + start + dur + 0.05);
    };
    const burst = (start, dur, hz, q) => {
      const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx, dur + 0.05);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = hz; f.Q.value = q;
      s.connect(f).connect(g); s.start(t0 + start); s.stop(t0 + start + dur + 0.05);
    };
    switch (kind) {
      case 'sob': // two wobbly, falling wails, then a breath
        env(0.34, 0.05, 0.55, 0, 0.0); tone('triangle', 560, 330, 0, 0.55, 14, 17);
        g.gain.setValueAtTime(0.0001, t0 + 0.62); g.gain.linearRampToValueAtTime(0.28, t0 + 0.68); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.15);
        tone('triangle', 500, 300, 0.62, 0.5, 14, 19); burst(1.1, 0.12, 2600, 1.2);
        break;
      case 'whimper': env(0.2, 0.08, 0.5, 0, 0.1); tone('triangle', 640, 470, 0, 0.7, 10, 9); break;
      case 'sniff': env(0.22, 0.01, 0.1); burst(0, 0.1, 3000, 1.5); g.gain.setValueAtTime(0.0001, t0 + 0.17); g.gain.linearRampToValueAtTime(0.2, t0 + 0.18); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3); burst(0.17, 0.12, 2400, 1.5); break;
      case 'cheer': env(0.3, 0.02, 0.3, 0, 0.1); tone('sine', 520, 880, 0, 0.18); g.gain.setValueAtTime(0.28, t0 + 0.2); tone('sine', 700, 1180, 0.2, 0.2); break;
      case 'boing': env(0.3, 0.01, 0.32, 0, 0.05); tone('sine', 260, 760, 0, 0.3, 40, 22); break;
      case 'heart': // lub-dub
        env(0.55, 0.01, 0.1); tone('sine', 80, 55, 0, 0.12);
        g.gain.setValueAtTime(0.0001, t0 + 0.17); g.gain.linearRampToValueAtTime(0.4, t0 + 0.18); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3); tone('sine', 70, 50, 0.17, 0.12);
        break;
      case 'crack': env(0.35, 0.005, 0.25); burst(0, 0.05, 1800, 0.8); tone('sawtooth', 420, 120, 0.02, 0.28); break;
      case 'blep': env(0.3, 0.02, 0.1, 0, 0.35); tone('sawtooth', 95, 80, 0, 0.45, 55, 26); break;
      case 'hi': env(0.25, 0.01, 0.12); tone('sine', 820, 1000, 0, 0.1); g.gain.setValueAtTime(0.0001, t0 + 0.14); g.gain.linearRampToValueAtTime(0.25, t0 + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.27); tone('sine', 900, 1150, 0.14, 0.12); break;
      case 'clap': env(0.4, 0.002, 0.07); burst(0, 0.06, 1500, 0.7); break;
      case 'gasp': env(0.25, 0.04, 0.2); burst(0, 0.22, 1800, 0.9); break;
      default: g.disconnect(); return false;
    }
    return true;
  }

  globalThis.MemeSfx = Object.freeze({ play, KINDS, PITCH });
})();
