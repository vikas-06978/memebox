-- Apply only when the owner authorizes deployment. Separate from legacy UPI orders.
CREATE TABLE IF NOT EXISTS gateway_orders (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  product TEXT NOT NULL,
  currency TEXT NOT NULL CHECK(currency IN ('INR', 'USD')),
  amount INTEGER NOT NULL CHECK(amount > 0),
  snapshot TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  gateway_id TEXT UNIQUE,
  payment_id TEXT UNIQUE,
  for_key TEXT NOT NULL DEFAULT '',
  license_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'fulfilled', 'refunded', 'review')),
  claim TEXT NOT NULL DEFAULT '',
  fulfilled_at TEXT,
  refunded_amount INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS gateway_orders_created ON gateway_orders(created_at);
CREATE TABLE IF NOT EXISTS gateway_refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  created_at TEXT NOT NULL
);
