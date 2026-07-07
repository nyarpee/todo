create extension if not exists pgcrypto;

create type public.task_priority as enum ('high', 'medium', 'low', 'none');
create type public.habit_unit_type as enum ('minutes', 'times');
create type public.habit_color as enum (
  'blue',
  'cyan',
  'green',
  'lime',
  'yellow',
  'orange',
  'red',
  'pink',
  'purple',
  'slate'
);
create type public.activity_entity_type as enum ('task', 'task_group', 'habit', 'habit_entry');
create type public.activity_event_type as enum (
  'task_created',
  'task_updated',
  'task_completed',
  'task_uncompleted',
  'task_deleted',
  'task_moved',
  'task_scheduled',
  'task_priority_changed',
  'group_created',
  'group_updated',
  'group_deleted',
  'habit_created',
  'habit_updated',
  'habit_deleted',
  'habit_checked',
  'habit_unchecked',
  'habit_reordered'
);
create type public.sync_queue_status as enum ('pending', 'syncing', 'synced', 'failed');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.task_groups (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  client_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table public.tasks (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id text not null,
  parent_id text,
  title text not null,
  description text not null default '',
  sort_order integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  priority public.task_priority not null default 'none',
  due_date date,
  due_time time,
  client_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id),
  foreign key (user_id, group_id) references public.task_groups(user_id, id) on delete cascade,
  foreign key (user_id, parent_id) references public.tasks(user_id, id) on delete cascade
);

create table public.habits (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  unit_type public.habit_unit_type not null default 'minutes',
  unit_minutes integer not null default 15 check (unit_minutes >= 0),
  color public.habit_color not null default 'blue',
  sort_order integer not null default 0,
  client_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table public.habit_entries (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id text not null,
  minutes integer not null check (minutes >= 0),
  checked_at timestamptz not null,
  client_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id),
  foreign key (user_id, habit_id) references public.habits(user_id, id) on delete cascade
);

create table public.activity_events (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.activity_event_type not null,
  entity_type public.activity_entity_type not null,
  entity_id text not null,
  client_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.sync_queue (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_event_id text,
  entity_type public.activity_entity_type not null,
  entity_id text not null,
  operation public.activity_event_type not null,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null,
  status public.sync_queue_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index task_groups_user_id_sort_order_idx on public.task_groups (user_id, sort_order);
create index tasks_user_id_group_id_sort_order_idx on public.tasks (user_id, group_id, sort_order);
create index tasks_user_id_parent_id_sort_order_idx on public.tasks (user_id, parent_id, sort_order);
create index tasks_user_id_due_date_idx on public.tasks (user_id, due_date) where deleted_at is null;
create index habits_user_id_sort_order_idx on public.habits (user_id, sort_order);
create index habit_entries_user_id_habit_id_checked_at_idx on public.habit_entries (user_id, habit_id, checked_at);
create index activity_events_user_id_created_at_idx on public.activity_events (user_id, created_at);
create index sync_queue_user_id_status_created_at_idx on public.sync_queue (user_id, status, created_at);

create trigger task_groups_set_updated_at
before update on public.task_groups
for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger habits_set_updated_at
before update on public.habits
for each row execute function public.set_updated_at();

create trigger habit_entries_set_updated_at
before update on public.habit_entries
for each row execute function public.set_updated_at();

create trigger sync_queue_set_updated_at
before update on public.sync_queue
for each row execute function public.set_updated_at();

alter table public.task_groups enable row level security;
alter table public.tasks enable row level security;
alter table public.habits enable row level security;
alter table public.habit_entries enable row level security;
alter table public.activity_events enable row level security;
alter table public.sync_queue enable row level security;

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.task_groups to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.habits to authenticated;
grant select, insert, update, delete on public.habit_entries to authenticated;
grant select, insert, update on public.activity_events to authenticated;
grant select, insert, update on public.sync_queue to authenticated;

create policy "Users can select own task groups"
on public.task_groups for select
using (auth.uid() = user_id);

create policy "Users can insert own task groups"
on public.task_groups for insert
with check (auth.uid() = user_id);

create policy "Users can update own task groups"
on public.task_groups for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own task groups"
on public.task_groups for delete
using (auth.uid() = user_id);

create policy "Users can select own tasks"
on public.tasks for select
using (auth.uid() = user_id);

create policy "Users can insert own tasks"
on public.tasks for insert
with check (auth.uid() = user_id);

create policy "Users can update own tasks"
on public.tasks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own tasks"
on public.tasks for delete
using (auth.uid() = user_id);

create policy "Users can select own habits"
on public.habits for select
using (auth.uid() = user_id);

create policy "Users can insert own habits"
on public.habits for insert
with check (auth.uid() = user_id);

create policy "Users can update own habits"
on public.habits for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own habits"
on public.habits for delete
using (auth.uid() = user_id);

create policy "Users can select own habit entries"
on public.habit_entries for select
using (auth.uid() = user_id);

create policy "Users can insert own habit entries"
on public.habit_entries for insert
with check (auth.uid() = user_id);

create policy "Users can update own habit entries"
on public.habit_entries for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own habit entries"
on public.habit_entries for delete
using (auth.uid() = user_id);

create policy "Users can select own activity events"
on public.activity_events for select
using (auth.uid() = user_id);

create policy "Users can insert own activity events"
on public.activity_events for insert
with check (auth.uid() = user_id);

create policy "Users can update own activity events"
on public.activity_events for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can select own sync queue"
on public.sync_queue for select
using (auth.uid() = user_id);

create policy "Users can insert own sync queue"
on public.sync_queue for insert
with check (auth.uid() = user_id);

create policy "Users can update own sync queue"
on public.sync_queue for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
