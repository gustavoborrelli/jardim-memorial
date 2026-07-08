-- Etapa 6 (ajuste): apagar uma conta de usuário não pode travar por causa
-- das homenagens/flores que ela deixou no jardim. A lápide/flor continua
-- existindo — só perde o "dono" registrado (criado_por vira NULL).
-- Rode isto no SQL Editor do painel do Supabase.

alter table memoriais drop constraint if exists memoriais_criado_por_fkey;
alter table memoriais
  add constraint memoriais_criado_por_fkey
  foreign key (criado_por) references auth.users(id) on delete set null;

alter table flores drop constraint if exists flores_criado_por_fkey;
alter table flores
  add constraint flores_criado_por_fkey
  foreign key (criado_por) references auth.users(id) on delete set null;
