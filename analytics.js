/* AdmitMap — единая точка для событий.
 *
 * Зачем отдельный слой, а не сразу тег провайдера: провайдер ещё не выбран,
 * а размечать воронку надо сейчас. Здесь события просто копятся; как только
 * в PROVIDER появится настройка, они уходят наружу — переписывать вызовы
 * в funnel.html, paywall.html и остальных не придётся.
 *
 * Ничего не отправляется, пока провайдер не настроен. Никаких персональных
 * данных: только имя шага и обезличенные счётчики — см. privacy.html.
 */
(function (w) {
  'use strict';

  /* ⚠️ ПЕРЕД ВКЛЮЧЕНИЕМ ОБНОВИТЬ privacy.html.
   *
   * В политике конфиденциальности прямо обещано:
   *   «If we ever add analytics or an advertising pixel to the site, we will
   *    update this section before it goes live, name the provider, and ask
   *    for your consent where the law requires it.»
   *
   * Пока PROVIDER === null, ничего не отправляется и обещание соблюдено.
   * Как только сюда впишут провайдера — сначала правится раздел 9
   * privacy.html (название провайдера, что собирается, где хранится),
   * и только потом деплой. Для посетителей из ЕС и Великобритании
   * потребуется ещё и баннер согласия.
   *
   * Настроить один раз при запуске. Варианты:
       {type:'plausible', domain:'admitmap.app'}
       {type:'ga4',       id:'G-XXXXXXX'}
       {type:'posthog',   key:'phc_...', host:'https://eu.i.posthog.com'}
       null  — ничего не отправляем (текущее состояние) */
  var PROVIDER = null;

  var QUEUE = [];
  var MAX_QUEUE = 50;
  var loaded = false;

  function sessionId() {
    try {
      var k = 'admitmap_sid', v = sessionStorage.getItem(k);
      if (!v) {
        v = (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
        sessionStorage.setItem(k, v);
      }
      return v;
    } catch (e) { return null; }
  }

  function loadProvider() {
    if (loaded || !PROVIDER) return;
    loaded = true;
    var s = document.createElement('script');
    s.defer = true;
    if (PROVIDER.type === 'plausible') {
      s.src = 'https://plausible.io/js/script.js';
      s.setAttribute('data-domain', PROVIDER.domain);
    } else if (PROVIDER.type === 'ga4') {
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + PROVIDER.id;
      s.onload = function () {
        w.dataLayer = w.dataLayer || [];
        w.gtag = function () { w.dataLayer.push(arguments); };
        w.gtag('js', new Date());
        w.gtag('config', PROVIDER.id, { anonymize_ip: true });
        flush();
      };
    } else if (PROVIDER.type === 'posthog') {
      s.src = (PROVIDER.host || 'https://app.posthog.com') + '/static/array.js';
      s.onload = function () {
        if (w.posthog) { w.posthog.init(PROVIDER.key, { api_host: PROVIDER.host }); flush(); }
      };
    }
    document.head.appendChild(s);
  }

  function send(name, props) {
    if (!PROVIDER) return false;
    try {
      if (PROVIDER.type === 'plausible' && w.plausible) { w.plausible(name, { props: props }); return true; }
      if (PROVIDER.type === 'ga4' && w.gtag)            { w.gtag('event', name, props || {}); return true; }
      if (PROVIDER.type === 'posthog' && w.posthog)     { w.posthog.capture(name, props); return true; }
    } catch (e) {}
    return false;
  }

  function flush() {
    for (var i = 0; i < QUEUE.length; i++) send(QUEUE[i].n, QUEUE[i].p);
    QUEUE.length = 0;
  }

  /* Публичный вызов. Безопасен всегда: без провайдера просто копит события,
     чтобы их можно было посмотреть в консоли при отладке. */
  function track(name, props) {
    if (!name) return;
    var p = props || {};
    p.sid = sessionId();
    if (!send(name, p)) {
      if (QUEUE.length < MAX_QUEUE) QUEUE.push({ n: name, p: p });
    }
    if (w.__amDebug) console.log('[analytics]', name, p);
  }

  track.queue = QUEUE;
  track.configured = function () { return !!PROVIDER; };

  w.amTrack = track;
  if (PROVIDER) loadProvider();
})(window);
