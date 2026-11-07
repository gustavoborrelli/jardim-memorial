"use strict";

/*
  PONTO DE ENTRADA
  Montar o jardim leva de um a alguns segundos, dependendo do aparelho, e nesse
  tempo a página não consegue desenhar nada. Por isso este arquivo é mínimo: deixa
  o navegador pintar o "preparando o jardim…" e só então carrega o jogo (js/jogo.js).
*/
requestAnimationFrame(() => setTimeout(() => import('./jogo.js'), 0));
