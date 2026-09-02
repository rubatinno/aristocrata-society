-- Data em que o criativo foi/será testado — usada pro filtro por período
-- na aba Produtos.
alter table public.mentee_product_creatives
  add column if not exists test_date date;
