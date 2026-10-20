-- O campo "Biblioteca de anúncios" (Meta Ads Library) vira "Drive de
-- criativos": o mentorado passa a colar o link da pasta do Google Drive com
-- os arquivos de criativo, não mais um link de transparência de anúncios.
-- Renomeia a coluna em vez de criar uma nova pra não perder o que já foi
-- preenchido.
alter table public.mentee_products
  rename column ad_library_link to creative_drive_link;
