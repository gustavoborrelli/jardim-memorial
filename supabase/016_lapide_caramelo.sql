-- Vira-lata caramelo: a quarta raça do passeio, e com ela o formato de lápide
-- 'estatua-caramelo' (js/gfx/estatuas.js). Sem isto o banco recusa a homenagem
-- com a estátua nova.
-- Rode isto no SQL Editor do painel do Supabase antes do deploy.

alter table memoriais drop constraint if exists memoriais_formato_valido;

-- NOT VALID, como no 012 e no 014: não reavalia as homenagens antigas.
alter table memoriais
  add constraint memoriais_formato_valido
    check (formato in ('classica','ossinho','pata','estatua-golden','estatua-pastor','estatua-dachshund','estatua-caramelo'))
    not valid;
