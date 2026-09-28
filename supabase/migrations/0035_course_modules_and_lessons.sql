-- Central de Aulas: módulos com aulas dentro, totalmente personalizáveis
-- pelo admin (título, descrição, capa, vídeo, ordem). Todo mentorado
-- aprovado enxerga tudo — não tem trava por plano, de propósito (pedido
-- explícito do usuário: "todos os mentorados vão ter acesso").
create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_image_url text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_modules_position_idx on public.course_modules (position);

create table if not exists public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules (id) on delete cascade,
  title text not null,
  video_url text,
  duration_label text, -- ex: "18:24", digitado à mão pelo admin — sem depender de metadata do vídeo
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_lessons_module_idx on public.course_lessons (module_id, position);

-- Progresso é por mentorado: aula concluída e favoritada (bookmark), igual
-- ao player mostrado na referência.
create table if not exists public.mentee_lesson_progress (
  mentee_id uuid not null references public.mentee_profiles (id) on delete cascade,
  lesson_id uuid not null references public.course_lessons (id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  bookmarked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (mentee_id, lesson_id)
);

alter table public.course_modules enable row level security;
alter table public.course_lessons enable row level security;
alter table public.mentee_lesson_progress enable row level security;

-- Módulos e aulas: leitura pra qualquer mentorado ou mentor logado; escrita
-- só pra admin (é ele quem monta o conteúdo).
drop policy if exists "Mentorado ou mentor vê módulos" on public.course_modules;
create policy "Mentorado ou mentor vê módulos"
  on public.course_modules for select
  using (
    exists (select 1 from public.mentee_profiles where id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid())
  );

drop policy if exists "Admin cria módulos" on public.course_modules;
create policy "Admin cria módulos"
  on public.course_modules for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "Admin edita módulos" on public.course_modules;
create policy "Admin edita módulos"
  on public.course_modules for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "Admin remove módulos" on public.course_modules;
create policy "Admin remove módulos"
  on public.course_modules for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "Mentorado ou mentor vê aulas" on public.course_lessons;
create policy "Mentorado ou mentor vê aulas"
  on public.course_lessons for select
  using (
    exists (select 1 from public.mentee_profiles where id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid())
  );

drop policy if exists "Admin cria aulas" on public.course_lessons;
create policy "Admin cria aulas"
  on public.course_lessons for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "Admin edita aulas" on public.course_lessons;
create policy "Admin edita aulas"
  on public.course_lessons for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "Admin remove aulas" on public.course_lessons;
create policy "Admin remove aulas"
  on public.course_lessons for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- Progresso: só o próprio mentorado mexe no dele (mentor/admin só
-- acompanha — não faz sentido um mentor "concluir" a aula de outra
-- pessoa).
drop policy if exists "Mentorado vê o próprio progresso" on public.mentee_lesson_progress;
create policy "Mentorado vê o próprio progresso"
  on public.mentee_lesson_progress for select
  using (
    auth.uid() = mentee_id
    or exists (select 1 from public.profiles where id = auth.uid())
  );

drop policy if exists "Mentorado cria o próprio progresso" on public.mentee_lesson_progress;
create policy "Mentorado cria o próprio progresso"
  on public.mentee_lesson_progress for insert
  with check (auth.uid() = mentee_id);

drop policy if exists "Mentorado edita o próprio progresso" on public.mentee_lesson_progress;
create policy "Mentorado edita o próprio progresso"
  on public.mentee_lesson_progress for update
  using (auth.uid() = mentee_id);
