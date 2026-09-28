// MemeBox – AudioWorklet for the live voice changer (loaded by mic-hook.js into the
// call page's AudioContext). Mono in, mono out; the pitch ratio is an AudioParam.
import './lib/pitch-shift.js';

registerProcessor('memebox-pitch', class extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'ratio', defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: 'k-rate' }];
  }

  constructor() {
    super();
    this.shifter = new globalThis.MemePitchShifter(sampleRate);
  }

  process(inputs, outputs, params) {
    const out = outputs[0] && outputs[0][0];
    if (!out) return true;
    const input = inputs[0] && inputs[0][0];
    if (!input) { out.fill(0); return true; }
    this.shifter.ratio = params.ratio[0];
    this.shifter.process(input, out);
    return true;
  }
});
