// MemeBox site: admin dashboard data, HTML and CSV.
import { escapeHtml as h } from './http.js';
import { FEATURES, REASONS } from './validate.js';

export const RATING_FACES = { 1: '😞', 2: '😐', 3: '🙂', 4: '😍' };
const REASON_TEXT = {
  'didnt-work': "Didn't work on my call",
  'too-hard': 'Too hard to use',
  'not-funny': 'Not funny',
  'found-another': 'Found another one',
  other: 'Other',
};

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
  return { total: Number(total?.n || 0), byRating, byReason, requests, used, latest };
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${h(title)}</title>
<link rel="stylesheet" href="/assets/site.css">
</head>
<body class="admin">
<main class="wrap">
${body}
</main>
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

function bars(entries) {
  const max = Math.max(1, ...entries.map(([, n]) => n));
  return `<ul class="bars">${entries.map(([label, n]) => `
    <li><span class="label">${h(label)}</span><progress max="${max}" value="${n}"></progress><b>${n}</b></li>`).join('')}</ul>`;
}

const PRODUCT_TEXT = { pictures5: '5 more pictures', pro: 'Pro (unlimited)' };

function licenseText(l) {
  return l.unlimited ? 'Pro, unlimited' : `${l.picture_slots} picture slot${l.picture_slots === 1 ? '' : 's'}`;
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
    <tr>
      <td class="nowrap"><code>${h(l.key)}</code></td>
      <td>${h(l.kind)}</td>
      <td>${h(licenseText(l))}</td>
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
  <p class="muted">Earned so far: <b>₹${h(shop.earnedInr)}</b> from ${h(shop.paidOrders)} approved order${shop.paidOrders === 1 ? '' : 's'}.</p>
  ${shop.recent.length ? `<details><summary>Last 20 decisions</summary><div class="table-wrap"><table><thead><tr><th>When</th><th>What</th><th>Result</th><th>UTR</th><th>Key</th></tr></thead><tbody>${recent}</tbody></table></div></details>` : ''}
</section>
<section class="card" id="licenses">
  <h2>License keys</h2>
  <form method="post" action="/admin/license" class="keyform">
    <input type="hidden" name="action" value="create">
    <label>Who <select name="kind"><option value="owner">Me (owner)</option><option value="gift">A friend (gift)</option></select></label>
    <label class="check"><input type="checkbox" name="unlimited" checked> Pro, unlimited</label>
    <label>or picture slots <input type="number" name="slots" min="0" max="10000" value="0"></label>
    <label>Note <input name="note" maxlength="200" placeholder="e.g. my laptop"></label>
    <button type="submit" class="primary">Make a key</button>
  </form>
  ${shop.licenses.length ? `<div class="table-wrap"><table><thead><tr><th>Key</th><th>Kind</th><th>Gives</th><th>Note</th><th>Last check</th><th></th></tr></thead><tbody>${keys}</tbody></table></div>` : '<p class="muted">No keys yet.</p>'}
</section>`;
}

export function dashboardPage(s, shopHtml = '') {
  const rated = Object.values(s.byRating).reduce((a, b) => a + b, 0);
  const avg = rated ? (Object.entries(s.byRating).reduce((a, [k, n]) => a + Number(k) * n, 0) / rated).toFixed(2) : 'n/a';
  const rows = s.latest.map((r) => `
    <tr>
      <td class="nowrap">${h(r.created_at.slice(0, 16).replace('T', ' '))}</td>
      <td>${r.type === 'uninstall' ? 'Uninstall: ' + h(REASON_TEXT[r.reason] || r.reason) : h(RATING_FACES[r.rating] || '')}</td>
      <td>${h(r.message)}${r.wants ? `<div class="muted">Wants: ${h(r.wants)}</div>` : ''}</td>
      <td>${h(r.email)}</td>
      <td class="nowrap">${h(r.version)} ${h(r.site)} ${h(r.lang)}</td>
    </tr>`).join('');
  return page('MemeBox admin', `
<header class="admin-head">
  <h1>MemeBox admin</h1>
  <a class="button" href="/admin/csv">Download CSV</a>
  <form method="post" action="/admin/logout"><button type="submit">Sign out</button></form>
</header>
${shopHtml}
<h2 class="section-title">Feedback</h2>
<p class="muted">${s.total} answers in total. Average rating: ${avg} of 4 (${rated} ratings).</p>
<div class="grid">
  <section class="card"><h2>Ratings</h2>${bars(Object.entries(s.byRating).map(([k, n]) => [RATING_FACES[k], n]))}</section>
  <section class="card"><h2>Features used</h2>${bars(Object.entries(s.used))}</section>
  <section class="card"><h2>Why people uninstalled</h2>${bars(Object.entries(s.byReason).map(([k, n]) => [REASON_TEXT[k], n]))}</section>
  <section class="card"><h2>Top requests</h2>${s.requests.length
    ? `<ol class="requests">${s.requests.map((r) => `<li>${h(r.want)} <b>×${r.n}</b></li>`).join('')}</ol>`
    : '<p class="muted">No requests yet.</p>'}</section>
</div>
<section class="card">
  <h2>Latest 50 messages</h2>
  ${s.latest.length ? `<div class="table-wrap"><table>
    <thead><tr><th>When (UTC)</th><th>Rating</th><th>Message</th><th>Email</th><th>Version, site, lang</th></tr></thead>
    <tbody>${rows}</tbody></table></div>` : '<p class="muted">No messages yet.</p>'}
</section>`);
}

// CSV with every column. Cells that start like a formula are prefixed with ' so
// spreadsheet apps show them as text instead of running them.
export const CSV_COLUMNS = ['id', 'created_at', 'type', 'rating', 'used', 'wants', 'message', 'email', 'reason', 'version', 'site', 'lang'];

export function csvCell(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows) {
  return [CSV_COLUMNS.join(','), ...rows.map((r) => CSV_COLUMNS.map((c) => csvCell(r[c])).join(','))].join('\r\n') + '\r\n';
}
