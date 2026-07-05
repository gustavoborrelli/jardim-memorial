# Ideias e roteiro do Jardim Memorial

Notas de planejamento entre uma etapa e outra. Objetivo final: site online onde
famílias criam memoriais permanentes, escolhem onde fica a lápide e deixam
flores/velas nas lápides dos outros (MVP family & friends).

## Etapas

1. ✅ **Reorganização do projeto** — HTML/CSS/JS divididos em módulos, Vite como
   servidor de dev, Git inicializado. Nada de comportamento mudou.
2. ⏳ **Conectar ao Supabase** — trocar os dados "fake" (seedStories, plots em
   memória) por dados reais num banco Postgres gerenciado pelo Supabase.
3. ⏳ Autenticação simples (quem pode criar uma homenagem?)
4. ⏳ Persistência de flores/velas deixadas por outras pessoas
5. ⏳ Escolha de onde fica a lápide (reservar um "plot" específico)
6. ⏳ Deploy na Vercel

## Ideias soltas (não decidido ainda)

- Como impedir que duas pessoas reservem o mesmo plot ao mesmo tempo?
- Fotos: hoje ficam só na memória do navegador (base64) — vão precisar de um
  Storage (o próprio Supabase Storage resolve isso).
- Vale a pena um modo "convidado" (só vê e deixa flor) vs. "família" (cria
  memorial)?
- Pensar em um limite de tamanho/qtd de fotos por lápide.

## Notas técnicas para lembrar na fase 2

- O Three.js hoje é carregado via `<script>` de CDN (não é um pacote npm).
  Isso foi decisão da etapa 1 para não arriscar mudar o comportamento do jogo.
  Podemos revisitar isso quando formos mexer em build/deploy de verdade.
- `js/lapides.js` é o módulo que sabe tudo sobre os "plots" (lugares de
  lápide). É provavelmente onde a integração com Supabase vai começar: trocar
  o array `plots` em memória por dados vindos do banco.
- `js/menuUi.js` já centraliza o modal de "deixar uma homenagem" — é onde o
  formulário vai precisar salvar no Supabase em vez de só guardar em memória.
