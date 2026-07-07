-- Etapa 2: bucket de Storage para as fotos das lápides.
-- Rode isto no SQL Editor do painel do Supabase, depois do 001_memoriais.sql.

insert into storage.buckets (id, name, public)
values ('fotos-memoriais', 'fotos-memoriais', true)
on conflict (id) do nothing;

-- Qualquer pessoa pode ver as fotos (o bucket já é público, mas isso
-- garante a leitura via API também).
create policy "leitura publica de fotos"
  on storage.objects for select
  using (bucket_id = 'fotos-memoriais');

-- Qualquer pessoa pode enviar uma foto nova para este bucket (sem login
-- ainda). Isso vai apertar na etapa 3.
create policy "upload publico de fotos"
  on storage.objects for insert
  with check (bucket_id = 'fotos-memoriais');
