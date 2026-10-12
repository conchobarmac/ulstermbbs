-- Learning objectives: each question can be tagged with the objective numbers it covers,
-- and each week stores its objectives' wording.
-- Run once: Supabase → SQL Editor → New query → paste → Run. Safe to run more than once.
-- If it fails with "lock timeout", close any open app tabs and run it again.

set lock_timeout = '10s';

alter table public.questions add column if not exists lobs integer[] not null default '{}';
create index if not exists questions_lobs_idx on public.questions using gin (lobs);

create table if not exists public.objectives (
  id      bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week    integer not null,
  num     integer not null,
  title   text not null,
  unique (user_id, week, num)
);

alter table public.objectives enable row level security;
drop policy if exists "own objectives" on public.objectives;
create policy "own objectives" on public.objectives
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.objectives to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Weeks imported before this existed were organised one section per objective
-- (e.g. Sundip Patel). For those weeks, use each section as its objective and
-- tag every question with its own section number. Weeks that already have
-- objectives are left alone.
insert into public.objectives (user_id, week, num, title)
select distinct on (q.user_id, q.week, q.section)
       q.user_id, q.week, q.section, regexp_replace(q.section_title, '^\d+\.\s*', '')
from public.questions q
where not exists (select 1 from public.objectives o where o.user_id = q.user_id and o.week = q.week)
  and not exists (select 1 from public.questions t where t.user_id = q.user_id and t.week = q.week and t.lobs <> '{}')
order by q.user_id, q.week, q.section, q.position
on conflict (user_id, week, num) do nothing;

update public.questions q set lobs = array[q.section]
where q.lobs = '{}'
  and not exists (select 1 from public.questions t where t.user_id = q.user_id and t.week = q.week and t.lobs <> '{}');
