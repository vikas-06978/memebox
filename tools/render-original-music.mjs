// Offline review WAVs, generated from the exact bundled synthesizer. No network/audio assets.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const output = path.resolve(process.argv[2] || '/workspace/memebox-original-previews');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage();
  await page.goto('about:blank');
  await page.addScriptTag({ path: path.join(root, 'extension/lib/music.js') });
  for (const id of ['phonk_desi', 'phonk_drift', 'phonk_midnight']) {
    const rendered = await page.evaluate(async id => {
      // Reproducible noise for exported review copies only.
      let seed = 12345; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const tune = MemeMusic.TUNES[id], seconds = tune.bars * 4 * 60 / tune.bpm;
      const sampleRate = 44100, frames = Math.ceil(seconds * sampleRate);
      const context = new OfflineAudioContext(2, frames, sampleRate), bus = context.createGain();
      bus.gain.setValueAtTime(0, 0); bus.gain.linearRampToValueAtTime(0.45, 0.025);
      bus.gain.setValueAtTime(0.45, seconds - 0.08); bus.gain.linearRampToValueAtTime(0, seconds);
      bus.connect(context.destination);
      MemeMusic.scheduleTune(context, bus, id, 0.001, seconds);
      const audio = await context.startRendering();
      const wav = new ArrayBuffer(44 + frames * 4), view = new DataView(wav);
      const word = (at, value) => { for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i)); };
      word(0, 'RIFF'); view.setUint32(4, 36 + frames * 4, true); word(8, 'WAVE'); word(12, 'fmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
      view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true);
      view.setUint16(32, 4, true); view.setUint16(34, 16, true); word(36, 'data'); view.setUint32(40, frames * 4, true);
      const channels = [audio.getChannelData(0), audio.getChannelData(1)];
      let peak = 0, sum = 0; const sectionSums = [0, 0, 0, 0], sectionCounts = [0, 0, 0, 0];
      for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < 2; channel++) {
        const value = channels[channel][frame];
        if (!Number.isFinite(value)) throw Error('Non-finite audio sample');
        peak = Math.max(peak, Math.abs(value)); sum += value * value;
        const section = Math.min(3, Math.floor(frame * 4 / frames)); sectionSums[section] += value * value; sectionCounts[section]++;
        view.setInt16(44 + (frame * 2 + channel) * 2, Math.round(Math.max(-1, Math.min(1, value)) * 32767), true);
      }
      if (peak >= 0.98 || peak < 0.05) throw Error('Review audio level outside expected bounds: ' + peak);
      const rmsWindow = (start, end) => {
        let energy = 0, count = 0;
        for (let at = Math.max(0, Math.floor(start * sampleRate)); at < Math.min(frames, Math.floor(end * sampleRate)); at++)
          for (const channel of channels) { energy += channel[at] ** 2; count++; }
        return Math.sqrt(energy / Math.max(1, count));
      };
      const barSeconds = 240 / tune.bpm;
      const arrangement = tune.structure.map(part => ({ ...part, startSeconds: part.startBar * barSeconds, rms: rmsWindow(part.startBar * barSeconds + .03, (part.startBar + part.bars) * barSeconds - .03) }));
      const dropChecks = arrangement.filter(part => part.name.includes('drop')).map(part => {
        const before = rmsWindow(part.startSeconds - .30, part.startSeconds - .04), after = rmsWindow(part.startSeconds, part.startSeconds + 1.5);
        if (after < .045 || after < before * 4) throw Error('Drop lacks audible contrast: ' + id + ' ' + part.name);
        return { name: part.name, seconds: part.startSeconds, beforeRms: before, afterRms: after };
      });
      const bytes = new Uint8Array(wav), chunks = [];
      for (let start = 0; start < bytes.length; start += 32768) chunks.push(String.fromCharCode(...bytes.subarray(start, start + 32768)));
      return { base64: btoa(chunks.join('')), stats: { seconds, bpm: tune.bpm, bars: tune.bars, peak, rms: Math.sqrt(sum / (frames * 2)), sectionRms: sectionSums.map((s, i) => Math.sqrt(s / sectionCounts[i])), arrangement, dropChecks } };
    }, id);
    fs.writeFileSync(path.join(output, id + '.wav'), Buffer.from(rendered.base64, 'base64'));
    fs.writeFileSync(path.join(output, id + '.json'), JSON.stringify(rendered.stats, null, 2) + '\n');
    console.log(id, JSON.stringify(rendered.stats));
  }
} finally { await browser.close(); }
