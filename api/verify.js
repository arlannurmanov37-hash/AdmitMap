/**
 * POST /api/verify  { checkout_id }  ->  { ok, tier: 'chances' | 'full', price }
 *
 * The report calls this after Polar redirects back. `pending: true` means the
 * payment went through but Polar has not finished the order — retry in a moment.
 */
import { cors, bad, verifyPurchase, addContact } from './_lib.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return bad(res, 405, 'Use POST.');

  const id = (req.body && (req.body.checkout_id || req.body.key)) || '';
  const r = await verifyPurchase(id);
  if (!r.ok) return bad(res, r.pending ? 409 : 402, r.error, r.pending ? { pending: true } : null);
  res.status(200).json({ ok: true, tier: r.tier, price: r.price });
  // почта покупателя — в список рассылки; ответ ученику уже ушёл
  if (r.email) addContact(r.email, { source: 'purchase-' + r.tier }).catch(function () {});
}
