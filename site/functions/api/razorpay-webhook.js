import { json, methodNotAllowed } from '../../src/http.js';
import { hmacHex, safeEqual } from '../../src/security.js';
import { gatewayEnabled, GatewayError, fulfillCaptured, recordRefund } from '../../src/gateway.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  if (!env.DB || !gatewayEnabled(env)) return json({ ok: false }, 503);
  const signature = request.headers.get('X-Razorpay-Signature') || '';
  if (!/^[a-f0-9]{64}$/.test(signature)) return json({ ok: false }, 403);
  // Bound the stream before allocating/parsing the full body. Verify the original UTF-8 bytes.
  const reader = request.body?.getReader();
  if (!reader) return json({ ok: false }, 400);
  const chunks = []; let length = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > 65536) { await reader.cancel(); return json({ ok: false }, 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let raw;
  try { raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return json({ ok: false }, 400); }
  if (!safeEqual(signature, await hmacHex(env.RAZORPAY_WEBHOOK_SECRET, bytes))) return json({ ok: false }, 403);
  try {
    const event = JSON.parse(raw);
    if (event.event === 'payment.captured' || event.event === 'order.paid') await fulfillCaptured(env, event.payload?.payment?.entity);
    else if (event.event === 'refund.processed') await recordRefund(env, event.payload?.refund?.entity);
    return json({ ok: true });
  } catch (error) {
    // One Razorpay account can serve both MemeBox and mykrutidev.com. A valid event
    // for another site's order needs acknowledgment, not repeated failed deliveries.
    if (error instanceof GatewayError && error.status === 404) return json({ ok: true, ignored: true });
    return json({ ok: false }, error instanceof GatewayError ? error.status : 500);
  }
}
