-- Etapa 4: flores persistentes, com vida útil (murcham e depois somem).
-- Rode isto no SQL Editor do painel do Supabase, depois dos scripts anteriores.

create table if not exists flores (
  id uuid primary key default gen_random_uuid(),
  x numeric not null,
  z numeric not null,
  cor integer not null,
  criado_por uuid references auth.users(id) default auth.uid(),
  criado_em timestamptz not null default now(),
  -- valores abaixo são só um fallback; o cliente sempre envia os dele,
  -- calculados na hora do clique, pra tela e banco baterem exatamente.
  murcha_em timestamptz not null default (now() + (interval '3 days' + interval '1 day' * random())),
  expira_em timestamptz not null default (now() + (interval '6 days' + interval '1 day' * random()))
);

alter table flores enable row level security;

-- Uma flor "some" da API sozinha quando expira_em passa — não precisa de
-- faxina/cron separado, o próprio filtro de leitura já esconde as antigas.
create policy "flores nao expiradas sao publicas"
  on flores for select
  using (expira_em > now());

create policy "usuarios autenticados podem plantar flores"
  on flores for insert
  to authenticated
  with check (auth.uid() = criado_por);
