-- Esquema inicial do sistema de agendamento de mentorias.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`).

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ─────────────────────────────────────────────────────────────────────────
-- profiles: um por mentor, 1:1 com auth.users
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  headline text,
  avatar_url text,
  slug text not null unique,
  timezone text not null default 'America/Sao_Paulo',
  session_duration_minutes int not null default 30,
  buffer_minutes int not null default 10,
  meeting_location text default 'Google Meet',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Perfis são públicos para leitura"
  on public.profiles for select
  using (true);

create policy "Mentor edita o próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Mentor cria o próprio perfil"
  on public.profiles for insert
  with check (auth.uid() = id);

-- cria automaticamente um profile (com slug provisório) quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, slug)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'mentor-' || substr(new.id::text, 1, 8)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- availability_rules: horários recorrentes por dia da semana
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  check (end_time > start_time)
);

create index if not exists availability_rules_mentor_idx on public.availability_rules (mentor_id);

alter table public.availability_rules enable row level security;

create policy "Disponibilidade é pública para leitura"
  on public.availability_rules for select
  using (true);

create policy "Mentor gerencia a própria disponibilidade"
  on public.availability_rules for all
  using (auth.uid() = mentor_id)
  with check (auth.uid() = mentor_id);

-- ─────────────────────────────────────────────────────────────────────────
-- bookings: sessões agendadas por mentorados
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles (id) on delete cascade,
  mentee_name text not null,
  mentee_email text not null,
  notes text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmada' check (status in ('confirmada', 'concluida', 'cancelada')),
  meeting_link text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists bookings_mentor_idx on public.bookings (mentor_id, starts_at);

-- Impede, a nível de banco, dois agendamentos sobrepostos para o mesmo mentor
-- (protege contra condição de corrida quando dois mentorados tentam o mesmo horário).
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    mentor_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
  where (status <> 'cancelada');

alter table public.bookings enable row level security;

-- Mentoras/mentores só enxergam e gerenciam os próprios agendamentos.
-- A criação por parte do mentorado acontece via Server Action com a
-- service_role key (ver src/app/m/[slug]/actions.ts), após validar que o
-- horário segue livre — assim evitamos policy pública de insert (spam/duplo-booking).
create policy "Mentor vê os próprios agendamentos"
  on public.bookings for select
  using (auth.uid() = mentor_id);

create policy "Mentor atualiza os próprios agendamentos"
  on public.bookings for update
  using (auth.uid() = mentor_id);

create policy "Mentor remove os próprios agendamentos"
  on public.bookings for delete
  using (auth.uid() = mentor_id);

-- ─────────────────────────────────────────────────────────────────────────
-- get_busy_ranges: usada pela página pública de agendamento para saber
-- quais horários já estão ocupados, sem expor dados do mentorado.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.get_busy_ranges(p_mentor_id uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
security definer set search_path = public
stable
as $$
  select starts_at, ends_at
  from public.bookings
  where mentor_id = p_mentor_id
    and status <> 'cancelada'
    and starts_at < p_to
    and ends_at > p_from;
$$;

grant execute on function public.get_busy_ranges(uuid, timestamptz, timestamptz) to anon, authenticated;
