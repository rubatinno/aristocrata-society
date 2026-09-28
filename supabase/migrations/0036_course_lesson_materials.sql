-- Materiais de apoio por aula (PDF, etc.) — o admin anexa, todo mentorado
-- que já vê a aula (RLS de course_lessons) também vê os materiais dela.
create table if not exists public.course_lesson_materials (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.course_lessons (id) on delete cascade,
  title text not null,
  file_url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists course_lesson_materials_lesson_idx on public.course_lesson_materials (lesson_id, position);

alter table public.course_lesson_materials enable row level security;

drop policy if exists "Mentorado ou mentor vê materiais" on public.course_lesson_materials;
create policy "Mentorado ou mentor vê materiais"
  on public.course_lesson_materials for select
  using (
    exists (select 1 from public.mentee_profiles where id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid())
  );

drop policy if exists "Admin cria materiais" on public.course_lesson_materials;
create policy "Admin cria materiais"
  on public.course_lesson_materials for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "Admin edita materiais" on public.course_lesson_materials;
create policy "Admin edita materiais"
  on public.course_lesson_materials for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "Admin remove materiais" on public.course_lesson_materials;
create policy "Admin remove materiais"
  on public.course_lesson_materials for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- Bucket de armazenamento dos arquivos (PDF etc.), público pra leitura —
-- upload/remoção só por admin.
insert into storage.buckets (id, name, public)
values ('lesson-materials', 'lesson-materials', true)
on conflict (id) do nothing;

drop policy if exists "Materiais de aula são públicos pra leitura" on storage.objects;
create policy "Materiais de aula são públicos pra leitura"
  on storage.objects for select
  using (bucket_id = 'lesson-materials');

drop policy if exists "Admin envia material de aula" on storage.objects;
create policy "Admin envia material de aula"
  on storage.objects for insert
  with check (bucket_id = 'lesson-materials' and exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "Admin remove material de aula" on storage.objects;
create policy "Admin remove material de aula"
  on storage.objects for delete
  using (bucket_id = 'lesson-materials' and exists (select 1 from public.profiles where id = auth.uid() and is_admin));
