/**
 * POST /api/subscribe  { email, name?, gradYear?, source? }  ->  { ok }
 *
 * Складывает адрес в список рассылки Resend (Audience). Это единственное место,
 * где адреса вообще сохраняются: до этого почта из формы жила только в браузере
 * ученика. Нужен для писем с отчётом и для будущих допродаж.
 *
 * Никогда не ломает воронку: если Resend не настроен или ответил ошибкой,
 * отвечаем 200 и просто пишем в лог — ученик не должен упираться в ошибку
 * из-за нашей рассылки.
 */
import { cors, bad, addContact } from './_lib.js';

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return bad(res, 405, 'Use POST.');

  const { email, name, gradYear, source } = req.body || {};
  const addr = String(email || '').trim().toLowerCase();
  if (!RE_EMAIL.test(addr) || addr.length > 200) return bad(res, 400, 'Enter a valid email address.');

  const full = String(name || '').trim();
  const r = await addContact(addr, {
    first: full.split(/\s+/)[0] || undefined,
    last: full.split(/\s+/).slice(1).join(' ') || undefined,
    source: source || 'form'
  });
  if (r.ok) console.info('subscribed', addr, 'source:', source || '-', 'class of', gradYear || '-');
  return res.status(200).json({ ok: true, stored: !!r.ok });
}
