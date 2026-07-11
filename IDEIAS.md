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
10. ✅ **Apagar homenagem (admin)** — primeira tentativa foi um botão "🗑
    Apagar homenagem" dentro do card de hover, mas o card só existe enquanto
    o mouse está sobre a lápide (raycasting 3D); mover o mouse até o botão
    tirava o cursor da pedra e escondia tudo antes de dar tempo de clicar.
    Trocado por: clicar direto na lápide (`js/main.js` → `onClick`) só faz
    algo se `auth.getUser().email` for a conta admin
    (`gustavolimaborrelli@gmail.com`, hardcoded em `js/menuUi.js` →
    `handleStoneClick()`) — aí abre um `confirm()` nativo e apaga de vez.
    Pra qualquer outra conta (ou deslogado), clicar numa lápide continua sem
    fazer nada, igual antes — nada de novo poluindo a UI. A policy de delete
    também mudou: em vez de "só o dono apaga o seu" (etapa 3), agora é "essa
    conta específica apaga qualquer memorial"
    (`supabase/008_admin_apaga_memorial.sql`, via `auth.jwt()->>'email'`) —
    as duas convivem (RLS junta com OR). Isso também resolveu de vez as 6
    lápides de teste com `criado_por = null` (de antes do login existir),
    que a regra por dono nunca ia conseguir liberar pra ninguém.
11. ✅ **Flor só na grama** — o clique de plantar flor (`js/main.js` →
    `onClick`) só checava os limites do mapa antes de plantar, então dava
    pra colocar flor em cima das avenidas de concreto e da praça central.
    A função `world.isFreeSpot()` já existia em `js/mundo.js` e resolvia
    exatamente isso pras 90 flores decorativas espalhadas no início
    (etapa 4) — só faltava o clique do jogador usar a mesma checagem.
    Reaproveitada em vez de duplicar a lógica das avenidas/praça.
12. ✅ **Placas das seções corrigidas** — as 4 placas de entrada (arcos de
    madeira, `js/lapides.js` → `makeSectionSign`) tinham dois bugs. (1) A
    rotação do arco (`g.rotation.y`) era fixa pra todo mundo, mas a tábua é
    de dupla face e o verso mostra o texto espelhado — como só o Bosque da
    Saudade e o Prado dos Companheiros (ambos do lado -x) ficavam com a
    face legível voltada pra quem entra vindo da avenida, os outros dois
    (Recanto do Sol e Campo das Estrelas, lado +x) apareciam invertidos.
    Corrigido tornando a rotação dependente de `sec.sx`. (2) O tamanho da
    fonte era fixo (46px numa tela de 512px), então nomes longos como
    "Campo das Estrelas" e "Prado dos Companheiros" estouravam a moldura;
    agora o tamanho diminui automaticamente até caber. Verificado com
    screenshots (Playwright, câmera posicionada manualmente em frente a
    cada arco) mostrando as 4 placas legíveis.
13. ✅ **Mensagens na lápide** — primeiro passo de tornar o jardim mais
    dinâmico com interação social. Clicar numa lápide agora abre um modal
    (`js/menuUi.js` → `openMessagesFor`/`renderMessages`) com um livro de
    visitas: todo mundo pode ler as mensagens já deixadas ali e, se
    logado, deixar a sua (nome opcional — sem preencher, aparece como
    "Anônimo"; e-mail nunca aparece em lugar nenhum público). Nova tabela
    `mensagens` (`supabase/009_mensagens.sql`), RLS pública pra leitura,
    insert só autenticado, `on delete cascade` quando o memorial é apagado.
    Isso substituiu o comportamento antigo (etapa 10) de clicar numa lápide
    apagar na hora só pra conta admin: agora o clique sempre abre o modal
    de mensagens pra qualquer um, e a conta admin ganha, dentro desse mesmo
    modal, um botão "🗑 Apagar homenagem" e um ícone de apagar por
    mensagem — a moderação virou parte da mesma interação em vez de um
    comportamento escondido só no clique.
14. ✅ **Velas** — segundo tipo de tributo, ao lado da flor (etapa 4).
    Um botão novo perto do de trocar visão (`🌼 Flor` / `🕯️ Vela`,
    `js/menuUi.js` → `btnPlantToggle`/`getPlantMode`) escolhe o que o
    clique no gramado planta; `js/main.js` só decide entre
    `world.plantAndSaveFlor`/`plantAndSaveVela` conforme esse estado.
    Visual em `js/mundo.js`: corpo de cera + pavio + chama (esfera achatada
    com material emissivo) + um `THREE.Sprite` com textura de brilho radial
    (sempre de frente pra câmera, sem custo de luz dinâmica de verdade —
    decisão consciente de performance, já que velas plantadas por usuários
    não têm limite, igual as flores). A vida útil é bem mais longa que a da
    flor: queima entre 8–10 dias (`apaga_em`, equivalente ao `murcha_em` da
    flor) e some entre 14–16 dias (`expira_em`) — quando apaga, a chama e o
    brilho somem e só sobra o coto de cera. Nova tabela `velas`
    (`supabase/010_velas.sql`), mesmo padrão de RLS e faxina via `pg_cron`
    das flores (`004_flores.sql`/`007_faxina_flores.sql`).
15. ✅ **Presença em tempo real** — terceiro e último passo da leva de
    dinamismo social. Os cachorros de quem mais está com o jardim aberto
    agora aparecem andando de verdade pra todo mundo, ao vivo. Diferente
    das duas etapas anteriores, não precisou de tabela nem RLS: é estado
    efêmero (posição de quem está andando não precisa sobreviver a um F5),
    então usa o Supabase Realtime em modo Presence (só pra saber quem está
    conectado agora, criar/remover o cachorro-fantasma na hora certa) +
    Broadcast (posição/direção em alta frequência, throttled a cada
    150ms). Novo módulo `js/presenca.js` reaproveita `buildDog()` (já
    exportado de `js/cachorros.js`) pra montar o modelo de cada
    cachorro-fantasma com a raça certa, e interpola posição/rotação
    suavemente entre as mensagens recebidas em vez de "teleportar". Não
    exige login, igual andar pelo jardim hoje já não exige. Testado com
    duas abas reais do navegador (Playwright): o cachorro de uma aba
    aparece e anda na outra, e some quando a aba fecha.

## Ideias soltas (não decidido ainda)

- A leva de dinamismo social planejada em conjunto está completa: (1)
  mensagens na lápide — etapa 13; (2) velas — etapa 14; (3) presença em
  tempo real — etapa 15. Próximas ideias ainda por decidir, abaixo.
- Pensar em um limite de tamanho/qtd de fotos por lápide.
- Vale a pena limitar quantas flores/mensagens uma pessoa pode deixar por
  dia, pra evitar spam visual no jardim?
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
