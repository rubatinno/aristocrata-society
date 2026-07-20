-- Links/documentos importantes que qualquer mentor pode anexar a um mentorado
-- (ex: link do contrato, documento de onboarding, pasta de materiais).
create table if not exists public.mentee_links (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid not null references public.approved_mentees (id) on delete cascade,
  title text not null,
  url text not null,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists mentee_links_mentee_idx on public.mentee_links (mentee_id);

alter table public.mentee_links enable row level security;

drop policy if exists "Mentores veem os links" on public.mentee_links;
create policy "Mentores veem os links"
  on public.mentee_links for select
  using (auth.uid() is not null);

drop policy if exists "Mentores adicionam links" on public.mentee_links;
create policy "Mentores adicionam links"
  on public.mentee_links for insert
  with check (auth.uid() is not null);

drop policy if exists "Mentores removem links" on public.mentee_links;
create policy "Mentores removem links"
  on public.mentee_links for delete
  using (auth.uid() is not null);
