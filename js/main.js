"use strict";

/*
  PONTO DE ENTRADA
  Montar o jardim leva de um a alguns segundos, dependendo do aparelho, e nesse
  tempo a página não consegue desenhar nada. Por isso este arquivo é mínimo: deixa
  o navegador pintar o cartão do menu e só então carrega o jogo (js/jogo.js).

  Quem chega pelo link de uma homenagem (js/chegada.js) já vê o cartão dela no
  menu, com o botão em "preparando o jardim…" até o jogo ficar pronto: quem toca
  um link no WhatsApp não espera o 3D olhando para o menu de sempre.
*/
import { homenagemDoLink, htmlCartao } from './chegada.js';

homenagemDoLink.then(h => {
  if(!h) return;
  const cartao = document.getElementById('chegadaCartao');
  const botao = document.getElementById('btnVisitar');
  if(!cartao || botao.dataset.pronto) return; // o jogo chegou antes e já montou
  cartao.innerHTML = htmlCartao(h);
  botao.disabled = true;
  botao.textContent = 'preparando o jardim…';
  document.getElementById('menuHome').classList.remove('active');
  document.getElementById('menuChegada').classList.add('active');
});

requestAnimationFrame(() => setTimeout(() => import('./jogo.js'), 0));
