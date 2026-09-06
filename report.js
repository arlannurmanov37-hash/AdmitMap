/* AdmitMap — SnapScore Report.
   Одна страница на два случая: образец (?sample=1 или пустой профиль) и личный
   отчёт из localStorage['admitmap_profile']. Шансы считает общий data/odds.js —
   тот же, что в платформе, чтобы цифры не расходились.                        */
(function () {
'use strict';

/* ── мелкие помощники ─────────────────────────────────────────────── */
var $ = function (id) { return document.getElementById(id); };
var usd = function (n) { return n == null || isNaN(n) ? '—' : '$' + Math.round(n).toLocaleString(); };
var esc = function (s) { return String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
var logo = function (d) { return 'https://www.google.com/s2/favicons?domain=' + d + '&sz=128'; };
var ABBR = {'New York University':'NYU','University of California-Los Angeles':'UCLA'};
var short = function (n) { return ABBR[n] || n.replace('University of ','').replace(' University',''); };

var tierOf = function (p) { return p < 15 ? 'reach' : p < 45 ? 'match' : 'safety'; };
var TIERS = [
  ['reach',  'Dream',  'Reach · under 15% odds'],
  ['match',  'Match',  '15–45% odds'],
  ['safety', 'Safety', '45%+ odds']
];

/* ── профиль воронки → данные отчёта ──────────────────────────────── */
var REC = {'International':'international','National':'national','State/Regional':'state','School':null};

function incomeBand(v) {
  if (!(v > 0)) return 'Not shared';
  if (v < 30000)  return 'Under $30,000';
  if (v < 48000)  return '$30,000–$48,000';
  if (v < 75000)  return '$48,000–$75,000';
  if (v < 110000) return '$75,000–$110,000';
  return 'Over $110,000';
}

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
  return {
    gpa: gpa,
    sat: sat > 0 ? sat : null,
    act: act > 0 ? act : null,
    apScores: (P.apExams || []).map(function (e) { return parseInt(e.s, 10); }).filter(function (x) { return x > 0; }),
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
}

/* Нетто-цена: выверенные вручную 7 полос → таблица FIN → 5 полос Scorecard. */
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
  var f = (typeof finFor === 'function') ? finFor(name) : null;
  if (f && f.coa) return { coa: f.coa, net: estNetPrice(f, income) };
  if (col && col.inc && col.coa) {
    var n5 = bandNet(col.inc, [30000,48000,75000,110000,Infinity], income);
    if (n5 != null) return { coa: col.coa, net: n5 };
  }
  if (col && col.coa != null && col.np != null) return { coa: col.coa, net: col.np };
  return null;
}

/* Какой раунд показываем и по какому считаем множитель. */
function roundOf(col) {
  // Карточка всегда показывает ОБЫЧНЫЙ раунд: проценту на ней соответствует
  // именно он. Ранний раунд и его прибавка живут в отдельном разделе, иначе
  // подпись «Early Decision» стояла бы рядом с числом, посчитанным для RD.
  var early = col && col.ed ? { code: 'ED', date: col.ed }
            : col && col.ea ? { code: 'EA', date: col.ea } : null;
  var rd = col && col.rd ? 'Regular Decision · ' + col.rd : 'Regular Decision';
  return { label: rd, code: 'RD', early: early };
}

function oddsFor(school, model, round) {
  var m = {};
  for (var k in model) m[k] = model[k];
  m.round = round || 'RD';
  return window.AdmitOdds.odds(school, m);
}

function buildFromProfile() {
  var P;
  try { P = JSON.parse(localStorage.getItem('admitmap_profile') || 'null'); } catch (e) { return null; }
  if (!P || !P.schools || !P.schools.length) return null;
  var model = modelFrom(P);
  if (!model || typeof COLLEGES === 'undefined' || !window.AdmitOdds) return null;

  var income = parseInt(P.income, 10) || 0;
  var scored = [], unscored = [];

  P.schools.forEach(function (sc) {
    var col = COLLEGES[sc.d] || null;
    var cost = costFor(col, sc.n, income);
    if (!col || col.rate == null || !cost || cost.net == null) {
      unscored.push({ n: sc.n, d: sc.d,
        why: (!col || col.rate == null) ? 'admit' : 'cost' });
      return;
    }
    var sat = col.sat != null ? col.sat
            : (col.act != null ? window.AdmitOdds.actToSat(col.act)
                               : window.AdmitOdds.satFromRate(col.rate));
    var school = { rate: col.rate, sat: sat, act: col.act || null,
                   gpa: col.gpa != null ? col.gpa : null,
                   isPublic: col.pub === true, state: col.state || null };
    /* Поправка «свой штат» работает только если ей передать inState.
       Раньше не передавали — абитуриент из другого штата получал
       завышенные шансы в гос. вузах вроде UCLA и Michigan. */
    var m = model;
    if (school.isPublic && school.state && model.homeState) {
      m = Object.assign({}, model, { inState: school.state === model.homeState });
    }
    var r = roundOf(col);
    scored.push({
      n: col.n || sc.n, d: sc.d, admit: col.rate, sat: sat, coa: cost.coa, net: cost.net,
      round: r.label, roundCode: r.early ? r.early.code : 'RD',
      roundDate: r.early ? r.early.date : (col.rd || ''), school: school,
      odds: oddsFor(school, m, 'RD'),
      oddsEarly: r.early ? oddsFor(school, m, r.early.code) : null,
      est: col.sat == null && col.act == null
    });
  });

  if (scored.length < 2) return null;

  return {
    name: (P.name || '').trim() || 'Your report',
    gradYear: P.gradYear || '',
    gpa: model.gpa,
    sat: model.sat != null ? model.sat
       : (model.act != null ? window.AdmitOdds.actToSat(model.act) : null),
    act: model.act,
    activityCount: model.activities.length,
    honorCount: (P.honors || []).filter(function (h) { return (h.title || '').trim(); }).length,
    incomeBand: incomeBand(income),
    budget: parseInt(P.budget, 10) || 0,
    essayWords: (P.essay || '').trim() ? (P.essay.trim().split(/\s+/).length) : 0,
    activityNames: (P.activities || []).filter(function (a) { return (a.desc || '').trim(); })
      .map(function (a) { return (a.type || '').trim() || a.desc.trim().slice(0, 42); }),
    schools: scored, unscored: unscored
  };
}

/* ── отрисовка ────────────────────────────────────────────────────── */
var ICON = {
  money: '<path d="M12 3v18"/><path d="M16.5 7.2c-.7-1.4-2.3-2.2-4.5-2.2-2.6 0-4.2 1.2-4.2 3s1.5 2.6 4.2 3.2c3 .7 4.7 1.6 4.7 3.6 0 2-1.8 3.4-4.7 3.4-2.4 0-4.1-.9-4.8-2.5"/>',
  gift:  '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M3 12h18M12 8v13"/><path d="M12 8S9.5 3.5 7.5 4.5 8 8 12 8s4.5-2.5 4.5-3.5S12 8 12 8z"/>',
  tag:   '<path d="M20.6 13.4 12 22l-9-9V4h9z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  up:    '<path d="M4 15.5 9.5 10l3.5 3.5L20 6.5"/><path d="M20 11V6.5h-4.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>'
};
var ic = function (k) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="#8db2f7" stroke-width="1.9" ' +
         'stroke-linecap="round" stroke-linejoin="round">' + ICON[k] + '</svg>';
};

function renderHead(D, isSample) {
  $('meta').innerHTML =
    '<span class="tag' + (isSample ? ' samp' : '') + '">' +
      (isSample ? 'Sample report' : 'SnapScore report') + '</span>' +
    '<span>' + esc(D.name) + '</span>' +
    (D.gradYear ? '<span>·</span><span>Class of ' + esc(D.gradYear) + '</span>' : '') +
    '<span>·</span><span>' + new Date().toLocaleDateString('en-US',
      { day: 'numeric', month: 'long', year: 'numeric' }) + '</span>';

  var st = [['GPA', D.gpa != null ? D.gpa.toFixed(2) : '—', D.gpa != null ? '/ 4.0' : '']];
  if (D.sat) st.push(['SAT', D.sat, '']);
  else if (D.act) st.push(['ACT', D.act, '']);
  st.push(['Activities', D.activityCount, '']);
  st.push(['Honors', D.honorCount, '']);
  $('stats').innerHTML = st.map(function (r) {
    return '<div class="mst"><span class="mst-l">' + r[0] + '</span>' +
      '<span class="mst-v num">' + r[1] + (r[2] ? '<small> ' + r[2] + '</small>' : '') + '</span></div>';
  }).join('');
}

function renderSlab(D) {
  var rows = D.schools;
  var avgNet = Math.round(rows.reduce(function (a, r) { return a + r.net; }, 0) / rows.length);
  var avgCoa = Math.round(rows.reduce(function (a, r) { return a + r.coa; }, 0) / rows.length);
  var aid4 = Math.round(rows.reduce(function (a, r) { return a + (r.coa - r.net); }, 0) / rows.length) * 4;
  var cheapest = rows.reduce(function (m, r) { return r.net < m.net ? r : m; }, rows[0]);
  var best = rows.reduce(function (m, r) {
    return Math.max(r.oddsEarly || 0, r.odds) > Math.max(m.oddsEarly || 0, m.odds) ? r : m; }, rows[0]);
  var bestPct = Math.max(best.oddsEarly || 0, best.odds);
  var now = new Date(), yy = now.getMonth() > 9 ? now.getFullYear() + 1 : now.getFullYear();
  var days = Math.max(0, Math.ceil((new Date(yy, 10, 1) - now) / 86400000));
  var earlyCount = rows.filter(function (r) { return r.roundCode !== 'RD'; }).length;
  var under = avgCoa ? Math.round((1 - avgNet / avgCoa) * 100) : 0;

  var K = [
    ['money', 'Average net cost / yr', usd(avgNet), '',
      under > 0 ? under + '% under the ' + usd(avgCoa) + ' sticker average' : 'across your list, after aid'],
    ['gift', 'Aid at a typical school', usd(aid4), '', 'Grants across four years, averaged over your list'],
    ['tag', 'Cheapest if admitted', usd(cheapest.net), '/ yr', short(cheapest.n) + ' — your lowest-cost outcome'],
    ['up', 'Your best odds', bestPct, '%', short(best.n) + ' — and ' + usd(best.net) + ' / yr after aid'],
    ['clock', 'Until Nov 1 deadlines', days, 'days',
      earlyCount ? earlyCount + ' of your schools close first' : 'early rounds close first']
  ];
  $('slab').innerHTML = K.map(function (k, i) {
    return '<div class="kpi" style="animation:amFade .5s ease-out ' + (0.14 + i * 0.04) + 's both">' +
      '<span class="kpi-l">' + ic(k[0]) + '<span>' + k[1] + '</span></span>' +
      '<span class="kpi-v">' + k[2] + (k[3] ? '<i>' + k[3] + '</i>' : '') + '</span>' +
      '<span class="kpi-s">' + k[4] + '</span></div>';
  }).join('');
}

function card(r, i) {
  var delta = Math.round(r.odds - r.admit);
  var grants = r.coa - r.net;
  var gPct = Math.max(0, Math.min(100, grants / r.coa * 100));
  return '<div class="card in" style="animation-delay:' + (0.2 + i * 0.04) + 's">' +
    '<div class="c-top">' +
      '<img class="c-logo" src="' + logo(r.d) + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
      '<span class="c-id"><span class="c-name" title="' + esc(r.n) + '">' + esc(r.n) + '</span>' +
        '<span class="c-round">' + esc(r.round) + (r.est ? ' · SAT estimated' : '') + '</span></span>' +
      '<span class="c-pct">' + r.odds + '%</span>' +
    '</div>' +
    '<div><div class="bar">' +
        '<i style="width:' + Math.max(2, Math.min(100, r.odds)) + '%"></i>' +
        '<u style="left:calc(' + Math.min(99, r.admit) + '% - 1px)"></u></div>' +
      '<div class="brow"><span>Your odds</span>' +
        '<span>Class avg ' + r.admit + '% ' +
        '<b class="' + (delta < 0 ? 'dn' : '') + '">' + (delta >= 0 ? '+' : '') + delta + '</b></span></div></div>' +
    '<div><div class="c-money">' +
        '<span class="c-net"><b>' + usd(r.net) + '</b><span>/ yr you pay</span></span>' +
        '<span class="c-4yr">4-yr ' + usd(r.net * 4) + '</span></div>' +
      '<div class="split"><i style="width:' + gPct + '%;background:var(--green)"></i>' +
        '<i style="width:' + (100 - gPct) + '%;background:var(--bar-l)"></i></div>' +
      '<div class="srow"><span class="g">Grants ' + usd(grants) + '</span>' +
        '<span class="s">Sticker ' + usd(r.coa) + '</span></div></div>' +
  '</div>';
}

function renderTiers(D) {
  var rows = D.schools;
  $('sch-count').textContent = rows.length + (rows.length === 1 ? ' school' : ' schools');
  var n = 0;
  var html = TIERS.map(function (t) {
    var list = rows.filter(function (r) { return tierOf(r.odds) === t[0]; })
                   .sort(function (a, b) { return b.odds - a.odds; });
    if (!list.length) return '';
    return '<div class="tier-h"><span class="tier-tag">' + t[1] + '</span>' +
      '<span class="tier-n">' + list.length + (list.length === 1 ? ' school' : ' schools') + '</span>' +
      '<span class="tier-r">' + t[2] + '</span><span class="tier-rule"></span></div>' +
      '<div class="cards">' + list.map(function (r) { return card(r, n++); }).join('') + '</div>';
  }).join('');

  if (D.unscored && D.unscored.length) {
    html += '<div class="tier-h"><span class="tier-tag">Not scored</span>' +
      '<span class="tier-n">' + D.unscored.length +
        (D.unscored.length === 1 ? ' school' : ' schools') + '</span>' +
      '<span class="tier-r">data missing</span><span class="tier-rule"></span></div>' +
      '<div class="cards">' + D.unscored.map(function (u) {
        return '<div class="card"><div class="c-top">' +
          '<img class="c-logo" src="' + logo(u.d) + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
          '<span class="c-id"><span class="c-name">' + esc(u.n) + '</span>' +
          '<span class="c-round">Left out of your odds — ' +
            (u.why === 'admit' ? 'no published admit rate we trust yet'
                               : 'no net-price data for your income yet') + '.</span></span>' +
        '</div></div>';
      }).join('') + '</div>';
  }
  $('tiers').innerHTML = html;
}

function renderEarly(D) {
  var list = D.schools.filter(function (r) { return r.oddsEarly != null && r.oddsEarly > r.odds; })
                      .sort(function (a, b) { return (b.oddsEarly - b.odds) - (a.oddsEarly - a.odds); })
                      .slice(0, 4);
  if (!list.length) { $('sec-early').hidden = true; return; }
  $('sec-early').hidden = false;
  var lift = list.reduce(function (a, r) { return a + (r.oddsEarly - r.odds); }, 0) / list.length;
  var binding = list.some(function (r) { return r.roundCode === 'ED'; });
  $('early-note').innerHTML = '<b>' + list.length + ' of your ' + D.schools.length + ' schools</b><i></i>' +
    '+' + lift.toFixed(1) + ' points average lift' +
    (binding ? ' · Early Decision is binding' : '');

  var max = Math.max.apply(null, list.map(function (r) { return r.oddsEarly; })) || 1;
  $('early').innerHTML = list.map(function (r) {
    var wR = r.odds / max * 100, wE = r.oddsEarly / max * 100;
    return '<div class="er"><div class="er-id">' +
        '<span class="er-n">' + esc(short(r.n)) + '</span>' +
        '<span class="er-r">' + r.roundCode + (r.roundDate ? ' · ' + esc(r.roundDate) : '') + '</span></div>' +
      '<div class="er-scale">' +
        '<span class="er-track"></span>' +
        '<span class="er-fill er-ea" style="width:' + wE + '%"></span>' +
        '<span class="er-fill er-rd" style="width:' + wR + '%"></span>' +
        '<span class="er-tag" style="left:calc(' + wR + '% + 8px);color:var(--muted)">' + r.odds + '% Regular</span>' +
        '<span class="er-tag" style="left:calc(' + wE + '% + 8px);top:20px;color:var(--royal)">' +
          r.oddsEarly + '% Early <span class="er-lift">+' + (r.oddsEarly - r.odds) + '</span></span>' +
      '</div></div>';
  }).join('');
}

/* Оценки активностей и эссе приходят с сервера (api/activities.js, api/essay.js)
   и кэшируются. Пока их нет — панель честно говорит, что оценки ещё не было. */
function cachedScores(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
}
function scorePanel(el, noteEl, data, subLabels, emptyText, emptyCta) {
  if (!data || !data.overall) {
    $(noteEl).textContent = 'Not graded yet';
    $(el).innerHTML = '<div class="empty"><p>' + emptyText + '</p>' +
      (emptyCta ? '<a class="go" href="' + emptyCta[1] + '">' + emptyCta[0] + ' →</a>' : '') + '</div>';
    return;
  }
  $(noteEl).innerHTML = '<b>' + data.overall + ' / 100</b><i></i>' + (data.band || '');
  var subs = subLabels.map(function (s) {
    var v = data.subs && data.subs[s[0]];
    return '<div><div class="sc-sub-l">' + s[1] + '</div>' +
      '<div class="sc-sub-v">' + (v == null ? '—' : v) + '</div>' +
      '<div class="bar"><i style="width:' + (v || 0) + '%"></i></div></div>';
  }).join('');
  var rows = (data.items || []).map(function (it) {
    return '<div class="r"><span class="r-n">' + esc(it.name) + '</span>' +
      '<span class="bar"><i style="width:' + it.score + '%"></i></span>' +
      '<span class="r-v">' + it.score + '<small>/100</small></span></div>';
  }).join('');
  $(el).innerHTML = '<div class="score">' +
    '<div class="sc-top"><div class="sc-big"><span class="sc-big-l">Overall score</span>' +
      '<span class="sc-big-v">' + data.overall + '</span></div>' +
      '<div class="sc-subs">' + subs + '</div></div>' +
    '<div class="rows">' + rows + '</div></div>';
}

function renderScores(D, isSample) {
  scorePanel('acts', 'act-note', cachedScores('admitmap_activity_scores'),
    [['leadership','Leadership'], ['depth','Depth and commitment'], ['impact','Impact']],
    'Your ' + (D.activityCount || 'your') + ' activities have not been scored yet. ' +
    'Activity scoring reads what you actually wrote about each one and rates it against ' +
    'the students admitted to the schools on your list.',
    isSample ? null : ['Score my activities', 'platform.html#activity-scorer']);

  scorePanel('essay', 'essay-note', cachedScores('admitmap_essay_scores'),
    [['craft','Craft'], ['substance','Substance'], ['distinct','Distinctiveness']],
    D.essayWords
      ? 'Your ' + D.essayWords + '-word draft has not been graded yet. The grader scores it on six ' +
        'criteria — voice, reflection, character, specificity, storytelling and writing quality.'
      : 'No essay on file yet. Paste a draft and the grader scores it on six criteria — voice, ' +
        'reflection, character, specificity, storytelling and writing quality.',
    isSample ? null : ['Grade my essay', 'platform.html#essay-grader']);
}

/* ── образец: вымышленная студентка, все школьные цифры настоящие ──── */
var SAMPLE_PROFILE = {
  name: 'Maya S.', gradYear: '2027', state: 'New Jersey', major: 'Biology',
  gpa: '3.94', rank: '6', classSize: '410', sat: '1520', act: '',
  apExams: [{n:'AP Biology',s:'5'},{n:'AP Chemistry',s:'5'},{n:'AP Calculus BC',s:'5'},
            {n:'AP English Literature',s:'4'},{n:'AP US History',s:'4'}],
  activities: [
    {type:'Debate', desc:'Varsity debate captain, led team to state finals', grades:['9','10','11'], hrs:'8', weeks:'32'},
    {type:'Research', desc:'Biochemistry research intern, second author on a poster', grades:['10','11'], hrs:'10', weeks:'20'},
    {type:'Community service', desc:'Founded a free tutoring nonprofit serving 60 students', grades:['10','11'], hrs:'5', weeks:'34'},
    {type:'Music', desc:'Principal cellist, regional youth orchestra', grades:['9','10','11'], hrs:'4', weeks:'30'}
  ],
  honors: [{title:'National Merit Semifinalist', grades:['11'], levels:['National']}],
  schools: [
    {n:'Harvard University', d:'harvard.edu'}, {n:'Stanford University', d:'stanford.edu'},
    {n:'Duke University', d:'duke.edu'}, {n:'Northeastern University', d:'northeastern.edu'},
    {n:'University of California-Los Angeles', d:'ucla.edu'}, {n:'New York University', d:'nyu.edu'},
    {n:'Boston College', d:'bc.edu'}, {n:'University of Michigan-Ann Arbor', d:'umich.edu'},
    {n:'Pennsylvania State University', d:'psu.edu'}, {n:'University of Pittsburgh', d:'pitt.edu'}
  ],
  essayPrompt: 1, essay: '', wantsAid: true, income: '90000', budget: '25000', householdSize: '4'
};

function buildSample() {
  var real = null;
  try { real = localStorage.getItem('admitmap_profile'); } catch (e) {}
  try { localStorage.setItem('admitmap_profile', JSON.stringify(SAMPLE_PROFILE)); } catch (e) {}
  var D = buildFromProfile();
  try {
    if (real) localStorage.setItem('admitmap_profile', real);
    else localStorage.removeItem('admitmap_profile');
  } catch (e) {}
  return D;
}

/* ── старт ────────────────────────────────────────────────────────── */
var forceSample = new URLSearchParams(location.search).get('sample') === '1';
var D = forceSample ? null : buildFromProfile();
var isSample = !D;
if (!D) D = buildSample();

if (!D) {
  document.querySelector('.wrap').innerHTML =
    '<div class="empty" style="margin-top:80px"><p>We could not build a report — the school data ' +
    'failed to load. Reload the page, and if it keeps happening tell us at support@admitmap.app.</p>' +
    '<a class="go" href="funnel.html">Start your profile →</a></div>';
} else {
  renderHead(D, isSample);
  renderSlab(D);
  renderTiers(D);
  renderEarly(D);
  renderScores(D, isSample);
}
})();
