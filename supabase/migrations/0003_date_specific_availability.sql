-- Disponibilidade por data específica (além do padrão semanal recorrente em
-- `availability_rules`). Útil para abrir um horário avulso num dia fora do
-- padrão, sem alterar a recorrência semanal.
create table if not exists public.availability_dates (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  check (end_time > start_time)
);

create index if not exists availability_dates_mentor_idx on public.availability_dates (mentor_id, date);

alter table public.availability_dates enable row level security;

drop policy if exists "Datas específicas são públicas para leitura" on public.availability_dates;
create policy "Datas específicas são públicas para leitura"
  on public.availability_dates for select
  using (true);

drop policy if exists "Mentor gerencia as próprias datas específicas" on public.availability_dates;
create policy "Mentor gerencia as próprias datas específicas"
  on public.availability_dates for all
  using (auth.uid() = mentor_id)
  with check (auth.uid() = mentor_id);
