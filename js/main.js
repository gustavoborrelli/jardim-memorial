"use strict";

/*
  PONTO DE ENTRADA
  Montar o jardim leva de um a alguns segundos, dependendo do aparelho, e nesse
  tempo a página não consegue desenhar nada. Por isso este arquivo é mínimo: deixa
  o navegador pintar o cartão do menu e só então carrega o jogo (js/jogo.js).

  Quem chega pelo link de uma homenagem (js/chegada.js) já vê o cartão dela no
  menu, com o botão em "preparando o jardim…" até o jogo ficar pronto: quem toca
  um link no WhatsApp não espera o 3D olhando para o menu de sempre. Para isso o
  jogo só começa depois que o cartão foi pintado (ou depois de 1,5 s, se o banco
  demorar): começando junto, a montagem do jardim travava a página e o cartão só
  aparecia no fim, segundos depois.
*/
import { slugPedido, homenagemDoLink, htmlCartao } from './chegada.js';

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

if(slugPedido){
  const prazo = new Promise(r => setTimeout(() => r(null), 1500));
  Promise.race([homenagemDoLink, prazo]).then(h => { mostrarCartao(h); comecarJogo(); });
  homenagemDoLink.then(mostrarCartao); // banco mais lento que o prazo: o cartão entra quando der
} else {
  comecarJogo();
}
