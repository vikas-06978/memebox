// GET /api/config: public settings the static pages need. The Turnstile site key, and for
// the /buy page the products, prices and whether UPI payments are set up.
import { json, methodNotAllowed } from '../../src/http.js';
import { forSale, VPA_RE } from '../../src/shop.js';
import { gatewayEnabled, gatewayCurrencies, gatewayMode } from '../../src/gateway.js';
import { countHit } from '../../src/funnel.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  // The buy page asks for its settings with ?from=buy, so one visit is one count. It rides
  // on a request the page already makes: no extra call, no cookie, no beacon.
  const from = new URL(request.url).searchParams.get('from');
  const counted = from === 'buy';
  if (counted && env.DB) await countHit(env.DB, 'buy');
  return json({
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
    payments: !!(env.UPI_ID && VPA_RE.test(env.UPI_ID)) || gatewayEnabled(env),
    checkout: gatewayEnabled(env) ? { provider: 'razorpay', mode: gatewayMode(env), currencies: gatewayCurrencies(env) } : null,
    phonkEnabled: env.PHONK_MODE !== 'off',
    products: Object.fromEntries(forSale().map(([id, p]) => [id, { name: p.name, inr: p.inr, usd: p.usd, unlimited: p.unlimited, pictureSlots: p.pictureSlots, proSeconds: p.proSeconds, maxSeconds: p.maxSeconds, addons: p.addons }])),
    // A counted request must reach us every time, so that one is never cached.
  }, 200, { 'Cache-Control': counted ? 'no-store' : 'public, max-age=300' });
}
