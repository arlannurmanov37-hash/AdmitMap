/* AdmitMap — оценка эссе, активностей и наград (api/essay, api/activities,
   api/honors). Общий код для экрана загрузки (loading.html — там оценка идёт,
   пока крутится прогресс) и для отчёта (если текст поменяли после загрузки).
   Результат хранится в localStorage вместе с отпечатком текста. */
(function (root) {
'use strict';

/*    Оценки эссе и активностей делает Claude на сервере (api/essay.js,
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
function honorsFor(P) {
  return (P.honors || []).filter(function (h) { return (h.title || '').trim(); }).slice(0, 5);
}
function honorKey(P) {
  return fnv(JSON.stringify(honorsFor(P).map(function (h) {
    return [h.title || '', (h.grades || []).join(','), (h.levels || []).join(',')];
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
  if (path === '/api/honors') {
    var hi = body.honors.map(function (h) {
      var t = /olympiad|isef|national merit finalist|regeneron|publish/i.test(h.title) ? 1
            : /state|regional|all-state|distinction|semifinal/i.test(h.title) ? 2 : 3;
      return { name: h.title, tier: t, score: t === 1 ? 85 : t === 2 ? 58 : 22, note: '' };
    });
    var best = Math.max.apply(null, hi.map(function (x) { return x.score; }));
    return wait(1500).then(function () { return { ok: true, overall: best + hi.length - 1, items: hi }; });
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

/* Оценить то, что ещё не оценено для этого текста. Ошибка оценки не ломает
   отчёт: шансы посчитаются без неё (активности — по часам, эссе — нейтрально). */
function scoreProfile(P, id) {
  id = id || '';
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
  var hons = honorsFor(P), hk = honorKey(P);
  if (hons.length && !cachedFor('admitmap_honor_scores', hk)) {
    jobs.push(post('/api/honors', { checkout_id: id, honors: hons.map(function (h) {
      return { title: h.title, grades: h.grades || [], levels: h.levels || [] };
    }) }, 115000).then(function (r) {
      if (!r.ok) { console.warn('AdmitMap: honor scoring failed —', r.error); return; }
      store('admitmap_honor_scores', { h: hk, overall: r.overall, items: r.items, verdict: r.verdict });
    }));
  }
  var essay = String(P.essay || '').trim(), ek = essayKey(P);
  var ew = essay.split(/\s+/).filter(Boolean).length;
  if (ew >= 50 && ew <= 650 && !cachedFor('admitmap_essay_scores', ek)) {
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
  return Promise.all(jobs).then(function () { return jobs.length; });
}


function needsScoring(P) {
  var need = false;
  if (actsFor(P).length && !cachedFor('admitmap_activity_scores', activityKey(P))) need = true;
  if (honorsFor(P).length && !cachedFor('admitmap_honor_scores', honorKey(P))) need = true;
  var ew = String(P.essay || '').trim().split(/\s+/).filter(Boolean).length;
  if (ew >= 50 && ew <= 650 && !cachedFor('admitmap_essay_scores', essayKey(P))) need = true;
  return need;
}

/* Можно ли вообще звать сервер: на localhost его нет — только с имитацией. */
function canScore() {
  try { return !isLocal() || localStorage.getItem('admitmap_mock_api') === '1'; } catch (e) { return false; }
}

root.AdmitScoring = {
  fnv: fnv, actsFor: actsFor, activityKey: activityKey, honorsFor: honorsFor,
  honorKey: honorKey, essayKey: essayKey, cachedFor: cachedFor, store: store,
  isLocal: isLocal, post: post, wait: wait, scoreProfile: scoreProfile,
  needsScoring: needsScoring, canScore: canScore
};
})(window);
