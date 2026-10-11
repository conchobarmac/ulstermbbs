-- Recall study app: database setup.
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run: it only creates what is missing and replaces the function.

-- ---------------------------------------------------------------------------
-- Questions: one row per question, plus its current study state.
-- ---------------------------------------------------------------------------
create table if not exists public.questions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,

  -- content (from the weekly CSV)
  week           integer not null,
  case_title     text    not null default '',   -- the PBL case, e.g. "Sundip Patel"
  topic          text    not null default '',   -- your own label, e.g. "MI & IHD"
  section        integer not null,
  section_title  text    not null default '',
  group_title    text    not null default '',
  qid            text    not null,              -- e.g. "4.12"; unique within a week
  kind           text    not null default 'recall' check (kind in ('recall', 'application')),
  question       text    not null,
  answer         text    not null,
  position       integer not null default 0,    -- order within the week (row order in the CSV)

  -- study state (updated by record_grade)
  learned_at     timestamptz,                   -- first time it was graded (learn mode)
  last_grade     smallint check (last_grade between 0 and 3),
  last_seen_at   timestamptz,
  interval_days  integer not null default 0,
  due_at         timestamptz,                   -- next review; null until learned
  times_seen     integer not null default 0,
  flagged        boolean not null default false,
  note           text    not null default '',

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (user_id, week, qid)
);

-- Added after the first version; harmless if the column already exists.
alter table public.questions add column if not exists topic text not null default '';

create index if not exists questions_user_week_idx on public.questions (user_id, week, section, position);
create index if not exists questions_user_due_idx  on public.questions (user_id, due_at) where learned_at is not null;

-- ---------------------------------------------------------------------------
-- Grades: every grade you have ever given, for history and export.
-- ---------------------------------------------------------------------------
create table if not exists public.grades (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question_id  uuid not null references public.questions (id) on delete cascade,
  grade        smallint not null check (grade between 0 and 3),
  mode         text not null check (mode in ('learn', 'review')),
  created_at   timestamptz not null default now()
);

create index if not exists grades_user_question_idx on public.grades (user_id, question_id, created_at);

-- ---------------------------------------------------------------------------
-- Row level security: each user can only see and change their own rows.
-- ---------------------------------------------------------------------------
alter table public.questions enable row level security;
alter table public.grades    enable row level security;

drop policy if exists "own questions" on public.questions;
create policy "own questions" on public.questions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "own grades" on public.grades;
create policy "own grades" on public.grades
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- keep updated_at current
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists questions_touch on public.questions;
create trigger questions_touch before update on public.questions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- record_grade: logs a grade and updates the question's schedule in one step.
-- The app works out the interval (see src/lib/schedule.ts) and passes it in.
-- ---------------------------------------------------------------------------
create or replace function public.record_grade(
  p_question uuid,
  p_grade    integer,
  p_mode     text,
  p_interval integer,
  p_due      timestamptz
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_grade < 0 or p_grade > 3 then
    raise exception 'grade must be between 0 and 3';
  end if;

  update public.questions set
    learned_at    = coalesce(learned_at, now()),
    last_grade    = p_grade,
    last_seen_at  = now(),
    interval_days = p_interval,
    due_at        = p_due,
    times_seen    = times_seen + 1
  where id = p_question;

  if not found then
    raise exception 'question not found';
  end if;

  insert into public.grades (question_id, grade, mode)
  values (p_question, p_grade, p_mode);
end $$;

grant execute on function public.record_grade(uuid, integer, text, integer, timestamptz) to authenticated;

-- Table access for signed-in users (Supabase usually grants this automatically; this makes sure).
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.questions, public.grades to authenticated;
grant usage, select on all sequences in schema public to authenticated;
