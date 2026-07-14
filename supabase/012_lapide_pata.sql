-- Redesenho dos formatos de lápide a partir da referência de design real
-- (projeto "Jardim memorial de cachorros" → Ossinho + Pata). Substitui os
-- formatos coração/estaca/cachorro da etapa anterior, que não agradaram
-- visualmente, por só dois novos: ossinho (redesenhado) e pata.
-- Rode isto no SQL Editor do painel do Supabase, depois do 011.

alter table memoriais drop constraint if exists memoriais_formato_valido;

-- NOT VALID: não reavalia linhas já existentes (ex.: homenagens de teste
-- criadas com os formatos antigos) — só passa a valer pra linhas novas.
alter table memoriais
  add constraint memoriais_formato_valido
    check (formato in ('classica','ossinho','pata'))
    not valid;
