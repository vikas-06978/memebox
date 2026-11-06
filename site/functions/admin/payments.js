import { isAdmin } from '../../src/security.js';
import { adminRedirect, adminResponse, escapeHtml as h, methodNotAllowed } from '../../src/http.js';
import { gatewayMode } from '../../src/gateway.js';

export async function onRequest({ request, env }) {
  if (!await isAdmin(request, env)) return adminRedirect('/admin');
  if (request.method !== 'GET') return methodNotAllowed('GET');
  let rows, totals;
  try {
    rows = (await env.DB.prepare('SELECT id, created_at, product, currency, amount, status, payment_id, refunded_amount FROM gateway_orders ORDER BY created_at DESC LIMIT 100').all()).results;
    totals = (await env.DB.prepare("SELECT currency, COUNT(*) AS n, SUM(amount) AS paid, SUM(refunded_amount) AS refunded FROM gateway_orders WHERE payment_id IS NOT NULL GROUP BY currency").all()).results;
  } catch {
    return adminResponse('<!doctype html><title>Payments unavailable</title><p>The local gateway migration has not been applied.</p><a href="/admin">Back</a>', { status: 503 });
  }
  const money = (currency, value) => `${currency} ${(Number(value) / 100).toFixed(2)}`;
  const live = gatewayMode(env) === 'live';
  return adminResponse(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${live ? 'Payments' : 'Test payments'} | MemeBox</title><link rel="stylesheet" href="/assets/site.css"><main class="wrap"><a href="/admin">← Admin</a><h1>Razorpay ${live ? 'live' : 'test'} payments</h1>
    <p>${live ? 'Real payments.' : 'Test records only.'} These are captured gross amounts, not bank settlements or earnings. Provider fees are not deducted.</p>
    ${totals.map(t => `<section class="card"><h2>${h(t.currency)}</h2><p>${h(t.n)} captured payments · Gross ${h(money(t.currency, t.paid))} · Refunded ${h(money(t.currency, t.refunded))}</p></section>`).join('')}
    <p>Refunds and revoked-key top-ups marked review need manual entitlement reconciliation. Never revoke unrelated purchases on a shared key.</p>
    <table><thead><tr><th>Order</th><th>Product</th><th>Paid</th><th>Status</th><th>Refunded</th></tr></thead><tbody>${rows.map(r => `<tr><td>${h(r.id)}<br>${h(r.created_at)}</td><td>${h(r.product)}</td><td>${h(money(r.currency, r.amount))}</td><td>${h(r.status)}</td><td>${h(money(r.currency, r.refunded_amount))}</td></tr>`).join('')}</tbody></table></main></html>`);
}
