-- Opcional: dados de exemplo para testar a página pública de agendamento
-- sem precisar preencher tudo manualmente pelo painel.
--
-- Rode DEPOIS de criar sua conta (para ter um mentor_id real em auth.users),
-- substituindo o UUID abaixo pelo seu próprio `auth.uid()`.

-- update public.profiles
-- set full_name = 'Ana Souza',
--     headline = 'Mentoria de carreira em Produto e Tech',
--     slug = 'ana-souza',
--     session_duration_minutes = 45,
--     buffer_minutes = 15
-- where id = 'COLOQUE_SEU_USER_ID_AQUI';

-- insert into public.availability_rules (mentor_id, weekday, start_time, end_time)
-- values
--   ('COLOQUE_SEU_USER_ID_AQUI', 1, '09:00', '12:00'),
--   ('COLOQUE_SEU_USER_ID_AQUI', 1, '14:00', '18:00'),
--   ('COLOQUE_SEU_USER_ID_AQUI', 3, '09:00', '12:00'),
--   ('COLOQUE_SEU_USER_ID_AQUI', 5, '10:00', '16:00');
