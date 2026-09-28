// npm run seo: writes everything search engines and link previews need.
//   site/public/index.html          SEO head block (between the SEO:START / SEO:END comments)
//   site/public/<lang>/index.html   the landing page already translated, one per language
//   site/public/<platform>-soundboard.html   landing pages for "Google Meet soundboard" etc.
//   site/public/sitemap.xml         every page, with hreflang alternates
// Each page gets: title, description, canonical, hreflang, Open Graph, Twitter card and
// JSON-LD structured data (SoftwareApplication, FAQPage, BreadcrumbList).
// The site address comes from extension/config.js (SITE_URL). Run again after changing it,
// or after changing any text in site/public/index.html or site/public/assets/i18n/*.json.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'site', 'public');
const I18N = path.join(PUBLIC, 'assets', 'i18n');

export const LANGS = ['en', 'hi', 'bn', 'mr', 'ta', 'te', 'gu', 'es', 'ar', 'pt', 'fr', 'id'];
const RTL = new Set(['ar']);
const OG_LOCALE = {
  en: 'en_US', hi: 'hi_IN', bn: 'bn_IN', mr: 'mr_IN', ta: 'ta_IN', te: 'te_IN', gu: 'gu_IN',
  es: 'es_ES', ar: 'ar_AR', pt: 'pt_BR', fr: 'fr_FR', id: 'id_ID',
};
const INSTALL_URL = 'https://github.com/vikas-06978/memebox/releases/latest'; // store link later

export function siteUrl() {
  const cfg = fs.readFileSync(path.join(ROOT, 'extension', 'config.js'), 'utf8');
  return /SITE_URL:\s*'([^']+)'/.exec(cfg)[1].replace(/\/$/, '');
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => esc(s).replace(/"/g, '&quot;');
const json = (o) => JSON.stringify(o, null, 2).replace(/</g, '\\u003c');
const dict = (l) => JSON.parse(fs.readFileSync(path.join(I18N, `${l}.json`), 'utf8'));

// ---------- the shared head ----------

function head({ title, desc, url, lang, alternates, image, ld, type = 'website' }) {
  const lines = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${attr(desc)}">`,
    '<meta name="robots" content="index, follow, max-image-preview:large">',
    `<link rel="canonical" href="${attr(url)}">`,
    ...(alternates || []).map(([hl, href]) => `<link rel="alternate" hreflang="${hl}" href="${attr(href)}">`),
    `<meta property="og:type" content="${type}">`,
    '<meta property="og:site_name" content="MemeBox">',
    `<meta property="og:title" content="${attr(title)}">`,
    `<meta property="og:description" content="${attr(desc)}">`,
    `<meta property="og:url" content="${attr(url)}">`,
    `<meta property="og:image" content="${attr(image)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${attr(title)}">`,
    `<meta property="og:locale" content="${OG_LOCALE[lang] || 'en_US'}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${attr(title)}">`,
    `<meta name="twitter:description" content="${attr(desc)}">`,
    `<meta name="twitter:image" content="${attr(image)}">`,
    `<script type="application/ld+json">\n${json(ld)}\n  </script>`,
  ];
  return lines.map((l) => '  ' + l).join('\n');
}

function appLd(base, url, t, lang) {
  return {
    '@type': 'SoftwareApplication',
    '@id': `${base}/#app`,
    name: 'MemeBox',
    url,
    description: t('meta_desc'),
    applicationCategory: 'EntertainmentApplication',
    applicationSubCategory: 'Browser extension',
    operatingSystem: 'Chrome, Microsoft Edge',
    inLanguage: lang,
    image: `${base}/assets/og-card.png`,
    screenshot: `${base}/assets/demo.png`,
    downloadUrl: INSTALL_URL,
    softwareHelp: `${base}/feedback`,
    offers: [
      { '@type': 'Offer', name: t('plan_free'), price: '0', priceCurrency: 'INR' },
      { '@type': 'Offer', name: 'Pro', price: '99', priceCurrency: 'INR', url: `${base}/buy` },
    ],
  };
}

const faqLd = (pairs) => ({
  '@type': 'FAQPage',
  mainEntity: pairs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
});

// ---------- landing page in every language ----------

export const pageUrl = (base, lang) => (lang === 'en' ? `${base}/` : `${base}/${lang}/`);

function landing(template, lang, base) {
  const en = dict('en');
  const d = lang === 'en' ? en : dict(lang);
  const t = (k) => d[k] || en[k];
  const url = pageUrl(base, lang);
  const alternates = [...LANGS.map((l) => [l, pageUrl(base, l)]), ['x-default', pageUrl(base, 'en')]];
  const faq = [1, 2, 3, 4, 5].map((n) => [t('q' + n), t('a' + n)]);
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${base}/#site`, name: 'MemeBox', url: `${base}/`, inLanguage: LANGS },
      appLd(base, url, t, lang),
      faqLd(faq),
    ],
  };
  const block = head({ title: t('meta_title'), desc: t('meta_desc'), url, lang, alternates, image: `${base}/assets/og-card.png`, ld });
  let html = template.replace(/<!-- SEO:START[^>]*-->[\s\S]*?<!-- SEO:END -->/,
    `<!-- SEO:START (written by npm run seo; edit tools/seo.mjs or the i18n files instead) -->\n${block}\n  <!-- SEO:END -->`);
  if (lang === 'en') return html;

  html = html.replace(/<html[^>]*>/, `<html lang="${lang}" dir="${RTL.has(lang) ? 'rtl' : 'ltr'}" data-prerendered="${lang}">`);
  html = html.replace(/(data-t="([a-z0-9_]+)"[^>]*>)([^<]*)(<)/g, (m, open, key, text, lt) => (d[key] ? open + esc(d[key]) + lt : m));
  // Keep visitors in their language when they go on to buy or give feedback.
  html = html.replace(/href="\/(buy|feedback)"/g, `href="/$1?lang=${lang}"`);
  html = html.replace(/<a href="\/" class="brand">/g, `<a href="/${lang}/" class="brand">`);
  return html;
}

// ---------- pages for what people search: "<platform> soundboard" ----------

export const PLATFORMS = [
  {
    slug: 'google-meet-soundboard', name: 'Google Meet', host: 'meet.google.com',
    title: 'Google Meet Soundboard: Play Meme Sounds in Meet | MemeBox',
    desc: 'Play meme sounds, sound effects and funny voices in Google Meet. Everyone in the meeting hears them through your mic. Free Chrome extension, no sign-up.',
    open: 'Open meet.google.com in Chrome or Edge and join your meeting.',
    tip: 'Google Meet mutes you on joining sometimes. Unmute, and the dot on 😂 turns green.',
  },
  {
    slug: 'zoom-soundboard', name: 'Zoom', host: 'app.zoom.us',
    title: 'Zoom Soundboard: Meme Sounds in Zoom Meetings | MemeBox',
    desc: 'Play meme sounds and a voice changer in Zoom meetings in your browser. Everyone hears them through your mic. Free Chrome extension for the Zoom web client.',
    open: 'Open your Zoom link and choose "Join from your browser" (the Zoom web client).',
    tip: 'MemeBox works in the Zoom web client, not the Zoom desktop app.',
  },
  {
    slug: 'teams-soundboard', name: 'Microsoft Teams', host: 'teams.microsoft.com',
    title: 'Microsoft Teams Soundboard: Meme Sounds in Teams | MemeBox',
    desc: 'Add meme sounds, sound effects and a voice changer to Microsoft Teams calls in the browser. Everyone hears them through your mic. Free Chrome extension.',
    open: 'Open Teams on the web (teams.microsoft.com or teams.live.com) and join the call.',
    tip: 'MemeBox works in Teams on the web, not the Teams desktop app.',
  },
  {
    slug: 'discord-soundboard', name: 'Discord', host: 'discord.com',
    title: 'Discord Soundboard in the Browser: Meme Sounds | MemeBox',
    desc: 'A meme soundboard and voice changer for Discord in the browser. Play meme sounds in voice channels through your mic. Free Chrome extension, no bot needed.',
    open: 'Open discord.com in Chrome or Edge and join a voice channel.',
    tip: 'No bot and no server permissions needed. The sound goes through your own mic.',
  },
];

function platformPage(p, base) {
  const url = `${base}/${p.slug}`;
  const faq = [
    [`Does everyone in the ${p.name} call hear the memes?`, `Yes. MemeBox plays the meme through your microphone, so everyone in the ${p.name} call hears it, just like your voice. They don't need MemeBox.`],
    [`Is it free to use MemeBox with ${p.name}?`, 'Yes. The soundboard, Hindi and English voices, six tones and tab audio are free. Pro (₹99 once) adds unlimited picture memes, the voice changer and more.'],
    ['Is my voice recorded?', 'Never. MemeBox only mixes sound inside your browser tab. Nothing is saved or uploaded.'],
    [`Does it work in the ${p.name} desktop app?`, `MemeBox works in the browser version of ${p.name} (Chrome or Edge). ${p.tip}`],
  ];
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      appLd(base, `${base}/`, (k) => dict('en')[k], 'en'),
      faqLd(faq),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'MemeBox', item: `${base}/` },
          { '@type': 'ListItem', position: 2, name: `${p.name} soundboard`, item: url },
        ],
      },
    ],
  };
  const others = PLATFORMS.filter((x) => x !== p).map((x) => `<a href="/${x.slug}">${esc(x.name)} soundboard</a>`).join(' · ');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Written by npm run seo (tools/seo.mjs). Edit the generator, not this file. -->
${head({ title: p.title, desc: p.desc, url, lang: 'en', image: `${base}/assets/og-card.png`, ld })}
  <meta name="theme-color" content="#ffd43b">
  <link rel="icon" href="/assets/icon.png">
  <link rel="apple-touch-icon" href="/assets/icon.png">
  <link rel="stylesheet" href="/assets/site.css">
  <script src="/assets/prefs.js"></script>
</head>
<body class="page-bg">
  <header class="topbar">
    <div class="wrap nav">
      <a href="/" class="brand"><img src="/assets/icon.png" alt="" width="34" height="34"> MemeBox</a>
      <nav><a href="/#try">Try it</a> <a href="/#pricing">Pricing</a> <a class="button primary" href="${INSTALL_URL}">Add to Chrome</a></nav>
    </div>
  </header>
  <main>
    <section class="wrap hero">
      <div>
        <span class="pill">😂 Free · Works in ${esc(p.name)} on the web</span>
        <h1>Meme soundboard for <span class="hl">${esc(p.name)}</span></h1>
        <p class="lead">Play meme sounds, funny lines and sound effects in your ${esc(p.name)} call. MemeBox sends them through your microphone, so everyone hears them. Only you need it.</p>
        <p class="actions">
          <a class="button primary big" href="${INSTALL_URL}">Add MemeBox to Chrome, it's free</a>
          <a class="button big" href="/#try">▶ Try the sounds</a>
        </p>
        <ul class="ticks"><li>No sign-up</li><li>Nothing recorded</li><li>Hindi and English voices</li></ul>
      </div>
      <figure class="demo">
        <div class="frame"><div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
          <img src="/assets/demo.png" width="1280" height="800" fetchpriority="high" alt="MemeBox panel open during a video call, with a big meme caption on screen"></div>
      </figure>
    </section>

    <section class="wrap">
      <h2 class="section">How to play meme sounds in ${esc(p.name)}</h2>
      <ol class="how">
        <li class="card"><b>Add MemeBox</b><p>Install the free MemeBox extension for Chrome or Edge.</p></li>
        <li class="card"><b>Join your ${esc(p.name)} call</b><p>${esc(p.open)} The 😂 button appears in the corner.</p></li>
        <li class="card"><b>Click 😂</b><p>A meme plays through your mic and everyone hears it. Right-click 😂 to pick a sound, search, or change your voice.</p></li>
      </ol>
    </section>

    <section class="wrap">
      <h2 class="section">What you get in ${esc(p.name)}</h2>
      <div class="features">
        <article class="card"><span class="icon">😂</span><h3>Meme soundboard</h3><p>Hundreds of laughs one click away. Favourites on Alt+1 to Alt+9, a random meme on 😂.</p></article>
        <article class="card"><span class="icon">🎤</span><h3>Voice changer</h3><p>Chipmunk, Deep, Robot, Echo or Radio for your own live voice. Alt+V turns it on and off.</p></article>
        <article class="card"><span class="icon">📺</span><h3>Any tab's sound</h3><p>Play a funny YouTube moment straight into the ${esc(p.name)} call. Nothing is downloaded.</p></article>
      </div>
    </section>

    <section class="wrap faq">
      <h2 class="section">Questions about MemeBox and ${esc(p.name)}</h2>
${faq.map(([q, a]) => `      <details class="card"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
    </section>

    <section class="wrap">
      <div class="band">
        <h2>Make your next ${esc(p.name)} call funnier</h2>
        <p>Free, private, and ready in seconds.</p>
        <a class="button big" href="${INSTALL_URL}">Add MemeBox to Chrome</a>
      </div>
      <p class="section-sub small">Also for: ${others}</p>
    </section>
  </main>
  <footer class="wrap site-foot">
    <a href="/" class="brand"><img src="/assets/icon.png" alt="" width="26" height="26"> MemeBox</a>
    <a href="/feedback">Feedback</a>
    <a href="/buy">Buy Pro</a>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
    <div class="prefs" data-prefs="theme"></div>
  </footer>
</body>
</html>
`;
}

// ---------- sitemap ----------

function sitemap(base) {
  const today = new Date().toISOString().slice(0, 10);
  const alt = LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${pageUrl(base, l)}"/>`)
    .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl(base, 'en')}"/>`).join('\n');
  const urls = [
    ...LANGS.map((l) => `  <url>\n    <loc>${pageUrl(base, l)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${l === 'en' ? '1.0' : '0.9'}</priority>\n${alt}\n  </url>`),
    ...PLATFORMS.map((p) => `  <url>\n    <loc>${base}/${p.slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`),
    ...[['buy', '0.6'], ['feedback', '0.4'], ['privacy', '0.3'], ['terms', '0.3']].map(([p, pr]) => `  <url>\n    <loc>${base}/${p}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>${pr}</priority>\n  </url>`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Written by npm run seo from SITE_URL in extension/config.js. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

// ---------- build ----------

// Returns { relativePath: contents } for every file this script owns.
export function build() {
  const base = siteUrl();
  const template = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  const files = {};
  for (const l of LANGS) files[l === 'en' ? 'index.html' : `${l}/index.html`] = landing(template, l, base);
  for (const p of PLATFORMS) files[`${p.slug}.html`] = platformPage(p, base);
  files['sitemap.xml'] = sitemap(base);
  return files;
}

// Same as build(), but without the date that changes every day (for the up-to-date test).
export const stable = (s) => s.replace(/<lastmod>[^<]*<\/lastmod>/g, '');

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = build();
  for (const [rel, content] of Object.entries(files)) {
    const out = path.join(PUBLIC, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, content);
  }
  const robots = path.join(PUBLIC, 'robots.txt');
  fs.writeFileSync(robots, fs.readFileSync(robots, 'utf8').replace(/^Sitemap: .*$/m, `Sitemap: ${siteUrl()}/sitemap.xml`));
  console.log(`seo: ${Object.keys(files).length} files for ${siteUrl()}`);
}
