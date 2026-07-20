-- ─────────────────────────────────────────────────────────────────────────
-- Planos: definidos pelo admin, com limites de chamadas e duração.
-- Um limite em branco (null) significa "sem limite" naquele critério.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists is_admin boolean not null default false;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  calls_per_week int,
  calls_per_month int,
  total_calls int,
  duration_days int,
  created_at timestamptz not null default now(),
  check (calls_per_week is null or calls_per_week > 0),
  check (calls_per_month is null or calls_per_month > 0),
  check (total_calls is null or total_calls > 0),
  check (duration_days is null or duration_days > 0)
);

alter table public.plans enable row level security;

drop policy if exists "Mentores veem os planos" on public.plans;
create policy "Mentores veem os planos"
  on public.plans for select
  using (auth.uid() is not null);

drop policy if exists "Admins criam planos" on public.plans;
create policy "Admins criam planos"
  on public.plans for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "Admins editam planos" on public.plans;
create policy "Admins editam planos"
  on public.plans for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "Admins removem planos" on public.plans;
create policy "Admins removem planos"
  on public.plans for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- ─────────────────────────────────────────────────────────────────────────
-- Mentorados aprovados a agendar (lista compartilhada entre os mentores),
-- cada um pode estar vinculado a um plano.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.approved_mentees (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  plan_id uuid references public.plans (id) on delete set null,
  starts_at date not null default current_date,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.approved_mentees enable row level security;

drop policy if exists "Mentores veem a lista de aprovados" on public.approved_mentees;
create policy "Mentores veem a lista de aprovados"
  on public.approved_mentees for select
  using (auth.uid() is not null);

drop policy if exists "Mentores adicionam aprovados" on public.approved_mentees;
create policy "Mentores adicionam aprovados"
  on public.approved_mentees for insert
  with check (auth.uid() is not null);

drop policy if exists "Mentores atualizam aprovados" on public.approved_mentees;
create policy "Mentores atualizam aprovados"
  on public.approved_mentees for update
  using (auth.uid() is not null);

drop policy if exists "Mentores removem aprovados" on public.approved_mentees;
create policy "Mentores removem aprovados"
  on public.approved_mentees for delete
  using (auth.uid() is not null);

-- ─────────────────────────────────────────────────────────────────────────
-- A regra fixa "1 chamada por semana" (migration 0002) vira um limite padrão
-- configurável por plano, aplicado na Server Action de agendamento — não faz
-- mais sentido travar no banco com um valor fixo.
-- ─────────────────────────────────────────────────────────────────────────
drop trigger if exists enforce_one_booking_per_week_trigger on public.bookings;
drop function if exists public.enforce_one_booking_per_week();

-- Depois de rodar esta migration, defina você mesmo como admin (troque o e-mail
-- abaixo pelo seu e-mail de login e rode este update separadamente):
-- update public.profiles set is_admin = true
-- where id = (select id from auth.users where email = 'seu@email.com');
