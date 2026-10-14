# Local payment and pass testing

Nothing has been deployed, no remote migration has run, and live payments remain closed. The gateway code deliberately accepts only Razorpay **test** keys and `RAZORPAY_MODE=test`. It refuses live mode, even with a live key.

## Configuration for an isolated test environment

Use a separate test D1 database for any hosted preview. Test captures create functional licenses in that database; never enable the test gateway against the live license database. Local `npm run site:dev` uses SQLite.

Set secret values only in ignored local development configuration or secure environment settings. Never paste them into chat, code, commits or screenshots:

- `RAZORPAY_KEY_ID`: the test key ID.
- `RAZORPAY_KEY_SECRET`: the corresponding test secret.
- `RAZORPAY_WEBHOOK_SECRET`: independently generated webhook secret matching the test dashboard.
- `PASS_SESSION_SECRET`: independently generated random secret of at least 32 characters.

Set `RAZORPAY_MODE=test`. USD test checkout additionally requires `RAZORPAY_TEST_INTERNATIONAL=on`; this does not establish eligibility for live international payments. `PASS_LEGACY_REPORTS=off` rejects unsigned usage reports, so leave legacy reports available until installed older extensions have a compatible rollout path.

New local schema tables are included in `site/db/schema.sql`. The production migration files are `2026-10-gateway.sql` and `2026-10-pass-sessions.sql`; do not apply them remotely until the owner authorizes deployment.

The future test webhook endpoint is `/api/razorpay-webhook`. Subscribe to `payment.captured`, `order.paid` and `refund.processed`. Provider webhooks require a reachable test preview; local automated tests use signed fixtures and do not contact Razorpay.

If the same Razorpay account serves mykrutidev.com, its payments must use that site's separate order records and entitlement code. MemeBox acknowledges signed events for unknown orders without granting access, avoiding needless retries for the other website. Keep separate site-specific webhook secrets and reports; one settlement account does not automatically separate bank deposits into site-specific pockets.

## Behavior and safeguards

Prices and entitlement snapshots are fixed on the server. Checkout confirmation verifies its signature and fetches the payment from Razorpay before fulfillment. The webhook authenticates the original request bytes. A pending/authorized payment or dismissed checkout never issues a key. Duplicate concurrent capture delivery cannot grant twice. Manual UPI approval also uses an atomic transaction.

Recovery requires a random secret stored hashed in D1. The browser keeps receipts for its last 100 test orders locally, not in query strings or referrals, with a picker for previous purchases. Clearing browser storage loses that browser's recovery shortcuts; support can reconcile the order in the admin. `/admin/payments` is behind the existing authenticated admin session and separates INR/USD gross test totals from refunds. Gross capture totals are not settlements or net earnings.

Processed refunds are recorded idempotently. A full standalone refund can revoke its key only if there are no other recorded paid purchases on it. Shared keys, partial refunds and revoked-key top-ups need admin review so unrelated purchases remain safe. Refund initiation is still through the provider dashboard; no live refund operation has been added.

Signed usage reports use cumulative counters, atomic Max-first debits, replay protection and persistent retry targets. The client preserves unreported offline debt when synchronizing a capped chunk, and synchronizes stopped-pass debt on worker wake. Changing/removing a key first synchronizes outstanding usage so another key is not charged. Long backlogs or a rate limit can require another worker wake; debt stays recorded. Sessions renew after 30 days while retaining receipts; expired receipts are kept for one year. Signing prevents altered/replayed reports from spending twice; it does not prove that a modified client really joined a call or honestly reported usage. Legacy reports do not gain replay protection merely by adding the new endpoint.

Checkout creation has a global limit of 50 orders per UTC day plus per-IP request limits. Application rate limits do not guarantee zero infrastructure costs under arbitrary traffic. Keep the free Cloudflare account limits and hosted-audio opt-in described in `upgrade-progress.md`.

## Provider checks still required

After approval and secure test configuration: exercise UPI/card success, failure, cancellation, pending capture, webhook retry/out-of-order delivery, browser reload, shared-key top-up, partial/full refunds and receipts against Razorpay's actual test environment. Confirm gateway fees, settlement account requirements and international eligibility directly with Razorpay. Live support, tax/invoice requirements, final localized checkout copy and bank settlement reconciliation remain release work.
