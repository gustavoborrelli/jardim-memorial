"use strict";

/*
  O MAPA-MÚNDI (etapa 41)
  A primeira tela do site: os três jardins num vale, ligados pela Ponte do
  Arco-Íris, do esboço aprovado em 2026-11-09. A folha ocupa a tela inteira e toma
  o formato dela: deitada no computador, em pé no celular (ver `medidas`). Cada jardim com a sua miniatura e a
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
  let aberta = null; // chave do jardim com a ficha aberta

  /* ---------- a folha toma o formato da tela ----------
     Com uma folha de formato fixo (100 × 132), num monitor o mapa ficava uma tira
     estreita no meio da tela e o nome dos jardins saía com uns 10 px. Agora a folha
     mede o espaço que tem: deitada no computador (os três jardins lado a lado), em
     pé no celular (um jardim por andar, descendo a folha). O lado menor vale sempre
     100; as posições acompanham o formato e os tamanhos, não. */
  const entre = (v, a, b) => Math.max(a, Math.min(b, v));
  function medidas(){
    const r = svg.getBoundingClientRect();
    const ar = r.width > 0 && r.height > 0 ? r.width/r.height : 1.6;
    if(ar >= 1){
      const H = 100, W = entre(100*ar, 125, 215);
      const k = 1.7*entre(W/150, .85, 1); // janela quase quadrada: jardins um pouco menores
      return {
        deitada: true, W, H, k, s: 1, letraNome: 3.6, letraResumo: 2.8,
        pos: { lago: [.2*W, 48], memorial: [.5*W, 67], bosque: [.8*W, 46] },
        // o selo "você está aqui" fica no alto do jardim, entre os pés dos arco-íris
        selo: { k, lago: [0, -9.3], memorial: [0, -9.3], bosque: [0, -9.3] },
        titulo: { y: 2.6, k: 1.45 },
        nevoa: { x: W/2, y: 20, rx: 23, ry: 6.5, letra: 3.4, sub: 2.3, linhas: ['o próximo jardim nasce quando estes encherem'] },
        terra: [5, 10.5, W - 5, 96.5],
        morros: [[.09, 21, 7], [.19, 15, 9], [.3, 12.5, 8], [.7, 12.5, 9], [.81, 15, 10], [.91, 21, 7]].map(([x, y, t]) => [x*W, y, t]),
        rios: [[[.4, 11], [.37, 25], [.39, 38], [.35, 52], [.37, 66], [.33, 80], [.3, 97]].map(([x, y]) => [x*W, y])],
        rosa: [9, 87, 5.5],
      };
    }
    const W = 100, H = entre(100/ar, 125, 205);
    // um jardim por andar: a miniatura (15,3 para cima) e o nome com a conta (27,5
    // para baixo). O tamanho de tudo sai da altura que a folha tem
    const s = entre((H - 12.6)/136.2, .72, 1.2), k = 1.8*s;
    const hb = 2.6 + 7.8*s + 1.5; // onde o título acaba
    const sobra = Math.max(1.5, (H - 9.6 - 136.2*s)/2);
    const y1 = hb + 2 + 15.3*s, y2 = y1 + 42.8*s + sobra, y3 = y2 + 42.8*s + sobra;
    // "terras por descobrir" ocupa o canto vazio ao lado do Bosque, não um andar
    const nx = Math.min(30, 4 + 20*s), ny = hb + 15*s;
    return {
      deitada: false, W, H, k, s, letraNome: 4.6*s, letraResumo: 3.8*s,
      pos: { bosque: [66, y1], lago: [34, y2], memorial: [64, y3] },
      selo: { k: k*1.25, bosque: [9.5, -7], lago: [-8, -8.5], memorial: [-10.5, 1] },
      titulo: { y: 2.6, k: 1.5*s },
      nevoa: { x: nx, y: ny, rx: 20*s, ry: 8*s, letra: 3.8*s, sub: 2.9*s, linhas: ['o próximo jardim nasce', 'quando estes encherem'] },
      terra: [4, hb - 1, 96, H - 4],
      morros: [[9, hb + 5*s, 5.5], [20, hb + 2.5*s, 7], [91, hb + 3*s, 6]].map(([x, y, t]) => [x, y, t*s]),
      // o rio sai da névoa, deságua no lago e segue do lago até o pé da folha
      rios: [
        [[22, hb + 6*s], [17, ny + 10*s], [22, y2 - 17*s], [30, y2 - 9*s]],
        [[30, y2 + 3*s], [25, y2 + 14*s], [22, y2 + 30*s], [27, (y2 + y3)/2 + 12*s], [36, y3 + 2*s], [33, y3 + 16*s], [29, H - 5]],
      ],
      rosa: [10, H - 11, 4.5*s],
    };
  }

  /* ---------- o vale, as pontes, a névoa e os três jardins ---------- */
  function desenhar(){
    while(svg.firstChild) svg.firstChild.remove();
    const M = medidas();
    const { W, H, k } = M;
    svg.setAttribute('viewBox', `0 0 ${W.toFixed(1)} ${H.toFixed(1)}`);
    defs(svg, P);
    const sorte = sorteador(31);
    folha(svg, P, 2, 2, W - 4, H - 4);
    const aguadas = el('g', { filter: `url(#${P}aquarela)` }, svg);
    const tinta = el('g', { filter: `url(#${P}tinta)`, fill: 'none', stroke: TINTA, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    const enfeites = el('g', {}, svg);
    const alvos = el('g', {}, svg);

    // a terra: um vale verde de contorno natural, com morros ao norte
    // (o contorno ondulado é esticado até caber exato na caixa: antes, a terra passava da folha)
    const bruto = contorno(0, 0, 1, [[2, .07, .4], [3, .06, 1.7], [5, .035, .2], [7, .02, 2.5]], 60);
    const lim = (i, f) => f(...bruto.map(p => p[i]));
    const [bx0, bx1, by0, by1] = [lim(0, Math.min), lim(0, Math.max), lim(1, Math.min), lim(1, Math.max)];
    const [tx0, ty0, tx1, ty1] = M.terra;
    const T = { rx: (tx1 - tx0)/(bx1 - bx0), ry: (ty1 - ty0)/(by1 - by0) };
    T.cx = tx0 - bx0*T.rx; T.cy = ty0 - by0*T.ry;
    const terra = bruto.map(([x, y]) => [T.cx + x*T.rx, T.cy + y*T.ry]);
    el('path', { d: curva(terra, true), fill: '#b4cd8a', opacity: .55 }, aguadas);
    el('path', { d: curva(terra, true), 'stroke-width': .25, opacity: .8 }, tinta);
    terra.forEach(([x, y], i) => {
      if(i % 2) return;
      const dx = (x - T.cx)/(T.rx*T.rx), dy = (y - T.cy)/(T.ry*T.ry), L = Math.hypot(dx, dy);
      el('line', { x1: x + dx/L*.6, y1: y + dy/L*.6, x2: x + dx/L*1.7, y2: y + dy/L*1.7, 'stroke-width': .12, opacity: .45 }, tinta);
    });
    // um rio que desce dos morros e passa entre os jardins
    M.rios.forEach(rio => {
      el('path', { d: curva(rio), stroke: '#8fc3d2', 'stroke-width': 1.6*Math.max(1, k/1.5), fill: 'none', opacity: .9 }, aguadas);
      el('path', { d: curva(rio), 'stroke-width': .14, opacity: .5 }, tinta);
    });
    // morros ao norte
    M.morros.forEach(([x, y, t]) => {
      const d = `M${x - t} ${y + t*.5} Q${x - t*.3} ${y - t*.55} ${x} ${y - t*.6} Q${x + t*.35} ${y - t*.5} ${x + t} ${y + t*.5}`;
      el('path', { d, fill: '#cdbb8e' }, aguadas);
      el('path', { d, 'stroke-width': .22 }, tinta);
      el('path', { d: `M${x} ${y - t*.6} q${t*.12} ${t*.5} ${t*.05} ${t*.9}`, 'stroke-width': .1, opacity: .5 }, tinta);
    });
    // árvores soltas pela terra, longe dos jardins, dos nomes e da névoa
    const N = M.nevoa;
    const ocupado = (x, y) => Object.values(M.pos).some(([jx, jy]) => Math.abs(x - jx) < 17.5*k && y > jy - 12*k && y < jy + 17*k)
      || Math.hypot((x - N.x)/(N.rx + 4), (y - N.y)/(N.ry + 4)) < 1;
    const tArv = M.deitada ? 1.5 : 1.5*M.s;
    for(let i = 0, n = Math.round(W*H/150); i < n; i++){
      const x = 6 + sorte()*(W - 12), y = 6 + sorte()*(H - 12);
      if(Math.hypot((x - T.cx)/T.rx, (y - T.cy)/T.ry) > .86 || ocupado(x, y)) continue;
      if(sorte() < .35) pinheiro(aguadas, tinta, x, y, (2.2 + sorte())*tArv, '#6f9752');
      else arvore(aguadas, tinta, sorte, x, y, (1 + sorte()*.5)*tArv, ['#7ea35a', '#8fb367', '#9cbc6e'][i % 3]);
    }

    // as pontes do arco-íris: cada jardim ligado aos outros dois. Os pés saem do
    // canto de cada miniatura (em medidas dela, vezes k)
    const pe = (chave, dx, dy) => [M.pos[chave][0] + dx*k, M.pos[chave][1] + dy*k];
    const ponte = (a, b, curvatura) => {
      const vao = Math.hypot(b[0] - a[0], b[1] - a[1]);
      arcoIris(enfeites, P, a, b, entre(vao*curvatura, 3.5, 10), Math.min(.62*k*.85, vao/24));
    };
    if(M.deitada){
      ponte(pe('memorial', -7.5, -8), pe('lago', 7.5, 5), .3);
      ponte(pe('memorial', 7.5, -8), pe('bosque', -7.5, 6.5), .3);
      ponte(pe('lago', 7, -6.5), pe('bosque', -7, -6), .07);
    } else {
      ponte(pe('bosque', -9, 3), pe('lago', 4, -8.5), .16);
      ponte(pe('lago', 9, 3), pe('memorial', -6, -8.3), .16);
      ponte(pe('bosque', 9.5, 3), pe('memorial', 8.2, -7.5), .09);
    }

    // terras por descobrir: névoa e nuvens onde os próximos jardins vão nascer
    const nevoa = el('g', {}, enfeites);
    el('ellipse', { cx: N.x, cy: N.y, rx: N.rx, ry: N.ry, fill: '#fffaf0', opacity: .9, filter: `url(#${P}nevoa)` }, nevoa);
    nuvem(nevoa, N.x - N.rx*.62, N.y + N.ry*.1, N.ry*.36); nuvem(nevoa, N.x + N.rx*.6, N.y - N.ry*.2, N.ry*.42); nuvem(nevoa, N.x + N.rx*.1, N.y + N.ry*.72, N.ry*.3);
    el('text', { x: N.x, y: N.y + N.letra*.05 - (N.linhas.length - 1)*N.sub*.6, 'text-anchor': 'middle', 'font-family': LETRA_ITALICO, 'font-style': 'italic', 'font-size': N.letra, fill: TINTA }, nevoa).textContent = 'terras por descobrir';
    N.linhas.forEach((linha, i) => {
      el('text', { x: N.x, y: N.y + N.letra*.05 - (N.linhas.length - 1)*N.sub*.6 + N.sub*1.25*(i + 1), 'text-anchor': 'middle', 'font-family': LETRA_MAO, 'font-size': N.sub, fill: TINTA, opacity: .85 }, nevoa).textContent = linha;
    });

    // os três jardins, cada um com o seu desenho (feito em volta de 0,0 e ampliado k vezes)
    function jardim(chave, desenho){
      const J = JARDINS[chave];
      const [x, y] = M.pos[chave];
      const n = contagens ? contagens[chave] || 0 : null;
      const resumo = n === null ? '' : n ? `${n} ${n === 1 ? 'homenagem' : 'homenagens'} · ${J.vagas - n} ${J.vagas - n === 1 ? 'vaga livre' : 'vagas livres'}` : `${J.vagas} vagas livres`;
      const g = el('g', { class: 'mm-alvo', role: 'button', tabindex: 0, 'data-jardim': chave, 'aria-label': `${J.nome}${resumo ? ', ' + resumo : ''}` }, alvos);
      // a área de toque cobre a miniatura, o nome e a conta
      el('rect', { x: x - 13*k, y: y - 10*k, width: 26*k, height: 10*k + 10.5*k + M.letraNome + M.letraResumo*1.6, fill: 'transparent' }, g);
      const corpo = el('g', { class: 'mm-corpo' }, g);
      desenho(el('g', { transform: `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${k.toFixed(3)})` }, corpo), 0, 0);
      // o nome nunca sai da folha: perto da borda, a faixa escorrega para dentro
      const yFaixa = y + 10.5*k;
      const medida = faixa(corpo, x, yFaixa, J.nome, M.letraNome, W - 8);
      const larg = medida.getBBox().width;
      const xFaixa = entre(x, 4 + larg/2, W - 4 - larg/2);
      if(xFaixa !== x) medida.setAttribute('transform', `translate(${(xFaixa - x).toFixed(2)} 0)`);
      if(resumo) el('text', { x: xFaixa, y: yFaixa + M.letraNome*.8 + M.letraResumo*1.05, 'text-anchor': 'middle', 'font-family': LETRA_MAO, 'font-weight': 700, 'font-size': M.letraResumo, fill: TINTA, stroke: '#f3e6c6', 'stroke-width': M.letraResumo*.3, 'paint-order': 'stroke' }, corpo).textContent = resumo;
      if(chave === JARDIM){
        // "você está aqui", com a patinha
        // (perto da borda ele escorrega para dentro, para a legenda caber)
        const ks = M.selo.k, [sx, sy] = M.selo[chave];
        const v = el('g', { transform: `translate(${entre(x + sx*k, 4 + 4.9*ks, W - 4 - 4.9*ks).toFixed(2)} ${(y + sy*k).toFixed(2)}) scale(${ks.toFixed(3)})` }, corpo);
        el('circle', { r: 2.1, fill: '#e39a32', stroke: TINTA, 'stroke-width': .16 }, v);
        el('text', { y: .75, 'text-anchor': 'middle', 'font-size': 2.1 }, v).textContent = '🐾';
        el('text', { x: 0, y: -2.7, 'text-anchor': 'middle', 'font-family': LETRA_MAO, 'font-weight': 700, 'font-size': 1.6, fill: TINTA, stroke: '#f3e6c6', 'stroke-width': .45, 'paint-order': 'stroke' }, v).textContent = 'você está aqui';
      }
      if(chave === aberta){ atual = g; g.classList.add('mm-ativo'); } // redesenho com a ficha aberta
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

    cartucho(el('g', { transform: `translate(${W/2} ${M.titulo.y}) scale(${M.titulo.k.toFixed(3)})` }, enfeites), 0, 0, 34, 'Os Jardins', 'ligados pela Ponte do Arco-Íris');
    rosaDosVentos(enfeites, ...M.rosa);
  }

  /* ---------- a ficha de pergaminho de um jardim ---------- */
  function abrirFicha(chave, g){
    if(atual) atual.classList.remove('mm-ativo');
    atual = g; g.classList.add('mm-ativo'); aberta = chave;
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
    atual = null; aberta = null;
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

  // a folha tem o formato da tela: se a janela muda ou o celular gira, redesenha
  let espera = 0;
  window.addEventListener('resize', () => {
    clearTimeout(espera);
    espera = setTimeout(() => { if(isOpen()) desenhar(); }, 120);
  });

  document.getElementById('btnMundiFechar').addEventListener('click', fechar);
  fundo.addEventListener('click', e => { if(e.target === fundo && !isInicio()) fechar(); });

  return { abrir, fechar, isOpen, isInicio, fecharUmPasso, trocarContagens, pronto, ligar(a){ acoes = { ...acoes, ...a }; } };
}
