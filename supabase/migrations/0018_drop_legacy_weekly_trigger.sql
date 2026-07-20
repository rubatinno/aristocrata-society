-- A migration 0006 já mandava remover esse gatilho antigo (regra fixa de
-- "1 call/semana", substituída pelo limite configurável por plano aplicado
-- em createBooking), mas ele continua ativo no banco — reforça a remoção.
drop trigger if exists enforce_one_booking_per_week_trigger on public.bookings;
drop function if exists public.enforce_one_booking_per_week();
