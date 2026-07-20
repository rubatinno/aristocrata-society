-- Janela de agendamento configurável por mentor: até quantos dias no futuro
-- o mentorado pode marcar, e com quanta antecedência mínima.
alter table public.profiles
  add column if not exists booking_window_days int not null default 45,
  add column if not exists min_notice_hours numeric not null default 1;

alter table public.profiles drop constraint if exists booking_window_days_range;
alter table public.profiles
  add constraint booking_window_days_range check (booking_window_days between 1 and 365);

alter table public.profiles drop constraint if exists min_notice_hours_range;
alter table public.profiles
  add constraint min_notice_hours_range check (min_notice_hours >= 0 and min_notice_hours <= 168);

-- Telefone do mentorado, coletado junto com nome e e-mail na confirmação do agendamento.
alter table public.bookings add column if not exists mentee_phone text not null default '';
alter table public.bookings alter column mentee_phone drop default;

