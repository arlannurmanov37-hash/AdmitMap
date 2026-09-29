-- AdmitMap — купленные отчёты (29.09.2026).
-- Вставить целиком в Supabase → SQL Editor → Run. Повторный запуск безопасен.
--
-- Строка создаётся при нажатии «купить»: анкета без текста эссе и готовые оценки.
-- После оплаты отчёт открывается из этой строки с любого устройства, а сервер
-- делает PDF и отправляет его на почту покупателя.

create table if not exists public.purchases (
  checkout_id      text primary key,          -- чекаут Polar
  tier             text,                      -- chances ($19) | full ($29)
  profile_hash     text,                      -- отпечаток анкеты: одна покупка — один отчёт
  profile          jsonb not null,            -- анкета БЕЗ текста эссе (только число слов)
  scores           jsonb,                     -- оценки активностей, наград и эссе
  student_id       text,                      -- students.id
  email            text,                      -- почта покупателя из Polar
  paid             boolean not null default false,
  email_claimed_at timestamptz,               -- кто-то начал отправлять письмо
  emailed_at       timestamptz,               -- письмо с отчётом отправлено
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Доступ только у сервера (service_role). Анонимный и публичный ключи не видят ничего.
alter table public.purchases enable row level security;
revoke all on public.purchases from anon, authenticated;
grant all on public.purchases to service_role;

-- Обещание из Privacy Policy: неоплаченные заготовки — через 7 дней,
-- купленные отчёты — через 12 месяцев после последнего открытия.
create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(jobid) from cron.job where jobname = 'admitmap-delete-stale-purchases';
select cron.schedule('admitmap-delete-stale-purchases', '15 3 * * *',
  $$delete from public.purchases
    where (paid = false and created_at < now() - interval '7 days')
       or (updated_at < now() - interval '12 months')$$);
