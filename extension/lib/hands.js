// MemeBox: what a hand is doing, from the 21 points of the hand model (used by the offscreen document and the tests).
// And which way a head is turned, from the points of the face model.
(() => {
  'use strict';
  // One raised hand: where it is, how many fingers are out, and the shapes we know.
  function handInfo(lm) {
    const d = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
    const out = (tip, mid) => d(tip, 0) > d(mid, 0) * 1.12; // a finger is out when its tip is farther from the wrist than its middle joint
    const f = [out(8, 6), out(12, 10), out(16, 14), out(20, 18)]; // index, middle, ring, pinky
    const n = f.filter(Boolean).length, size = d(0, 9) || 0.001;
    const thumbOut = d(4, 17) > d(3, 17) * 1.12 && d(4, 9) > d(2, 9) * 0.95;
    const x = (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5, y = (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5;
    const touch = d(4, 8) < size * 0.42; // thumb tip and index tip together
    const others = f[1] + f[2] + f[3];
    return {
      x, y, s: size, n,
      open: n >= 4,                                                              // an open hand (a wave, a high five, stop)
      thumbUp: thumbOut && n === 0 && lm[4].y < lm[3].y - 0.01 && lm[4].y < lm[0].y - size * 0.5,
      peace: f[0] && f[1] && !f[2] && !f[3],
      ok: touch && others >= 2,                                                  // thumb and index make a ring, the rest are out
      fingerHeart: touch && others === 0,                                        // thumb and index crossed, the rest curled (a small heart)
      rock: f[0] && f[3] && !f[1] && !f[2],                                      // index and little finger out
      callMe: thumbOut && f[3] && !f[0] && !f[1] && !f[2],                       // thumb and little finger out
      t4: { x: lm[4].x, y: lm[4].y }, t8: { x: lm[8].x, y: lm[8].y },           // thumb tip and index tip (for the heart made with two hands)
    };
  }

  // Two hands making a heart: the index fingertips meet at the top and the thumb tips meet at the bottom.
  function twoHandHeart(hands) {
    if (!hands || hands.length < 2) return false;
    const [a, b] = hands, s = (a.s + b.s) / 2;
    const dd = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
    const tops = dd(a.t8, b.t8) < s * 0.7, bottoms = dd(a.t4, b.t4) < s * 0.7;
    const upper = (a.t8.y + b.t8.y) / 2, lower = (a.t4.y + b.t4.y) / 2;
    return tops && bottoms && lower - upper > s * 0.35 && lower - upper < s * 2.2;
  }

  // Which way the head points, as numbers around 0 (yaw: left/right, pitch: up/down), from the nose against the cheeks, forehead and chin.
  function headPose(lm) {
    if (!lm || lm.length < 455) return null;
    const nose = lm[1], l = lm[234], r = lm[454], top = lm[10], chin = lm[152];
    const w = r.x - l.x, h = chin.y - top.y;
    if (w < 0.01 || h < 0.01) return null;
    return { yaw: (nose.x - (l.x + r.x) / 2) / w, pitch: (nose.y - (top.y + chin.y) / 2) / h };
  }

  globalThis.MemeHands = Object.freeze({ handInfo, twoHandHeart, headPose });
})();
