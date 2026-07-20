-- Unifica o acesso: TODA pessoa que se cadastra (mentorado ou mentor) entra
-- pendente em approved_mentees. Um admin aprova e escolhe o papel — só aí
-- ela ganha acesso (de fato agendar, ou de fato entrar no painel).
alter table public.approved_mentees
  add column if not exists role text check (role in ('mentee', 'mentor', 'admin'));

alter table public.approved_mentees
  add column if not exists user_id uuid references auth.users (id) on delete set null;

comment on table public.approved_mentees is
  'Fila de acesso: qualquer pessoa que se cadastra (mentorado ou mentor) entra pendente aqui até um admin aprovar e decidir o papel.';

-- Permite que um admin edite o profile de outro mentor (ex: promover/rebaixar admin).
drop policy if exists "Admins atualizam perfis de mentor" on public.profiles;
create policy "Admins atualizam perfis de mentor"
  on public.profiles for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  mentor_count int;
  existing record;
begin
  select count(*) into mentor_count from public.profiles;

  -- primeiro usuário do sistema: vira admin direto, sem fila de aprovação
  -- (senão ninguém conseguiria aprovar ninguém).
  if mentor_count = 0 then
    insert into public.profiles (id, full_name, slug, is_admin)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'full_name', ''),
      'mentor-' || substr(new.id::text, 1, 8),
      true
    )
    on conflict (id) do nothing;
    return new;
  end if;

  if coalesce(new.raw_user_meta_data ->> 'role', 'mentee') = 'mentee' then
    insert into public.mentee_profiles (id, email, full_name, phone)
    values (
      new.id,
      new.email,
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'phone', '')
    )
    on conflict (id) do nothing;
  end if;

  select * into existing from public.approved_mentees where email = new.email;

  if existing.id is not null then
    update public.approved_mentees set user_id = new.id where id = existing.id;

    -- e-mail já tinha sido pré-aprovado por um admin como mentor/admin antes
    -- mesmo da pessoa se cadastrar: cria o acesso ao painel na hora.
    if existing.status = 'approved' and existing.role in ('mentor', 'admin') then
      insert into public.profiles (id, full_name, slug, is_admin)
      values (
        new.id,
        coalesce(existing.full_name, new.raw_user_meta_data ->> 'full_name', ''),
        'mentor-' || substr(new.id::text, 1, 8),
        existing.role = 'admin'
      )
      on conflict (id) do nothing;
    end if;
  else
    insert into public.approved_mentees (email, full_name, phone, status, user_id)
    values (
      new.email,
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'phone', ''),
      'pending',
      new.id
    );
  end if;

  return new;
end;
$$;
