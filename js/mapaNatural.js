"use strict";

/*
  O MAPA DE TESOURO DOS JARDINS NATURAIS (etapa 41)
  O Jardim do Lago e o Bosque dos Vaga-lumes vistos de cima, no mesmo papel e na
  mesma tinta do mapa do Jardim Memorial, desenhados das plantas deles (as mesmas
  medidas do 3D): a terra de contorno natural, a água, as trilhas, as árvores, a
  ponte de arco-íris chegando e os nomes dos lugares em faixas.

  As vagas ficam no lugar de verdade. Só no Bosque, onde as vagas de uma clareira
  ficam a 4 m umas das outras, o mapa abre as clareiras (como os mapas ilustrados de
  parque): o medalhão não caberia num toque de celular.

  desenharNatural(svg, jardim, aguadas, tinta, enfeites) desenha o que não muda e
  devolve o que o mapa precisa para o resto: onde cada ponto cai no papel, o tamanho
  dos medalhões, onde vai o nome de cada vaga e as faixas dos lugares.
*/
import * as LAGO from './jardins/lago.js';
import * as BOSQUE from './jardins/bosque.js';
import { el, sorteador, curva, linha, contorno, arvore, pinheiro, salgueiro, nuvem, arcoIris, faixa, TINTA, MADEIRA, LETRA_MAO } from './mapaDesenho.js';

export const NOMES_NATURAIS = { lago: 'Jardim do Lago', bosque: 'Bosque dos Vaga-lumes' };
export const MEIA_NATURAL = 27; // o papel cobre ±27 (a borda dos jardins naturais está em ~26,5)

/* a terra do jardim e a hachura da beira */
function terra(P, aguadas, tinta){
  const pts = contorno(0, 0, P.BORDA.r, P.BORDA.ondas, 72);
  el('path', { d: curva(pts, true), fill: '#a7c47b', opacity: .62 }, aguadas);
  el('path', { d: curva(pts, true), 'stroke-width': .18, opacity: .6, stroke: '#5f7d45' }, tinta);
  return pts;
}
/* a ponte de arco-íris chegando pelo patamar, vinda de fora do papel */
function ponte(P, enfeites, tinta, clipId){
  const pe = P.PE_DA_PONTE, [rx, rz] = pe.rumo;
  const g = el('g', { 'clip-path': `url(#${clipId})` }, enfeites);
  arcoIris(g, 'mt-', [pe.x + rx*0.6, pe.z + rz*0.6], [pe.x + rx*30, pe.z + rz*30 - 6], 7, .55, false);
  el('circle', { cx: pe.x, cy: pe.z, r: pe.raio*0.8, fill: '#e9e0cf', stroke: TINTA, 'stroke-width': .14 }, enfeites);
  nuvem(enfeites, pe.x + rx*3.2, pe.z + rz*3.2, 1.3);
  return pe;
}
/* a mata além da borda: árvores grandes (ou pinheiros) logo depois do contorno */
function mataDaBorda(P, pts, aguadas, tinta, sorte, { pinheiros = false, longeDe = [] } = {}){
  const pe = P.PE_DA_PONTE;
  pts.forEach(([x, y], i) => {
    if(i % 2) return;
    const a = Math.atan2(y, x), r = Math.hypot(x, y) + 1.5;
    const ax = Math.cos(a)*r, ay = Math.sin(a)*r;
    if(Math.hypot(ax - pe.x, ay - pe.z) < 5) return; // a chegada da ponte fica aberta
    if(longeDe.some(([lx, ly, d]) => Math.hypot(ax - lx, ay - ly) < d)) return;
    if(pinheiros) pinheiro(aguadas, tinta, ax, ay + 1, 2.6 + sorte()*.9, ['#4f7d45', '#5f8a45', '#46703f'][i % 3]);
    else arvore(aguadas, tinta, sorte, ax, ay, 1.5 + sorte()*.6, (i % 9 === 0) ? '#e9a7ba' : ['#7ea35a', '#8fb367', '#6f9752', '#9cbc6e'][i % 4]);
  });
}

function desenharLago(svg, aguadas, tinta, enfeites, clipId){
  const P = LAGO;
  const sorte = sorteador(47);
  const pts = terra(P, aguadas, tinta);
  // o morro da clareira: curvas de nível
  const M = P.MORRO;
  [M.base*.95, M.base*.75, M.topo*.95].forEach((r, i) => el('path', { d: curva(contorno(M.x, M.z, r, M.ondas, 40), true), 'stroke-width': .1, 'stroke-dasharray': '.5 .45', opacity: .55 - i*.05 }, tinta));
  el('path', { d: curva(contorno(M.x, M.z, M.topo, M.ondas, 40), true), fill: '#c3d99a', opacity: .7 }, aguadas);
  // a prainha
  el('path', { d: curva(contorno(P.PRAIA.x, P.PRAIA.z, P.PRAIA.r, P.PRAIA.ondas, 36), true), fill: '#ecd6a2' }, aguadas);
  // as trilhas e a roda no alto da clareira
  Object.values(P.TRILHAS).forEach(l => el('path', { d: linha(l), stroke: '#e6cc93', 'stroke-width': P.LARGURA_TRILHA, fill: 'none', 'stroke-linecap': 'round' }, aguadas));
  el('circle', { cx: P.RODA_CLAREIRA.x, cy: P.RODA_CLAREIRA.z, r: P.RODA_CLAREIRA.r, fill: '#e6cc93' }, aguadas);
  Object.values(P.TRILHAS).forEach(l => el('path', { d: linha(l), 'stroke-width': .1, 'stroke-dasharray': '.7 .5', opacity: .6 }, tinta));
  // o lago
  const agua = contorno(P.LAGO.x, P.LAGO.z, P.LAGO.r, P.LAGO.ondas, 64);
  el('path', { d: curva(agua, true), fill: 'url(#mt-agua)' }, aguadas);
  el('path', { d: curva(contorno(P.LAGO.x, P.LAGO.z, P.LAGO.r*.78, P.LAGO.ondas, 48), true), stroke: '#e4f2f3', 'stroke-width': .18, fill: 'none', opacity: .7 }, aguadas);
  el('path', { d: curva(agua, true), 'stroke-width': .22 }, tinta);
  [[-10, -8, 2.2], [-4, -1, 1.6], [-8, 1, 1.2]].forEach(([x, y, w]) => el('path', { d: `M${x - w} ${y} q${w*.5} -.5 ${w} 0 q${w*.5} .5 ${w} 0`, stroke: '#f6fbfb', 'stroke-width': .14 }, tinta));
  // nenúfares
  P.NENUFARES.forEach(([x, y], i) => {
    el('path', { d: `M${x} ${y} L${x + .75} ${y - .2} A.8 .8 0 1 1 ${x + .6} ${y + .45}Z`, fill: '#7fa85a', transform: `rotate(${i*67} ${x} ${y})` }, aguadas);
    if(i % 2 === 0) el('circle', { cx: x + .15, cy: y - .1, r: .22, fill: '#f4b6c7' }, enfeites);
  });
  // juncos na beira
  P.JUNCOS.forEach(({ a }) => {
    const [x, y] = P.naMargem(a, .4);
    for(let k = -1; k <= 1; k++) el('path', { d: `M${x + k*.18} ${y} q${k*.15} -.6 ${k*.25} -1`, stroke: '#5f8a45', 'stroke-width': .1 }, tinta);
  });
  // o deque
  {
    const D = P.DEQUE, ang = Math.atan2(D.dir[1], D.dir[0])*180/Math.PI;
    const g = el('g', { transform: `translate(${D.x} ${D.z}) rotate(${ang})` }, enfeites);
    el('rect', { x: D.u0, y: -D.meia, width: D.u1 - D.u0, height: 2*D.meia, fill: '#b58b5e', stroke: TINTA, 'stroke-width': .12 }, g);
    for(let i = D.u0 + .4; i < D.u1; i += .62) el('line', { x1: i, y1: -D.meia, x2: i, y2: D.meia, stroke: '#7a5a3c', 'stroke-width': .07 }, g);
  }
  // os dois salgueiros e as copas espalhadas
  salgueiro(aguadas, tinta, P.SALGUEIRO.x, P.SALGUEIRO.z, 1.9);
  { const [x, y] = P.naMargem(3.55, .9); salgueiro(aguadas, tinta, x, y, 1.5); }
  const livre = (x, y, folga) => {
    if(P.sdLago(x, y) < 5.2 || P.distTrilha(x, y) < folga + 1.4) return false;
    if(P.VAGAS.some(v => Math.hypot(v.x - x, v.z - y) < folga + 4.2)) return false;
    if(Math.hypot(x - M.x, y - M.z) < 8.4 || Math.hypot(x - P.SALGUEIRO.x, y - P.SALGUEIRO.z) < 5) return false;
    return Math.hypot(x, y) < P.raioBorda(x, y) - folga - 1;
  };
  const verdes = ['#7ea35a', '#8fb367', '#6f9752', '#9cbc6e'];
  for(let i = 0, n = 0; i < 500 && n < 16; i++){
    const x = (sorte() - .5)*52, y = (sorte() - .5)*52, r = 1.3 + sorte()*.6;
    if(!livre(x, y, r)) continue;
    arvore(aguadas, tinta, sorte, x, y, r, n === 2 || n === 9 ? '#e9a7ba' : verdes[n % 4]); n++;
  }
  mataDaBorda(P, pts, aguadas, tinta, sorte, { longeDe: P.VAGAS.map(v => [v.x, v.z, 4.6]) });
  ponte(P, enfeites, tinta, clipId);
  return {
    posNoMapa: (x, z) => [x, z],
    escala: .9,
    faixas: (pai) => {
      faixa(pai, -9.5, 26.2, 'Margem do Lago', 1.35, 20);
      faixa(pai, M.x, -23.4, 'Clareira do Alto', 1.35, 20);
      faixa(pai, 15.5, 27.4, 'Ponte do Arco-Íris', 1.35, 22);
      el('text', { x: -1, y: 5.6, 'text-anchor': 'middle', 'font-family': LETRA_MAO, 'font-weight': 700, 'font-size': 1.7, fill: TINTA, opacity: .8 }, pai).textContent = 'prainha';
      el('text', { x: 12.6, y: 18.4, 'text-anchor': 'middle', 'font-family': LETRA_MAO, 'font-weight': 700, 'font-size': 1.6, fill: TINTA, opacity: .75, transform: 'rotate(46 12.6 18.4)' }, pai).textContent = 'caminho da ponte';
    },
  };
}

function desenharBosque(svg, aguadas, tinta, enfeites, clipId){
  const P = BOSQUE;
  const sorte = sorteador(53);
  /* Quanto o mapa abre cada clareira: no miolo (até r0) tudo se afasta do centro
     ABRE vezes; dali até r2 o afastamento vai voltando ao normal, sem salto. Tudo
     do Bosque passa por esta conta (borda, riacho, trilhas, árvores, vagas). */
  const ABRE = 1.45;
  const naClareira = (x, z) => P.CLAREIRAS.find(c => Math.hypot(x - c.x, z - c.z) < c.r + .5);
  const posNoMapa = (x, z) => {
    let px = x, pz = z;
    for(const c of P.CLAREIRAS){
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
      if(d < 1e-6) continue;
      const r0 = c.r + .5, r2 = ABRE*r0 + 3;
      if(d >= r2) continue;
      const f = d < r0 ? d*ABRE : ABRE*r0 + (d - r0)*(r2 - ABRE*r0)/(r2 - r0);
      px += dx/d*(f - d); pz += dz/d*(f - d);
    }
    return [px, pz];
  };
  const T = (pts) => pts.map(([x, z]) => posNoMapa(x, z));
  const pts = T(contorno(0, 0, P.BORDA.r, P.BORDA.ondas, 72));
  el('path', { d: curva(pts, true), fill: '#a7c47b', opacity: .62 }, aguadas);
  el('path', { d: curva(pts, true), 'stroke-width': .18, opacity: .6, stroke: '#5f7d45' }, tinta);
  // as clareiras, abertas no mapa
  P.CLAREIRAS.forEach(c => {
    el('path', { d: curva(contorno(c.x, c.z, 3.9*ABRE + 3, [[2, .06, c.x], [3, .05, c.z]], 32), true), fill: '#c6dc9e', opacity: .8 }, aguadas);
  });
  // o riacho
  const riacho = T(P.RIACHO);
  el('path', { d: linha(riacho), stroke: '#8fc3d2', 'stroke-width': 2.9, fill: 'none', 'stroke-linecap': 'round', 'clip-path': `url(#${clipId})` }, aguadas);
  el('path', { d: linha(riacho), stroke: '#e4f2f3', 'stroke-width': .2, fill: 'none', opacity: .8, 'stroke-dasharray': '1.4 1.1', 'clip-path': `url(#${clipId})` }, aguadas);
  // as trilhas e a rodinha no meio de cada clareira
  const trilhas = Object.values(P.TRILHAS).map(T);
  trilhas.forEach(l => el('path', { d: linha(l), stroke: '#e6cc93', 'stroke-width': P.LARGURA_TRILHA, fill: 'none', 'stroke-linecap': 'round' }, aguadas));
  P.CLAREIRAS.forEach(c => el('circle', { cx: c.x, cy: c.z, r: 1.4, fill: '#e6cc93' }, aguadas));
  trilhas.forEach(l => el('path', { d: linha(l), 'stroke-width': .1, 'stroke-dasharray': '.7 .5', opacity: .6 }, tinta));
  // a ponte de pedra
  {
    const B = P.PONTE_PEDRA, ang = Math.atan2(B.eixo[1], B.eixo[0])*180/Math.PI, [bx, bz] = posNoMapa(B.x, B.z);
    const g = el('g', { transform: `translate(${bx} ${bz}) rotate(${ang})` }, enfeites);
    el('rect', { x: -B.meio, y: -B.meiaLargura, width: 2*B.meio, height: 2*B.meiaLargura, rx: .5, fill: '#d6cdbb', stroke: TINTA, 'stroke-width': .14 }, g);
    [-1, 1].forEach(s => el('line', { x1: -B.meio + .4, y1: s*(B.meiaLargura - .25), x2: B.meio - .4, y2: s*(B.meiaLargura - .25), stroke: '#9e9584', 'stroke-width': .2 }, g));
  }
  // os troncos caídos
  P.TRONCOS.forEach(t => {
    const [x, y] = posNoMapa(t.x, t.z), ang = t.rot*180/Math.PI;
    const g = el('g', { transform: `translate(${x} ${y}) rotate(${ang})` }, enfeites);
    el('rect', { x: -t.comp*.75, y: -.38, width: t.comp*1.5, height: .76, rx: .38, fill: '#8a6a48', stroke: TINTA, 'stroke-width': .1 }, g);
    el('ellipse', { cx: t.comp*.75 - .1, cy: 0, rx: .2, ry: .36, fill: '#d8b98c', stroke: TINTA, 'stroke-width': .06 }, g);
  });
  // pinheiros, e umas copas redondas perto da água
  const livre = (x, y) => {
    if(Math.hypot(x, y) > P.raioBorda(x, y) - 2.2) return false;
    if(P.distRiacho(x, y) < 3 || P.distTrilha(x, y) < 2.4) return false;
    if(P.CLAREIRAS.some(c => Math.hypot(x - c.x, y - c.z) < c.r + 1.6)) return false;
    return Math.hypot(x - P.PONTE.x, y - P.PONTE.z) > 4.5;
  };
  const postos = [];
  for(let i = 0, n = 0; i < 1500 && n < 46; i++){
    const x = (sorte() - .5)*52, y = (sorte() - .5)*52;
    if(!livre(x, y) || postos.some(([px, py]) => Math.hypot(px - x, py - y) < 3.1)) continue;
    postos.push([x, y]); n++;
  }
  postos.sort((a, b) => a[1] - b[1]).forEach(([rx, ry], i) => {
    const [x, y] = posNoMapa(rx, ry);
    if(P.distRiacho(rx, ry) < 6 && i % 3 === 0) arvore(aguadas, tinta, sorte, x, y, 1.3, '#8fb367');
    else pinheiro(aguadas, tinta, x, y + 1, 2.4 + sorte()*.8, ['#5f8a45', '#4f7d45', '#6f9752'][i % 3]);
  });
  mataDaBorda(P, pts, aguadas, tinta, sorte, { pinheiros: true, longeDe: [...P.VAGAS.map(v => { const [x, y] = posNoMapa(v.x, v.z); return [x, y, 4.2]; }), ...[[-36, -11.5], [36, 10.5]].map(([x, y]) => [x*.75, y*.75, 4])] });
  // vaga-lumes nas clareiras
  P.CLAREIRAS.forEach(c => { for(let k = 0; k < 5; k++){ const a = sorte()*Math.PI*2, d = 1.4 + sorte()*3; el('circle', { cx: c.x + Math.cos(a)*d*ABRE, cy: c.z + Math.sin(a)*d*ABRE, r: .2, fill: '#f6e27a' }, enfeites); } });
  ponte(P, enfeites, tinta, clipId);
  // o nome de cada clareira num lugar livre de vagas e das outras faixas: a Lua e as
  // Samambaias do lado da entrada; o Recanto acima da vaga do norte; o Riacho abaixo
  // da vaga do sul (do lado da entrada, as faixas vizinhas se encavalavam)
  const LUGAR_DA_FAIXA = { 'Clareira da Lua': [3, -9.9], 'Recanto dos Vaga-lumes': [-20.5, -21.5], 'Clareira das Samambaias': [-7.9, 8.7], 'Clareira do Riacho': [12.5, 21.5] };
  const ondeFaixa = (c) => LUGAR_DA_FAIXA[c.nome];
  return {
    posNoMapa,
    escala: .8,
    // a vaga ao norte do meio da clareira tem o nome em cima
    nomeAcima: (plot) => { const c = naClareira(plot.x, plot.z); return c ? plot.z < c.z - .5 : plot.z < 0; },
    faixas: (pai) => {
      P.CLAREIRAS.forEach(c => { const [x, y] = ondeFaixa(c); faixa(pai, x, y, c.nome, 1.3, 23); });
      faixa(pai, P.PONTE.x + 2, 26.6, 'Ponte do Arco-Íris', 1.3, 22);
    },
  };
}

export function desenharNatural(svg, jardim, aguadas, tinta, enfeites, clipId){
  return jardim === 'bosque' ? desenharBosque(svg, aguadas, tinta, enfeites, clipId) : desenharLago(svg, aguadas, tinta, enfeites, clipId);
}
