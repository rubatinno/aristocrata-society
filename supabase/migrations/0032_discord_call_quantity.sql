-- Permite registrar mais de uma chamada do Discord de uma vez (ex: mês que
-- não foi marcado dia a dia — lança "8 chamadas" numa linha só em vez de
-- criar 8 linhas idênticas). Continua valendo 1 por padrão pro fluxo normal.
alter table public.mentor_discord_calls
  add column if not exists quantity integer not null default 1 check (quantity > 0);
