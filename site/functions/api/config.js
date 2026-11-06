// GET /api/config: public settings the static pages need. The Turnstile site key, and for
// the /buy page the products, prices and whether UPI payments are set up.
import { json, methodNotAllowed } from '../../src/http.js';
import { forSale, VPA_RE } from '../../src/shop.js';
import { gatewayEnabled, gatewayCurrencies, gatewayMode } from '../../src/gateway.js';

export function onRequest({ request, env }) {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  return json({
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
    payments: !!(env.UPI_ID && VPA_RE.test(env.UPI_ID)) || gatewayEnabled(env),
    checkout: gatewayEnabled(env) ? { provider: 'razorpay', mode: gatewayMode(env), currencies: gatewayCurrencies(env) } : null,
    phonkEnabled: env.PHONK_MODE !== 'off',
    products: Object.fromEntries(forSale().map(([id, p]) => [id, { name: p.name, inr: p.inr, usd: p.usd, unlimited: p.unlimited, pictureSlots: p.pictureSlots, proSeconds: p.proSeconds, maxSeconds: p.maxSeconds, addons: p.addons }])),
  }, 200, { 'Cache-Control': 'public, max-age=300' });
}
