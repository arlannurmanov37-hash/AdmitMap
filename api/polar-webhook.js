/**
 * POST /api/polar-webhook — вебхук Polar (событие order.paid).
 *
 * Оплата прошла — сразу запускаем отправку отчёта на почту (api/send-report),
 * даже если покупатель закрыл вкладку и на наш сайт не вернулся. Отвечаем
 * Polar быстро, сам PDF делается в отдельном вызове.
 *
 * Подпись — по стандарту Standard Webhooks (заголовки webhook-id,
 * webhook-timestamp, webhook-signature), секрет — POLAR_WEBHOOK_SECRET из
 * настроек вебхука в Polar.
 */
import crypto from 'node:crypto';
import { internalKey } from './_lib.js';

const SITE = (process.env.SITE_URL || 'https://www.admitmap.app').replace(/\/$/, '');

// подпись считается по «сырому» телу запроса — разбирать JSON до проверки нельзя
export const config = { api: { bodyParser: false } };

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/* Polar выдаёт секрет строкой; в Standard Webhooks ключ — её байты. Секрет
   вида whsec_… — base64 после префикса. Пробуем оба варианта. */
function keys(secret) {
  const out = [Buffer.from(secret, 'utf8')];
  if (secret.startsWith('whsec_')) out.push(Buffer.from(secret.slice(6), 'base64'));
  return out;
}
function validSignature(req, body) {
  const secret = String(process.env.POLAR_WEBHOOK_SECRET || '').trim();
  const id = req.headers['webhook-id'], ts = req.headers['webhook-timestamp'];
  const sigs = String(req.headers['webhook-signature'] || '').split(' ')
    .map((s) => s.split(',')[1]).filter(Boolean);
  if (!secret || !id || !ts || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 5 * 60) return false;   // старое или из будущего
  return keys(secret).some((k) => {
    const want = crypto.createHmac('sha256', k).update(`${id}.${ts}.${body}`).digest('base64');
    return sigs.some((s) => s.length === want.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want)));
  });
}

/* Дождаться отправки после ответа Polar: на Vercel у запроса есть waitUntil
   (его же использует @vercel/functions). Без него — ждём, пока запрос уйдёт. */
function later(promise) {
  const ctx = globalThis[Symbol.for('@vercel/request-context')];
  const get = ctx && typeof ctx.get === 'function' ? ctx.get() : null;
  if (get && typeof get.waitUntil === 'function') { get.waitUntil(promise); return Promise.resolve(); }
  return Promise.race([promise, new Promise((r) => setTimeout(r, 3000))]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  // req.body не трогаем до чтения потока: на Vercel обращение к нему съедает поток
  let body = '';
  try { body = await rawBody(req); } catch (e) { body = ''; }
  if (!validSignature(req, body)) {
    console.warn('polar-webhook: bad signature');
    return res.status(401).json({ ok: false, error: 'bad signature' });
  }
  let evt = null;
  try { evt = JSON.parse(body); } catch (e) { return res.status(400).json({ ok: false }); }

  const type = evt && evt.type;
  const data = (evt && evt.data) || {};
  const paid = type === 'order.paid' || (type === 'order.created' && data.paid === true) ||
               (type === 'checkout.updated' && data.status === 'succeeded');
  // у заказа номер чекаута в checkout_id, у события чекаута — в самом id
  const id = type === 'checkout.updated' ? data.id : (data.checkout_id || (data.checkout && data.checkout.id));
  if (paid && id) {
    console.info('polar-webhook', type, id);
    await later(fetch(`${SITE}/api/send-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admitmap-key': internalKey() },
      body: JSON.stringify({ checkout_id: id })
    }).then((r) => r.text()).then((t) => console.info('send-report:', t.slice(0, 200)))
      .catch((e) => console.error('send-report call failed', String(e).slice(0, 120))));
  }
  res.status(200).json({ ok: true });
}
