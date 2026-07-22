alter table public.bookings
  add column if not exists reminder_30_sent_at timestamptz,
  add column if not exists reminder_5_sent_at timestamptz,
  add column if not exists reminder_start_sent_at timestamptz;
