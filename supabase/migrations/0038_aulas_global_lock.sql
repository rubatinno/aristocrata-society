-- Trava global das Aulas: enquanto `aulas_locked` for true, nenhum
-- mentorado consegue ver módulos/aulas, só o aviso de que estão sendo
-- gravadas. Linha única (id fixo = 1), liga/desliga pelo painel de admin.
create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  aulas_locked boolean not null default true,
  aulas_locked_message text not null default 'As Aulas estão sendo Gravadas. Em breve serão disponibilizadas.',
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, aulas_locked)
values (1, true)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

create policy "app_settings_select_authenticated" on public.app_settings
  for select
  to authenticated
  using (true);

create policy "app_settings_update_admin" on public.app_settings
  for update
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
