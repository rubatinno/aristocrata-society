-- Conteúdo liberado aos poucos ("drip"): módulo ou aula podem ficar
-- travados até completar X dias desde o registro do mentorado
-- (mentee_profiles.created_at). Null = liberado na hora, sem trava.
alter table public.course_modules add column if not exists unlock_after_days integer;
alter table public.course_lessons add column if not exists unlock_after_days integer;
