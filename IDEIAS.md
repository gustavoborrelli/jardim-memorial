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
6. ✅ **Deploy na Vercel** — site no ar em https://jardim-memorial.vercel.app,
   código no GitHub (`github.com/gustavoborrelli/jardim-memorial`) conectado
   à Vercel pra publicar sozinho a cada push. Variáveis de ambiente
   configuradas no painel da Vercel (nunca no código). Adicionado também:
   joystick de toque pro celular (`js/cachorros.js`), correção do app usando
   `100dvh` (a barra do navegador mobile cortava o joystick), HUD mais
   enxuto em telas de toque, e retomada explícita do áudio (`audioCtx.resume()`)
   porque navegadores desktop suspendem som que não vem direto de um clique.
7. ✅ **Login com Google** — botão "Continuar com Google" no modal de
   entrar/criar conta (`js/auth.js` → `signInWithGoogle()`, fluxo OAuth padrão
   do Supabase com redirect de volta pro próprio site). OAuth client
   configurado no Google Cloud Console (redirect URI
   `https://uxtjooztgtcrdkmpfnxu.supabase.co/auth/v1/callback`) e credenciais
   habilitadas no Supabase (Authentication → Providers → Google). Testado e
   funcionando em produção.
   Limitação aceita: como o login redireciona a página inteira pro Google e
   volta, uma ação pendente (ex.: "estava tentando plantar flor quando pediu
   login") se perde no reload — a pessoa só precisa clicar de novo depois de
   logar. Mesma limitação não existe no login por e-mail/senha, que não sai
   da página.
8. ✅ **Som ambiente** — vento (ruído filtrado em loop, com "rajadas" de
   volume aleatórias) e pássaros (blips agudos em intervalos aleatórios de
   2.5–8.5s), tudo sintetizado via Web Audio API em `js/menuUi.js` — sem
   arquivos de áudio, mesmo estilo do `chime()` que já existia. Começa a
   tocar quando o jogo começa (`startGame()`, gesto de clique real, evita o
   bloqueio de autoplay). Botão de mute de volta, mas no menu principal/pausa
   (`🔊/🔇 Som ambiente`, embaixo dos botões) em vez do HUD, pra manter o HUD
   limpo; preferência salva em `localStorage` e sobrevive entre visitas.
9. ✅ **Faxina de flores expiradas** — job `pg_cron` (script
   `supabase/007_faxina_flores.sql`) roda toda madrugada às 3h e apaga de
   vez as linhas de `flores` com `expira_em` no passado. A RLS já escondia
   essas flores de todo mundo desde a etapa 4; isso só evita que a tabela
   cresça pra sempre com linhas mortas. Precisou habilitar a extensão
   `pg_cron` no painel (Database → Extensions) antes de rodar o script.
10. ✅ **Apagar homenagem** — botão "🗑 Apagar homenagem" no card que aparece
    ao passar o mouse numa lápide, visível só pro autor (`auth.getUser().id
    === criadoPor`). Usa a policy de delete que já existia desde a etapa 3
    (`js/lapides.js` → `deleteMemorial()`), com confirmação antes de apagar
    de vez. `memoriais` também ganhou o evento `DELETE` no Realtime — se o
    dono apagar, a lápide some na hora pra quem mais estiver com o jardim
    aberto. Limitação: lápides criadas antes da etapa 3 (login) têm
    `criado_por = null` no banco e não têm dono pra nenhuma conta bater — só
    dá pra apagar essas pelo SQL Editor (`delete from memoriais where
    criado_por is null;`), não tem como liberar isso pela UI sem enfraquecer
    a regra de "só o dono apaga o seu".

## Ideias soltas (não decidido ainda)

- Pensar em um limite de tamanho/qtd de fotos por lápide.
- Vale a pena limitar quantas flores uma pessoa pode plantar por dia, pra
  evitar spam visual no jardim?
- E-mail de confirmação: o Supabase usa um servidor de teste próprio, com
  limite baixo de envios por hora (ficamos sem receber depois de testar
  algumas vezes seguidas). "Confirm email" está desligado de novo por causa
  disso. Quando for mandar o link pra valer pros amigos, vale configurar um
  provedor de e-mail de verdade (ex: Resend, tem plano grátis) em
  Authentication → Settings → SMTP, e religar a confirmação.

## Notas técnicas para lembrar na fase 2

- O Three.js hoje é carregado via `<script>` de CDN (não é um pacote npm).
  Isso foi decisão da etapa 1 para não arriscar mudar o comportamento do jogo.
  Podemos revisitar isso quando formos mexer em build/deploy de verdade.
- `js/lapides.js` é o módulo que sabe tudo sobre os "plots" (lugares de
  lápide). É provavelmente onde a integração com Supabase vai começar: trocar
  o array `plots` em memória por dados vindos do banco.
- `js/menuUi.js` já centraliza o modal de "deixar uma homenagem" — é onde o
  formulário vai precisar salvar no Supabase em vez de só guardar em memória.
