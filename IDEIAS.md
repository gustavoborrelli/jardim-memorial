# Ideias e roteiro do Jardim Memorial

Notas de planejamento entre uma etapa e outra. Objetivo final: site online onde
famílias criam memoriais permanentes, escolhem onde fica a lápide e deixam
flores/velas nas lápides dos outros (MVP family & friends).

## Etapas

1. ✅ **Reorganização do projeto** — HTML/CSS/JS divididos em módulos, Vite como
   servidor de dev, Git inicializado. Nada de comportamento mudou.
2. ✅ **Conectar ao Supabase** — trocar os dados "fake" (seedStories, plots em
   memória) por dados reais num banco Postgres gerenciado pelo Supabase.
   Tabela `memoriais` + Storage `fotos-memoriais` (scripts em `supabase/`),
   `js/supabaseClient.js` faz a conexão via variáveis de ambiente (`.env`,
   nunca commitado). Lápides carregam do banco ao abrir e persistem entre
   sessões. Flores ainda não persistem (fica para a etapa 4).
3. ✅ **Autenticação simples** — login por e-mail/senha via Supabase Auth
   (cadastro aberto, sem convite). Criar homenagem exige login; ver o jardim
   continua livre para visitantes. RLS em `memoriais`/`storage.objects` agora
   checa `auth.uid()` (script `supabase/003_auth_rls.sql`); coluna
   `criado_por` guarda o dono de cada memorial (editar/apagar do próprio já
   liberado no banco, sem UI ainda). "Confirm email" desligado no dashboard
   por enquanto — religar no deploy (etapa 6).
4. ✅ **Persistência de flores/velas** — flores plantadas no gramado agora
   exigem login (mesma trava `requireAuth` das homenagens, generalizada em
   `menuUi.js`) e são salvas na tabela `flores` (script
   `supabase/004_flores.sql`). Vida útil com aleatoriedade: começam a murchar
   entre 3–4 dias e somem entre 6–7 dias — sem cron job, a própria política
   de RLS de leitura (`expira_em > now()`) já esconde as expiradas. As 90
   flores decorativas espalhadas no início (`scatterFlowers`) continuam
   só visuais, sem dono e sem murchar.
5. ✅ **Escolha de onde fica a lápide** — clicar numa vaga vazia específica já
   reservava exatamente aquele lugar desde a etapa 1; o que faltava era tratar
   bem a corrida entre duas pessoas escolhendo a mesma vaga. O índice único
   `memoriais_plot_unico` (etapa 2) já impedia a duplicata no banco; agora o
   erro de conflito (Postgres `23505`) vira uma mensagem amigável e fecha o
   modal. Além disso, `memoriais` está no Realtime (script
   `supabase/005_realtime.sql`) — lápides novas aparecem ao vivo pra quem já
   está com o jardim aberto, sem recarregar, o que também reduz a chance do
   conflito acontecer.
6. ⏳ Deploy na Vercel (+ controles de toque pro celular, já que hoje andar
   com o cachorro exige teclado)

## Ideias soltas (não decidido ainda)

- Pensar em um limite de tamanho/qtd de fotos por lápide.
- Flores expiradas continuam existindo na tabela pra sempre (só ficam
  invisíveis pela RLS) — se a tabela crescer muito com o tempo, pensar numa
  faxina periódica (pg_cron ou Edge Function) que apaga linhas velhas.
- Vale a pena limitar quantas flores uma pessoa pode plantar por dia, pra
  evitar spam visual no jardim?

## Notas técnicas para lembrar na fase 2

- O Three.js hoje é carregado via `<script>` de CDN (não é um pacote npm).
  Isso foi decisão da etapa 1 para não arriscar mudar o comportamento do jogo.
  Podemos revisitar isso quando formos mexer em build/deploy de verdade.
- `js/lapides.js` é o módulo que sabe tudo sobre os "plots" (lugares de
  lápide). É provavelmente onde a integração com Supabase vai começar: trocar
  o array `plots` em memória por dados vindos do banco.
- `js/menuUi.js` já centraliza o modal de "deixar uma homenagem" — é onde o
  formulário vai precisar salvar no Supabase em vez de só guardar em memória.
