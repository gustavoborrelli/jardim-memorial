"use strict";

/*
  PONTO DE ENTRADA
  Montar o jardim leva de um a alguns segundos, dependendo do aparelho, e nesse
  tempo a página não consegue desenhar nada. Por isso este arquivo é mínimo: deixa
  o navegador pintar o cartão do menu e só então carrega o jogo (js/jogo.js).

  Sem link, a primeira tela é o mapa de tesouro (js/mapa.js), desenhado com uma
  leitura rápida do banco antes do 3D.

  Quem chega pelo link de uma homenagem (js/chegada.js) já vê o cartão dela no
  menu, com o botão em "preparando o jardim…" até o jogo ficar pronto: quem toca
  um link no WhatsApp não espera o 3D olhando para o menu de sempre. Para isso o
  jogo só começa depois que o cartão foi pintado (ou depois de 1,5 s, se o banco
  demorar): começando junto, a montagem do jardim travava a página e o cartão só
  aparecia no fim, segundos depois.
*/
import { slugPedido, homenagemDoLink, htmlCartao, buscarRest } from './chegada.js';
import { obterMapaUi } from './mapa.js';
import { VAGAS, dadosDaLinha } from './planta.js';
import { JARDIM } from './jardins/qual.js';

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
function fonteRapida(memoriais, velas){
  const porVaga = new Map(memoriais.map(r => [`${Number(r.plot_x)}|${Number(r.plot_z)}`, r]));
  const agora = Date.now();
  return {
    plots: VAGAS.map(v => {
      const row = porVaga.get(`${v.x}|${v.z}`);
      return { ...v, occupied: !!row, data: row ? dadosDaLinha(row) : null };
    }),
    velasAcesas: (id) => velas.filter(v => v.memorial_id === id && new Date(v.apaga_em).getTime() > agora).length,
    getMessages: (id) => buscarRest(`mensagens?memorial_id=eq.${encodeURIComponent(id)}&select=id`).catch(() => []),
  };
}

if(JARDIM === 'lago'){
  /* Protótipo do Jardim do Lago (etapa 37): abre no menu de sempre, sem o mapa
     (que ainda é o do Jardim Memorial) e sem ler o banco. */
  document.body.classList.add('jardim-prototipo');
  document.title = 'Jardim do Lago (protótipo)';
  const titulo = document.querySelector('.title-block');
  if(titulo){
    titulo.querySelector('h1').textContent = 'Jardim do Lago';
    titulo.querySelector('p').textContent = 'Protótipo: o segundo jardim, à beira d\'água. Passeie pela trilha do lago, suba até a Clareira do Alto e plante flores (nada fica salvo por enquanto).';
  }
  comecarJogo();
} else if(slugPedido){
  const prazo = new Promise(r => setTimeout(() => r(null), 1500));
  Promise.race([homenagemDoLink, prazo]).then(h => { mostrarCartao(h); comecarJogo(); });
  homenagemDoLink.then(mostrarCartao); // banco mais lento que o prazo: o cartão entra quando der
} else {
  document.getElementById('menuScreen').classList.add('hidden');
  const leitura = Promise.all([
    buscarRest('memoriais?select=*'),
    buscarRest('velas?select=memorial_id,apaga_em&memorial_id=not.is.null').catch(() => []),
  ]).then(([memoriais, velas]) => {
    const mapa = obterMapaUi();
    // o jogo pode ter ficado pronto antes (banco lento): a fonte viva vale mais
    if(!mapa.ehVivo()) mapa.trocarFonte(fonteRapida(memoriais, velas));
    const menuAberto = !document.getElementById('menuScreen').classList.contains('hidden');
    if(!mapa.isOpen() && !menuAberto && !document.body.classList.contains('passeando')) mapa.openInicio();
    return true;
  }).catch(() => false);
  const prazo = new Promise(r => setTimeout(() => r(false), 1500));
  Promise.race([leitura, prazo]).then(comecarJogo);
}
