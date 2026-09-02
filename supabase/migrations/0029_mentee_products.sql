-- Central de produtos do mentorado: cada linha de mentee_products é uma
-- "pastinha" de produto; mentee_product_creatives guarda os criativos
-- testados dentro dela (link, validado ou não, número de vendas).
-- mentee_id fica duplicado em creatives (em vez de só no produto pai) de
-- propósito — simplifica a policy de RLS (sem precisar de subquery/join) e
-- o filtro do Realtime, no mesmo padrão já usado em mentee_notes/goals.
create table if not exists public.mentee_products (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid not null references public.mentee_profiles (id) on delete cascade,
  name text not null default 'Novo produto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mentee_products_mentee_idx on public.mentee_products (mentee_id, created_at);

alter table public.mentee_products enable row level security;

drop policy if exists "Mentorado ou mentor vê os produtos" on public.mentee_products;
create policy "Mentorado ou mentor vê os produtos"
  on public.mentee_products for select
  using (auth.uid() = mentee_id or exists (select 1 from public.profiles where id = auth.uid()));

drop policy if exists "Mentorado ou mentor cria produtos" on public.mentee_products;
create policy "Mentorado ou mentor cria produtos"
  on public.mentee_products for insert
  with check (auth.uid() = mentee_id or exists (select 1 from public.profiles where id = auth.uid()));

drop policy if exists "Mentorado ou mentor edita produtos" on public.mentee_products;
create policy "Mentorado ou mentor edita produtos"
  on public.mentee_products for update
  using (auth.uid() = mentee_id or exists (select 1 from public.profiles where id = auth.uid()));

drop policy if exists "Mentorado ou mentor remove produtos" on public.mentee_products;
create policy "Mentorado ou mentor remove produtos"
  on public.mentee_products for delete
  using (auth.uid() = mentee_id or exists (select 1 from public.profiles where id = auth.uid()));

create table if not exists public.mentee_product_creatives (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.mentee_products (id) on delete cascade,
  mentee_id uuid not null references public.mentee_profiles (id) on delete cascade,
  title text not null default '',
  link text not null default '',
  validated boolean not null default false,
  sales integer not null default 0 check (sales >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mentee_product_creatives_product_idx
  on public.mentee_product_creatives (product_id, created_at);
create index if not exists mentee_product_creatives_mentee_idx
  on public.mentee_product_creatives (mentee_id);

alter table public.mentee_product_creatives enable row level security;

drop policy if exists "Mentorado ou mentor vê os criativos" on public.mentee_product_creatives;
create policy "Mentorado ou mentor vê os criativos"
  on public.mentee_product_creatives for select
  using (auth.uid() = mentee_id or exists (select 1 from public.profiles where id = auth.uid()));

drop policy if exists "Mentorado ou mentor cria criativos" on public.mentee_product_creatives;
create policy "Mentorado ou mentor cria criativos"
  on public.mentee_product_creatives for insert
  with check (auth.uid() = mentee_id or exists (select 1 from public.profiles where id = auth.uid()));

drop policy if exists "Mentorado ou mentor edita criativos" on public.mentee_product_creatives;
create policy "Mentorado ou mentor edita criativos"
  on public.mentee_product_creatives for update
  using (auth.uid() = mentee_id or exists (select 1 from public.profiles where id = auth.uid()));

drop policy if exists "Mentorado ou mentor remove criativos" on public.mentee_product_creatives;
create policy "Mentorado ou mentor remove criativos"
  on public.mentee_product_creatives for delete
  using (auth.uid() = mentee_id or exists (select 1 from public.profiles where id = auth.uid()));

-- Realtime, pra mentor e mentorado verem as mudanças um do outro na hora.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mentee_products'
  ) then
    alter publication supabase_realtime add table public.mentee_products;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mentee_product_creatives'
  ) then
    alter publication supabase_realtime add table public.mentee_product_creatives;
  end if;
end $$;
