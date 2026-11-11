"use strict";

/*
  A PLANTA DO JARDIM DO LAGO (etapa 37, protótipo: ?jardim=lago)
  O segundo jardim dos Jardins do Arco-Íris, tirado do esboço aprovado em
  2026-11-09: um jardim à beira d'água, sem nada no centro. O lago fica a oeste,
  de margem irregular, com uma prainha, um deque e um salgueiro; a trilha contorna
  a água e se divide para a Clareira do Alto (um morro baixo a nordeste, com quatro
  vagas) e para a chegada da Ponte do Arco-Íris, a sudeste.

  Mesmas regras do Jardim Memorial, desenho próprio: aqui ficam só medidas e contas
  (nada de 3D), para o mapa poder desenhar este jardim dos mesmos dados um dia.
  Coordenadas: x para leste, z para o sul (o "y" do esboço é o z daqui).
*/

import { raioEm, suave, catmull, medidorDeLinhas, redeDeTrilhas, aoLongo as ao, ladoDa } from './comum.js';
export { raioEm };

/* ============ O LAGO ============ */
export const LAGO = { x: -7, z: -4, r: 9, ondas: [[2, 0.1, 0.6], [3, 0.09, 2.2], [5, 0.045, 0.9]] };
export const NIVEL_AGUA = -0.34; // a superfície da água
// ponto na margem no ângulo `a` (a partir do centro do lago), `extra` para fora
export function naMargem(a, extra = 0){
  const r = LAGO.r*raioEm(LAGO.ondas, a) + extra;
  return [LAGO.x + Math.cos(a)*r, LAGO.z + Math.sin(a)*r];
}
// distância (aproximada, pelo raio) até a margem desenhada; negativa dentro d'água
export function sdLago(x, z){
  const dx = x - LAGO.x, dz = z - LAGO.z;
  return Math.hypot(dx, dz) - LAGO.r*raioEm(LAGO.ondas, Math.atan2(dz, dx));
}

/* a prainha: areia que entra na água a sudeste do lago */
export const PRAIA = { x: -1.2, z: 2.2, r: 4.3, ondas: [[2, 0.18, 0.4], [3, 0.08, 1.8]] };
export function areia(x, z){
  const dx = x - PRAIA.x, dz = z - PRAIA.z;
  const sd = Math.hypot(dx, dz) - PRAIA.r*raioEm(PRAIA.ondas, Math.atan2(dz, dx));
  return 1 - suave(-0.7, 0.9, sd);
}

/* o morro da Clareira do Alto: platô aberto no alto, curvas de nível em volta */
export const MORRO = { x: 15.2, z: -11.2, topo: 6.4, base: 11, altura: 1.35, ondas: [[2, 0.08, 0.9], [3, 0.05, 2.4]] };
function pesoMorro(x, z){
  const dx = x - MORRO.x, dz = z - MORRO.z;
  const k = raioEm(MORRO.ondas, Math.atan2(dz, dx));
  return 1 - suave(MORRO.topo*k, MORRO.base*k, Math.hypot(dx, dz));
}

/* a terra do jardim: contorno natural (no lugar da cerca reta do Memorial) */
export const BORDA = { r: 26.5, ondas: [[2, 0.04, 1.1], [3, 0.035, 0.3], [5, 0.025, 2.0], [8, 0.015, 0.7]] };
export const raioBorda = (x, z) => BORDA.r*raioEm(BORDA.ondas, Math.atan2(z, x));

/* ============ AS TRILHAS ============
   Contornam o lago a 3,4 da margem e se dividem para a clareira e para a ponte.
   Os pontos do esboço viram curvas suaves (Catmull-Rom) e depois polilinhas finas. */
export const LARGURA_TRILHA = 1.9;
const AFASTAMENTO = 3.4;
const volta = [];
for(let i = 0; i < 36; i++) volta.push(naMargem(i/36*Math.PI*2, AFASTAMENTO));
export const PONTE = { x: 20.5, z: 22.5 }; // onde a Ponte do Arco-Íris encosta (etapa 3)
export const TRILHAS = {
  volta: catmull(volta, true, 4),
  // (no esboço o ramal passava por cima da vaga de (12, -7,5); aqui entra entre as vagas do oeste)
  clareira: catmull([naMargem(-0.15, AFASTAMENTO), [8.4, -8.9], [11, -10.8], [MORRO.x, MORRO.z]], false),
  ponte: catmull([naMargem(0.75, AFASTAMENTO), [6.5, 6.5], [11.5, 12.5], [16, 18.5], [PONTE.x, PONTE.z]], false),
};
// a roda de cascalho no alto da clareira, onde a trilha termina
export const RODA_CLAREIRA = { x: MORRO.x, z: MORRO.z, r: 1.5 };

/* distância até a trilha mais perto (a grade de segmentos mora em comum.js) */
const MEDIDOR = medidorDeLinhas(Object.values(TRILHAS), { min: -36, lado: 2, n: 36, perto: 4 });
export const distTrilha = (x, z) => MEDIDOR.distancia(x, z);
const pontoNaTrilha = (x, z) => MEDIDOR.pontoMaisPerto(x, z);
export function sdCaminho(x, z){
  const d = distTrilha(x, z) - LARGURA_TRILHA/2;
  return Math.min(d, Math.hypot(x - RODA_CLAREIRA.x, z - RODA_CLAREIRA.z) - RODA_CLAREIRA.r, Math.hypot(x - PONTE.x + 0.6, z - PONTE.z + 0.6) - 2.0);
}

/* ============ O RELEVO ============
   Somado à altura de sempre (plana até a mata, colinas depois): a bacia do lago,
   com a margem mais suave na prainha, o morro da clareira e uma ondulação leve no
   gramado, que some no alto do morro (lá ficam quatro vagas). */
export function relevo(x, z){
  const morro = pesoMorro(x, z);
  let h = (0.14*Math.sin(x*0.21 + 1.3)*Math.sin(z*0.17 + 0.4) + 0.07*Math.sin(x*0.43 - z*0.31 + 0.8))*(1 - morro);
  h += morro*MORRO.altura;
  const s = sdLago(x, z);
  const praia = areia(x, z);
  const s0 = 1.6 + praia*1.4, fundo = 4.5 + praia*2.5;
  if(s < s0){
    const b = suave(s0, -fundo, s);
    h = h*(1 - b) - 1.6*b;
  }
  return h;
}

/* ============ O DEQUE ============
   Avança sobre a água a sudoeste. `u` corre da terra para dentro do lago. */
const A_DEQUE = 2.55;
const [dqx, dqz] = naMargem(A_DEQUE, 0.6);
export const DEQUE = {
  x: dqx, z: dqz, dir: [Math.cos(A_DEQUE + Math.PI), Math.sin(A_DEQUE + Math.PI)],
  u0: -1.1, u1: 5.0, meia: 0.85, y: 0.08,
};
export function noDeque(x, z, folga = 0){
  const [dx, dz] = DEQUE.dir;
  const u = (x - DEQUE.x)*dx + (z - DEQUE.z)*dz;
  const v = -(x - DEQUE.x)*dz + (z - DEQUE.z)*dx;
  return u > DEQUE.u0 - folga && u < DEQUE.u1 + folga && Math.abs(v) < DEQUE.meia + folga;
}
export const doDeque = (u, v) => [DEQUE.x + DEQUE.dir[0]*u - DEQUE.dir[1]*v, DEQUE.z + DEQUE.dir[1]*u + DEQUE.dir[0]*v];

/* ============ AS VAGAS ============
   As 13 do esboço, com o nome do lugar. Cada pedra olha para a trilha mais perto;
   as da clareira olham para a roda no alto do morro. */
const VAGAS_ESBOCO = [
  [-7, 13, 'Margem do Lago'], [-19, 8, 'Margem do Lago'], [-23.5, -4, 'Margem do Lago'],
  [-16, -18, 'Margem do Lago'], [-3, -21, 'Margem do Lago'], [2.5, 11, 'Prainha'],
  [12, -15.5, 'Clareira do Alto'], [18.5, -15, 'Clareira do Alto'], [12, -7.5, 'Clareira do Alto'], [18.5, -7, 'Clareira do Alto'],
  [11, 1, 'Caminho da Ponte'], [19, 12, 'Caminho da Ponte'], [-12, 20, 'Margem do Lago'],
];
export const VAGAS = VAGAS_ESBOCO.map(([x, z, lugar]) => {
  const alvo = lugar === 'Clareira do Alto' ? [MORRO.x, MORRO.z] : pontoNaTrilha(x, z);
  return { x, z, section: lugar, rot: Math.atan2(alvo[0] - x, alvo[1] - z) };
});

/* placas: o arco de boas-vindas na chegada da ponte, o da clareira e duas placas */
export const PLACAS = [
  { nome: 'Jardim do Lago', tipo: 'arco', ...ao(TRILHAS.ponte, 0.93) },
  { nome: 'Clareira do Alto', tipo: 'arco', ...ao(TRILHAS.clareira, 0.5) },
  // na areia, entre a trilha e a água; e do lado de fora da trilha, ao sul
  { nome: 'Prainha', tipo: 'placa', ...deFrenteParaFora(0.62, AFASTAMENTO - 1.7) },
  { nome: 'Margem do Lago', tipo: 'placa', ...deFrenteParaFora(2.0, AFASTAMENTO + 1.7) },
];
function deFrenteParaFora(a, extra){
  const [x, z] = naMargem(a, extra);
  return { x, z, rot: Math.atan2(Math.cos(a), Math.sin(a)) };
}
/* ============ ONDE SE ANDA ============
   Dentro da terra do jardim, mais a trilha que sai até a ponte; fora d'água,
   menos no deque. Devolve a altura do chão ali, ou null. */
export function chao(x, z, alturaTerreno){
  // no deque: longe da beirada e da ponta. Na faixa da beirada não se pisa sobre a
  // água (a conta da água logo abaixo já recusa); sobre a terra, no começo do deque,
  // pisa-se no chão. Recusar a faixa toda deixava o deque bloqueado: entre a terra e
  // as tábuas sobrava uma tira onde não era nem um nem outro.
  if(noDeque(x, z, -0.2)){
    const u = (x - DEQUE.x)*DEQUE.dir[0] + (z - DEQUE.z)*DEQUE.dir[1];
    if(u < DEQUE.u1 - 0.35) return DEQUE.y;
  }
  const dentro = Math.hypot(x, z) < raioBorda(x, z) - 1.2 || distTrilha(x, z) < 1.1 || Math.hypot(x - PONTE.x, z - PONTE.z) < 2.2;
  if(!dentro) return null;
  const h = alturaTerreno(x, z);
  return h > NIVEL_AGUA + 0.05 ? h : null;
}

/* ============ O QUE CRESCE ============ */
export const SALGUEIRO = (() => { const [x, z] = naMargem(-1.25, 0.6); return { x, z }; })();
// (sem bancos: num jardim de cachorros eles não faziam sentido e alguns ficavam mal
// postos — pedido do Gustavo em 2026-11-10)
// lampiões na beira da trilha: acendem no fim da tarde
export const LAMPADAS = [
  ladoDa(TRILHAS.ponte, 0.97, 1.9), ladoDa(TRILHAS.ponte, 0.97, -1.9),
  ladoDa(TRILHAS.ponte, 0.45, 1.9), ladoDa(TRILHAS.clareira, 0.7, -1.9),
  ladoDa(TRILHAS.volta, 0.04, -1.9), ladoDa(TRILHAS.volta, 0.42, -1.9), ladoDa(TRILHAS.volta, 0.62, -1.9), ladoDa(TRILHAS.volta, 0.84, -1.9),
];

/* nenúfares: as cinco ilhas do esboço */
export const NENUFARES = [[-11.5, -5.5], [-9.6, -2.6], [-4.6, -7.6], [-3.2, -3.4], [-12.4, -1.4]];
// juncos: em volta da margem, menos na prainha e no deque
export const JUNCOS = (() => {
  const lista = [];
  for(let i = 0; i < 52; i++){
    const a = i/52*Math.PI*2;
    if(a > 0.15 && a < 1.35) continue;
    if(Math.abs(a - A_DEQUE) < 0.32) continue;
    if(Math.abs(Math.sin(i*12.9898)*43758.5453 % 1) < 0.42) continue;
    lista.push({ a, extra: -0.5 + (Math.abs(Math.sin(i*78.233)*43758.5453) % 1)*0.8 });
  }
  return lista;
})();

/* ============ A REDE DE TRILHAS (caminhada automática) ============
   Quem chega pelo link de uma homenagem caminha sozinho até ela. No Memorial a
   rota segue as avenidas retas; aqui, a trilha: os pontos das três trilhas viram
   um grafo (cada ponto ligado ao seguinte; os ramais ligados à volta do lago onde
   saem dela) e a rota é o caminho mais curto até o ponto da trilha mais perto da
   pedra, e dali em linha reta até a frente dela. */
export const rotaAte = redeDeTrilhas([TRILHAS.volta, TRILHAS.clareira, TRILHAS.ponte], { primeiraFechada: true });

// a Ponte do Arco-Íris (etapa 39): o patamar onde a trilha da ponte termina, e ela
// sobe para sudeste, na direção da própria trilha, por cima da mata
export const PE_DA_PONTE = (() => {
  const dx = PONTE.x - 16, dz = PONTE.z - 18.5, l = Math.hypot(dx, dz);
  // (virando para leste enquanto sobe, por fora do jardim)
  return { x: PONTE.x, z: PONTE.z, rumo: [dx/l, dz/l], vira: -1, raio: 2.1, destinos: ['memorial', 'bosque'] };
})();

// quanto falta até a borda do jardim (a câmera da chegada não para dentro da mata)
export const folgaDaBorda = (x, z) => raioBorda(x, z) - 1.5 - Math.hypot(x, z);

/* onde o cachorro chega (perto da ponte, já passado o arco de boas-vindas, virado
   trilha abaixo); enquanto a ponte não existe, é por aqui que se entra */
export const INICIO = (() => {
  const l = TRILHAS.ponte, i = Math.floor(0.68*(l.length - 1));
  const [x, z] = l[i], [ax, az] = l[i - 2];
  return { x, z, yaw: Math.atan2(ax - x, az - z) };
})();
