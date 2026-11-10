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
    Segundo bug pego pelo usuário, na seta de direção: "às vezes estou
    com o cachorro olhando para um lado e a seta tá pro oposto". Causa:
    o `rotation.y` do three.js, visto de cima com x-direita/z-baixo (o
    plano do mapa), gira anti-horário, mas o `rotate()` do SVG gira
    horário — o ângulo precisava ser negado. O erro é um espelhamento
    leste↔oeste, invisível olhando pro norte ou pro sul (0° e 180° são
    simétricos), e o teste original só tinha conferido o spawn (yaw
    180°) — por isso passou. Corrigido negando o ângulo e testado com o
    cachorro virado pro oeste: seta pro oeste no mapa.
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
19. ✅ **Mundo sem pontas** — pedido do usuário: "tudo pontiagudo remete a
    algo do mau", deixar as formas mais amigáveis e, quando possível, mais
    parecidas com a realidade. Sem referência visual dessa vez (decisão
    explícita dele: proponho eu e ele ajusta em cima de screenshots).
    Inventário mostrou que o grosso das pontas era: (1) os ~26 pinheiros de
    3 cones empilhados (≈78 cones, principalmente ladeando as avenidas);
    (2) os tufos de grama de lâminas-cone espalhados pelo gramado; (3) as
    orelhinhas em cone da estátua de cachorro da fonte. Tudo em
    `js/mundo.js`: pinheiro virou cipreste/tuia de alameda (3 icosaedros
    achatados empilhados afunilando pra cima, topo redondo — silhueta real
    de árvore de alameda de jardim, mesmos verdes e mesma chave
    `type='pine'`, nenhum call site mudou); tufo virou moitinha de 2–3
    gomos redondos baixos; orelhas da estátua viraram gotas (esferas
    achatadas). Bônus: mourões da cerca e do portão ganharam remate de
    bolinha no topo (cerca de jardim de verdade), tirando o ar de "estaca
    cortada". Ficaram intocados de propósito: orelhas do Pastor Alemão
    (pontudas é realismo da raça), caixas de marcenaria (bancos/vigas têm
    canto mesmo) e as lápides (acabadas de refazer com referência na etapa
    17). Verificado com screenshots Playwright em 3 pontos do jardim, sem
    erros de console.

20. ✅ **Vida ambiente** — decisão de direção de arte tomada em conversa:
    em vez de trocar o estilo gráfico (low-poly flat-shaded é um ativo pro
    produto — leve no celular, sem pipeline de assets, e a estilização dá
    a distância afetiva certa pra um memorial), investir em *polimento
    dentro do estilo*, começando pelo item de maior impacto: movimento
    sutil que faz o mundo parecer vivo. Três sistemas, todos em
    `js/mundo.js`, pendurados no `update()` que já existia: (1) **vento**
    — toda árvore balança de leve na base (fase/amplitude próprias) e as
    flores ondulam com fase derivada da posição, como uma rajada
    atravessando o gramado; uma "rajada global" lenta modula tudo junto.
    (2) **Pétalas** — 7 por cerejeira caem rodopiando com deriva, deitam
    no chão por uns segundos desbotando e renascem na copa. (3)
    **Passarinhos** — dois sabiás-laranjeira (cores reais da ave) com
    máquina de estados away→flyin→perched→flyout: voam de fora até o topo
    de um mourão da cerca (pontos de pouso coletados na própria
    construção da cerca), ficam balançando/virando a cabeça, vão embora.
    Custo de desempenho medido: zero (14fps headless antes e depois — o
    gargalo é a renderização por software do teste, não o update).
    Armadilha de teste descoberta: com `dt` limitado a 0.05s/frame, o
    headless a ~14fps roda o tempo do jogo ~30% mais devagar que o
    relógio — timers de teste precisam de folga. Verificado com câmera
    livre de debug (hook temporário, removido antes do commit):
    screenshot do sabiá pousado no mourão e 17/28 pétalas caindo num
    dado instante.

21. ✅ **Canteiros e tons na grama** — segundo item do backlog de polimento
    da direção de arte (etapa 20 foi o primeiro). Duas mudanças, ambas em
    `js/mundo.js`. (1) **Manchas de tom no gramado**: a textura de grama
    repete a cada ~8 unidades e não consegue variar em escala de jardim,
    então o plano do chão ganhou cores por vértice — ruído suave em duas
    frequências alternando trechos secos/amarelados com trechos de verde
    mais fundo. Precisou de calibração com screenshots: a primeira
    amplitude (±11%) ficou invisível (o produto de senos passa tempo
    demais perto de zero e o ACES tonemapping achata o resto); resolvido
    amplificando o ruído (×1.5 com clamp) e, no lado "úmido", escurecendo
    o verde em vez de puxar pro azul (azul a mais lia como cinza-lavado).
    (2) **Canteiros ladeando as avenidas**: faixa de terra escura rente à
    borda dos caminhos com flores plantadas em blocos de cor (como
    canteiro de verdade, não mistura aleatória — cor sorteada dura 3–5
    flores seguidas, sem repetir a anterior). Vãos calculados pra deixar
    livres as entradas dos arcos das seções (|z|≈10.3–13.7 nas avenidas
    norte-sul) e a frente dos bancos. As ~200 flores dos canteiros são
    `InstancedMesh` (3 draw calls no total: caules, botões com cor por
    instância, miolos) — importa no celular; por isso também ficam fora
    do balanço de vento do `flowerGroup` (matriz estática), o que não
    aparece numa massa densa de cor. Verificado com Playwright (avenida,
    quadrante aberto, visão de jogo na praça), sem erros de console.
    Retrabalho logo após o deploy: o usuário achou que a faixa rasa de
    terra "parecia tábua de madeira" e pediu algo mais de vaso — virou
    fileira de jardineiras de terracota (mesmo barro dos vasos da praça),
    caixas elevadas com borda saliente e terra escura dentro, vãos curtos
    entre uma e outra, flores plantadas por cima e mais densas (as caixas
    também são `InstancedMesh`; total 6 draw calls).
    Restam do backlog: golden-hour mais forte e sol maior com halo +
    pássaros distantes.

22. ✅ **Relógio do jardim** — o golden hour deixou de ser permanente e
    virou um momento de verdade: o jardim segue a hora local de quem
    visita. Três presets em `js/mundo.js` (bloco "RELÓGIO DO JARDIM"),
    interpolados suavemente e reavaliados a cada minuto: **dia** (céu
    azul fresco, sol alto, sombras curtas), **golden hour** (~16h30–19h:
    sol baixo, grande e com halo — o que já cobre parte do item "sol
    maior" do backlog —, sombras compridas atravessando as avenidas, tudo
    âmbar) e **noite** (19h45–5h30). Decisão do usuário na conversa: a
    opção "relógio de verdade" ganhou do ciclo acelerado (luz mudando o
    tempo todo atrapalha o ar contemplativo) e do horário fixo; e a noite
    tinha que ser **acolhedora, não melancólica** — ficou azul-arroxeada
    com resto de calor no horizonte, lua + estrelas, luar suficiente pra
    ler as cores, e os pontos quentes finalmente brilhando: cabeças das
    lâmpadas com emissivo alto + sprite de halo (mesmo truque barato do
    brilho das velas — nada de point light de verdade, que custaria caro
    no celular) e halo das velas ~50% maior à noite. Céu virou canvas
    repintável (mesmas 5 paradas de degradê, só as cores mudam); nuvens
    tingem junto (branco → rosado → azul-escuro). Calibração via
    screenshots: a 1ª noite ficou com o chão claro demais ("dia nublado
    com céu de noite colado") — baixadas hemi/luar/fill até a penumbra
    certa. `world.setHora(h)` força uma hora (usado nos testes; reservado
    pro futuro botão "ver ao entardecer", já que quem só visita de manhã
    nunca veria o golden hour — aceito por enquanto). Resta do backlog:
    silhuetas de pássaros distantes.

23. ✅ **Gráficos novos** — o
    usuário quis ver até onde o 3D podia chegar, reclamando que antes "parecia
    geometria e pouca realidade". Isso **revê a decisão da etapa 20** (manter o
    low-poly facetado): saiu o facetado, mas ficaram as razões daquela decisão —
    continua estilizado (nada de fotorrealismo, a distância afetiva segue certa pra
    um memorial), continua sem nenhum arquivo de modelo ou textura (tudo gerado em
    código), e o celular tem perfil próprio. Todo o desenho do jardim, as posições,
    o banco e a jogabilidade continuam iguais; só mudou como as coisas são feitas.
    Motor: three r128 (CDN) → r187 (npm). Código em `js/gfx/`:
    - `pos.js`: cena em HDR com MSAA → sombra de contato (GTAO em meia resolução) →
      brilho → acabamento. Só objetos sólidos entram na sombra de contato: passar
      grama e folhagem por ela vira mancha.
    - `ceu.js`: domo de verdade com nuvens em shader, e o sol visível agora é o
      mesmo que projeta sombra (antes ficavam em direções diferentes). O próprio céu
      vira a luz ambiente da cena.
    - `chao.js`: "máscara" assada que diz onde é caminho, onde nasce grama e onde há
      sombra de contato; chão e grama leem a mesma. Grama em dois anéis em volta da
      câmera (perto, detalhada; longe, simples), custo fixo, dobra com o vento e
      abre caminho pro cachorro.
    - `caes.js` + `sdf.js`: cachorros esculpidos por campo de distância (superfície
      contínua) com pelo em cascas. Piscam, olham em volta, respiram, abanam o rabo,
      põem a língua pra fora. Olho e boca são projetados na superfície da cabeça.
    - `arvores.js`: copas de centenas de tufos sempre virados pra câmera, com a normal
      vinda do volume: a copa se ilumina como forma redonda e fofa. Mata fora da
      cerca pra dar profundidade.
    - `flores.js`, `mobilia.js`, `fonte.js`, `vida.js`, `materiais.js`: pétalas de
      ponta redonda, bancos de ferro e ripas, água em shader, vaga-lumes à noite,
      pedra com grão e musgo sem precisar de UV.
    - `qualidade.js`: perfis alto/médio/baixo (`?qualidade=`) e um governador que
      mede os quadros e vai desligando efeitos se o aparelho não dá conta
      (`?governador=0` desliga, pra medir). Teto de pixels em vez de DPR fixo.
    Também: o menu agora mostra o jardim de verdade atrás do cartão, com a luz da
    hora; a câmera entra atrás do cachorro olhando pra fonte (antes entrava de frente
    pro portão); os letreiros dos jardins se leem dos dois lados; a entrada `js/main.js`
    ficou mínima pra pintar o "preparando o jardim…" antes de montar tudo (`js/jogo.js`).
    Formas redesenhadas respeitando as decisões antigas: nada pontiagudo (grama,
    pétalas e pelo têm ponta redonda), cor só como detalhe no ossinho e na pata, noite
    acolhedora. O ossinho virou formato de biscoito, com entalhe nas duas pontas: a
    1ª versão, com lóbulos redondos num cabo fino, tinha leitura infeliz.
    Medido (M5): 50–58 fps no alto em tela Retina, 60 no médio; 23 mil → 2 milhões de
    triângulos no alto, 590 mil no baixo. JS: 268 KB gzip já com o three dentro. Em
    renderização por software (pior caso, nenhum aparelho real é tão lento) caiu de 10
    pra 3 fps, com o governador até o último degrau.
    Testado pelo usuário no celular de verdade antes de ir pro ar (preview da Vercel,
    que exige login): aprovado. Regressão com interação real (41 verificações)
    passou; o roteiro não está no repo.
    Armadilhas da medição: (1) o governador liga sozinho e melhora o FPS no meio do
    teste — a primeira análise culpou o pelo por causa disso, e era falso; (2) FPS com
    vsync desligado não mede a GPU: usar render + `readPixels`; (3) `npm install` apaga
    o Playwright, que fica em node_modules sem estar no package.json.
    Colorimetria: o r128 não convertia as cores de sRGB; isso provavelmente explica boa
    parte do ar "lavado" que aparecia nas reclamações das etapas 17 e 21.

25. ✅ **Estátuas de raça** (a 24 é o app de iPhone, na `app-ios`) — pergunta do usuário: com os gráficos novos, dá pra ter lápide em
    forma de raça? Três formatos novos, um por raça do menu: Golden, Pastor e
    Dachshund. Cada um é o próprio cachorro do passeio talhado em mármore sobre um
    pedestal de granito com a homenagem gravada na frente (`js/gfx/estatuas.js`).
    Tronco, cabeça e orelhas são os campos da escultura de `caes.js`, que passou a
    exportar `receita`; só patas e rabo são refeitos para a pose. Golden e pastor
    sentados, de três quartos, num pedestal quase quadrado; dachshund deitado, de
    perfil, num pedestal comprido — escolha do usuário depois de ver as duas poses
    (sentado, o dachshund precisaria de pernas da frente esticadas como palitos).
    Cabeça sempre virada para quem chega. A cor escolhida vira a coleira, com
    medalha dourada (a regra da etapa 17: cor só como detalhe).
    O que custou rodadas: (1) mármore branco cheio estourava no sol e sumia o
    rosto — um tom abaixo do do ossinho; (2) de perfil, o pastor branco parecia
    estátua de Anúbis, resolvido virando a cabeça; (3) o golden virou ursinho:
    passar o mapa de pelo inteiro para a pedra inchava o crânio e o vazio de pelo
    em volta dos olhos virava óculos, e a raiz da orelha caída, no alto do crânio,
    virava orelha de urso. Ficou: pelo como volume só no corpo, orelha mais baixa,
    cabeça 10% maior, focinho 18% mais longo e mechas talhadas no peito e na barriga
    (onda regular parecia sanfona; no rabo, pinha); (4) a coleira do dachshund se
    enrolava nas orelhas — o anel procura o pescoço só no tronco e na cabeça.
    Placa: acima de 1,5 de largura por altura, a foto vai à esquerda e o texto à
    direita, e a mensagem encolhe até caber inteira em 3 linhas.
    Custo: 0,2 a 0,6 s por raça no M5 (perfil alto), uma vez por sessão e só quando
    existe homenagem dela — uma grade grossa pula o espaço vazio.
    Testado só por fotos no Playwright com homenagens falsas (`page.route`) e câmera
    livre injetada na resposta do `jogo.js`. **Rodar `supabase/014_lapide_estatua.sql`
    no Supabase antes do deploy** e testar no celular.

26. ✅ **Link de cada homenagem** — no Brasil o WhatsApp é
    o canal de distribuição inteiro, e não havia como mandar uma homenagem para
    alguém. Agora cada uma tem endereço próprio, `jardim-memorial.vercel.app/thor`.
    - **Endereço**: o banco escolhe na criação, a partir do nome, sem acento
      ("Pé de Pano" → `pe-de-pano`); o segundo Thor vira `thor-2`; palavras que são
      caminhos do site ficam de fora; depois de preenchido, um gatilho impede a troca
      (link que já circulou não quebra). `supabase/015_link_homenagem.sql`, que
      também preenche as homenagens antigas, na ordem de criação.
    - **Prévia no WhatsApp**: o robô dele não roda JavaScript, então `vercel.json`
      separa pelo user-agent — robôs de prévia (WhatsApp, iMessage/Facebook,
      Telegram…) vão para `api/homenagem.js`, que devolve só as etiquetas og:*;
      gente recebe o jogo. A imagem é um cartão 1200×630 (foto redonda, nome,
      datas, jardim desfocado ao fundo) gerado no navegador de quem cria
      (`js/cartao.js`) e enviado junto com a homenagem: 40–60 KB, longe do limite
      de 600 KB da Meta. Tudo centralizado porque às vezes o WhatsApp mostra só um
      quadrado do meio. Sem cartão (homenagens antigas), vai `public/og-jardim.jpg`.
    - **Chegada**: `js/chegada.js` busca a homenagem no primeiro instante (fetch
      simples, antes do pedaço pesado do jogo) e o menu já abre com o cartão dela
      e o botão em "preparando o jardim…". Descoberta no caminho: o menu sempre
      cobriu a tela de carregamento (z-index), então o "preparando o jardim…" com a
      patinha nunca aparecia. Em "Visitar", o cachorro começa na beira da praça,
      do lado do jardim da homenagem, e anda sozinho (`caminharPor` em
      `cachorros.js`): avenida, arco, corredor do meio do jardim (|x| = 12, entre
      as colunas de vagas) e para de frente para a pedra; aí abre o livro de
      mensagens. Qualquer tecla ou toque no joystick devolve o controle. Estátua de
      raça → a visita é com um cachorro da mesma raça; senão, a última raça
      escolhida (guardada no navegador).
    - **Câmera na chegada**: atrás do cachorro, na fileira de fora, ficava dentro
      das árvores grandes de sombra; na de dentro, um cipreste tapava. O mundo
      passou a expor as copas (`world.copas`) e a chegada testa alguns ângulos,
      olhando o ponto da câmera e a linha até o cachorro. Conferido nas 16 vagas.
    - **Compartilhar**: botão no livro de mensagens da pedra e janela automática
      logo depois de gravar uma homenagem: "Enviar pelo WhatsApp" (wa.me, com o
      link no fim da mensagem, que é de onde sai a prévia), "Copiar link" e, no
      celular, "Outros apps" (folha de compartilhar do sistema).
    Testado com Playwright e homenagens falsas (computador e iPhone 14): cartão no
    menu em 0,6 s, caminhada, chegada, compartilhar e os dois cartões. A função foi
    testada sozinha e no `vercel dev`, que **ignora a condição por user-agent**
    ("has") — a separação robô/pessoa só se confirma no ar. Preview de branch
    exige login na Vercel, e o robô do WhatsApp para nele. **Rodar
    `supabase/015_link_homenagem.sql` antes do deploy**: sem a coluna `slug`, gravar
    homenagem falha.

27. ✅ **Vira-lata caramelo** — pedido do usuário: o cachorro
    mais comum do Brasil não estava entre as raças. Entrou nos dois lugares: como
    quarta raça do passeio (cartão "Vira-lata Caramelo" no menu, que passou a uma
    grade 2×2 também no celular, onde 4 cartões em coluna passariam da tela) e
    como estátua (`estatua-caramelo`). A estátua nasceu sentada, como golden e
    pastor, e o usuário pediu deitada, como o dachshund: sentado e de orelha em
    pé, ao lado do pastor, os dois pareciam a mesma estátua.
    O que faz ele ser caramelo e não um golden de outra cor: magro, de peito
    fundo e barriga recolhida; pelo curto (`comprimento` 0,018, o menor depois do
    dachshund); peito, garganta, beiço e barriga creme e "meias" claras nas
    patas; ponta do focinho escura; orelha em pé com a ponta dobrada para a frente
    e rabo em foice por cima do dorso, com a pontinha clara. A orelha é feita de
    duas metades, cada uma achatada no próprio plano (`achatarDir` em `caes.js`):
    achatada inteira, a dobra encolhia junto. Na pedra, a pose deitada e a orelha
    dobrada separam o caramelo do pastor (sentado, orelha em pé).
    Rodadas: (1) a máscara só na ponta do focinho virava um anel marrom em volta
    do nariz — passou a vir de longe, bem mais fraca; (2) na luz do jardim o
    caramelo do estúdio ficou ferrugem, quase setter irlandês — clareado e com
    menos dorso tostado.
    Testado com Playwright num estúdio (cachorro e estátua, ao lado das outras
    raças) e no jogo com homenagens falsas: menu no computador e no iPhone 14,
    passeio, e a chegada pelo link de uma estátua caramelo, em que a visita sai
    com um cachorro caramelo. **Rodar `supabase/016_lapide_caramelo.sql` no
    Supabase antes do deploy**: sem ele o banco recusa a estátua nova.
    Quem estiver com o jardim aberto na versão antiga vê um caramelo de outra
    pessoa como dachshund (a receita cai na última raça) até recarregar.

28. ✅ **Menu e ajuda no celular** — primeiro item da lista de
    melhorias de experiência: no celular, depois de entrar no jardim, não havia como
    voltar ao menu (o caminho era o ESC), e o "Como jogar" falava de WASD, touchpad,
    mouse e ESC. Veio da branch `app-ios`, sem o código de moderação e de conta, que
    depende do 013:
    - **Botão ☰** no topo da coluna de botões redondos (🗺️ 🌼 🐾), só em tela de
      toque: pausa e abre o menu, como o ESC. Usa o estilo do botão do mapa.
    - **"Como jogar" de toque**: cada regra tem a versão de teclado (`so-teclado`) e a
      de toque (`so-toque`), trocadas pelo CSS em `pointer:coarse`. Na `app-ios`, o
      `.so-toque{display:none}` perdia para o `.menu-panel .rule{display:flex}`, mais
      específico, e o computador mostraria as duas versões; aqui o seletor repete
      `.menu-panel .rule`. Entrou uma regra nova nas duas versões, do mapa e da troca
      de câmera (M e V no teclado, 🗺️ e 🐾 no toque), e as vagas vazias deixaram de
      ser "círculos verdes", que não existem desde a etapa 23: são o círculo de
      pedrinhas com uma patinha. A linha "aperte ESC para voltar aqui" some no toque.
    - **Menu que rola**: com as regras novas, o "Como jogar" passou da altura do
      iPhone 14 e cortava o título e o "Voltar", porque o `align-items:center`
      centraliza mesmo sem espaço. A tela do menu rola, e o cartão se centraliza com
      `margin:auto`, que não corta o topo. Vale também no computador com janela baixa.
    Testado com Playwright no computador e no iPhone 14: regras visíveis em cada um
    (7 de teclado, 7 de toque), ☰ ausente no computador, ☰ → menu → "Entrar no
    jardim" de volta ao passeio.

29. ✅ **Dicas na primeira entrada e "Fazer login"** — itens 6 e
    7 da lista de melhorias de experiência.
    - **Dicas**: no celular os botões redondos são só ícones (☰ 🗺️ 🌼 🐾). Na primeira
      vez que a pessoa entra no jardim por toque, cada um ganha uma etiqueta ao lado
      ("Menu", "Mapa do jardim", "Flor ou vela", "Visão do cachorro"), o círculo de
      andar ganha "Arraste para andar" e o meio da tela "Arraste a tela para olhar em
      volta". Somem no primeiro toque depois de 1,5 s (o toque que acabou de entrar
      não pode apagá-las antes de dar tempo de ler) ou sozinhas em 9 s, e não voltam
      neste aparelho (`jardimDicasToque` no localStorage). Não pegam toque: o dedo
      passa direto para o jogo. No computador não aparecem, porque lá a faixa de
      teclas no canto já explica tudo. As posições seguem as dos botões no
      `pointer:coarse` (fundo 22/78/134/190): mudar um sem o outro desalinha.
    - **"Fazer login"**: o botão do login se chamava "Entrar", como o "Entrar no
      jardim" do menu. Virou "Fazer login", e o título da janela também; o botão de
      confirmar continua "Entrar".
    Testado com Playwright no iPhone 14: dicas na entrada, somem com um toque, não
    voltam depois de recarregar; no computador, nenhuma dica.

30. 🔜 **Só login com Google, por enquanto** (branch `so-google`) — o item seguinte da
    lista era pôr um e-mail de verdade no Supabase (o servidor de teste dele trava
    depois de poucos envios, e por isso a confirmação de e-mail está desligada). Sem
    e-mail, quem entra com e-mail e senha não recupera a senha, e qualquer um cria
    conta com o e-mail de outra pessoa. Decisão do usuário: por enquanto só Google;
    domínio próprio (com Resend) ou um Gmail do jardim vêm depois, quando for
    divulgar. Em 2026-11-09 havia 5 contas, todas de teste: a do administrador tem
    e-mail **e** Google ligados (a regra do 008 olha o e-mail do token, que é o
    mesmo), então o admin segue funcionando; uma conta só de e-mail criou 1
    homenagem, que continua no jardim.
    A janela de login mostra só "Continuar com Google". A parte de e-mail e senha
    ficou no código, desligada por `LOGIN_COM_EMAIL` em `js/menuUi.js` (classe
    `login-email` no HTML). Para religar: `true`, ligar a confirmação de e-mail no
    Supabase e trazer o "Esqueci minha senha" da `app-ios`.
    Com o ok do usuário, o provedor Email também foi desligado no painel do
    Supabase (conferido em `/auth/v1/settings`: email falso, google verdadeiro,
    cadastro aberto). O "Confirm email" do Supabase aparece ligado, ao contrário da
    nota antiga abaixo: ao religar o e-mail, o SMTP é obrigatório.

31. ✅ **Mapa de tesouro** — começo de "Fazer uma homenagem"
    + guardar a vaga antes do login. O usuário pediu que a vaga fosse escolhida num
    mapa "em forma de desenho, como aqueles mapas de tesouro", com prévia de quem
    está lá, e pensou em separar mundo 2D e 3D para quem prefere algo rápido. Ficou
    decidido **um jardim só, com duas portas** (dois mundos fariam cada coisa duas
    vezes): o mapa ilustrado é a porta rápida e o 3D, o passeio. Três decisões dele:
    (1) o site vai abrir no mapa, com "Passear no jardim" como botão grande; (2) do
    mapa dá para ver, acender vela, deixar mensagem e criar homenagem, e andar e
    plantar flor ficam no 3D — o que reverte o "mapa de verdade, não atalho mágico"
    da etapa 18; (3) chão e caminhos por código, enfeites como desenho. Antes de
    programar, um esboço interativo numa página privada; ele aprovou o visual.
    **Primeira parte (esta):** o mapa do botão 🗺️ virou o mapa de tesouro
    (`js/mapa.js` reescrito): papel com borda rasgada, traço de tinta à mão e
    aquarela (filtros SVG de turbulência), árvores em volta da cerca, fonte,
    jardineiras, arcos de entrada, os campos em faixas de pergaminho, rosa dos
    ventos, legenda com a contagem de homenagens e vagas, rastro de patinhas da
    entrada até a praça e a seta de "você". Cada homenagem é um medalhão com a foto
    (ou a inicial) e o aro na cor escolhida; vaga livre é um círculo tracejado com
    patinha. Tocar abre uma ficha de pergaminho: na homenagem, "Visitar no jardim"
    (o cachorro sai de onde está, contorna a fonte pela beira da praça, entra pelo
    arco do campo e pelo corredor do meio até a frente da pedra, e o livro de
    mensagens abre) e "Mensagens"; na vaga livre, "Fazer uma homenagem aqui", que
    abre o formulário (ou o login). A busca por nome ficou: esmaece quem não bate.
    As vagas são desenhadas **maiores que no 3D** (colunas em 9,5 e 19 em vez de 9
    e 15), como nos mapas ilustrados de parque: no tamanho real o medalhão não
    caberia num toque de celular. `paraMapa()` estica as distâncias por trechos, e a
    seta do cachorro passa pela mesma conta. Nos campos do norte o nome vai acima
    do medalhão e nos do sul abaixo, para a faixa caber junto da avenida leste-oeste.
    Fontes novas: IM Fell English SC (títulos do mapa) e Caveat (letra à mão).
    Falta: guardar a vaga na volta do Google, vela e mensagem direto da ficha (pede
    ligar a vela a uma homenagem no banco, o item 8 da lista) e abrir o site no mapa.
    Testado com Playwright no computador e no iPhone 14, com homenagens falsas (uma
    com foto): mapa, ficha, busca (15 apagadas, 1 achada), visita da entrada sul até
    a estátua com o livro de mensagens aberto, vaga livre abrindo o login. Na
    primeira versão a visita atravessava a fonte e não chegava em 16 s.

32. ✅ **Gatos** — pedido do usuário: as três raças de gato mais
    comuns, sem a "respiração de cachorro" na 1ª pessoa e com andar de gato.
    Entraram **Siamês, Persa e Maine Coon** como companheiros do passeio (menu
    separado em Cachorros e Gatos; com três gatos, o último cartão ocupa a linha
    inteira). Os gatos moram em `js/gfx/gatos.js`: um molde só (`montarGato`) com
    proporções por raça — o siamês esguio, de cabeça em cunha, orelhas grandes e
    pontas escuras; o persa atarracado, de cara achatada, orelha pequena e pelo
    longo; o maine coon grande (×1,16), tigrado, com peito branco e tufos na ponta
    das orelhas. A montagem e a animação são as de `caes.js`, que reconhece
    `especie: 'gato'`: olhos coloridos com **pupila em fenda**, nariz na cor da
    raça, **bigodes**, boca fina e nenhuma língua de fora.
    - **Andar de gato**: as quatro patas uma de cada vez, na ordem traseira
      esquerda, dianteira esquerda, traseira direita, dianteira direita (o cachorro
      trota, com as patas em diagonal aos pares); o corpo quase não quica, a cabeça
      fica firme, o quadril rola de leve, o rabo erguido balança devagar, a piscada
      é lenta e a orelha dá uma torcidinha de vez em quando. Anda a 82% da
      velocidade do cachorro. Conferido em quatro quadros do ciclo, de lado.
    - **1ª pessoa**: a câmera do cachorro balançava quase 3 vezes por segundo até
      parado (é a "respiração" que o usuário viu); a do gato fica parada quando ele
      está parado e, andando, tem um embalo baixo preso ao próprio passo.
    - **Câmera de 3ª pessoa**: mais perto (72%) e mais baixa para gato, senão ele
      sumia na tela.
    - **Estátua**: um tipo só, "Gato" (`estatua-gato`), a pedido do usuário: em
      mármore, sem a cor, as raças de gato não se distinguem. Sai do siamês,
      sentado, ereto, de cabeça redonda quase sem focinho (de perfil, o focinho do
      siamês na pedra lembrava raposa, e de longe a estátua se confundia com a do
      pastor) e rabo enrolado nas patas. Como o gato tem metade do tamanho do
      cachorro, a grade da escultura é mais fina (`celula: 0.55`) — com a mesma,
      a ponta da orelha furava — e a coleira fica baixa, senão cortava o rosto.
      Visita pelo link a uma estátua de gato: com o gato que a pessoa escolheu, se
      for gato; senão, um siamês.
      Depois de publicada, o usuário viu um "pescoço corcunda" na estátua. Eram
      três coisas somadas: o corpo inclinado demais para sentar (0,95, mais que nos
      cachorros; voltou a 0,78), o pescoço próprio da cabeça somado ao do corpo (a
      estátua usa agora `cabecaEstatua`, a cabeça sem o pescoço) e a ponta do
      pescoço do corpo, já inclinado, saindo atrás do crânio (a cabeça recua 6 cm e
      sobe pouco mais de 1 cm, opções `recua`/`sobe` da pose). **Rodar `supabase/017_lapide_gato.sql` no
      Supabase antes do deploy.**
    - Textos: "Escolher cachorro" virou "Escolher companheiro", e o "Como jogar" e
      as dicas da primeira entrada deixaram de falar só de cachorro.
    Testado no estúdio (as três raças ao lado do caramelo, de perto e o andar) e no
    jogo com Playwright: menu no computador e no iPhone 14, persa andando, visita
    pelo link a uma estátua de gato com o maine coon escolhido. Quem estiver com a
    versão antiga aberta vê o gato de outra pessoa como dachshund até recarregar.

33. ✅ **Vaga guardada no login com Google** — segunda parte
    do mapa de tesouro. O login com Google sai do site e volta recarregando a
    página: quem tocava em "Fazer uma homenagem aqui" caía de volta no menu e tinha
    de escolher o companheiro, andar até a vaga e tocar nela de novo. Agora, ao
    tocar em "Continuar com Google" a partir de uma vaga, o navegador guarda a vaga
    e o companheiro (`jardimVagaPendente`); na volta, já logada, a pessoa entra no
    jardim parada na frente da vaga, com o formulário aberto. Se a vaga foi ocupada
    nesse meio-tempo, um aviso e o mapa aberto para escolher outra.
    Para não levar ninguém a uma vaga velha: só retoma quando a página é a volta do
    login (`voltouDoLogin` em `chegada.js`, que lê o `#access_token` do endereço
    antes de o Supabase apagá-lo), com até 20 minutos; quem desistiu no Google ou
    abriu o site de outro jeito tem a vaga esquecida. O "Fazer login" do topo não
    guarda vaga nenhuma.
    Testado com Playwright, com a volta do Google simulada (sessão falsa no
    endereço e `/auth/v1/user` respondido pelo teste): a vaga é guardada antes de
    sair, a volta abre o formulário, a vaga ocupada abre o mapa, e o site aberto
    sem voltar do login não faz nada. A volta de verdade do Google só se confirma
    no ar.

34. ✅ **Vela numa homenagem** — terceira parte do mapa de
    tesouro, e o item 8 da lista de melhorias: até aqui a vela era só um ponto no
    chão e não pertencia a cachorro nenhum. A tabela `velas` ganhou `memorial_id`
    (`supabase/018_vela_na_homenagem.sql`, que apaga as velas junto com a
    homenagem). "Acender uma vela" está na ficha do mapa (botão grande, acende sem
    fechar o mapa) e no livro de mensagens (linha "🕯️ 2 velas acesas · Acender uma
    vela"). A vela nasce no jardim 3D na frente da pedra, entre ela e quem visita,
    numa fileira que vai enchendo do meio para os lados. O medalhão do mapa ganha
    uma velinha com o número de velas acesas, a ficha mostra "2 velas acesas · 5
    mensagens", e a legenda do mapa explica a velinha.
    - "Mensagens" na ficha abre o livro, e fechar o livro volta para o mapa, na
      mesma ficha.
    - Sem login, a vela pede login como a do chão; com o Google, a vela fica
      guardada (a mesma `jardimVagaPendente` da etapa 33, agora com `tipo`) e é
      acesa na volta, com o mapa aberto na ficha da homenagem.
    - Se o banco recusar a vela, ela sai do jardim e aparece um aviso (senão a
      contagem mentiria).
    - Velas plantadas no chão continuam sem dono. "Velas acesas" conta as que
      ainda não apagaram (cada vela queima de 8 a 10 dias).
    Testado com Playwright no computador e no iPhone 14, com o banco simulado: a
    vela vai para o banco com o `memorial_id`, a contagem passa de 1 para 2 no
    medalhão, na ficha e no livro, o livro volta ao mapa, e as duas velas aparecem
    na frente da estátua. Sem login, o login abre sobre o mapa e a vela fica
    guardada para a volta. **Rodar `supabase/018_vela_na_homenagem.sql` no
    Supabase antes do deploy**: sem a coluna, o banco recusa a vela da homenagem.

35. ✅ **O site abre no mapa** — última parte do mapa de
    tesouro e a primeira das três decisões do usuário: a primeira tela é o mapa
    ilustrado, com "Passear no jardim" como botão grande e "Menu" ao lado (o cartão
    de sempre: escolher companheiro, como jogar, sobre, som, por cima do mapa).
    Quem chega pelo link de uma homenagem continua vendo o cartão dela primeiro, e
    "Ver o jardim todo" leva ao mapa.
    - **Antes do 3D**: o mapa (`js/mapa.js`, SVG puro) não depende mais do jogo.
      As medidas do jardim (praça, avenidas, cerca, campos e vagas) foram para
      `js/planta.js`, usado pelo 3D e pelo mapa, e `main.js` desenha o mapa com
      uma leitura simples do banco (`buscarRest` em `chegada.js`: homenagens e
      velas acesas). Como no cartão do link, o jogo só começa a montar depois de o
      mapa ser pintado (ou 1,5 s, se o banco demorar). Medido no build de produção,
      dentro da página: mapa em 0,24 s, jardim pronto em 1,1 s.
    - **Fonte trocável**: quando o jogo fica pronto e as pedras e velas carregam,
      `usarJogo()` troca a fonte do mapa para as homenagens vivas do jardim sem
      fechar o mapa nem a ficha aberta. Até lá, a ficha já mostra tudo, mas os
      botões ficam desligados com "preparando o jardim…".
    - **Navegação**: "Passear no jardim" entra com o companheiro de sempre (o
      guardado no navegador) ou abre a escolha de companheiro. O ☰ e o ESC do
      passeio voltam ao mapa (antes voltavam ao cartão do menu); no cartão, "Mapa
      do jardim" volta ao mapa; ESC com o cartão aberto também. O 🗺️ do passeio
      abre o mesmo mapa no modo de sempre, com ×. Na primeira tela, o HUD do
      passeio sai de cena (`em-casa`), e o login e os avisos ficam acima do mapa.
    - Textos: "Entrar no jardim" virou "Passear no jardim", o ESC/☰ do "Como jogar"
      e das dicas "voltam ao mapa", e o "Sobre" fala de cães e gatos.
    Bug pego no teste: dentro da função que abre o mapa, um `const fonte` (a letra
    do título) escondia a fonte das homenagens, e a abertura dava erro em silêncio.
    Testado com Playwright no computador e no iPhone 14: mapa na primeira tela,
    ficha com velas e mensagens, Passear com e sem companheiro guardado, ESC/☰
    voltando ao mapa, Menu e ESC no Menu, chegada pelo link e o teste das velas da
    etapa 34 pelo caminho novo.

36. 🔜 **Editar a própria homenagem** (branch `editar-homenagem`) — item 4 da lista de
    melhorias. O banco já deixava o autor atualizar a linha (003); faltava a tela.
    Quem criou a homenagem vê "Editar" no livro de mensagens e "Editar esta
    homenagem" na ficha do mapa (o banco confere de novo). Abre o formulário de
    sempre, já preenchido (formato, cor, nome, datas, mensagem e a foto atual), com
    "Salvar alterações". Foto nova só se a pessoa escolher outra; o cartão da prévia
    no WhatsApp é refeito quando o nome, as datas ou a foto mudam. O link continua o
    mesmo (o gatilho do 015 prende o `slug`). A pedra é trocada na hora no jardim,
    e quem estiver com o jardim aberto também a vê mudar (evento UPDATE em tempo
    real; a própria edição, que volta pelo mesmo evento, não refaz a pedra).
    Sem migração no banco.
    Dois problemas da primeira tela (etapa 35) pegos no teste e corrigidos:
    - Criar, editar e mensagens fechavam o mapa antes de abrir; da primeira tela,
      ao terminar, a pessoa ficava num jardim pausado e sem botões. Agora só
      "Visitar no jardim" sai do mapa: o formulário, o livro de mensagens e o
      compartilhar abrem por cima dele (z-index 45), e o mapa se redesenha com a
      homenagem nova ou editada.
    - "Visitar no jardim" antes de escolher companheiro fechava o mapa e não fazia
      nada (não havia cachorro para caminhar). Agora entra com o companheiro
      guardado, ou um golden, e caminha até a pedra.
    Testado com Playwright no computador e no iPhone 14, com usuário e banco
    simulados: "Editar" só na homenagem própria, formulário preenchido, o banco
    recebe só as mudanças, a clássica vira estátua caramelo com coleira coral, o
    mapa continua aberto com a ficha nova, e o livro mostra "Editar" ao autor. Os
    testes das velas e da primeira tela continuam passando.

37. 🔜 **Jardim do Lago, protótipo em 3D** (branch `jardim-lago`) — etapa 1 da expansão
    em vários jardins ligados pela Ponte do Arco-Íris (esboço aprovado em 2026-11-09:
    três jardins, ponte com travessia no 3D, mapa-múndi como primeira tela). Só
    visual, sem banco: abre por `?jardim=lago`; sem o parâmetro o site é o Jardim
    Memorial de sempre (conferido pixel a pixel contra a `main`, relógio congelado e
    sorteio fixo: zero pixels de diferença em quatro vistas, de dia e de noite).
    - Mesmas regras, desenho próprio: `js/jardins/lago.js` guarda só medidas e contas
      do esboço (lago a oeste com margem irregular, prainha, deque, salgueiro, trilha a
      3,4 da margem, ramais para a Clareira do Alto e para a chegada da ponte, as 13
      vagas com o nome do lugar). `mundo.js` ganhou `desenhoDoMemorial()` (o código de
      antes, na mesma ordem de sorteio) e `desenhoDoLago()`.
    - Relevo: `definirRelevo()` em `gfx/chao.js` soma a bacia do lago e o morro da
      clareira à altura de sempre, e uma textura meio-float (altura + areia) leva isso
      à grama, ao chão e à água. O cachorro anda na altura do chão, para na beira
      d'água e na borda do jardim, sobe no deque e no morro; a câmera não entra no
      morro. As pedras olham para a trilha mais perto (`rot` na vaga).
    - Água em shader (`gfx/agua.js`): transparente no raso, verde-escura no fundo,
      espuma na margem, reflexo do céu e da mata da outra margem, rastro de sol no fim
      de tarde e o reflexo dos lampiões à noite. Nenúfares com flor, juncos e taboas
      balançando, deque de madeira.
    - Salgueiro, tipo novo de árvore: cartões altos pendurados com fios de folhinhas.
      No Lago, as copas se abrem perto da câmera e entre a câmera e o cachorro (a
      trilha passa por baixo do salgueiro e a tela ficava toda verde).
    - Mata além da borda, a pedido do Gustavo (a do Memorial fica como está): árvores
      grandes logo depois do contorno natural e a mata funda ao longe, aberta só onde
      a ponte vai chegar.
    - No esboço, o ramal da clareira passava por cima da vaga de (12, -7,5): no 3D ele
      entra entre as vagas do oeste.
    - Sem banco no protótipo: quatro homenagens de exemplo só na tela (Pipoca, Luna,
      Thor, Mel), flores e velas plantadas não são salvas, sem presença, e o site abre
      no menu (o mapa ainda é o do Memorial). Os botões de mapa somem.
    - Custo: no perfil de celular, ~15–20% acima do Memorial (5,3 contra 4,6 ms por
      quadro no M5, mesma tela de iPhone); no perfil baixo, igual.
    Fotos aprovadas pelo Gustavo em 2026-11-10 ("assim está legal"): lago do tamanho
    do esboço, lampiões de ferro e a quantidade de árvores ficam como estão.
    Próximo (etapa 2 do plano): coluna `jardim` em memoriais/velas/flores (default
    'memorial', unique (jardim, plot_x, plot_z)), um jardim por vez, link e presença
    por jardim.

38. 🔜 **Cada jardim com as suas homenagens** (branch `jardim-lago`) — etapa 2 da
    expansão. O Jardim do Lago deixa de ser protótipo: homenagens, velas e flores de
    verdade, cada uma no seu jardim.
    - Banco (`supabase/019_jardins.sql`, **rodar no Supabase antes do deploy**):
      coluna `jardim` em memoriais, velas e flores (padrão 'memorial', valores
      'memorial', 'lago', 'bosque'); a vaga passa a ser única dentro do jardim
      (`unique (jardim, plot_x, plot_z)`). Aditiva: o site antigo continua
      funcionando depois dela, e tudo o que existe fica no Memorial. O link (slug)
      continua único no site inteiro.
    - Um jardim por vez: o do endereço (`?jardim=lago`); senão o da homenagem do link
      (/luna abre o Lago, se a Luna mora lá); senão, na volta do login com Google, o
      da vaga guardada (o Google devolve sempre para a raiz); senão o Memorial.
      `JARDIM` em `js/jardins/qual.js` virou ligação viva, trocada pelo `main.js`
      antes de o jogo carregar.
    - Tudo lido e gravado com o jardim: homenagens (e o evento em tempo real, que
      chega de todos e é filtrado), velas, flores, a leitura rápida do mapa da
      primeira tela e as fotos (prefixo `lago_` no armazenamento).
    - Presença por jardim: o Memorial guarda o canal de sempre (`jardim-presenca`),
      o Lago tem o seu; os companheiros de outras pessoas andam na altura do chão.
    - Caminhada pelo link no Lago: a rede de trilhas virou um grafo
      (`rotaAte` em `js/jardins/lago.js`), e o cachorro entra por onde a ponte vai
      chegar e segue a trilha até a frente da pedra. A câmera da chegada usa a borda
      de cada jardim.
    - O Lago ainda não tem mapa de tesouro: abre no cartão do menu, ESC volta ao
      menu, e os botões e a dica do mapa somem. "Na Prainha", "no Recanto do Sol":
      o artigo certo antes do nome do lugar, no jogo e na prévia do link.
    Testado com Playwright e um banco simulado em memória (filtros, vaga única por
    jardim, usuário logado): o Lago lê só o que é dele e grava homenagem, flor e
    vela com `jardim: 'lago'`; /luna abre o Lago e o cachorro caminha pela trilha até
    a Luna; o Memorial lê só o dele e abre no mapa; a volta do login com uma vaga do
    Lago guardada reabre o Lago com o formulário. O Memorial continua idêntico pixel
    a pixel à `main`.

39. 🔜 **Ponte do Arco-Íris e a travessia** (branch `jardim-lago`) — etapa 3 da
    expansão. No Memorial ela sai pelo portão (escolha do Gustavo: não mexe na cerca
    nem nas árvores de fora); no Lago, do patamar a sudeste, atrás do arco "Jardim do
    Lago".
    - `js/gfx/ponte.js`: patamar de pedra com um anel claro e um caminho de seis
      faixas (as cores do esboço) que sai reto e vai virando em arco enquanto sobe
      (indo reto para longe, de dentro do jardim parecia uma torre), até sumir num
      banco de nuvens. Brilho próprio mais forte à noite, um brilho correndo subindo,
      e as nuvens ganham o azul das nuvens do céu de noite. Altura de uma conta só
      (`alturaDaPonte`), a mesma que o cachorro pisa.
    - No Memorial a avenida sul continua do portão até o patamar, e o cachorro pode
      sair por ali (`alemDaCerca`); no resto da cerca nada muda.
    - A travessia (`js/travessia.js`): no patamar aparece "Atravessar para o …"; o
      cachorro sobe sozinho, inclinado na rampa, a tela vira céu (nuvens e o
      arco-íris se desenhando) e a página do outro jardim abre já coberta por esse
      céu (um script no `<head>` lê o `sessionStorage`), carregando por baixo. Pronto
      o jardim, o céu se abre com o cachorro descendo a ponte de lá até o patamar,
      com o mesmo companheiro. Um jardim por página: a travessia é a troca de página,
      coberta. Sem mapa nem menu na chegada; ESC e ☰ não interrompem.
    Testado com Playwright e banco simulado: ida e volta (botão, subida, céu desde o
    primeiro quadro da página nova, descida, controle de volta, mesmo companheiro),
    a pé pelo portão até o patamar e de volta, a cerca segurando no resto, e no
    iPhone 14 pelo toque.

40. 🔜 **Bosque dos Vaga-lumes** (branch `jardim-lago`) — etapa 4 da expansão, o
    terceiro jardim, da descrição aprovada: trilha sinuosa entre pinheiros, clareiras
    de três ou quatro vagas, um riacho com uma pontezinha de pedra e vaga-lumes ao
    entardecer. Abre por `?jardim=bosque` ou pela Ponte do Arco-Íris.
    - Planta em `js/jardins/bosque.js`: o riacho atravessa na diagonal (noroeste →
      sudeste); a trilha sai do patamar da ponte, a sudoeste, cruza o riacho pela
      ponte de pedra e termina na Clareira da Lua, ao norte; ramais para a Clareira
      do Riacho, a Clareira das Samambaias e o Recanto dos Vaga-lumes. 14 vagas, em
      arco em volta do meio de cada clareira, com a entrada livre.
    - O que os jardins naturais têm em comum saiu do Lago para `js/jardins/comum.js`
      (contornos, curvas, medidor de distância em grade, rede de trilhas). O Lago
      ficou idêntico: distâncias, rotas, vagas, placas e lampiões conferidos ponto
      a ponto antes e depois.
    - 3D em `js/gfx/bosque.js`: o riacho é a mesma água do lago numa faixa ao longo
      do leito, com as ondinhas descendo a correnteza; ponte de pedra em arco com
      muretas e musgo; troncos caídos nas clareiras; um enxame de vaga-lumes nas
      clareiras e na beira d'água que acende já no fim da tarde.
    - Árvores novas em `gfx/arvores.js`: pinheiro (camadas em cone, cartões de
      raminhos com agulhas: agulha solta some no teste de transparência e a copa
      fica rala), pinheiro de mata funda e samambaia. Mata além da borda de
      pinheiros, aberta só onde a ponte chega.
    - A ponte agora leva a qualquer jardim: no patamar, um botão por destino.
    Testado com Playwright e banco simulado: o Bosque lê e grava só o que é dele;
    o cachorro atravessa o riacho pela ponte de pedra e para na beira fora dela; o
    link /nina abre o Bosque e o cachorro vai pela trilha e pela ponte até a pedra;
    a travessia do Memorial ao Bosque mostra os dois destinos e chega com o mesmo
    companheiro. O Memorial continua idêntico pixel a pixel ao da etapa 3. Custo no
    perfil de celular: ~5,5 ms por quadro no M5, como o Lago (o Memorial, ~4,5).
    A migração 019 já aceitava 'bosque'.

## Ideias soltas (não decidido ainda)

- A leva de dinamismo social planejada em conjunto está completa: (1)
  mensagens na lápide — etapa 13; (2) velas — etapa 14; (3) presença em
  tempo real — etapa 15. Próximas ideias ainda por decidir, abaixo.
- Pensar em um limite de tamanho/qtd de fotos por lápide.
- Vale a pena limitar quantas flores/mensagens uma pessoa pode deixar por
  dia, pra evitar spam visual no jardim?
- (Ver etapa 30: por enquanto só login com Google.) E-mail de confirmação: o Supabase usa um servidor de teste próprio, com
  limite baixo de envios por hora (ficamos sem receber depois de testar
  algumas vezes seguidas). "Confirm email" está desligado de novo por causa
  disso. Quando for mandar o link pra valer pros amigos, vale configurar um
  provedor de e-mail de verdade (ex: Resend, tem plano grátis) em
  Authentication → Settings → SMTP, e religar a confirmação.

## Notas técnicas para lembrar na fase 2

- O Three.js vinha por `<script>` de CDN até a etapa 22; na etapa 23 virou pacote
  npm (`three@0.187`). Addons vêm de `three/addons/...`.
- `js/lapides.js` é o módulo que sabe tudo sobre os "plots" (lugares de
  lápide). É provavelmente onde a integração com Supabase vai começar: trocar
  o array `plots` em memória por dados vindos do banco.
- `js/menuUi.js` já centraliza o modal de "deixar uma homenagem" — é onde o
  formulário vai precisar salvar no Supabase em vez de só guardar em memória.
