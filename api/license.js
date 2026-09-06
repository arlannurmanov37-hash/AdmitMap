/**
 * POST /api/license  { key }  ->  { ok, tier }
 *
 * The browser calls this once after checkout, stores the key locally, and sends it
 * with every subsequent request. Validation happens here so a user can't grant
 * themselves a tier by editing localStorage.
 */
import { cors, bad, validateLicense } from './_lib.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return bad(res, 405, 'Use POST.');

  const key = (req.body && req.body.key) || '';
  const result = await validateLicense(key);
  if (!result.ok) return bad(res, 402, result.error);

  res.status(200).json({ ok: true, tier: result.tier });
}
