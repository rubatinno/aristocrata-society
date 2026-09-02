-- Resumo da trajetória do mentorado — diferente de mentee_notes, que é
-- compartilhado com o próprio mentorado, esse resumo é só pra mentores e
-- admin entenderem o momento dele. O mentorado NUNCA tem acesso (nem select).
-- Um documento só por mentorado (mentee_id é a chave primária).
create table if not exists public.mentee_summaries (
  mentee_id uuid primary key references public.mentee_profiles (id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.mentee_summaries enable row level security;

drop policy if exists "Mentor vê o resumo" on public.mentee_summaries;
create policy "Mentor vê o resumo"
  on public.mentee_summaries for select
  using (exists (select 1 from public.profiles where id = auth.uid()));

drop policy if exists "Mentor cria o resumo" on public.mentee_summaries;
create policy "Mentor cria o resumo"
  on public.mentee_summaries for insert
  with check (exists (select 1 from public.profiles where id = auth.uid()));

drop policy if exists "Mentor edita o resumo" on public.mentee_summaries;
create policy "Mentor edita o resumo"
  on public.mentee_summaries for update
  using (exists (select 1 from public.profiles where id = auth.uid()));

drop policy if exists "Mentor remove o resumo" on public.mentee_summaries;
create policy "Mentor remove o resumo"
  on public.mentee_summaries for delete
  using (exists (select 1 from public.profiles where id = auth.uid()));

-- Realtime, pra mentores em telas diferentes verem a edição um do outro.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mentee_summaries'
  ) then
    alter publication supabase_realtime add table public.mentee_summaries;
  end if;
end $$;
