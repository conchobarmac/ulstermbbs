-- Adds a separate "topic" label for each week (e.g. case "Sundip Patel", topic "MI & IHD").
-- Run once: Supabase → SQL Editor → New query → paste → Run. Safe to run more than once.
alter table public.questions add column if not exists topic text not null default '';
