// Application budgets for hosted files. These cap successful delivery, not Cloudflare
// billing: rejected requests still invoke Functions/D1. Keep the account on Free.
export const DELIVERY_LIMITS = Object.freeze({ dailyFiles: 500, dailyMB: 512, monthlyFiles: 5000, monthlyMB: 4096 });

const limit = (env, name, fallback) => {
  if (env[name] === undefined || env[name] === '') return fallback;
  const value = Number(env[name]);
  // Invalid settings fail closed. Zero intentionally pauses that budget.
  return Number.isSafeInteger(value) && value >= 0 ? Math.min(value, fallback) : 0;
};

async function reserve(db, key, expires, weight, max) {
  if (!max || weight > max) return false;
  const row = await db.prepare(
    'INSERT INTO rate_limits (key, hour, count) SELECT ?, ?, ? WHERE ? <= ? ' +
    'ON CONFLICT(key) DO UPDATE SET count = count + excluded.count ' +
    'WHERE rate_limits.count + excluded.count <= ? RETURNING count',
  ).bind(key, expires, weight, weight, max, max).first();
  return !!row;
}

export async function reserveHostedDelivery(env, bytes, now = Date.now()) {
  if (!env.DB || !Number.isSafeInteger(bytes) || bytes <= 0) return false;
  const date = new Date(now), day = date.toISOString().slice(0, 10), month = day.slice(0, 7);
  const dayEnd = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1) / 3600000) - 1;
  const monthEnd = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 3600000) - 1;
  // Each reservation is atomic. Failed/abandoned deliveries retain reservations,
  // preferring less capacity over a refund race that could exceed a global cap.
  const budgets = [
    ['day-files', day, dayEnd, 1, limit(env, 'PACK_GLOBAL_DAILY_FILES', DELIVERY_LIMITS.dailyFiles)],
    ['day-bytes', day, dayEnd, bytes, limit(env, 'PACK_GLOBAL_DAILY_MB', DELIVERY_LIMITS.dailyMB) * 1048576],
    ['month-files', month, monthEnd, 1, limit(env, 'PACK_GLOBAL_MONTHLY_FILES', DELIVERY_LIMITS.monthlyFiles)],
    ['month-bytes', month, monthEnd, bytes, limit(env, 'PACK_GLOBAL_MONTHLY_MB', DELIVERY_LIMITS.monthlyMB) * 1048576],
  ];
  for (const [name, window, expires, weight, max] of budgets) {
    if (!(await reserve(env.DB, `hosted:${name}:${window}`, expires, weight, max))) return false;
  }
  return true;
}

export async function hostedUsage(env, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10), month = day.slice(0, 7);
  const specs = [
    ['dayFiles', `hosted:day-files:${day}`, 'PACK_GLOBAL_DAILY_FILES', DELIVERY_LIMITS.dailyFiles, 1],
    ['dayMB', `hosted:day-bytes:${day}`, 'PACK_GLOBAL_DAILY_MB', DELIVERY_LIMITS.dailyMB, 1048576],
    ['monthFiles', `hosted:month-files:${month}`, 'PACK_GLOBAL_MONTHLY_FILES', DELIVERY_LIMITS.monthlyFiles, 1],
    ['monthMB', `hosted:month-bytes:${month}`, 'PACK_GLOBAL_MONTHLY_MB', DELIVERY_LIMITS.monthlyMB, 1048576],
  ];
  const rows = (await env.DB.prepare('SELECT key, count FROM rate_limits WHERE key IN (?, ?, ?, ?)').bind(...specs.map((s) => s[1])).all()).results;
  const counts = new Map(rows.map((r) => [r.key, Number(r.count) || 0]));
  return Object.fromEntries(specs.map(([name, key, setting, fallback, divisor]) => [name, { used: (counts.get(key) || 0) / divisor, limit: limit(env, setting, fallback) }]));
}
