// MemeBox: what a hand is doing, from the 21 points of the hand model (used by the offscreen document and the tests).
(() => {
  'use strict';
  // One raised hand: where it is, how many fingers are out, and a few shapes.
  function handInfo(lm) {
    const d = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
    const out = (tip, mid) => d(tip, 0) > d(mid, 0) * 1.12; // a finger is out when its tip is farther from the wrist than its middle joint
    const f = [out(8, 6), out(12, 10), out(16, 14), out(20, 18)];
    const n = f.filter(Boolean).length, size = d(0, 9);
    const thumbOut = d(4, 17) > d(3, 17) * 1.12 && d(4, 9) > d(2, 9) * 0.95;
    const x = (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5, y = (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5;
    return {
      x, y, s: size, n,
      open: n >= 4,                                                              // an open hand (a wave, a high five)
      thumbUp: thumbOut && n === 0 && lm[4].y < lm[3].y - 0.01 && lm[4].y < lm[0].y - size * 0.5,
      peace: f[0] && f[1] && !f[2] && !f[3],
    };
  }

  globalThis.MemeHands = Object.freeze({ handInfo });
})();
