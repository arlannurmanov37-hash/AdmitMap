/**
 * POST /api/license  { key }  ->  { ok, tier }
 *
 * Старое имя эндпоинта (platform.html). Теперь «ключ» — это id чекаута Polar;
 * вся проверка — в verifyPurchase, как у /api/verify.
 */
import { cors, bad, verifyPurchase } from './_lib.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return bad(res, 405, 'Use POST.');

  const r = await verifyPurchase((req.body && req.body.key) || '');
  if (!r.ok) return bad(res, 402, r.error);
  res.status(200).json({ ok: true, tier: r.tier });
}
