// MemeBox site: the buying funnel.
//
//   opened the buy page  ->  started checkout  ->  paid
//
// The middle and last steps are already recorded: every checkout writes a row in
// gateway_orders, and a paid one ends as 'fulfilled'. Only the first step needs counting,
// and page_hits does that with a number per day — no IP, no cookie, no visitor id.
//
// Read it as: where do people fall out? Nobody on the page means they never find it;
// on the page but no checkout means the page or the price does not convince them;
// checkout started but not paid means something breaks during payment.

export const PAGES = Object.freeze(['buy']);
export const isPage = (p) => PAGES.includes(String(p || ''));

const today = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

// One more visit. Never throws: counting must not be able to break the page it counts.
export async function countHit(db, page, now = Date.now()) {
  if (!db || !isPage(page)) return;
  try {
    await db.prepare(
      'INSERT INTO page_hits (day, page, n) VALUES (?, ?, 1) ' +
      'ON CONFLICT(day, page) DO UPDATE SET n = n + 1',
    ).bind(today(now), page, ).run();
  } catch { /* the table may not exist yet: the site keeps working without it */ }
}

const since = (days, now = Date.now()) => new Date(now - days * 86400000).toISOString();

// The three steps over the last `days` days, plus where the money stopped.
export async function funnelStats(db, { days = 30, now = Date.now() } = {}) {
  const from = since(days, now);
  const fromDay = from.slice(0, 10);

  let opened = 0;
  try {
    const row = await db.prepare('SELECT COALESCE(SUM(n), 0) AS n FROM page_hits WHERE page = ? AND day >= ?')
      .bind('buy', fromDay).first();
    opened = Number(row && row.n) || 0;
  } catch { opened = 0; } // no page_hits table yet

  let rows = [];
  try {
    rows = (await db.prepare(
      'SELECT status, product, currency, amount FROM gateway_orders WHERE created_at >= ?',
    ).bind(from).all()).results || [];
  } catch { rows = []; } // no gateway_orders table yet

  const started = rows.length;
  const paid = rows.filter((r) => r.status === 'fulfilled').length;
  const refunded = rows.filter((r) => r.status === 'refunded').length;
  const review = rows.filter((r) => r.status === 'review').length;
  const abandoned = rows.filter((r) => r.status === 'pending').length;

  // Per product: started vs paid, so a product people open but never finish stands out.
  const byProduct = new Map();
  for (const r of rows) {
    const p = byProduct.get(r.product) || { product: r.product, started: 0, paid: 0 };
    p.started += 1;
    if (r.status === 'fulfilled') p.paid += 1;
    byProduct.set(r.product, p);
  }

  // Money that actually completed, kept per currency: rupees and dollars never add up.
  const earned = {};
  for (const r of rows) {
    if (r.status !== 'fulfilled') continue;
    earned[r.currency] = (earned[r.currency] || 0) + (Number(r.amount) || 0);
  }

  return {
    days,
    opened,
    started,
    paid,
    abandoned,
    refunded,
    review,
    // Percentages are only meaningful once a step has anybody in it.
    startRate: opened ? started / opened : null,
    payRate: started ? paid / started : null,
    byProduct: [...byProduct.values()].sort((a, b) => b.started - a.started),
    earned,
  };
}

// "3 of 40 (8%)", or "3" when the step above it was never counted.
export function share(part, whole) {
  if (!whole) return String(part);
  return `${part} of ${whole} (${Math.round((part / whole) * 100)}%)`;
}
