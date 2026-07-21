-- Integração com Google Calendar: cada mentor conecta a própria conta
-- (OAuth) e todo agendamento cria um evento real na agenda dele, com o
-- mentorado como convidado (o Google manda o convite por e-mail sozinho,
-- sem o mentorado precisar conectar nada).

-- Flag pública (não sensível) só pra saber se o mentor já conectou —
-- fica em profiles, que já é lido publicamente em /agendar.
alter table public.profiles
  add column if not exists google_calendar_connected boolean not null default false;

-- Guarda o evento criado no Google pra dar pra atualizar/cancelar depois.
alter table public.bookings add column if not exists google_event_id text;

-- O refresh_token é sensível — fica numa tabela separada, sem NENHUMA
-- policy de leitura/escrita pro cliente normal (só a service role, usada
-- nas Server Actions, consegue acessar; RLS habilitada sem policies
-- bloqueia todo mundo por padrão).
create table if not exists public.mentor_google_tokens (
  mentor_id uuid primary key references public.profiles (id) on delete cascade,
  refresh_token text not null,
  connected_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mentor_google_tokens enable row level security;
