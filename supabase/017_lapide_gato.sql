-- Gatos: Siamês, Persa e Maine Coon entram como companheiros do passeio, e com
-- eles um formato de lápide 'estatua-gato' (um tipo só: em mármore, sem a cor,
-- as raças de gato não se distinguem). Sem isto o banco recusa a estátua nova.
-- Rode isto no SQL Editor do painel do Supabase antes do deploy.

alter table memoriais drop constraint if exists memoriais_formato_valido;

-- NOT VALID, como no 012, 014 e 016: não reavalia as homenagens antigas.
alter table memoriais
  add constraint memoriais_formato_valido
    check (formato in ('classica','ossinho','pata','estatua-golden','estatua-pastor','estatua-dachshund','estatua-caramelo','estatua-gato'))
    not valid;
