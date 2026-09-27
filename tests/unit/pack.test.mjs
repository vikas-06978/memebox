// Step 4 – .memepack.json strict validation, and the built-in packs' content.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScript } from './helpers.mjs';

const G = loadScript(['defaults.js', 'lib/trim.js', 'lib/pack.js', 'packs.js']);
const { MemePack: P, MemeTrim, MEME_PACKS } = G;

const wavB64 = () => P.bytesToBase64(MemeTrim.floatToWav16(new Float32Array(800).fill(0.2), 8000));
const good = () => ({
  format: 'memebox-pack',
  version: 1,
  name: 'Test pack',
  lines: [
    { id: 'a1', kind: 'tts', text: 'Bruh.', lang: 'en', tone: 'villain', category: 'general' },
    { id: 'a2', kind: 'clip', text: 'Airhorn', lang: 'en', tone: 'normal', category: 'clips', clipId: 'c1', fav: 3, volume: 1.5, star: true },
  ],
  clips: [{ id: 'c1', name: 'airhorn.wav', type: 'audio/wav', data: wavB64() }],
});

test('a valid pack passes and decodes its clips', () => {
  const r = P.validate(good());
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.pack.lines.length, 2);
  assert.equal(r.pack.clips[0].bytes.byteLength, 44 + 1600);
  assert.equal(r.pack.lines[1].volume, 1.5);
});

test('build() output validates (round trip)', () => {
  const r = P.validate(good());
  const rebuilt = P.build('Again', r.pack.lines, r.pack.clips);
  const r2 = P.validate(JSON.parse(JSON.stringify(rebuilt)));
  assert.equal(r2.ok, true, JSON.stringify(r2.errors));
  assert.deepEqual(r2.pack.lines, r.pack.lines);
});

const bad = (mutate, expect) => {
  const p = good();
  mutate(p);
  const r = P.validate(p);
  assert.equal(r.ok, false, 'should be rejected');
  assert.ok(r.errors.some((e) => e.includes(expect)), `expected an error about "${expect}", got ${JSON.stringify(r.errors)}`);
};

test('rejects unknown fields at every level', () => {
  bad((p) => { p.evil = 1; }, 'evil: unknown field');
  bad((p) => { p.lines[0].script = '<x>'; }, 'lines[0].script: unknown field');
  bad((p) => { p.clips[0].url = 'https://x'; }, 'clips[0].url: unknown field');
});

test('rejects wrong format, version, names and lengths', () => {
  bad((p) => { p.format = 'meme-button'; }, 'format');
  bad((p) => { p.version = 2; }, 'version');
  bad((p) => { p.name = ''; }, 'name');
  bad((p) => { p.name = 'x'.repeat(61); }, 'name');
  bad((p) => { p.lines[0].text = 'x'.repeat(301); }, 'lines[0].text');
  bad((p) => { p.lines[0].text = '<script>'; }, 'lines[0].text');
  bad((p) => { p.lines = []; }, 'lines');
  bad((p) => { p.lines = Array.from({ length: 501 }, (_, i) => ({ ...p.lines[0], id: 'x' + i })); }, 'lines');
});

test('rejects bad field values', () => {
  bad((p) => { p.lines[0].lang = 'fr'; }, 'lines[0].lang');
  bad((p) => { p.lines[0].tone = 'loud'; }, 'lines[0].tone');
  bad((p) => { p.lines[0].kind = 'url'; }, 'lines[0].kind');
  bad((p) => { p.lines[0].fav = 10; }, 'lines[0].fav');
  bad((p) => { p.lines[0].volume = '1'; }, 'lines[0].volume');
  bad((p) => { p.lines[0].star = 'yes'; }, 'lines[0].star');
  bad((p) => { p.lines[0].id = '../x'; }, 'lines[0].id');
  bad((p) => { p.lines[1].id = 'a1'; }, 'duplicate');
  bad((p) => { p.lines[0].clipId = 'c1'; }, 'only for clip lines');
});

test('clip lines must reference a real, small WAV clip', () => {
  bad((p) => { p.lines[1].clipId = 'nope'; }, 'lines[1].clipId');
  bad((p) => { p.clips[0].type = 'audio/mpeg'; }, 'clips[0].type');
  bad((p) => { p.clips[0].data = 'not base64!!'; }, 'clips[0].data');
  bad((p) => { p.clips[0].data = btoa('hello world, not a wav file....'.padEnd(60, '.')); }, 'not a WAV');
  bad((p) => { p.clips[0].data = 'A'.repeat(1_500_000); }, 'bigger than 1 MB');
  bad((p) => { p.clips = Array.from({ length: 51 }, (_, i) => ({ ...p.clips[0], id: 'c' + i })); }, 'clips');
});

test('non-objects are rejected cleanly', () => {
  for (const x of [null, 42, 'pack', [], true]) assert.equal(P.validate(x).ok, false);
});

test('built-in packs: College, Cricket, Office, Party + general, all valid', () => {
  assert.deepEqual([...MEME_PACKS.ids], ['general', 'college', 'cricket', 'office', 'party']);
  const all = MEME_PACKS.all();
  assert.equal(new Set(all.map((l) => l.id)).size, all.length, 'unique ids');
  for (const id of MEME_PACKS.ids) {
    const lines = MEME_PACKS.lines(id);
    assert.ok(lines.length >= 8, `${id} has at least 8 lines`);
    for (const l of lines) {
      assert.deepEqual(G.MEME.sanitizeLine(l), l, `${l.id} is a clean line`);
      if (id !== 'general') assert.equal(l.category, id);
      if (l.lang === 'hi') assert.match(l.say || l.text, /[ऀ-ॿ]/, `${l.id} has a Devanagari pronunciation`);
    }
  }
  const langs = new Set(all.map((l) => l.lang));
  assert.ok(langs.has('hi') && langs.has('en'));
  // The whole library is exportable as a valid pack.
  const r = P.validate(JSON.parse(JSON.stringify(P.build('All', all, []))));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test('built-in packs stay friendly: no words about religion, caste, gender, looks, disability', () => {
  const banned = /\b(religions?|hindus?|muslims?|christians?|sikhs?|castes?|dalits?|gay|lesbians?|trans|girls?|boys?|women|woman|men|fat|ugly|black|white|dark|pagal|andha|langda|mota|kaala|kali)\b/i;
  for (const l of MEME_PACKS.all()) assert.doesNotMatch(`${l.text} ${l.say || ''}`, banned, l.id);
});
