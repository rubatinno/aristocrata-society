-- Anotações passam a ser compartilhadas: o próprio mentorado E qualquer
-- mentor (tem linha em profiles) podem ver/criar/editar/remover as
-- anotações de um mentorado. O mentor abre a partir do card do mentorado
-- em Mentorados; o mentorado vê as mesmas na própria aba de Anotações.
drop policy if exists "Mentorado vê as próprias anotações" on public.mentee_notes;
drop policy if exists "Mentorado ou mentor vê as anotações" on public.mentee_notes;
create policy "Mentorado ou mentor vê as anotações"
  on public.mentee_notes for select
  using (
    auth.uid() = mentee_id
    or exists (select 1 from public.profiles where id = auth.uid())
  );

drop policy if exists "Mentorado cria as próprias anotações" on public.mentee_notes;
drop policy if exists "Mentorado ou mentor cria anotações" on public.mentee_notes;
create policy "Mentorado ou mentor cria anotações"
  on public.mentee_notes for insert
  with check (
    auth.uid() = mentee_id
    or exists (select 1 from public.profiles where id = auth.uid())
  );

drop policy if exists "Mentorado edita as próprias anotações" on public.mentee_notes;
drop policy if exists "Mentorado ou mentor edita anotações" on public.mentee_notes;
create policy "Mentorado ou mentor edita anotações"
  on public.mentee_notes for update
  using (
    auth.uid() = mentee_id
    or exists (select 1 from public.profiles where id = auth.uid())
  );

drop policy if exists "Mentorado remove as próprias anotações" on public.mentee_notes;
drop policy if exists "Mentorado ou mentor remove anotações" on public.mentee_notes;
create policy "Mentorado ou mentor remove anotações"
  on public.mentee_notes for delete
  using (
    auth.uid() = mentee_id
    or exists (select 1 from public.profiles where id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Storage: bucket público para imagens coladas dentro das anotações
-- (editor rico, estilo Google Docs).
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', true)
on conflict (id) do nothing;

drop policy if exists "Imagens de anotações são públicas para leitura" on storage.objects;
create policy "Imagens de anotações são públicas para leitura"
  on storage.objects for select
  using (bucket_id = 'note-images');

drop policy if exists "Membro autenticado envia imagem de anotação" on storage.objects;
create policy "Membro autenticado envia imagem de anotação"
  on storage.objects for insert
  with check (bucket_id = 'note-images' and auth.uid() is not null);

drop policy if exists "Membro autenticado remove imagem de anotação" on storage.objects;
create policy "Membro autenticado remove imagem de anotação"
  on storage.objects for delete
  using (bucket_id = 'note-images' and auth.uid() is not null);
