-- Anotações pessoais do mentorado (estilo "documentos separados"), só ele
-- enxerga e edita — cada linha é um documento independente.
create table if not exists public.mentee_notes (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid not null references public.mentee_profiles (id) on delete cascade,
  title text not null default 'Sem título',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mentee_notes_mentee_idx on public.mentee_notes (mentee_id, updated_at desc);

alter table public.mentee_notes enable row level security;

drop policy if exists "Mentorado vê as próprias anotações" on public.mentee_notes;
create policy "Mentorado vê as próprias anotações"
  on public.mentee_notes for select
  using (auth.uid() = mentee_id);

drop policy if exists "Mentorado cria as próprias anotações" on public.mentee_notes;
create policy "Mentorado cria as próprias anotações"
  on public.mentee_notes for insert
  with check (auth.uid() = mentee_id);

drop policy if exists "Mentorado edita as próprias anotações" on public.mentee_notes;
create policy "Mentorado edita as próprias anotações"
  on public.mentee_notes for update
  using (auth.uid() = mentee_id);

drop policy if exists "Mentorado remove as próprias anotações" on public.mentee_notes;
create policy "Mentorado remove as próprias anotações"
  on public.mentee_notes for delete
  using (auth.uid() = mentee_id);
