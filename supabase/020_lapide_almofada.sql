-- Shih-tzu, Yorkshire e Spitz Alemão (lulu) entram como companheiros do passeio, e
-- com eles um formato de lápide novo: a estátua do cachorro numa almofada de
-- mármore ('almofada-shihtzu', 'almofada-yorkshire', 'almofada-spitz'). Sem isto o
-- banco recusa as lápides novas.
-- Rode isto no SQL Editor do painel do Supabase antes do deploy.

alter table memoriais drop constraint if exists memoriais_formato_valido;

-- NOT VALID, como no 012, 014, 016 e 017: não reavalia as homenagens antigas.
alter table memoriais
  add constraint memoriais_formato_valido
    check (formato in ('classica','ossinho','pata','estatua-golden','estatua-pastor','estatua-dachshund','estatua-caramelo','estatua-gato','almofada-shihtzu','almofada-yorkshire','almofada-spitz'))
    not valid;
