# AdmitMap API — deploy in ~20 minutes

Two endpoints. Both exist for one reason: **your Anthropic API key can never touch the
browser.** Anything that reads it runs here.

| Endpoint | Does |
|---|---|
| `POST /api/license` | Validates a Lemon Squeezy license key → returns the tier |
| `POST /api/essay` | Validates the license, then grades the essay with Claude |

---

## 1. Get the keys (~5 min)

**Anthropic** — [console.anthropic.com](https://console.anthropic.com) → API keys → Create.

> ⚠️ **Set a monthly spend limit on this key before you use it.** You promised
> "unlimited essays"; the cap is what stops one abuser from spending more in a weekend
> than you made all month. Console → Limits.

**Lemon Squeezy** — create your three products (Snapshot $9.99, Pro $39/mo, Pass $149/yr).
For each, enable **license keys** in the variant settings, then copy the numeric
**variant ID** from the variant's page URL.

---

## 2. Deploy (~10 min)

No Node needed locally — deploy through GitHub.

1. Push this repo to GitHub.
2. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Framework preset: **Other**. No build command. Output directory: leave blank.
4. **Settings → Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | `sk-ant-...` |
   | `LS_VARIANT_SNAPSHOT` | numeric variant ID |
   | `LS_VARIANT_PRO` | numeric variant ID |
   | `LS_VARIANT_PASS` | numeric variant ID |
   | `ALLOWED_ORIGINS` | `https://yourdomain.com` |

5. Deploy. Vercel auto-detects `api/*.js` as serverless functions.

`ALLOWED_ORIGINS` matters: without it, anyone can point their own site at your endpoint
and spend your API budget.

---

## 3. Test

```bash
# Should reject — no valid license
curl -X POST https://YOUR-APP.vercel.app/api/essay \
  -H 'Content-Type: application/json' \
  -d '{"key":"bogus","essay":"..."}'
# → {"ok":false,"error":"This license key is not valid."}
```

To test grading before Lemon Squeezy is live, set `DEV_LICENSE=dev-test-key` in Vercel,
then send `"key":"dev-test-key"`. **Remove it before launch** — it bypasses payment.

---

## 4. Connect the frontend

The platform already calls these endpoints. It reads the license from
`localStorage.admitmap_license`, so after checkout store the key:

```js
localStorage.setItem('admitmap_license', keyFromCheckout);
```

If the site is served from the same domain as the API, nothing else is needed. Otherwise
set `window.ADMITMAP_API = 'https://YOUR-APP.vercel.app'` before the platform script runs.

---

## What this replaces

Both essay graders previously **hashed the essay text** and derived scores from the hash —
same essay, same numbers, but the numbers meant nothing. They now call Claude and return
real per-dimension scores plus specific strengths and fixes that quote the actual draft.

## Cost

Roughly **$0.03–0.08 per essay** graded (Opus 4.8, ~1–2k input, ~1k output). At 100
graded essays a month that's ~$5. The spend cap on the key is your ceiling.

## Notes

- Scoring is anchored in the system prompt to a realistic distribution (5–6 average,
  7.5–8.5 strong, 9+ rare) so grades don't drift upward into meaninglessness.
- Structured outputs guarantee parseable JSON — the UI never guesses at free text.
- `stop_reason === 'refusal'` is handled explicitly rather than crashing on empty content.
