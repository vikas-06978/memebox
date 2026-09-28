# Cloudflare Pages Functions

The MemeBox site's small API. Each file is a route:

| Route | File | What it does |
| --- | --- | --- |
| `POST /api/feedback` | `api/feedback.js` | Feedback form and uninstall survey. Validates, rate limits, checks Turnstile, stores in D1. |
| `GET /api/config` | `api/config.js` | The public Turnstile site key for the forms. |
| `GET/POST /admin` | `admin/index.js` | Sign in with `ADMIN_KEY`, then the dashboard. |
| `GET /admin/csv` | `admin/csv.js` | Every answer as CSV (signed in only). |
| `POST /admin/logout` | `admin/logout.js` | Signs out. |

Shared code lives in `../src` (validation, security, admin views) so it can be unit tested in Node.
The database schema is `../db/schema.sql`. Payments will be added here later (see the README).
