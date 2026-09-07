-- Chamadas em grupo no Discord que um mentor faz (ex: 2x por semana),
-- fora do sistema normal de agendamento 1:1. Pagas no mesmo valor por
-- chamada que as individuais, então precisam contar junto no Controle.
create table if not exists public.mentor_discord_calls (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles (id) on delete cascade,
  call_date date not null,
  notes text,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists mentor_discord_calls_mentor_idx
  on public.mentor_discord_calls (mentor_id, call_date desc);

alter table public.mentor_discord_calls enable row level security;

drop policy if exists "Admins veem chamadas do discord" on public.mentor_discord_calls;
create policy "Admins veem chamadas do discord"
  on public.mentor_discord_calls for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "Admins criam chamadas do discord" on public.mentor_discord_calls;
create policy "Admins criam chamadas do discord"
  on public.mentor_discord_calls for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "Admins removem chamadas do discord" on public.mentor_discord_calls;
create policy "Admins removem chamadas do discord"
  on public.mentor_discord_calls for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
