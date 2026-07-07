grant update on public.activity_events to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'activity_events'
      and policyname = 'Users can update own activity events'
  ) then
    create policy "Users can update own activity events"
    on public.activity_events for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end $$;
