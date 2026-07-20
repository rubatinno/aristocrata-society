-- Habilita Realtime em mentee_notes: mentor e mentorado enxergam as
-- anotações um do outro atualizando sozinhas, sem precisar recarregar.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mentee_notes'
  ) then
    alter publication supabase_realtime add table public.mentee_notes;
  end if;
end $$;
