/* AdmitMap — сохранение ученика на сервере (api/student → Supabase).
 *
 * Владельцу нужно видеть каждого, кто начал анкету, и где люди уходят.
 * Поэтому профиль отправляется на каждом шаге: открыл анкету, прошёл шаг,
 * закончил, регистрация, цены, клик «купить», отчёт.
 *
 * Подключается ПОСЛЕ analytics.js (оба defer): оборачивает window.amTrack,
 * так что события, которые страницы уже шлют, сохраняются без правок в них.
 * Текст эссе не отправляется никогда — только число слов (Privacy Policy, раздел 5).
 * На localhost ничего не шлёт: там нет сервера.
 */
(function (w) {
  'use strict';

  var SAVE = { funnel_step_done: 1, funnel_blocked: 1, funnel_complete: 1, paywall_view: 1, checkout_click: 1 };

  function isLocal() {
    return location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(location.hostname);
  }

  function uid() {
    try {
      var v = localStorage.getItem('admitmap_uid');
      if (!v) {
        v = w.crypto && w.crypto.randomUUID ? w.crypto.randomUUID()
          : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
        localStorage.setItem('admitmap_uid', v);
      }
      return v;
    } catch (e) { return null; }
  }

  /* Телефон это или компьютер — по самому устройству, а не по ширине окна:
     узкое окно браузера на ноутбуке записывалось как «mobile».
     iPad в Safari представляется Mac'ом, его выдаёт сенсорный экран. */
  function device() {
    var ua = navigator.userAgent || '';
    if (/Mobi|Android|iPhone|iPod|iPad/i.test(ua)) return 'mobile';
    if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'mobile';
    return 'desktop';
  }

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }

  function save(event, detail) {
    var id = uid();
    if (!id) return;
    var P = read('admitmap_profile'), acct = read('admitmap_account') || {};
    var essayWords = null;
    if (P) {
      var t = String(P.essay || '').trim();
      essayWords = t ? t.split(/\s+/).length : 0;
      P = Object.assign({}, P);
      delete P.essay;
      delete P.seen;
    }
    var body = JSON.stringify({
      id: id, event: event, detail: detail || {}, profile: P, essayWords: essayWords,
      email: acct.email || '', device: device(), ref: refNow() || ''
    });
    if (isLocal()) { if (w.__amDebug) console.log('[student]', event, detail); return; }
    try {
      if (navigator.sendBeacon && navigator.sendBeacon('/api/student', new Blob([body], { type: 'application/json' }))) return;
    } catch (e) {}
    try {
      fetch('/api/student', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true })
        .catch(function () {});
    } catch (e) {}
  }

  /* Программа блогеров: ссылка admitmap.app/?ref=emma. Метку храним 30 дней,
     побеждает последняя ссылка. Она уходит с каждым шагом (api/student) и в
     оплату (paywall → api/checkout), покупка засчитывается блогеру. */
  var REF_DAYS = 30;
  function refNow() {
    var r = read('admitmap_ref');
    return r && r.ref && Date.now() - r.at < REF_DAYS * 864e5 ? r.ref : null;
  }
  w.amRef = refNow;
  var refIn = location.search.match(/[?&]ref=([A-Za-z0-9_-]{2,32})(&|$)/);
  if (refIn) {
    try { localStorage.setItem('admitmap_ref', JSON.stringify({ ref: refIn[1].toLowerCase(), at: Date.now() })); } catch (e) {}
    save('ref_visit');
  }

  var orig = w.amTrack;
  w.amTrack = function (name, props) {
    if (orig) orig(name, props);
    if (SAVE[name]) save(name, props);
  };
  if (orig) { w.amTrack.queue = orig.queue; w.amTrack.configured = orig.configured; }
  w.amSave = save;

  /* Одна покупка — один отчёт (решение владельца 29.09.2026): другой список
     школ или другой человек — новая покупка. При оплате сохраняем отпечаток
     анкеты (SHA-256) в чекауте Polar, а саму анкету — снимком в браузере.
     Отчёт по этой покупке открывается только с анкетой того же отпечатка.
     Почта и служебные поля в отпечаток не входят. */
  var NOT_IN_HASH = { email: 1, seen: 1 };
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') {
      return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; })
        .map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    }
    return JSON.stringify(v === undefined ? null : v);
  }
  w.amProfileHash = function (P) {
    var c = {};
    Object.keys(P || {}).forEach(function (k) { if (!NOT_IN_HASH[k]) c[k] = P[k]; });
    return w.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canon(c))).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  };
  /* Снимки купленных анкет: { отпечаток: анкета }, не больше десяти. */
  w.amPurchaseSnapshots = function () { return read('admitmap_paid_profiles') || {}; };
  w.amRememberPurchase = function (hash, P) {
    var all = w.amPurchaseSnapshots();
    all[hash] = P;
    var keys = Object.keys(all);
    if (keys.length > 10) delete all[keys[0]];
    try { localStorage.setItem('admitmap_paid_profiles', JSON.stringify(all)); } catch (e) {}
  };

  /* Открытие страницы — тоже шаг: без этого не видно тех, кто открыл анкету
     и ушёл, не пройдя и первого шага. */
  var path = location.pathname;
  if (/\/funnel(\.html)?$/.test(path)) save('funnel_open');
  else if (/\/signup(\.html)?$/.test(path)) save('signup_view');
})(window);
