-- Padrão pra todo mentor (novo ou já existente): call de 60 minutos via
-- Google Meet. meeting_location já tinha 'Google Meet' como default desde
-- o início — só precisamos ajustar a duração.
alter table public.profiles alter column session_duration_minutes set default 60;

update public.profiles set session_duration_minutes = 60;
update public.profiles set meeting_location = 'Google Meet' where meeting_location is null or meeting_location = '';
