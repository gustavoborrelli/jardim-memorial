-- Libera a conta admin (gustavolimaborrelli@gmail.com) pra apagar QUALQUER
-- memorial, não só o próprio. Resolve duas coisas:
--   1. As 6 lápides de teste criadas antes da etapa 3 (login) têm
--      criado_por = null, e a policy "autor pode apagar seu memorial" nunca
--      vai liberar isso pra ninguém (null não bate com nenhum auth.uid()).
--   2. Não precisamos mais depender de quem criou cada lápide de teste —
--      só essa conta específica consegue apagar, direto pela UI.
--
-- Convive com a policy "autor pode apagar seu memorial" (003_auth_rls.sql):
-- RLS junta as policies do mesmo comando com OR, então qualquer uma que
-- autorizar já basta.

create policy "admin apaga qualquer memorial"
  on memoriais for delete
  to authenticated
  using ((auth.jwt() ->> 'email') = 'gustavolimaborrelli@gmail.com');
