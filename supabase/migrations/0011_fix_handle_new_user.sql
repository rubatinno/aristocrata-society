-- Corrige um bug real: a variável `existing record` ficava "não atribuída"
-- quando a busca por e-mail não encontrava nenhuma linha, e acessar
-- `existing.id` nesse estado lança erro em PL/pgSQL — o que travava a
-- criação de mentee_profiles/approved_mentees silenciosamente no cadastro
-- por e-mail/senha (sem afetar o retorno HTTP do signup). Troca por
-- variáveis escalares, que não têm esse problema.
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

  select id, status, role, full_name
    into existing_id, existing_status, existing_role, existing_full_name
  from public.approved_mentees
  where email = new.email;

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
