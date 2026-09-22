# AdmitMap API

Everything that touches a secret (the Anthropic key, the Polar token) runs here, never in
the browser.

| Endpoint | Does |
|---|---|
| `POST /api/checkout` `{tier: 19\|29, email?}` | Creates a Polar checkout, returns `{url}` |
| `POST /api/verify` `{checkout_id}` | Confirms the checkout is paid, returns `{tier, price}` (`pending` while Polar finishes) |
| `POST /api/activities` `{checkout_id, activities}` | Depth 25 · Leadership 25 · Impact 25 · Progression 15 per activity, Personal narrative 10 for the list; Spike roll-up |
| `POST /api/essay` `{checkout_id, essay, prompt?}` | Grades the essay on the six-criterion rubric |
| `POST /api/license` `{key}` | Old name of `/api/verify`, kept for platform.html |

## Flow

1. Paywall → `/api/checkout` → student pays on Polar.
2. Polar returns to `/report?checkout_id=…` → the report calls `/api/verify`.
3. The report sends activities and essay to the two scoring endpoints (only for a paid
   checkout), stores the scores with a fingerprint of the text, then computes chances.
   Same text → same score → same chances. Edited essay → re-scored.

On `localhost` the report skips payment (for `test-profiles.html`).

## Environment (Vercel → Settings → Environment Variables, Production)

See `.env.example`: `ANTHROPIC_API_KEY`, `POLAR_ACCESS_TOKEN`, `ALLOWED_ORIGINS`.
Polar products are looked up by metadata `tier` = `chances` / `full`, so no product IDs.

## Safety

- Set a monthly spend limit on the Anthropic key.
- Scoring endpoints require a paid checkout and are rate-limited per checkout.
- `DEV_LICENSE` bypasses payment — never set it in production.
- Both model calls use `fallbacks: "default"`: if Claude Opus 5 declines, Anthropic re-runs
  the request on its recommended fallback model inside the same call.
