// Lights & looks rules that do not need a browser: what is free, what falls back, what is locked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScript } from './helpers.mjs';

const fx = loadScript('lib/fx.js').MemeFx;
const free = (f) => false;
const all = () => true;

test('free people keep the still lamp: other fixtures and animations fall back, the lamp itself is free', () => {
  const c = fx.sanitize({ fixture: 'discoball', lampAnim: 'bounce' }, free);
  assert.equal(c.fixture, 'lamp');
  assert.equal(c.lampAnim, 'still');
  assert.equal(fx.sanitize({ fixture: 'lamp', lampAnim: 'still', color: 'blue', filter: 'bw' }, free).filter, 'bw');
});

test('with Pro every fixture and animation is kept; unknown values are cleaned', () => {
  for (const f of fx.FIXTURES) assert.equal(fx.sanitize({ fixture: f }, all).fixture, f);
  for (const a of fx.LAMP_ANIMS) assert.equal(fx.sanitize({ lampAnim: a }, all).lampAnim, a);
  assert.equal(fx.sanitize({ fixture: 'rocket', lampAnim: 'spin' }, all).fixture, 'lamp');
  assert.equal(fx.sanitize({ fixture: 'rocket', lampAnim: 'spin' }, all).lampAnim, 'still');
});

test('lockedParts names what a free person is only previewing', () => {
  assert.deepEqual([...fx.lockedParts({ fixture: 'star', lampAnim: 'sway', pattern: 'laser', corners: true, character: 'lion' }, free)].sort(),
    ['character', 'corners', 'fixture', 'lampAnim', 'pattern']);
  assert.deepEqual([...fx.lockedParts({ fixture: 'lamp' }, free)], []);
});

test('there are 8 things that hang, 8 animations, 13 corner shows, 20 filters (the ones in the price list)', () => {
  assert.equal(fx.FIXTURES.length, 8);
  assert.equal(fx.LAMP_ANIMS.length, 8);
  assert.equal(fx.PATTERNS.length, 13);
  assert.equal(fx.FILTERS.length, 21); // 20 + "none"
  assert.equal(fx.FREE_FILTERS.length, 4); // 3 + "none"
});
