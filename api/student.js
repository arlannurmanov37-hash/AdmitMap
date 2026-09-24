/**
 * POST /api/student  { id, event, detail?, profile?, email?, device? }  ->  { ok }
 *
 * Сохраняет ученика в Supabase на каждом шаге: анкета, регистрация, цены,
 * клик «купить», отчёт. Так видно каждого, кто начал, и где люди уходят.
 * Шаг и его вес задаёт сервер по имени события — браузеру здесь не верим.
 * Текст эссе сюда не приходит (его вырезает profile-sync.js) и здесь
 * вырезается ещё раз: по Privacy Policy эссе мы не храним.
 *
 * Никогда не ломает воронку: при любой ошибке отвечаем 200.
 */
import { cors, bad, trackStudent } from './_lib.js';

const STEP_NAMES = ['Basics', 'Academics', 'Activities', 'Financial', 'Honors', 'Schools', 'Essay'];

/* событие → [вес, подпись]. Вес 0 — только журнал, «докуда дошёл» не меняется. */
function stageOf(event, detail) {
  switch (event) {
    case 'funnel_open':      return [10, 'Opened the form'];
    case 'funnel_step_done': {
      const n = parseInt(detail && detail.step, 10);
      if (!(n >= 1 && n <= STEP_NAMES.length)) return null;
      return [10 + n, `Step ${n} done: ${STEP_NAMES[n - 1]}`];
    }
    case 'funnel_blocked': {
      const n = parseInt(detail && detail.step, 10);
      return [0, `Stuck on step ${n >= 1 && n <= 7 ? n + ': ' + STEP_NAMES[n - 1] : '?'}`];
    }
    case 'funnel_complete':  return [20, 'Finished the form'];
    case 'signup_view':      return [30, 'Saw sign-up'];
    case 'signup_done':      return [35, 'Signed up'];
    case 'paywall_view':     return [40, 'Saw prices'];
    case 'checkout_click':   return [50, 'Clicked buy'];
    case 'report_view':      return [60, 'Opened report'];
    default:                 return null;
  }
}

const str = (v, max) => (v == null ? '' : String(v)).trim().slice(0, max);
const int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return bad(res, 405, 'Use POST.');

  const b = req.body || {};
  const id = str(b.id, 64);
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return bad(res, 400, 'Bad id.');
  const detail = b.detail && typeof b.detail === 'object' ? b.detail : {};
  const st = stageOf(str(b.event, 40), detail);
  if (!st) return bad(res, 400, 'Unknown event.');

  const P = b.profile && typeof b.profile === 'object' ? { ...b.profile } : null;
  if (P) { delete P.essay; delete P.seen; }
  if (P && JSON.stringify(P).length > 60000) return res.status(200).json({ ok: true, stored: false });

  const email = [b.email, P && P.email].map((e) => str(e, 200).toLowerCase()).find((e) => RE_EMAIL.test(e)) || '';
  const list = (k) => (P && Array.isArray(P[k]) ? P[k] : null);
  const acts = list('activities');

  const row = {
    id,
    stage: st[0] ? st[1] : '',
    rank: st[0],
    event_label: st[1],
    detail: JSON.stringify(detail).length < 2000 ? detail : null,
    email,
    device: b.device === 'mobile' ? 'mobile' : b.device === 'desktop' ? 'desktop' : '',
    tier: int(detail.tier)
  };
  if (P) Object.assign(row, {
    name: str(P.name, 120),
    grad_year: str(P.gradYear, 8),
    state: str(P.state, 60),
    major: str(P.major, 120),
    gpa: str(P.gpa, 8),
    sat: str(P.sat, 8),
    act: str(P.act, 8),
    schools_count: list('schools') ? list('schools').length : null,
    activities_count: acts ? acts.filter((a) => a && String(a.desc || a.role || a.org || '').trim()).length : null,
    honors_count: list('honors') ? list('honors').length : null,
    essay_words: int(b.essayWords),
    wants_aid: typeof P.wantsAid === 'boolean' ? P.wantsAid : null,
    profile: P
  });

  const r = await trackStudent(row);
  // причина без подробностей (код ответа базы) — чтобы чинить без доступа к логам
  return res.status(200).json(r.ok ? { ok: true, stored: true } : { ok: true, stored: false, reason: r.error || '' });
}
