/**
 * POST /api/checkout  { tier: 19 | 29, email? }  ->  { ok, url }
 *
 * Creates a Polar checkout for the chosen report and returns its URL. After
 * payment Polar sends the student back to /report?checkout_id=..., where
 * /api/verify confirms the payment.
 */
import { cors, bad, polar, productForTier } from './_lib.js';

const SITE = (process.env.SITE_URL || 'https://www.admitmap.app').replace(/\/$/, '');

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return bad(res, 405, 'Use POST.');
  if (!process.env.POLAR_ACCESS_TOKEN) return bad(res, 503, 'Payments are not configured yet.');

  const { tier, email } = req.body || {};
  const key = Number(tier) === 29 ? 'full' : Number(tier) === 19 ? 'chances' : null;
  if (!key) return bad(res, 400, 'Choose a report.');

  const product = await productForTier(key);
  if (!product) return bad(res, 503, 'This report is not available right now.');

  const body = {
    products: [product.id],
    // {CHECKOUT_ID} Polar подставляет сам
    success_url: SITE + '/report?checkout_id={CHECKOUT_ID}',
    metadata: { tier: key }
  };
  if (typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    body.customer_email = email.trim();
  }

  const r = await polar('/checkouts/', { method: 'POST', body: JSON.stringify(body) });
  if (!r.ok || !r.data || !r.data.url) {
    console.error('polar checkout failed', r.status, JSON.stringify(r.data || {}).slice(0, 300));
    return bad(res, 502, 'Could not start checkout. Please try again.');
  }
  res.status(200).json({ ok: true, url: r.data.url });
}
