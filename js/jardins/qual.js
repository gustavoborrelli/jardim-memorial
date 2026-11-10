"use strict";

/*
  QUAL JARDIM
  Os Jardins do Arco-Íris são vários jardins, e a página mostra um por vez. Hoje
  são o Jardim Memorial (o de sempre) e o Jardim do Lago. Enquanto a Ponte do
  Arco-Íris não existe, o Lago abre por ?jardim=lago, pelo link de uma homenagem
  que mora nele, ou na volta do login com Google de quem estava lá.

  JARDIM é uma ligação viva (export let): o main.js pode trocá-lo com
  definirJardim() antes de carregar o jogo, e quem o importa vê o valor novo.
*/
export const JARDINS = ['memorial', 'lago'];
const pedido = new URLSearchParams(location.search).get('jardim');
export const JARDIM_DO_ENDERECO = JARDINS.includes(pedido) ? pedido : null;
export let JARDIM = JARDIM_DO_ENDERECO || 'memorial';
export function definirJardim(j){
  if(JARDINS.includes(j)) JARDIM = j;
}
