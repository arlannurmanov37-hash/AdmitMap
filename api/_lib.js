/**
 * Shared helpers for the AdmitMap serverless endpoints.
 *
 * The one rule that shapes this file: the Anthropic API key and the Lemon Squeezy
 * key must never reach the browser. Everything that touches them runs here.
 */

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Lock the API to your own site(s). With ALLOWED_ORIGINS unset, allows all (dev only). */
export function cors(req, res) {
  const origin = req.headers.origin || '';
  const ok = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin);
  res.setHeader('Access-Control-Allow-Origin', ok && origin ? origin : (ALLOWED_ORIGINS[0] || '*'));
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

export function bad(res, status, message) {
  res.status(status).json({ ok: false, error: message });
}

/**
 * Validate a Lemon Squeezy license key and return the tier it grants.
 * Returns { ok, tier, error }. Never throws.
 */
export async function validateLicense(key) {
  if (!key || typeof key !== 'string' || key.length < 8) {
    return { ok: false, error: 'Missing or malformed license key.' };
  }
  // Escape hatch for local development — never set this in production.
  if (process.env.DEV_LICENSE && key === process.env.DEV_LICENSE) {
    return { ok: true, tier: 'pro' };
  }
  try {
    const r = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ license_key: key }),
    });
    const data = await r.json();
    if (!data.valid) {
      return { ok: false, error: data.error || 'This license key is not valid.' };
    }
    const status = data?.license_key?.status;
    if (status && status !== 'active') {
      return { ok: false, error: `This license is ${status}.` };
    }
    // Map the purchased variant to a tier. Fill these in from your Lemon Squeezy
    // product setup — the numeric variant IDs appear on each variant's page.
    const variantId = String(data?.meta?.variant_id || '');
    const tierByVariant = {
      [process.env.LS_VARIANT_SNAPSHOT || '__snapshot']: 'snapshot',
      [process.env.LS_VARIANT_PRO || '__pro']: 'pro',
      [process.env.LS_VARIANT_PASS || '__pass']: 'pass',
    };
    return { ok: true, tier: tierByVariant[variantId] || 'snapshot' };
  } catch (e) {
    return { ok: false, error: 'Could not reach the license service. Try again shortly.' };
  }
}
