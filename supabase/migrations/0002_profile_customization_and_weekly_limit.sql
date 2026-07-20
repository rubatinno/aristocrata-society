-- Perfil do mentor: campo livre para "regras"/instruções mostradas na página de agendamento.
alter table public.profiles add column if not exists booking_instructions text;

-- ─────────────────────────────────────────────────────────────────────────
-- Storage: bucket público de avatares, cada mentor só mexe na própria pasta
-- (caminho esperado: avatars/{user_id}/arquivo.jpg)
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar público para leitura" on storage.objects;
create policy "Avatar público para leitura"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Mentor faz upload do próprio avatar" on storage.objects;
create policy "Mentor faz upload do próprio avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Mentor atualiza o próprio avatar" on storage.objects;
create policy "Mentor atualiza o próprio avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Mentor remove o próprio avatar" on storage.objects;
create policy "Mentor remove o próprio avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────────────────
-- Regra de negócio: no máximo 1 chamada (não cancelada) por mentorado (e-mail)
-- por semana, independente do mentor. Aplicada no banco para não depender só
-- da checagem no código (evita corrida entre dois agendamentos simultâneos).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_one_booking_per_week()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  week_start timestamptz;
  week_end timestamptz;
  existing_count int;
begin
  if new.status = 'cancelada' then
    return new;
  end if;

  week_start := date_trunc('week', new.starts_at);
  week_end := week_start + interval '7 days';

  select count(*) into existing_count
  from public.bookings
  where mentee_email = new.mentee_email
    and status <> 'cancelada'
    and starts_at >= week_start
    and starts_at < week_end
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if existing_count > 0 then
    raise exception 'Só é permitida uma mentoria por semana por mentorado.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_one_booking_per_week_trigger on public.bookings;
create trigger enforce_one_booking_per_week_trigger
  before insert or update on public.bookings
  for each row execute function public.enforce_one_booking_per_week();
