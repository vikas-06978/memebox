// Step 3 – every UI string exists in English and Hindi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EXT } from './helpers.mjs';

const load = (lang) => JSON.parse(fs.readFileSync(path.join(EXT, '_locales', lang, 'messages.json'), 'utf8'));
const en = load('en');
const hi = load('hi');
const read = (f) => fs.readFileSync(path.join(EXT, f), 'utf8');
const jsFiles = fs.readdirSync(EXT).filter((f) => f.endsWith('.js'));
const htmlFiles = fs.readdirSync(EXT).filter((f) => f.endsWith('.html'));

test('English and Hindi have exactly the same message keys', () => {
  assert.deepEqual(Object.keys(hi).sort(), Object.keys(en).sort());
});

test('no empty messages, and $1…$9 substitutions match between languages', () => {
  for (const [k, v] of Object.entries(en)) {
    assert.ok(v.message && v.message.trim(), `en ${k} empty`);
    assert.ok(hi[k].message && hi[k].message.trim(), `hi ${k} empty`);
    const subs = (s) => [...s.matchAll(/\$(\d)/g)].map((m) => m[1]).sort().join();
    assert.equal(subs(hi[k].message), subs(en[k].message), `placeholders differ in ${k}`);
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

test('dynamic keys (status, categories) exist', () => {
  for (const s of ['none', 'suspended', 'muted', 'live']) assert.ok(en['st_' + s], `st_${s}`);
  for (const c of ['general', 'college', 'cricket', 'office', 'party', 'clips', 'mine']) assert.ok(en['cat_' + c], `cat_${c}`);
});

test('every data-i18n key in HTML pages exists', () => {
  for (const f of htmlFiles) {
    for (const [, key] of read(f).matchAll(/data-i18n(?:-[a-z-]+)?="([a-zA-Z0-9_]+)"/g)) assert.ok(en[key], `${f}: missing "${key}"`);
  }
});

test('manifest __MSG_ keys exist and the name fits the store limits', () => {
  const manifest = read('manifest.json');
  for (const [, key] of manifest.matchAll(/__MSG_(\w+)__/g)) assert.ok(en[key] && hi[key], `manifest: missing "${key}"`);
  for (const lang of [en, hi]) {
    assert.ok(lang.extName.message.length <= 75, 'name ≤ 75 chars');
    assert.ok(lang.extShortName.message.length <= 12, 'short name ≤ 12 chars');
    assert.ok(lang.extDesc.message.length <= 132, 'description ≤ 132 chars');
  }
});
