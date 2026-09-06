// AdmitMap — модель шансов на поступление. Единственный источник истины:
// платформа и отчёт считают одним и тем же кодом, чтобы числа не расходились.
//
// Принцип: работаем в ШАНСАХ (odds), а не в процентах. Каждый фактор умножает,
// поэтому один и тот же сигнал сам собой весит по-разному при базе 3% и 88%.
// Спецификация и контрольные профили — ODDS-MODEL.md

(function (root) {
  'use strict';

  var P = {
    gpaUnit: 0.30,      // 0.30 балла GPA = одна единица
    satUnit: 100,       // 100 баллов SAT = одна единица
    wGpa: 0.62, wSat: 0.38,
    acadK: 0.55,        // крутизна академического коэффициента
    profAsymp: 7.0,     // потолок профиля (асимптота затухания)
    profK: 1.45,
    dip: 2.4,           // провал потолка в средней полосе селективности
    dipCenter: 11.0, dipWidth: 0.55,
    actCeil: 1.85, actScale: 2600, breadthW: 0.35,
    structCap: 2.6,
    dampShift: 1.2, dampK: 1.8,
    // Эссе: шкала 0–10, 5 — нейтрально. essayPer — цена одного балла,
    // essayDecay — как быстро падает роль эссе с ростом процента приёма.
    essayPer: 0.10, essayFloor: 0.30, essayDecay: 18,
    essayMin: 0.55, essayMax: 1.50
  };

  // Зажимаем в [0.3, 99.5]: при rate = 100 деление на ноль давало NaN
  // (в базе есть вузы со 100% приёма), при rate = 0 — нулевые шансы навсегда.
  var toOdds = function (p) { var q = Math.min(99.5, Math.max(0.3, p)); return q / (100 - q); };
  var toProb = function (o) { return 100 * o / (1 + o); };

  var ACT_TO_SAT = {36:1590,35:1570,34:1540,33:1520,32:1500,31:1480,30:1460,29:1430,
    28:1410,27:1380,26:1360,25:1330,24:1300,23:1270,22:1240,21:1210,20:1180,19:1150,
    18:1110,17:1070};

  function actToSat(act) { return ACT_TO_SAT[Math.round(act)] || null; }

  // Глубина активностей: главный вклад даёт самая серьёзная, остальные — меньший.
  function activityFactor(acts) {
    if (!acts || !acts.length) return 1;
    var d = acts.map(function (a) {
      return (+a.hours || 0) * (+a.weeks || 0) * (+a.years || 0);
    }).sort(function (a, b) { return b - a; });
    var rest = d.slice(1).reduce(function (s, x) { return s + x; }, 0);
    return Math.min(P.actCeil, 1 + d[0] / P.actScale + P.breadthW * rest / P.actScale);
  }

  /**
   * @param school {rate, gpa, sat, isPublic, state}   — null в любом обязательном поле = не считаем
   * @param st     профиль студента
   * @returns {number|null} процент, либо null если данных не хватает
   */
  function odds(school, st) {
    if (!school || !st) return null;
    var rate = school.rate, sGpa = school.gpa, sSat = school.sat;
    if (rate == null) return null;
    if (sSat == null && school.act != null) sSat = actToSat(school.act);
    if (sSat == null) sSat = satFromRate(rate);         // грубая оценка по селективности
    if (sSat == null) return null;
    if (sGpa == null) sGpa = gpaFromSat(sSat);          // оценка, если нет измеренного
    var gpa = st.gpa;
    if (gpa == null || !(gpa > 0)) return null;          // без GPA студента честного ответа нет

    var sat = st.sat != null ? st.sat : (st.act != null ? actToSat(st.act) : null);
    if (st.submitScores === false) sat = null;           // test-optional: не штрафуем

    // ── Академика ──
    var gpaZ = (gpa - sGpa) / P.gpaUnit;
    var satZ = sat != null ? (sat - sSat) / P.satUnit : 0;
    var wg = sat != null ? P.wGpa : 1, ws = sat != null ? P.wSat : 0;
    var acad = wg * gpaZ + ws * satZ;
    var acadLR = Math.exp(P.acadK * acad);

    // ── Профиль ──
    var prof = 1;
    if (st.apScores && st.apScores.length) {
      var f5 = 0, f4 = 0;
      st.apScores.forEach(function (x) { if (x >= 5) f5++; else if (x === 4) f4++; });
      prof *= Math.min(1.35, 1 + 0.055 * f5 + 0.03 * f4);
    }
    prof *= ({state: 1.10, national: 1.45, international: 1.80})[st.honorLevel] || 1;
    prof *= activityFactor(st.activities);
    if (st.rankPct != null) {
      prof *= st.rankPct <= 1 ? 1.25 : st.rankPct <= 5 ? 1.15 : st.rankPct <= 10 ? 1.08 : 1;
    }
    // Потолок проседает в средней полосе селективности — калибровочная поправка,
    // подлежит проверке на реальных исходах (см. ODDS-MODEL.md).
    var lg = Math.log(rate) - Math.log(P.dipCenter);
    var asymp = P.profAsymp - P.dip * Math.exp(-(lg * lg) / (2 * P.dipWidth * P.dipWidth));
    prof = 1 + asymp * (1 - Math.exp(-(prof - 1) / P.profK));

    // ── Эссе ──
    // Считаем отдельно и ПОСЛЕ насыщения профиля. Внутри профиля эссе тонуло:
    // у сильного абитуриента кривая уже плоская, и оценка 82/100 давала +1 балл.
    // Эссе — независимый сигнал, а не «ещё один кружок».
    //
    // Вес зависит от селективности: в вузе с приёмом 4% эссе читают и оно решает,
    // при приёме 60% его роль невелика.
    var essay = 1;
    if (st.essayScore != null) {
      var w = P.essayFloor + (1 - P.essayFloor) * Math.exp(-rate / P.essayDecay);
      essay = 1 + (st.essayScore - 5) * P.essayPer * w;
      essay = Math.max(P.essayMin, Math.min(P.essayMax, essay));
    }

    // ── Структура подачи ──
    var struct = 1;
    if (school.isPublic && st.inState != null) struct *= st.inState ? 1.50 : 0.70;
    struct *= ({ED: 2.10, EA: 1.25, RD: 1.00})[st.round] || 1;
    struct = Math.min(P.structCap, struct);

    // ── Демпфер: внеучебка не вытаскивает провальную академику ──
    var damp = 1 / (1 + Math.exp(-(acad + P.dampShift) * P.dampK));
    var profEff = 1 + (prof - 1) * damp;

    return Math.round(Math.min(96, Math.max(1,
      toProb(toOdds(rate) * acadLR * profEff * struct * essay))));
  }

  // Средний SAT известен не для всех вузов. Когда его нет, оцениваем по
  // проценту приёма: лог-линейная подгонка по точкам 4 % → 1540 и 80 % → 1180.
  // Это ОЦЕНКА — строка отчёта, построенная на ней, помечается как приблизительная.
  function satFromRate(rate) {
    if (!(rate > 0)) return null;
    var r = Math.min(99, Math.max(1, rate));
    return Math.round(Math.max(1000, Math.min(1560, 1540 - 120.2 * Math.log(r / 4))));
  }

  // colleges.js хранит штат кодом ('CA'), воронка — полным названием
  // ('California'). Без перевода сравнение всегда ложно, и поправка
  // «свой штат» молча не срабатывала.
  var STATE_CODE = {'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA',
    'colorado':'CO','connecticut':'CT','delaware':'DE','district of columbia':'DC','florida':'FL',
    'georgia':'GA','hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA','kansas':'KS',
    'kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD','massachusetts':'MA','michigan':'MI',
    'minnesota':'MN','mississippi':'MS','missouri':'MO','montana':'MT','nebraska':'NE','nevada':'NV',
    'new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC',
    'north dakota':'ND','ohio':'OH','oklahoma':'OK','oregon':'OR','pennsylvania':'PA',
    'rhode island':'RI','south carolina':'SC','south dakota':'SD','tennessee':'TN','texas':'TX',
    'utah':'UT','vermont':'VT','virginia':'VA','washington':'WA','west virginia':'WV',
    'wisconsin':'WI','wyoming':'WY','puerto rico':'PR'};

  function stateCode(v) {
    var x = String(v == null ? '' : v).trim();
    if (!x) return null;
    if (x.length === 2) return x.toUpperCase();
    return STATE_CODE[x.toLowerCase()] || null;   // «Outside the U.S.» → null
  }

  function gpaFromSat(s) {
    return Math.max(3.30, Math.min(3.97, Math.round((3.3 + (s - 1100) / 500 * 0.65) * 100) / 100));
  }

  root.AdmitOdds = {odds: odds, gpaFromSat: gpaFromSat, satFromRate: satFromRate,
                    actToSat: actToSat, stateCode: stateCode, params: P};
})(typeof window !== 'undefined' ? window : globalThis);
