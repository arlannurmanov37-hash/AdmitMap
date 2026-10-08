/* AdmitMap — тег Google Ads: какие клики по нашей рекламе заканчиваются покупкой.
 *
 * Что обещано в privacy.html (раздел 9) и что здесь соблюдается:
 *   • тег грузится только у тех, кто пришёл по клику на наше объявление
 *     (в адресе есть gclid/gbraid/wbraid) или уже несёт такую метку в cookie;
 *   • Google получает только метку клика и, при покупке, номер заказа, сумму
 *     и валюту — никаких имён, email, анкет, оценок и эссе;
 *   • restricted data processing включён, персонализация рекламы выключена,
 *     ремаркетинга нет;
 *   • в ЕЭЗ, Великобритании и Швейцарии тег по умолчанию не пишет cookie и не
 *     шлёт рекламные данные: по часовому поясу Европы не грузим его вовсе,
 *     а consent mode по региону — вторая страховка.
 *
 * Аккаунт: AdmitMap MCC 328-642-2192 (кросс-аккаунтные конверсии для 621-573-6123).
 */
(function (w, d) {
  'use strict';

  var ID = 'AW-18501380281';
  var PURCHASE = ID + '/Ms_ZCODQ6JUdELnRkvZE';

  var EEA_UK_CH = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE',
    'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'CH'];

  var loaded = false;

  function inEurope() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return /^(Europe|Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe))/.test(tz);
    } catch (e) { return false; }
  }

  function fromAdClick() { return /[?&](gclid|gbraid|wbraid)=/.test(location.search); }
  function hasAdClickCookie() { return /(?:^|;\s*)_gcl_(aw|gb|ag)=/.test(d.cookie); }

  function load() {
    if (loaded || inEurope()) return false;
    loaded = true;
    w.dataLayer = w.dataLayer || [];
    var gtag = function () { w.dataLayer.push(arguments); };
    gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
      analytics_storage: 'denied', region: EEA_UK_CH });
    gtag('consent', 'default', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied',
      analytics_storage: 'denied' });
    gtag('set', 'restricted_data_processing', true);
    gtag('set', 'allow_ad_personalization_signals', false);
    gtag('js', new Date());
    gtag('config', ID, { restricted_data_processing: true, allow_ad_personalization_signals: false });
    w.amGtag = gtag;
    var s = d.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    d.head.appendChild(s);
    return true;
  }

  /* Покупка: зовёт report-personalize.js после того, как сервер подтвердил чекаут.
     Один раз на заказ: метка в localStorage + transaction_id (Google тоже
     отбрасывает повторы с тем же номером). */
  w.amAdsPurchase = function (orderId, price) {
    if (!orderId || !(fromAdClick() || hasAdClickCookie())) return;
    var key = 'admitmap_gads_' + orderId;
    try { if (localStorage.getItem(key)) return; } catch (e) {}
    if (!load() && !loaded) return;
    w.amGtag('event', 'conversion', {
      send_to: PURCHASE,
      value: Number(price) || 19,
      currency: 'USD',
      transaction_id: String(orderId)
    });
    try { localStorage.setItem(key, '1'); } catch (e) {}
  };

  // Пришёл по клику на объявление — сохраняем метку клика (cookie _gcl_aw).
  if (fromAdClick()) load();
})(window, document);
