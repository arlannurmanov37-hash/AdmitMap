/**
 * Shared helpers for the AdmitMap serverless endpoints.
 *
 * The one rule that shapes this file: the Anthropic API key and the Polar token
 * must never reach the browser. Everything that touches them runs here.
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

export function bad(res, status, message, extra) {
  res.status(status).json({ ok: false, error: message, ...(extra || {}) });
}

/* ── Polar ───────────────────────────────────────────────────────────
   POLAR_SERVER=sandbox переключает на тестовый Polar (sandbox.polar.sh):
   там свой токен и свои продукты. */
const POLAR_API = process.env.POLAR_SERVER === 'sandbox'
  ? 'https://sandbox-api.polar.sh/v1'
  : 'https://api.polar.sh/v1';

export async function polar(path, init = {}) {
  const r = await fetch(POLAR_API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN || ''}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
  return { status: r.status, ok: r.ok, data };
}

const TIERS = { chances: 19, full: 29 };

/* Продукт ищем по metadata tier (chances / full), а не по ID в коде:
   ID меняется при пересоздании продукта и отличается в sandbox. */
let productCache = null, productCacheAt = 0;
export async function productForTier(tier) {
  if (!productCache || Date.now() - productCacheAt > 10 * 60 * 1000) {
    const r = await polar('/products/?is_archived=false&limit=100');
    if (!r.ok || !r.data) return null;
    productCache = r.data.items || [];
    productCacheAt = Date.now();
  }
  return productCache.find((p) => p && p.metadata && p.metadata.tier === tier) || null;
}

/* Оплаченные чекауты помним в памяти инстанса, чтобы не дёргать Polar
   на каждый запрос оценки. */
const verified = new Map();

/**
 * Проверяет, что чекаут Polar оплачен. Returns { ok, tier, price, email, pending, error }.
 * Never throws.
 */
export async function verifyPurchase(checkoutId) {
  const id = typeof checkoutId === 'string' ? checkoutId.trim() : '';
  // Местная проверка без оплаты — только если DEV_LICENSE задан. На проде его быть не должно.
  if (process.env.DEV_LICENSE && id === process.env.DEV_LICENSE) {
    return { ok: true, tier: 'full', price: 29 };
  }
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) return { ok: false, error: 'Missing or malformed purchase id.' };
  if (verified.has(id)) return verified.get(id);
  if (!process.env.POLAR_ACCESS_TOKEN) return { ok: false, error: 'Payments are not configured.' };

  try {
    const r = await polar('/checkouts/' + encodeURIComponent(id));
    if (r.status === 404) return { ok: false, error: 'We could not find this purchase.' };
    if (!r.ok || !r.data) return { ok: false, error: 'Could not reach the payment service. Try again shortly.' };
    const c = r.data;
    // confirmed — оплата принята, заказ ещё создаётся: несколько секунд
    if (c.status === 'confirmed') return { ok: false, pending: true, error: 'Payment is still processing.' };
    if (c.status !== 'succeeded') return { ok: false, error: 'This purchase is not paid.' };

    let tier = c.product && c.product.metadata && c.product.metadata.tier;
    if (!tier && c.product_id) {
      const p = await polar('/products/' + encodeURIComponent(c.product_id));
      tier = p.ok && p.data && p.data.metadata ? p.data.metadata.tier : null;
    }
    if (!TIERS[tier]) return { ok: false, error: 'This purchase is not an AdmitMap report.' };

    const out = { ok: true, tier, price: TIERS[tier], email: c.customer_email || null };
    verified.set(id, out);
    return out;
  } catch (e) {
    return { ok: false, error: 'Could not reach the payment service. Try again shortly.' };
  }
}

/* Грубый лимит на оценки: один оплаченный отчёт — несколько пересчётов
   (ученик дописал эссе), но не бесконечный цикл. Память инстанса, поэтому
   это страховка, а не учёт; потолок расходов стоит на ключе Anthropic. */
const calls = new Map();
export function overLimit(bucket, id, max = 8, windowMs = 60 * 60 * 1000) {
  const k = bucket + ':' + id, now = Date.now();
  const hits = (calls.get(k) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  calls.set(k, hits);
  return hits.length > max;
}
