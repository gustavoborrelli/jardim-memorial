"use strict";

/*
  PONTO DE ENTRADA
  Montar o jardim leva de um a alguns segundos, dependendo do aparelho, e nesse
  tempo a página não consegue desenhar nada. Por isso este arquivo é mínimo: deixa
  o navegador pintar o cartão do menu e só então carrega o jogo (js/jogo.js).

  Sem link, a primeira tela é o mapa-múndi (js/mundi.js, etapa 41): os três
  jardins ligados pela Ponte do Arco-Íris. Com ?jardim=… no endereço (ou chegando
  de outro jardim pelo múndi), é o mapa de tesouro daquele jardim (js/mapa.js),
  desenhado com uma leitura rápida do banco antes do 3D.

  Quem chega pelo link de uma homenagem (js/chegada.js) já vê o cartão dela no
  menu, com o botão em "preparando o jardim…" até o jogo ficar pronto: quem toca
  um link no WhatsApp não espera o 3D olhando para o menu de sempre. Para isso o
  jogo só começa depois que o cartão foi pintado (ou depois de 1,5 s, se o banco
  demorar): começando junto, a montagem do jardim travava a página e o cartão só
  aparecia no fim, segundos depois.
*/
import { slugPedido, homenagemDoLink, htmlCartao, buscarRest, voltouDoLogin, travessiaChegando } from './chegada.js';
import { obterMapaUi } from './mapa.js';
import { obterMundi } from './mundi.js';
import { atravessarPara, CHAVE_TRAVESSIA } from './atravessar.js';
import { VAGAS, dadosDaLinha } from './planta.js';
import { VAGAS as VAGAS_LAGO } from './jardins/lago.js';
import { VAGAS as VAGAS_BOSQUE } from './jardins/bosque.js';
import { JARDIM, JARDIM_DO_ENDERECO, definirJardim } from './jardins/qual.js';

/* QUAL JARDIM ABRIR (etapa 38). A página mostra um jardim por vez: o do endereço
   (?jardim=lago); senão, o da homenagem do link (/thor pode morar no Lago); senão,
   na volta do login com Google, o da vaga guardada (o Google devolve sempre para a
   raiz do site); senão, o Jardim Memorial. O jogo só carrega depois de decidido. */
if(!JARDIM_DO_ENDERECO && voltouDoLogin){
  try {
    const p = JSON.parse(localStorage.getItem('jardimVagaPendente') || 'null');
    if(p && p.jardim) definirJardim(p.jardim);
  } catch(e){}
}
// título e cartaz do canto para o jardim que não é o Memorial
const VESTIDOS = {
  lago: { titulo: 'Jardim do Lago', texto: 'Um jardim à beira d\'água. Passeie pela trilha do lago, suba até a Clareira do Alto, plante flores e, se quiser, deixe uma homenagem numa das vagas livres.' },
  bosque: { titulo: 'Bosque dos Vaga-lumes', texto: 'Uma trilha entre pinheiros, um riacho com uma ponte de pedra e clareiras onde os vaga-lumes acendem ao entardecer. Plante flores e, se quiser, deixe uma homenagem numa das vagas livres.' },
};
function vestirJardim(){
  const v = VESTIDOS[JARDIM];
  if(!v) return;
  document.body.classList.add(`jardim-${JARDIM}`);
  document.title = v.titulo;
  const chip = document.getElementById('pauseChip');
  if(chip) chip.innerHTML = '<b>ESC</b> — menu / pausa';
  const titulo = document.querySelector('.title-block');
  if(titulo){
    titulo.querySelector('h1').textContent = v.titulo;
    titulo.querySelector('p').textContent = v.texto;
  }
}

function mostrarCartao(h){
  if(!h) return;
  const cartao = document.getElementById('chegadaCartao');
  const botao = document.getElementById('btnVisitar');
  if(!cartao || botao.dataset.pronto || botao.dataset.cartao) return; // já montado
  botao.dataset.cartao = '1';
  cartao.innerHTML = htmlCartao(h);
  botao.disabled = true;
  botao.textContent = 'preparando o jardim…';
  document.getElementById('menuHome').classList.remove('active');
  document.getElementById('menuChegada').classList.add('active');
}

const comecarJogo = () => requestAnimationFrame(() => setTimeout(() => import('./jogo.js'), 0));

/* Sem link de homenagem, a primeira tela é o mapa de tesouro (etapa 35): uma
   leitura rápida das homenagens e das velas acesas basta para desenhá-lo, antes
   de o 3D existir. Como no cartão do link, o jogo só começa depois que o mapa foi
   pintado (ou depois de 1,5 s, se o banco demorar); sem resposta do banco, o mapa
   abre quando o jogo ficar pronto, já com as homenagens do jardim. */
const VAGAS_DE = { memorial: VAGAS, lago: VAGAS_LAGO, bosque: VAGAS_BOSQUE };
function fonteRapida(memoriais, velas){
  const porVaga = new Map(memoriais.map(r => [`${Number(r.plot_x)}|${Number(r.plot_z)}`, r]));
  const agora = Date.now();
  return {
    plots: VAGAS_DE[JARDIM].map(v => {
      const row = porVaga.get(`${v.x}|${v.z}`);
      return { ...v, occupied: !!row, data: row ? dadosDaLinha(row) : null };
    }),
    velasAcesas: (id) => velas.filter(v => v.memorial_id === id && new Date(v.apaga_em).getTime() > agora).length,
    getMessages: (id) => buscarRest(`mensagens?memorial_id=eq.${encodeURIComponent(id)}&select=id`).catch(() => []),
  };
}

/* leitura rápida das homenagens e velas acesas deste jardim, para o mapa de tesouro
   desenhar antes do 3D; o jogo, quando fica pronto, troca pela fonte viva */
function lerJardim(){
  return Promise.all([
    buscarRest(`memoriais?select=*&jardim=eq.${JARDIM}`),
    buscarRest(`velas?select=memorial_id,apaga_em&memorial_id=not.is.null&jardim=eq.${JARDIM}`).catch(() => []),
  ]).then(([memoriais, velas]) => {
    const mapa = obterMapaUi();
    if(!mapa.ehVivo()) mapa.trocarFonte(fonteRapida(memoriais, velas));
    return true;
  }).catch(() => false);
}
// quantas homenagens tem cada jardim, para o mapa-múndi
function contarHomenagens(){
  return buscarRest('memoriais?select=jardim').then(linhas => {
    const c = { memorial: 0, lago: 0, bosque: 0 };
    linhas.forEach(l => { const j = l.jardim || 'memorial'; if(j in c) c[j]++; });
    return c;
  }).catch(() => null);
}
// abre o mapa de tesouro deste jardim como primeira tela, se nada já estiver na frente
function abrirMapaInicio(){
  const mapa = obterMapaUi();
  const menuAberto = !document.getElementById('menuScreen').classList.contains('hidden');
  if(!mapa.isOpen() && !menuAberto && !mundi.isOpen() && !document.body.classList.contains('passeando')) mapa.openInicio();
}

/* O MAPA-MÚNDI: "Ver as homenagens" e "Passear aqui". Para outro jardim, atravessa a
   ponte; no jardim desta página, abre o mapa (o passeio o menuUi.js liga quando o
   jogo fica pronto). "← Os jardins", no mapa de tesouro, abre o múndi por cima. */
const mundi = obterMundi();
mundi.ligar({
  verMapa: (j) => {
    if(j !== JARDIM){ atravessarPara(j, { modo: 'mapa', de: JARDIM }); return; }
    mundi.fechar();
    const mapa = obterMapaUi();
    if(!mapa.isOpen()) mapa.openInicio();
  },
  passear: (j) => { if(j !== JARDIM) atravessarPara(j, { modo: 'passeio', de: JARDIM }); },
});
document.getElementById('btnMapMundi').addEventListener('click', () => {
  mundi.abrir();
  contarHomenagens().then(c => { if(c) mundi.trocarContagens(c); });
});

if(travessiaChegando && travessiaChegando.modo === 'mapa'){
  // vindo do mapa-múndi de outro jardim: o céu da travessia cobre a tela (index.html)
  // até o mapa de tesouro deste jardim estar desenhado, e então se abre
  if(!JARDIM_DO_ENDERECO) definirJardim(travessiaChegando.para);
  try { sessionStorage.removeItem(CHAVE_TRAVESSIA); } catch(e){}
  document.getElementById('menuScreen').classList.add('hidden');
  vestirJardim();
  const prazo = new Promise(r => setTimeout(() => r(false), 1500));
  Promise.race([lerJardim(), prazo]).then(() => {
    abrirMapaInicio();
    // o céu fica pelo menos um instante: a travessia não pisca
    setTimeout(() => document.documentElement.classList.remove('atravessando'), Math.max(0, 1100 - performance.now()));
    comecarJogo();
  });
} else if(travessiaChegando){
  // chegando pela Ponte do Arco-Íris: o céu da travessia já cobre a tela (index.html);
  // nada de mapa nem menu, o jogo carrega por baixo e js/travessia.js termina a chegada
  if(!JARDIM_DO_ENDERECO) definirJardim(travessiaChegando.para);
  document.getElementById('menuScreen').classList.add('hidden');
  vestirJardim();
  comecarJogo();
} else if(slugPedido){
  const prazo = new Promise(r => setTimeout(() => r(null), 1500));
  Promise.race([homenagemDoLink, prazo]).then(mostrarCartao);
  homenagemDoLink.then(mostrarCartao); // banco mais lento que o prazo: o cartão entra quando der
  // o jogo espera saber de que jardim é a homenagem (sem resposta em 8 s, o do endereço)
  const prazoDoJardim = new Promise(r => setTimeout(() => r(null), 8000));
  Promise.race([homenagemDoLink, prazoDoJardim]).then(h => {
    if(h && h.jardim && !JARDIM_DO_ENDERECO) definirJardim(h.jardim);
    vestirJardim();
    comecarJogo();
  });
} else if(JARDIM_DO_ENDERECO || voltouDoLogin){
  // ?jardim=… no endereço, ou de volta do login com Google: abre no mapa de tesouro
  // do jardim (a vaga guardada é retomada pelo menuUi.js)
  document.getElementById('menuScreen').classList.add('hidden');
  vestirJardim();
  const leitura = lerJardim().then(ok => { if(ok) abrirMapaInicio(); return ok; });
  const prazo = new Promise(r => setTimeout(() => r(false), 1500));
  Promise.race([leitura, prazo]).then(comecarJogo);
} else {
  // a raiz do site: o mapa-múndi, na hora (não precisa do banco); as contagens de
  // cada jardim e o mapa do Jardim Memorial chegam em seguida, e o jogo carrega por baixo
  document.getElementById('menuScreen').classList.add('hidden');
  mundi.abrir({ primeira: true });
  contarHomenagens().then(c => { if(c) mundi.trocarContagens(c); });
  const leitura = lerJardim();
  const prazo = new Promise(r => setTimeout(() => r(false), 1500));
  Promise.race([leitura, prazo]).then(comecarJogo);
}
