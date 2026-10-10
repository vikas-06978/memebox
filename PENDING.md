# Pending (for Wednesday)

## You (owner)
- Run the D1 migration once, then deploy the site:
  `npx wrangler d1 execute memebox-feedback --remote --file=db/migrations/2026-10-time-pass.sql`, then `npx wrangler pages deploy --branch=main` from `site/`.
- Set the `UPI_ID` secret in Cloudflare (a free UPI merchant ID is better than a personal one), so /buy opens.
- Buy the `.site` domain; give the Chrome Web Store URL for the install buttons.
- Make the GitHub repo private (the site must not link to it).
- Test the latest zips on a real Google Meet call: camera quality, lamp follow, animals, own music, adding sounds in a call.

## Me (after your go-ahead)
- ML tracking with MediaPipe (face landmarks: tongue out, mouth, smile; hands: real wave; accurate follow). Bundled locally, with the old tracker as fallback. Must be tested in real Meet (page CSP/wasm).
- Razorpay in test mode first: signed webhooks, server-side prices, secrets via wrangler; card payment for dollars.
- Server-signed pass sessions (anti-cheat for the time passes).
- Live Lights demo on the website.
- Store listing wording, version 2.0.0 (this is the 2nd big version; the number stays 1.2.6 until you say), final tutorial video and store zip (only when you say).
- Dollar prices stay $1.49 / 2.49 / 3.99 / 5.49 (rupees ₹9 / 15 / 25 / 35).
- Check if the "Start here" card is too tall; shrink if needed.
