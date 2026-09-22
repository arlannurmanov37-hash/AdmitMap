/* AdmitMap — превращает статичный макет SnapScore в личный отчёт.
   Вёрстку не трогаем: находим готовые узлы в отрисованном макете и
   подставляем в них настоящие числа. Нет профиля — остаётся образец Майи. */
(function () {
'use strict';

var $$ = function (sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); };
var usd = function (n) { return n == null || isNaN(n) ? '—' : '$' + Math.round(n).toLocaleString('en-US'); };
var byText = function (re, tag) {
  return $$(tag || 'span').filter(function (e) {
    return e.children.length === 0 && re.test((e.textContent || '').trim());
  });
};
var logo = function (d) {
  return 'https://img.logo.dev/' + encodeURIComponent(d) +
         '?token=pk_X-1ZO13GSgeOoUrIuJ6GMQ&size=256&format=png';
};
/* Сокращаем осторожно: «Boston University» -> «Boston» спутало бы вуз
   с Boston College, поэтому неоднозначные имена перечислены явно. */
var ABBR = {
  'University of California-Los Angeles':'UCLA', 'New York University':'NYU',
  'Pennsylvania State University-Main Campus':'Penn State',
  'Massachusetts Institute of Technology':'MIT',
  'Boston University':'Boston University', 'Boston College':'Boston College',
  'Washington University in St Louis':'WashU', 'University of Southern California':'USC',
  'Georgia Institute of Technology':'Georgia Tech',
  'California Institute of Technology':'Caltech',
  'University of North Carolina at Chapel Hill':'UNC',
  'University of Illinois Urbana-Champaign':'UIUC'
};
var shortName = function (n) {
  if (ABBR[n]) return ABBR[n];
  var s = n.replace(/-Main Campus$/, '').replace(/^University of /, '');
  var t = s.replace(/ University$/, '');
  return t.indexOf(' ') > -1 || t.length > 6 ? t : s;   // односложное имя не режем
};

/* Название на карточке. В Scorecard кампусы записаны как «…-Main Campus»,
   «… Campus Immersion» — в одну строку это не влезало и раздвигало сетку. */
function cardName(n) {
  return String(n || '')
    .replace(/-(Main|Pittsburgh) Campus$/, '')
    .replace(/ Campus Immersion$/, '')
    .replace(/^University of California-/, 'UC ')
    .replace(/^Texas A&M University-College Station$/, 'Texas A&M University')
    .replace(/^The University of Texas at /, 'UT ');
}

/* ── иконки активностей ───────────────────────────────────────────────
   Одна иконка на тип Common App (список ACT_TYPES в funnel.html). Рисуем
   сами, а не генерируем: одинаковый стиль, одно и то же для одного типа.
   Сетка 24×24, обводка — как у остальных иконок отчёта. */
var ACT_ICON = (function () {
  var I = {
    book:    '<path d="M12 6.5C10.2 5.2 7.6 4.8 4 5v13c3.6-.2 6.2.2 8 1.5 1.8-1.3 4.4-1.7 8-1.5V5c-3.6-.2-6.2.2-8 1.5z"/><path d="M12 6.5v13"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.9-.9 1.6-2-.4-1.4.5-2.5 1.9-2.5H18a2.5 2.5 0 0 0 2.5-2.5c0-5.5-3.8-10-8.5-10z"/><circle cx="7.8" cy="11" r="1"/><circle cx="10.5" cy="7.6" r="1"/><circle cx="14.8" cy="7.8" r="1"/>',
    ball:    '<circle cx="12" cy="12" r="8.5"/><path d="M3.8 9.5c3 .9 5.4 3.5 6.2 11"/><path d="M20.2 14.5c-3-.9-5.4-3.5-6.2-11"/>',
    trophy:  '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5.5H4.8c0 2.6 1.3 4.3 3.4 4.6M16 5.5h3.2c0 2.6-1.3 4.3-3.4 4.6"/><path d="M12 13v3.5M8.5 20h7M9.5 20l.6-3.5h3.8l.6 3.5"/>',
    brief:   '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V5.8c0-.7.6-1.3 1.3-1.3h3.4c.7 0 1.3.6 1.3 1.3v1.7M3.5 12.5h17"/>',
    heart:   '<path d="M12 19.5s-7.5-4.4-7.5-9.6A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.3c0 5.2-7.5 9.6-7.5 9.6z"/>',
    code:    '<rect x="3.5" y="5" width="17" height="12" rx="1.8"/><path d="M8 20h8M10 9l-2 2 2 2M14 9l2 2-2 2"/>',
    globe:   '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5z"/>',
    sparkle: '<path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9-1.9 5.6-1.9-5.6-5.6-1.9 5.6-1.9z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    podium:  '<path d="M12 3.5v4.8"/><circle cx="12" cy="3.2" r="1.4"/><path d="M6.5 8.3h11L15 20.5H9z"/><path d="M4 11.2h4M16 11.2h4"/>',
    leaf:    '<path d="M5 19c0-8 5-13.5 14.5-14-.3 9.6-5.8 14.5-13.8 14.5"/><path d="M5 19l7-7"/>',
    home:    '<path d="M4 11 12 4.5l8 6.5"/><path d="M6 9.5V19.5h12V9.5"/><path d="M10 19.5v-5h4v5"/>',
    plane:   '<path d="M20.5 4.3c-.9-.9-2.3-.9-3.2 0l-3.6 3.6-8.1-2.1-1.8 1.8 6.4 3.9-3.3 3.3-2.6-.4-1.3 1.3 3.4 1.9 1.9 3.4 1.3-1.3-.4-2.6 3.3-3.3 3.9 6.4 1.8-1.8-2.1-8.1 3.6-3.6c.9-.9.9-2.3 0-3.2z"/>',
    chat:    '<path d="M4 5.5h10v7H8.5L5.5 15v-2.5H4z"/><path d="M14 9.5h6v7h-1.5V19l-3-2.5H10v-4"/>',
    badge:   '<rect x="4.5" y="4" width="15" height="16.5" rx="2"/><circle cx="12" cy="10.5" r="2.6"/><path d="M8.2 17c.6-1.9 2-2.8 3.8-2.8s3.2.9 3.8 2.8M10 4v2h4V4"/>',
    news:    '<path d="M4 5h13v14.5H6A2 2 0 0 1 4 17.5z"/><path d="M17 9h3v8.5a2 2 0 0 1-2 2"/><path d="M7.5 8.5h6M7.5 12h6M7.5 15.5h4"/>',
    medal:   '<path d="M8 3.5h8l-2.2 5.4M8 3.5l2.2 5.4"/><circle cx="12" cy="14.5" r="5.5"/><path d="m12 11.8.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z"/>',
    note:    '<path d="M9 17.5V5.5l10-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/><path d="M9 9.5l10-2"/>',
    mic:     '<rect x="9" y="3.5" width="6" height="10.5" rx="3"/><path d="M5.8 11a6.2 6.2 0 0 0 12.4 0M12 17.2v3.3M8.8 20.5h6.4"/>',
    sun:     '<circle cx="12" cy="12" r="3.8"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6"/>',
    flask:   '<path d="M9.5 3.5h5M10.3 3.5v5.3L5.2 17.6a2 2 0 0 0 1.7 2.9h10.2a2 2 0 0 0 1.7-2.9l-5.1-8.8V3.5"/><path d="M7.4 14h9.2"/>',
    robot:   '<rect x="5" y="8" width="14" height="10.5" rx="2.5"/><path d="M12 8V5"/><circle cx="12" cy="4" r="1"/><circle cx="9.3" cy="12.6" r="1.1"/><circle cx="14.7" cy="12.6" r="1.1"/><path d="M9.8 15.8h4.4M3 12v3M21 12v3"/>',
    flag:    '<path d="M5.5 20.5V4"/><path d="M5.5 4.5c2.6-1.3 4.8-.2 6.5.6 1.8.9 4 1.6 6.5.4v8.5c-2.5 1.2-4.7.5-6.5-.4-1.7-.8-3.9-1.9-6.5-.6"/>',
    atom:    '<circle cx="12" cy="12" r="1.5"/><ellipse cx="12" cy="12" rx="8.5" ry="3.4"/><ellipse cx="12" cy="12" rx="8.5" ry="3.4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="8.5" ry="3.4" transform="rotate(-60 12 12)"/>',
    scale:   '<path d="M12 4v16.5M8 20.5h8M5 7h14M12 4.5 5 7M12 4.5 19 7"/><path d="M5 7l-2.5 6a2.8 2.8 0 0 0 5 0zM19 7l-2.5 6a2.8 2.8 0 0 0 5 0z"/>',
    columns: '<path d="M3.5 9.5 12 4l8.5 5.5"/><path d="M5.5 10v8M10 10v8M14 10v8M18.5 10v8M3.5 20.5h17"/>',
    mask:    '<path d="M4.5 5c4.9 1.2 10.1 1.2 15 0v6.5a7.5 7.5 0 0 1-15 0z"/><path d="M8.2 10.2c.7-.6 1.6-.6 2.3 0M13.5 10.2c.7-.6 1.6-.6 2.3 0M9 14.2c1.8 1.4 4.2 1.4 6 0"/>',
    wallet:  '<rect x="3.5" y="6.5" width="17" height="13" rx="2"/><path d="M16.5 13h.1M3.5 10h17M6 6.5l9-3 1.2 3"/>',
    people:  '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.5-3.2 2.7-5 5.5-5s5 1.8 5.5 5"/><path d="M15.5 5.8a3 3 0 0 1 0 5.4M17.5 14.3c1.7.6 2.8 2.2 3 4.7"/>'
  };
  var BY_TYPE = {
    'Academic':'book', 'Art':'palette', 'Athletics: Club':'ball', 'Athletics: JV/Varsity':'trophy',
    'Career Oriented':'brief', 'Community Service (Volunteer)':'heart', 'Computer/Technology':'code',
    'Cultural':'globe', 'Dance':'sparkle', 'Debate/Speech':'podium', 'Environmental':'leaf',
    'Family Responsibilities':'home', 'Foreign Exchange':'plane', 'Foreign Language':'chat',
    'Internship':'badge', 'Journalism/Publication':'news', 'Junior R.O.T.C.':'medal',
    'Music: Instrumental':'note', 'Music: Vocal':'mic', 'Religious':'sun', 'Research':'flask',
    'Robotics':'robot', 'School Spirit':'flag', 'Science/Math':'atom', 'Social Justice':'scale',
    'Student Govt./Politics':'columns', 'Theater/Drama':'mask', 'Work (Paid)':'wallet',
    'Other Club/Activity':'people', 'Other':'people'
  };
  return function (type) { return I[BY_TYPE[type]] || I.people; };
})();

/* ── оплата и оценки ─────────────────────────────────────────────────
   Оценки эссе и активностей делает Claude на сервере (api/essay.js,
   api/activities.js) и только для оплаченного отчёта. Результат храним в
   браузере вместе с отпечатком текста: пока текст тот же, шансы считаются
   от той же оценки и не «плавают»; дописал эссе — оценка пересчитается. */
function fnv(str) {
  var h = 2166136261;
  for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
function actsFor(P) {
  return (P.activities || []).filter(function (a) { return (a.desc || '').trim(); });
}
function activityKey(P) {
  return fnv(JSON.stringify(actsFor(P).map(function (a) {
    return [a.type || '', a.desc || '', a.hrs || '', a.weeks || '', (a.grades || []).join(',')];
  })));
}
function essayKey(P) { return fnv(String(P.essayPrompt) + '|' + String(P.essay || '').trim()); }
function cachedFor(key, h) {
  try {
    var v = JSON.parse(localStorage.getItem(key) || 'null');
    return v && v.h === h ? v : null;
  } catch (e) { return null; }
}
function store(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

function isLocal() {
  return location.protocol === 'file:' ||
    /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname);
}
/* Только localhost и только с флагом из test-profiles.html: имитация ответов
   api/activities и api/essay, чтобы проверить путь «оценка → шансы» без сервера. */
function mockApi(path, body) {
  var r10 = function (x) { return Math.round(x * 10) / 10; };
  if (path === '/api/activities') {
    var items = body.activities.map(function (a) {
      var d = a.desc.length, lead = /captain|founded|president|led|lead/i.test(a.desc);
      return { name: (a.desc.split(/[,.]/)[0] || a.type).split(' ').slice(0, 3).join(' '),
               type: a.type, score: Math.min(95, Math.round(35 + d / 2 + (lead ? 15 : 0))), note: '' };
    });
    var avg = Math.round(items.reduce(function (x, i) { return x + i.score; }, 0) / items.length);
    return wait(1500).then(function () {
      return { ok: true, overall: avg, items: items,
        subs: { depth: avg + 2, leadership: avg + 4, impact: avg - 6, progression: avg - 3, narrative: avg + 5 } };
    });
  }
  var w = body.essay.split(/\s+/).length;
  var base = Math.min(8.6, 5 + w / 120);
  var keys = [['authenticity','Authenticity & Voice'],['reflection','Reflection & Insight'],['character','Personal Impact & Character'],
              ['specificity','Specificity & Detail'],['storytelling','Storytelling & Narrative'],['writing','Writing Quality']];
  var scores = {}; keys.forEach(function (k, i) { scores[k[0]] = r10(base + (i % 3 - 1) * 0.4); });
  return wait(1500).then(function () {
    return { ok: true, scores: scores, overall: r10(base), rubric: keys.map(function (k) { return { key: k[0], label: k[1] }; }) };
  });
}
function post(path, body, ms) {
  try { if (isLocal() && localStorage.getItem('admitmap_mock_api') === '1') return mockApi(path, body); } catch (e) {}
  var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var t = ctl ? setTimeout(function () { ctl.abort(); }, ms || 20000) : null;
  return fetch((window.ADMITMAP_API || '') + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined
  }).then(function (r) {
    return r.json().catch(function () { return { ok: false, error: 'Bad response' }; })
      .then(function (j) { j.status = r.status; return j; });
  }).catch(function (e) { return { ok: false, error: String(e && e.message || e) }; })
    .then(function (j) { if (t) clearTimeout(t); return j; });
}
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

/* Оплата: Polar возвращает на /report?checkout_id=…; сервер подтверждает
   чекаут и говорит, какой отчёт куплен. Локально (localhost) проверку
   пропускаем, чтобы test-profiles.html работал без сервера. */
/* Оплата через Polar ещё не включена (решение владельца 22.09.2026: выкладываем
   без неё). Пока false — отчёт открывается без проверки, как раньше, тариф берётся
   из ?tier=, оценки эссе и активностей не запрашиваются (их API требует оплату).
   Включить: true здесь и в paywall.html / paywall-desktop.html. */
var PAYMENTS_ON = false;

var PURCHASE = null;
function purchase() {
  var m = location.search.match(/[?&]checkout_id=([A-Za-z0-9_-]+)/);
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem('admitmap_purchase') || 'null'); } catch (e) {}
  var id = m ? m[1] : saved && saved.id;
  if (isLocal() || !PAYMENTS_ON) {
    return Promise.resolve({ local: true, id: isLocal() ? id || null : null,
      price: parseInt((location.search.match(/[?&]tier=(\d+)/) || [])[1] || localStorage.getItem('admitmap_tier'), 10) || 29 });
  }
  if (!id) return Promise.resolve(null);
  if (saved && saved.id === id && saved.price) return Promise.resolve(saved);
  var attempt = function (n) {
    return post('/api/verify', { checkout_id: id }, 15000).then(function (r) {
      if (r.ok) {
        var p = { id: id, tier: r.tier, price: r.price };
        store('admitmap_purchase', p);
        try { localStorage.setItem('admitmap_tier', String(r.price)); } catch (e) {}
        return p;
      }
      if (r.pending && n < 8) return wait(2000).then(function () { return attempt(n + 1); });
      return { error: r.error || 'We could not confirm your payment.' };
    });
  };
  return attempt(0);
}

function showScoring(on) {
  var el = document.getElementById('am-scoring');
  if (!on) { if (el) el.remove(); return; }
  if (el) return;
  el = document.createElement('div');
  el.id = 'am-scoring';
  el.setAttribute('role', 'status');
  el.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;' +
    'justify-content:center;padding:24px;background:#dbe9fb;' +
    "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f1f4b";
  el.innerHTML =
    '<style>@keyframes amSlide{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}' +
    '@media (prefers-reduced-motion:reduce){#am-scoring .bar i{animation:none;width:100%;opacity:.5}}</style>' +
    '<div style="width:100%;max-width:440px;background:#fff;border-radius:22px;padding:34px 30px;' +
      'box-shadow:0 2px 0 #eef3fb,0 24px 50px rgba(15,31,75,.12);text-align:center">' +
      '<div style="font-family:Fraunces,Georgia,serif;font-size:26px;font-weight:900;letter-spacing:-.03em;line-height:1.15">' +
        'Reading your essay and activities</div>' +
      '<p style="margin:12px 0 22px;font-size:15px;line-height:1.55;color:#5b7098">' +
        'We score them the way an admissions reader would, then factor that into every ' +
        'chance in your report. This takes about a minute.</p>' +
      '<div class="bar" style="position:relative;height:6px;border-radius:3px;background:#e6edf8;overflow:hidden">' +
        '<i style="position:absolute;left:0;top:0;bottom:0;width:38%;border-radius:3px;' +
        'background:linear-gradient(90deg,#60a5fa,#2563eb);animation:amSlide 1.4s ease-in-out infinite"></i></div>' +
    '</div>';
  document.body.appendChild(el);
}

/* Оценить то, что ещё не оценено для этого текста. Ошибка оценки не ломает
   отчёт: шансы посчитаются без неё (активности — по часам, эссе — нейтрально). */
function scoreProfile(P, id) {
  var jobs = [];
  var acts = actsFor(P), ak = activityKey(P);
  if (acts.length && !cachedFor('admitmap_activity_scores', ak)) {
    jobs.push(post('/api/activities', { checkout_id: id, activities: acts.map(function (a) {
      return { type: a.type || '', desc: a.desc || '', hours: a.hrs || '', weeks: a.weeks || '',
               years: (a.grades || []).length || 1, grades: a.grades || [] };
    }) }, 115000).then(function (r) {
      if (!r.ok) { console.warn('AdmitMap: activity scoring failed —', r.error); return; }
      store('admitmap_activity_scores', { h: ak, overall: r.overall, subs: r.subs,
        items: (r.items || []).slice().sort(function (a, b) { return b.score - a.score; }),
        verdict: r.verdict, fixes: r.fixes });
    }));
  }
  var essay = String(P.essay || '').trim(), ek = essayKey(P);
  if (essay.length >= 200 && !cachedFor('admitmap_essay_scores', ek)) {
    jobs.push(post('/api/essay', { checkout_id: id, essay: essay,
      prompt: P.essayPrompt != null ? 'Common App prompt #' + (P.essayPrompt + 1) : undefined
    }, 115000).then(function (r) {
      if (!r.ok) { console.warn('AdmitMap: essay grading failed —', r.error); return; }
      // api/essay отдаёт баллы 0–10; отчёт и модель работают в 0–100
      store('admitmap_essay_scores', { h: ek, overall: Math.round(r.overall * 10),
        items: (r.rubric || []).map(function (c) {
          return { name: c.label, score: Math.round((r.scores[c.key] || 0) * 10) };
        }).sort(function (a, b) { return b.score - a.score; }),
        verdict: r.verdict, strengths: r.strengths, fixes: r.fixes });
    }));
  }
  if (!jobs.length) return Promise.resolve();
  showScoring(true);
  return Promise.all(jobs).then(function () { showScoring(false); });
}

/* ── профиль воронки → вход модели ─────────────────────────────────── */
var REC = {'International':'international','National':'national','State/Regional':'state','School':null};

function modelFrom(P) {
  var gpa = parseFloat(P.gpa);
  if (!(gpa > 0)) return null;
  var sat = parseInt(P.sat, 10), act = parseInt(P.act, 10);
  var rank = parseInt(P.rank, 10), size = parseInt(P.classSize, 10);
  var order = ['School','State/Regional','National','International'], best = -1, level = null;
  (P.honors || []).forEach(function (h) {
    (h.levels || []).forEach(function (l) {
      var i = order.indexOf(l);
      if (i > best) { best = i; level = REC[l]; }
    });
  });
  var m = {
    gpa: gpa,
    sat: sat > 0 ? sat : null,
    act: act > 0 ? act : null,
    apScores: (P.apExams || []).map(function (e) { return parseInt(e.s, 10); })
                               .filter(function (x) { return x > 0; }),
    honorLevel: level,
    activities: (P.activities || []).filter(function (a) { return (a.desc || '').trim(); })
      .map(function (a) {
        return { hours: parseInt(a.hrs, 10) || 0, weeks: parseInt(a.weeks, 10) || 0,
                 years: (a.grades || []).length || 1, type: a.type || '' };
      }),
    rankPct: (rank > 0 && size > 0) ? Math.round(rank / size * 1000) / 10 : null,
    homeState: window.AdmitOdds ? window.AdmitOdds.stateCode(P.state) : null,
    round: 'RD'
  };
  m.activityCount = m.activities.length;
  var as = cachedFor('admitmap_activity_scores', activityKey(P));
  if (as && as.overall > 0) m.activityScore = as.overall;
  /* Оценку эссе берём из кэша грейдера, если он уже отработал. */
  var es = cachedFor('admitmap_essay_scores', essayKey(P));
  if (es && es.overall > 0) m.essayScore = Math.max(0, Math.min(10, es.overall / 10));
  /* Эссе нет — модель считает это минусом (см. essayMissing в data/odds.js).
     Текст есть, но оценки ещё нет — нейтрально. */
  var essayWords = String(P.essay || '').trim().split(/\s+/).filter(Boolean).length;
  m.noEssay = m.essayScore == null && essayWords < 50;
  m.essayWords = essayWords;
  return m;
}

function bandNet(bands, edges, income) {
  var i = -1;
  for (var k = 0; k < edges.length; k++) if (income < edges[k]) { i = k; break; }
  if (i < 0) i = bands.length - 1;
  var net = bands[i];
  for (var j = i; j >= 0 && net == null; j--) net = bands[j];
  for (var m = i; m < bands.length && net == null; m++) net = bands[m];
  return net;
}
/* Scorecard считает net price только для жителей штата. Студенту из другого
   штата государственный вуз обходится дороже на разницу в плате за обучение —
   грантов на неё, как правило, нет. */
function outOfState(col, homeState, outsideUS) {
  if (!col || col.pub !== true) return false;
  if (outsideUS) return true;
  return !!(homeState && col.state && col.state !== homeState);
}
/* Верхняя полоса Scorecard — среднее по всем семьям выше $110k (или $200k у
   проверенных вручную вузов). Семья с доходом $400k+ платит полную цену, поэтому
   выше $250k плавно ведём цену к полной стоимости. */
var RICH_FROM = 250000, RICH_FULL = 450000;
function costFor(col, name, income, oos) {
  if (!(income > 0)) return null;                      // дохода нет — цену не выдумываем
  var c = baseCost(col, name, income);
  if (!c || c.net == null || !c.coa) return null;
  var coa = c.coa, net = Math.min(c.net, c.coa);
  var t = oos && typeof TUITION !== 'undefined' ? TUITION[col.d] : null;
  if (t) { coa += t[1] - t[0]; net += t[1] - t[0]; }
  if (income > RICH_FROM) {
    var w = Math.min(1, (income - RICH_FROM) / (RICH_FULL - RICH_FROM));
    net = net + w * (coa - net);
  }
  return { coa: Math.round(coa), net: Math.round(net), oos: !!t };
}
function stickerOnly(col, oos) {
  if (col.coa == null) return { coa: null, net: null };
  var t = oos && typeof TUITION !== 'undefined' ? TUITION[col.d] : null;
  return { coa: t ? col.coa + t[1] - t[0] : col.coa, net: null, oos: !!t };
}
function baseCost(col, name, income) {
  if (col && col.inc7 && col.coa) {
    var n7 = bandNet(col.inc7, [30000,48000,75000,110000,150000,200000,Infinity], income);
    if (n7 != null) return { coa: col.coa, net: n7 };
  }
  if (typeof finFor === 'function') {
    var f = finFor(name);
    if (f && f.coa) return { coa: f.coa, net: estNetPrice(f, income) };
  }
  if (col && col.inc && col.coa) {
    var n5 = bandNet(col.inc, [30000,48000,75000,110000,Infinity], income);
    if (n5 != null) return { coa: col.coa, net: n5 };
  }
  if (col && col.coa != null && col.np != null) return { coa: col.coa, net: col.np };
  return null;
}
/* Restrictive / Single-Choice Early Action (Harvard, Yale, Princeton, Stanford) —
   не обязывает, поэтому не называем его binding. Флаг rea — из ручной выверки. */
var AUDITION = {'juilliard.edu':1, 'curtis.edu':1};
/* Texas Education Code §51.803: выпускник техасской школы из топ-10% класса
   зачисляется в любой государственный университет Техаса автоматически;
   UT Austin ограничивает это топ-6%. Зачисляют в университет, не на
   конкретную специальность. */
function texasAuto(col, m) {
  if (!col || col.state !== 'TX' || col.pub !== true || m.homeState !== 'TX' || m.rankPct == null) return null;
  var cut = col.d === 'utexas.edu' ? 6 : 10;
  return m.rankPct <= cut ? cut : null;
}

/* University of California и Cal State не смотрят на SAT/ACT (test-blind). */
function testBlind(col) {
  if (!col || col.state !== 'CA' || col.pub !== true) return false;
  if (col.d === 'ucla.edu' || col.d === 'berkeley.edu') return true;
  return /University of California|California State|State University|Cal Poly|California Polytechnic/.test(col.n || '');
}
function roundOf(col) {
  /* Карточка показывает обычный раунд — процент на ней посчитан для него.
     Ранний раунд живёт в отдельном блоке. */
  var early = col && col.rea && (col.ea || col.ed) ? { code: 'REA', date: col.ea || col.ed }
            : col && col.ed ? { code: 'ED', date: col.ed }
            : col && col.ea ? { code: 'EA', date: col.ea } : null;
  if (col && AUDITION[col.d]) {
    return { label: 'Admission by audition · stats matter less', code: 'RD', early: null };
  }
  return { label: col && col.rd ? 'Regular Decision · ' + col.rd : 'Regular Decision',
           code: 'RD', early: early };
}

/* $19 — только шансы, $29 — шансы и стоимость. Тариф передаёт пейволл. */
function chancesOnly() {
  if (PURCHASE && PURCHASE.price && !PURCHASE.local) return PURCHASE.price === 19;
  var t = null;
  try { t = (location.search.match(/[?&]tier=(\d+)/) || [])[1] || localStorage.getItem('admitmap_tier'); }
  catch (e) {}
  return String(t) === '19';
}

function build() {
  var P;
  try { P = JSON.parse(localStorage.getItem('admitmap_profile') || 'null'); } catch (e) { return null; }
  if (!P || !P.schools || !P.schools.length) return null;
  var model = modelFrom(P);
  if (!model || typeof COLLEGES === 'undefined' || !window.AdmitOdds) return null;

  var income = parseInt(P.income, 10) || 0;
  var outsideUS = /outside/i.test(String(P.state || ''));
  var rows = [], skipped = [];

  P.schools.forEach(function (sc) {
    var col = COLLEGES[sc.d];
    if (!col || col.rate == null) { skipped.push(sc.n); return; }
    // нет дохода или данных о стоимости — шанс всё равно показываем, цена будет «—»,
    // а полная цена (sticker) — с учётом чужого штата
    var oos = outOfState(col, model.homeState, outsideUS);
    var cost = costFor(col, sc.n, income, oos) || stickerOnly(col, oos);
    var sat = col.sat != null ? col.sat
            : (col.act != null ? window.AdmitOdds.actToSat(col.act)
                               : window.AdmitOdds.satFromRate(col.rate));
    var school = { rate: col.rate, sat: sat, act: col.act || null,
                   gpa: col.gpa != null ? col.gpa : null,
                   isPublic: col.pub === true, state: col.state || null, testBlind: testBlind(col) };
    var m = model;
    if (school.isPublic && school.state && model.homeState) {
      m = Object.assign({}, model, { inState: school.state === model.homeState });
    }
    var r = roundOf(col);
    var auto = texasAuto(col, model);
    if (auto) r = { label: 'Automatic admission · top ' + auto + '% of class', code: 'RD', early: null };
    rows.push({
      auto: !!auto,
      n: col.n || sc.n, d: sc.d, admit: col.rate,
      coa: cost.coa, net: cost.net, oos: !!cost.oos, round: r.label,
      earlyCode: r.early ? r.early.code : null,
      earlyDate: r.early ? r.early.date : null,
      odds: auto ? 99 : window.AdmitOdds.odds(school, Object.assign({}, m, { round: 'RD' })),
      oddsEarly: r.early ? window.AdmitOdds.odds(school, Object.assign({}, m, { round: r.early.code })) : null
    });
  });

  if (rows.length < 2) return null;
  rows.sort(function (a, b) { return a.odds - b.odds; });   // от сложных к простым

  return {
    chancesOnly: chancesOnly(),
    actKey: activityKey(P), essayKey: essayKey(P),
    essayPrompt: P.essayPrompt != null ? P.essayPrompt : null, essayWords: model.essayWords,
    noEssay: model.noEssay, noTest: model.sat == null && model.act == null,
    name: (P.name || '').trim() || 'Your report',
    gradYear: P.gradYear || '',
    gpa: model.gpa, sat: model.sat, act: model.act,
    activities: model.activities.length,
    activityTypes: model.activities.map(function (a) { return a.type || ''; }),
    honors: (P.honors || []).filter(function (h) { return (h.title || '').trim(); }).length,
    budget: parseInt(P.budget, 10) || 0,
    major: (P.major || '').trim(),
    rows: rows, skipped: skipped
  };
}

/* ── подстановка в готовый макет ───────────────────────────────────── */
function setText(el, v) { if (el) el.textContent = v; }

function fillHeader(D) {
  var meta = byText(/^Maya S\.$/);            if (meta[0]) setText(meta[0], D.name);
  var cls  = byText(/^Class of \d{4}$/);      if (cls[0] && D.gradYear) setText(cls[0], 'Class of ' + D.gradYear);
  var date = byText(/^\d{1,2} \w+ \d{4}$/);
  if (date[0]) setText(date[0], new Date().toLocaleDateString('en-GB',
    { day: 'numeric', month: 'long', year: 'numeric' }));

  /* Чипы GPA / SAT / ACTIVITIES / HONORS: значение — соседний узел подписи. */
  var want = {
    'GPA': D.gpa != null ? D.gpa.toFixed(2) : '—',
    'SAT': D.sat != null ? String(D.sat) : (D.act != null ? String(D.act) : '0'),
    'ACTIVITIES': String(D.activities),
    'HONORS': String(D.honors)
  };
  Object.keys(want).forEach(function (label) {
    var lab = byText(new RegExp('^' + label + '$', 'i'))[0];
    if (!lab) return;
    /* Подпись обёрнута в span со значком, а значение лежит СОСЕДНИМ узлом —
       поэтому поднимаемся на два уровня, а не на один. */
    var box = lab.parentElement && lab.parentElement.parentElement;
    if (!box) return;
    var nums = $$('span', box).filter(function (e) {
      return e.children.length === 0 && /^[\d.,]+$/.test((e.textContent || '').trim());
    });
    if (nums[0]) setText(nums[0], want[label]);
    if (label === 'SAT' && D.sat == null && D.act != null) setText(lab, 'ACT');
    if (label === 'SAT' && D.sat == null && D.act == null && nums[0]) {
      setText(nums[0], 'Test-optional');
      nums[0].style.fontSize = '20px';
    }
  });
}

/* Цена в $19-отчёте закрыта: цифра размыта, под ней — чем открыть. Реальные
   числа в разметку не кладём, чтобы их нельзя было подсмотреть. */
var LOCK_NOTE = 'Unlock in the Full Report';
function lockNum(el, fake) {
  if (!el) return;
  setText(el, fake);
  el.style.filter = 'blur(7px)';
  el.style.userSelect = 'none';
  el.setAttribute('aria-hidden', 'true');
}

function fillKpis(D) {
  var rows = D.rows;
  var priced = rows.filter(function (r) { return r.net != null && r.coa; });
  var locked = D.chancesOnly || !priced.length;
  var days = daysToNov1();
  var earlyN = rows.filter(function (r) { return r.earlyCode; }).length;
  var K;

  if (locked) {
    var why = D.chancesOnly ? LOCK_NOTE : 'Add your household income to see it';
    K = [[/AVERAGE NET COST/i, '$24,800', why, true],
         [/TOTAL AID ON YOUR LIST/i, '$198,400', why, true],
         [/CHEAPEST IF ADMITTED/i, '$16,200', why, true]];
  } else {
    var avg = function (f) { return Math.round(priced.reduce(function (a, r) { return a + f(r); }, 0) / priced.length); };
    var avgNet = avg(function (r) { return r.net; }), avgCoa = avg(function (r) { return r.coa; });
    var aid4 = avg(function (r) { return Math.max(0, r.coa - r.net); }) * 4;
    var cheap = priced.reduce(function (m, r) { return r.net < m.net ? r : m; }, priced[0]);
    var under = avgCoa ? Math.round((1 - avgNet / avgCoa) * 100) : 0;
    K = [[/AVERAGE NET COST/i, usd(avgNet),
          under > 0 ? under + '% under the ' + usd(avgCoa) + ' sticker average' : 'across your list, after aid'],
         [/TOTAL AID ON YOUR LIST/i, usd(aid4), 'Grants across four years, typical school'],
         [/CHEAPEST IF ADMITTED/i, usd(cheap.net), shortName(cheap.n) + ' — your lowest-cost outcome']];
  }
  K.push([/UNTIL NOV 1/i, String(days),
    earlyN ? earlyN + ' of your schools close first' : 'early rounds close first']);

  K.forEach(function (k) {
    var lab = byText(k[0])[0];
    if (!lab) return;
    var tile = lab.parentElement && lab.parentElement.parentElement;
    if (!tile) return;
    var spans = $$('span', tile).filter(function (e) { return e.children.length === 0; });
    var big = spans.filter(function (e) { return /^[$\d][\d,.]*$/.test((e.textContent||'').trim()); })[0];
    if (k[3]) lockNum(big, k[1]); else if (big) setText(big, k[1]);
    var sub = spans[spans.length - 1];
    if (sub) setText(sub, k[2]);
  });
  fillBoost(rows);
}

/* Самая большая прибавка от раннего раунда. Карточки показывают обычный
   раунд, поэтому здесь — повод подать рано, а не ещё один процент. */
function fillBoost(rows) {
  var lab = byText(/BIGGEST EARLY BOOST/i)[0];
  var tile = lab && lab.parentElement && lab.parentElement.parentElement;
  if (!tile) return;
  var top = null;
  rows.forEach(function (r) {
    if (r.oddsEarly == null) return;
    var g = r.oddsEarly - r.odds;
    if (!top || g > top.g) top = { r: r, g: g };
  });
  var big = tile.querySelector('[data-am-boost]');
  var spans = $$('span', tile).filter(function (e) { return e.children.length === 0; });
  var sub = spans[spans.length - 1];
  if (!top || top.g <= 0) {
    setText(big, '—');
    setText(sub, 'no early-round advantage on your list');
    return;
  }
  setText(big, '+' + top.g + '%');
  setText(sub, shortName(top.r.n) + ' — ' + top.r.odds + '% to ' + top.r.oddsEarly +
          '% if you apply ' + top.r.earlyCode);
}

function daysToNov1() {
  var now = new Date(), yy = now.getMonth() > 9 ? now.getFullYear() + 1 : now.getFullYear();
  return Math.max(0, Math.ceil((new Date(yy, 10, 1) - now) / 86400000));
}

/* У образца дата и счётчик дней живые: застывшие «94 дня» в сентябре
   выглядят как ошибка. Всё остальное у Майи не меняется. */
function freshenSample() {
  var date = document.querySelector('[data-am-date]');
  if (date) setText(date, new Date().toLocaleDateString('en-GB',
    { day: 'numeric', month: 'long', year: 'numeric' }));
  var d = document.querySelector('[data-am-days]');
  if (d) setText(d, String(daysToNov1()));
}

/* Медиана заработка выпускников этой специальности — из College Scorecard.
   Школа-специальность без публикации (Privacy Suppressed) — показываем
   национальную медиану и помечаем «(US)», чтобы не выдавать её за местную. */
function fillEarn(card, dom, major) {
  var row = card.querySelector('[data-am-earn]');
  if (!row) return;
  var codes = (typeof EARN !== 'undefined' && major) ? EARN.majors[major] : null;
  if (!codes) { row.remove(); return; }             // «Undecided» и незнакомые
  var sc = EARN.schools[dom] || {}, val = null, national = false;
  codes.some(function (c) { if (sc[c]) { val = sc[c]; return true; } });
  if (val == null) {
    codes.some(function (c) { if (EARN.national[c]) { val = EARN.national[c]; national = true; return true; } });
  }
  if (val == null) { row.remove(); return; }        // нет и национальной — лучше пусто
  var l = row.querySelector('[data-am-earn-l]'), v = row.querySelector('[data-am-earn-v]');
  setText(l, 'Median pay · ' + major + (national ? ' (US)' : ''));
  setText(v, usd(val));
}

/* Dream / Match / Safety. Вуз с приёмом ниже 40% не бывает «safety»,
   какими бы ни были цифры: так его не считает ни один консультант. */
function tierOf(r) {
  if (r.auto) return 'safety';                          // гарантированное зачисление
  if (r.odds < 30) return 'dream';
  if (r.odds >= 70 && r.admit >= 40) return 'safety';
  return 'match';
}

/* В макете секция — плоская сетка: заголовок группы, её карточки, следующий
   заголовок… Карточки заполняются по порядку, поэтому раскладываем их по
   группам заново, а пустые группы прячем. */
function groupCards(cards) {
  var tags = byText(/^(dream|match|safety)$/i, 'span');
  if (!tags.length || !cards.length) return;
  var grid = cards[0].parentElement;
  var heads = {};
  tags.forEach(function (t) {
    var h = t.parentElement;
    while (h && h.parentElement !== grid) h = h.parentElement;
    if (h) heads[t.textContent.trim().toLowerCase()] = h;
  });
  ['dream', 'match', 'safety'].forEach(function (g) {
    var h = heads[g];
    var mine = cards.filter(function (c) { return c.getAttribute('data-am-tier') === g; });
    if (!h) return;
    h.style.display = mine.length ? '' : 'none';
    grid.appendChild(h);
    mine.forEach(function (c) { grid.appendChild(c); });
    var cnt = $$('span', h).filter(function (e) {
      return e.children.length === 0 && /^\d+ schools?$/.test((e.textContent || '').trim());
    })[0];
    if (cnt) setText(cnt, mine.length + (mine.length === 1 ? ' school' : ' schools'));
  });
}

function fillCards(D) {
  var counts = $$('[data-count]');
  var cards = counts.map(function (c) { return c.parentElement.parentElement; });
  if (!cards.length) return;

  D.rows.forEach(function (r, i) {
    var card = cards[i];
    if (!card) return;
    var nodes = $$('span,img', card);
    var img = nodes[0];
    if (img && img.tagName === 'IMG') {
      img.src = logo(r.d);
      img.onerror = function () { this.style.visibility = 'hidden'; };
    }
    setText(nodes[2], cardName(r.n));
    if (nodes[2]) {                                   // страховка от очень длинных имён
      nodes[2].title = r.n;
      nodes[2].style.overflow = 'hidden';
      nodes[2].style.textOverflow = 'ellipsis';
      nodes[2].style.maxWidth = '100%';
      nodes[2].style.display = 'block';
    }
    card.style.minWidth = '0';
    setText(nodes[3], r.round);
    if (nodes[3]) nodes[3].style.color = '#5f7292';     // синий был у ED-карточек образца
    if (nodes[4]) {
      /* Анимация макета запоминает число образца при загрузке и дописывает его
         поверх нашего, если данные пришли раньше, чем она закончилась. Меняем
         узел целиком: старая анимация пишет в отсоединённый элемент. */
      var pct = nodes[4].cloneNode(false);
      pct.setAttribute('data-count', String(r.odds));
      pct.textContent = r.odds + '%';
      nodes[4].replaceWith(pct);
    }
    if (nodes[5]) nodes[5].style.width = Math.max(2, Math.min(100, r.odds)) + '%';
    if (nodes[6]) nodes[6].style.left = Math.min(97, r.admit) + '%';
    var sticker = r.coa ? 'Sticker ' + usd(r.coa) + (r.oos ? ' · out-of-state' : '') : 'Sticker —';
    if (D.chancesOnly) {
      lockNum(nodes[8], '$21,400');
      setText(nodes[10], LOCK_NOTE);
      if (nodes[11]) nodes[11].style.width = '0%';
      if (nodes[12]) nodes[12].style.width = '100%';
      setText(nodes[13], 'Grants —');
      setText(nodes[14], sticker);
    } else if (r.net == null) {
      setText(nodes[8], '—');
      setText(nodes[10], 'No published net price');
      if (nodes[11]) nodes[11].style.width = '0%';
      if (nodes[12]) nodes[12].style.width = '100%';
      setText(nodes[13], 'Grants —');
      setText(nodes[14], sticker);
    } else {
      setText(nodes[8],  usd(r.net));
      setText(nodes[10], '4-yr ' + usd(r.net * 4));
      var grants = Math.max(0, r.coa - r.net);
      var gPct = Math.max(0, Math.min(100, grants / r.coa * 100));
      if (nodes[11]) nodes[11].style.width = gPct.toFixed(1) + '%';
      if (nodes[12]) nodes[12].style.width = (100 - gPct).toFixed(1) + '%';
      setText(nodes[13], 'Grants ' + usd(grants));
      setText(nodes[14], sticker);
    }
    card.setAttribute('data-am-tier', tierOf(r));
    fillEarn(card, r.d, D.major);
  });

  /* Лишние карточки убираем — у студента может быть меньше десяти школ. */
  cards.slice(D.rows.length).forEach(function (c) { c.remove(); });
  groupCards(cards.slice(0, D.rows.length));

  var cnt = byText(/^\d+ schools?$/)[0];
  if (cnt) setText(cnt, D.rows.length + (D.rows.length === 1 ? ' school' : ' schools'));
}

/* В колонке раннего раунда место на одну строку: «Purdue University»
   переносилась и растягивала логотип. */
function earlyName(n) {
  var s = shortName(n);
  return s.length > 13 ? s.replace(/ (University|College|Institute of Technology)$/, '') : s;
}

function fillEarly(D) {
  var head = byText(/Your (odds|chances) in the early round/i)[0];
  var section = head && head.closest('div[style*="border-radius"]');
  var list = D.rows.filter(function (r) { return r.oddsEarly != null && r.oddsEarly > r.odds; })
                   .sort(function (a, b) { return (b.oddsEarly - b.odds) - (a.oddsEarly - a.odds); });

  var lifts = $$('span').filter(function (e) { return /^↑$/.test((e.textContent||'').trim()); })
                        .map(function (e) { return e.parentElement; });
  if (!lifts.length) return;

  if (!list.length) {                                   // нечего показывать — прячем блок
    var wrap = lifts[0].closest('section') || (section && section.parentElement);
    if (wrap) wrap.style.display = 'none';
    return;
  }

  var shown = list.slice(0, lifts.length);          // в макете три колонки
  var max = Math.max.apply(null, shown.map(function (r) { return r.oddsEarly; })) || 1;
  lifts.forEach(function (badge, i) {
    var block = badge.closest('div[style*="border-radius:16px"]') || badge.parentElement.parentElement;
    var r = shown[i];
    if (!r) { if (block) block.style.display = 'none'; return; }
    var nodes = $$('span,img', block);
    var img = nodes.filter(function (e) { return e.tagName === 'IMG'; })[0];
    if (img) { img.src = logo(r.d); img.onerror = function () { this.style.visibility = 'hidden'; }; }
    var name = nodes.filter(function (e) {
      return e.children.length === 0 && /^[A-Z][A-Za-z .&'-]{2,28}$/.test((e.textContent||'').trim());
    })[0];
    if (name) setText(name, earlyName(r.n));
    var rnd = nodes.filter(function (e) { return /^(ED|EA)\s·/i.test((e.textContent||'').trim()); })[0];
    if (rnd) setText(rnd, r.earlyCode + (r.earlyDate ? ' · ' + r.earlyDate : ''));
    badge.lastChild && (badge.lastChild.nodeValue = (r.oddsEarly - r.odds) + '%');
    var pcts = nodes.filter(function (e) { return /^\d+%$/.test((e.textContent||'').trim()); });
    if (pcts[0]) setText(pcts[0], r.odds + '%');
    if (pcts[1]) setText(pcts[1], r.oddsEarly + '%');
    // столбцы — два последних узла с высотой в px; первым под фильтр попадал логотип
    var bars = $$('span', block).filter(function (e) { return /height:\s*\d+px/.test(e.getAttribute('style')||''); }).slice(-2);
    if (bars[0]) bars[0].style.height = Math.max(40, Math.round(r.odds / max * 150)) + 'px';
    if (bars[1]) bars[1].style.height = Math.max(40, Math.round(r.oddsEarly / max * 150)) + 'px';
  });

  var lift = shown.reduce(function (a, r) { return a + (r.oddsEarly - r.odds); }, 0) / shown.length;

  /* «+9.0 points average lift» — это голый текстовый узел внутри обёртки,
     а не отдельный span, поэтому правим именно childNodes. */
  $$('span').forEach(function (w) {
    [].slice.call(w.childNodes).forEach(function (nd) {
      if (nd.nodeType === 3 && /points average lift/i.test(nd.nodeValue || '')) {
        nd.nodeValue = '+' + lift.toFixed(1) + ' points average lift';
      }
    });
  });

  var of = byText(/^\d+ of your \d+ schools$/i)[0];
  if (of) setText(of, shown.length + ' of your ' + D.rows.length + ' schools');

  /* Подпись про Duke осталась от образца — заменяем на реальные школы. */
  var note = byText(/Early Decision is binding/i)[0];
  if (note) {
    var binding = shown.filter(function (r) { return r.earlyCode === 'ED'; })
                       .map(function (r) { return earlyName(r.n); });
    var names = binding.length > 1
      ? binding.slice(0, -1).join(', ') + ' and ' + binding[binding.length - 1] : binding[0];
    setText(note, binding.length
      ? 'One shared scale · ' + names + (binding.length > 1 ? ' are' : ' is') + ' binding'
      : 'One shared scale · Early Action is not binding');
  }
}

/* Активности и эссе пока не оцениваются — показывать чужие числа нельзя. */
/* Секции «активности» и «эссе» заполняются, если оценка уже есть в кэше
   (её кладут api/activities.js и api/essay.js). Оценки нет — секцию прячем:
   показывать чужие числа в личном отчёте нельзя. */
function cached(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
}

function fillScoreSection(re, data, subLabels, itemNoun, types) {
  var head = byText(re, 'h1,h2,h3,span,div')[0];
  var sec = head && (head.closest('section') || head.parentElement.parentElement);
  if (!sec) return;
  if (sec.dataset.amDisplay == null) sec.dataset.amDisplay = sec.style.display;
  if (!data || !(data.overall > 0)) { sec.style.display = 'none'; return; }
  sec.style.display = sec.dataset.amDisplay;

  /* Строка списка — это span, у которого ровно два дочерних span:
     название и балл вида «94/100». Ищем именно их, иначе крупное число
     раздела и цифры осей попадают в ту же выборку. */
  var rows = $$('span', sec).filter(function (e) {
    if (e.children.length !== 2) return false;
    var first = e.children[0], last = e.children[1];
    // название — текстовый span без детей; балл — «94/100» из двух узлов
    return first.tagName === 'SPAN' && first.children.length === 0 &&
           (first.textContent || '').trim().length > 1 &&
           /\d+\s*\/\s*100/.test(last.textContent || '');
  });
  var rowNums = [];
  rows.forEach(function (r) {
    $$('span', r).forEach(function (x) { rowNums.push(x); });
  });

  var items = data.items || [];
  /* У критериев эссе в шаблоне своя иконка на каждый. Строки сортируются по
     баллу, поэтому запоминаем иконку по названию, пока шаблон не тронут. */
  var iconOf = {};
  if (!types) rows.forEach(function (r) {
    var ic = r.parentElement && r.parentElement.querySelector('svg');
    var nm = (r.children[0].textContent || '').trim();
    if (ic && !r.contains(ic) && nm) iconOf[nm] = ic.innerHTML;
  });
  rows.forEach(function (r, i) {
    var it = items[i];
    // карточка строки — родитель с иконкой; прячем её целиком, иначе остаётся
    // пустая плитка с иконкой из образца
    var card = r.parentElement && r.parentElement.querySelector('svg') ? r.parentElement : r;
    // у карточки свой inline display:flex — запоминаем его, а не затираем
    if (card.dataset.amDisplay == null) card.dataset.amDisplay = card.style.display;
    if (!it) { card.style.display = 'none'; return; }
    card.style.display = card.dataset.amDisplay;
    var nameEl = r.children[0];
    if (nameEl) nameEl.textContent = it.name;
    // иконка макета принадлежит строке образца — ставим свою по типу активности
    var ic = r.parentElement && r.parentElement.querySelector('svg');
    if (ic && !r.contains(ic)) {
      if (types) ic.innerHTML = ACT_ICON(it.type || types[i]);
      else if (iconOf[it.name]) ic.innerHTML = iconOf[it.name];
    }
    var scoreEl = r.children[1];
    if (scoreEl) {
      // «94» и «/100» лежат отдельными узлами — правим только число
      var numNode = $$('span', scoreEl).filter(function (x) {
        return /^\d{1,3}$/.test((x.textContent || '').trim());
      })[0];
      if (numNode) numNode.textContent = String(it.score);
      else scoreEl.textContent = it.score + '/100';
      // полоска строки — ширина была из образца
      var fill = scoreEl.querySelector('span > span[style*="width"]');
      if (fill) fill.style.width = Math.max(2, Math.min(100, it.score)) + '%';
    }
  });

  // общий балл — самое крупное число раздела, не входящее в строки
  var big = $$('span,div', sec).filter(function (e) {
    return e.children.length === 0 && rowNums.indexOf(e) < 0 &&
           /^\d{1,3}$/.test((e.textContent || '').trim()) &&
           parseFloat(getComputedStyle(e).fontSize) > 34;
  })[0];
  if (big) setText(big, String(data.overall));
  // кольцо вокруг общего балла: длина дуги = балл из 100 (в образце — 79)
  var arc = sec.querySelector('circle[stroke-dasharray]');
  if (arc) {
    var C = 2 * Math.PI * (parseFloat(arc.getAttribute('r')) || 62);
    var len = C * Math.max(0, Math.min(100, data.overall)) / 100;
    arc.setAttribute('stroke-dasharray', len.toFixed(1) + ' ' + (C - len).toFixed(1));
  }

  // три оси: число рядом с подписью, тоже не из строк
  subLabels.forEach(function (pair) {
    var lab = byText(new RegExp('^' + pair[1] + '$', 'i'))[0];
    if (!lab || !sec.contains(lab)) return;
    var box = lab.parentElement;
    var num = $$('span,div', box).filter(function (e) {
      return e.children.length === 0 && rowNums.indexOf(e) < 0 &&
             /^\d{1,3}$/.test((e.textContent || '').trim());
    })[0];
    var v = data.subs && data.subs[pair[0]];
    if (num && v != null) setText(num, String(v));
    var track = box.nextElementSibling, f = track && track.firstElementChild;
    if (f && v != null) f.style.width = Math.max(2, Math.min(100, v)) + '%';
  });

  // подзаголовок макета говорит «Ten activities» — ставим реальное число
  if (itemNoun) {
    var sub = $$('span,p,div', sec).filter(function (e) {
      return e.children.length === 0 && /scored|criteria|words/i.test(e.textContent || '');
    })[0];
    if (sub) setText(sub, items.length + ' ' + itemNoun +
      (items.length === 1 ? '' : 's') + ', scored against the students admitted to your list');
  }
}

/* Пять критериев оценки активностей (api/activities.js, рубрика владельца). В шаблоне отчёта
   под кольцом только три строки — достраиваем недостающие по образцу. */
var ACT_AXES = [['depth', 'Depth over breadth'], ['leadership', 'Leadership & initiative'],
                ['impact', 'Quantifiable impact'], ['progression', 'Progression over time'],
                ['narrative', 'Personal narrative']];
function setAxes(re, subs) {
  var head = byText(re, 'h1,h2,h3,span,div')[0];
  var sec = head && (head.closest('section') || head.parentElement.parentElement);
  if (!sec || !subs) return;
  var labs = byText(/^(Leadership|Depth and commitment|Impact)$/, 'span')
    .filter(function (e) { return sec.contains(e); });
  if (!labs.length) return;
  var row = labs[0].parentElement.parentElement, list = row.parentElement;
  var rows = [].slice.call(list.children).filter(function (c) {
    return labs.some(function (l) { return c.contains(l); });
  });
  while (rows.length < ACT_AXES.length) {
    var copy = rows[rows.length - 1].cloneNode(true);
    list.appendChild(copy);
    rows.push(copy);
  }
  rows.forEach(function (r, i) {
    var ax = ACT_AXES[i], v = subs[ax[0]];
    var spans = $$('span', r).filter(function (e) { return e.children.length === 0; });
    setText(spans[0], ax[1]);                           // подпись
    if (spans[1]) setText(spans[1], v != null ? String(v) : '—');
    var f = r.querySelector('span[style*="width"]');
    if (f && v != null) f.style.width = Math.max(2, Math.min(100, v)) + '%';
  });
  list.style.gap = '9px';                              // пять строк вместо трёх — плотнее
  sec.setAttribute('data-am-grow', '1');
}

function hideUnscored(D) {
  var acts = cachedFor('admitmap_activity_scores', D.actKey);
  fillScoreSection(/What your activities are worth/i, acts, [], 'activitie', D.activityTypes);
  if (acts) setAxes(/What your activities are worth/i, acts.subs);
  var es = cachedFor('admitmap_essay_scores', D.essayKey);
  fillScoreSection(/How your essay reads/i, es, []);
  if (es) {
    var eh = byText(/How your essay reads/i, 'h1,h2,h3,span,div')[0];
    var sub = eh && $$('span', eh.parentElement).filter(function (e) {
      return e !== eh && e.children.length === 0 && /words|criteria/i.test(e.textContent || '');
    })[0];
    if (sub) setText(sub, (D.essayPrompt != null ? 'Common App #' + (D.essayPrompt + 1) + ' · ' : '') +
      D.essayWords + ' words, scored on six criteria');
  }
  if (D.noEssay) showNoEssay(D);
}

/* Эссе не отправлено. Раздел не прячем молча: модель за это снижает шансы,
   и ученик должен видеть, почему и насколько. */
function showNoEssay(D) {
  var head = byText(/How your essay reads/i, 'h1,h2,h3,span,div')[0];
  var sec = head && (head.closest('section') || head.parentElement.parentElement);
  if (!sec) return;
  sec.style.display = sec.dataset.amDisplay != null ? sec.dataset.amDisplay : '';
  var top = head.parentElement;
  [].slice.call(sec.children).forEach(function (c) { if (c !== top && !c.contains(head)) c.style.display = 'none'; });
  var sub = $$('span', top).filter(function (e) { return e !== head && e.children.length === 0; })[0];
  if (sub) setText(sub, 'Not submitted');

  var sel = D.rows.filter(function (r) { return r.admit < 20; }).length;
  var box = document.createElement('div');
  box.setAttribute('data-am-noessay', '1');
  box.style.cssText = 'display:flex;align-items:center;gap:22px;padding:28px 30px;border-radius:22px;' +
    'background:#ffffff;border:1.5px solid #fde7c2;box-shadow:0 3px 0 #fdf3e1,0 12px 26px rgba(15,31,75,.06);' +
    "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f1f4b";
  box.innerHTML =
    '<span style="display:flex;align-items:center;justify-content:center;flex-shrink:0;width:56px;height:56px;' +
      'border-radius:16px;background:#fff7e8;color:#d97706">' +
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5z"/>' +
      '<path d="M13.5 7.5l3 3"/></svg></span>' +
    '<span style="display:flex;flex-direction:column;gap:6px;min-width:0;flex:1">' +
      '<span style="font-family:Fraunces,Georgia,serif;font-size:22px;font-weight:800;letter-spacing:-.02em">' +
        'Your essay is missing, and it is costing you.</span>' +
      '<span style="font-size:15px;line-height:1.55;color:#5b7098">' +
        (sel ? 'At ' + sel + (sel === 1 ? ' school' : ' schools') + ' on your list, readers weigh the ' +
               'personal statement heavily. Every percentage above already counts it as missing. '
             : 'Every percentage above already counts your essay as missing. ') +
        'Even a rough draft moves the numbers.</span></span>' +
    '<a href="funnel.html?back=report.html#essay" style="flex-shrink:0;display:inline-flex;align-items:center;gap:8px;' +
      'padding:14px 20px;border-radius:13px;background:#2563eb;color:#ffffff;text-decoration:none;' +
      'font-size:14px;font-weight:800">Add your essay</a>';
  top.parentElement === sec ? sec.appendChild(box) : top.after(box);
}

/* Если профиль есть, но отчёт по нему не строится (школ нет в базе, не
   заполнен GPA), показывать образец Майи НЕЛЬЗЯ: покупатель получит чужой
   отчёт со своим именем во вкладке. Вместо этого — честное объяснение. */
function showCannotBuild(reason, paid) {
  var host = document.querySelector('#dc-root .sc-host') || document.getElementById('dc-root');
  if (!host) return;
  host.innerHTML =
    '<div style="max-width:620px;margin:0 auto;padding:64px 28px;font-family:Inter,' +
    "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" + ';color:#0f1f4b">' +
      '<div style="font-family:Fraunces,Georgia,serif;font-size:34px;font-weight:900;' +
      'line-height:1.1;letter-spacing:-.02em;margin-bottom:16px">' +
        'We could not build your report yet.</div>' +
      '<p style="font-size:16px;line-height:1.65;color:#5b7098;margin:0 0 22px">' + reason + '</p>' +
      '<a href="funnel.html" style="display:inline-flex;align-items:center;gap:8px;' +
      'background:#2563eb;color:#fff;text-decoration:none;font-weight:700;font-size:14px;' +
      'padding:13px 22px;border-radius:11px">Back to my profile →</a>' +
      (paid ? '' :
      '<p style="font-size:13px;line-height:1.6;color:#8296b5;margin:26px 0 0">' +
        'If this keeps happening, email support@admitmap.app and we will sort it out. ' +
        'You have not been charged for a report we could not produce.</p>') +
    '</div>';
  document.title = 'Report unavailable · AdmitMap';
}

function whyCannotBuild() {
  var P;
  try { P = JSON.parse(localStorage.getItem('admitmap_profile') || 'null'); } catch (e) { return null; }
  if (!P) return null;                                  // профиля нет — законный образец
  if (!P.schools || !P.schools.length)
    return 'There are no schools on your list yet. Add at least two and we will score them.';
  if (!(parseFloat(P.gpa) > 0))
    return 'Your GPA is missing, and without it we will not guess at your odds.';

  var named = (P.schools || []).map(function (x) { return x.n; });
  return 'We do not have verified admissions and cost data for ' +
    (named.length === 1 ? 'the school on your list'
                        : 'enough of the schools on your list') +
    ' — ' + named.slice(0, 4).join(', ') +
    (named.length > 4 ? ' and others' : '') +
    '. We only publish odds we can stand behind, so we would rather show you nothing ' +
    'than a number we made up. Add a few more schools and it should build.';
}

/* Лендинг ведёт на тот же report.html, поэтому у посетителя со случайным
   недозаполненным профилем вместо образца появлялся экран «не смогли собрать».
   ?sample=1 — явная просьба показать именно образец: ничего не подставляем. */
function sampleRequested() {
  try {
    return /[?&]sample=1\b/.test(location.search) || location.hash === '#sample';
  } catch (e) { return false; }
}

/* Лист макета свёрстан под образец: 10 школ (4+4+2), все разделы на месте,
   высоты рядов и самого листа заданы в пикселях. У настоящего ученика школ
   меньше, группы другие, часть разделов скрыта — без пересчёта остаются
   пустые разрывы и карточки налезают на заголовки. Базой берём исходные
   высоты шаблона, поэтому отступы дизайна не меняются. */
var px = function (v) { return (v || '').split(/\s+/).filter(Boolean).map(parseFloat); };
var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
function relayout() {
  var first = document.querySelector('[data-count]');
  var grid = first && first.parentElement.parentElement.parentElement;
  var outer = grid && grid.parentElement, art = outer && outer.parentElement;
  if (!grid || !outer || !art) return;
  if (!outer.dataset.amRows) {
    outer.dataset.amRows = outer.style.gridTemplateRows;
    grid.dataset.amRows = grid.style.gridTemplateRows;
    art.dataset.amH = String(parseFloat(art.style.height) || art.offsetHeight);
  }
  var gOrig = px(grid.dataset.amRows), oOrig = px(outer.dataset.amRows);
  var HEAD = gOrig[0], CARD = gOrig[1];
  var gap = parseFloat(getComputedStyle(grid).rowGap) || 0;

  var rows = [], pending = 0;
  [].slice.call(grid.children).forEach(function (c) {
    if (getComputedStyle(c).display === 'none') return;
    if (/grid-column:\s*1\s*\/\s*-1/.test(c.getAttribute('style') || '')) {
      if (pending) { rows.push(CARD); pending = 0; }
      rows.push(HEAD);
    } else if (++pending === 2) { rows.push(CARD); pending = 0; }
  });
  if (pending) rows.push(CARD);
  grid.style.gridTemplateRows = rows.map(function (r) { return r + 'px'; }).join(' ');
  var hOf = function (a) { return a.length ? sum(a) + gap * (a.length - 1) : 0; };

  /* Скрытый (display:none) раздел не занимает ряд сетки — все следующие
     сдвигаются вверх. Поэтому его ряд не обнуляем, а убираем совсем. */
  var oNew = [];
  [].slice.call(outer.children).forEach(function (c, i) {
    if (i >= oOrig.length || getComputedStyle(c).display === 'none') return;
    var h = oOrig[i];
    if (c === grid) h = oOrig[i] + hOf(rows) - hOf(gOrig);
    else if (c.querySelector('[data-am-noessay]') || c.getAttribute('data-am-grow')) {
      var cs = getComputedStyle(c), vis = [].slice.call(c.children).filter(function (k) {
        return getComputedStyle(k).display !== 'none';
      });
      var natural = Math.ceil(parseFloat(cs.paddingTop) + sum(vis.map(function (k) { return k.offsetHeight; })) +
                (parseFloat(cs.rowGap) || 0) * (vis.length - 1) + 40);
      h = c.getAttribute('data-am-grow') ? Math.max(oOrig[i], natural) : natural;
    }
    oNew.push(h);
  });
  outer.style.gridTemplateRows = oNew.map(function (r) { return r + 'px'; }).join(' ');
  art.style.height = (parseFloat(art.dataset.amH) + sum(oNew) - sum(oOrig)) + 'px';
}

function personalize() {
  if (sampleRequested()) { freshenSample(); return false; }   // образец Майи, как просили
  var D = build();
  if (!D) {
    var why = whyCannotBuild();
    if (why) { showCannotBuild(why); return true; }   // профиль есть, но отчёт не выходит
    freshenSample();
    return false;                                      // профиля нет — остаётся образец
  }
  try {
    fillHeader(D); fillKpis(D); fillCards(D); fillEarly(D); hideUnscored(D); relayout();
    document.documentElement.setAttribute('data-am-personal', '1');
    if (D.skipped.length) console.info('AdmitMap: без данных, пропущены —', D.skipped.join(', '));
  } catch (e) { console.error('AdmitMap personalize:', e); return false; }
  return true;
}

function paywallUrl() {
  return (window.innerWidth || 1024) < 768 ? 'paywall.html' : 'paywall-desktop.html';
}

/* Отчёт — после оплаты. Образец (?sample=1) и пустой профиль — как раньше. */
function run() {
  if (sampleRequested()) return Promise.resolve(personalize());
  var P = null;
  try { P = JSON.parse(localStorage.getItem('admitmap_profile') || 'null'); } catch (e) {}
  if (!P || !P.schools || !P.schools.length) return Promise.resolve(personalize());
  return purchase().then(function (p) {
    if (!p) { location.replace(paywallUrl()); return true; }
    if (p.error) {
      showCannotBuild('We could not confirm your payment yet: ' + p.error +
        ' If you were charged, email support@admitmap.app with the address you paid with and we will send your report.', true);
      return true;
    }
    PURCHASE = p;
    return (p.id ? scoreProfile(P, p.id) : Promise.resolve()).then(personalize);
  });
}

window.AdmitMapPersonalize = run;
})();
