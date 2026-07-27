-- Separa a lista de progresso em duas seções: "tarefa" (ação pontual) e
-- "meta" (objetivo maior) — mesma estrutura, só agrupadas na UI.
alter table public.mentee_goals
  add column if not exists kind text not null default 'tarefa';

alter table public.mentee_goals drop constraint if exists mentee_goals_kind_check;
alter table public.mentee_goals
  add constraint mentee_goals_kind_check check (kind in ('tarefa', 'meta'));
