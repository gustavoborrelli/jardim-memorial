"use strict";

/*
  PEÇAS DE DESENHO DOS MAPAS (etapa 41)
  Papel, tinta e aquarela: o que o mapa-múndi e os mapas de tesouro dos jardins
  naturais desenham igual. Vieram do esboço aprovado em 2026-11-09. Só SVG, sem 3D:
  carregam antes do jardim.

  Cada SVG tem os seus filtros com um prefixo próprio (`p`): dois SVGs na mesma
  página com o mesmo id disputam o filtro, e o de um mapa escondido não desenha.
*/
const NS = 'http://www.w3.org/2000/svg';
export const TINTA = '#4a3424', VERDE = '#3d6b45', MADEIRA = '#6b4e33';
export const ARCO = ['#e8706b', '#f0a54f', '#f3d36b', '#8cc77d', '#79b1dd', '#a98ad4'];
export const LETRA_TITULO = "'IM Fell English SC', Georgia, serif";
export const LETRA_MAO = "'Caveat', 'Bradley Hand', cursive";
export const LETRA_ITALICO = "'Cormorant Garamond', Georgia, serif";

export function el(tag, attrs, pai){
  const e = document.createElementNS(NS, tag);
  for(const k in attrs) e.setAttribute(k, attrs[k]);
  if(pai) pai.appendChild(e);
  return e;
}
// sorteio com semente: as árvores saem no mesmo lugar toda vez
export function sorteador(s){ return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* curva suave (Catmull-Rom em Bézier) por uma lista de pontos, como `d` de um path */
export function curva(pts, fechada){
  const n = pts.length, P = (i) => fechada ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for(let i = 0; i < (fechada ? n : n - 1); i++){
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0])/6, p1[1] + (p2[1] - p0[1])/6], c2 = [p2[0] - (p3[0] - p1[0])/6, p2[1] - (p3[1] - p1[1])/6];
    d += ` C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return fechada ? d + 'Z' : d;
}
/* polilinha já fina (das plantas) como `d` reto */
export const linha = (pts) => 'M' + pts.map(p => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L');

/* uma forma de contorno natural: raio que ondula com o ângulo */
export function contorno(cx, cy, r, ondas, n = 40){
  const pts = [];
  for(let i = 0; i < n; i++){
    const a = i/n*Math.PI*2;
    let k = 1; ondas.forEach(([f, amp, fase]) => { k += amp*Math.sin(f*a + fase); });
    pts.push([cx + Math.cos(a)*r*k, cy + Math.sin(a)*r*k]);
  }
  return pts;
}

/* filtros e símbolos de um SVG, com prefixo */
export function defs(svg, p){
  const d = el('defs', {}, svg);
  d.innerHTML = `
    <filter id="${p}tinta" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="0.4" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="${p}aquarela" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="3" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="0.15"/></filter>
    <filter id="${p}aquarelaArco" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.25" numOctaves="2" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="0.3" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="0.08"/></filter>
    <filter id="${p}rasgado" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="3" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="${p}graos" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="3" seed="11" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.30  0 0 0 0 0.16  1.1 0 0 0 -0.5"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    <filter id="${p}nevoa" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <radialGradient id="${p}vinheta" cx="50%" cy="45%" r="70%"><stop offset="0%" stop-color="#f6ead0"/><stop offset="62%" stop-color="#efdfbb"/><stop offset="100%" stop-color="#cfb17c"/></radialGradient>
    <radialGradient id="${p}agua" cx="40%" cy="35%" r="70%"><stop offset="0%" stop-color="#bfe0e6"/><stop offset="100%" stop-color="#7fb5c4"/></radialGradient>`;
  return d;
}
/* a folha de papel: vinheta, borda rasgada e grão */
export function folha(svg, p, x, y, w, h){
  el('rect', { x, y, width: w, height: h, rx: 1.2, fill: `url(#${p}vinheta)`, filter: `url(#${p}rasgado)` }, svg);
  el('rect', { x, y, width: w, height: h, fill: '#fff', filter: `url(#${p}graos)`, opacity: .32, style: 'mix-blend-mode:multiply' }, svg);
}

/* ---------- árvores vistas de cima ---------- */
export function arvore(aguadas, tinta, sorte, x, y, r, cor){
  el('ellipse', { cx: x + r*.35, cy: y + r*.4, rx: r*1.05, ry: r*.9, fill: TINTA, opacity: .14 }, aguadas);
  const n = 3 + Math.floor(sorte()*2);
  for(let i = 0; i < n; i++){
    const a = i/n*Math.PI*2 + sorte();
    const bx = x + Math.cos(a)*r*.42, by = y + Math.sin(a)*r*.42, br = r*(.55 + sorte()*.15);
    el('circle', { cx: bx, cy: by, r: br, fill: cor }, aguadas);
    el('circle', { cx: bx, cy: by, r: br, 'stroke-width': r*.08, opacity: .8 }, tinta);
  }
}
export function pinheiro(aguadas, tinta, x, y, h, cor){
  const w = h*.42;
  const d = `M${x} ${y - h} Q${x + w*.25} ${y - h*.55} ${x + w} ${y} Q${x} ${y + h*.08} ${x - w} ${y} Q${x - w*.25} ${y - h*.55} ${x} ${y - h}Z`;
  el('path', { d, fill: cor }, aguadas);
  el('path', { d, 'stroke-width': h*.045 }, tinta);
  el('line', { x1: x, y1: y, x2: x, y2: y + h*.18, stroke: MADEIRA, 'stroke-width': h*.07 }, tinta);
}
export function salgueiro(aguadas, tinta, x, y, r){
  el('ellipse', { cx: x + r*.3, cy: y + r*.5, rx: r*1.1, ry: r*.7, fill: TINTA, opacity: .14 }, aguadas);
  el('circle', { cx: x, cy: y, r, fill: '#a9c77a' }, aguadas);
  for(let i = 0; i < 9; i++){
    const a = Math.PI*.15 + i/8*Math.PI*.7, sx = x + Math.cos(a + Math.PI)*r*.85*(i % 2 ? .7 : 1);
    el('path', { d: `M${sx} ${y - r*.3} q${r*.1} ${r*.6} ${r*.02} ${r*1.25}`, stroke: '#5f8a45', 'stroke-width': r*.09 }, tinta);
  }
  el('circle', { cx: x, cy: y, r, 'stroke-width': r*.07, opacity: .7 }, tinta);
}

/* ---------- nuvem, arco-íris, faixa, cartucho, rosa dos ventos ---------- */
export function nuvem(pai, x, y, s, op = 1){
  const g = el('g', { opacity: op }, pai);
  [[0, 0, 1], [-1.1, .35, .75], [1.15, .3, .8], [.5, -.55, .7], [-.55, -.45, .6]].forEach(([dx, dy, r]) =>
    el('circle', { cx: x + dx*s, cy: y + dy*s, r: r*s, fill: '#fffaf0', stroke: '#c9b48f', 'stroke-width': s*.05 }, g));
  return g;
}
/* arco-íris entre dois pontos: seis arcos aninhados (o vermelho por fora, o violeta
   por dentro), cada um terminando um pouco para dentro do anterior. Paralelos, as
   faixas se sobrepunham nos pés e viravam lama. */
export function arcoIris(pai, p, a, b, altura, w, comPes = true){
  const g = el('g', {}, pai);
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  const ux = dx/L, uy = dy/L;
  let nx = uy, ny = -ux; if(ny > 0){ nx = -nx; ny = -ny; } // a normal que aponta para cima
  const meio = [(a[0] + b[0])/2, (a[1] + b[1])/2];
  el('path', { d: `M${a[0]} ${a[1]} Q${meio[0] + nx*2*altura} ${meio[1] + ny*2*altura} ${b[0]} ${b[1]}`, fill: 'none', stroke: '#fffaf0', 'stroke-width': w*7.4, opacity: .5, 'stroke-linecap': 'round' }, g);
  const cores = el('g', { filter: `url(#${p}aquarelaArco)`, opacity: .92 }, g);
  ARCO.forEach((c, i) => {
    const s = (i - 2.5)*w;
    const p0 = [a[0] + ux*s, a[1] + uy*s], p2 = [b[0] - ux*s, b[1] - uy*s];
    const ctl = [meio[0] + nx*2*(altura - s), meio[1] + ny*2*(altura - s)];
    el('path', { d: `M${p0[0]} ${p0[1]} Q${ctl[0]} ${ctl[1]} ${p2[0]} ${p2[1]}`, fill: 'none', stroke: c, 'stroke-width': w*1.12, 'stroke-linecap': 'butt' }, cores);
  });
  if(comPes){ nuvem(g, a[0], a[1], w*3.1); nuvem(g, b[0], b[1], w*3.1); }
  return g;
}
/* faixa de pergaminho com o texto em arco (mede o texto: o SVG precisa estar visível) */
let faixas = 0;
export function faixa(pai, cx, cy, texto, tam = 1.45, larguraMax = 24){
  const g = el('g', {}, pai);
  const t = el('text', { 'font-family': LETRA_TITULO, 'font-size': tam }, g); t.textContent = texto;
  const w = Math.min(larguraMax, (t.getComputedTextLength() || texto.length*tam*.55) + tam*2.1), h = tam*1.6;
  t.remove();
  const x0 = cx - w/2, x1 = cx + w/2, y0 = cy - h/2, y1 = cy + h/2, dp = h*.24;
  const ponta = (xa, s) => `M${xa - s*h*.2} ${y0 + dp} L${xa + s*h*.55} ${y0 + dp} L${xa + s*h*.3} ${cy + dp} L${xa + s*h*.55} ${y1 + dp} L${xa - s*h*.2} ${y1 + dp} Z`;
  el('path', { d: ponta(x0, -1), fill: '#dcc394', stroke: TINTA, 'stroke-width': tam*.08 }, g);
  el('path', { d: ponta(x1, 1), fill: '#dcc394', stroke: TINTA, 'stroke-width': tam*.08 }, g);
  el('path', { d: `M${x0} ${y0} Q${cx} ${y0 - h*.3} ${x1} ${y0} L${x1} ${y1} Q${cx} ${y1 - h*.3} ${x0} ${y1} Z`, fill: '#f6e9cc', stroke: TINTA, 'stroke-width': tam*.1 }, g);
  const id = `fx${++faixas}`;
  el('path', { id, d: `M${x0 + .3} ${cy + tam*.38} Q${cx} ${cy - tam*.1} ${x1 - .3} ${cy + tam*.38}`, fill: 'none' }, g);
  const tx = el('text', { 'font-family': LETRA_TITULO, 'font-size': tam, fill: TINTA }, g);
  el('textPath', { href: '#' + id, startOffset: '50%', 'text-anchor': 'middle' }, tx).textContent = texto;
  return g;
}
export function cartucho(pai, cx, y, w, titulo, sub){
  const g = el('g', {}, pai);
  el('path', { d: `M${cx - w/2} ${y} L${cx + w/2} ${y} Q${cx + w/2 + 1.6} ${y + 2.6} ${cx + w/2} ${y + 5.2} L${cx - w/2} ${y + 5.2} Q${cx - w/2 - 1.6} ${y + 2.6} ${cx - w/2} ${y}Z`, fill: '#f8edd4', stroke: TINTA, 'stroke-width': .2 }, g);
  el('text', { x: cx, y: y + (sub ? 2.75 : 3.5), 'text-anchor': 'middle', 'font-family': LETRA_TITULO, 'font-size': 2.75, fill: TINTA }, g).textContent = titulo;
  if(sub) el('text', { x: cx, y: y + 4.45, 'text-anchor': 'middle', 'font-family': LETRA_MAO, 'font-size': 1.55, fill: TINTA }, g).textContent = sub;
  return g;
}
export function rosaDosVentos(pai, cx, cy, r){
  const g = el('g', { transform: `translate(${cx} ${cy})` }, pai);
  el('circle', { r: r*.92, fill: 'none', stroke: TINTA, 'stroke-width': r*.03 }, g);
  for(let i = 0; i < 8; i++){
    const a = i*Math.PI/4, longo = i % 2 === 0, R = longo ? r : r*.6, w = longo ? r*.2 : r*.14;
    const pt = (ang, d) => `${Math.sin(ang)*d} ${-Math.cos(ang)*d}`;
    el('path', { d: `M0 0 L${pt(a - Math.PI/2, w)} L${pt(a, R)} Z`, fill: longo ? TINTA : '#a07c58' }, g);
    el('path', { d: `M0 0 L${pt(a + Math.PI/2, w)} L${pt(a, R)} Z`, fill: '#f6ead0', stroke: TINTA, 'stroke-width': r*.02 }, g);
  }
  el('text', { y: -r - r*.15, 'text-anchor': 'middle', 'font-family': LETRA_TITULO, 'font-size': r*.5, fill: TINTA }, g).textContent = 'N';
  return g;
}
