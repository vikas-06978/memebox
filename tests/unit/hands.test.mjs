// What a hand is doing, from the 21 points of the hand model: open palm, thumbs up, peace, fist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScript } from './helpers.mjs';

const { handInfo } = loadScript('lib/hands.js').MemeHands;

// A hand pointing up: the wrist at the bottom, the knuckles above it, the fingers longer or curled.
function hand({ index = 1, middle = 1, ring = 1, pinky = 1, thumb = 'side' }) {
  const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8 }));
  lm[0] = { x: 0.5, y: 0.8 };
  const base = { 5: [0.44, 0.62], 9: [0.5, 0.6], 13: [0.56, 0.62], 17: [0.62, 0.66] };
  const fingers = { 5: index, 9: middle, 13: ring, 17: pinky };
  for (const [k, ext] of Object.entries(fingers)) {
    const i = Number(k), [x, y] = base[i];
    lm[i] = { x, y };
    lm[i + 1] = { x, y: y - 0.08 };                         // middle joint
    lm[i + 2] = { x, y: ext ? y - 0.16 : y - 0.02 };        // joint before the tip
    lm[i + 3] = { x, y: ext ? y - 0.24 : y + 0.0 };         // tip: far from the wrist when out, curled back when not
  }
  // thumb: base (1), 2, joint 3, tip 4
  if (thumb === 'side') { lm[1] = { x: 0.42, y: 0.74 }; lm[2] = { x: 0.36, y: 0.7 }; lm[3] = { x: 0.3, y: 0.66 }; lm[4] = { x: 0.25, y: 0.62 }; }
  else if (thumb === 'up') { lm[1] = { x: 0.43, y: 0.74 }; lm[2] = { x: 0.4, y: 0.66 }; lm[3] = { x: 0.39, y: 0.55 }; lm[4] = { x: 0.39, y: 0.44 }; }
  else { lm[1] = { x: 0.45, y: 0.74 }; lm[2] = { x: 0.47, y: 0.68 }; lm[3] = { x: 0.5, y: 0.66 }; lm[4] = { x: 0.52, y: 0.68 }; } // tucked in
  return lm;
}

test('an open hand has four fingers out and is "open"', () => {
  const h = handInfo(hand({}));
  assert.equal(h.n, 4);
  assert.equal(h.open, true);
  assert.equal(h.thumbUp, false);
  assert.ok(h.x > 0.4 && h.x < 0.6 && h.y > 0.5 && h.y < 0.9);
});

test('a fist is not open', () => {
  const h = handInfo(hand({ index: 0, middle: 0, ring: 0, pinky: 0, thumb: 'tucked' }));
  assert.equal(h.n, 0);
  assert.equal(h.open, false);
  assert.equal(h.thumbUp, false);
});

test('a thumb up with the fingers curled is a thumbs up', () => {
  const h = handInfo(hand({ index: 0, middle: 0, ring: 0, pinky: 0, thumb: 'up' }));
  assert.equal(h.thumbUp, true);
  assert.equal(h.open, false);
});

test('index and middle finger out, the others curled, is peace', () => {
  const h = handInfo(hand({ ring: 0, pinky: 0, thumb: 'tucked' }));
  assert.equal(h.peace, true);
  assert.equal(h.open, false);
  assert.equal(handInfo(hand({})).peace, false);
});
