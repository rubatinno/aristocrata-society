-- Permite que um admin ajuste, por mentorado, o total de chamadas e a
-- duração do acesso sem precisar mexer no plano compartilhado (que afetaria
-- todo mundo que usa esse plano). Quando null, vale o valor do plano normal.
alter table public.approved_mentees
  add column if not exists total_calls_override int,
  add column if not exists duration_days_override int;
