-- Etapa 2: tabela de memoriais (lápides) do Jardim Memorial.
-- Rode isto no SQL Editor do painel do Supabase.

create table if not exists memoriais (
  id uuid primary key default gen_random_uuid(),
  nome_pet text not null,
  datas text,
  mensagem text,
  setor text not null,
  plot_x numeric not null,
  plot_z numeric not null,
  foto_url text,
  criado_em timestamptz not null default now()
);

-- Evita duas homenagens na mesma vaga (mesmo x/z).
create unique index if not exists memoriais_plot_unico
  on memoriais (plot_x, plot_z);

-- RLS: por enquanto (sem login ainda) qualquer visitante pode ler e criar
-- memoriais, mas ninguém pode alterar ou apagar o de outra pessoa depois
-- de criado. Isso muda na etapa 3, quando tivermos login.
alter table memoriais enable row level security;

create policy "qualquer pessoa pode ler memoriais"
  on memoriais for select
  using (true);

create policy "qualquer pessoa pode criar memoriais"
  on memoriais for insert
  with check (true);
