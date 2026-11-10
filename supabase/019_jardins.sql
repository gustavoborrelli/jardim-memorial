-- Jardins do Arco-Íris (etapa 38): o site passa a ter mais de um jardim (o Jardim
-- Memorial e o Jardim do Lago), e cada homenagem, vela e flor precisa saber de
-- qual jardim é. Uma vaga é única dentro do seu jardim, não no site inteiro.
--
-- Rode isto no SQL Editor do painel do Supabase ANTES do deploy: o código novo
-- filtra tudo por `jardim`, e sem a coluna ele não acha nenhuma homenagem.
-- O site que está no ar hoje continua funcionando depois disto: ele não manda o
-- jardim, e o padrão 'memorial' cobre o que ele criar; as linhas que já existem
-- ficam todas no Jardim Memorial.
--
-- O link de cada homenagem (slug) continua único no site inteiro: /thor leva ao
-- Thor esteja ele em que jardim estiver.

begin;

alter table memoriais add column if not exists jardim text not null default 'memorial';
alter table velas add column if not exists jardim text not null default 'memorial';
alter table flores add column if not exists jardim text not null default 'memorial';

alter table memoriais drop constraint if exists memoriais_jardim_valido;
alter table memoriais add constraint memoriais_jardim_valido check (jardim in ('memorial', 'lago', 'bosque'));
alter table velas drop constraint if exists velas_jardim_valido;
alter table velas add constraint velas_jardim_valido check (jardim in ('memorial', 'lago', 'bosque'));
alter table flores drop constraint if exists flores_jardim_valido;
alter table flores add constraint flores_jardim_valido check (jardim in ('memorial', 'lago', 'bosque'));

-- a vaga é única dentro do jardim (antes era no site inteiro)
drop index if exists memoriais_plot_unico;
create unique index memoriais_plot_unico on memoriais (jardim, plot_x, plot_z);

-- cada jardim lê só as suas velas e flores
create index if not exists velas_jardim_idx on velas (jardim);
create index if not exists flores_jardim_idx on flores (jardim);

commit;
