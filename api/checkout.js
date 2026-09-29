/**
 * POST /api/checkout  { tier: 19 | 29, email?, profile_hash, profile, scores?, student_id? }  ->  { ok, url }
 *
 * Creates a Polar checkout for the chosen report and returns its URL. After
 * payment Polar sends the student back to /report?checkout_id=..., where
 * /api/verify confirms the payment.
 *
 * profile_hash — отпечаток анкеты (SHA-256). Одна покупка — один отчёт: отчёт
 * по этому чекауту откроется только с анкетой того же отпечатка.
 *
 * profile и scores сохраняются в Supabase (purchases): после оплаты отчёт
 * открывается из этой строки с любого устройства, и сервер сам отправляет PDF
 * на почту. Текст эссе сюда не приходит, а если пришёл — вырезается.
 */
import { cors, bad, polar, productForTier, savePurchase } from './_lib.js';

const SITE = (process.env.SITE_URL || 'https://www.admitmap.app').replace(/\/$/, '');

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return bad(res, 405, 'Use POST.');
  if (!process.env.POLAR_ACCESS_TOKEN) return bad(res, 503, 'Payments are not configured yet.');

  const { tier, email, profile_hash, profile, scores, student_id } = req.body || {};
  const key = Number(tier) === 29 ? 'full' : Number(tier) === 19 ? 'chances' : null;
  if (!key) return bad(res, 400, 'Choose a report.');
  if (!/^[a-f0-9]{64}$/.test(String(profile_hash || ''))) {
    return bad(res, 400, 'Please refresh the page and try again.');
  }

  const product = await productForTier(key);
  if (!product) return bad(res, 503, 'This report is not available right now.');

  const body = {
    products: [product.id],
    // {CHECKOUT_ID} Polar подставляет сам
    success_url: SITE + '/report?checkout_id={CHECKOUT_ID}',
    metadata: { tier: key, profile_hash: String(profile_hash) }
  };
  if (typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    body.customer_email = email.trim();
  }

  const r = await polar('/checkouts/', { method: 'POST', body: JSON.stringify(body) });
  if (!r.ok || !r.data || !r.data.url) {
    console.error('polar checkout failed', r.status, JSON.stringify(r.data || {}).slice(0, 300));
    return bad(res, 502, 'Could not start checkout. Please try again.');
  }

  // Анкета и оценки — в Supabase. Если база недоступна, покупка всё равно идёт:
  // отчёт тогда откроется по-старому, из браузера покупателя.
  if (profile && typeof profile === 'object' && Array.isArray(profile.schools) && profile.schools.length) {
    const P = { ...profile };
    if (typeof P.essay === 'string') {
      P.essayWords = P.essay.trim().split(/\s+/).filter(Boolean).length;
      delete P.essay;
    }
    const size = JSON.stringify(P).length + JSON.stringify(scores || {}).length;
    if (size < 200000) {
      await savePurchase({
        checkout_id: r.data.id, tier: key, profile_hash: String(profile_hash), profile: P,
        scores: scores && typeof scores === 'object' ? scores : null,
        student_id: /^[A-Za-z0-9-]{8,64}$/.test(String(student_id || '')) ? String(student_id) : null
      });
    }
  }
  res.status(200).json({ ok: true, url: r.data.url });
}
