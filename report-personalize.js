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
                 years: (a.grades || []).length || 1 };
      }),
    rankPct: (rank > 0 && size > 0) ? Math.round(rank / size * 1000) / 10 : null,
    homeState: window.AdmitOdds ? window.AdmitOdds.stateCode(P.state) : null,
    round: 'RD'
  };
  /* Оценку эссе берём из кэша грейдера, если он уже отработал. */
  try {
    var es = JSON.parse(localStorage.getItem('admitmap_essay_scores') || 'null');
    if (es && es.overall > 0) m.essayScore = Math.max(0, Math.min(10, es.overall / 10));
  } catch (e) {}
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
function costFor(col, name, income) {
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
function roundOf(col) {
  /* Карточка показывает обычный раунд — процент на ней посчитан для него.
     Ранний раунд живёт в отдельном блоке. */
  var early = col && col.ed ? { code: 'ED', date: col.ed }
            : col && col.ea ? { code: 'EA', date: col.ea } : null;
  return { label: col && col.rd ? 'Regular Decision · ' + col.rd : 'Regular Decision',
           code: 'RD', early: early };
}

function build() {
  var P;
  try { P = JSON.parse(localStorage.getItem('admitmap_profile') || 'null'); } catch (e) { return null; }
  if (!P || !P.schools || !P.schools.length) return null;
  var model = modelFrom(P);
  if (!model || typeof COLLEGES === 'undefined' || !window.AdmitOdds) return null;

  var income = parseInt(P.income, 10) || 0;
  var rows = [], skipped = [];

  P.schools.forEach(function (sc) {
    var col = COLLEGES[sc.d];
    var cost = costFor(col, sc.n, income);
    if (!col || col.rate == null || !cost || cost.net == null) { skipped.push(sc.n); return; }
    var sat = col.sat != null ? col.sat
            : (col.act != null ? window.AdmitOdds.actToSat(col.act)
                               : window.AdmitOdds.satFromRate(col.rate));
    var school = { rate: col.rate, sat: sat, act: col.act || null,
                   gpa: col.gpa != null ? col.gpa : null,
                   isPublic: col.pub === true, state: col.state || null };
    var m = model;
    if (school.isPublic && school.state && model.homeState) {
      m = Object.assign({}, model, { inState: school.state === model.homeState });
    }
    var r = roundOf(col);
    rows.push({
      n: col.n || sc.n, d: sc.d, admit: col.rate,
      coa: cost.coa, net: cost.net, round: r.label,
      earlyCode: r.early ? r.early.code : null,
      earlyDate: r.early ? r.early.date : null,
      odds: window.AdmitOdds.odds(school, Object.assign({}, m, { round: 'RD' })),
      oddsEarly: r.early ? window.AdmitOdds.odds(school, Object.assign({}, m, { round: r.early.code })) : null
    });
  });

  if (rows.length < 2) return null;
  rows.sort(function (a, b) { return a.odds - b.odds; });   // от сложных к простым

  return {
    name: (P.name || '').trim() || 'Your report',
    gradYear: P.gradYear || '',
    gpa: model.gpa, sat: model.sat, act: model.act,
    activities: model.activities.length,
    honors: (P.honors || []).filter(function (h) { return (h.title || '').trim(); }).length,
    budget: parseInt(P.budget, 10) || 0,
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
    'SAT': D.sat != null ? String(D.sat) : (D.act != null ? String(D.act) : '—'),
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
  });
}

function fillKpis(D) {
  var rows = D.rows;
  var avgNet = Math.round(rows.reduce(function (a, r) { return a + r.net; }, 0) / rows.length);
  var avgCoa = Math.round(rows.reduce(function (a, r) { return a + r.coa; }, 0) / rows.length);
  var aid4   = Math.round(rows.reduce(function (a, r) { return a + (r.coa - r.net); }, 0) / rows.length) * 4;
  var cheap  = rows.reduce(function (m, r) { return r.net < m.net ? r : m; }, rows[0]);
  var best   = rows.reduce(function (m, r) { return r.odds > m.odds ? r : m; }, rows[0]);
  var now = new Date(), yy = now.getMonth() > 9 ? now.getFullYear() + 1 : now.getFullYear();
  var days = Math.max(0, Math.ceil((new Date(yy, 10, 1) - now) / 86400000));
  var earlyN = rows.filter(function (r) { return r.earlyCode; }).length;
  var under = avgCoa ? Math.round((1 - avgNet / avgCoa) * 100) : 0;

  var K = [
    [/AVERAGE NET COST/i, usd(avgNet), null,
      under > 0 ? under + '% under the ' + usd(avgCoa) + ' sticker average' : 'across your list, after aid'],
    [/TOTAL AID ON YOUR LIST/i, usd(aid4), null, 'Grants across four years, typical school'],
    [/CHEAPEST IF ADMITTED/i, usd(cheap.net), '/ yr', shortName(cheap.n) + ' — your lowest-cost outcome'],
    [/YOUR BEST ODDS/i, String(best.odds), '%', shortName(best.n) + ' — and ' + usd(best.net) + ' / yr after aid'],
    [/UNTIL NOV 1/i, String(days), 'days',
      earlyN ? earlyN + ' of your schools close first' : 'early rounds close first']
  ];

  K.forEach(function (k) {
    var lab = byText(k[0])[0];
    if (!lab) return;
    var tile = lab.parentElement && lab.parentElement.parentElement;
    if (!tile) return;
    var spans = $$('span', tile).filter(function (e) { return e.children.length === 0; });
    var big = spans.filter(function (e) { return /^[$\d][\d,.]*$/.test((e.textContent||'').trim()); })[0];
    if (big) setText(big, k[1]);
    var sub = spans[spans.length - 1];
    if (sub) setText(sub, k[3]);
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
    setText(nodes[2], r.n);
    setText(nodes[3], r.round);
    if (nodes[4]) { nodes[4].setAttribute('data-count', String(r.odds)); setText(nodes[4], r.odds + '%'); }
    if (nodes[5]) nodes[5].style.width = Math.max(2, Math.min(100, r.odds)) + '%';
    if (nodes[6]) nodes[6].style.left = Math.min(97, r.admit) + '%';
    setText(nodes[8],  usd(r.net));
    setText(nodes[10], '4-yr ' + usd(r.net * 4));
    var grants = r.coa - r.net;
    var gPct = Math.max(0, Math.min(100, grants / r.coa * 100));
    if (nodes[11]) nodes[11].style.width = gPct.toFixed(1) + '%';
    if (nodes[12]) nodes[12].style.width = (100 - gPct).toFixed(1) + '%';
    setText(nodes[13], 'Grants ' + usd(grants));
    setText(nodes[14], 'Sticker ' + usd(r.coa));
  });

  /* Лишние карточки убираем — у студента может быть меньше десяти школ. */
  cards.slice(D.rows.length).forEach(function (c) { c.remove(); });

  var cnt = byText(/^\d+ schools?$/)[0];
  if (cnt) setText(cnt, D.rows.length + (D.rows.length === 1 ? ' school' : ' schools'));
}

function fillEarly(D) {
  var head = byText(/Your odds in the early round/i)[0];
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
    if (name) setText(name, shortName(r.n));
    var rnd = nodes.filter(function (e) { return /^(ED|EA)\s·/i.test((e.textContent||'').trim()); })[0];
    if (rnd) setText(rnd, r.earlyCode + (r.earlyDate ? ' · ' + r.earlyDate : ''));
    badge.lastChild && (badge.lastChild.nodeValue = (r.oddsEarly - r.odds) + '%');
    var pcts = nodes.filter(function (e) { return /^\d+%$/.test((e.textContent||'').trim()); });
    if (pcts[0]) setText(pcts[0], r.odds + '%');
    if (pcts[1]) setText(pcts[1], r.oddsEarly + '%');
    var bars = $$('span', block).filter(function (e) { return /height:\s*\d+px/.test(e.getAttribute('style')||''); });
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
                       .map(function (r) { return shortName(r.n); });
    setText(note, binding.length
      ? 'One shared scale · ' + binding.join(' and ') + (binding.length > 1 ? ' are' : ' is') + ' binding'
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

function fillScoreSection(re, data, subLabels, itemNoun) {
  var head = byText(re, 'h1,h2,h3,span,div')[0];
  var sec = head && (head.closest('section') || head.parentElement.parentElement);
  if (!sec) return;
  if (!data || !(data.overall > 0)) { sec.style.display = 'none'; return; }
  sec.style.display = '';

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
  rows.forEach(function (r, i) {
    var it = items[i];
    if (!it) { r.style.display = 'none'; return; }
    r.style.display = '';
    var nameEl = r.children[0];
    if (nameEl) nameEl.textContent = it.name;
    var scoreEl = r.children[1];
    if (scoreEl) {
      // «94» и «/100» лежат отдельными узлами — правим только число
      var numNode = $$('span', scoreEl).filter(function (x) {
        return /^\d{1,3}$/.test((x.textContent || '').trim());
      })[0];
      if (numNode) numNode.textContent = String(it.score);
      else scoreEl.textContent = it.score + '/100';
    }
  });

  // общий балл — самое крупное число раздела, не входящее в строки
  var big = $$('span,div', sec).filter(function (e) {
    return e.children.length === 0 && rowNums.indexOf(e) < 0 &&
           /^\d{1,3}$/.test((e.textContent || '').trim()) &&
           parseFloat(getComputedStyle(e).fontSize) > 34;
  })[0];
  if (big) setText(big, String(data.overall));

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

function hideUnscored(D) {
  fillScoreSection(/What your activities are worth/i, cached('admitmap_activity_scores'),
    [['leadership', 'Leadership'], ['depth', 'Depth and commitment'], ['impact', 'Impact']], 'activitie');
  fillScoreSection(/How your essay reads/i, cached('admitmap_essay_scores'),
    [['craft', 'Craft'], ['substance', 'Substance'], ['distinct', 'Distinctiveness']]);
}

/* Если профиль есть, но отчёт по нему не строится (школ нет в базе, не
   заполнен GPA), показывать образец Майи НЕЛЬЗЯ: покупатель получит чужой
   отчёт со своим именем во вкладке. Вместо этого — честное объяснение. */
function showCannotBuild(reason) {
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
      '<p style="font-size:13px;line-height:1.6;color:#8296b5;margin:26px 0 0">' +
        'If this keeps happening, email support@admitmap.app and we will sort it out. ' +
        'You have not been charged for a report we could not produce.</p>' +
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

function personalize() {
  if (sampleRequested()) return false;                 // образец Майи, как просили
  var D = build();
  if (!D) {
    var why = whyCannotBuild();
    if (why) { showCannotBuild(why); return true; }   // профиль есть, но отчёт не выходит
    return false;                                      // профиля нет — остаётся образец
  }
  try {
    fillHeader(D); fillKpis(D); fillCards(D); fillEarly(D); hideUnscored(D);
    document.documentElement.setAttribute('data-am-personal', '1');
    if (D.skipped.length) console.info('AdmitMap: без данных, пропущены —', D.skipped.join(', '));
  } catch (e) { console.error('AdmitMap personalize:', e); return false; }
  return true;
}

window.AdmitMapPersonalize = personalize;
})();
