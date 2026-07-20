-- Terceiro desfecho possível pra uma call, além de concluída/cancelada: o
-- mentorado não compareceu. Não conta como call realizada, mas — diferente
-- de um cancelamento — ainda bloqueia um novo agendamento na mesma semana
-- (a checagem de limite semanal já ignora só 'cancelada', então basta esse
-- novo status não cair nesse caso pra já funcionar).
-- Remove dinamicamente qualquer check constraint existente sobre a coluna
-- status (em vez de supor o nome padrão do Postgres), pra não depender de
-- como ela foi originalmente nomeada.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.bookings drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.bookings add constraint bookings_status_check
  check (status in ('confirmada', 'concluida', 'cancelada', 'no_show'));
