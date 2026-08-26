-- Corrige um bug real: se um mentorado já aprovado (approved_mentees com
-- role='mentee') se cadastra pela aba errada (role='mentor' no formulário),
-- o gatilho não criava mentee_profiles (só entra nesse insert quando o
-- metadata da conta diz role='mentee') nem profiles (só entra quando
-- existing_role é 'mentor'/'admin') — a conta ficava "fantasma", sem
-- nenhum perfil, quebrando tudo que referencia mentee_id (anotações, metas
-- etc). A aba escolhida no formulário de cadastro não é confiável; o papel
-- real é o que está em approved_mentees.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  mentor_count int;
  existing_id uuid;
  existing_status text;
  existing_role text;
  existing_full_name text;
begin
  select count(*) into mentor_count from public.profiles;

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

  select id, status, role, full_name
    into existing_id, existing_status, existing_role, existing_full_name
  from public.approved_mentees
  where email = new.email;

  -- Fonte da verdade pra decidir mentee_profiles vs profiles é
  -- approved_mentees.role quando existe; só cai pro metadata do formulário
  -- quando é cadastro novo, sem aprovação prévia.
  if (existing_id is not null and existing_role = 'mentee')
     or (existing_id is null and coalesce(new.raw_user_meta_data ->> 'role', 'mentee') = 'mentee') then
    insert into public.mentee_profiles (id, email, full_name, phone)
    values (
      new.id,
      new.email,
      coalesce(nullif(existing_full_name, ''), nullif(new.raw_user_meta_data ->> 'full_name', '')),
      nullif(new.raw_user_meta_data ->> 'phone', '')
    )
    on conflict (id) do nothing;
  end if;

  if existing_id is not null then
    update public.approved_mentees set user_id = new.id where id = existing_id;

    if existing_status = 'approved' and existing_role in ('mentor', 'admin') then
      insert into public.profiles (id, full_name, slug, is_admin)
      values (
        new.id,
        coalesce(existing_full_name, new.raw_user_meta_data ->> 'full_name', ''),
        'mentor-' || substr(new.id::text, 1, 8),
        existing_role = 'admin'
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
