import { hmacHex, safeEqual } from './security.js';
import { getLicense, licenseView } from './shop.js';

export const signedPassesEnabled = env => typeof env.PASS_SESSION_SECRET === 'string' && env.PASS_SESSION_SECRET.length >= 32;
export async function openPassSession(env, key, now = Date.now(), previousToken = '') {
  if (previousToken) {
    const match = /^([a-f0-9-]{36})\.(\d{13})\.([0-9a-f]{64})$/.exec(previousToken);
    if (!match || !safeEqual(match[3], await hmacHex(env.PASS_SESSION_SECRET, `${match[1]}|${key}|${match[2]}`))) throw new Error('Invalid renewal.');
    const row = await env.DB.prepare('SELECT * FROM pass_sessions WHERE id = ? AND license_key = ? AND expires_at = ?').bind(match[1], key, Number(match[2])).first();
    if (!row) throw new Error('Session no longer available.');
    const expires = now + 30 * 86400000;
    await env.DB.prepare('UPDATE pass_sessions SET expires_at = ? WHERE id = ?').bind(expires, row.id).run();
    return { token: `${row.id}.${expires}.${await hmacHex(env.PASS_SESSION_SECRET, `${row.id}|${key}|${expires}`)}`, billed: row.billed };
  }
  const id = crypto.randomUUID(), expires = now + 30 * 86400000;
  const signature = await hmacHex(env.PASS_SESSION_SECRET, `${id}|${key}|${expires}`);
  // Keep expired receipts for one year so a lost response can be reconciled on renewal.
  await env.DB.prepare('DELETE FROM pass_sessions WHERE expires_at < ?').bind(now - 365 * 86400000).run();
  await env.DB.prepare('INSERT INTO pass_sessions (id, license_key, issued_at, expires_at) VALUES (?, ?, ?, ?)').bind(id, key, now, expires).run();
  return { token: `${id}.${expires}.${signature}`, billed: 0 };
}

export async function billPassSession(env, key, token, total, now = Date.now()) {
  const match = /^([a-f0-9-]{36})\.(\d{13})\.([a-f0-9]{64})$/.exec(token || '');
  if (!match || Number(match[2]) <= now || !Number.isSafeInteger(total) || total < 0 || total > 864000) throw new Error('Invalid pass report.');
  if (!safeEqual(match[3], await hmacHex(env.PASS_SESSION_SECRET, `${match[1]}|${key}|${match[2]}`))) throw new Error('Invalid pass report.');
  const session = await env.DB.prepare('SELECT * FROM pass_sessions WHERE id = ? AND license_key = ?').bind(match[1], key).first();
  // Usage may predate session issuance after an offline call. Wall-clock time cannot prove
  // honest client usage; bound each debit instead of rejecting legitimate offline backlogs.
  if (!session || session.expires_at !== Number(match[2]) || total - session.billed > 600) throw new Error('Invalid pass report.');
  const claim = crypto.randomUUID();
  // Claim and debit in one D1 transaction; retries and stale cumulative reports cannot debit twice.
  await env.DB.batch([
    env.DB.prepare('UPDATE pass_sessions SET delta = ? - billed, billed = ?, claim = ? WHERE id = ? AND billed < ? AND EXISTS (SELECT 1 FROM licenses WHERE key = ? AND status = \'active\')')
      .bind(total, total, claim, session.id, total, key),
    env.DB.prepare(`UPDATE licenses SET
      pro_seconds = MAX(0, pro_seconds - MAX(0, (SELECT delta FROM pass_sessions WHERE id = ?) - max_seconds)),
      max_seconds = MAX(0, max_seconds - (SELECT delta FROM pass_sessions WHERE id = ?))
      WHERE key = ? AND status = 'active' AND EXISTS (SELECT 1 FROM pass_sessions WHERE id = ? AND claim = ?)`)
      .bind(session.id, session.id, key, session.id, claim),
  ]);
  const row = await getLicense(env.DB, key);
  const fresh = await env.DB.prepare('SELECT billed FROM pass_sessions WHERE id = ?').bind(session.id).first();
  return { license: licenseView(row), billed: fresh.billed };
}
