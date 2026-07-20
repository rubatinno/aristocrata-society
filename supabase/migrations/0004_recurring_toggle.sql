-- Interruptor geral do horário recorrente semanal. Datas específicas não têm
-- esse interruptor — ficam sempre ativas quando cadastradas.
-- Mentores novos começam com o recorrente desativado (usam datas específicas
-- até configurarem um padrão semanal e ligarem o interruptor).
alter table public.profiles
  add column if not exists recurring_enabled boolean not null default false;
