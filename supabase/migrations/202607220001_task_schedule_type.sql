alter table public.tasks
add column if not exists schedule_type text not null default 'deadline'
check (schedule_type in ('scheduled', 'deadline'));
