/**
 * POST /api/verify  { checkout_id, profile_hashes: [..] }  ->  { ok, tier: 'chances' | 'full', price, profile_hash, profile?, scores? }
 *
 * The report calls this after Polar redirects back. `pending: true` means the
 * payment went through but Polar has not finished the order — retry in a moment.
 *
 * Одна покупка — один отчёт: браузер присылает отпечатки анкет, которые у него
 * есть, сервер отвечает, какая из них куплена этим чекаутом. Нет подходящей —
 * { mismatch: true }. У покупок до 29.09.2026 отпечатка нет — их пускаем.
 *
 * Если анкета сохранена на сервере (purchases, с 29.09.2026), отдаём её и
 * оценки: отчёт строится из них на любом устройстве, браузеру не верим.
 */
import { cors, bad, verifyPurchase, addContact, trackStudent, getPurchase, updatePurchase, recordCreatorSale } from './_lib.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return bad(res, 405, 'Use POST.');

  const id = (req.body && (req.body.checkout_id || req.body.key)) || '';
  const r = await verifyPurchase(id);
  if (!r.ok) return bad(res, r.pending ? 409 : 402, r.error, r.pending ? { pending: true } : null);
  const row = await getPurchase(id);
  // покупка по ссылке блогера — продажа и письмо блогеру (один раз на чекаут)
  await recordCreatorSale(id, r).catch(function () {});
  const sent = Array.isArray(req.body && req.body.profile_hashes) ? req.body.profile_hashes.slice(0, 20).map(String) : [];
  if (!row && r.profileHash && sent.indexOf(r.profileHash) < 0) {
    return bad(res, 403, 'This report was bought for a different profile or school list.', { mismatch: true });
  }
  // отметка об оплате в Supabase — только после проверки чекаута в Polar
  const sid = String((req.body && req.body.student_id) || '');
  if (/^[A-Za-z0-9-]{8,64}$/.test(sid)) {
    await trackStudent({ id: sid, stage: 'Paid', rank: 70, event_label: 'Paid', paid: true, tier: r.price,
      email: r.email || '', detail: { checkout_id: id, tier: r.tier } });
  }
  if (row) {
    // updated_at — «последнее открытие»: по нему отчёт удаляется через 12 месяцев
    await updatePurchase(id, { paid: true, tier: r.tier, email: r.email || row.email || null });
    res.status(200).json({ ok: true, tier: r.tier, price: r.price, profile_hash: row.profile_hash || null,
      profile: row.profile, scores: row.scores || {}, emailed: !!row.emailed_at });
  } else {
    res.status(200).json({ ok: true, tier: r.tier, price: r.price, profile_hash: r.profileHash || null });
  }
  // почта покупателя — в список рассылки; ответ ученику уже ушёл
  if (r.email) addContact(r.email, { source: 'purchase-' + r.tier }).catch(function () {});
}
