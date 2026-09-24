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

/* Кто может запрашивать оценку эссе и активностей.
   Пока оплата не включена (REQUIRE_PURCHASE не равно "1") — любая страница сайта,
   без ограничений на число отчётов. Запросы только с admitmap.app (ALLOWED_ORIGINS),
   чтобы чужие сайты не пользовались оценщиком за счёт ключа; потолок расходов —
   лимит на самом ключе в Anthropic Console. С REQUIRE_PURCHASE=1 нужен
   оплаченный чекаут Polar. */
export async function allowScoring(req) {
  if (process.env.REQUIRE_PURCHASE === '1') {
    const body = req.body || {};
    const lic = await verifyPurchase(body.checkout_id || body.key || '');
    if (!lic.ok) return { ok: false, status: 402, error: lic.error };
    return { ok: true };
  }
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(origin)) {
    return { ok: false, status: 403, error: 'Scoring is only available on admitmap.app.' };
  }
  return { ok: true };
}

/* Ключ Anthropic из переменной окружения. Пробелы и переносы убираем: при
   вставке в Vercel в ключ попал перенос строки, и запрос падал с ошибкой
   «invalid header value». */
export function anthropicKey() {
  return String(process.env.ANTHROPIC_API_KEY || '').replace(/\s+/g, '');
}

/* Причина ошибки для ответа клиенту — без секретов. Сообщения fetch/SDK могут
   содержать значение заголовка, то есть сам ключ: вырезаем всё похожее на ключ
   и не отдаём текст ошибок заголовков вообще. */
export function safeDetail(err) {
  const msg = String((err && err.message) || err || '');
  if (/header/i.test(msg)) return 'request header rejected (check the API key value)';
  return `${(err && err.status) || ''} ${msg}`
    .replace(/(sk-ant|sk|polar_oat|ghp)[-_][A-Za-z0-9_-]{6,}/gi, '[redacted]')
    .trim().slice(0, 300);
}

/* Добавить адрес в список рассылки Resend. Используют api/subscribe (форма) и
   api/verify (почта покупателя из Polar). Ошибки не бросает: рассылка не должна
   ломать ни воронку, ни выдачу отчёта.

   В новых аккаунтах список один и id не нужен (POST /contacts). Если задан
   RESEND_AUDIENCE_ID — работаем по старому пути с конкретным списком. */
export async function addContact(email, opts = {}) {
  const addr = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(addr)) return { ok: false, error: 'bad email' };
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('addContact: RESEND_API_KEY not set —', addr, opts.source || '');
    return { ok: false, error: 'not configured' };
  }
  const audience = (process.env.RESEND_AUDIENCE_ID || '').trim();
  const url = audience
    ? `https://api.resend.com/audiences/${encodeURIComponent(audience)}/contacts`
    : 'https://api.resend.com/contacts';
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: addr, firstName: opts.first, lastName: opts.last, unsubscribed: false
      })
    });
    // 409 — контакт уже есть, это норма
    if (!r.ok && r.status !== 409) console.error('addContact failed', r.status, (await r.text()).slice(0, 200));
    return { ok: r.ok || r.status === 409 };
  } catch (e) {
    console.error('addContact failed', safeDetail(e));
    return { ok: false };
  }
}

/* ── Supabase: ученики и их путь по воронке ─────────────────────────
   Одна RPC-функция track_student (см. supabase/schema.sql) обновляет строку
   ученика и пишет событие в журнал. Ключ секретный, живёт только здесь.
   Новые ключи (sb_secret_…) идут только в заголовке apikey; старый JWT
   service_role — ещё и в Authorization. Ошибки не бросает: база не должна
   ломать ни воронку, ни отчёт. */
export async function trackStudent(row) {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_KEY || '').trim();
  if (!url || !key) {
    console.warn('trackStudent: Supabase not configured');
    return { ok: false, error: 'not configured' };
  }
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/track_student`, {
      method: 'POST', headers, body: JSON.stringify({ p: row })
    });
    if (!r.ok) console.error('trackStudent failed', r.status, (await r.text()).slice(0, 300));
    return { ok: r.ok };
  } catch (e) {
    console.error('trackStudent failed', safeDetail(e));
    return { ok: false };
  }
}
