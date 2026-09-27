import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScript } from './helpers.mjs';

const { MEME } = loadScript('defaults.js');

test('all six tones exist with eSpeak values in range', () => {
  assert.deepEqual(Object.keys(MEME.TONES).sort(), ['chipmunk', 'excited', 'normal', 'robot', 'slowmo', 'villain']);
  for (const [id, t] of Object.entries(MEME.TONES)) {
    assert.ok(t.label && t.emoji, `${id} has a label and emoji`);
    assert.ok(t.espeak.rate >= 80 && t.espeak.rate <= 450, `${id} rate`);
    for (const k of ['pitch', 'range']) assert.ok(t.espeak[k] >= 0 && t.espeak[k] <= 99, `${id} ${k}`);
    assert.ok(t.espeak.volume > 0 && t.espeak.volume <= 200, `${id} volume`);
    assert.ok(t.playbackRate >= 0.25 && t.playbackRate <= 4, `${id} playbackRate`);
    assert.ok(t.gain > 0 && t.gain <= 3, `${id} gain`);
  }
});

test('tone presets have the intended character', () => {
  const T = MEME.TONES;
  assert.ok(T.chipmunk.espeak.pitch > T.normal.espeak.pitch && T.chipmunk.playbackRate > 1, 'chipmunk is high + fast');
  assert.ok(T.villain.espeak.pitch < T.normal.espeak.pitch && T.villain.playbackRate < 1, 'villain is low + slow');
  assert.equal(T.robot.espeak.range, 0, 'robot is monotone');
  assert.ok(T.slowmo.espeak.rate < T.villain.espeak.rate && T.slowmo.playbackRate < 1, 'slow-mo is very slow');
  assert.ok(T.excited.gain > 1 && T.excited.espeak.rate > T.normal.espeak.rate, 'excited is loud + fast');
});

test('default pack is valid and uses unique ids and favourite slots', () => {
  const lines = MEME.defaultLines();
  assert.ok(lines.length >= 14);
  assert.equal(new Set(lines.map((l) => l.id)).size, lines.length);
  const favs = lines.map((l) => l.fav).filter(Boolean);
  assert.equal(new Set(favs).size, favs.length, 'each Alt+N slot used once');
  for (const l of lines) assert.deepEqual(MEME.sanitizeLine(l), l, `${l.id} survives sanitizing unchanged`);
});

test('sanitizeLine rejects junk and clamps fields', () => {
  assert.equal(MEME.sanitizeLine(null), null);
  assert.equal(MEME.sanitizeLine({ text: '   ' }), null);
  const l = MEME.sanitizeLine({ text: 'x'.repeat(999), lang: 'fr', tone: 'nope', fav: 42, evil: '<script>' });
  assert.equal(l.text.length, 300);
  assert.equal(l.lang, 'en');
  assert.equal(l.tone, 'normal');
  assert.equal(l.fav, 0);
  assert.ok(!('evil' in l));
});

test('link lines only accept http(s) and flag video pages', () => {
  assert.equal(MEME.sanitizeLine({ kind: 'url', text: 'a', url: 'javascript:alert(1)' }), null);
  assert.equal(MEME.sanitizeLine({ kind: 'url', text: 'a', url: 'https://x.test/a.mp3#t' }).url, 'https://x.test/a.mp3');
  assert.ok(MEME.isVideoPage('https://www.youtube.com/watch?v=1'));
  assert.ok(MEME.isVideoPage('https://youtu.be/1'));
  assert.ok(MEME.isVideoPage('https://www.instagram.com/reel/1'));
  assert.ok(!MEME.isVideoPage('https://www.myinstants.com/media/sounds/a.mp3'));
});
