-- Fila de aprovação: mentorados que tentam agendar sem estar aprovados entram
-- aqui como "pending" automaticamente (com o nome/telefone que já digitaram),
-- e o admin aprova/recusa com um clique.
alter table public.approved_mentees
  add column if not exists phone text,
  add column if not exists status text not null default 'approved' check (status in ('pending', 'approved', 'rejected'));

-- Linhas pendentes precisam ser inseridas pela Server Action pública de
-- agendamento (via service role) — a policy de insert já existente
-- (auth.uid() is not null) não cobre isso, mas o insert acontece com a
-- service role, que ignora RLS. Nada a mudar nas policies.
