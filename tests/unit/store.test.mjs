// Step 8: store readiness. Listing text, permissions, images and the website pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, EXT, readJson } from './helpers.mjs';

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const store = read('STORE.md');
const manifest = readJson('manifest.json');
const en = readJson('_locales/en/messages.json');
const CALL_SITES = ['https://meet.google.com/*', 'https://app.zoom.us/wc/*', 'https://teams.microsoft.com/*', 'https://teams.live.com/*', 'https://discord.com/*'];

test('the short description in STORE.md is the manifest description and fits 132 characters', () => {
  const m = /## Short description[^\n]*\n\n> (.+)\n/.exec(store);
  assert.ok(m, 'short description block');
  assert.equal(m[1], en.extDesc.message);
  assert.ok(m[1].length <= 132, `${m[1].length} characters`);
  assert.equal(manifest.description, '__MSG_extDesc__');
});

test('the full description has the search keywords', () => {
  const full = store.split('## Full description')[1].split('\n## ')[0].toLowerCase();
  for (const k of ['soundboard', 'meme sounds', 'voice changer', 'sound effects', 'google meet, zoom, teams, discord']) {
    assert.ok(full.includes(k), `missing keyword "${k}"`);
  }
});

test('permissions are exactly storage, offscreen, tabCapture and the 5 call sites', () => {
  assert.deepEqual([...manifest.permissions].sort(), ['offscreen', 'storage', 'tabCapture']);
  assert.deepEqual([...manifest.host_permissions].sort(), [...CALL_SITES].sort());
  assert.equal(manifest.optional_permissions, undefined);
  assert.equal(manifest.optional_host_permissions, undefined);
  assert.ok(!JSON.stringify(manifest).includes('<all_urls>'));
});

test('every permission has a justification in STORE.md', () => {
  const just = store.split('## Permission justifications')[1].split('\n## ')[0];
  for (const p of manifest.permissions) assert.ok(just.includes(`**${p}**`), `justification for ${p}`);
  for (const h of CALL_SITES) assert.ok(just.includes(h.replace('*', '\\*')), `host ${h} listed`);
  assert.match(just, /\*\*Remote code\*\*\nNo\./);
});

test('no analytics or remote code in the extension', () => {
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!['vendor', 'dist'].includes(e.name)) walk(p); } else if (/\.(js|html)$/.test(e.name)) files.push(p);
  } };
  walk(EXT);
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /google-analytics|googletagmanager|gtag\(|mixpanel|segment\.io|sentry/i, f);
    assert.doesNotMatch(src, /<script[^>]+src=["']https?:/i, `${f} loads a remote script`);
    assert.doesNotMatch(src, /\beval\(|new Function\(/, `${f} evaluates code`);
  }
});

test('the name and icon carry no platform brands', () => {
  for (const lang of ['en', 'hi']) {
    const name = readJson(`_locales/${lang}/messages.json`).extName.message;
    assert.doesNotMatch(name, /google|meet|zoom|teams|microsoft|discord/i);
  }
});

function pngSize(file) {
  const b = fs.readFileSync(file);
  assert.equal(b.toString('latin1', 1, 4), 'PNG', `${file} is a PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

test('icons and store images have the sizes the stores want', () => {
  for (const s of [16, 32, 48, 128]) assert.deepEqual(pngSize(path.join(EXT, 'icons', `icon${s}.png`)), [s, s]);
  for (const f of ['screenshot-1-call', 'screenshot-2-options', 'screenshot-3-welcome', 'screenshot-4-tab-audio']) {
    assert.deepEqual(pngSize(path.join(ROOT, 'store', `${f}.png`)), [1280, 800], f);
  }
  assert.deepEqual(pngSize(path.join(ROOT, 'store', 'promo-440x280.png')), [440, 280]);
  assert.deepEqual(pngSize(path.join(ROOT, 'store', 'icon-300.png')), [300, 300]);
});

// ---------- website ----------

const PUBLIC = path.join(ROOT, 'site', 'public');
const pages = fs.readdirSync(PUBLIC).filter((f) => f.endsWith('.html'));

test('site has the landing, feedback, uninstall, privacy and terms pages', () => {
  for (const p of ['index.html', 'buy.html', 'feedback.html', 'uninstall.html', 'privacy.html', 'terms.html']) assert.ok(pages.includes(p), p);
});

test('every site page is mobile-ready, titled and uses only local scripts and styles', () => {
  for (const p of pages) {
    const html = fs.readFileSync(path.join(PUBLIC, p), 'utf8');
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/, `${p} viewport`);
    assert.match(html, /<html lang="en">/, `${p} lang`);
    assert.match(html, /<title>[^<]{5,}<\/title>/, `${p} title`);
    assert.match(html, /href="\/assets\/site\.css"/, `${p} stylesheet`);
    assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i, `${p} remote script`);
    assert.doesNotMatch(html, /<script>(?!\s*<\/script>)/, `${p} inline script (blocked by the CSP)`);
    assert.doesNotMatch(html, /\sstyle="/, `${p} inline style (blocked by the CSP)`);
  }
});

test('sitemap lists the public pages that exist, and robots.txt points to it', () => {
  const sitemap = fs.readFileSync(path.join(PUBLIC, 'sitemap.xml'), 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  assert.deepEqual(locs, ['/', '/buy', '/feedback', '/privacy', '/terms']);
  for (const l of locs) assert.ok(pages.includes(l === '/' ? 'index.html' : l.slice(1) + '.html'), l);
  const robots = fs.readFileSync(path.join(PUBLIC, 'robots.txt'), 'utf8');
  assert.match(robots, /^Sitemap: https:\/\/.+\/sitemap\.xml$/m);
  assert.match(robots, /^Disallow: \/admin$/m);
});

test('landing page links privacy, terms, feedback and the source code, and has an install button', () => {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  for (const href of ['/privacy', '/terms', '/feedback', 'https://github.com/vikas-06978/memebox']) assert.ok(html.includes(`href="${href}"`), href);
  assert.match(html, /id="install"/);
  assert.ok(fs.existsSync(path.join(PUBLIC, 'assets', 'demo.png')));
});

test('privacy page says audio is processed only in the browser and what the form stores', () => {
  const html = fs.readFileSync(path.join(PUBLIC, 'privacy.html'), 'utf8');
  assert.match(html, /inside your browser tab/);
  assert.match(html, /does not collect, record, store or send<\/b> any of your audio or video/);
  assert.match(html, /never saves, records, analyses or uploads/);
  assert.match(html, /We don't store your IP address/);
});
