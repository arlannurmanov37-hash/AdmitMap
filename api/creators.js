/**
 * POST /api/creators  { action, ... }
 *
 * Программа блогеров (решения владельца 29–30.09.2026): одна функция на обе
 * страницы — у Vercel Hobby лимит 12 функций.
 *
 * Страница блогера (creator.html, admitmap.app/creator/<ключ>) — по секретному
 * ключу, без пароля; видит только свои суммы, ничего о конкретных зрителях:
 *   me         { key, period, tz }       цифры, график, воронка, уровень, ролики
 *   hours      { key, day, tz }          один день по часам
 *   add_video  { key, url, published_at }
 *   del_video  { key, id }
 *
 * Страница владельца (admin.html, admitmap.app/admin) — заголовок
 * x-admin-password = ADMIN_PASSWORD из настроек Vercel:
 *   admin        { period, tz }          итоги, график, блогеры, тревоги, выплаты
 *   admin_hours  { day, tz, creator_id? }
 *   admin_add    { name, email, platform, handle, ref }
 *   admin_update { id, status?, email?, payout_method?, payout_details?, notes? }
 *   admin_pay    { id, amount, method, note? }
 *   admin_csv    { period, tz }
 */
import crypto from 'node:crypto';
import { cors, bad, sbRpc, sbRest, LEVELS, safeDetail } from './_lib.js';

const SITE = (process.env.SITE_URL || 'https://www.admitmap.app').replace(/\/$/, '');
const START = new Date('2026-09-01T00:00:00Z');         // программа началась осенью 2026
const DAY = 864e5;
const PERIODS = { today: 1, '7d': 7, '30d': 30 };

/* Часовой пояс зрителя страницы — только из списка IANA, иначе UTC. */
function zone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; } catch (e) { return 'UTC'; }
}
/* Полночь сегодняшнего дня в поясе tz, как момент времени. */
function localMidnight(tz, now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    second: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const offset = asUtc - now.getTime();                  // сколько пояс впереди UTC
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day) - offset);
}
/* Период → [от, до) и такой же предыдущий для сравнения. */
function range(period, tz) {
  const now = new Date();
  if (!PERIODS[period]) return { from: START, to: now, prevFrom: null, prevTo: null, unit: 'day' };
  const days = PERIODS[period];
  const from = new Date(localMidnight(tz, now).getTime() - (days - 1) * DAY);
  const len = now.getTime() - from.getTime();
  return { from, to: now, prevFrom: new Date(from.getTime() - len), prevTo: from, unit: days === 1 ? 'hour' : 'day' };
}
/* Один день YYYY-MM-DD в поясе tz → [от, до). */
function dayRange(day, tz) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return null;
  const noon = new Date(day + 'T12:00:00Z');
  const from = localMidnight(tz, noon);
  return { from, to: new Date(from.getTime() + DAY) };
}
const iso = (d) => d.toISOString();

async function rpc(name, args) {
  const r = await sbRpc(name, args);
  if (!r.ok) throw new Error(`db ${name} ${r.status}`);
  return r.data;
}
function level(sales) {
  let cur = LEVELS[0], idx = 0;
  LEVELS.forEach((l, i) => { if (sales + 1 >= l.from) { cur = l; idx = i; } });
  const next = LEVELS[idx + 1] || null;
  return { index: idx + 1, r19: cur.r19, r29: cur.r29, next: next ? { at: next.from, r19: next.r19, r29: next.r29 } : null,
           levels: LEVELS };
}
async function creatorByKey(key) {
  if (!/^[A-Za-z0-9_-]{12,64}$/.test(String(key || ''))) return null;
  const r = await sbRest(`creators?dash_key=eq.${encodeURIComponent(key)}&select=*`);
  return r.ok && Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
}
const publicCreator = (c) => ({ name: c.name, ref: c.ref, platform: c.platform, handle: c.handle,
  status: c.status, link: `www.admitmap.app/?ref=${c.ref}` });

/* Название ролика — из oEmbed TikTok и YouTube; Instagram без токена не отдаёт. */
async function videoMeta(url) {
  let u;
  try { u = new URL(url); } catch (e) { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  const platform = /tiktok\.com$/.test(host) ? 'TikTok' : /instagram\.com$/.test(host) ? 'Instagram'
    : /(youtube\.com|youtu\.be)$/.test(host) ? 'YouTube' : null;
  if (!platform) return null;
  let title = null;
  const oembed = platform === 'TikTok' ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
    : platform === 'YouTube' ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}` : null;
  if (oembed) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch(oembed, { signal: ctl.signal }); clearTimeout(t);
      if (r.ok) { const j = await r.json(); title = String(j.title || '').trim().slice(0, 160) || null; }
    } catch (e) {}
  }
  return { platform, title };
}

/* ── Пароль владельца: сравнение без утечки по времени, 10 ошибок за 15 минут ── */
const fails = new Map();
function adminOk(req) {
  const want = String(process.env.ADMIN_PASSWORD || '');
  if (!want) return { ok: false, status: 503, error: 'Set ADMIN_PASSWORD in Vercel first.' };
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'ip';
  const now = Date.now();
  const list = (fails.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  if (list.length >= 10) return { ok: false, status: 429, error: 'Too many attempts. Try again in 15 minutes.' };
  const got = String(req.headers['x-admin-password'] || '');
  const a = crypto.createHash('sha256').update(got).digest(), b = crypto.createHash('sha256').update(want).digest();
  if (!crypto.timingSafeEqual(a, b)) { list.push(now); fails.set(ip, list); return { ok: false, status: 401, error: 'Wrong password.' }; }
  return { ok: true };
}

/* Тревоги: ≥5 покупок у одного блогера за час; конверсия ниже половины средней. */
async function alerts(creators, from, to) {
  const out = [];
  const r = await sbRest(`creator_sales?status=eq.active&created_at=gte.${encodeURIComponent(iso(from))}` +
    `&created_at=lt.${encodeURIComponent(iso(to))}&select=creator_id,created_at&limit=5000`);
  const byHour = {};
  (r.ok && r.data || []).forEach((s) => {
    const k = s.creator_id + '|' + String(s.created_at).slice(0, 13);
    byHour[k] = (byHour[k] || 0) + 1;
  });
  Object.entries(byHour).forEach(([k, n]) => {
    if (n < 5) return;
    const [id, hour] = k.split('|');
    const c = creators.find((x) => String(x.id) === id);
    if (c) out.push({ kind: 'burst', creator_id: c.id, name: c.name,
      text: `${n} purchases within one hour (${hour.replace('T', ' ')}:00 UTC). Check that they are real.` });
  });
  const tv = creators.reduce((a, c) => a + c.stats.visitors, 0), tp = creators.reduce((a, c) => a + c.stats.purchases, 0);
  const avg = tv ? tp / tv : 0;
  creators.forEach((c) => {
    if (c.status !== 'active' || c.stats.visitors < 100 || !avg) return;
    const conv = c.stats.purchases / c.stats.visitors;
    if (conv < avg / 2) out.push({ kind: 'low', creator_id: c.id, name: c.name,
      text: `Conversion ${(conv * 100).toFixed(1)}% is less than half the program average (${(avg * 100).toFixed(1)}%).` });
  });
  return out;
}

function csvCell(v) { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return bad(res, 405, 'Use POST.');
  const b = req.body || {};
  const action = String(b.action || '');
  const tz = zone(b.tz || 'UTC');
  res.setHeader('Cache-Control', 'no-store');

  try {
    /* ── страница блогера ── */
    if (['me', 'hours', 'add_video', 'del_video'].includes(action)) {
      const c = await creatorByKey(b.key);
      if (!c) return bad(res, 404, 'This dashboard link is not valid. Ask AdmitMap for your link.');

      if (action === 'me') {
        const rg = range(b.period, tz);
        const [stats, prev, money, series, videos] = await Promise.all([
          rpc('creator_stats', { p_creator: c.id, p_from: iso(rg.from), p_to: iso(rg.to) }),
          rg.prevFrom ? rpc('creator_stats', { p_creator: c.id, p_from: iso(rg.prevFrom), p_to: iso(rg.prevTo) }) : null,
          rpc('creator_money', { p_creator: c.id }),
          rpc('creator_series', { p_creator: c.id, p_from: iso(rg.from), p_to: iso(rg.to), p_unit: rg.unit, p_tz: tz }),
          rpc('creator_video_stats', { p_creator: c.id })
        ]);
        return res.status(200).json({ ok: true, creator: publicCreator(c), period: b.period || '30d', unit: rg.unit,
          stats, prev, money, level: level(Number(money.lifetime_sales) || 0), series, videos });
      }
      if (action === 'hours') {
        const d = dayRange(b.day, tz);
        if (!d) return bad(res, 400, 'Bad day.');
        const series = await rpc('creator_series', { p_creator: c.id, p_from: iso(d.from), p_to: iso(d.to), p_unit: 'hour', p_tz: tz });
        return res.status(200).json({ ok: true, series });
      }
      if (action === 'add_video') {
        const url = String(b.url || '').trim().slice(0, 500);
        const at = new Date(b.published_at);
        if (isNaN(at.getTime()) || at > new Date(Date.now() + DAY)) return bad(res, 400, 'Add the date and time the video went live.');
        const meta = await videoMeta(url);
        if (!meta) return bad(res, 400, 'Paste a TikTok, Instagram or YouTube link.');
        const r = await sbRest('creator_videos', { method: 'POST', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ creator_id: c.id, url, title: meta.title, platform: meta.platform, published_at: iso(at) }) });
        if (!r.ok) return bad(res, 502, 'Could not save the video. Try again.');
        return res.status(200).json({ ok: true });
      }
      if (action === 'del_video') {
        const id = parseInt(b.id, 10);
        if (!(id > 0)) return bad(res, 400, 'Bad video.');
        await sbRest(`creator_videos?id=eq.${id}&creator_id=eq.${c.id}`, { method: 'DELETE' });
        return res.status(200).json({ ok: true });
      }
    }

    /* ── страница владельца ── */
    if (action.startsWith('admin')) {
      const auth = adminOk(req);
      if (!auth.ok) return bad(res, auth.status, auth.error);

      if (action === 'admin' || action === 'admin_csv') {
        const rg = range(b.period, tz);
        const [creators, prevCreators, series] = await Promise.all([
          rpc('admin_creators', { p_from: iso(rg.from), p_to: iso(rg.to) }),
          rg.prevFrom ? rpc('admin_creators', { p_from: iso(rg.prevFrom), p_to: iso(rg.prevTo) }) : null,
          action === 'admin' ? rpc('creator_series', { p_creator: parseInt(b.creator_id, 10) > 0 ? parseInt(b.creator_id, 10) : null,
            p_from: iso(rg.from), p_to: iso(rg.to), p_unit: rg.unit, p_tz: tz }) : null
        ]);
        if (action === 'admin_csv') {
          const head = ['Name', 'Link', 'Platform', 'Email', 'Status', 'Visitors', 'Purchases', '$19', '$29', 'Conversion %',
            'Revenue', 'Commission (period)', 'Lifetime sales', 'Earned (all time)', 'Pending', 'Ready to pay', 'Paid',
            'Payout method', 'Payout details'];
          const rows = creators.map((c) => [c.name, `www.admitmap.app/?ref=${c.ref}`, c.platform, c.email, c.status,
            c.stats.visitors, c.stats.purchases, c.stats.p19, c.stats.p29,
            c.stats.visitors ? (c.stats.purchases / c.stats.visitors * 100).toFixed(1) : '',
            c.stats.revenue, c.stats.earned, c.money.lifetime_sales, c.money.earned, c.money.pending, c.money.ready,
            c.money.paid, c.payout_method, c.payout_details]);
          const csv = [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
          return res.status(200).json({ ok: true, csv });
        }
        const sum = (list, f) => (list || []).reduce((a, c) => a + Number(f(c) || 0), 0);
        const totals = (list) => list && {
          visitors: sum(list, (c) => c.stats.visitors), purchases: sum(list, (c) => c.stats.purchases),
          revenue: sum(list, (c) => c.stats.revenue), commission: sum(list, (c) => c.stats.earned)
        };
        const withDash = creators.map((c) => ({ ...c, dashboard: `${SITE}/creator/${c.dash_key}` }));
        const due = withDash.filter((c) => Number(c.money.ready) >= 25).map((c) => ({
          id: c.id, name: c.name, ready: c.money.ready, method: c.payout_method, details: c.payout_details }));
        return res.status(200).json({ ok: true, period: b.period || '30d', unit: rg.unit,
          totals: totals(creators), prev: totals(prevCreators),
          owed: sum(creators, (c) => c.money.ready), paid: sum(creators, (c) => c.money.paid),
          creators: withDash, series, alerts: await alerts(creators, rg.from, rg.to), payouts_due: due });
      }
      if (action === 'admin_hours') {
        const d = dayRange(b.day, tz);
        if (!d) return bad(res, 400, 'Bad day.');
        const id = parseInt(b.creator_id, 10);
        const series = await rpc('creator_series', { p_creator: id > 0 ? id : null, p_from: iso(d.from), p_to: iso(d.to),
          p_unit: 'hour', p_tz: tz });
        return res.status(200).json({ ok: true, series });
      }
      if (action === 'admin_add') {
        const name = String(b.name || '').trim().slice(0, 80);
        const ref = String(b.ref || '').trim().toLowerCase();
        if (!name) return bad(res, 400, 'Enter a name.');
        if (!/^[a-z0-9_-]{2,32}$/.test(ref)) return bad(res, 400, 'Link name: 2–32 letters, numbers, - or _.');
        const email = String(b.email || '').trim().toLowerCase().slice(0, 200) || null;
        const dash_key = crypto.randomBytes(12).toString('base64url');
        const r = await sbRest('creators', { method: 'POST', headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ name, ref, email, dash_key,
            platform: String(b.platform || '').slice(0, 40) || null, handle: String(b.handle || '').slice(0, 80) || null }) });
        if (r.status === 409) return bad(res, 409, 'This link name is taken. Pick another.');
        if (!r.ok) return bad(res, 502, 'Could not save the creator.');
        return res.status(200).json({ ok: true, link: `www.admitmap.app/?ref=${ref}`, dashboard: `${SITE}/creator/${dash_key}` });
      }
      if (action === 'admin_update') {
        const id = parseInt(b.id, 10);
        if (!(id > 0)) return bad(res, 400, 'Bad creator.');
        const patch = {};
        if (b.status === 'active' || b.status === 'paused') patch.status = b.status;
        ['email', 'payout_method', 'payout_details', 'notes'].forEach((k) => {
          if (typeof b[k] === 'string') patch[k] = b[k].trim().slice(0, k === 'notes' ? 2000 : 200) || null;
        });
        if (!Object.keys(patch).length) return bad(res, 400, 'Nothing to change.');
        const r = await sbRest(`creators?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
        if (!r.ok) return bad(res, 502, 'Could not save.');
        return res.status(200).json({ ok: true });
      }
      if (action === 'admin_pay') {
        const id = parseInt(b.id, 10), amount = Math.round(Number(b.amount) * 100) / 100;
        if (!(id > 0) || !(amount > 0)) return bad(res, 400, 'Enter the amount paid.');
        const r = await sbRest('creator_payouts', { method: 'POST', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ creator_id: id, amount, method: String(b.method || '').slice(0, 40) || null,
            note: String(b.note || '').slice(0, 200) || null }) });
        if (!r.ok) return bad(res, 502, 'Could not save the payout.');
        return res.status(200).json({ ok: true });
      }
    }
    return bad(res, 400, 'Unknown action.');
  } catch (e) {
    console.error('creators', action, safeDetail(e));
    // база ещё не настроена (supabase/creators.sql не запущен) — понятный ответ
    return bad(res, 503, 'The creator program is not set up yet.', { detail: safeDetail(e).slice(0, 120) });
  }
}
