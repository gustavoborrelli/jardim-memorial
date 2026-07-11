-- Etapa 13: mensagens públicas na lápide (livro de visitas por homenagem).
-- Rode isto no SQL Editor do painel do Supabase, depois dos scripts anteriores.

create table if not exists mensagens (
  id uuid primary key default gen_random_uuid(),
  memorial_id uuid not null references memoriais(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 140),
  autor_nome text check (char_length(autor_nome) <= 30),
  criado_por uuid references auth.users(id) default auth.uid(),
  criado_em timestamptz not null default now()
);

create index if not exists mensagens_memorial_id_idx on mensagens(memorial_id);

alter table mensagens enable row level security;

create policy "mensagens sao publicas"
  on mensagens for select
  using (true);

create policy "usuarios autenticados podem deixar mensagem"
  on mensagens for insert
  to authenticated
  with check (auth.uid() = criado_por);

-- mesma conta que já pode apagar qualquer memorial (008_admin_apaga_memorial.sql)
-- também modera mensagens.
create policy "admin apaga qualquer mensagem"
  on mensagens for delete
  to authenticated
  using ((auth.jwt() ->> 'email') = 'gustavolimaborrelli@gmail.com');
