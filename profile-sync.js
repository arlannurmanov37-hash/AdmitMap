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
      email: acct.email || '', device: (w.innerWidth || 1024) < 768 ? 'mobile' : 'desktop'
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

  var orig = w.amTrack;
  w.amTrack = function (name, props) {
    if (orig) orig(name, props);
    if (SAVE[name]) save(name, props);
  };
  if (orig) { w.amTrack.queue = orig.queue; w.amTrack.configured = orig.configured; }
  w.amSave = save;

  /* Открытие страницы — тоже шаг: без этого не видно тех, кто открыл анкету
     и ушёл, не пройдя и первого шага. */
  var path = location.pathname;
  if (/\/funnel(\.html)?$/.test(path)) save('funnel_open');
  else if (/\/signup(\.html)?$/.test(path)) save('signup_view');
})(window);
