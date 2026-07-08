create or replace function public.prune_old_activity_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.activity_events
  where user_id = new.user_id
    and created_at < now() - interval '30 days';

  return new;
end;
$$;

drop trigger if exists activity_events_prune_old_rows on public.activity_events;

create trigger activity_events_prune_old_rows
after insert on public.activity_events
for each row execute function public.prune_old_activity_events();

delete from public.activity_events
where created_at < now() - interval '30 days';
