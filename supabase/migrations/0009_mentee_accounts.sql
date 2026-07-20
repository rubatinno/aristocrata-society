-- Contas de mentorado (separadas da conta de mentor). Mentorados fazem login
-- por link mágico igual aos mentores; o que muda é o papel salvo em
-- raw_user_meta_data.role no momento do cadastro (ver LoginForm/MenteeAuth).
create table if not exists public.mentee_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

alter table public.mentee_profiles enable row level security;

drop policy if exists "Mentorado vê o próprio perfil" on public.mentee_profiles;
create policy "Mentorado vê o próprio perfil"
  on public.mentee_profiles for select
  using (auth.uid() = id);

drop policy if exists "Mentores veem perfis de mentorados" on public.mentee_profiles;
create policy "Mentores veem perfis de mentorados"
  on public.mentee_profiles for select
  using (exists (select 1 from public.profiles where id = auth.uid()));

drop policy if exists "Mentorado edita o próprio perfil" on public.mentee_profiles;
create policy "Mentorado edita o próprio perfil"
  on public.mentee_profiles for update
  using (auth.uid() = id);

drop policy if exists "Mentorado cria o próprio perfil" on public.mentee_profiles;
create policy "Mentorado cria o próprio perfil"
  on public.mentee_profiles for insert
  with check (auth.uid() = id);

-- Referência opcional da conta autenticada que fez o agendamento (mantemos
-- também os campos de texto mentee_name/email/phone como registro histórico,
-- já que são copiados do perfil no momento do agendamento).
alter table public.bookings
  add column if not exists mentee_id uuid references public.mentee_profiles (id) on delete set null;

-- Atualiza o gatilho de criação de usuário: cria profiles (mentor) por
-- padrão, ou mentee_profiles quando raw_user_meta_data.role = 'mentee'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'role', 'mentor') = 'mentee' then
    insert into public.mentee_profiles (id, email, full_name, phone)
    values (
      new.id,
      new.email,
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'phone', '')
    )
    on conflict (id) do nothing;
  else
    insert into public.profiles (id, full_name, slug)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'full_name', ''),
      'mentor-' || substr(new.id::text, 1, 8)
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;
