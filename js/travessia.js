"use strict";

/*
  A TRAVESSIA DA PONTE DO ARCO-ÍRIS (etapa 39)
  No patamar da ponte aparece "Atravessar para o …". O cachorro sobe a ponte
  sozinho, a tela vira céu (nuvens e o arco-íris se desenhando) e a página do outro
  jardim abre já coberta por esse céu: um script no <head> do index.html o mostra
  desde o primeiro quadro, enquanto o jardim novo carrega por baixo. Quando ele
  fica pronto, as nuvens se abrem com o cachorro descendo a ponte de lá até o
  patamar. Um jardim por página: a travessia é a troca de página, coberta.

  O que passa de uma página para a outra fica no sessionStorage (jardimTravessia):
  de onde, para onde, o companheiro e a hora. Vale por um minuto.
*/
import { travessiaChegando, CHAVE_TRAVESSIA } from './chegada.js';

const NOMES = { memorial: 'Jardim Memorial', lago: 'Jardim do Lago' };
const ENDERECO = { memorial: '/', lago: '/?jardim=lago' };

export function createTravessia({ world, dogController, menuUi }){
  const ponte = world.ponte;
  const botao = document.getElementById('btnAtravessar');
  const cortina = document.getElementById('travessia');
  const destino = document.getElementById('travessiaDestino');
  botao.textContent = `🌈 Atravessar para o ${NOMES[ponte.destino]}`;
  let atravessando = false;

  // a altura de quem está na ponte; fora dela (no patamar), o chão do jardim
  const alturaNaPonte = (x, z) => ponte.alturaEm(x, z);

  function noPatamar(){
    const dog = dogController.getDog();
    return dog && Math.hypot(dog.position.x - ponte.x, dog.position.z - ponte.z) < ponte.raio + 0.4;
  }

  function atravessar(){
    if(atravessando) return;
    atravessando = true;
    botao.classList.remove('visivel');
    document.body.classList.add('na-ponte');
    // sobe a ponte, do meio do patamar
    dogController.caminharPor([[ponte.x, ponte.z], ...ponte.pontos(0.5, 16, 10)], {
      altura: alturaNaPonte, livre: true, semCancelar: true, velocidade: 1.45,
    });
    destino.textContent = `para o ${NOMES[ponte.destino]}`;
    setTimeout(() => {
      cortina.classList.add('aberta');
      try {
        sessionStorage.setItem(CHAVE_TRAVESSIA, JSON.stringify({
          de: world.jardim, para: ponte.destino, raca: dogController.getBreed(), quando: Date.now(),
        }));
      } catch(e){}
    }, 2300);
    // a cortina leva ~0,7 s para cobrir; depois disso, o outro jardim
    setTimeout(() => location.assign(ENDERECO[ponte.destino]), 3100);
  }
  botao.addEventListener('click', atravessar);

  /* ---------- a chegada, do outro lado ---------- */
  if(travessiaChegando && travessiaChegando.para === world.jardim){
    try { sessionStorage.removeItem(CHAVE_TRAVESSIA); } catch(e){}
    atravessando = true;
    document.body.classList.add('na-ponte');
    const raca = travessiaChegando.raca || 'golden';
    dogController.selectDog(raca);
    // lá no alto da ponte, virado para o jardim
    const [x0, z0] = ponte.pontos(13, 13, 1)[0];
    const [rx, rz] = ponte.rumo;
    dogController.posicionarNoAr(x0, ponte.alturaEm(x0, z0), z0, Math.atan2(-rx, -rz));
    menuUi.startGame();
    // desce até o patamar e dá uns passos para dentro do jardim
    const descida = [...ponte.pontos(12, 0.4, 10), [ponte.x, ponte.z], [ponte.x - rx*2.6, ponte.z - rz*2.6]];
    // as nuvens se abrem quando o jardim já desenhou alguns quadros, e nunca antes de
    // o céu ter ficado um pouco na tela (a travessia inteira dura uns 4 a 5 s)
    const desdeQueCobriu = performance.now() - (travessiaChegando.cobriuEm || performance.now());
    const espera = Math.max(500, 1500 - desdeQueCobriu);
    setTimeout(() => {
      dogController.caminharPor(descida, {
        altura: alturaNaPonte, livre: true, semCancelar: true, velocidade: 1.25,
        aoChegar: () => { atravessando = false; document.body.classList.remove('na-ponte'); },
      });
      cortina.classList.add('desenhado'); // o arco continua inteiro enquanto o céu some
      document.documentElement.classList.remove('atravessando');
    }, espera);
  }

  return {
    atravessando: () => atravessando,
    atualizar(pausado){
      const mostra = !pausado && !atravessando && !dogController.caminhando() && noPatamar();
      botao.classList.toggle('visivel', !!mostra);
    },
  };
}
