// SEO: every public page is described properly for search engines and link previews.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers.mjs';
import { build, stable, LANGS, PLATFORMS, pageUrl, siteUrl } from '../../tools/seo.mjs';

const PUBLIC = path.join(ROOT, 'site', 'public');
const files = build();
const base = siteUrl();
const meta = (html, re) => (re.exec(html) || [])[1];

test('generated SEO files are up to date (run npm run seo after changing texts or SITE_URL)', () => {
  for (const [rel, content] of Object.entries(files)) {
    const onDisk = fs.readFileSync(path.join(PUBLIC, rel), 'utf8');
    assert.equal(stable(onDisk), stable(content), `${rel} is out of date: run npm run seo`);
  }
});

test('there is a landing page for each of the 12 languages and 4 platform pages', () => {
  for (const l of LANGS) assert.ok(files[l === 'en' ? 'index.html' : `${l}/index.html`], l);
  assert.deepEqual(PLATFORMS.map((p) => p.slug), ['google-meet-soundboard', 'zoom-soundboard', 'teams-soundboard', 'discord-soundboard']);
});

const pages = Object.entries(files).filter(([rel]) => rel.endsWith('.html'));

test('every page: title, description, canonical, Open Graph, Twitter card and valid JSON-LD', () => {
  for (const [rel, html] of pages) {
    const title = meta(html, /<title>([^<]+)<\/title>/);
    const desc = meta(html, /<meta name="description" content="([^"]+)">/);
    assert.ok(title && title.length >= 20 && title.length <= 70, `${rel} title length ${title && title.length}`);
    assert.ok(desc && desc.length >= 70 && desc.length <= 170, `${rel} description length ${desc && desc.length}`);
    assert.match(html, /<link rel="canonical" href="https:\/\/[^"]+">/, rel);
    for (const p of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type']) assert.ok(html.includes(`property="${p}"`), `${rel} ${p}`);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/, rel);
    assert.match(html, /<meta name="robots" content="index, follow/, rel);
    assert.equal((html.match(/<h1>/g) || []).length, 1, `${rel} has one h1`);
    const ld = JSON.parse(meta(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/));
    const types = ld['@graph'].map((x) => x['@type']);
    assert.ok(types.includes('SoftwareApplication'), `${rel} SoftwareApplication`);
    assert.ok(types.includes('FAQPage'), `${rel} FAQPage`);
    const app = ld['@graph'].find((x) => x['@type'] === 'SoftwareApplication');
    assert.equal(app.name, 'MemeBox');
    assert.ok(app.offers.some((o) => o.price === '0'), `${rel} free offer`);
  }
});

test('language pages: translated, right lang/dir, canonical to themselves, hreflang to all 12 + x-default', () => {
  for (const l of LANGS) {
    const html = files[l === 'en' ? 'index.html' : `${l}/index.html`];
    const d = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'assets', 'i18n', `${l}.json`), 'utf8'));
    assert.equal(meta(html, /<link rel="canonical" href="([^"]+)">/), pageUrl(base, l), `${l} canonical`);
    for (const x of LANGS) assert.ok(html.includes(`hreflang="${x}" href="${pageUrl(base, x)}"`), `${l} → ${x}`);
    assert.ok(html.includes(`hreflang="x-default" href="${base}/"`), `${l} x-default`);
    assert.equal(meta(html, /<title>([^<]+)<\/title>/), d.meta_title.replace(/&/g, '&amp;'), `${l} title`);
    if (l !== 'en') {
      assert.match(html, new RegExp(`<html lang="${l}" dir="${l === 'ar' ? 'rtl' : 'ltr'}" data-prerendered="${l}">`), `${l} html tag`);
      assert.ok(html.includes(d.hero_h1a), `${l} hero is translated in the HTML`);
      assert.ok(html.includes(`href="/buy?lang=${l}"`), `${l} keeps the language on the buy link`);
    }
  }
});

test('platform pages name their platform in title, h1 and description', () => {
  for (const p of PLATFORMS) {
    const html = files[`${p.slug}.html`];
    assert.ok(meta(html, /<title>([^<]+)<\/title>/).includes(p.name), p.slug);
    assert.ok(meta(html, /<h1>([\s\S]*?)<\/h1>/).includes(p.name), p.slug);
    assert.match(html, /"@type": "BreadcrumbList"/);
    assert.equal(meta(html, /<link rel="canonical" href="([^"]+)">/), `${base}/${p.slug}`);
  }
});

test('sitemap lists every page (with language alternates) and robots.txt points to it', () => {
  const sm = files['sitemap.xml'];
  for (const l of LANGS) assert.ok(sm.includes(`<loc>${pageUrl(base, l)}</loc>`), l);
  for (const p of PLATFORMS) assert.ok(sm.includes(`<loc>${base}/${p.slug}</loc>`), p.slug);
  for (const p of ['buy', 'feedback', 'privacy', 'terms']) assert.ok(sm.includes(`<loc>${base}/${p}</loc>`), p);
  assert.match(sm, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  assert.ok(sm.includes('hreflang="x-default"'));
  const robots = fs.readFileSync(path.join(PUBLIC, 'robots.txt'), 'utf8');
  assert.ok(robots.includes(`Sitemap: ${base}/sitemap.xml`));
});

test('the social preview image exists at 1200x630', () => {
  const b = fs.readFileSync(path.join(PUBLIC, 'assets', 'og-card.png'));
  assert.deepEqual([b.readUInt32BE(16), b.readUInt32BE(20)], [1200, 630]);
});
