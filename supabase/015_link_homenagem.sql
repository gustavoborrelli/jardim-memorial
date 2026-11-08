-- Link próprio para cada homenagem (jardim-memorial.vercel.app/thor) e o cartão
-- da prévia no WhatsApp. Rode isto no SQL Editor do painel do Supabase antes do
-- deploy. Só acrescenta: nenhuma homenagem existente muda.

-- slug: o pedaço do link. Gerado pelo banco na criação, a partir do nome, e
-- nunca mais muda (link que já circulou no WhatsApp não pode quebrar).
-- cartao_url: imagem 1200x630 da prévia, gerada no navegador de quem cria.
alter table memoriais add column if not exists slug text;
alter table memoriais add column if not exists cartao_url text;

-- "Pé de Pano" -> "pe-de-pano". Sem extensão (unaccent): os acentos do português
-- cabem num translate.
create or replace function slug_base(nome text) returns text
language sql immutable as $$
  select coalesce(nullif(trim(both '-' from left(regexp_replace(
    translate(lower(coalesce(nome, '')),
      'áàâãäåéèêëíìîïóòôõöúùûüçñý', 'aaaaaaeeeeiiiiooooouuuucny'),
    '[^a-z0-9]+', '-', 'g'), 40)), ''), 'homenagem')
$$;

-- palavras que são caminhos do próprio site, ou que podem vir a ser
create or replace function slug_reservado(s text) returns boolean
language sql immutable as $$
  select s = any (array['api','assets','css','js','public','dist','legacy','index',
    'favicon','robots','sitemap','admin','mapa','sobre','jardim','homenagem','entrar','sair','conta'])
$$;

-- o primeiro Thor fica com /thor, o segundo com /thor-2, e assim por diante
create or replace function slug_livre(nome text) returns text
language plpgsql as $$
declare
  base text := slug_base(nome);
  candidato text := base;
  n int := 1;
begin
  while slug_reservado(candidato) or exists (select 1 from memoriais where slug = candidato) loop
    n := n + 1;
    candidato := base || '-' || n;
  end loop;
  return candidato;
end $$;

create or replace function memoriais_slug_na_criacao() returns trigger
language plpgsql as $$
begin
  new.slug := slug_livre(new.nome_pet);
  return new;
end $$;

-- depois de preenchido, ninguém troca (o dono pode editar a homenagem pela API)
create or replace function memoriais_slug_fixo() returns trigger
language plpgsql as $$
begin
  if old.slug is not null then new.slug := old.slug; end if;
  return new;
end $$;

drop trigger if exists memoriais_slug_criacao on memoriais;
create trigger memoriais_slug_criacao before insert on memoriais
  for each row execute function memoriais_slug_na_criacao();

drop trigger if exists memoriais_slug_imutavel on memoriais;
create trigger memoriais_slug_imutavel before update on memoriais
  for each row execute function memoriais_slug_fixo();

-- as homenagens que já existem, na ordem em que foram criadas
do $$
declare r record;
begin
  for r in select id, nome_pet from memoriais where slug is null order by criado_em loop
    update memoriais set slug = slug_livre(r.nome_pet) where id = r.id;
  end loop;
end $$;

-- dois Thor criados no mesmo instante: o segundo é recusado aqui, e o site tenta de novo
create unique index if not exists memoriais_slug_unico on memoriais (slug);
