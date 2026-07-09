-- Faxina automática: apaga de vez as flores que já expiraram há tempo.
-- A política de leitura de 004_flores.sql já esconde flores expiradas de
-- todo mundo (expira_em > now()); este script só evita que a tabela cresça
-- pra sempre com linhas que ninguém nunca mais vai ver.
--
-- Antes de rodar: habilite a extensão pg_cron no painel do Supabase
-- (Database → Extensions → busque "pg_cron" → Enable). Sem isso, o
-- "create extension" abaixo falha.

create extension if not exists pg_cron with schema pg_catalog;

-- roda toda madrugada às 3h (horário do banco, geralmente UTC); troque o
-- cron se preferir outro horário — não precisa ser exato, já que a flor
-- fica invisível pra todo mundo desde o momento em que expira_em passa.
select cron.schedule(
  'faxina-flores-expiradas',
  '0 3 * * *',
  $$ delete from public.flores where expira_em < now(); $$
);

-- Pra conferir que o job está agendado:
--   select * from cron.job;
-- Pra ver o histórico de execuções (depois que já tiver rodado alguma vez):
--   select * from cron.job_run_details order by start_time desc limit 10;

-- Pra remover o agendamento, se precisar no futuro:
--   select cron.unschedule('faxina-flores-expiradas');
