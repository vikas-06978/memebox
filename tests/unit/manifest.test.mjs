import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EXT, readJson } from './helpers.mjs';

const m = readJson('manifest.json');
const CALL_SITES = [
  'https://meet.google.com/*',
  'https://app.zoom.us/wc/*',
  'https://teams.microsoft.com/*',
  'https://teams.live.com/*',
  'https://discord.com/*',
];

test('Manifest V3 with the MemeBox name (no platform brand in the name)', () => {
  assert.equal(m.manifest_version, 3);
  assert.equal(m.default_locale, 'en');
  for (const lang of ['en', 'hi']) {
    const msgs = readJson(`_locales/${lang}/messages.json`);
    const name = m.name.replace(/^__MSG_(\w+)__$/, (_, k) => msgs[k].message);
    assert.match(name, /^MemeBox/);
    assert.ok(name.length <= 75);
    assert.doesNotMatch(name, /google|meet|zoom|teams|microsoft|discord/i);
  }
});

test('at most 4 shortcuts have suggested keys (Chrome limit), all Alt-based', () => {
  const suggested = Object.values(m.commands).filter((c) => c.suggested_key);
  assert.ok(suggested.length <= 4);
  for (const c of suggested) assert.match(c.suggested_key.default, /^Alt\+[0-9A-Z]$/);
});

test('mic-hook runs in the MAIN world at document_start in all frames on the 5 call sites', () => {
  const hook = m.content_scripts.find((c) => c.js.includes('mic-hook.js'));
  assert.ok(hook, 'mic-hook.js is a content script');
  assert.equal(hook.world, 'MAIN');
  assert.equal(hook.run_at, 'document_start');
  assert.equal(hook.all_frames, true);
  assert.deepEqual([...hook.matches].sort(), [...CALL_SITES].sort());
});

test('bridge runs in the ISOLATED world on the same sites', () => {
  const bridge = m.content_scripts.find((c) => c.js.includes('bridge.js'));
  assert.ok(bridge);
  assert.ok(!bridge.world || bridge.world === 'ISOLATED');
  assert.deepEqual([...bridge.matches].sort(), [...CALL_SITES].sort());
});

test('no <all_urls>, only the expected permissions, wasm-only CSP', () => {
  assert.ok(!JSON.stringify(m).includes('<all_urls>'));
  for (const p of m.permissions) assert.ok(['storage', 'offscreen', 'tabCapture'].includes(p), `unexpected permission ${p}`);
  assert.equal(m.content_security_policy.extension_pages, "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'");
});

test('every file the manifest references exists', () => {
  const files = [
    m.background.service_worker,
    ...Object.values(m.icons),
    m.options_ui.page,
    m.action.default_popup,
    ...m.content_scripts.flatMap((c) => c.js),
  ];
  for (const f of files) assert.ok(fs.existsSync(path.join(EXT, f)), `${f} exists`);
});

test('meme audio never goes to speaker-only APIs in the call page scripts', () => {
  for (const f of ['mic-hook.js', 'bridge.js', 'ui.js']) {
    const src = fs.readFileSync(path.join(EXT, f), 'utf8');
    assert.doesNotMatch(src, /speechSynthesis|new Audio\(|createElement\(['"]audio/, `${f} uses no speaker-only audio`);
  }
  // In mic-hook, ctx.destination is only used by the optional monitor.
  const hook = fs.readFileSync(path.join(EXT, 'mic-hook.js'), 'utf8');
  const uses = hook.split('\n').filter((l) => /ctx\.destination/.test(l) && !l.trim().startsWith('//'));
  assert.equal(uses.length, 1, 'exactly one ctx.destination use');
  assert.match(uses[0], /monitor/);
});

test('page <-> extension messages use unique, checked sources', () => {
  const hook = fs.readFileSync(path.join(EXT, 'mic-hook.js'), 'utf8');
  const bridge = fs.readFileSync(path.join(EXT, 'bridge.js'), 'utf8');
  for (const src of [hook, bridge]) {
    assert.match(src, /memebox-hook-9c1e/);
    assert.match(src, /memebox-bridge-9c1e/);
    assert.match(src, /e\.source !== window/);
  }
});
