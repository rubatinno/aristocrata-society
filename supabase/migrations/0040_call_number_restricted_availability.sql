-- Permite restringir um horário de disponibilidade a mentorados que estão
-- numa chamada específica da jornada deles (1ª, 2ª, 3ª...). `null` continua
-- significando "aberto pra qualquer mentorado", igual era antes — nenhum
-- horário existente muda de comportamento com essa migration.
alter table public.availability_rules
  add column if not exists required_call_number smallint;

alter table public.availability_dates
  add column if not exists required_call_number smallint;
