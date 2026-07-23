-- `updated_at` is the logical time at which the user changed the content.
-- Previously the server trigger replaced it on every upsert, so a stale device
-- could look newer merely because it uploaded later. Keep a separate receipt
-- timestamp while preserving the client/content timestamp used by sync merge.

alter table public.task_groups
  add column if not exists synced_at timestamptz not null default now();
alter table public.tasks
  add column if not exists synced_at timestamptz not null default now();
alter table public.habits
  add column if not exists synced_at timestamptz not null default now();
alter table public.habit_entries
  add column if not exists synced_at timestamptz not null default now();

create or replace function public.set_synced_at()
returns trigger
language plpgsql
as $$
begin
  new.synced_at = now();
  return new;
end;
$$;

drop trigger if exists task_groups_set_updated_at on public.task_groups;
drop trigger if exists tasks_set_updated_at on public.tasks;
drop trigger if exists habits_set_updated_at on public.habits;
drop trigger if exists habit_entries_set_updated_at on public.habit_entries;

drop trigger if exists task_groups_set_synced_at on public.task_groups;
create trigger task_groups_set_synced_at
before update on public.task_groups
for each row execute function public.set_synced_at();

drop trigger if exists tasks_set_synced_at on public.tasks;
create trigger tasks_set_synced_at
before update on public.tasks
for each row execute function public.set_synced_at();

drop trigger if exists habits_set_synced_at on public.habits;
create trigger habits_set_synced_at
before update on public.habits
for each row execute function public.set_synced_at();

drop trigger if exists habit_entries_set_synced_at on public.habit_entries;
create trigger habit_entries_set_synced_at
before update on public.habit_entries
for each row execute function public.set_synced_at();
