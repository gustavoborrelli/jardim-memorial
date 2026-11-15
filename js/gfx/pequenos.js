/*
  OS CACHORROS PEQUENOS
  Shih-tzu, Yorkshire e Spitz Alemão (o lulu da Pomerânia). Mesma técnica dos
  outros (caes.js): cada parte é um campo de distância esculpido, com pelo em
  cascas por cima. Aqui mora só a receita de cada raça; a montagem e a animação
  são as de caes.js, que reconhece `pequeno` e troca o que é de cachorro pequeno:
  passo curto e rápido, quique menor, câmera mais perto e mais baixa.

  Os três têm metade do tamanho de um golden e o que os separa é o pelo, não o
  esqueleto. Por isso o volume do pelo é esculpido junto (a juba do lulu, a saia
  de pelo do shih-tzu e do yorkshire até o chão, o topete): no perfil baixo, sem
  as cascas de pelo, a silhueta continua sendo a da raça.
  - Spitz: uma bola laranja de focinho de raposa, orelhinha em pé quase sumida
    na juba e o rabo em pluma deitado sobre o dorso.
  - Shih-tzu: comprido e baixo, cara achatada com barba e bigode, olhos grandes,
    orelha caída de pelo longo, topete, branco com dourado.
  - Yorkshire: o menor, orelha em pé em V, focinho de terrier, manto azul-aço
    no dorso e dourado na cabeça, no peito e nas patas, topete com laço.
*/
import * as THREE from 'three';
import { esculpir, esfera, elipsoide, cone, corrente } from './sdf.js';

export const PEQUENOS = ['shihtzu', 'yorkshire', 'spitz'];

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const mixv = (a, b, t, o) => { o[0] = a[0]+(b[0]-a[0])*t; o[1] = a[1]+(b[1]-a[1])*t; o[2] = a[2]+(b[2]-a[2])*t; return o; };
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x-a)/(b-a))); return t*t*(3-2*t); };
const ruido3 = (x, y, z) => {
  const h = Math.sin(x*12.9 + y*27.1 + z*19.3)*0.5 + Math.sin(x*31.7 - z*23.1 + y*11.0)*0.3 + Math.sin(z*41.0 + y*37.0)*0.2;
  return h*0.5 + 0.5;
};
const achatarX = (f, cx, k) => (x, y, z) => f(cx + (x-cx)*k, y, z)/k;
const achatarZ = (f, cz, k) => (x, y, z) => f(x, y, cz + (z-cz)*k)/k;
function caixaDe(pontos, m){
  const c = [[1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]];
  pontos.forEach(p => { const r = (p[3] || 0) + m; for(let i=0;i<3;i++){ c[0][i] = Math.min(c[0][i], p[i] - r); c[1][i] = Math.max(c[1][i], p[i] + r); } });
  return c;
}

/* O molde. `m` traz as medidas de cada raça já em metros do jogo (z para a frente,
   y para cima, chão em y = 0) e `cores(G)` devolve as funções de cor, que recebem
   as medidas montadas para saberem onde ficam a cara, o peito e o rabo. */
function montarPequeno(m){
  const { P, zr, zc, xT, xF } = m;
  const tronco = esculpir(m.tronco);
  const H = m.cabeca.centro, [rx, ry, rz] = m.cabeca.raios;
  const F = m.focinho;

  // cabeça: crânio redondo, focinho, o que a raça tem de seu (bochecha, barba,
  // topete) e o pescoço. Na estátua o pescoço é só o do corpo: com o da cabeça
  // junto, os dois somam um calombo na nuca (o mesmo cuidado dos gatos)
  const partesCabeca = [
    [elipsoide(H[0], H[1], H[2], rx, ry, rz), 0],
    [cone(F.de, F.ate, F.r1, F.r2), F.k || 0.025],
    ...m.cabeca.extras,
    [cone(m.pescoco.pivo, [0, H[1] - ry*0.35, H[2] - rz*0.4], m.pescoco.r, rx*0.72), 0.04],
  ];
  const cabeca = esculpir(partesCabeca);
  const cabecaEstatua = esculpir(partesCabeca.slice(0, -1));
  const caixaCabeca = caixaDe([[...H, Math.max(rx, ry, rz)], [...F.ate, F.r2], [...m.pescoco.pivo, m.pescoco.r], ...(m.cabeca.alcance || [])], 0.05);

  // nariz na ponta do focinho, boca logo abaixo (caes.js encosta as duas na superfície)
  const nariz = [0, F.ate[1] + F.r2*0.42, F.ate[2] + F.r2*0.7];
  const narizEsc = [F.r2*0.6*m.nariz, F.r2*0.48*m.nariz, F.r2*0.44*m.nariz];
  const a = [0, F.ate[1] - F.r2*0.5, F.ate[2] + F.r2*0.62];
  const boca = {
    haste: [0, nariz[1] - narizEsc[1]*0.7, nariz[2] + 0.002],
    a,
    b: [F.r2*0.85, a[1] - F.r2*0.3, a[2] - F.r2*0.95],
    c: [F.r2*1.5, a[1] + F.r2*0.05, a[2] - F.r2*2.1],
  };

  const O = m.orelha;
  const orelha = O.caida ? {
    // caída e achatada de lado, com o pelo comprido descendo além do queixo
    forma: (s) => achatarX(corrente(O.pontos.map(([x, y, z, r]) => [s*x, y, z, r]), 0.03), s*O.plano, 2.1),
    caixa: (s) => caixaDe(O.pontos.map(([x, y, z, r]) => [s*x, y, z, r]), 0.04),
    pivo: (s) => [s*O.pontos[0][0], O.pontos[0][1], O.pontos[0][2]],
  } : {
    // triângulo em pé, achatado de frente para trás
    forma: (s) => achatarZ(cone([s*O.base[0], O.base[1], O.base[2]], [s*O.topo[0], O.topo[1], O.topo[2]], O.larg, O.larg*0.2), O.base[2], 2.3),
    caixa: (s) => caixaDe([[s*O.base[0], O.base[1], O.base[2]], [s*O.topo[0], O.topo[1], O.topo[2]]], O.larg + 0.035),
    pivo: (s) => [s*O.base[0], O.base[1], O.base[2]],
  };

  // patas curtas e peludas: a coxa some no pelo do corpo, o pé é uma bolinha
  const rc = m.pata.coxa, rp = m.pata.r;
  const pataTras = (x) => esculpir([
    [corrente([[x, P, zr, rc], [x, P*0.52, zr - 0.012, rp*1.3], [x, 0.03, zr - 0.004, rp]], 0.025), 0],
    [elipsoide(x, 0.02, zr + 0.01, rp*1.2, 0.02, rp*1.5), 0.02],
  ]);
  const pataFrente = (x) => esculpir([
    [corrente([[x, P, zc, rc*0.9], [x, P*0.5, zc + 0.004, rp*1.2], [x, 0.03, zc + 0.006, rp]], 0.02), 0],
    [elipsoide(x, 0.02, zc + 0.02, rp*1.2, 0.02, rp*1.5), 0.02],
  ]);
  const patas = [
    { pivo: [-xT, P, zr], forma: pataTras },
    { pivo: [xT, P, zr], forma: pataTras },
    { pivo: [-xF, P, zc], forma: pataFrente },
    { pivo: [xF, P, zc], forma: pataFrente },
  ];

  const rabo = { pivo: m.rabo[0].slice(0, 3), forma: corrente(m.rabo, 0.02), caixa: caixaDe(m.rabo, 0.05) };

  const olhos = { ...m.olhos };
  const G = { P, zr, zc, H, rx, ry, rz, F, nariz, olhos, rabo: m.rabo };
  const pinta = m.cores(G);

  // pelo: curto na cara, comprido na juba e na saia; nada em volta do olho e do nariz
  const L = m.pelo;
  const pelo = (x, y, z) => {
    let p = 1;
    const cara = sst(H[2] + rz*0.15, H[2] + rz*0.7, z)*(y > H[1] - ry*1.25 ? 1 : 0);
    p *= 1 - cara*L.caraCurta;
    p += sst(zc - 0.04, zc + 0.07, z)*sst(H[1] - ry*0.3, P*0.7, y)*L.juba;
    p += sst(P + 0.07, P - 0.03, y)*L.saia;
    if(y < 0.035) p *= 0.5;
    const dOlho = Math.hypot(Math.abs(x) - olhos.x, y - olhos.y, z - olhos.z);
    p *= sst(olhos.r*1.1, olhos.r*2.0, dOlho);
    const dNariz = Math.hypot(x, y - nariz[1], z - nariz[2]);
    p *= sst(narizEsc[0]*1.1, narizEsc[0]*2.6, dNariz);
    return p;
  };

  return {
    pequeno: true,
    velocidade: m.velocidade, cadencia: m.cadencia, porte: 0.5, abano: m.abano,
    comprimento: L.comprimento, densidade: L.densidade, cai: L.cai,
    olhos,
    nariz: { pos: nariz, esc: narizEsc },
    boca, bocaEspessura: 0.0028,
    lingua: { pos: [0.002, a[1] - F.r2*0.25, a[2] - F.r2*0.55], esc: [F.r2*0.5, F.r2*1.05, F.r2*0.24], sobe: F.r2*0.55 },
    laco: m.laco,
    pescocoPivo: m.pescoco.pivo,
    olhoAltura: olhos.y, olhoFrente: nariz[2] + 0.06,
    tronco, caixaTronco: m.caixaTronco, cabeca, cabecaEstatua, caixaCabeca, orelha, patas, rabo,
    cor: pinta.cor, corOrelha: pinta.corOrelha, corPata: pinta.corPata, corRabo: pinta.corRabo,
    pelo,
    peloOrelha: L.orelha,
    peloRabo: () => L.rabo,
  };
}

export function receitaPequeno(raca){
  if(raca === 'spitz'){
    // spitz alemão anão laranja: juba e peito creme, dorso mais queimado
    const LARANJA = lin(0xe2913e), QUEIMADO = lin(0xc2742c), CREME = lin(0xfff0d2);
    return montarPequeno({
      P: 0.15, zr: -0.11, zc: 0.085, xT: 0.055, xF: 0.05,
      velocidade: 0.88, cadencia: 1.5, abano: 0.45,
      tronco: [
        [corrente([[0, 0.2, -0.12, 0.1], [0, 0.205, -0.01, 0.098], [0, 0.215, 0.085, 0.108]], 0.04), 0],
        [elipsoide(0, 0.245, 0.115, 0.125, 0.13, 0.105), 0.05],   // a juba
        [cone([0, 0.24, 0.1], [0, 0.32, 0.16], 0.1, 0.085), 0.05],
        [elipsoide(0, 0.17, -0.15, 0.1, 0.1, 0.07), 0.04],        // as "calças"
      ],
      caixaTronco: [[-0.27, -0.02, -0.33], [0.27, 0.47, 0.31]],
      cabeca: {
        centro: [0, 0.345, 0.205], raios: [0.078, 0.073, 0.076],
        extras: [
          [esfera(0.05, 0.322, 0.212, 0.046), 0.03],
          [esfera(-0.05, 0.322, 0.212, 0.046), 0.03],
        ],
      },
      focinho: { de: [0, 0.33, 0.255], ate: [0, 0.318, 0.318], r1: 0.036, r2: 0.021 },
      nariz: 1,
      pescoco: { pivo: [0, 0.27, 0.13], r: 0.085 },
      olhos: { x: 0.033, y: 0.357, z: 0.262, r: 0.0165 },
      orelha: { base: [0.042, 0.4, 0.195], topo: [0.056, 0.468, 0.188], larg: 0.03 },
      pata: { coxa: 0.05, r: 0.024 },
      rabo: [[0, 0.25, -0.19, 0.04], [0, 0.33, -0.215, 0.055], [0, 0.395, -0.17, 0.06], [0, 0.405, -0.09, 0.055], [0, 0.385, -0.02, 0.04]],
      pelo: { comprimento: 0.042, densidade: 230, cai: [0, -0.12, -0.3], caraCurta: 0.8, juba: 0.6, saia: 0.3, orelha: 0.5, rabo: 1.6 },
      cores: (G) => ({
        cor(x, y, z, o){
          const n = ruido3(x*4, y*4, z*4);
          mixv(LARANJA, QUEIMADO, sst(0.24, 0.31, y + (n - 0.5)*0.04)*(z < 0.1 ? 1 : 0.3)*0.7, o);
          // peito e parte de baixo da juba, barriga e calças em creme
          const peito = sst(0.06, 0.13, z)*sst(0.3, 0.2, y + (n - 0.5)*0.03);
          const barriga = sst(0.17, 0.11, y);
          const calcas = sst(-0.13, -0.19, z)*sst(0.24, 0.16, y);
          mixv(o, CREME, Math.min(1, peito + barriga + calcas)*0.85, o);
          // focinho e bochechas mais claros
          const d = Math.hypot(x*0.8, y - G.F.ate[1], z - G.F.ate[2]);
          mixv(o, CREME, sst(0.085, 0.03, d)*0.7, o);
        },
        corOrelha(x, y, z, o){ mixv(LARANJA, QUEIMADO, 0.55, o); },
        corPata(x, y, z, o){ mixv(LARANJA, CREME, sst(0.14, 0.03, y)*0.8, o); },
        // a pluma: laranja por cima, creme por baixo e na ponta
        corRabo(x, y, z, o){ mixv(LARANJA, CREME, Math.min(1, sst(0.36, 0.3, y)*0.6 + sst(-0.1, 0.0, z)*0.7), o); },
      }),
    });
  }

  if(raca === 'yorkshire'){
    // yorkshire: manto azul-aço do pescoço ao rabo; cabeça, peito e patas dourados
    const ACO = lin(0x66727f), ACO_ESCURO = lin(0x454e59), OURO = lin(0xcd8f47), OURO_CLARO = lin(0xe3b26e);
    return montarPequeno({
      P: 0.125, zr: -0.1, zc: 0.075, xT: 0.045, xF: 0.042,
      velocidade: 0.86, cadencia: 1.6, abano: 0.7,
      tronco: [
        [corrente([[0, 0.175, -0.11, 0.078], [0, 0.18, -0.01, 0.078], [0, 0.19, 0.075, 0.084]], 0.035), 0],
        [cone([0, 0.21, 0.08], [0, 0.275, 0.135], 0.07, 0.062), 0.04],
        [elipsoide(0, 0.09, -0.015, 0.088, 0.085, 0.16), 0.04],   // a saia de pelo, até o chão
      ],
      caixaTronco: [[-0.22, -0.02, -0.27], [0.22, 0.4, 0.26]],
      cabeca: {
        centro: [0, 0.305, 0.17], raios: [0.066, 0.062, 0.068],
        extras: [
          [elipsoide(0, 0.262, 0.25, 0.04, 0.03, 0.04), 0.025],        // a barba
          [cone([0, 0.36, 0.172], [0, 0.392, 0.16], 0.014, 0.02), 0.02], // o topete
        ],
        alcance: [[0, 0.392, 0.16, 0.03]],
      },
      focinho: { de: [0, 0.29, 0.215], ate: [0, 0.277, 0.282], r1: 0.032, r2: 0.02 },
      nariz: 1,
      pescoco: { pivo: [0, 0.23, 0.1], r: 0.066 },
      olhos: { x: 0.03, y: 0.315, z: 0.226, r: 0.0155 },
      orelha: { base: [0.04, 0.35, 0.152], topo: [0.07, 0.442, 0.142], larg: 0.034 },
      pata: { coxa: 0.04, r: 0.022 },
      rabo: [[0, 0.215, -0.165, 0.025], [0, 0.29, -0.2, 0.03], [0, 0.355, -0.2, 0.026], [0, 0.385, -0.18, 0.014]],
      laco: { pos: [0, 0.385, 0.19], cor: 0xd8433c, tam: 0.021 },
      pelo: { comprimento: 0.036, densidade: 240, cai: [0, -0.7, -0.15], caraCurta: 0.6, juba: 0.3, saia: 0.55, orelha: 0.3, rabo: 1.3 },
      cores: (G) => ({
        cor(x, y, z, o){
          const n = ruido3(x*4, y*4, z*4);
          // o manto: dorso e flancos, da nuca ao rabo
          mixv(ACO, ACO_ESCURO, sst(0.2, 0.26, y + (n - 0.5)*0.04)*0.7, o);
          // dourado: cabeça inteira, peito e a parte de baixo
          const cabeca = sst(G.H[2] - G.rz*1.25, G.H[2] - G.rz*0.75, z + (n - 0.5)*0.02)*sst(0.2, 0.25, y);
          const peito = sst(0.05, 0.1, z + (n - 0.5)*0.02)*sst(0.27, 0.2, y);
          const baixo = sst(0.09, 0.05, y);
          mixv(o, OURO, Math.min(1, cabeca + peito + baixo), o);
          // o alto da cabeça e o topete mais claros
          mixv(o, OURO_CLARO, sst(G.H[1] + G.ry*0.2, G.H[1] + G.ry*0.9, y)*sst(G.H[2] - G.rz, G.H[2] - G.rz*0.4, z)*0.8, o);
        },
        corOrelha(x, y, z, o){ mixv(OURO, ACO_ESCURO, 0.25, o); },
        corPata(x, y, z, o){ o[0] = OURO[0]; o[1] = OURO[1]; o[2] = OURO[2]; },
        corRabo(x, y, z, o){ mixv(ACO, ACO_ESCURO, 0.5, o); },
      }),
    });
  }

  // shih-tzu branco e dourado: máscara e orelhas douradas, risca branca na testa
  const BRANCO = lin(0xfffaf0), DOURADO = lin(0xc88f50), CASTANHO = lin(0x8d5d36);
  return montarPequeno({
    P: 0.14, zr: -0.15, zc: 0.1, xT: 0.06, xF: 0.055,
    velocidade: 0.82, cadencia: 1.45, abano: 0.45,
    tronco: [
      [corrente([[0, 0.2, -0.16, 0.1], [0, 0.2, -0.02, 0.1], [0, 0.21, 0.1, 0.106]], 0.04), 0],
      [elipsoide(0, 0.2, 0.13, 0.095, 0.11, 0.08), 0.05],
      [cone([0, 0.24, 0.11], [0, 0.31, 0.17], 0.09, 0.08), 0.05],
      [elipsoide(0, 0.1, -0.02, 0.118, 0.1, 0.22), 0.05],        // a saia de pelo, até o chão
    ],
    caixaTronco: [[-0.26, -0.02, -0.36], [0.26, 0.44, 0.32]],
    cabeca: {
      centro: [0, 0.345, 0.215], raios: [0.088, 0.082, 0.082],
      extras: [
        [elipsoide(0, 0.295, 0.285, 0.06, 0.038, 0.04), 0.03],        // barba e bigode
        [cone([0, 0.415, 0.2], [0, 0.465, 0.185], 0.02, 0.032), 0.02], // o topete
      ],
      alcance: [[0, 0.465, 0.185, 0.035]],
    },
    focinho: { de: [0, 0.325, 0.27], ate: [0, 0.318, 0.305], r1: 0.042, r2: 0.034, k: 0.03 },
    nariz: 0.62,
    pescoco: { pivo: [0, 0.265, 0.14], r: 0.085 },
    olhos: { x: 0.042, y: 0.352, z: 0.283, r: 0.0205 },
    orelha: { caida: true, plano: 0.085, pontos: [[0.07, 0.385, 0.195, 0.028], [0.09, 0.31, 0.2, 0.04], [0.094, 0.23, 0.205, 0.038], [0.092, 0.165, 0.205, 0.024]] },
    pata: { coxa: 0.05, r: 0.03 },
    rabo: [[0, 0.25, -0.23, 0.035], [0, 0.34, -0.26, 0.05], [0, 0.4, -0.2, 0.055], [0, 0.4, -0.11, 0.05], [0, 0.37, -0.05, 0.035]],
    laco: { pos: [0, 0.44, 0.228], cor: 0x6fa8dc, tam: 0.023 },
    pelo: { comprimento: 0.042, densidade: 220, cai: [0, -0.7, -0.12], caraCurta: 0.55, juba: 0.3, saia: 0.5, orelha: 0.8, rabo: 1.6 },
    cores: (G) => ({
      cor(x, y, z, o){
        const n = ruido3(x*3.5, y*3.5, z*3.5);
        o[0] = BRANCO[0]; o[1] = BRANCO[1]; o[2] = BRANCO[2];
        // manchas douradas no dorso: uma sela e uma perto do rabo, de borda irregular
        const sela = sst(0.2, 0.25, y + (n - 0.5)*0.05)*sst(0.06, 0.0, z + (n - 0.5)*0.05)*sst(-0.12, -0.06, z);
        const anca = sst(0.19, 0.24, y + (n - 0.5)*0.05)*sst(-0.15, -0.2, z + (n - 0.5)*0.04);
        mixv(o, DOURADO, Math.min(1, sela + anca)*0.92, o);
        // máscara dourada dos dois lados da cara; a risca do meio e o focinho ficam brancos
        const naCabeca = sst(G.H[2] - G.rz*0.9, G.H[2] - G.rz*0.5, z)*sst(0.27, 0.3, y);
        const lado = sst(0.014, 0.034, Math.abs(x) + (n - 0.5)*0.01);
        const foraDoFocinho = sst(0.3, 0.325, y + Math.abs(x)*0.25);
        mixv(o, DOURADO, naCabeca*lado*foraDoFocinho*0.95, o);
        const dOlho = Math.hypot(Math.abs(x) - G.olhos.x, y - G.olhos.y, z - G.olhos.z);
        mixv(o, CASTANHO, sst(G.olhos.r*2.4, G.olhos.r*1.2, dOlho)*0.75, o);
      },
      // orelha dourada escurecendo para a ponta
      corOrelha(x, y, z, o){ mixv(DOURADO, CASTANHO, sst(0.3, 0.17, y)*0.8, o); },
      corPata(x, y, z, o){ o[0] = BRANCO[0]; o[1] = BRANCO[1]; o[2] = BRANCO[2]; },
      corRabo(x, y, z, o){ mixv(DOURADO, BRANCO, sst(-0.16, -0.08, z), o); },
    }),
  });
}
