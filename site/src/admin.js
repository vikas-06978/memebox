// MemeBox site: admin dashboard data, HTML and CSV.
import { escapeHtml as h } from './http.js';
import { FEATURES, REASONS, PLATFORMS, DEVICES } from './validate.js';
import { PRODUCTS, parseAddons } from './shop.js';

export const RATING_FACES = { 1: '😞', 2: '😐', 3: '🙂', 4: '😍' };
const REASON_TEXT = {
  'didnt-work': "Didn't work on my call",
  'too-hard': 'Too hard to use',
  'not-funny': 'Not funny',
  'found-another': 'Found another one',
  other: 'Other',
};

const PLATFORM_TEXT = {
  meet: 'Google Meet', 'zoom-web': 'Zoom (browser)', 'zoom-app': 'Zoom (desktop app)', 'teams-web': 'Teams (browser)',
  'teams-app': 'Teams (desktop app)', discord: 'Discord', 'not-tried': 'Did not get to try it', other: 'Other',
};
const DEVICE_TEXT = { windows: 'Windows', mac: 'Mac', chromebook: 'Chromebook', linux: 'Linux', other: 'Other' };

// Counts of a picked column. Older databases without the column just show zeros.
async function countBy(db, column, list) {
  const out = Object.fromEntries(list.map((x) => [x, 0]));
  try {
    const rows = (await db.prepare(`SELECT ${column} AS v, COUNT(*) AS n FROM feedback WHERE ${column} <> '' GROUP BY ${column}`).all()).results;
    for (const r of rows) if (r.v in out) out[r.v] = Number(r.n);
  } catch { /* column not migrated yet */ }
  return out;
}

export async function loadStats(db) {
  const ratings = (await db.prepare(
    "SELECT rating, COUNT(*) AS n FROM feedback WHERE type = 'feedback' GROUP BY rating",
  ).all()).results;
  const reasons = (await db.prepare(
    "SELECT reason, COUNT(*) AS n FROM feedback WHERE type = 'uninstall' GROUP BY reason",
  ).all()).results;
  const requests = (await db.prepare(
    "SELECT lower(trim(wants)) AS want, COUNT(*) AS n FROM feedback WHERE type = 'feedback' AND wants <> '' " +
    'GROUP BY lower(trim(wants)) ORDER BY n DESC, want LIMIT 15',
  ).all()).results;
  const usedRows = (await db.prepare(
    "SELECT used FROM feedback WHERE type = 'feedback' AND used <> '[]'",
  ).all()).results;
  const latest = (await db.prepare(
    'SELECT * FROM feedback WHERE message <> \'\' OR wants <> \'\' ORDER BY created_at DESC LIMIT 50',
  ).all()).results;
  const total = await db.prepare('SELECT COUNT(*) AS n FROM feedback').first();

  const used = Object.fromEntries(FEATURES.map((f) => [f, 0]));
  for (const r of usedRows) {
    try { for (const f of JSON.parse(r.used)) if (f in used) used[f]++; } catch { /* skip a bad row */ }
  }
  const byRating = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of ratings) if (r.rating in byRating) byRating[r.rating] = Number(r.n);
  const byReason = Object.fromEntries(REASONS.map((x) => [x, 0]));
  for (const r of reasons) if (r.reason in byReason) byReason[r.reason] = Number(r.n);
  const byPlatform = await countBy(db, 'platform', PLATFORMS);
  const byDevice = await countBy(db, 'device', DEVICES);
  return { total: Number(total?.n || 0), byRating, byReason, byPlatform, byDevice, requests, used, latest };
}

// ---- activity: what people do, counted from the data we already keep (no tracking in the extension) ----
const DAYS = 30;
const dayList = () => Array.from({ length: DAYS }, (_, i) => new Date(Date.now() - (DAYS - 1 - i) * 86400000).toISOString().slice(0, 10));

export async function loadActivity(db) {
  const days = dayList(), since = days[0];
  const safe = async (fn, fallback) => { try { return await fn(); } catch { return fallback; } };
  const perDay = async (sql, ...args) => {
    const rows = await safe(async () => (await db.prepare(sql).bind(...args).all()).results, []);
    const m = Object.fromEntries(rows.map((r) => [r.d, Number(r.n)]));
    return days.map((d) => ({ d, n: m[d] || 0 }));
  };
  const orders = await perDay('SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n FROM orders WHERE created_at >= ? GROUP BY d', since);
  const revenue = await perDay("SELECT substr(decided_at, 1, 10) AS d, SUM(amount_inr) AS n FROM orders WHERE status = 'approved' AND decided_at >= ? GROUP BY d", since);
  const feedback = await perDay('SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n FROM feedback WHERE created_at >= ? GROUP BY d', since);
  const checkins = await perDay("SELECT last_seen AS d, COUNT(*) AS n FROM licenses WHERE last_seen >= ? AND status = 'active' GROUP BY last_seen", since);
  const count = async (sql, ...args) => safe(async () => Number((await db.prepare(sql).bind(...args).first()).n), 0);
  const funnel = {
    started: await count('SELECT COUNT(*) AS n FROM orders WHERE created_at >= ?', since),
    paid: await count("SELECT COUNT(*) AS n FROM orders WHERE created_at >= ? AND status IN ('waiting', 'approved', 'rejected')", since),
    approved: await count("SELECT COUNT(*) AS n FROM orders WHERE created_at >= ? AND status = 'approved'", since),
  };
  const byProduct = await safe(async () => (await db.prepare("SELECT product, COUNT(*) AS n, SUM(amount_inr) AS inr FROM orders WHERE status = 'approved' GROUP BY product ORDER BY inr DESC").all()).results, []);
  const left = await safe(async () => await db.prepare("SELECT COALESCE(SUM(pro_seconds), 0) AS p, COALESCE(SUM(max_seconds), 0) AS m FROM licenses WHERE kind = 'paid'").first(), { p: 0, m: 0 });
  let soldPro = 0, soldMax = 0;
  for (const r of byProduct) { const p = PRODUCTS[r.product]; if (p) { soldPro += p.proSeconds * Number(r.n); soldMax += p.maxSeconds * Number(r.n); } }
  const group = async (col) => safe(async () => (await db.prepare(`SELECT ${col} AS v, COUNT(*) AS n FROM feedback WHERE ${col} <> '' GROUP BY ${col} ORDER BY n DESC LIMIT 6`).all()).results.map((r) => [r.v, Number(r.n)]), []);
  const keys = await safe(async () => await db.prepare("SELECT COUNT(*) AS n, SUM(CASE WHEN last_seen >= ? THEN 1 ELSE 0 END) AS a FROM licenses WHERE status = 'active'").bind(days[DAYS - 7]).first(), { n: 0, a: 0 });
  const usageRows = await safe(async () => (await db.prepare(`SELECT feature, item, SUM(count) AS n, COUNT(DISTINCT subject) AS people
    FROM usage_daily WHERE day >= ? GROUP BY feature, item ORDER BY n DESC`).bind(since).all()).results, []);
  const usageFeatures = [];
  for (const row of usageRows) {
    const found = usageFeatures.find((entry) => entry.feature === row.feature);
    if (found) { found.n += Number(row.n); found.people = Math.max(found.people, Number(row.people)); }
    else usageFeatures.push({ feature: row.feature, n: Number(row.n), people: Number(row.people) });
  }
  usageFeatures.sort((x, y) => y.n - x.n);
  const pass = await safe(async () => await db.prepare('SELECT COALESCE(SUM(billed), 0) AS billed, COUNT(*) AS sessions, COUNT(DISTINCT license_key) AS keys FROM pass_sessions').first(), { billed: 0, sessions: 0, keys: 0 });
  return {
    days, orders, revenue, feedback, checkins, funnel, byProduct,
    time: { soldPro, soldMax, leftPro: Number(left?.p || 0), leftMax: Number(left?.m || 0) },
    byVersion: await group('version'), byLang: await group('lang'),
    keys: { total: Number(keys?.n || 0), active7: Number(keys?.a || 0) },
    usageRows, usageFeatures,
    pass: { billed: Number(pass?.billed || 0), sessions: Number(pass?.sessions || 0), keys: Number(pass?.keys || 0) },
  };
}

// A small bar chart as inline SVG (the admin page's CSP allows attributes, not inline styles).
function chart(series, label) {
  const max = Math.max(1, ...series.map((x) => x.n)), W = 300, H = 56, bw = W / series.length;
  const bars = series.map((x, i) => {
    const bh = x.n ? Math.max(2, (x.n / max) * (H - 4)) : 1;
    return `<rect class="bar${x.n ? '' : ' zero'}" x="${(i * bw + 1).toFixed(1)}" y="${(H - bh).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${bh.toFixed(1)}" rx="1.5"><title>${h(x.d)}: ${x.n}</title></rect>`;
  }).join('');
  return `<div class="chartbox" data-series="${h(JSON.stringify(series))}"><div class="chart-sum"><b class="chart-total">${sum(series)}</b> <span class="muted">in the range</span></div><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${h(label)}">${bars}</svg><div class="chart-axis"><span>${h(series[0].d.slice(5))}</span><span>${h(series[series.length - 1].d.slice(5))}</span></div></div>`;
}
const sum = (s) => s.reduce((a, x) => a + x.n, 0);
const hours = (sec) => (sec / 3600).toFixed(1);

export function activitySection(a) {
  const pct = (x, y) => (y ? Math.round((x / y) * 100) + '%' : 'n/a');
  const usedPro = Math.max(0, a.time.soldPro - a.time.leftPro), usedMax = Math.max(0, a.time.soldMax - a.time.leftMax);
  return `
<section class="admin-section" id="activity"><div class="section-heading"><div><span class="eyebrow">Business overview</span><h2>Sales and usage</h2></div><p>Last ${DAYS} days unless marked all-time.</p></div>
<div class="range" id="range" role="group" aria-label="Range"><button type="button" data-days="7">7 days</button><button type="button" data-days="14">14 days</button><button type="button" data-days="30">30 days</button></div>
<p class="muted">Revenue and passes come from billing records. Product usage appears only for people who explicitly enabled optional usage counters; it never includes call content.</p>
<div class="tiles">
  <div class="tile"><b>₹${sum(a.revenue)}</b><span>earned</span></div>
  <div class="tile"><b>${a.funnel.approved}</b><span>approved orders</span></div>
  <div class="tile"><b>${a.funnel.started}</b><span>checkouts started</span></div>
  <div class="tile"><b>${pct(a.funnel.approved, a.funnel.started)}</b><span>started → approved</span></div>
  <div class="tile"><b>${a.keys.active7}/${a.keys.total}</b><span>keys used this week</span></div>
  <div class="tile"><b>${hours(a.pass.billed)} h</b><span>pass time used · all-time</span></div>
</div>
<div class="grid">
  <section class="card"><h2>Earned per day (₹)</h2>${chart(a.revenue, 'Rupees earned per day')}</section>
  <section class="card"><h2>Checkouts started per day</h2>${chart(a.orders, 'Checkouts started per day')}</section>
  <section class="card"><h2>Keys checked per day</h2>${chart(a.checkins, 'License keys that checked in per day')}<p class="muted">Each key counts on the day of its last check.</p></section>
  <section class="card"><h2>Feedback per day</h2>${chart(a.feedback, 'Feedback answers per day')}</section>
  <section class="card"><h2>Checkout funnel</h2>${bars([['Started', a.funnel.started], ['Paid (UTR sent)', a.funnel.paid], ['Approved', a.funnel.approved]])}</section>
  <section class="card"><h2>What sells</h2>${a.byProduct.length ? bars(a.byProduct.map((r) => [(PRODUCTS[r.product] || { name: r.product }).name + ` (₹${Number(r.inr)})`, Number(r.n)])) : '<p class="muted">No approved orders yet.</p>'}</section>
  <section class="card"><h2>Pass time</h2>
    <p>Pro: <b>${hours(a.time.soldPro)} h</b> sold, <b>${hours(usedPro)} h</b> used, ${hours(a.time.leftPro)} h left</p>
    <p>Pro Max: <b>${hours(a.time.soldMax)} h</b> sold, <b>${hours(usedMax)} h</b> used, ${hours(a.time.leftMax)} h left</p>
    <p><b>${hours(a.pass.billed)} h</b> actually billed across ${a.pass.sessions} signed sessions and ${a.pass.keys} keys.</p>
    <p class="muted">The billed number is authoritative. Sold-minus-left remains useful for older/manual top-ups.</p></section>
  <section class="card span-2"><h2>What people use</h2>${a.usageFeatures.length ? bars(a.usageFeatures.map((r) => [r.feature, r.n])) : '<p class="muted">No opted-in usage yet. This fills after the usage migration and a user enables optional counters.</p>'}</section>
  <section class="card span-2"><h2>Top characters, filters, music and memes</h2>${a.usageRows.length ? bars(a.usageRows.slice(0, 15).map((r) => [`${r.feature}: ${r.item} · ${r.people} opted-in user${Number(r.people) === 1 ? '' : 's'}`, Number(r.n)])) : '<p class="muted">No opted-in usage yet.</p>'}</section>
  <section class="card span-2"><h2>Platform coverage</h2><div class="status-list"><span class="ok">✓ Google Meet web</span><span class="ok">✓ Zoom web</span><span class="ok">✓ Microsoft Teams web &amp; Teams Live</span><span class="ok">✓ Discord web</span><span class="muted">Desktop Zoom/Teams apps are outside a Chrome extension; feedback selections for them are kept separate.</span></div></section>
  <section class="card"><h2>Extension versions (feedback)</h2>${a.byVersion.length ? bars(a.byVersion) : '<p class="muted">No data yet.</p>'}</section>
  <section class="card"><h2>Languages (feedback)</h2>${a.byLang.length ? bars(a.byLang) : '<p class="muted">No data yet.</p>'}</section>
</div></section>`;
}

export function page(title, body, { script = false, waiting = 0 } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${h(title)}</title>
<link rel="stylesheet" href="/assets/site.css">
</head>
<body class="admin" data-waiting="${Number(waiting) || 0}">
<main class="wrap">
${body}
</main>
${script ? '<script src="/assets/admin.js" defer></script>' : ''}
</body>
</html>`;
}

export function loginPage(error = '') {
  return page('MemeBox admin', `
<h1>MemeBox admin</h1>
<form method="post" action="/admin" class="card narrow">
  <label>Admin key <input type="password" name="key" autocomplete="current-password" required autofocus></label>
  ${error ? `<p class="error" role="alert">${h(error)}</p>` : ''}
  <button type="submit" class="primary">Sign in</button>
</form>`);
}

// entries: [label, count] or [label, count, pick]; a pick like "reason:too-hard" makes the row clickable (it filters the messages table).
function bars(entries) {
  const max = Math.max(1, ...entries.map(([, n]) => n));
  return `<ul class="bars">${entries.map(([label, n, pick]) => `
    <li${pick ? ` class="pick" data-pick="${h(pick)}" title="Show these messages"` : ''}><span class="label">${h(label)}</span><progress max="${max}" value="${n}"></progress><b>${n}</b></li>`).join('')}</ul>`;
}

const PRODUCT_TEXT = Object.fromEntries(Object.entries(PRODUCTS).map(([id, p]) => [id, p.name.replace('pass: ', 'pass ')]));

function licenseText(l) {
  if (l.unlimited) return 'Pro, unlimited';
  const mins = (s) => Math.floor((Number(s) || 0) / 60);
  const parts = [];
  if (l.max_seconds > 0) parts.push(`Pro Max ${mins(l.max_seconds)} min left`);
  if (l.pro_seconds > 0) parts.push(`Pro ${mins(l.pro_seconds)} min left`);
  const chars = parseAddons(l.addons).filter((x) => x.id.startsWith('character:')).map((x) => x.id.slice(10));
  if (chars.length) parts.push(`characters: ${chars.join(', ')}`);
  if (l.picture_slots > 0 || !parts.length) parts.push(`${l.picture_slots} picture slot${l.picture_slots === 1 ? '' : 's'}`);
  return parts.join(', ');
}

// Orders waiting for approval and license keys. `notice` is shown at the top (a new key, an approval).
export function shopSection(shop, notice = '') {
  const waiting = shop.waiting.map((o) => `
    <tr>
      <td class="nowrap">${h(String(o.claimed_at || o.created_at).slice(0, 16).replace('T', ' '))}</td>
      <td><b>₹${h(o.amount_inr)}</b> ${h(PRODUCT_TEXT[o.product] || o.product)}${o.for_key ? `<div class="muted">top up ${h(o.for_key)}</div>` : ''}</td>
      <td class="nowrap">UTR <b>${h(o.utr)}</b><div class="muted">Note: MemeBox ${h(o.id)}</div></td>
      <td class="nowrap">
        <form method="post" action="/admin/order" class="inline"><input type="hidden" name="id" value="${h(o.id)}"><button name="action" value="approve" class="primary">Approve</button></form>
        <form method="post" action="/admin/order" class="inline"><input type="hidden" name="id" value="${h(o.id)}"><button name="action" value="reject">Reject</button></form>
      </td>
    </tr>`).join('');
  const recent = shop.recent.map((o) => `
    <tr><td class="nowrap">${h(String(o.decided_at).slice(0, 16).replace('T', ' '))}</td><td>₹${h(o.amount_inr)} ${h(PRODUCT_TEXT[o.product] || o.product)}</td>
    <td>${h(o.status)}</td><td class="nowrap">${h(o.utr || '')}</td><td class="nowrap">${h(o.license_key)}</td></tr>`).join('');
  const keys = shop.licenses.map((l) => `
    <tr data-q="${h((l.key + ' ' + l.kind + ' ' + l.note + ' ' + licenseText(l)).toLowerCase())}">
      <td class="nowrap"><code>${h(l.key)}</code> <button type="button" class="small copy-key" data-key="${h(l.key)}">Copy</button></td>
      <td>${h(l.kind)}</td>
      <td>${h(licenseText(l))}</td>
      <td class="nowrap"><b>${hours(Number(l.pass_billed) || 0)} h</b><div class="muted">${Number(l.pass_sessions) || 0} session${Number(l.pass_sessions) === 1 ? '' : 's'}</div></td>
      <td>${h(l.note)}</td>
      <td class="nowrap">${h(l.last_seen || 'never')}</td>
      <td class="nowrap">
        <form method="post" action="/admin/license" class="inline"><input type="hidden" name="key" value="${h(l.key)}">
          ${l.status === 'active' ? '<button name="action" value="revoke">Turn off</button>' : '<b class="error">off</b> <button name="action" value="restore">Turn on</button>'}
        </form>
      </td>
    </tr>`).join('');
  return `
${notice ? `<p class="notice" role="status">${notice}</p>` : ''}
<section class="card" id="shop">
  <h2>Payments waiting for you (${shop.waiting.length})</h2>
  <p class="muted">Open your bank or UPI app. Find a payment with the same amount and UTR (the note says "MemeBox" and the order code). Only then press Approve.</p>
  ${shop.waiting.length ? `<div class="table-wrap"><table><thead><tr><th>Paid at (UTC)</th><th>What</th><th>Payment</th><th></th></tr></thead><tbody>${waiting}</tbody></table></div>` : '<p class="muted">Nothing waiting.</p>'}
  <p><b>Pro users:</b> ${h(shop.proPaid)} paid · ${h(shop.proGift)} owner/gift · ${h(shop.proActive)} checked in the last 7 days · ${h(shop.pictureBuyers)} bought only picture slots</p>
  <p class="muted">Earned so far: <b>₹${h(shop.earnedInr)}</b> from ${h(shop.paidOrders)} approved order${shop.paidOrders === 1 ? '' : 's'}.</p>
  ${shop.recent.length ? `<details><summary>Last 20 decisions</summary><div class="table-wrap"><table><thead><tr><th>When</th><th>What</th><th>Result</th><th>UTR</th><th>Key</th></tr></thead><tbody>${recent}</tbody></table></div></details>` : ''}
</section>
<section class="card" id="licenses">
  <h2>License keys</h2>
  <form method="post" action="/admin/license" class="keyform">
    <input type="hidden" name="action" value="create">
    <label>Who <select name="kind"><option value="owner">Me (owner)</option><option value="gift">A friend (gift)</option></select></label>
    <label class="check"><input type="checkbox" name="unlimited" checked> Pro, unlimited</label>
    <label>or Pro minutes <input type="number" name="proMinutes" min="0" max="14400" value="0"></label>
    <label>Pro Max minutes <input type="number" name="maxMinutes" min="0" max="14400" value="0"></label>
    <label>or picture slots <input type="number" name="slots" min="0" max="10000" value="0"></label>
    <label>Note <input name="note" maxlength="200" placeholder="e.g. my laptop"></label>
    <button type="submit" class="primary">Make a key</button>
  </form>
  <p class="muted">Each row shows actual signed pass time billed to that key. A session is created when a time pass is used.</p>
  ${shop.licenses.length ? `<input type="search" id="k-q" class="filter" placeholder="Search keys, notes, who…" aria-label="Search keys"><div class="table-wrap"><table id="keys"><thead><tr><th>Key</th><th>Kind</th><th>Remaining / owns</th><th>Time used</th><th>Note</th><th>Last check</th><th></th></tr></thead><tbody>${keys}</tbody></table></div>` : '<p class="muted">No keys yet.</p>'}
</section>`;
}

export function dashboardPage(s, shopHtml = '', waiting = 0) {
  const rated = Object.values(s.byRating).reduce((a, b) => a + b, 0);
  const avg = rated ? (Object.entries(s.byRating).reduce((a, [k, n]) => a + Number(k) * n, 0) / rated).toFixed(2) : 'n/a';
  const rows = s.latest.map((r) => `
    <tr data-id="${h(r.id)}" data-type="${h(r.type)}" data-rating="${h(r.rating || '')}" data-reason="${h(r.reason || '')}" data-q="${h([r.message, r.wants, r.email, r.version, r.lang, r.site, r.reason].join(' ').toLowerCase())}">
      <td class="nowrap"><label class="check" title="I have read / answered this"><input type="checkbox" class="done" aria-label="Answered"></label></td>
      <td class="nowrap">${h(r.created_at.slice(0, 16).replace('T', ' '))}</td>
      <td>${r.type === 'uninstall' ? 'Uninstall: ' + h(REASON_TEXT[r.reason] || r.reason) : h(RATING_FACES[r.rating] || '')}</td>
      <td class="msg">${h(r.message)}${r.wants ? `<div class="muted">Wants: ${h(r.wants)}</div>` : ''}</td>
      <td>${r.email ? `${h(r.email)} <button type="button" class="small copy" data-copy="${h(r.email)}">Copy email</button>` : ''}</td>
      <td class="nowrap">${h(r.version)} ${h(r.site)} ${h(r.lang)}${r.platform || r.device ? `<div class="muted">${h(PLATFORM_TEXT[r.platform] || '')}${r.platform && r.device ? ' · ' : ''}${h(DEVICE_TEXT[r.device] || '')}</div>` : ''}</td>
    </tr>`).join('');
  return page('MemeBox admin', `
<header class="admin-head">
  <div class="admin-brand"><span class="eyebrow">Private control centre</span><h1>MemeBox admin</h1></div>
  <span class="muted">updated <span id="updated"></span></span>
  <button type="button" id="refresh">Refresh</button>
  <label class="check"><input type="checkbox" id="auto-refresh"> every minute</label>
  <a class="button" href="/admin/packs">Music &amp; meme packs</a>
  <a class="button" href="/admin/csv">Download CSV</a>
  <details class="admin-actions"><summary class="button">More</summary><div><a class="button" href="/admin/payments">Test gateway payments</a></div></details>
  <form method="post" action="/admin/logout"><button type="submit">Sign out</button></form>
</header>
<nav class="admin-nav" aria-label="Sections">
  <a href="#activity">Overview</a><a href="#shop">Payments${waiting ? ` <b class="badge">${Number(waiting)}</b>` : ''}</a><a href="#licenses">Licenses &amp; pass time</a><a href="#feedback">Feedback</a><a href="#messages-card">Messages</a>
</nav>
${shopHtml}
<h2 class="section-title" id="feedback">Feedback</h2>
<p class="muted">${s.total} answers in total. Average rating: ${avg} of 4 (${rated} ratings).</p>
<div class="grid">
  <section class="card"><h2>Ratings</h2>${bars(Object.entries(s.byRating).map(([k, n]) => [RATING_FACES[k], n, 'rating:' + k]))}</section>
  <section class="card"><h2>Features used</h2>${bars(Object.entries(s.used))}</section>
  <section class="card"><h2>Why people uninstalled</h2>${bars(Object.entries(s.byReason).map(([k, n]) => [REASON_TEXT[k], n, 'reason:' + k]))}</section>
  <section class="card"><h2>Where they used it</h2>${bars(Object.entries(s.byPlatform || {}).map(([k, n]) => [PLATFORM_TEXT[k], n]))}</section>
  <section class="card"><h2>Which device</h2>${bars(Object.entries(s.byDevice || {}).map(([k, n]) => [DEVICE_TEXT[k], n]))}</section>
  <section class="card"><h2>Top requests</h2>${s.requests.length
    ? `<ol class="requests">${s.requests.map((r) => `<li>${h(r.want)} <b>×${r.n}</b></li>`).join('')}</ol>`
    : '<p class="muted">No requests yet.</p>'}</section>
</div>
<section class="card" id="messages-card">
  <h2>Latest 50 messages</h2>
  ${s.latest.length ? `<div class="toolbar">
    <input type="search" id="m-q" placeholder="Search messages, email, version…" aria-label="Search messages">
    <select id="m-type" aria-label="Type"><option value="">All types</option><option value="feedback">Feedback</option><option value="uninstall">Uninstall</option></select>
    <select id="m-rating" aria-label="Rating"><option value="">Any rating</option>${Object.entries(RATING_FACES).map(([k, f]) => `<option value="${k}">${f}</option>`).join('')}</select>
    <select id="m-reason" aria-label="Reason"><option value="">Any reason</option>${REASONS.map((k) => `<option value="${h(k)}">${h(REASON_TEXT[k])}</option>`).join('')}</select>
    <label class="check"><input type="checkbox" id="m-hide-done"> hide answered</label>
    <button type="button" id="m-clear" class="small">Clear</button>
    <span class="muted" id="m-count"></span>
  </div>
  <p class="muted">Click a row to open it. Tick a row once you have read or answered it (kept in this browser). Click a face or a reason above to filter.</p>
  <div class="table-wrap"><table id="messages">
    <thead><tr><th></th><th>When (UTC)</th><th>Rating</th><th>Message</th><th>Email</th><th>Version, site, lang</th></tr></thead>
    <tbody>${rows}</tbody></table></div>` : '<p class="muted">No messages yet.</p>'}
</section>`, { script: true, waiting });
}

// CSV with every column. Cells that start like a formula are prefixed with ' so
// spreadsheet apps show them as text instead of running them.
export const CSV_COLUMNS = ['id', 'created_at', 'type', 'rating', 'used', 'wants', 'message', 'email', 'reason', 'platform', 'device', 'version', 'site', 'lang'];

export function csvCell(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows) {
  return [CSV_COLUMNS.join(','), ...rows.map((r) => CSV_COLUMNS.map((c) => csvCell(r[c])).join(','))].join('\r\n') + '\r\n';
}
