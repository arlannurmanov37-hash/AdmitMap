/**
 * POST /api/send-report  { checkout_id }  ->  { ok, sent?, skipped? }
 *
 * Делает PDF купленного отчёта и отправляет его на почту покупателя
 * (решение владельца 29.09.2026: «thank you for your purchase, here is your
 * report»). Вызывают его вебхук Polar (оплата прошла — даже если вкладку
 * закрыли) и страница отчёта после оплаты. Кто бы ни пришёл первым, письмо
 * уходит один раз: строку в purchases «занимает» первый вызов.
 *
 * PDF рисует сервер: открывает /report?checkout_id=…&pdf=1 в Chromium без
 * экрана и печатает его теми же правилами печати, что и кнопка «Download PDF».
 * Текста эссе в отчёте нет — только оценки.
 */
import { bad, cors, verifyPurchase, getPurchase, claimReportEmail, updatePurchase,
         internalKey, safeDetail, recordCreatorSale } from './_lib.js';

const SITE = (process.env.SITE_URL || 'https://www.admitmap.app').replace(/\/$/, '');
const FROM = process.env.REPORT_FROM || process.env.EMAIL_FROM || 'AdmitMap <noreply@admitmap.app>';
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

async function renderPdf(checkoutId) {
  const chromium = (await import('@sparticuz/chromium')).default;
  const puppeteer = (await import('puppeteer-core')).default;
  chromium.setGraphicsMode = false;
  const browser = await puppeteer.launch({
    args: await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
    defaultViewport: { width: 1280, height: 1600, deviceScaleFactor: 1 },
    executablePath: await chromium.executablePath(),
    headless: 'shell'
  });
  try {
    const page = await browser.newPage();
    await page.goto(`${SITE}/report?checkout_id=${encodeURIComponent(checkoutId)}&pdf=1`,
      { waitUntil: 'networkidle0', timeout: 35000 });
    // report.html ставит data-am-done, когда отчёт заполнен
    await page.waitForFunction(() => document.documentElement.getAttribute('data-am-done') === '1',
      { timeout: 25000 });
    const personal = await page.evaluate(() => document.documentElement.getAttribute('data-am-personal') === '1');
    if (!personal) throw new Error('report did not render as personal');
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      if (window.__amPreparePrint) window.__amPreparePrint();
    });
    await page.emulateMediaType('print');
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}

const escHtml = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function mail(to, pdf, checkoutId, name) {
  const link = `${SITE}/report?checkout_id=${encodeURIComponent(checkoutId)}`;
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const hi = first ? `Hi ${escHtml(first)},` : 'Hi,';
  const file = 'AdmitMap Report' + (first ? ' - ' + first.replace(/[^A-Za-z0-9 _-]/g, '') : '') + '.pdf';
  const html = `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f4f8ff;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f1f4b">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #dbe6fb;border-radius:18px;padding:32px 28px">
  <div style="font-family:Georgia,serif;font-size:22px;font-weight:900;letter-spacing:-.02em">Admit<span style="color:#2563eb">Map</span></div>
  <p style="margin:24px 0 0;font-size:15px;line-height:1.6">${hi}</p>
  <p style="margin:10px 0 0;font-size:15px;line-height:1.6">Thank you for your purchase! Your AdmitMap report is attached as a PDF.</p>
  <p style="margin:10px 0 0;font-size:15px;line-height:1.6">You can also open it anytime, on any device:</p>
  <p style="margin:20px 0 0"><a href="${link}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:11px">Open my report</a></p>
  <p style="margin:22px 0 0;font-size:13px;line-height:1.55;color:#5f7292">Keep this link private: anyone who has it can open your report. Questions? Just reply to this email.</p>
</div></body></html>`;
  const text = `${first ? 'Hi ' + first + ',' : 'Hi,'}\n\nThank you for your purchase! Your AdmitMap report is attached as a PDF.\n\n` +
    `You can also open it anytime, on any device:\n${link}\n\nKeep this link private: anyone who has it can open your report. ` +
    `Questions? Just reply to this email.\n\nAdmitMap`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM, to: [to], reply_to: 'support@admitmap.app',
      subject: 'Your AdmitMap report is ready', html, text,
      attachments: [{ filename: file, content: pdf.toString('base64') }]
    })
  });
  if (!r.ok) throw new Error('resend ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

export async function sendReport(checkoutId) {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: 'email not configured' };
  const v = await verifyPurchase(checkoutId);
  if (!v.ok) return { ok: false, error: v.pending ? 'pending' : 'not paid' };
  // покупка по ссылке блогера засчитывается, даже если ученик так и не открыл отчёт
  await recordCreatorSale(checkoutId, v).catch(() => {});
  const row = await claimReportEmail(checkoutId);
  if (!row) {
    const r = await getPurchase(checkoutId);
    return { ok: true, skipped: !r ? 'no purchase row' : r.emailed_at ? 'already sent' : 'in progress' };
  }
  const to = v.email || row.email;
  if (!to) { await updatePurchase(checkoutId, { email_claimed_at: null }); return { ok: false, error: 'no email' }; }
  try {
    const pdf = await renderPdf(checkoutId);
    await mail(to, pdf, checkoutId, row.profile && row.profile.name);
    await updatePurchase(checkoutId, { emailed_at: new Date().toISOString(), email: to, paid: true });
    console.info('report emailed', checkoutId, pdf.length, 'bytes');
    return { ok: true, sent: true };
  } catch (e) {
    // отпускаем строку: следующий вызов (вебхук повторит, отчёт откроют снова) попробует ещё раз
    await updatePurchase(checkoutId, { email_claimed_at: null });
    console.error('send-report failed', checkoutId, safeDetail(e));
    return { ok: false, error: 'send failed: ' + safeDetail(e).slice(0, 160) };
  }
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return bad(res, 405, 'Use POST.');
  // свои функции приходят с внутренним ключом, браузер — только с admitmap.app
  const key = internalKey();
  const inside = key && req.headers['x-admitmap-key'] === key;
  const origin = req.headers.origin || '';
  if (!inside && ALLOWED.length && !ALLOWED.includes(origin)) return bad(res, 403, 'Not allowed.');
  const id = String((req.body && req.body.checkout_id) || '');
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) return bad(res, 400, 'Bad checkout id.');
  const out = await sendReport(id);
  res.status(200).json(out);
}
