// Pro is switched on in the shipped config. Without PRO_ENABLED, everyone gets everything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EXT, loadScript, readJson } from './helpers.mjs';

const withConfig = (config) => loadScript('lib/plan.js', { MEMEBOX_CONFIG: config }).MemePlan;

test('the shipped config has Pro switched on: without a key, Pro features are locked', () => {
  const { MEMEBOX_CONFIG } = loadScript('config.js');
  assert.equal(MEMEBOX_CONFIG.PRO_ENABLED, true);
  const plan = loadScript(['config.js', 'lib/plan.js']).MemePlan;
  assert.equal(plan.isPro(), false);
  for (const f of Object.keys(plan.PRO_FEATURES)) assert.equal(plan.can(f), false, f);
});

test('the Pro features: the first five plus bulk import and picture memes (1.1.0)', () => {
  assert.deepEqual(Object.keys(withConfig({}).PRO_FEATURES).sort(),
    ['allPacks', 'bulkImport', 'captions', 'partyMode', 'pictures', 'unlimitedClips', 'voiceChanger']);
});

test('picture limit: unlimited while Pro is off; 1 free, plus bought slots, when Pro is on', () => {
  const now = Date.UTC(2026, 9, 1);
  assert.equal(withConfig({ PRO_ENABLED: false }).pictureLimit(now), Infinity);
  const plan = withConfig({ PRO_ENABLED: true });
  assert.equal(plan.pictureLimit(now), 1);
  plan.setLicense({ key: 'MBX-AAAA-BBBB-CCCC', status: 'active', unlimited: false, pictureSlots: 5, checkedAt: now - 1000 });
  assert.equal(plan.pictureLimit(now), 6);
  assert.equal(plan.isPro(now), false);
  assert.equal(plan.can('voiceChanger', now), false);
});

test('an unlimited license unlocks everything; a turned-off or long-unchecked one does not', () => {
  const now = Date.UTC(2026, 9, 1);
  const plan = withConfig({ PRO_ENABLED: true });
  plan.setLicense({ key: 'MBX-AAAA-BBBB-CCCC', status: 'active', unlimited: true, checkedAt: now - 3600000 });
  assert.equal(plan.isPro(now), true);
  for (const f of Object.keys(plan.PRO_FEATURES)) assert.equal(plan.can(f, now), true, f);
  assert.equal(plan.pictureLimit(now), Infinity);

  plan.setLicense({ key: 'MBX-AAAA-BBBB-CCCC', status: 'revoked', unlimited: true, checkedAt: now });
  assert.equal(plan.isPro(now), false);

  plan.setLicense({ key: 'MBX-AAAA-BBBB-CCCC', status: 'active', unlimited: true, checkedAt: now - plan.LICENSE_MAX_AGE_MS - 1 });
  assert.equal(plan.isPro(now), false, 'not confirmed for over 30 days');

  plan.setLicense({ key: 'MBX-AAAA-BBBB-CCCC', status: 'active', unlimited: true, checkedAt: now + 3600000 });
  assert.equal(plan.isPro(now), false, 'a check time in the future is not trusted');

  plan.setLicense({ status: 'active', unlimited: true });
  assert.equal(plan.license, null, 'no key, no license');
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
