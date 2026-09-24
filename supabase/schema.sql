-- AdmitMap: ученики и их путь по воронке.
-- Вставить целиком в Supabase → SQL Editor → New query → Run. Повторный запуск безопасен.
--
-- students        — одна строка на ученика: последние данные анкеты и докуда он дошёл
-- student_events  — журнал: каждый шаг каждого ученика со временем
-- funnel          — сводка: сколько людей дошло до каждого шага и сколько на нём остановилось
--
-- Пишет сюда только наш сервер (api/student.js) секретным ключом. RLS включён,
-- политик нет — публичный ключ не видит ни одной строки.

create table if not exists public.students (
  id               text primary key,             -- случайный id из браузера ученика
  created_at       timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  stage            text,                         -- что человек сделал последним
  stage_rank       int not null default 0,
  furthest_stage   text,                         -- докуда дошёл дальше всего
  furthest_rank    int not null default 0,
  name             text,
  email            text,
  grad_year        text,
  state            text,
  major            text,
  gpa              text,
  sat              text,
  act              text,
  schools_count    int,
  activities_count int,
  honors_count     int,
  essay_words      int,
  wants_aid        boolean,
  tier             int,
  paid             boolean not null default false,
  device           text,
  profile          jsonb                         -- вся анкета, кроме текста эссе
);

create table if not exists public.student_events (
  id         bigserial primary key,
  student_id text not null references public.students(id) on delete cascade,
  at         timestamptz not null default now(),
  stage      text not null,
  detail     jsonb
);
create index if not exists student_events_student_idx on public.student_events (student_id, at);
create index if not exists students_last_seen_idx on public.students (last_seen_at desc);

alter table public.students       enable row level security;
alter table public.student_events enable row level security;

-- Одна функция на всё: обновить ученика и записать событие.
-- furthest_* только растёт; пустые поля не затирают уже известные.
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
    tier, paid, device, profile)
  values (
    p->>'id', v_stage, v_rank, v_stage, v_rank,
    nullif(p->>'name',''), nullif(lower(p->>'email'),''), nullif(p->>'grad_year',''),
    nullif(p->>'state',''), nullif(p->>'major',''), nullif(p->>'gpa',''),
    nullif(p->>'sat',''), nullif(p->>'act',''),
    (p->>'schools_count')::int, (p->>'activities_count')::int, (p->>'honors_count')::int,
    (p->>'essay_words')::int, (p->>'wants_aid')::boolean,
    (p->>'tier')::int, coalesce((p->>'paid')::boolean, false), nullif(p->>'device',''), p->'profile')
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
    profile          = coalesce(excluded.profile, s.profile);

  insert into student_events (student_id, stage, detail)
  values (p->>'id', coalesce(nullif(p->>'event_label',''), v_stage, 'event'), p->'detail');
end;
$$;

-- Сводка по воронке. reached — дошли до шага или дальше; stopped_here — дальше этого шага не ушли.
create or replace view public.funnel with (security_invoker = true) as
with steps(rank, step) as (values
  (10, '01 Opened the form'),
  (11, '02 Step 1 done: Basics'),
  (12, '03 Step 2 done: Academics'),
  (13, '04 Step 3 done: Activities'),
  (14, '05 Step 4 done: Financial'),
  (15, '06 Step 5 done: Honors'),
  (16, '07 Step 6 done: Schools'),
  (17, '08 Step 7 done: Essay'),
  (20, '09 Finished the form'),
  (30, '10 Saw sign-up'),
  (35, '11 Signed up'),
  (40, '12 Saw prices'),
  (50, '13 Clicked buy'),
  (60, '14 Opened report'),
  (70, '15 Paid'))
select steps.step,
       count(s.id) filter (where s.furthest_rank >= steps.rank) as reached,
       count(s.id) filter (where s.furthest_rank =  steps.rank) as stopped_here
from steps left join public.students s on true
group by steps.rank, steps.step
order by steps.rank;

-- Доступ: только сервер (service_role). Анонимный и публичный ключи не видят ничего.
revoke all on public.students, public.student_events, public.funnel from anon, authenticated;
revoke all on function public.track_student(jsonb) from public, anon, authenticated;
grant all on public.students, public.student_events to service_role;
grant select on public.funnel to service_role;
grant usage, select on sequence public.student_events_id_seq to service_role;
grant execute on function public.track_student(jsonb) to service_role;

-- Обещание из Privacy Policy: профиль удаляется через 12 месяцев после последнего визита.
-- Каждую ночь в 03:00 UTC. Оплаченные тоже — данные о покупке хранит Polar.
create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(jobid) from cron.job where jobname = 'admitmap-delete-stale-students';
select cron.schedule('admitmap-delete-stale-students', '0 3 * * *',
  $$delete from public.students where last_seen_at < now() - interval '12 months'$$);
