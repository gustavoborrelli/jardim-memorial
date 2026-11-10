"use strict";

/*
  O MAPA-MÚNDI (etapa 41)
  A primeira tela do site: os três jardins num vale, ligados pela Ponte do
  Arco-Íris, do esboço aprovado em 2026-11-09. Cada jardim com a sua miniatura e a
  conta de homenagens e vagas livres; ao norte, "terras por descobrir" na névoa.

  Tocar num jardim abre a ficha de pergaminho com "Ver as homenagens" (o mapa de
  tesouro dele) e "Passear aqui". No jardim desta página, as duas coisas abrem na
  hora; num outro jardim, a página atravessa a ponte (js/atravessar.js).

  Também abre por cima do mapa de tesouro, pelo "← Os jardins" dele.
  obterMundi() devolve sempre o mesmo: abrir({ primeira }), fechar(), isOpen(),
  isInicio(), fecharUmPasso(), ligar(acoes), pronto(bool).
*/
import { el, sorteador, curva, contorno, defs, folha, arvore, pinheiro, salgueiro, nuvem, arcoIris, faixa, cartucho, rosaDosVentos, TINTA, MADEIRA, LETRA_MAO, LETRA_ITALICO } from './mapaDesenho.js';
import { JARDIM } from './jardins/qual.js';

export const JARDINS = {
  memorial: {
    nome: 'Jardim Memorial', vagas: 16, x: 50, y: 103,
    texto: 'O primeiro jardim: ensolarado e formal, com avenidas, canteiros de terracota, cerejeiras e a fonte no meio da praça.',
    tracos: ['fonte na praça', 'cerejeiras', 'avenidas e canteiros', 'quatro campos'],
  },
  lago: {
    nome: 'Jardim do Lago', vagas: 13, x: 27, y: 62,
    texto: 'Um jardim à beira d’água, sem nada no centro: o lago fica de lado, com margem irregular, uma prainha, um deque e um salgueiro. A trilha contorna a água e sobe até uma clareira no alto.',
    tracos: ['lago de margem natural', 'deque e prainha', 'salgueiro', 'clareira no alto', 'pôr do sol na água'],
  },
  bosque: {
    nome: 'Bosque dos Vaga-lumes', vagas: 14, x: 73, y: 58,
    texto: 'Uma trilha sinuosa entre pinheiros, com clareiras de três ou quatro vagas, um riacho com uma pontezinha de pedra e vaga-lumes ao entardecer.',
    tracos: ['pinheiros', 'riacho e ponte de pedra', 'clareiras', 'vaga-lumes'],
  },
};
const escapar = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const P = 'mm-'; // prefixo dos filtros deste SVG

let unico = null;
export function obterMundi(){
  if(!unico) unico = criarMundi();
  return unico;
}

function criarMundi(){
  const fundo = document.getElementById('mundiBack');
  const svg = document.getElementById('mundiSvg');
  const ficha = document.getElementById('mundiFicha');
  let acoes = {};
  let contagens = null; // { memorial: n, lago: n, bosque: n } homenagens; null enquanto não chega
  let jogoPronto = false;
  let atual = null;

  /* ---------- o vale, as pontes, a névoa e os três jardins ---------- */
  function desenhar(){
    while(svg.firstChild) svg.firstChild.remove();
    defs(svg, P);
    const sorte = sorteador(31);
    folha(svg, P, 2, 2, 96, 128);
    const aguadas = el('g', { filter: `url(#${P}aquarela)` }, svg);
    const tinta = el('g', { filter: `url(#${P}tinta)`, fill: 'none', stroke: TINTA, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    const enfeites = el('g', {}, svg);
    const alvos = el('g', {}, svg);

    // a terra: um vale verde de contorno natural, com morros ao norte
    const terra = contorno(50, 70, 41, [[2, .07, .4], [3, .06, 1.7], [5, .035, .2], [7, .02, 2.5]], 60).map(([x, y]) => [x, 70 + (y - 70)*1.38]);
    el('path', { d: curva(terra, true), fill: '#b4cd8a', opacity: .55 }, aguadas);
    el('path', { d: curva(terra, true), 'stroke-width': .25, opacity: .8 }, tinta);
    terra.forEach(([x, y], i) => { if(i % 2) return; const dx = x - 50, dy = (y - 70)/1.38, L = Math.hypot(dx, dy); el('line', { x1: x + dx/L*.6, y1: y + dy/L*.6*1.38, x2: x + dx/L*1.7, y2: y + dy/L*1.7*1.38, 'stroke-width': .12, opacity: .45 }, tinta); });
    // um rio que desce dos morros e passa entre os jardins
    const rio = [[60, 15], [55, 30], [61, 45], [52, 60], [45, 72], [48, 84], [40, 98], [33, 112], [26, 124]];
    el('path', { d: curva(rio), stroke: '#8fc3d2', 'stroke-width': 1.6, fill: 'none', opacity: .9 }, aguadas);
    el('path', { d: curva(rio), 'stroke-width': .14, opacity: .5 }, tinta);
    // morros ao norte
    [[20, 22, 7], [32, 16, 9], [46, 13, 8], [70, 14, 10], [84, 21, 7]].forEach(([x, y, s]) => {
      const d = `M${x - s} ${y + s*.5} Q${x - s*.3} ${y - s*.55} ${x} ${y - s*.6} Q${x + s*.35} ${y - s*.5} ${x + s} ${y + s*.5}`;
      el('path', { d, fill: '#cdbb8e' }, aguadas);
      el('path', { d, 'stroke-width': .22 }, tinta);
      el('path', { d: `M${x} ${y - s*.6} q${s*.12} ${s*.5} ${s*.05} ${s*.9}`, 'stroke-width': .1, opacity: .5 }, tinta);
    });
    // árvores soltas pela terra, longe dos jardins
    const longe = [[50, 104, 14], [26, 66, 12], [74, 62, 13], [50, 30, 14]];
    for(let i = 0; i < 70; i++){
      const x = 12 + sorte()*76, y = 30 + sorte()*92;
      const dx = x - 50, dy = (y - 70)/1.38;
      if(Math.hypot(dx, dy) > 37) continue;
      if(longe.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) < r)) continue;
      if(sorte() < .35) pinheiro(aguadas, tinta, x, y, 2.2 + sorte(), '#6f9752');
      else arvore(aguadas, tinta, sorte, x, y, 1 + sorte()*.5, ['#7ea35a', '#8fb367', '#9cbc6e'][i % 3]);
    }

    // as pontes do arco-íris: do Jardim Memorial para os outros dois, e entre eles
    arcoIris(enfeites, P, [42.5, 95], [34.5, 67], 6.5, .62);
    arcoIris(enfeites, P, [57.5, 95], [65.5, 64.5], 6.5, .62);
    arcoIris(enfeites, P, [34, 55.5], [66, 52], 6.5, .5);

    // terras por descobrir: névoa e nuvens onde os próximos jardins vão nascer
    const nevoa = el('g', {}, enfeites);
    el('ellipse', { cx: 50, cy: 30, rx: 17, ry: 9, fill: '#fffaf0', opacity: .9, filter: `url(#${P}nevoa)` }, nevoa);
    nuvem(nevoa, 42, 30, 2.4); nuvem(nevoa, 56, 28, 2.8); nuvem(nevoa, 50, 34, 2.2);
    el('text', { x: 50, y: 29.6, 'text-anchor': 'middle', 'font-family': LETRA_ITALICO, 'font-style': 'italic', 'font-size': 2.4, fill: TINTA }, nevoa).textContent = 'terras por descobrir';
    el('text', { x: 50, y: 32.6, 'text-anchor': 'middle', 'font-family': LETRA_MAO, 'font-size': 1.7, fill: TINTA, opacity: .8 }, nevoa).textContent = 'o próximo jardim nasce quando estes encherem';

    // os três jardins, cada um com o seu desenho
    function jardim(chave, desenho){
      const J = JARDINS[chave];
      const n = contagens ? contagens[chave] || 0 : null;
      const resumo = n === null ? '' : n ? `${n} ${n === 1 ? 'homenagem' : 'homenagens'} · ${J.vagas - n} ${J.vagas - n === 1 ? 'vaga livre' : 'vagas livres'}` : `${J.vagas} vagas livres`;
      const g = el('g', { class: 'mm-alvo', role: 'button', tabindex: 0, 'data-jardim': chave, 'aria-label': `${J.nome}${resumo ? ', ' + resumo : ''}` }, alvos);
      el('circle', { cx: J.x, cy: J.y, r: 12, fill: 'transparent' }, g);
      const corpo = el('g', { class: 'mm-corpo' }, g);
      desenho(corpo, J.x, J.y);
      faixa(corpo, J.x, J.y + 10.5, J.nome, 1.7, 30);
      if(resumo) el('text', { x: J.x, y: J.y + 14.2, 'text-anchor': 'middle', 'font-family': LETRA_MAO, 'font-weight': 700, 'font-size': 1.75, fill: TINTA, stroke: '#f3e6c6', 'stroke-width': .5, 'paint-order': 'stroke' }, corpo).textContent = resumo;
      if(chave === JARDIM){
        // "você está aqui", com a patinha
        const v = el('g', { transform: `translate(${J.x + 9.5} ${J.y - 8.5})` }, corpo);
        el('circle', { r: 2.1, fill: '#e39a32', stroke: TINTA, 'stroke-width': .16 }, v);
        el('text', { y: .75, 'text-anchor': 'middle', 'font-size': 2.1 }, v).textContent = '🐾';
        el('text', { x: 0, y: -2.7, 'text-anchor': 'middle', 'font-family': LETRA_MAO, 'font-weight': 700, 'font-size': 1.6, fill: TINTA, stroke: '#f3e6c6', 'stroke-width': .45, 'paint-order': 'stroke' }, v).textContent = 'você está aqui';
      }
      g.addEventListener('click', (e) => { e.stopPropagation(); abrirFicha(chave, g); });
      g.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); abrirFicha(chave, g); } });
    }
    jardim('memorial', (p, cx, cy) => {
      const a = el('g', { filter: `url(#${P}aquarela)` }, p), t = el('g', { filter: `url(#${P}tinta)`, fill: 'none', stroke: TINTA, 'stroke-linecap': 'round' }, p);
      el('rect', { x: cx - 8, y: cy - 7, width: 16, height: 14, rx: .6, fill: '#a3c27a' }, a);
      el('rect', { x: cx - 1, y: cy - 7.5, width: 2, height: 15, fill: '#e6cc93' }, a);
      el('rect', { x: cx - 8.5, y: cy - 1, width: 17, height: 2, fill: '#e6cc93' }, a);
      el('circle', { cx, cy, r: 2.3, fill: '#e9d9b6' }, a); el('circle', { cx, cy, r: 1.1, fill: '#8fc3d2' }, a);
      el('rect', { x: cx - 8, y: cy - 7, width: 16, height: 14, rx: .6, 'stroke-width': .22, stroke: MADEIRA, 'stroke-dasharray': '.9 .4' }, t);
      el('circle', { cx, cy, r: 2.3, 'stroke-width': .14 }, t);
      [[-5, -4.5], [5, -4.5], [-5, 4], [5, 4]].forEach(([dx, dy]) => el('circle', { cx: cx + dx, cy: cy + dy, r: .55, fill: '#f8edd4', 'stroke-width': .12 }, t));
      arvore(a, t, sorteador(4), cx - 10, cy - 6, 1.5, '#e9a7ba'); arvore(a, t, sorteador(5), cx + 10, cy + 5, 1.4, '#8fb367');
    });
    jardim('lago', (p, cx, cy) => {
      const a = el('g', { filter: `url(#${P}aquarela)` }, p), t = el('g', { filter: `url(#${P}tinta)`, fill: 'none', stroke: TINTA, 'stroke-linecap': 'round' }, p);
      el('path', { d: curva(contorno(cx + 1, cy, 8.5, [[2, .08, .3], [3, .07, 1.2]]), true), fill: '#a8c57c' }, a);
      const lago = contorno(cx - 2, cy - 1.5, 4.6, [[2, .14, .9], [3, .1, 2.1], [5, .05, .4]]);
      el('path', { d: curva(lago, true), fill: `url(#${P}agua)` }, a);
      el('path', { d: curva(lago, true), 'stroke-width': .18 }, t);
      el('path', { d: curva(contorno(cx - 2, cy - 1.5, 6.4, [[2, .12, .9], [3, .08, 2.1]]), true), stroke: '#c9a978', 'stroke-width': .35, 'stroke-dasharray': '.6 .4' }, t);
      el('rect', { x: cx - 6.8, y: cy + .2, width: 2.6, height: .6, fill: '#a07c58', transform: `rotate(-28 ${cx - 5.5} ${cy + .5})` }, a);
      salgueiro(a, t, cx + 4.5, cy - 4, 1.6); arvore(a, t, sorteador(8), cx + 5.5, cy + 3.5, 1.2, '#8fb367');
    });
    jardim('bosque', (p, cx, cy) => {
      const a = el('g', { filter: `url(#${P}aquarela)` }, p), t = el('g', { filter: `url(#${P}tinta)`, fill: 'none', stroke: TINTA, 'stroke-linecap': 'round' }, p);
      el('path', { d: curva(contorno(cx, cy, 8.5, [[2, .09, 1.3], [3, .06, .2]]), true), fill: '#93b46c' }, a);
      el('path', { d: curva([[cx - 8, cy - 3], [cx - 3, cy - 1], [cx + 1, cy + 2.5], [cx + 7, cy + 4]]), stroke: '#8fc3d2', 'stroke-width': .8, fill: 'none' }, a);
      el('path', { d: curva([[cx - 4, cy + 6], [cx - 1, cy + 1], [cx + 3, cy - 2], [cx + 2, cy - 6]]), stroke: '#c9a978', 'stroke-width': .35, 'stroke-dasharray': '.6 .4' }, t);
      [[-5, -4, 2.6], [-1.5, -5.5, 3], [3, -4.5, 2.7], [5.5, -1, 2.4], [-5.5, 2.5, 2.4], [4.5, 4.5, 2.2], [-2, 5, 2]].forEach(([dx, dy, h]) => pinheiro(a, t, cx + dx, cy + dy, h, '#5f8a45'));
      [[1, 0], [-3, 1.5], [2.5, 2]].forEach(([dx, dy]) => el('circle', { cx: cx + dx, cy: cy + dy, r: .25, fill: '#f6e27a' }, p));
    });

    cartucho(enfeites, 50, 3.6, 34, 'Os Jardins', 'ligados pela Ponte do Arco-Íris');
    rosaDosVentos(enfeites, 13, 119, 4.2);
  }

  /* ---------- a ficha de pergaminho de um jardim ---------- */
  function abrirFicha(chave, g){
    if(atual) atual.classList.remove('mm-ativo');
    atual = g; g.classList.add('mm-ativo');
    const J = JARDINS[chave];
    const n = contagens ? contagens[chave] || 0 : null;
    const resumo = n === null ? '' : n ? `${n} ${n === 1 ? 'homenagem' : 'homenagens'} · ${J.vagas - n} ${J.vagas - n === 1 ? 'vaga livre' : 'vagas livres'}` : `${J.vagas} vagas livres, à espera da primeira homenagem`;
    const aqui = chave === JARDIM;
    const esperando = aqui && !jogoPronto;
    ficha.innerHTML = `
      <div class="mt-alca"></div>
      <div class="mt-ficha-topo">
        <div class="mt-ficha-nome"><h3>${escapar(J.nome)}</h3><p class="mt-datas">${escapar(resumo)}${aqui ? (resumo ? ' · ' : '') + 'você está aqui' : ''}</p></div>
        <button class="mt-fechar-ficha" type="button" aria-label="Fechar a ficha">×</button>
      </div>
      <p class="mt-texto">${escapar(J.texto)}</p>
      <ul class="mm-tracos">${J.tracos.map(t => `<li>${escapar(t)}</li>`).join('')}</ul>
      <div class="mt-acoes">
        <button class="mt-btn mt-primario" type="button" data-acao="verMapa">Ver as homenagens</button>
        <button class="mt-btn" type="button" data-acao="passear" ${esperando ? 'disabled' : ''}>${esperando ? 'preparando o jardim…' : 'Passear aqui'}</button>
      </div>
      ${aqui ? '' : '<p class="mt-nota">Você atravessa a Ponte do Arco-Íris até lá.</p>'}`;
    ficha.querySelector('.mt-fechar-ficha').addEventListener('click', fecharFicha);
    ficha.querySelectorAll('[data-acao]').forEach(b => b.addEventListener('click', () => {
      const f = acoes[b.dataset.acao];
      if(f) f(chave);
    }));
    ficha.classList.add('aberta');
  }
  function fecharFicha(){
    ficha.classList.remove('aberta');
    if(atual) atual.classList.remove('mm-ativo');
    atual = null;
  }
  svg.addEventListener('click', fecharFicha);

  function abrir({ primeira = false, novasContagens } = {}){
    if(novasContagens !== undefined) contagens = novasContagens;
    fundo.classList.toggle('mt-modo-inicio', primeira);
    fundo.classList.add('open');
    if(primeira) document.body.classList.add('em-casa');
    desenhar();
    fecharFicha();
    // as faixas medem o texto: com a letra do título chegando depois, redesenha
    const letra = '10px "IM Fell English SC"';
    if(document.fonts && document.fonts.check && !document.fonts.check(letra)){
      document.fonts.load(letra).then(() => { if(isOpen() && !atual) desenhar(); }).catch(() => {});
    }
  }
  function fechar(){
    fecharFicha();
    const eraInicio = fundo.classList.contains('mt-modo-inicio');
    fundo.classList.remove('open', 'mt-modo-inicio');
    if(eraInicio) document.body.classList.remove('em-casa');
  }
  const isOpen = () => fundo.classList.contains('open');
  const isInicio = () => isOpen() && fundo.classList.contains('mt-modo-inicio');
  function fecharUmPasso(){
    if(ficha.classList.contains('aberta')){ fecharFicha(); return; }
    if(!isInicio()) fechar();
  }
  // as contagens chegaram (ou mudaram): redesenha se estiver aberto
  function trocarContagens(c){ contagens = c; if(isOpen() && !atual) desenhar(); }
  function pronto(sim){
    jogoPronto = sim;
    const b = ficha.querySelector('[data-acao="passear"]');
    if(b && atual && atual.dataset.jardim === JARDIM){ b.disabled = !sim; b.textContent = sim ? 'Passear aqui' : 'preparando o jardim…'; }
  }

  document.getElementById('btnMundiFechar').addEventListener('click', fechar);
  fundo.addEventListener('click', e => { if(e.target === fundo && !isInicio()) fechar(); });

  return { abrir, fechar, isOpen, isInicio, fecharUmPasso, trocarContagens, pronto, ligar(a){ acoes = { ...acoes, ...a }; } };
}
