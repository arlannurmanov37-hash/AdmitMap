/**
 * POST /api/email-code  { action: 'send', email }                    ->  { ok, token, exp }
 * POST /api/email-code  { action: 'verify', email, code, token, exp } ->  { ok }
 *
 * Подтверждение почты шестизначным кодом (решение владельца 29.09.2026:
 * без пароля — ввёл почту, получил код, ввёл его). Базы не нужно: код не
 * хранится, браузер получает подпись HMAC(почта|код|срок) и присылает её
 * обратно вместе с кодом. Подделать подпись без секрета нельзя.
 *
 * Если письмо не ушло по нашей вине (Resend не настроен, домен не подтверждён,
 * сбой сети), отвечаем { ok:false, skip:true }: страница пропускает ученика без
 * кода — регистрация не должна ломаться из-за нашей почты.
 */
import crypto from 'node:crypto';
import { cors, bad, safeDetail } from './_lib.js';

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TTL = 10 * 60 * 1000;                                   // код живёт 10 минут
const FROM = process.env.EMAIL_FROM || 'AdmitMap <noreply@admitmap.app>';
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

/* Ключ подписи выводим из ключа Resend — отдельную переменную заводить не нужно. */
function secret() {
  const base = process.env.EMAIL_CODE_SECRET || process.env.RESEND_API_KEY || '';
  return base ? crypto.createHash('sha256').update('admitmap-email-code:' + base).digest() : null;
}
function sign(email, code, exp) {
  return crypto.createHmac('sha256', secret()).update(`${email}|${code}|${exp}`).digest('base64url');
}

/* Простой ограничитель в памяти функции: не больше 5 писем на адрес и 20 на IP
   за 15 минут, не больше 8 попыток ввода на один код. Экземпляров функции
   может быть несколько, так что это защита от случайного спама, а не от атаки. */
const hits = new Map();
function tooMany(key, max) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < 15 * 60 * 1000);
  list.push(now); hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

function html(code) {
  return `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f4f8ff;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f1f4b">
<div style="max-width:440px;margin:0 auto;background:#ffffff;border:1px solid #dbe6fb;border-radius:18px;padding:32px 28px">
  <div style="font-family:Georgia,serif;font-size:22px;font-weight:900;letter-spacing:-.02em">Admit<span style="color:#2563eb">Map</span></div>
  <p style="margin:24px 0 8px;font-size:15px;color:#43536b">Your verification code:</p>
  <div style="font-size:36px;font-weight:800;letter-spacing:.18em;color:#0f1f4b">${code}</div>
  <p style="margin:18px 0 0;font-size:14px;line-height:1.5;color:#5f7292">Enter it on the AdmitMap page to continue. The code expires in 10 minutes. If you did not ask for it, you can ignore this email.</p>
</div></body></html>`;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return bad(res, 405, 'Use POST.');
  const origin = req.headers.origin || '';
  if (ALLOWED.length && !ALLOWED.includes(origin)) return bad(res, 403, 'Not allowed.');

  const b = req.body || {};
  const email = String(b.email || '').trim().toLowerCase();
  if (!RE_EMAIL.test(email) || email.length > 200) return bad(res, 400, 'Enter a valid email address.');

  const key = process.env.RESEND_API_KEY;
  if (!key || !secret()) {
    console.warn('email-code: RESEND_API_KEY not set — skipping verification');
    return res.status(200).json({ ok: false, skip: true });
  }

  if (b.action === 'verify') {
    const code = String(b.code || '').replace(/\D/g, '');
    const exp = Number(b.exp);
    const token = String(b.token || '');
    if (code.length !== 6 || !token || !exp) return bad(res, 400, 'Enter the 6-digit code from the email.');
    if (tooMany('try:' + token, 8)) return bad(res, 429, 'Too many attempts. Send a new code.');
    if (Date.now() > exp) return bad(res, 400, 'This code has expired. Send a new one.');
    const want = Buffer.from(sign(email, code, exp));
    const got = Buffer.from(token);
    if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) {
      return bad(res, 400, 'That code is not right. Check the email and try again.');
    }
    return res.status(200).json({ ok: true });
  }

  // action: send
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (tooMany('mail:' + email, 5) || (ip && tooMany('ip:' + ip, 20))) {
    return bad(res, 429, 'Too many codes requested. Please wait a few minutes.');
  }
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const exp = Date.now() + TTL;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        reply_to: 'support@admitmap.app',
        subject: `${code} is your AdmitMap code`,
        html: html(code),
        text: `Your AdmitMap verification code: ${code}\n\nIt expires in 10 minutes. If you did not ask for it, you can ignore this email.`
      })
    });
    if (!r.ok) {
      const body = (await r.text()).slice(0, 300);
      console.error('email-code: Resend', r.status, body);
      // Ключ, домен или лимит Resend — это наша проблема, не ученика: пропускаем
      // его без кода, как было до подтверждения почты.
      return res.status(200).json({ ok: false, skip: true, reason: 'resend ' + r.status });
    }
  } catch (e) {
    console.error('email-code: send failed', safeDetail(e));
    return res.status(200).json({ ok: false, skip: true, reason: 'network' });
  }
  return res.status(200).json({ ok: true, token: sign(email, code, exp), exp });
}
