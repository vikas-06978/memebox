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
  assert.deepEqual([...plan.FREE_LIMITS.packs], ['general', 'effects', 'college', 'world']);
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

test('time pass: works only while it is switched on and has seconds; Pro Max also has extra filters and characters', () => {
  const now = Date.UTC(2026, 9, 1);
  const plan = withConfig({ PRO_ENABLED: true });
  const lic = (o) => plan.setLicense({ key: 'MBX-AAAA-BBBB-CCCC', status: 'active', unlimited: false, checkedAt: now - 1000, ...o });

  lic({ proSeconds: 600 });
  assert.equal(plan.passTier(now), null, 'bought but not started');
  assert.equal(plan.canFx('lampAnim', now), false);

  plan.setPass({ on: true });
  assert.equal(plan.passTier(now), 'pro');
  assert.equal(plan.canFx('lampAnim', now), true);
  assert.equal(plan.can('voiceChanger', now), true);
  assert.equal(plan.canFx('filter:neon', now), false, 'Pro does not have the extra filters');
  assert.equal(plan.canFx('characters', now), false);
  assert.equal(plan.can('unlimitedClips', now), false, 'a pass does not lift the saved-items limits');
  assert.equal(plan.pictureLimit(now), 1);

  lic({ proSeconds: 600, maxSeconds: 60 });
  assert.equal(plan.passTier(now), 'max');
  assert.equal(plan.canFx('filter:neon', now), true);
  assert.equal(plan.canFx('characters', now), true);

  lic({ proSeconds: 0, maxSeconds: 0 });
  assert.equal(plan.passTier(now), null, 'used up');
  assert.equal(plan.canFx('lampAnim', now), false);

  lic({ proSeconds: 600 });
  plan.setPass({ on: false });
  assert.equal(plan.passTier(now), null, 'paused');
  assert.equal(plan.passLeft(), 600);
});

test('time pass: a permanent key still has everything, and a giant balance is capped', () => {
  const now = Date.UTC(2026, 9, 1);
  const plan = withConfig({ PRO_ENABLED: true });
  plan.setLicense({ key: 'MBX-AAAA-BBBB-CCCC', status: 'active', unlimited: true, checkedAt: now - 1000 });
  assert.equal(plan.canFx('characters', now), true);
  assert.equal(plan.canFx('filter:pixel', now), true);
  plan.setLicense({ key: 'MBX-AAAA-BBBB-CCCC', status: 'active', proSeconds: 1e12, checkedAt: now });
  assert.equal(plan.license.proSeconds, plan.PASS_MAX_SECONDS);
});

test('characters: Free has two, Pro six, Max fourteen; new exclusives require Max and old purchases remain valid', () => {
  const now = Date.UTC(2026, 9, 1);
  const plan = withConfig({ PRO_ENABLED: true });
  const fx = loadScript('lib/fx.js').MemeFx;
  assert.deepEqual([...plan.STANDARD_CHARACTERS], [...fx.STANDARD_CHARACTERS]);
  assert.deepEqual([...plan.FREE_CHARACTERS], [...fx.FREE_CHARACTERS]);
  assert.equal(fx.CHARACTERS.length, 14);
  assert.deepEqual([...fx.FREE_CHARACTERS], ['cat', 'dog']);
  assert.equal(fx.STANDARD_CHARACTERS.length, 6);
  assert.deepEqual(fx.PREMIUM_CHARACTERS.length, 8);
  const lic = (o) => plan.setLicense({ key: 'MBX-AAAA-BBBB-CCCC', status: 'active', unlimited: false, checkedAt: now - 1000, ...o });
  // nobody, no key at all: the two free ones only
  assert.equal(plan.canFx('character:cat', now), true);
  assert.equal(plan.canFx('character:dog', now), true);
  assert.equal(plan.canFx('character:bunny', now), false);
  plan.setPass({ on: true });
  lic({ proSeconds: 600 });
  for (const id of ['cat', 'dog', 'bunny', 'panda', 'owl', 'fox']) assert.equal(plan.canFx('character:' + id, now), true, id + ' with Pro');
  for (const id of ['penguin', 'lion', 'monkey', 'frog', 'unicorn', 'robot', 'snake', 'bird']) assert.equal(plan.canFx('character:' + id, now), false, id + ' needs Pro Max');
  lic({ maxSeconds: 600 });
  for (const id of fx.CHARACTERS) assert.equal(plan.canFx('character:' + id, now), true, id + ' with Pro Max');
  // bought for ever: works without any pass
  lic({ addons: [{ id: 'character:lion', until: 0 }] });
  assert.equal(plan.canFx('character:lion', now), true);
  assert.equal(plan.canFx('character:frog', now), false);
  const can = (f) => plan.canFx(f, now);
  assert.equal(fx.sanitize({ character: 'lion' }, can).character, 'lion');
  assert.equal(fx.sanitize({ character: 'frog' }, can).character, 'none');
  lic({ proSeconds: 600 });
  assert.equal(fx.sanitize({ character: 'fox' }, (f) => plan.canFx(f, now)).character, 'fox');
  assert.equal(fx.sanitize({ character: 'robot' }, (f) => plan.canFx(f, now)).character, 'none');
  assert.equal(fx.sanitize({ character: 'cat', charPos: 'left' }, (f) => plan.canFx(f, now)).charPos, 'left');
  assert.equal(fx.sanitize({ character: 'dragon' }).character, 'none');
  lic({ addons: [{ id: 'character:snake', until: 0 }, { id: 'character:bird', until: 0 }] });
  assert.equal(plan.canFx('character:snake', now), false);
  assert.equal(plan.canFx('character:bird', now), false);
  lic({ addons: [{ id: 'character:unicorn', until: 0 }] });
  assert.equal(plan.canFx('character:unicorn', now), true, 'preserve an existing purchase');
});

test('music: Chill and Funky are free, the other tunes need Pro (a pass or a key); the lists match the engine', () => {
  const now = Date.UTC(2026, 9, 1);
  const plan = withConfig({ PRO_ENABLED: true });
  const music = loadScript('lib/music.js', { setInterval() {}, clearInterval() {} }).MemeMusic;
  assert.deepEqual([...plan.FREE_TUNES], [...music.FREE_TUNES]);
  assert.equal(music.IDS.length, 13);
  assert.equal(plan.canFx('music:chill', now), true);
  assert.equal(plan.canFx('music:party', now), false);
  plan.setLicense({ key: 'MBX-AAAA-BBBB-CCCC', status: 'active', proSeconds: 60, checkedAt: now - 1000 });
  plan.setPass({ on: true });
  assert.equal(plan.canFx('music:party', now), true);
});
