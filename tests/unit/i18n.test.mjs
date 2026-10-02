// Every UI string exists in all 12 extension languages, and the website's translations match.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EXT, ROOT } from './helpers.mjs';

const LOCALES = fs.readdirSync(path.join(EXT, '_locales'));
const load = (lang) => JSON.parse(fs.readFileSync(path.join(EXT, '_locales', lang, 'messages.json'), 'utf8'));
const all = Object.fromEntries(LOCALES.map((l) => [l, load(l)]));
const en = all.en;
const read = (f) => fs.readFileSync(path.join(EXT, f), 'utf8');
const jsFiles = fs.readdirSync(EXT).filter((f) => f.endsWith('.js'));
const htmlFiles = fs.readdirSync(EXT).filter((f) => f.endsWith('.html'));
const subs = (s) => [...String(s).matchAll(/\$(\d)/g)].map((m) => m[1]).sort().join();

test('the extension ships 12 languages', () => {
  assert.deepEqual(LOCALES.sort(), ['ar', 'bn', 'en', 'es', 'fr', 'gu', 'hi', 'id', 'mr', 'pt_BR', 'ta', 'te']);
});

test('every language has exactly the English keys, none empty, same $1…$9 placeholders', () => {
  for (const [lang, msgs] of Object.entries(all)) {
    assert.deepEqual(Object.keys(msgs).sort(), Object.keys(en).sort(), `${lang} keys`);
    for (const [k, v] of Object.entries(en)) {
      assert.ok(msgs[k].message && msgs[k].message.trim(), `${lang} ${k} empty`);
      assert.equal(subs(msgs[k].message), subs(v.message), `${lang}: placeholders differ in ${k}`);
    }
  }
});

test('each language states its own direction and code (Arabic right to left, the rest left to right)', () => {
  for (const [lang, msgs] of Object.entries(all)) {
    assert.equal(msgs.text_dir.message, lang === 'ar' ? 'rtl' : 'ltr', `${lang} text_dir`);
    assert.equal(msgs.lang_code.message, lang.replace('_', '-'), `${lang} lang_code`);
  }
});

test('every t("key") used in scripts exists', () => {
  for (const f of jsFiles) {
    for (const [, key] of read(f).matchAll(/\bt\('([a-z0-9_]+)'/g)) {
      if (key.endsWith('_')) continue; // dynamic prefix, checked below
      assert.ok(en[key], `${f}: missing message "${key}"`);
    }
  }
});

test('dynamic keys (status, categories, voices, themes) exist', () => {
  for (const s of ['none', 'suspended', 'muted', 'live']) assert.ok(en['st_' + s], `st_${s}`);
  for (const c of ['general', 'college', 'cricket', 'office', 'party', 'clips', 'mine']) assert.ok(en['cat_' + c], `cat_${c}`);
  for (const v of ['off', 'chipmunk', 'deep', 'robot', 'echo', 'radio']) assert.ok(en['voice_' + v], `voice_${v}`);
  for (const th of ['auto', 'light', 'dark', 'sunny', 'neon', 'candy']) assert.ok(en['theme_' + th], `theme_${th}`);
});

test('every data-i18n key in HTML pages exists', () => {
  for (const f of htmlFiles) {
    for (const [, key] of read(f).matchAll(/data-i18n(?:-[a-z-]+)?="([a-zA-Z0-9_]+)"/g)) assert.ok(en[key], `${f}: missing "${key}"`);
  }
});

test('manifest __MSG_ keys exist; name and description fit the store limits in every language', () => {
  const manifest = read('manifest.json');
  for (const [lang, msgs] of Object.entries(all)) {
    for (const [, key] of manifest.matchAll(/__MSG_(\w+)__/g)) assert.ok(msgs[key], `${lang} manifest: missing "${key}"`);
    assert.ok(msgs.extName.message.length <= 75, `${lang} name ≤ 75`);
    assert.ok(msgs.extShortName.message.length <= 12, `${lang} short name ≤ 12`);
    assert.ok(msgs.extDesc.message.length <= 132, `${lang} description ≤ 132 (${msgs.extDesc.message.length})`);
    assert.doesNotMatch(msgs.extName.message, /google|meet|zoom|teams|microsoft|discord/i, `${lang} name has no brands`);
  }
});

// ---------- website ----------

const SITE = path.join(ROOT, 'site', 'public');
const I18N = path.join(SITE, 'assets', 'i18n');
const siteLangs = fs.readdirSync(I18N).map((f) => f.replace('.json', ''));
const siteDict = (l) => JSON.parse(fs.readFileSync(path.join(I18N, l + '.json'), 'utf8'));
const siteEn = siteDict('en');

test('the website ships the same 12 languages, all with exactly the English keys', () => {
  assert.deepEqual(siteLangs.sort(), ['ar', 'bn', 'en', 'es', 'fr', 'gu', 'hi', 'id', 'mr', 'pt', 'ta', 'te']);
  for (const l of siteLangs) {
    const d = siteDict(l);
    assert.deepEqual(Object.keys(d).sort(), Object.keys(siteEn).sort(), `${l} keys`);
    for (const [k, v] of Object.entries(siteEn)) {
      assert.ok(String(d[k]).trim(), `${l} ${k} empty`);
      assert.equal(subs(d[k]), subs(v), `${l}: placeholders differ in ${k}`);
    }
  }
});

test('prefs.js offers exactly the shipped website languages', () => {
  const prefs = fs.readFileSync(path.join(SITE, 'assets', 'prefs.js'), 'utf8');
  const block = /const LANGS = \{([\s\S]*?)\};/.exec(prefs)[1];
  const codes = [...block.matchAll(/(\w+):/g)].map((m) => m[1]);
  assert.deepEqual(codes.sort(), [...siteLangs].sort());
});

test('every data-t key on the site exists, and the English in the HTML matches en.json', () => {
  const norm = (s) => s.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  for (const f of fs.readdirSync(SITE).filter((x) => x.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(SITE, f), 'utf8');
    for (const [, key, text] of html.matchAll(/data-t="([a-z0-9_]+)"[^>]*>([^<]*)</g)) {
      assert.ok(key in siteEn, `${f}: missing "${key}"`);
      assert.equal(norm(text), norm(siteEn[key]), `${f}: text of "${key}" differs from en.json`);
    }
  }
});

test('keys the site scripts ask for exist', () => {
  for (const f of ['form.js', 'buy.js', 'demo.js', 'prefs.js']) {
    const src = fs.readFileSync(path.join(SITE, 'assets', f), 'utf8');
    for (const [, key] of src.matchAll(/\bT?t\('([a-z0-9_]+)'/g)) {
      if (key.endsWith('_') || key === 'key') continue; // dynamic prefix, or the usage example in a comment
      assert.ok(key in siteEn, `${f}: missing "${key}"`);
    }
  }
  for (const p of ['pro', 'pictures5']) assert.ok(siteEn['buy_name_' + p]);
  for (const th of ['auto', 'light', 'dark', 'sunny', 'neon', 'candy']) assert.ok(siteEn['theme_' + th]);
});
