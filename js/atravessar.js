"use strict";

/*
  ATRAVESSAR PARA OUTRO JARDIM (etapas 39 e 41)
  Um jardim por página: ir a outro jardim é trocar de página, coberta pelo céu da
  travessia (o #travessia do index.html). O que a página seguinte precisa saber fica
  no sessionStorage (jardimTravessia): de onde, para onde, com qual companheiro e
  em que modo — 'passeio' (chega descendo a ponte, no 3D) ou 'mapa' (abre no mapa
  de tesouro do jardim). Um script no <head> mostra o céu desde o primeiro quadro.

  Leve de propósito (sem 3D): o mapa-múndi da primeira tela usa antes do jogo.
*/
export const CHAVE_TRAVESSIA = 'jardimTravessia';
export const NOMES = { memorial: 'Jardim Memorial', lago: 'Jardim do Lago', bosque: 'Bosque dos Vaga-lumes' };
export const ENDERECO = { memorial: '/?jardim=memorial', lago: '/?jardim=lago', bosque: '/?jardim=bosque' };

// o companheiro de sempre, guardado pelo menu (menuUi.js)
export function racaGuardada(){
  try { return localStorage.getItem('jardimRaca'); } catch(e){ return null; }
}

/* cobre a tela com o céu e, depois de `espera` ms, troca de página */
export function atravessarPara(para, { modo = 'passeio', raca = null, de = null, espera = 900 } = {}){
  try {
    sessionStorage.setItem(CHAVE_TRAVESSIA, JSON.stringify({ de, para, raca: raca || racaGuardada(), modo, quando: Date.now() }));
  } catch(e){}
  const destino = document.getElementById('travessiaDestino');
  if(destino) destino.textContent = `para o ${NOMES[para]}`;
  const cortina = document.getElementById('travessia');
  if(cortina) cortina.classList.add('aberta');
  setTimeout(() => location.assign(ENDERECO[para]), espera);
}
