-- Etapa 5: liga o Realtime na tabela memoriais, pra lápides novas aparecerem
-- ao vivo pra quem já está com o jardim aberto (e ajuda a reduzir a janela
-- de duas pessoas reservarem a mesma vaga sem saber).
-- Rode isto no SQL Editor do painel do Supabase, depois dos scripts anteriores.

alter publication supabase_realtime add table memoriais;
