import { json, methodNotAllowed, readJsonLimited, RequestBodyError } from '../../src/http.js';
import { rateLimit, clientIp } from '../../src/security.js';
import { gatewayEnabled, GatewayError, createGatewayOrder, recoveredOrder, gatewayView, confirmGatewayPayment } from '../../src/gateway.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  if (!env.DB || !gatewayEnabled(env)) return json({ ok: false, error: 'Test checkout is not configured.' }, 503);
  if (request.headers.get('Origin') && request.headers.get('Origin') !== new URL(request.url).origin) return json({ ok: false, error: 'Invalid origin.' }, 403);
  try {
    const body = await readJsonLimited(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new GatewayError('Send a JSON object.');
    const limit = await rateLimit(env.DB, { salt: env.RATE_SALT || env.ADMIN_KEY || '', ip: clientIp(request), bucket: 'checkout', max: 60 });
    if (!limit.allowed) return json({ ok: false, error: 'Too many requests. Try again later.' }, 429);
    if (body.action === 'status') return json({ ok: true, order: gatewayView(await recoveredOrder(env, body.orderId, body.recoveryToken)) });
    if (body.action === 'confirm') return json({ ok: true, order: await confirmGatewayPayment(env, body) });
    if (body.action !== 'create') throw new GatewayError('Unknown action.');
    // Aggregate cap supplements per-IP limits, including a distributed flood of valid orders.
    const cap = await rateLimit(env.DB, { salt: env.RATE_SALT || env.ADMIN_KEY || '', ip: 'global', bucket: 'checkout-create', max: 50, windowHours: 24 });
    if (!cap.allowed) return json({ ok: false, error: 'Checkout limit reached. Please try tomorrow.' }, 429);
    return json({ ok: true, checkout: await createGatewayOrder(env, body) });
  } catch (error) {
    if (error instanceof GatewayError || error instanceof RequestBodyError) return json({ ok: false, error: error.message }, error.status);
    if (error instanceof SyntaxError) return json({ ok: false, error: 'Send JSON.' }, 400);
    return json({ ok: false, error: 'Checkout could not complete. Please try later.' }, 502);
  }
}
