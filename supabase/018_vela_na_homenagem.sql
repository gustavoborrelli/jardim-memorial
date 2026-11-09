-- Vela de uma homenagem: até aqui a vela era só um ponto no chão (x, z) e não
-- pertencia a ninguém. Com memorial_id, quem acende pela ficha do mapa ou pelo
-- livro de mensagens deixa a vela "nesta lápide": ela nasce na frente da pedra,
-- conta nas "velas acesas" da homenagem e some junto se a homenagem for apagada.
-- Velas plantadas no chão continuam sem dono (memorial_id nulo).
-- Rode isto no SQL Editor do painel do Supabase antes do deploy.

alter table velas
  add column if not exists memorial_id uuid references memoriais(id) on delete cascade;

create index if not exists velas_memorial_id_idx on velas(memorial_id);
