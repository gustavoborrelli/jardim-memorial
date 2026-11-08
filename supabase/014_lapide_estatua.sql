-- Estátuas de raça: o cachorro do passeio deitado em mármore sobre um pedestal
-- (js/gfx/estatuas.js). Três formatos novos, um por raça que dá pra escolher
-- ao entrar no jardim. Sem isto o banco recusa a homenagem.
-- Rode isto no SQL Editor do painel do Supabase antes do deploy.
-- (O 013 é o da moderação, que ainda está na branch app-ios.)

alter table memoriais drop constraint if exists memoriais_formato_valido;

-- NOT VALID, como no 012: não reavalia as homenagens antigas.
alter table memoriais
  add constraint memoriais_formato_valido
    check (formato in ('classica','ossinho','pata','estatua-golden','estatua-pastor','estatua-dachshund'))
    not valid;
