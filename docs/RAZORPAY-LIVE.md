# Going live with Razorpay

The gateway runs in one of two modes, and `RAZORPAY_MODE` is the only thing that picks it:

| | test | live |
|---|---|---|
| `RAZORPAY_MODE` | `test` | `live` |
| `RAZORPAY_KEY_ID` | `rzp_test_...` | `rzp_live_...` |
| dollars | `RAZORPAY_TEST_INTERNATIONAL=on` | `RAZORPAY_INTERNATIONAL=on` |

The key prefix must agree with the mode. A live key under `RAZORPAY_MODE=test`, or a test key
under `live`, keeps the gateway **shut** rather than guessing — half-finished configuration must
never charge anyone. A missing `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` also keeps it shut.

Each mode has its own webhook secret, and each mode's international flag is separate: passing
the test sandbox says nothing about whether the live account may take dollars. Razorpay grants
live international payments separately, and until they do, `/buy` offers rupees only.

## Order of work

1. **Test first, against the real sandbox.** Set the test secrets, run the migrations on a
   **separate test database**, and work through the list in `payment-testing.md`: UPI and card
   success, failure, a dismissed checkout, a pending capture, a retried and an out-of-order
   webhook, a browser reload mid-payment, a shared-key top-up, and a partial and a full refund.
   A test capture creates a real, working license in whatever database it points at, so never
   point the test gateway at the database holding real licenses.
2. **Set the live secrets** in Cloudflare → Workers & Pages → memebox → Settings → Variables and
   secrets, as type **Secret**: `RAZORPAY_MODE=live`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
   `RAZORPAY_WEBHOOK_SECRET`, `PASS_SESSION_SECRET`. Never in this repo, never in chat, never in
   a screenshot. Rotate anything that has been pasted anywhere.
3. **Add the live webhook** in the Razorpay dashboard pointing at
   `https://<site>/api/razorpay-webhook`, subscribed to `payment.captured`, `order.paid` and
   `refund.processed`, with the same secret you set above.
4. **Run the production migrations** (`2026-10-gateway.sql`, `2026-10-pass-sessions.sql`) against
   the live database, then deploy.
5. **Buy one thing yourself** with a real card or UPI — the cheapest pass — and check the key
   arrives, `/admin/payments` shows it, and the money reaches the bank account. Then refund it
   from the Razorpay dashboard and check `/admin/payments` records the refund.
6. **Open the shop**: `SHOP_OPEN: true` in `extension/config.js`, then publish the extension.

## What the code does not do

- Refunds are started in the Razorpay dashboard. The site records a processed refund; it cannot
  issue one.
- `/admin/payments` shows **captured gross amounts**. That is not settlement and not earnings:
  Razorpay's fees and GST come off before the bank deposit.
- A full refund revokes its key only when no other paid purchase sits on that key. Shared keys,
  partial refunds and top-ups of a revoked key are marked `review` for a person to settle, so
  an unrelated purchase is never erased.
- Signed usage reports stop an altered or replayed report from spending a pass twice. They cannot
  prove a modified extension really joined a call or reported its time honestly.
- If one Razorpay account also serves another site, its payments need that site's own order
  records. MemeBox acknowledges a signed event for an order it does not know without granting
  anything, so Razorpay stops retrying it. One settlement account does not split bank deposits
  per site: keep the books separate yourself.

## Tax and compliance, before taking real money

Selling to the public has obligations the code cannot cover: GST registration and invoices if
you cross the threshold, the price shown including tax, a refund and cancellation policy on the
site, and the Chrome Web Store's own declaration that the extension sells things. Check these
with an accountant rather than guessing.
