-- A migration 0030 (test_date) nunca chegou a ser aplicada em produção —
-- toda criação/edição de criativo vinha quebrando com "column ... does not
-- exist". Reaplicando aqui (idempotente, seguro rodar de novo se 0030 já
-- tiver sido aplicada em algum ambiente).
alter table public.mentee_product_creatives
  add column if not exists test_date date;

-- Novos campos do produto: link da página de vendas e link da biblioteca de
-- anúncios (Meta Ads Library etc.) — pra mentor e mentorado analisarem
-- juntos os criativos que estão rodando.
alter table public.mentee_products
  add column if not exists sales_page_link text,
  add column if not exists ad_library_link text;
