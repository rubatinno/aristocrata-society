-- Link do grupo (WhatsApp/comunidade) que o mentorado faz parte — qualquer
-- mentor pode ver isso na Agenda, sem precisar abrir o cadastro completo.
alter table public.approved_mentees add column if not exists group_link text;
