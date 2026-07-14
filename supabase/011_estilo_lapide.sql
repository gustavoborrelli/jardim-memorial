-- Personalização da lápide/marcador: formato (clássica, coração, estaca de
-- jardim, ossinho ou estátua de cachorro) e cor, escolhidos por quem cria a
-- homenagem. Objetivo: um jardim menos "cemitério" e mais convidativo.
-- Rode isto no SQL Editor do painel do Supabase, depois dos scripts anteriores.

alter table memoriais
  add column if not exists formato text not null default 'classica',
  add column if not exists cor text not null default '#c9beb0';

alter table memoriais
  add constraint memoriais_formato_valido
    check (formato in ('classica','coracao','estaca','ossinho','cachorro'));

alter table memoriais
  add constraint memoriais_cor_valida
    check (cor ~ '^#[0-9a-fA-F]{6}$');
