-- Controle financeiro: quanto pagar por chamada de cada mentor, e o
-- histórico de pagamentos já feitos (cada um "cobre" as chamadas
-- concluídas até uma certa data — o que ficou depois disso ainda é devido).
alter table public.profiles add column if not exists rate_per_call numeric(10, 2);

create table if not exists public.mentor_payments (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  paid_through date not null,
  notes text,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists mentor_payments_mentor_idx on public.mentor_payments (mentor_id, paid_through desc);

alter table public.mentor_payments enable row level security;

drop policy if exists "Admins veem pagamentos" on public.mentor_payments;
create policy "Admins veem pagamentos"
  on public.mentor_payments for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "Admins criam pagamentos" on public.mentor_payments;
create policy "Admins criam pagamentos"
  on public.mentor_payments for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "Admins removem pagamentos" on public.mentor_payments;
create policy "Admins removem pagamentos"
  on public.mentor_payments for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
