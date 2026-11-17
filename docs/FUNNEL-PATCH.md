# Buying funnel: what to add

The live site runs a newer codebase than this repository, so these changes have to be
carried over by hand. They are all additive: nothing existing is removed or renamed, and
every piece fails quietly if the table is missing, so a half-applied patch cannot break
the site.

Source: branch `claude/launch-razorpay-live`, commit `eb81cde`.

## What it answers

Without this, the admin can only see people who already started a checkout. That cannot
tell "nobody finds the buy page" apart from "they see it and are not convinced" — two
problems with completely different fixes.

    opened the buy page  ->  started a checkout  ->  paid

The last two steps are already recorded in `gateway_orders`. Only the first needs counting.

## 1. The table (already applied)

`site/db/migrations/2026-11-funnel.sql`

```sql
CREATE TABLE IF NOT EXISTS page_hits (
  day  TEXT    NOT NULL,              -- YYYY-MM-DD, UTC
  page TEXT    NOT NULL,              -- 'buy' for now
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, page)
);
```

Counts only: no IP, no cookie, no visitor id, nothing that identifies a person. Add the
same block to `site/db/schema.sql` so fresh databases and local tests have it too.

## 2. `site/src/funnel.js` — new file

Copy it from the commit. It holds `countHit`, `funnelStats` and `share`. Both database
calls are wrapped in try/catch: counting must never be able to break the page it counts.

## 3. `site/functions/api/config.js`

```diff
+import { countHit } from '../../src/funnel.js';

-export function onRequest({ request, env }) {
+export async function onRequest({ request, env }) {
   if (request.method !== 'GET') return methodNotAllowed('GET');
+  const from = new URL(request.url).searchParams.get('from');
+  const counted = from === 'buy';
+  if (counted && env.DB) await countHit(env.DB, 'buy');
   return json({
     ...
-  }, 200, { 'Cache-Control': 'public, max-age=300' });
+  }, 200, { 'Cache-Control': counted ? 'no-store' : 'public, max-age=300' });
 }
```

`onRequest` becomes `async`. The counted answer must not be cached or most visits never
reach the server; every other page keeps the 5-minute cache.

## 4. `site/public/assets/buy.js`

One line — the buy page asks for its settings with the marker:

```diff
-fetch('/api/config')
+fetch('/api/config?from=buy')
```

It rides on a request the page already makes, so there is no extra call and no beacon.
**This is the line most likely to be missed, and without it nothing is ever counted.**

## 5. `site/src/admin.js`

Add `buying: await safe(() => funnelStats(db, { days: DAYS }), null)` to what
`loadActivity` returns, and render `buyingCard(a.buying)` next to the existing funnel
card. Copy `buyingCard` from the commit. It shows the three steps, the two drop-off
percentages, which product people start and abandon, and says in words which of the two
gaps is the problem — the three numbers alone are easy to misread. Rupees and dollars are
kept apart, never added up.

## Check it works

1. Open `https://<site>/api/config?from=buy` in a browser.
2. `SELECT * FROM page_hits;` should show today with `n` of 1, rising on each reload.

If that counts but opening `/buy` does not, step 4 was missed.

Counting starts from the day it ships: it does not fill in the past.
