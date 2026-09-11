-- Até aqui só o admin registrava chamadas do Discord (em Controle, pra
-- fechamento de pagamento). Agora o próprio mentor também registra as
-- dele, na aba Discord do painel — precisa saber se a chamada realmente
-- aconteceu ou não (chamada marcada mas que não rolou não deve contar
-- pra pagamento).
alter table public.mentor_discord_calls
  add column if not exists completed boolean not null default true;

drop policy if exists "Admins veem chamadas do discord" on public.mentor_discord_calls;
drop policy if exists "Admins criam chamadas do discord" on public.mentor_discord_calls;
drop policy if exists "Admins removem chamadas do discord" on public.mentor_discord_calls;

drop policy if exists "Mentor ou admin vê chamadas do discord" on public.mentor_discord_calls;
create policy "Mentor ou admin vê chamadas do discord"
  on public.mentor_discord_calls for select
  using (
    auth.uid() = mentor_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

drop policy if exists "Mentor ou admin cria chamadas do discord" on public.mentor_discord_calls;
create policy "Mentor ou admin cria chamadas do discord"
  on public.mentor_discord_calls for insert
  with check (
    auth.uid() = mentor_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

drop policy if exists "Mentor ou admin edita chamadas do discord" on public.mentor_discord_calls;
create policy "Mentor ou admin edita chamadas do discord"
  on public.mentor_discord_calls for update
  using (
    auth.uid() = mentor_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

drop policy if exists "Mentor ou admin remove chamadas do discord" on public.mentor_discord_calls;
create policy "Mentor ou admin remove chamadas do discord"
  on public.mentor_discord_calls for delete
  using (
    auth.uid() = mentor_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );
