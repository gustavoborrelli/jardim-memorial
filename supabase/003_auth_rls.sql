-- Etapa 3: exige login para criar memoriais; só o autor edita/apaga o seu.
-- Rode isto no SQL Editor do painel do Supabase, depois dos scripts 001 e 002.

alter table memoriais
  add column if not exists criado_por uuid references auth.users(id) default auth.uid();

drop policy if exists "qualquer pessoa pode criar memoriais" on memoriais;

create policy "usuarios autenticados podem criar memoriais"
  on memoriais for insert
  to authenticated
  with check (auth.uid() = criado_por);

create policy "autor pode atualizar seu memorial"
  on memoriais for update
  to authenticated
  using (auth.uid() = criado_por)
  with check (auth.uid() = criado_por);

create policy "autor pode apagar seu memorial"
  on memoriais for delete
  to authenticated
  using (auth.uid() = criado_por);

-- Storage: só usuário logado envia foto; leitura continua pública.
drop policy if exists "upload publico de fotos" on storage.objects;

create policy "upload autenticado de fotos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'fotos-memoriais');
