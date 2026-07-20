-- Habilita Realtime nas tabelas que afetam o que o mentorado vê em /agendar,
-- pra horários novos (ou preenchidos por outro agendamento) aparecerem sem
-- precisar recarregar a página.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'availability_dates'
  ) then
    alter publication supabase_realtime add table public.availability_dates;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end $$;
