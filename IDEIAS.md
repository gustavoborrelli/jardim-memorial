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
7. 🔜 **Login com Google** — botão "Continuar com Google" no modal de
   entrar/criar conta (`js/auth.js` → `signInWithGoogle()`, fluxo OAuth padrão
   do Supabase com redirect de volta pro próprio site). Código pronto, mas
   falta configuração fora do repo, feita pelo humano:
   1. Google Cloud Console → criar projeto (ou usar um existente) → "OAuth
      consent screen" (tipo External, só precisa de nome/e-mail de suporte)
      → "Credentials" → criar "OAuth client ID" do tipo "Web application".
   2. Nesse client, em "Authorized redirect URIs", adicionar exatamente:
      `https://uxtjooztgtcrdkmpfnxu.supabase.co/auth/v1/callback`
   3. Copiar o Client ID e o Client Secret gerados.
   4. No painel do Supabase → Authentication → Providers → Google → colar
      Client ID/Secret e habilitar.
   5. Testar o botão no site (local ou já publicado) — deve abrir a tela de
      login do Google e voltar logado.
   Limitação aceita: como o login redireciona a página inteira pro Google e
   volta, uma ação pendente (ex.: "estava tentando plantar flor quando pediu
   login") se perde no reload — a pessoa só precisa clicar de novo depois de
   logar. Mesma limitação não existe no login por e-mail/senha, que não sai
   da página.

## Ideias soltas (não decidido ainda)

- Pensar em um limite de tamanho/qtd de fotos por lápide.
- Flores expiradas continuam existindo na tabela pra sempre (só ficam
  invisíveis pela RLS) — se a tabela crescer muito com o tempo, pensar numa
  faxina periódica (pg_cron ou Edge Function) que apaga linhas velhas.
- Vale a pena limitar quantas flores uma pessoa pode plantar por dia, pra
  evitar spam visual no jardim?
- Música ambiente / som contínuo (pássaros, vento): se algum dia adicionarmos
  isso, trazer de volta um botão de mute — hoje removido porque os efeitos
  sonoros só tocam em resposta a uma ação do próprio usuário (plantar, logar),
  nunca por conta própria, então mudo dedicado não se justificava.
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
