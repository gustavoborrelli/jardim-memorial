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
16. ✅ **Câmera de 3ª pessoa acompanha sozinha no celular** — no toque, um
    dedo já vai pro joystick (canto inferior esquerdo) e não sobra outro
    fácil pra arrastar a tela e girar a câmera junto, principalmente numa
    tela pequena. Agora, só em telas de toque (`js/cachorros.js` →
    `isTouchDevice`, via `matchMedia('(pointer:coarse)')`), a câmera de 3ª
    pessoa gira sozinha até ficar atrás do cachorro enquanto ele anda pelo
    joystick — um pouco mais devagar que o giro do próprio cachorro, pra
    parecer "chegando por trás" em vez de grudada. Se a pessoa estiver
    arrastando a tela na hora (pra olhar manualmente), o automático não
    interfere. No desktop nada mudou — a câmera livre (touchpad/roda do
    mouse) continua exatamente como antes. Também padronizado nessa leva:
    o botão de flor/vela ficou redondo, só com o ícone, igual o botão de
    trocar visão (antes era uma pílula com texto).
17. ✅ **Lápide personalizável** — objetivo explícito: um jardim que dá
    vontade de entrar, não um cemitério cinza. Quem cria uma homenagem
    agora escolhe entre 3 formatos (Clássica, Ossinho, Pata) e 6 cores
    alegres (pedra, céu, coral, sol, lilás, menta) — seletores no modal de
    homenagem (`index.html` → `#formatoPicker`/`#corPicker`, montados
    dinamicamente em `js/menuUi.js` a partir de `lapides.FORMATOS`/
    `lapides.PALETTE`, fonte única da verdade). Novas colunas `formato`/
    `cor` em `memoriais` (`supabase/011_estilo_lapide.sql`).
    Primeira versão tinha 5 formatos inventados a partir só de descrição
    em texto (Clássica, Coração, Estaca, Ossinho, Estátua de cachorro,
    cada um tingido inteiro na cor escolhida) — teve retrabalho visual na
    hora (a estátua de cachorro virou "boneco de neve" até ganhar um
    focinho de cor contrastante) mas, mesmo corrigida, o resultado testado
    de verdade no jardim não agradou: formas pareciam genéricas (só
    esfera+cone+caixa) e pequenas demais pra caber foto+texto direito.
    Foi quando o usuário compartilhou um link de um projeto de design
    dele (`claude.ai/design`, ferramenta `DesignSync`) com a
    especificação real de dois formatos — Ossinho e Pata — incluindo
    medidas de referência, material (mármore/calcário claro, roughness
    baixo) e a decisão-chave: **a cor nunca tinge a peça inteira**, só
    aparece como um detalhe pintado (a faixa do ossinho, a unha da pata)
    — foi isso que fazia as cores parecerem "lavadas" na primeira
    tentativa. Reconstruído do zero em cima dessa referência
    (`buildBoneMarker`/`buildPawMarker` em `js/lapides.js`, removendo
    coração/estaca/cachorro e sua entrada em `FORMATOS`): ossinho é um
    osso vertical com dois pares de nós unidos por uma barra central (a
    "lápide" propriamente dita), pata começou como uma almofada com 4
    dedos sobre um plinto do mesmo tamanho de texto da clássica.
    `supabase/012_lapide_pata.sql` atualiza a constraint de `formato` pros
    3 valores válidos (`not valid`, não reavalia homenagens de teste já
    criadas com os formatos antigos — elas voltam a renderizar como
    clássica, sem quebrar). **Rodar 011 e 012 no Supabase antes do
    deploy.**
    Lição: quando o usuário tem (ou pode desenhar) uma referência visual
    concreta, buscar isso primeiro em vez de adivinhar a partir de uma
    descrição em palavras — economiza pelo menos uma rodada inteira de
    retrabalho.
    Dois ajustes vieram logo depois, já em produção: (1) os nós do
    ossinho e os dedos/coxim da pata eram esferas lisas com material
    muito polido — liam como bolinhas de vidro/globo de música em vez de
    nós de pedra; trocados por icosaedros facetados (mesmo estilo das
    pedrinhas/folhagens do resto do jogo) com material menos brilhante,
    e a pata ficou ~30% maior. (2) A pata foi redesenhada de novo, dessa
    vez a partir de uma foto real de pedra-pata de jardim que o usuário
    enviou: em vez de "em pé" sobre um plinto retangular, virou uma
    pedra de caminho baixa e fundida, deitada direto na grama, sem
    plinto — mas com uma leve inclinação (não 100% flat), porque uma
    placa totalmente horizontal some quase invisível no ângulo raso
    (~20–28°) da câmera de 3ª pessoa padrão do jogo; essa inclinação é o
    equilíbrio entre "parecer deitada" e continuar legível andando por
    perto (o hover do mouse sempre mostra nome/foto/mensagem no card 2D
    de qualquer forma, então a leitura nunca depende só do ângulo 3D).
18. ✅ **Mapa 2D do jardim** — visão de cima pra se orientar e achar uma
    lápide específica sem precisar andar pelo mapa 3D até topar com ela.
    Botão novo (`🗺️`, terceiro círculo empilhado sobre os de visão/planta)
    e atalho `M` abrem um modal (`js/mapa.js`) com um `<svg>` desenhado a
    partir dos dados reais — nada de posição fica fixa no código do mapa:
    o retângulo do terreno usa o `bounds` do jogo, a praça usa
    `world.PLAZA`, os rótulos de seção ficam na média de posição dos
    `plots` de cada seção, e cada vaga vira um círculo (colorido com a
    `cor` escolhida na etapa 17 se ocupada, tracejado se livre) — tudo lido
    de `lapides.plots` toda vez que o mapa abre. Escolha consciente: se o
    jardim ganhar mais seções/vagas depois, o mapa já desenha tudo sozinho
    na próxima abertura, sem precisar editar `js/mapa.js`. Um marcador
    extra mostra onde o cachorro está e pra onde está olhando no momento
    em que o mapa abre (não acompanha o passeio ao vivo, é só uma
    referência) — começou como bolinha, virou seta (`<polygon>` rotacionado
    pelo `rotation.y` do cachorro) depois que o usuário pediu pra dar pra
    saber a direção também, não só a posição. Busca por nome
    (acento/caixa não importam) filtra em tempo real: esmaece no mapa quem
    não bate e lista quem bate (nome + seção) abaixo, clicável pra
    realçar o marcador — decisão do usuário foi **não teleportar** o
    cachorro ao clicar num resultado, só destacar (mapa de verdade, não
    atalho mágico), o que também poupou mexer em `js/cachorros.js`. Segue
    a mesma cadeia de fechar dos outros modais (Esc, clique fora, botão
    "Fechar"). Testado com Playwright: abrir pelos dois jeitos, buscar
    nome existente e inexistente, fechar pelos três jeitos — sem erros no
    console.
    Bug pego logo depois pelo usuário: o cachorro continuava andando por
    trás do modal enquanto o mapa estava aberto (`updateMovement` só era
    pulado quando `pausedState.value` — o menu de pausa — estava ligado,
    e abrir o mapa não mexe nisso). Corrigido com um `mapaUi.isOpen()`
    novo, checado junto com `pausedState.value` no loop principal
    (`js/main.js`); confirmado com Playwright lendo a posição real do
    cachorro (`window.__dbgDog`, hack temporário só pra esse teste,
    removido depois): 0 de deslocamento segurando `W` com o mapa aberto,
    volta a andar normal assim que fecha.
    Pedido seguinte do usuário: mapa "mais ilustrado", com as cores de
    verdade do chão, pra ficar mais fácil de se localizar em vez de um
    esquema abstrato cinza. Trocado: fundo verde-grama (mesma cor de
    `groundMat` em `mundo.js`), as quatro avenidas de areia desenhadas na
    posição/tamanho exatos das avenidas 3D (novo `world.AVENUES`,
    exportado de `mundo.js` só como metadado de posição — a malha 3D em
    si nem foi tocada, pra não arriscar mudar o visual do jogo de
    verdade), praça no tom bege da pedra da praça com um círculo ciano no
    centro representando a fonte, e um contorno escuro (`paint-order`)
    nos rótulos de seção pra continuarem legíveis em cima da grama.

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
