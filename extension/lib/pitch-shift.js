// MemeBox – real-time pitch shifter for the live voice changer (pure maths, no Web Audio).
// Classic script that sets globalThis.MemePitchShifter. It is loaded three ways:
//   - imported by voice-worklet.js inside the AudioWorklet (the normal path),
//   - as a MAIN-world content script before mic-hook.js (ScriptProcessor fallback),
//   - by the unit tests.
//
// Method: a delay line read by two taps whose delay sweeps across a short window at a
// rate set by the pitch ratio. The taps are half a window apart and cross-faded with
// sin² weights (which always sum to 1), so each tap fades out just before it jumps.
(() => {
  'use strict';

  class PitchShifter {
    constructor(sampleRate, windowSec = 0.05) {
      this.window = Math.max(64, Math.round(sampleRate * windowSec));
      let size = 1;
      while (size < this.window * 2 + 4) size <<= 1;
      this.buf = new Float32Array(size);
      this.mask = size - 1;
      this.write = 0;
      this.phase = 0;
      this.ratio = 1;
    }

    // Linear-interpolated sample `delay` samples behind the write position.
    read(delay) {
      const pos = this.write - delay;
      const i = Math.floor(pos);
      const frac = pos - i;
      const a = this.buf[i & this.mask];
      const b = this.buf[(i + 1) & this.mask];
      return a + (b - a) * frac;
    }

    // input/output: Float32Array blocks of the same length (they may be the same array).
    process(input, output) {
      const r = Math.min(4, Math.max(0.25, Number(this.ratio) || 1));
      const W = this.window;
      const step = (1 - r) / W; // delay grows for lower pitch, shrinks for higher
      for (let n = 0; n < input.length; n++) {
        this.buf[this.write & this.mask] = input[n];
        if (r === 1) {
          output[n] = input[n];
        } else {
          let p = this.phase + step;
          p -= Math.floor(p); // wrap into [0, 1)
          this.phase = p;
          const q = p + 0.5 < 1 ? p + 0.5 : p - 0.5;
          const s1 = Math.sin(Math.PI * p);
          const s2 = Math.sin(Math.PI * q);
          output[n] = this.read(p * W + 1) * s1 * s1 + this.read(q * W + 1) * s2 * s2;
        }
        this.write = (this.write + 1) & 0x3fffffff;
      }
    }
  }

  globalThis.MemePitchShifter = PitchShifter;
})();
