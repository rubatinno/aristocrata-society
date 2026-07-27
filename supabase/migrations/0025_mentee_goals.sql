-- Metas/etapas do progresso de cada mentorado. O mentor define a lista
-- (cria/edita/remove); o próprio mentorado só marca como concluída, igual
-- às anotações compartilhadas (ver migration 0013).
create table if not exists public.mentee_goals (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid not null references public.mentee_profiles (id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  position int not null default 0,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists mentee_goals_mentee_idx on public.mentee_goals (mentee_id, position);

alter table public.mentee_goals enable row level security;

drop policy if exists "Mentorado ou mentor vê as metas" on public.mentee_goals;
create policy "Mentorado ou mentor vê as metas"
  on public.mentee_goals for select
  using (
    auth.uid() = mentee_id
    or exists (select 1 from public.profiles where id = auth.uid())
  );

-- Só mentores criam/removem metas — o mentorado só marca como concluída
-- (permissão de update, abaixo).
drop policy if exists "Mentor cria metas" on public.mentee_goals;
create policy "Mentor cria metas"
  on public.mentee_goals for insert
  with check (exists (select 1 from public.profiles where id = auth.uid()));

drop policy if exists "Mentorado ou mentor atualiza metas" on public.mentee_goals;
create policy "Mentorado ou mentor atualiza metas"
  on public.mentee_goals for update
  using (
    auth.uid() = mentee_id
    or exists (select 1 from public.profiles where id = auth.uid())
  );

drop policy if exists "Mentor remove metas" on public.mentee_goals;
create policy "Mentor remove metas"
  on public.mentee_goals for delete
  using (exists (select 1 from public.profiles where id = auth.uid()));
