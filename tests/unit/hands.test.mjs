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

const { twoHandHeart, headPose } = loadScript('lib/hands.js').MemeHands;
const touching = (lm) => { lm[8] = { x: 0.45, y: 0.6 }; lm[4] = { x: 0.46, y: 0.61 }; return lm; };

test('thumb and index touching with the other three fingers out is OK', () => {
  const h = handInfo(touching(hand({ index: 0, thumb: 'tucked' })));
  assert.equal(h.ok, true);
  assert.equal(h.fingerHeart, false);
});

test('thumb and index touching with the other fingers curled is a finger heart', () => {
  const h = handInfo(touching(hand({ index: 0, middle: 0, ring: 0, pinky: 0, thumb: 'tucked' })));
  assert.equal(h.fingerHeart, true);
  assert.equal(h.ok, false);
});

test('index and little finger out, middle and ring curled, is rock', () => {
  const h = handInfo(hand({ middle: 0, ring: 0, thumb: 'tucked' }));
  assert.equal(h.rock, true);
  assert.equal(h.peace, false);
  assert.equal(handInfo(hand({})).rock, false);
});

test('two hands with the index tips together at the top and the thumb tips together at the bottom make a heart', () => {
  const a = { s: 0.2, t8: { x: 0.46, y: 0.4 }, t4: { x: 0.48, y: 0.6 } }, b = { s: 0.2, t8: { x: 0.54, y: 0.4 }, t4: { x: 0.52, y: 0.6 } };
  assert.equal(twoHandHeart([a, b]), true);
  assert.equal(twoHandHeart([a]), false);
  assert.equal(twoHandHeart([a, { ...b, t8: { x: 0.9, y: 0.4 } }]), false, 'index tips far apart');
  assert.equal(twoHandHeart([a, { ...b, t4: { x: 0.52, y: 0.4 } }]), false, 'thumbs at the same height as the index tips');
});

test('the head pose: 0 when straight, yaw follows the nose left and right, pitch up and down', () => {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  lm[234] = { x: 0.4, y: 0.5 }; lm[454] = { x: 0.6, y: 0.5 }; lm[10] = { x: 0.5, y: 0.3 }; lm[152] = { x: 0.5, y: 0.7 };
  lm[1] = { x: 0.5, y: 0.5 };
  const straight = headPose(lm);
  assert.ok(Math.abs(straight.yaw) < 0.01 && Math.abs(straight.pitch) < 0.01);
  lm[1] = { x: 0.56, y: 0.5 };
  assert.ok(headPose(lm).yaw > 0.2);
  lm[1] = { x: 0.5, y: 0.56 };
  assert.ok(headPose(lm).pitch > 0.1);
  assert.equal(headPose([]), null);
});
