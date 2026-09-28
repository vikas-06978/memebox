// Step 7: Pro is prepared but switched off. Everyone gets everything while PRO_ENABLED is false.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EXT, loadScript, readJson } from './helpers.mjs';

const withConfig = (config) => loadScript('lib/plan.js', { MEMEBOX_CONFIG: config }).MemePlan;

test('the shipped config has Pro switched off', () => {
  const { MEMEBOX_CONFIG } = loadScript('config.js');
  assert.equal(MEMEBOX_CONFIG.PRO_ENABLED, false);
  const plan = loadScript(['config.js', 'lib/plan.js']).MemePlan;
  assert.equal(plan.isPro(), true);
  for (const f of Object.keys(plan.PRO_FEATURES)) assert.equal(plan.can(f), true, f);
});

test('the Pro features are exactly the five from the plan', () => {
  assert.deepEqual(Object.keys(withConfig({}).PRO_FEATURES).sort(),
    ['allPacks', 'captions', 'partyMode', 'unlimitedClips', 'voiceChanger']);
});

test('with PRO_ENABLED but no license yet, only Pro features lock', () => {
  const plan = withConfig({ PRO_ENABLED: true });
  assert.equal(plan.isPro(), false);
  for (const f of Object.keys(plan.PRO_FEATURES)) assert.equal(plan.can(f), false, f);
  assert.equal(plan.can('soundboard'), true);
  assert.equal(plan.FREE_LIMITS.clips, 10);
  assert.deepEqual([...plan.FREE_LIMITS.packs], ['general', 'college']);
});

test('only an explicit true turns Pro on', () => {
  for (const v of [undefined, 'true', 1, null]) assert.equal(withConfig({ PRO_ENABLED: v }).isPro(), true, String(v));
});

test('every gate in the code names a real Pro feature and is marked "PRO:"', () => {
  const known = Object.keys(withConfig({}).PRO_FEATURES);
  const used = new Set();
  for (const f of ['ui.js', 'options.js', 'bridge.js']) {
    const lines = fs.readFileSync(path.join(EXT, f), 'utf8').split('\n');
    lines.forEach((line, i) => {
      const m = /\.can\('([A-Za-z]+)'\)/.exec(line);
      if (!m) return;
      assert.ok(known.includes(m[1]), `${f}:${i + 1}: unknown feature ${m[1]}`);
      assert.ok(/\/\/ PRO: /.test(line) || /\/\/ PRO: /.test(lines[i - 1] || ''), `${f}:${i + 1}: gate is marked with "// PRO:"`);
      used.add(m[1]);
    });
  }
  assert.deepEqual([...used].sort(), [...known].sort(), 'every Pro feature has a gate');
});

test('plan.js loads before the scripts that use it', () => {
  const m = readJson('manifest.json');
  const ui = m.content_scripts.find((c) => c.js.includes('ui.js')).js;
  assert.ok(ui.indexOf('config.js') < ui.indexOf('lib/plan.js'));
  assert.ok(ui.indexOf('lib/plan.js') < ui.indexOf('bridge.js'));
  const html = fs.readFileSync(path.join(EXT, 'options.html'), 'utf8');
  assert.ok(html.indexOf('config.js') < html.indexOf('lib/plan.js'));
  assert.ok(html.indexOf('lib/plan.js') < html.indexOf('options.js'));
});
