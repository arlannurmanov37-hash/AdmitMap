-- AdmitMap — программа блогеров (30.09.2026).
-- Вставить целиком в Supabase → SQL Editor → New query → Run. Повторный запуск безопасен.
--
-- creators         — блогеры: ссылка ?ref=…, секретный ключ кабинета, реквизиты, статус
-- creator_visits   — переходы по ссылке: один посетитель считается один раз в час
-- creator_sales    — покупки по ссылке и комиссия с каждой
-- creator_payouts  — выплаты блогерам
-- creator_videos   — ролики, которые блогер отметил в кабинете
-- students.ref     — по чьей ссылке пришёл ученик (последняя ссылка за 30 дней)
--
-- Пишет и читает только наш сервер (api/creators.js, api/student.js) секретным ключом.

create table if not exists public.creators (
  id             bigserial primary key,
  ref            text not null unique,              -- emma → admitmap.app/?ref=emma
  name           text not null,
  email          text,
  platform       text,
  handle         text,
  dash_key       text not null unique,              -- секрет страницы блогера
  status         text not null default 'active',    -- active | paused
  payout_method  text,                              -- PayPal | Wise
  payout_details text,
  notes          text,
  created_at     timestamptz not null default now()
);

create table if not exists public.creator_visits (
  creator_id bigint not null references public.creators(id) on delete cascade,
  hour       timestamptz not null,                  -- начало часа (UTC)
  visitor    text not null,                         -- id посетителя из браузера
  primary key (creator_id, hour, visitor)
);
create index if not exists creator_visits_hour_idx on public.creator_visits (creator_id, hour);

create table if not exists public.creator_sales (
  checkout_id text primary key,                     -- чекаут Polar
  creator_id  bigint not null references public.creators(id) on delete cascade,
  tier        text not null,                        -- chances ($19) | full ($29)
  price       numeric not null,
  commission  numeric not null,
  sale_number int not null,                         -- какая по счёту продажа блогера
  status      text not null default 'active',       -- active | reversed
  created_at  timestamptz not null default now(),
  payable_at  timestamptz not null                  -- через 14 дней после покупки
);
create index if not exists creator_sales_creator_idx on public.creator_sales (creator_id, created_at);

create table if not exists public.creator_payouts (
  id         bigserial primary key,
  creator_id bigint not null references public.creators(id) on delete cascade,
  amount     numeric not null,
  method     text,
  paid_at    timestamptz not null default now(),
  note       text
);

create table if not exists public.creator_videos (
  id           bigserial primary key,
  creator_id   bigint not null references public.creators(id) on delete cascade,
  url          text not null,
  title        text,
  platform     text,
  published_at timestamptz not null,
  created_at   timestamptz not null default now()
);

alter table public.students add column if not exists ref text;
alter table public.purchases add column if not exists ref text;   -- по чьей ссылке куплен отчёт
create index if not exists students_ref_idx on public.students (ref);

alter table public.creators        enable row level security;
alter table public.creator_visits  enable row level security;
alter table public.creator_sales   enable row level security;
alter table public.creator_payouts enable row level security;
alter table public.creator_videos  enable row level security;

-- Метка блогера у ученика: последняя ссылка побеждает, пустая не затирает.
create or replace function public.track_student(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rank  int  := coalesce((p->>'rank')::int, 0);
  v_stage text := nullif(p->>'stage', '');
begin
  insert into students as s (
    id, stage, stage_rank, furthest_stage, furthest_rank,
    name, email, grad_year, state, major, gpa, sat, act,
    schools_count, activities_count, honors_count, essay_words, wants_aid,
    tier, paid, device, profile, ref)
  values (
    p->>'id', v_stage, v_rank, v_stage, v_rank,
    nullif(p->>'name',''), nullif(lower(p->>'email'),''), nullif(p->>'grad_year',''),
    nullif(p->>'state',''), nullif(p->>'major',''), nullif(p->>'gpa',''),
    nullif(p->>'sat',''), nullif(p->>'act',''),
    (p->>'schools_count')::int, (p->>'activities_count')::int, (p->>'honors_count')::int,
    (p->>'essay_words')::int, (p->>'wants_aid')::boolean,
    (p->>'tier')::int, coalesce((p->>'paid')::boolean, false), nullif(p->>'device',''), p->'profile',
    nullif(lower(p->>'ref'),''))
  on conflict (id) do update set
    last_seen_at     = now(),
    stage            = coalesce(excluded.stage, s.stage),
    stage_rank       = case when excluded.stage is null then s.stage_rank else excluded.stage_rank end,
    furthest_stage   = case when excluded.furthest_rank > s.furthest_rank then excluded.furthest_stage else s.furthest_stage end,
    furthest_rank    = greatest(s.furthest_rank, excluded.furthest_rank),
    name             = coalesce(excluded.name, s.name),
    email            = coalesce(excluded.email, s.email),
    grad_year        = coalesce(excluded.grad_year, s.grad_year),
    state            = coalesce(excluded.state, s.state),
    major            = coalesce(excluded.major, s.major),
    gpa              = coalesce(excluded.gpa, s.gpa),
    sat              = coalesce(excluded.sat, s.sat),
    act              = coalesce(excluded.act, s.act),
    schools_count    = coalesce(excluded.schools_count, s.schools_count),
    activities_count = coalesce(excluded.activities_count, s.activities_count),
    honors_count     = coalesce(excluded.honors_count, s.honors_count),
    essay_words      = coalesce(excluded.essay_words, s.essay_words),
    wants_aid        = coalesce(excluded.wants_aid, s.wants_aid),
    tier             = coalesce(excluded.tier, s.tier),
    paid             = s.paid or excluded.paid,
    device           = coalesce(excluded.device, s.device),
    profile          = coalesce(excluded.profile, s.profile),
    ref              = coalesce(excluded.ref, s.ref);

  -- переход по ссылке блогера — только отметка, в журнал шагов не пишем
  if coalesce(p->>'event_label','') <> 'Creator link visit' then
    insert into student_events (student_id, stage, detail)
    values (p->>'id', coalesce(nullif(p->>'event_label',''), v_stage, 'event'), p->'detail');
  end if;
end;
$$;

-- Переход по ссылке: посетитель засчитывается блогеру один раз в час.
create or replace function public.track_creator_visit(p_ref text, p_visitor text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint;
begin
  select id into v_id from creators where ref = lower(p_ref) and status = 'active';
  if v_id is null then return false; end if;
  insert into creator_visits (creator_id, hour, visitor)
  values (v_id, date_trunc('hour', now()), p_visitor)
  on conflict do nothing;
  return true;
end;
$$;

-- Уровни комиссии по числу продаж за всё время (решение владельца 29.09.2026):
-- 1–99: $6.50/$11.50 · со 100-й: $7/$12 · с 250-й: $7.50/$12.50 · с 500-й: $8/$13.
create or replace function public.creator_rate(p_sale_number int, p_tier text)
returns numeric language sql immutable as $$
  select case
    when p_sale_number >= 500 then case when p_tier = 'full' then 13.00 else 8.00 end
    when p_sale_number >= 250 then case when p_tier = 'full' then 12.50 else 7.50 end
    when p_sale_number >= 100 then case when p_tier = 'full' then 12.00 else 7.00 end
    else case when p_tier = 'full' then 11.50 else 6.50 end
  end
$$;

-- Продажа по ссылке: одна запись на чекаут, номер продажи и ставка — по уровню.
-- Возвращает запись, если она новая (тогда сервер пишет блогеру письмо).
create or replace function public.record_creator_sale(p_checkout text, p_ref text, p_tier text, p_price numeric, p_buyer_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c creators%rowtype;
  n int;
  v_sale creator_sales%rowtype;
begin
  select * into c from creators where ref = lower(p_ref);
  if c.id is null or c.status <> 'active' then return null; end if;
  -- покупка блогером по своей же ссылке не засчитывается
  if c.email is not null and p_buyer_email is not null and lower(c.email) = lower(p_buyer_email) then return null; end if;
  if exists (select 1 from creator_sales where checkout_id = p_checkout) then return null; end if;
  perform pg_advisory_xact_lock(c.id);
  select count(*) into n from creator_sales where creator_id = c.id and status = 'active';
  insert into creator_sales (checkout_id, creator_id, tier, price, commission, sale_number, payable_at)
  values (p_checkout, c.id, p_tier, p_price, creator_rate(n + 1, p_tier), n + 1, now() + interval '14 days')
  on conflict do nothing
  returning * into v_sale;
  if v_sale.checkout_id is null then return null; end if;
  return jsonb_build_object('creator_id', c.id, 'name', c.name, 'email', c.email, 'ref', c.ref,
    'dash_key', c.dash_key, 'commission', v_sale.commission, 'sale_number', v_sale.sale_number, 'tier', v_sale.tier);
end;
$$;

-- Цифры блогера за период: посетители, покупки, заработок, воронка.
create or replace function public.creator_stats(p_creator bigint, p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'visitors',   (select count(distinct visitor) from creator_visits where creator_id = p_creator and hour >= p_from and hour < p_to),
    'purchases',  (select count(*) from creator_sales where creator_id = p_creator and status = 'active' and created_at >= p_from and created_at < p_to),
    'p19',        (select count(*) from creator_sales where creator_id = p_creator and status = 'active' and tier = 'chances' and created_at >= p_from and created_at < p_to),
    'p29',        (select count(*) from creator_sales where creator_id = p_creator and status = 'active' and tier = 'full' and created_at >= p_from and created_at < p_to),
    'earned',     (select coalesce(sum(commission),0) from creator_sales where creator_id = p_creator and status = 'active' and created_at >= p_from and created_at < p_to),
    'revenue',    (select coalesce(sum(price),0) from creator_sales where creator_id = p_creator and status = 'active' and created_at >= p_from and created_at < p_to),
    'finished',   (select count(*) from students where ref = (select ref from creators where id = p_creator) and furthest_rank >= 20 and created_at >= p_from and created_at < p_to),
    'saw_prices', (select count(*) from students where ref = (select ref from creators where id = p_creator) and furthest_rank >= 40 and created_at >= p_from and created_at < p_to)
  )
$$;

-- Деньги блогера за всё время: заработано, ждёт 14 дней, к выплате, выплачено.
create or replace function public.creator_money(p_creator bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with s as (select * from creator_sales where creator_id = p_creator and status = 'active'),
       paid as (select coalesce(sum(amount),0) v from creator_payouts where creator_id = p_creator)
  select jsonb_build_object(
    'lifetime_sales', (select count(*) from s),
    'earned',  (select coalesce(sum(commission),0) from s),
    'pending', (select coalesce(sum(commission),0) from s where payable_at > now()),
    'paid',    (select v from paid),
    'ready',   greatest((select coalesce(sum(commission),0) from s where payable_at <= now()) - (select v from paid), 0)
  )
$$;

-- График: посетители и покупки по дням или по часам — в часовом поясе зрителя
-- страницы (p_tz, например America/New_York). p_creator = null — все блогеры.
create or replace function public.creator_series(p_creator bigint, p_from timestamptz, p_to timestamptz, p_unit text, p_tz text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select generate_series(date_trunc(p_unit, p_from, p_tz), p_to - interval '1 second',
           case when p_unit = 'hour' then interval '1 hour' else interval '1 day' end) t
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    't', b.t,
    'v', (select count(distinct visitor) from creator_visits v
          where (p_creator is null or v.creator_id = p_creator) and date_trunc(p_unit, v.hour, p_tz) = b.t),
    'p', (select count(*) from creator_sales s
          where (p_creator is null or s.creator_id = p_creator) and s.status = 'active'
            and date_trunc(p_unit, s.created_at, p_tz) = b.t)
  ) order by b.t), '[]'::jsonb) from b
$$;

-- Ролики блогера: переходы и покупки за 48 часов после публикации.
create or replace function public.creator_video_stats(p_creator bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', v.id, 'url', v.url, 'title', v.title, 'platform', v.platform, 'published_at', v.published_at,
    'visitors', (select count(distinct visitor) from creator_visits cv where cv.creator_id = p_creator
                 and cv.hour >= date_trunc('hour', v.published_at) and cv.hour < v.published_at + interval '48 hours'),
    'purchases', (select count(*) from creator_sales cs where cs.creator_id = p_creator and cs.status = 'active'
                 and cs.created_at >= v.published_at and cs.created_at < v.published_at + interval '48 hours')
  ) order by v.published_at desc), '[]'::jsonb)
  from creator_videos v where v.creator_id = p_creator
$$;

-- Доступ: только сервер (service_role).
revoke all on public.creators, public.creator_visits, public.creator_sales, public.creator_payouts, public.creator_videos
  from anon, authenticated;
grant all on public.creators, public.creator_visits, public.creator_sales, public.creator_payouts, public.creator_videos
  to service_role;
grant usage, select on sequence public.creators_id_seq, public.creator_payouts_id_seq, public.creator_videos_id_seq to service_role;
revoke all on function public.track_creator_visit(text, text), public.record_creator_sale(text, text, text, numeric, text),
  public.creator_stats(bigint, timestamptz, timestamptz), public.creator_money(bigint),
  public.creator_series(bigint, timestamptz, timestamptz, text, text), public.creator_video_stats(bigint)
  from public, anon, authenticated;
grant execute on function public.track_creator_visit(text, text), public.record_creator_sale(text, text, text, numeric, text),
  public.creator_stats(bigint, timestamptz, timestamptz), public.creator_money(bigint),
  public.creator_series(bigint, timestamptz, timestamptz, text, text), public.creator_video_stats(bigint), public.creator_rate(int, text)
  to service_role;

-- Admin: все блогеры с цифрами за период и деньгами за всё время — одним запросом.
create or replace function public.admin_creators(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'ref', c.ref, 'name', c.name, 'email', c.email, 'platform', c.platform, 'handle', c.handle,
    'status', c.status, 'payout_method', c.payout_method, 'payout_details', c.payout_details, 'notes', c.notes,
    'dash_key', c.dash_key, 'created_at', c.created_at,
    'stats', creator_stats(c.id, p_from, p_to),
    'money', creator_money(c.id)
  ) order by c.created_at), '[]'::jsonb)
  from creators c
$$;
revoke all on function public.admin_creators(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_creators(timestamptz, timestamptz) to service_role;

-- Посещения старше 13 месяцев не нужны ни для графиков, ни для выплат.
select cron.unschedule(jobid) from cron.job where jobname = 'admitmap-delete-old-creator-visits';
select cron.schedule('admitmap-delete-old-creator-visits', '30 3 * * *',
  $$delete from public.creator_visits where hour < now() - interval '13 months'$$);
