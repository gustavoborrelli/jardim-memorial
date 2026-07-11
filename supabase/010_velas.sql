-- Etapa 14: velas, um segundo tipo de tributo além da flor — mesmo padrão
-- de flores (004_flores.sql), mas com vida útil bem mais longa (a vela
-- "queima" por mais tempo do que a flor murcha).
-- Rode isto no SQL Editor do painel do Supabase, depois dos scripts anteriores.

create table if not exists velas (
  id uuid primary key default gen_random_uuid(),
  x numeric not null,
  z numeric not null,
  criado_por uuid references auth.users(id) default auth.uid(),
  criado_em timestamptz not null default now(),
  -- valores abaixo são só um fallback; o cliente sempre envia os dele,
  -- calculados na hora do clique, pra tela e banco baterem exatamente.
  apaga_em timestamptz not null default (now() + (interval '8 days' + interval '2 days' * random())),
  expira_em timestamptz not null default (now() + (interval '14 days' + interval '2 days' * random()))
);

alter table velas enable row level security;

create policy "velas nao expiradas sao publicas"
  on velas for select
  using (expira_em > now());

create policy "usuarios autenticados podem acender velas"
  on velas for insert
  to authenticated
  with check (auth.uid() = criado_por);

-- faxina automática (mesmo padrão de 007_faxina_flores.sql); pg_cron já
-- deve estar habilitado no painel desde aquele script.
select cron.schedule(
  'faxina-velas-expiradas',
  '0 3 * * *',
  $$ delete from public.velas where expira_em < now(); $$
);
