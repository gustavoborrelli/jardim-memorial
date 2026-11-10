"use strict";

/*
  MAPA DE TESOURO
  O jardim visto de cima como um mapa ilustrado: papel envelhecido, traço de
  tinta à mão, aquarela, árvores, a fonte, os quatro campos em faixas de
  pergaminho e, em cada vaga, um medalhão com a foto da homenagem (ou uma vaga
  livre com patinha). Tocar abre uma ficha de pergaminho com "Visitar no jardim"
  e "Mensagens"; numa vaga livre, "Fazer uma homenagem aqui". É a porta rápida
  para quem quer ver quem está lá sem passear (etapa 31).

  As vagas são desenhadas maiores do que no 3D, como nos mapas ilustrados de
  parque: no tamanho real, o medalhão não caberia num toque de celular. A
  posição relativa é a mesma (campo, fileira, coluna): paraMapa() estica as
  distâncias por trechos, e a seta do cachorro passa pela mesma conta.

  Cada jardim tem o seu mapa (etapa 41): o do Jardim Memorial é desenhado aqui; o
  do Jardim do Lago e o do Bosque dos Vaga-lumes, das plantas deles, em
  js/mapaNatural.js. O medalhão, a ficha, a busca e a legenda são os mesmos.

  As medidas saem de planta.js e as homenagens de uma "fonte" trocável: quando o
  site abre, o mapa é a primeira tela (etapa 35) e desenha com uma leitura rápida
  do banco feita por main.js, antes de o 3D existir; quando o jogo fica pronto,
  usarJogo() troca para as homenagens vivas do jardim (lapides.plots), que mudam
  em tempo real. Os botões da ficha só funcionam com o jogo pronto.

  obterMapaUi() devolve sempre o mesmo mapa (main.js e jogo.js o compartilham):
  openMap()/openInicio()/closeMap()/isOpen(), ligarAcoes() para o menuUi.js
  dizer o que cada botão faz, e usarJogo() para a troca de fonte. A ficha mostra as velas
  acesas e as mensagens da homenagem, e "Acender uma vela" acende ali mesmo, sem
  fechar o mapa (etapa 34).
*/

import { PLAZA, AVENUES, BOUNDS } from './planta.js';
import { JARDIM } from './jardins/qual.js';
import { desenharNatural, NOMES_NATURAIS, MEIA_NATURAL } from './mapaNatural.js';
import { cartucho } from './mapaDesenho.js';

const NS = 'http://www.w3.org/2000/svg';
const TINTA = '#4a3424', VERDE = '#3d6b45', MADEIRA = '#6b4e33';

function el(tag, attrs, pai){
  const e = document.createElementNS(NS, tag);
  for(const k in attrs) e.setAttribute(k, attrs[k]);
  if(pai) pai.appendChild(e);
  return e;
}
const normalizar = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escapar = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// sorteio com semente: as árvores saem no mesmo lugar toda vez
function sorteador(s){ return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

let unico = null;
export function obterMapaUi(fonteInicial){
  if(!unico) unico = criarMapaUi(fonteInicial || { plots: [] });
  return unico;
}

function criarMapaUi(fonteInicial){
  // de onde vêm as homenagens: { plots, velasAcesas(id), getMessages(id), getDog(), parar() }
  let fonte = fonteInicial;
  let vivo = false; // fonte viva do jogo: os botões da ficha funcionam
  const modalBack = document.getElementById('mapModalBack');
  const svg = document.getElementById('mapSvg');
  const busca = document.getElementById('mapSearchInput');
  const ficha = document.getElementById('mapFicha');
  const btnFechar = document.getElementById('btnMapClose');

  // o jardim é lido na primeira vez que o mapa desenha: o main.js decide qual antes
  let natural = null; // o que o mapa de um jardim natural devolve (posições, faixas)
  let L = BOUNDS;
  const AV = AVENUES[0].w/2;
  // trechos do esticamento: avenida igual, colunas de vagas (9 e 15) mais afastadas
  const REAL = [0, AV, 9, 15, L], MAPA = [0, AV, 9.5, 19, L];
  function paraMapa(v){
    const s = Math.sign(v) || 1, a = Math.abs(v);
    for(let i = 1; i < REAL.length; i++){
      if(a <= REAL[i] || i === REAL.length - 1){
        const t = (a - REAL[i - 1])/(REAL[i] - REAL[i - 1]);
        return s*(MAPA[i - 1] + t*(MAPA[i] - MAPA[i - 1]));
      }
    }
    return v;
  }

  // onde um ponto do jardim cai no papel, e o tamanho dos medalhões
  const posNoMapa = (x, z) => natural ? natural.posNoMapa(x, z) : [paraMapa(x), paraMapa(z)];
  const escalaMedalhao = () => natural ? natural.escala : 1;

  let acoes = {};
  let camadaDinamica = null;
  let marcadores = []; // [{ plot, g }]
  let atual = null;

  /* ---------- o que não muda: folha, gramado, avenidas, praça, cerca, árvores ---------- */
  function desenharFixo(){
    if(JARDIM !== 'memorial') L = MEIA_NATURAL;
    svg.setAttribute('viewBox', `${-L - 5.5} ${-L - 6} ${2*L + 11} ${2*L + 20}`);
    const defs = el('defs', {}, svg);
    defs.innerHTML = `
      <filter id="mt-tinta" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="2" seed="3" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="0.4" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="mt-aquarela" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="3" seed="7" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G" result="d"/>
        <feGaussianBlur in="d" stdDeviation="0.15"/>
      </filter>
      <filter id="mt-rasgado" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="3" seed="5" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="mt-graos" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="3" seed="11" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.30  0 0 0 0 0.16  1.1 0 0 0 -0.5"/>
        <feComposite in2="SourceGraphic" operator="in"/>
      </filter>
      <radialGradient id="mt-vinheta" cx="50%" cy="45%" r="70%">
        <stop offset="0%" stop-color="#f6ead0"/>
        <stop offset="62%" stop-color="#efdfbb"/>
        <stop offset="100%" stop-color="#cfb17c"/>
      </radialGradient>
      <clipPath id="mt-recorte" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5"/></clipPath>
      <filter id="mt-aquarelaArco" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.25" numOctaves="2" seed="9" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="0.3" xChannelSelector="R" yChannelSelector="G" result="d"/>
        <feGaussianBlur in="d" stdDeviation="0.08"/>
      </filter>
      <radialGradient id="mt-agua" cx="40%" cy="35%" r="70%"><stop offset="0%" stop-color="#bfe0e6"/><stop offset="100%" stop-color="#7fb5c4"/></radialGradient>
      <symbol id="mt-pata" viewBox="-5 -5 10 10">
        <ellipse cx="0" cy="1.6" rx="2.3" ry="1.9"/>
        <ellipse cx="-2.6" cy="-1" rx="0.9" ry="1.2"/>
        <ellipse cx="-0.9" cy="-2.5" rx="0.9" ry="1.25"/>
        <ellipse cx="0.9" cy="-2.5" rx="0.9" ry="1.25"/>
        <ellipse cx="2.6" cy="-1" rx="0.9" ry="1.2"/>
      </symbol>`;

    const F = { x: -L - 4.5, y: -L - 5, w: 2*L + 9, h: 2*L + 18.5 };
    el('rect', { x: F.x, y: F.y, width: F.w, height: F.h, rx: 1.2, fill: 'url(#mt-vinheta)', filter: 'url(#mt-rasgado)' }, svg);
    el('rect', { x: F.x, y: F.y, width: F.w, height: F.h, fill: '#fff', filter: 'url(#mt-graos)', opacity: .32, style: 'mix-blend-mode:multiply' }, svg);

    const aguadas = el('g', { filter: 'url(#mt-aquarela)' }, svg);
    const tinta = el('g', { filter: 'url(#mt-tinta)', fill: 'none', stroke: TINTA, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    const enfeites = el('g', {}, svg);
    if(JARDIM !== 'memorial'){
      // o Lago e o Bosque: desenhados das plantas deles (js/mapaNatural.js)
      el('clipPath', { id: 'mt-papel' }, defs).appendChild(el('rect', { x: F.x, y: F.y, width: F.w, height: F.h }));
      natural = desenharNatural(svg, JARDIM, aguadas, tinta, enfeites, 'mt-papel');
      cartucho(enfeites, 0, -L - 4.6, 30, NOMES_NATURAIS[JARDIM]);
      rosaDosVentos(enfeites);
      camadaDinamica = el('g', {}, svg);
      return;
    }
    const sorte = sorteador(19);
    const PRACA = PLAZA.r - .3;

    // gramado e avenidas
    el('rect', { x: -L, y: -L, width: 2*L, height: 2*L, fill: '#a3c27a', opacity: .6 }, aguadas);
    el('rect', { x: -AV, y: -L - 1, width: 2*AV, height: 2*L + 2, fill: '#e6cc93', opacity: .95 }, aguadas);
    el('rect', { x: -L - 1, y: -AV, width: 2*L + 2, height: 2*AV, fill: '#e6cc93', opacity: .95 }, aguadas);
    [[-AV, PRACA, -AV, L], [AV, PRACA, AV, L], [-AV, -PRACA, -AV, -L], [AV, -PRACA, AV, -L],
     [PRACA, -AV, L, -AV], [PRACA, AV, L, AV], [-PRACA, -AV, -L, -AV], [-PRACA, AV, -L, AV]].forEach(([x1, y1, x2, y2]) => {
      el('line', { x1, y1, x2, y2, 'stroke-width': .16 }, tinta);
    });

    // praça e fonte
    el('circle', { r: PRACA + .3, fill: '#e9d9b6' }, aguadas);
    el('circle', { r: 2.6, fill: '#8fc3d2', opacity: .9 }, aguadas);
    el('circle', { r: PRACA + .3, 'stroke-width': .2 }, tinta);
    el('circle', { r: PRACA - .6, 'stroke-width': .1, 'stroke-dasharray': '.6 .45' }, tinta);
    el('circle', { r: 2.6, 'stroke-width': .18 }, tinta);
    el('circle', { r: .75, fill: '#efe3c8', 'stroke-width': .14 }, tinta);
    [[-1.6, -.5, -.8, -1.4], [.9, 1.2, 1.7, .3], [-1.1, 1.5, -.2, 1.9]].forEach(([x1, y1, x2, y2]) => {
      el('path', { d: `M${x1} ${y1} Q${(x1 + x2)/2 + .3} ${(y1 + y2)/2 - .3} ${x2} ${y2}`, stroke: '#f7fbfb', 'stroke-width': .14 }, tinta);
    });

    // cerca, com portões nas quatro avenidas
    const G = AV + .9;
    const lado = (pts) => el('path', { d: 'M' + pts.map(p => p.join(' ')).join(' L'), 'stroke-width': .22, stroke: MADEIRA, 'stroke-dasharray': '1.1 .45' }, tinta);
    lado([[-L, -G], [-L, -L], [-G, -L]]); lado([[G, -L], [L, -L], [L, -G]]);
    lado([[L, G], [L, L], [G, L]]); lado([[-G, L], [-L, L], [-L, G]]);
    [[-G, -L], [G, -L], [-G, L], [G, L], [-L, -G], [-L, G], [L, -G], [L, G]].forEach(([x, y]) => el('circle', { cx: x, cy: y, r: .45, fill: '#8a6a48', 'stroke-width': .12 }, tinta));

    // jardineiras de terracota ao longo das avenidas
    const flores = ['#e86a6a', '#f2c14e', '#b98ad6', '#ffffff', '#ef8fb0', '#7aa7e0'];
    let canteiro = 0;
    for(const s of [-1, 1]) for(const t of [8, 13.5, 19]) for(const d of [-1, 1]){
      canteiro++;
      [[d*(AV + .55), s*t, .7, 2.6], [s*t, d*(AV + .55), 2.6, .7]].forEach(([cx, cy, w, h]) => {
        el('rect', { x: cx - w/2, y: cy - h/2, width: w, height: h, rx: .2, fill: '#c98a5e', opacity: .9 }, aguadas);
        for(let i = 0; i < 4; i++){
          const f = (i + .5)/4 - .5;
          el('circle', { cx: cx + (w > h ? f*w : 0), cy: cy + (h > w ? f*h : 0), r: .28, fill: flores[(i + canteiro) % flores.length] }, enfeites);
        }
      });
    }

    // árvores em volta da cerca, vistas de cima: copa de três ou quatro bolas
    function arvore(x, y, r, cor){
      el('ellipse', { cx: x + r*.35, cy: y + r*.4, rx: r*1.05, ry: r*.9, fill: TINTA, opacity: .14 }, aguadas);
      const n = 3 + Math.floor(sorte()*2);
      for(let i = 0; i < n; i++){
        const a = i/n*Math.PI*2 + sorte();
        const bx = x + Math.cos(a)*r*.42, by = y + Math.sin(a)*r*.42, br = r*(.55 + sorte()*.15);
        el('circle', { cx: bx, cy: by, r: br, fill: cor }, aguadas);
        el('circle', { cx: bx, cy: by, r: br, 'stroke-width': .12, opacity: .8 }, tinta);
      }
      el('circle', { cx: x - r*.2, cy: y - r*.25, r: r*.28, fill: '#fff', opacity: .18 }, aguadas);
    }
    const verdes = ['#7ea35a', '#8fb367', '#6f9752', '#9cbc6e'];
    const R = L + 2.5;
    let n = 0;
    for(const [ax, ay, dx, dy] of [[-R, -R, 1, 0], [R, -R, 0, 1], [R, R, -1, 0], [-R, R, 0, -1]]){
      for(let t = 0; t < 2*R; t += 3.3 + sorte()*.8){
        const x = ax + dx*t + (sorte() - .5)*.9, y = ay + dy*t + (sorte() - .5)*.9;
        if(Math.abs(x) < AV + 2 || Math.abs(y) < AV + 2) continue; // portões livres
        if(y < -L && Math.abs(x) < 15) continue;                    // espaço do título
        arvore(x, y, 1.35 + sorte()*.5, (n === 5 || n === 23) ? '#e9a7ba' : verdes[n % verdes.length]);
        n++;
      }
    }
    const C = L - 1.9;
    [[C, C], [-C, C], [C, -C], [-C, -C]].forEach(([x, y]) => arvore(x, y, .8, '#88ad62'));

    // rastro de patinhas da entrada (onde o passeio começa) até a praça
    for(let i = 0, y = L - 1.1; y > PRACA + 1.2; i++, y -= 1.55){
      el('use', { href: '#mt-pata', x: (i % 2 ? .55 : -.55) - .5, y: y - .5, width: 1, height: 1, fill: TINTA, opacity: .32 }, enfeites);
    }
    el('text', { x: 0, y: L + 3.1, 'text-anchor': 'middle', class: 'mt-mao', 'font-weight': 700, 'font-size': 2.1, fill: TINTA }, enfeites).textContent = 'Entrada';

    // título
    const yt = -L - 4.5;
    el('path', { d: `M-13 ${yt} L13 ${yt} Q14.6 ${yt + 2} 13 ${yt + 4} L-13 ${yt + 4} Q-14.6 ${yt + 2} -13 ${yt} Z`, fill: '#f8edd4', stroke: TINTA, 'stroke-width': .18 }, enfeites);
    el('path', { d: `M-12.2 ${yt + .6} L12.2 ${yt + .6} Q13.4 ${yt + 2} 12.2 ${yt + 3.4} L-12.2 ${yt + 3.4} Q-13.4 ${yt + 2} -12.2 ${yt + .6} Z`, fill: 'none', stroke: TINTA, 'stroke-width': .08 }, enfeites);
    el('text', { x: 0, y: yt + 2.85, 'text-anchor': 'middle', class: 'mt-titulo', 'font-size': 2.75, fill: TINTA, 'letter-spacing': .08 }, enfeites).textContent = 'Jardim Memorial';

    rosaDosVentos(enfeites);

    camadaDinamica = el('g', {}, svg);
  }

  function rosaDosVentos(enfeites){
    const rosa = el('g', { transform: `translate(${-L + 4} ${L + 8.5})` }, enfeites);
    const r = 3.4;
    el('circle', { r: r*.92, fill: 'none', stroke: TINTA, 'stroke-width': .1 }, rosa);
    el('circle', { r: r*.78, fill: 'none', stroke: TINTA, 'stroke-width': .06, 'stroke-dasharray': '.3 .25' }, rosa);
    for(let i = 0; i < 8; i++){
      const a = i*Math.PI/4, longo = i % 2 === 0, Rr = longo ? r : r*.6, w = longo ? r*.2 : r*.14;
      const p = (ang, d) => `${Math.sin(ang)*d} ${-Math.cos(ang)*d}`;
      el('path', { d: `M0 0 L${p(a - Math.PI/2, w)} L${p(a, Rr)} Z`, fill: longo ? TINTA : '#a07c58' }, rosa);
      el('path', { d: `M0 0 L${p(a + Math.PI/2, w)} L${p(a, Rr)} Z`, fill: '#f6ead0', stroke: TINTA, 'stroke-width': .06 }, rosa);
    }
    el('circle', { r: r*.1, fill: '#f6ead0', stroke: TINTA, 'stroke-width': .08 }, rosa);
    el('text', { y: -r - .5, 'text-anchor': 'middle', class: 'mt-titulo', 'font-size': 1.7, fill: TINTA }, rosa).textContent = 'N';
  }

  /* ---------- o que muda a cada abertura: faixas, vagas, legenda, cachorro ---------- */
  function desenharMedalhao(pai, plot){
    const d = plot.data;
    const [x, y] = posNoMapa(Number(plot.x), Number(plot.z));
    // campos do norte: nome em cima, a faixa do campo fica embaixo
    const acima = natural && natural.nomeAcima ? natural.nomeAcima(plot) : y < 0;
    const nome = d ? d.name || 'Sem nome' : '';
    const k = escalaMedalhao();
    const g = el('g', { class: 'mt-vaga', role: 'button', tabindex: 0, transform: `translate(${x} ${y})${k !== 1 ? ` scale(${k})` : ''}`,
      'aria-label': d ? `${nome}, ${plot.section}` : `Vaga livre, ${plot.section}` }, pai);
    el('circle', { r: 4.1, fill: 'transparent' }, g); // área de toque maior que o desenho
    const corpo = el('g', { class: 'mt-corpo' }, g);
    if(d){
      el('circle', { cx: .35, cy: .45, r: 3.3, fill: TINTA, opacity: .22 }, corpo);
      el('circle', { class: 'mt-aro', r: 3.25, fill: '#f8edd4', stroke: TINTA, 'stroke-width': .2 }, corpo);
      el('circle', { r: 2.98, fill: 'none', stroke: d.cor || '#c9beb0', 'stroke-width': .32 }, corpo);
      if(d.photoUrl){
        el('image', { href: d.photoUrl, x: -2.7, y: -2.7, width: 5.4, height: 5.4, 'clip-path': 'url(#mt-recorte)', preserveAspectRatio: 'xMidYMid slice' }, corpo);
      } else {
        el('circle', { r: 2.7, fill: '#ead9b4' }, corpo);
        el('text', { y: 1.15, 'text-anchor': 'middle', class: 'mt-titulo', 'font-size': 3.3, fill: TINTA }, corpo).textContent = (nome.trim()[0] || '?').toUpperCase();
      }
      el('circle', { r: 2.7, fill: 'none', stroke: TINTA, 'stroke-width': .12 }, corpo);
      const velas = fonte.velasAcesas ? fonte.velasAcesas(d.id) : 0;
      if(velas > 0){
        desenharVela(corpo, 3.15, -.6, .95);
        el('text', { x: 3.95, y: .35, class: 'mt-mao', 'font-weight': 700, 'font-size': 1.35, fill: TINTA }, corpo).textContent = velas;
      }
      el('text', { y: acima ? -3.75 : 4.75, 'text-anchor': 'middle', class: 'mt-mao', 'font-weight': 700, 'font-size': 2, fill: TINTA,
        stroke: '#f3e6c6', 'stroke-width': .55, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, corpo).textContent = nome.length > 14 ? nome.slice(0, 13) + '…' : nome;
    } else {
      el('circle', { r: 2.55, fill: 'rgba(255,250,235,.45)', stroke: VERDE, 'stroke-width': .18, 'stroke-dasharray': '.7 .45' }, corpo);
      el('use', { href: '#mt-pata', x: -1.35, y: -1.45, width: 2.7, height: 2.7, fill: VERDE, opacity: .55 }, corpo);
      el('text', { y: acima ? -3.1 : 3.95, 'text-anchor': 'middle', class: 'mt-mao', 'font-weight': 500, 'font-size': 1.55, fill: VERDE,
        stroke: '#f3e6c6', 'stroke-width': .45, 'paint-order': 'stroke' }, corpo).textContent = 'vaga livre';
    }
    g.addEventListener('click', (e) => { e.stopPropagation(); abrirFicha(plot, g); });
    g.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); abrirFicha(plot, g); } });
    return g;
  }

  function desenharVela(pai, x, y, escala){
    const g = el('g', { transform: `translate(${x} ${y}) scale(${escala})` }, pai);
    el('circle', { cy: -.2, r: 1.5, fill: '#ffcf6b', opacity: .35 }, g);
    el('rect', { x: -.32, y: .1, width: .64, height: 1.1, rx: .12, fill: '#f6efe0', stroke: TINTA, 'stroke-width': .1 }, g);
    el('path', { class: 'mt-chama', d: 'M0 -1.25 C.55 -.6 .5 -.05 0 .1 C-.5 -.05 -.55 -.6 0 -1.25 Z', fill: '#e39a32', stroke: TINTA, 'stroke-width': .08 }, g);
  }

  function desenharFaixas(pai){
    if(natural){ natural.faixas(pai); return; }
    const campos = new Map();
    fonte.plots.forEach(p => {
      if(!campos.has(p.section)) campos.set(p.section, { x: 0, z: 0, n: 0 });
      const c = campos.get(p.section); c.x += p.x; c.z += p.z; c.n++;
    });
    let i = 0;
    campos.forEach((c, nome) => {
      const sx = Math.sign(c.x) || 1, sz = Math.sign(c.z) || 1;
      const cx = sx*14.25, cy = sz*4.35;
      const g = el('g', {}, pai);
      const medida = el('text', { class: 'mt-titulo', 'font-size': 1.45 }, g);
      medida.textContent = nome;
      const w = Math.min(21, (medida.getComputedTextLength() || nome.length*.8) + 3), h = 2.3;
      medida.remove();
      const x0 = cx - w/2, x1 = cx + w/2, y0 = cy - h/2, y1 = cy + h/2;
      const ponta = (xa, s) => `M${xa - s*.5} ${y0 + .55} L${xa + s*1.3} ${y0 + .55} L${xa + s*.7} ${cy + .55} L${xa + s*1.3} ${y1 + .55} L${xa - s*.5} ${y1 + .55} Z`;
      el('path', { d: ponta(x0, -1), fill: '#dcc394', stroke: TINTA, 'stroke-width': .12 }, g);
      el('path', { d: ponta(x1, 1), fill: '#dcc394', stroke: TINTA, 'stroke-width': .12 }, g);
      el('path', { d: `M${x0} ${y0} Q${cx} ${y0 - .7} ${x1} ${y0} L${x1} ${y1} Q${cx} ${y1 - .7} ${x0} ${y1} Z`, fill: '#f6e9cc', stroke: TINTA, 'stroke-width': .14 }, g);
      el('path', { id: `mt-faixa${i}`, d: `M${x0 + .4} ${cy + .55} Q${cx} ${cy - .15} ${x1 - .4} ${cy + .55}`, fill: 'none' }, g);
      const texto = el('text', { class: 'mt-titulo', 'font-size': 1.45, fill: TINTA }, g);
      el('textPath', { href: `#mt-faixa${i}`, startOffset: '50%', 'text-anchor': 'middle' }, texto).textContent = nome;
      // arco de entrada do campo, na avenida norte-sul, entre as duas fileiras
      const ax = sx*4.25, ay = sz*14.25;
      el('path', { d: `M${ax - .8} ${ay + .55} L${ax - .8} ${ay - .3} Q${ax} ${ay - 1.25} ${ax + .8} ${ay - .3} L${ax + .8} ${ay + .55}`, fill: 'none', stroke: MADEIRA, 'stroke-width': .2, 'stroke-linecap': 'round' }, g);
      el('line', { x1: ax - .55, y1: ay - .2, x2: ax + .55, y2: ay - .2, stroke: MADEIRA, 'stroke-width': .14 }, g);
      i++;
    });
  }

  function desenharLegenda(pai){
    const g = el('g', { transform: `translate(${-L + 9.5} ${L + 5.1})` }, pai);
    el('rect', { x: 0, y: 0, width: 30, height: 8, rx: .5, fill: '#f8edd4', stroke: TINTA, 'stroke-width': .16 }, g);
    el('rect', { x: .45, y: .45, width: 29.1, height: 7.1, rx: .35, fill: 'none', stroke: TINTA, 'stroke-width': .06 }, g);
    const ocupadas = fonte.plots.filter(p => p.occupied && p.data).length, livres = fonte.plots.length - ocupadas;
    el('text', { x: 15, y: 2.05, 'text-anchor': 'middle', class: 'mt-titulo', 'font-size': 1.3, fill: TINTA }, g).textContent =
      `${ocupadas} ${ocupadas === 1 ? 'homenagem' : 'homenagens'} · ${livres} ${livres === 1 ? 'vaga livre' : 'vagas livres'}`;
    el('circle', { cx: 2.2, cy: 4.6, r: 1, fill: '#f8edd4', stroke: TINTA, 'stroke-width': .12 }, g);
    el('circle', { cx: 2.2, cy: 4.6, r: .75, fill: '#d9b98c' }, g);
    el('text', { x: 3.6, y: 5.05, class: 'mt-mao', 'font-size': 1.45, fill: TINTA }, g).textContent = 'homenagem';
    el('circle', { cx: 12.2, cy: 4.6, r: .9, fill: 'none', stroke: VERDE, 'stroke-width': .12, 'stroke-dasharray': '.4 .3' }, g);
    el('use', { href: '#mt-pata', x: 11.6, y: 4, width: 1.2, height: 1.2, fill: VERDE, opacity: .6 }, g);
    el('text', { x: 13.5, y: 5.05, class: 'mt-mao', 'font-size': 1.45, fill: TINTA }, g).textContent = 'vaga livre';
    desenharVela(g, 20.4, 4.85, .62);
    el('text', { x: 21.2, y: 5.05, class: 'mt-mao', 'font-size': 1.45, fill: TINTA }, g).textContent = 'velas';
    el('polygon', { points: '25.4,3.7 26.2,5.4 24.6,5.4', fill: '#e39a32', stroke: TINTA, 'stroke-width': .1 }, g);
    el('text', { x: 26.8, y: 5.05, class: 'mt-mao', 'font-size': 1.45, fill: TINTA }, g).textContent = 'você';
  }

  // onde o cachorro está e para onde olha. O rotation.y do three.js, visto de cima
  // (x para a direita, z para baixo), gira ao contrário do rotate() do SVG: o ângulo
  // é negado, senão a seta sai espelhada leste-oeste (etapa 18).
  function desenharCachorro(pai){
    const dog = fonte.getDog && fonte.getDog();
    if(!dog) return;
    const [x, y] = posNoMapa(dog.position.x, dog.position.z);
    const g = el('g', { class: 'mt-voce', transform: `translate(${x} ${y}) rotate(${-dog.rotation.y*180/Math.PI})` }, pai);
    el('circle', { r: 1.5, fill: '#ffcf6b', opacity: .35 }, g);
    el('polygon', { points: '0,1.25 .85,-.75 -.85,-.75', fill: '#e39a32', stroke: TINTA, 'stroke-width': .14, 'stroke-linejoin': 'round' }, g);
  }

  function redesenhar(){
    if(!camadaDinamica) desenharFixo();
    camadaDinamica.innerHTML = '';
    desenharFaixas(camadaDinamica);
    desenharLegenda(camadaDinamica);
    const vagas = el('g', {}, camadaDinamica);
    marcadores = fonte.plots.map(plot => ({ plot, g: desenharMedalhao(vagas, plot) }));
    desenharCachorro(camadaDinamica);
  }

  /* ---------- busca: esmaece quem não bate ---------- */
  function filtrar(){
    const q = normalizar(busca.value.trim());
    marcadores.forEach(({ plot, g }) => {
      const bate = !q || (plot.occupied && plot.data && normalizar(plot.data.name).includes(q));
      g.classList.toggle('mt-apagada', !bate);
      g.classList.toggle('mt-achada', !!q && bate);
    });
  }
  busca.addEventListener('input', filtrar);

  /* ---------- ficha de pergaminho ---------- */
  function abrirFicha(plot, g){
    if(atual) atual.classList.remove('mt-ativa');
    atual = g;
    g.classList.add('mt-ativa');
    const d = plot.occupied && plot.data;
    if(d){
      const moldura = d.photoUrl
        ? `<div class="mt-moldura" style="--cor:${escapar(d.cor || '#c9beb0')}"><img src="${escapar(d.photoUrl)}" alt="Foto de ${escapar(d.name)}"></div>`
        : `<div class="mt-moldura mt-inicial" style="--cor:${escapar(d.cor || '#c9beb0')}"><span>${escapar((d.name || '?').trim()[0] || '?')}</span></div>`;
      ficha.innerHTML = `
        <div class="mt-alca"></div>
        <div class="mt-ficha-topo">
          ${moldura}
          <div class="mt-ficha-nome"><h3>${escapar(d.name || 'Sem nome')}</h3><p class="mt-datas">${d.dates ? escapar(d.dates) + ' · ' : ''}${escapar(plot.section)}</p></div>
          <button class="mt-fechar-ficha" type="button" aria-label="Fechar a ficha">×</button>
        </div>
        ${d.msg ? `<p class="mt-msg">“${escapar(d.msg)}”</p>` : ''}
        <p class="mt-vida"><svg viewBox="-1 -1.5 2 3" aria-hidden="true"><rect x="-.32" y=".1" width=".64" height="1.1" rx=".12" fill="#f6efe0" stroke="#4a3424" stroke-width=".1"/><path d="M0 -1.25 C.55 -.6 .5 -.05 0 .1 C-.5 -.05 -.55 -.6 0 -1.25 Z" fill="#e39a32" stroke="#4a3424" stroke-width=".08"/></svg><span class="mt-vida-texto"></span></p>
        <div class="mt-acoes">
          <button class="mt-btn mt-primario mt-largo" type="button" data-acao="vela" data-fica="1">Acender uma vela</button>
          <button class="mt-btn" type="button" data-acao="mensagens" data-fica="1">Mensagens</button>
          <button class="mt-btn" type="button" data-acao="visitar">Visitar no jardim</button>
        </div>
        ${acoes.podeEditar && acoes.podeEditar(plot) ? '<p class="mt-nota"><button class="mt-link" type="button" data-acao="editar" data-fica="1">Editar esta homenagem</button></p>' : ''}`;
    } else {
      ficha.innerHTML = `
        <div class="mt-alca"></div>
        <div class="mt-ficha-topo">
          <div class="mt-moldura mt-vazia"><svg viewBox="-5 -5 10 10" aria-hidden="true"><use href="#mt-pata" x="-5" y="-5" width="10" height="10" fill="${VERDE}" opacity=".7"/></svg></div>
          <div class="mt-ficha-nome"><h3>Vaga livre</h3><p class="mt-datas">${escapar(plot.section)}</p></div>
          <button class="mt-fechar-ficha" type="button" aria-label="Fechar a ficha">×</button>
        </div>
        <p class="mt-texto">Aqui pode ficar a homenagem do seu companheiro, com nome, foto, datas e uma mensagem.</p>
        <div class="mt-acoes"><button class="mt-btn mt-primario" type="button" data-acao="criar" data-fica="1">Fazer uma homenagem aqui</button></div>
        <p class="mt-nota">Para gravar, você entra com sua conta Google.</p>`;
    }
    ficha.querySelector('.mt-fechar-ficha').addEventListener('click', fecharFicha);
    if(!vivo){
      // o jardim ainda está sendo montado: a ficha já mostra tudo, os botões esperam
      ficha.querySelectorAll('[data-acao]').forEach(b => { b.disabled = true; });
      ficha.querySelector('.mt-acoes').insertAdjacentHTML('afterend', '<p class="mt-nota">preparando o jardim…</p>');
    }
    ficha.querySelectorAll('[data-acao]').forEach(b => b.addEventListener('click', () => {
      const f = acoes[b.dataset.acao];
      // só "Visitar no jardim" sai do mapa; vela, mensagens, criar e editar abrem por
      // cima dele, e ao terminar a pessoa está de volta ao mapa (na primeira tela,
      // fechar o mapa deixava um jardim pausado e sem botões)
      if(b.dataset.fica){ if(f) f(plot, b); return; }
      closeMap();
      if(f) f(plot);
    }));
    ficha.classList.add('aberta');
    if(d) atualizarVida(plot);
  }

  // "3 velas acesas · 5 mensagens": as velas vêm do jardim, as mensagens do banco
  let pedidoMsgs = 0;
  async function atualizarVida(plot){
    const alvo = ficha.querySelector('.mt-vida-texto');
    if(!alvo || !plot.data) return;
    const velas = fonte.velasAcesas ? fonte.velasAcesas(plot.data.id) : 0;
    const textoVelas = velas === 0 ? 'Nenhuma vela acesa' : velas === 1 ? '1 vela acesa' : `${velas} velas acesas`;
    alvo.textContent = textoVelas;
    const meu = ++pedidoMsgs;
    const msgs = fonte.getMessages ? await fonte.getMessages(plot.data.id) : [];
    if(meu !== pedidoMsgs || !ficha.contains(alvo)) return;
    alvo.textContent = `${textoVelas} · ${msgs.length === 1 ? '1 mensagem' : `${msgs.length} mensagens`}`;
  }

  // depois de acender: o medalhão ganha a velinha e a ficha, a contagem nova
  function velaAcesa(plot){
    const m = marcadores.find(mk => mk.plot === plot);
    if(m){
      const eraAtual = atual === m.g;
      const novo = desenharMedalhao(m.g.parentNode, plot);
      m.g.replaceWith(novo);
      m.g = novo;
      if(eraAtual){ novo.classList.add('mt-ativa'); atual = novo; }
    }
    atualizarVida(plot);
  }
  // abre o mapa já com a ficha de uma vaga (volta do livro de mensagens, volta do login)
  function abrirFichaDe(plot){
    if(!isOpen()) openMap();
    const m = marcadores.find(mk => mk.plot === plot);
    if(m) abrirFicha(plot, m.g);
  }
  function fecharFicha(){
    ficha.classList.remove('aberta');
    if(atual) atual.classList.remove('mt-ativa');
    atual = null;
  }
  // tocar no papel fora de um medalhão fecha a ficha
  svg.addEventListener('click', fecharFicha);

  function openMap(){
    modalBack.classList.remove('mt-modo-inicio');
    abrir();
  }
  // a primeira tela do site: o mapa com "Passear no jardim" embaixo e sem o ×
  function openInicio(){
    modalBack.classList.add('mt-modo-inicio');
    document.body.classList.add('em-casa');
    abrir();
  }
  function isInicio(){ return isOpen() && modalBack.classList.contains('mt-modo-inicio'); }
  function abrir(){
    redesenhar();
    busca.value = '';
    filtrar();
    fecharFicha();
    modalBack.classList.add('open');
    if(fonte.parar) fonte.parar(); // para o cachorro na hora, senão ele some pelo jardim atrás do mapa
    // as faixas medem o texto: se a fonte do título ainda não tinha chegado, mede de novo
    const letra = '10px "IM Fell English SC"';
    if(document.fonts && document.fonts.check && !document.fonts.check(letra)){
      document.fonts.load(letra).then(() => { if(isOpen() && !atual){ redesenhar(); filtrar(); } }).catch(() => {});
    }
  }
  function closeMap(){
    fecharFicha();
    modalBack.classList.remove('open', 'mt-modo-inicio');
    document.body.classList.remove('em-casa');
  }

  // troca a fonte das homenagens sem fechar o mapa nem perder a ficha aberta
  function trocarFonte(nova, { viva = vivo } = {}){
    const aberta = atual && marcadores.find(m => m.g === atual);
    const onde = aberta ? [aberta.plot.x, aberta.plot.z] : null;
    fonte = nova;
    vivo = viva;
    if(!isOpen()) return;
    redesenhar();
    filtrar();
    if(onde){
      const m = marcadores.find(mk => Number(mk.plot.x) === onde[0] && Number(mk.plot.z) === onde[1]);
      if(m) abrirFicha(m.plot, m.g);
    } else fecharFicha();
  }
  // o jogo ficou pronto: quando as pedras e as velas carregarem, o mapa passa a
  // usar as homenagens vivas do jardim e os botões da ficha começam a funcionar
  function usarJogo({ lapides, world, dogController }){
    return Promise.all([lapides.carregadas, world.velasCarregadas]).then(() => {
      trocarFonte({
        plots: lapides.plots,
        velasAcesas: (id) => world.velasAcesas(id),
        getMessages: (id) => lapides.getMessages(id),
        getDog: () => dogController.getDog(),
        parar: () => dogController.resetKeys(),
      }, { viva: true });
    });
  }
  function isOpen(){
    return modalBack.classList.contains('open');
  }
  // Esc: fecha a ficha antes do mapa (a primeira tela não se fecha com Esc)
  function fecharUmPasso(){
    if(ficha.classList.contains('aberta')){ fecharFicha(); return; }
    if(!isInicio()) closeMap();
  }
  function ligarAcoes(a){ acoes = a || {}; }

  btnFechar.addEventListener('click', closeMap);
  modalBack.addEventListener('click', e => { if(e.target === modalBack && !isInicio()) closeMap(); });

  const ehVivo = () => vivo;
  // redesenha com as homenagens de agora (depois de criar ou editar), sem perder a ficha
  function atualizar(){ trocarFonte(fonte); }

  return { openMap, openInicio, isInicio, closeMap, isOpen, fecharUmPasso, ligarAcoes, velaAcesa, abrirFichaDe, trocarFonte, usarJogo, ehVivo, atualizar };
}
