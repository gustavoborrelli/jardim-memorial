/*
  ESTÁTUAS DE RAÇA
  A lápide em forma de cachorro é o mesmo cachorro que passeia pelo jardim
  (caes.js), agora talhado em mármore, sentado ou deitado. Tronco,
  cabeça e orelhas são os campos da escultura já aprovada: é isso que faz a
  raça se reconhecer na pedra. Só patas e rabo são refeitos, porque a pose muda.

  O pelo vira volume de pedra: o corpo é empurrado para fora pelo mesmo mapa de
  comprimento de pelo da escultura (peito e barriga do golden fofos). A cara fica
  de fora: com o mapa inteiro o crânio inchava, o focinho encurtava e o vazio de
  pelo em volta dos olhos virava um par de óculos.

  Golden e pastor sentados, dachshund deitado (escolha do Gustavo em 2026-11-08,
  depois de ver as duas poses nas duas raças). O caramelo, que veio depois,
  também deita: sentado, ao lado do pastor, os dois pareciam a mesma estátua.
  Para sentar, o corpo gira em volta do quadril e as patas da frente esticam até
  o ombro: no dachshund, de perna curta e corpo comprido, viram palitos.

  Deitado sai de perfil (focinho para +x) e sentado de três quartos, ambos com a
  cabeça virada para quem chega por +z. A malha fica em cache por raça e pose.
*/
import * as THREE from 'three';
import { receita, naSuperficie } from './caes.js';
import { malhaSDF, esculpir, elipsoide, corrente, esfera, subtrair } from './sdf.js';

/* o que a receita do cachorro guarda dentro de funções (raios das patas, do rabo,
   a linha do pescoço) e a pose de cada raça. `giro` vira a cabeça para quem chega;
   `inclina` é quanto o corpo levanta, em volta do quadril, para sentar. */
const MEDIDAS = {
  golden: {
    frente: { r1: 0.088, r2: 0.05, pe: [0.066, 0.046, 0.086], ante: 0.3 },
    tras: { coxa: 0.118, canela: 0.05, pe: [0.068, 0.046, 0.088] },
    rabo: { r: 0.07, ponta: 0.036, comp: 0.5, pelo: 1.6 },
    pescoco: [[0, 0.58, 0.31], [0, 0.74, 0.44]],
    // a raiz da orelha caída fica no alto do crânio: na pedra, sem a cor e o pelo,
    // ela vira orelha redonda de urso. Desce e abre um pouco para cair do lado.
    orelha: { desce: 0.04, abre: 0.014, pelo: 0.7 },
    // sem o dourado, o que diz "golden" é o pelo longo do peito e da barriga:
    // mechas esculpidas onde o mapa de pelo é comprido
    mechas: { amp: 0.02, onda: 0.11, de: 1.25, ate: 1.7 },
    // cabeça pequena num corpo fofo e focinho curto é cara de filhote: na pedra a
    // cabeça cresce 10% (no passeio o pelo já a aumenta) e o focinho alonga
    focinho: { de: 0.64, estica: 1.18 },
    cabeca: 1.1,
    sentado: { inclina: 0.72, giro: 0.45, ergue: 0.08 },
  },
  shepherd: {
    frente: { r1: 0.078, r2: 0.043, pe: [0.056, 0.04, 0.076], ante: 0.3 },
    tras: { coxa: 0.105, canela: 0.044, pe: [0.056, 0.04, 0.078] },
    rabo: { r: 0.058, ponta: 0.034, comp: 0.46, pelo: 1.5 },
    pescoco: [[0, 0.6, 0.31], [0, 0.76, 0.44]],
    sentado: { inclina: 0.76, giro: 0.45, ergue: 0.1 },
  },
  caramelo: {
    frente: { r1: 0.072, r2: 0.04, pe: [0.054, 0.038, 0.072], ante: 0.3 },
    tras: { coxa: 0.098, canela: 0.042, pe: [0.054, 0.038, 0.074] },
    rabo: { r: 0.05, ponta: 0.03, comp: 0.46, pelo: 1.2 },
    pescoco: [[0, 0.6, 0.31], [0, 0.76, 0.44]],
    // deitado, como o dachshund: sentado, de orelha em pé, se confundia com o pastor
    deitado: { giro: 0.85, ergue: 0.1 },
  },
  dachshund: {
    frente: { r1: 0.07, r2: 0.04, pe: [0.05, 0.034, 0.066], ante: 0.2 },
    tras: { coxa: 0.082, canela: 0.042, pe: [0.05, 0.034, 0.068] },
    rabo: { r: 0.04, ponta: 0.017, comp: 0.36, pelo: 1 },
    pescoco: [[0, 0.36, 0.38], [0, 0.475, 0.52]],
    deitado: { giro: 0.85, ergue: 0.1 },
  },
};
/* a pose de cada raça é a única que ela tem nas medidas */
export const poseDaRaca = (raca) => (MEDIDAS[raca].sentado ? 'sentado' : 'deitado');

/* Longe da caixa de uma parte, a distância até a caixa basta (e é barata): só
   perto dela vale a pena calcular a forma de verdade. Sem isso, cada ponto da
   grade pagaria todas as partes do cachorro. */
const MARGEM = 0.08;
function limitada(f, [[x0, y0, z0], [x1, y1, z1]]){
  const cx = (x0+x1)/2, cy = (y0+y1)/2, cz = (z0+z1)/2;
  const hx = (x1-x0)/2, hy = (y1-y0)/2, hz = (z1-z0)/2;
  return (x, y, z) => {
    const qx = Math.max(Math.abs(x-cx)-hx, 0), qy = Math.max(Math.abs(y-cy)-hy, 0), qz = Math.max(Math.abs(z-cz)-hz, 0);
    const d = Math.sqrt(qx*qx + qy*qy + qz*qz);
    return d > MARGEM ? d : f(x, y, z);
  };
}
function caixaDosPontos(pontos){
  const c = [[1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]];
  pontos.forEach(p => {
    const r = p[3] || 0;
    for(let i=0;i<3;i++){
      c[0][i] = Math.min(c[0][i], p[i]-r);
      c[1][i] = Math.max(c[1][i], p[i]+r);
    }
  });
  return c;
}
const juntarCaixas = (a, b) => [
  [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1]), Math.min(a[0][2], b[0][2])],
  [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1]), Math.max(a[1][2], b[1][2])],
];
const cantos = ([[x0, y0, z0], [x1, y1, z1]]) => [
  [x0, y0, z0], [x1, y0, z0], [x0, y1, z0], [x1, y1, z0],
  [x0, y0, z1], [x1, y0, z1], [x0, y1, z1], [x1, y1, z1],
];

/* Atalho de duas grades: uma grade 4x mais grossa diz onde a pedra certamente não
   está perto, e ali a fina usa o valor da grossa sem calcular nada. Só as células
   em volta da superfície pagam a escultura inteira. Vale porque o campo varia no
   máximo uma unidade por unidade andada (com folga de 2x para as deformações). */
function comAtalho(f, [[x0, y0, z0], [x1, y1, z1]], h){
  const G = h*4;
  const nx = Math.ceil((x1-x0)/G) + 2, ny = Math.ceil((y1-y0)/G) + 2, nz = Math.ceil((z1-z0)/G) + 2;
  const grossa = new Float32Array(nx*ny*nz);
  for(let k=0;k<nz;k++) for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){
    grossa[i + nx*(j + ny*k)] = f(x0 + i*G, y0 + j*G, z0 + k*G);
  }
  const limiar = G*0.87*2 + h*2;
  return (x, y, z) => {
    const i = Math.round((x-x0)/G), j = Math.round((y-y0)/G), k = Math.round((z-z0)/G);
    if(i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz){
      const v = grossa[i + nx*(j + ny*k)];
      if(v > limiar || v < -limiar) return v;
    }
    return f(x, y, z);
  };
}

/* o ponto mais baixo de um campo, varrendo o plano do meio (x = 0) */
function fundo(f, [[, y0, z0], [, y1, z1]]){
  let menor = y1;
  for(let z=z0; z<=z1; z+=0.01){
    for(let y=y0; y<menor; y+=0.004){
      if(f(0, y, z) < 0){ menor = y; break; }
    }
  }
  return menor;
}

/* Corpo: gira `inclina` em volta do quadril (a frente sobe) e desce `desce`.
   Deitado é só descer. `campo` desfaz o movimento para consultar a escultura
   original; `ponto` faz o movimento, para levar caixas e marcos. */
function movimentoCorpo([, cy, cz], inclina, desce){
  const c = Math.cos(inclina), s = Math.sin(inclina);
  return {
    campo: (f) => (x, y, z) => {
      const dy = y + desce - cy, dz = z - cz;
      return f(x, cy + dy*c - dz*s, cz + dy*s + dz*c);
    },
    ponto: ([x, y, z]) => {
      const dy = y - cy, dz = z - cz;
      return [x, cy + dy*c + dz*s - desce, cz - dy*s + dz*c];
    },
  };
}

/* Cabeça: não acompanha a inclinação do corpo (cachorro sentado olha reto). Vai
   com o pivô do pescoço para onde o corpo o levou, ergue o nariz e vira de lado. */
function movimentoCabeca(P, Pn, ergue, giro){
  const ce = Math.cos(ergue), se = Math.sin(ergue), cg = Math.cos(giro), sg = Math.sin(giro);
  return {
    campo: (f) => (x, y, z) => {
      const dx = x - Pn[0], dy = y - Pn[1], dz = z - Pn[2];
      const rx = dx*cg - dz*sg, rz = dx*sg + dz*cg;
      const ry = dy*ce - rz*se, rz2 = dy*se + rz*ce;
      return f(P[0] + rx, P[1] + ry, P[2] + rz2);
    },
    ponto: ([x, y, z]) => {
      const dx = x - P[0], dy = y - P[1], dz = z - P[2];
      const ry = dy*ce + dz*se, rz = -dy*se + dz*ce;
      const rx = dx*cg + rz*sg, rz2 = -dx*sg + rz*cg;
      return [Pn[0] + rx, Pn[1] + ry, Pn[2] + rz2];
    },
  };
}

const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x-a)/(b-a))); return t*t*(3-2*t); };

function campoEstatua(raca, pose){
  const R = receita(raca);
  const M = MEDIDAS[raca];
  const Q = M[pose];
  const sentado = pose === 'sentado';
  const P = R.pescocoPivo;
  const quadril = R.patas.find(p => p.pivo[2] < 0).pivo;
  const partes = [];
  let caixa = null;
  // quanto o pelo engorda a pedra; a caixa de cada parte cresce o mesmo tanto
  const L = R.comprimento*0.55;
  const folga = L*2.4 + (M.mechas ? M.mechas.amp : 0);
  const crescer = ([a, b]) => [a.map(v => v - folga), b.map(v => v + folga)];
  // a coleira procura o pescoço só no tronco e na cabeça: com as orelhas, a do
  // dachshund (que caem até o pescoço) se enrolava nelas
  const pescoco = [];
  const somar = (f, cx, k, noPescoco = false) => {
    cx = crescer(cx);
    const parte = [limitada(f, cx), k];
    partes.push(parte);
    if(noPescoco) pescoco.push(parte);
    caixa = caixa ? juntarCaixas(caixa, cx) : cx;
  };
  const comPelo = (f, pelo) => (x, y, z) => f(x, y, z) - L*pelo(x, y, z);
  // mechas: correm de cima para baixo (no peito variam com x, no flanco com z),
  // cada uma redonda por cima e separada da vizinha por um sulco fino, como pelo
  // talhado. Onda pura virava sanfona; a largura e a altura variam de mecha a mecha.
  const mecha = M.mechas ? (x, y, z, pelo) => {
    const peso = sst(M.mechas.de, M.mechas.ate, pelo);
    if(peso <= 0) return 0;
    const k = Math.PI/M.mechas.onda;
    const fase = (x + z)*k + Math.sin(y*9 + x*6)*1.3 + Math.sin(x*4.3 - z*3.7 + y*2.1)*1.1;
    const lomba = Math.sqrt(Math.abs(Math.sin(fase)));
    return M.mechas.amp*peso*(lomba - 0.55)*(0.7 + 0.3*Math.sin(x*11 + z*13 + y*5));
  } : () => 0;

  // tronco: desce até encostar no chão; sentado, antes gira em volta do quadril
  const troncoPelo = (x, y, z) => { const pl = R.pelo(x, y, z); return R.tronco(x, y, z) - L*pl - mecha(x, y, z, pl); };
  const giroCorpo = sentado ? Q.inclina : 0;
  const caixaGirada = caixaDosPontos(cantos(R.caixaTronco).map(movimentoCorpo(quadril, giroCorpo, 0).ponto));
  // afunda 2 cm: a barriga (ou o traseiro) assenta com uma área de apoio, não num ponto
  const desce = fundo(movimentoCorpo(quadril, giroCorpo, 0).campo(troncoPelo), caixaGirada) + 0.02;
  const corpo = movimentoCorpo(quadril, giroCorpo, desce);
  const caixaCorpo = (cx) => caixaDosPontos(cantos(cx).map(corpo.ponto));
  somar(corpo.campo(limitada(troncoPelo, crescer(R.caixaTronco))), caixaCorpo(crescer(R.caixaTronco)), 0, true);

  // cabeça e orelhas: nariz e olhos entram na pedra (estátua não tem olho de vidro)
  const mov0 = movimentoCabeca(P, corpo.ponto(P), Q.ergue, -Q.giro);
  // escala em volta do pivô do pescoço, junto com o resto do movimento da cabeça
  const e = M.cabeca || 1;
  const escalar = (f) => (x, y, z) => f(P[0] + (x - P[0])/e, P[1] + (y - P[1])/e, P[2] + (z - P[2])/e)*e;
  const mov = {
    campo: (f) => mov0.campo(escalar(f)),
    ponto: ([x, y, z]) => mov0.ponto([P[0] + (x - P[0])*e, P[1] + (y - P[1])*e, P[2] + (z - P[2])*e]),
  };
  const caixaMovida = (cx) => caixaDosPontos(cantos(crescer(cx)).map(mov.ponto));
  let cabeca = esculpir([[R.cabeca, 0], [elipsoide(...R.nariz.pos, ...R.nariz.esc), 0.016]]);
  [-1, 1].forEach(s => {
    const c = naSuperficie(R.cabeca, [s*R.olhos.x, R.olhos.y, R.olhos.z], R.olhos.r*0.45);
    cabeca = subtrair(cabeca, esfera(c[0], c[1], c[2], R.olhos.r*0.72), 0.01);
  });
  let caixaCab = R.caixaCabeca;
  if(M.focinho){
    const { de, estica } = M.focinho, base = cabeca;
    cabeca = (x, y, z) => base(x, y, z > de ? de + (z - de)/estica : z);
    caixaCab = [caixaCab[0], [caixaCab[1][0], caixaCab[1][1], de + (caixaCab[1][2] - de)*estica]];
  }
  somar(mov.campo(limitada(comPelo(cabeca, () => 0.3), crescer(caixaCab))), caixaMovida(caixaCab), 0.05, true);
  // orelha com mais pelo que a cara, senão some afundada na cabeça
  const O = M.orelha || { desce: 0, abre: 0, pelo: 1.1 };
  [-1, 1].forEach(s => {
    const [[ox0, oy0, oz0], [ox1, oy1, oz1]] = R.orelha.caixa(s);
    const cx = [[ox0 + s*O.abre, oy0 - O.desce, oz0], [ox1 + s*O.abre, oy1 - O.desce, oz1]];
    const forma = R.orelha.forma(s);
    const orelha = (x, y, z) => forma(x - s*O.abre, y + O.desce, z);
    somar(mov.campo(limitada(comPelo(orelha, () => O.pelo), crescer(cx))), caixaMovida(cx), 0.03);
  });

  const F = M.frente;
  R.patas.filter(p => p.pivo[2] > 0).forEach(({ pivo, forma }) => {
    const [x, y, z] = pivo;
    const ombro = corpo.ponto(pivo);
    if(sentado){
      // sentado: a mesma perna do passeio, reta até o chão, esticada só acima do
      // pé para alcançar o ombro, que subiu com o peito
      const yp = 0.1, estica = (ombro[1] - yp)/(y - yp), dz = ombro[2] - z;
      const perna = forma(x);
      const f = (px, py, pz) => perna(px, py < yp ? py : yp + (py - yp)/estica, pz - dz);
      somar(comPelo(f, () => 0.6), [[x - 0.12, -0.02, z + dz - 0.16], [x + 0.12, ombro[1] + 0.12, z + dz + 0.16]], 0.04);
      return;
    }
    // deitado: esticadas para a frente, cotovelo no chão
    const pontos = [
      [x, ombro[1], z, F.r1],
      [x*1.04, F.r1*0.85, z + 0.02, F.r1*0.82],
      [x*0.96, F.r2*1.05, z + F.ante, F.r2],
    ];
    const pe = [x*0.94, F.pe[1]*0.95, z + F.ante + F.pe[2]*0.55];
    const f = comPelo(esculpir([[corrente(pontos, 0.03), 0], [elipsoide(...pe, F.pe[0]*1.05, F.pe[1], F.pe[2]*1.1), 0.03]]), () => 0.6);
    somar(f, juntarCaixas(caixaDosPontos(pontos), caixaDosPontos([[...pe, F.pe[2]*1.1]])), 0.04);
  });

  // patas de trás dobradas: a coxa ao lado do quadril (sentado, mais alta e mais
  // redonda), a canela deitada no chão, o pé apontando para a frente
  const T = M.tras;
  R.patas.filter(p => p.pivo[2] < 0).forEach(({ pivo: [x, , z] }) => {
    const s = Math.sign(x), ax = Math.abs(x), rT = T.coxa;
    const coxa = sentado ? [s*(ax + rT*0.4), rT*1.3, z + rT*0.45] : [s*(ax + rT*0.3), rT*1.02, z + rT*0.3];
    const raios = sentado ? [rT*0.9, rT*1.35, rT*1.6] : [rT*0.85, rT*1.05, rT*1.6];
    const canela = [
      [s*(ax + rT*0.45), T.canela*1.1, z - rT*0.5, T.canela*1.1],
      [s*(ax + rT*0.55), T.canela, z + rT*2.0, T.canela*0.95],
    ];
    const pe = [s*(ax + rT*0.55), T.pe[1]*0.95, z + rT*2.0 + T.pe[2]*0.6];
    const f = comPelo(esculpir([
      [elipsoide(...coxa, ...raios), 0],
      [corrente(canela, 0.02), 0.04],
      [elipsoide(...pe, T.pe[0], T.pe[1], T.pe[2]*1.05), 0.03],
    ]), () => 0.8);
    const cx = [caixaDosPontos([[...coxa, Math.max(...raios)]]), caixaDosPontos(canela), caixaDosPontos([[...pe, T.pe[2]*1.05]])].reduce(juntarCaixas);
    somar(f, cx, 0.05);
  });

  // rabo: desce até o chão e se enrola por fora da coxa, do lado de quem chega;
  // sentado, vem para a frente, na direção das patas
  {
    const Rb = M.rabo, k = Rb.comp/0.5;
    const [, y0, rz] = corpo.ponto(R.rabo.pivo);
    const fora = Math.abs(quadril[0]) + T.coxa*(sentado ? 1.3 : 1.15) + Rb.r*0.6;
    const pontos = sentado ? [
      [0, y0, rz, Rb.r*0.85],
      [0, Math.max(Rb.r*1.05, y0*0.45), rz - 0.07*k, Rb.r],
      [-0.1*k, Rb.r, rz - 0.1*k, Rb.r],
      [-fora, Rb.r*0.95, rz + 0.06*k, Rb.r*0.95],
      [-fora*0.96, Rb.ponta*1.1, rz + 0.34*k, Rb.ponta],
    ] : [
      [0, y0, rz, Rb.r*0.85],
      [0, Math.max(Rb.r*1.1, y0*0.5), rz - 0.12*k, Rb.r],
      [-0.08*k, Rb.r, rz - 0.22*k, Rb.r],
      [-fora, Rb.r*0.95, rz - 0.14*k, Rb.r*0.9],
      [-fora*1.02, Rb.ponta*1.1, quadril[2] + T.coxa*0.6, Rb.ponta],
    ];
    const rabo = corrente(pontos, 0.03);
    // sem mechas: no rabo elas viravam uma pinha
    somar((x, y, z) => rabo(x, y, z) - L*Rb.pelo, caixaDosPontos(pontos), 0.04);
  }

  const tudo = esculpir(partes);
  // corta reto embaixo: a estátua assenta no pedestal
  const campo = (x, y, z) => Math.max(tudo(x, y, z), -y);
  caixa = [caixa[0].map(v => v - 0.03), caixa[1].map(v => v + 0.03)];
  caixa[0][1] = Math.max(caixa[0][1], -0.03);
  const soPescoco = esculpir(pescoco);
  return { campo, campoPescoco: (x, y, z) => soPescoco(x, y, z), caixa, corpo, M };
}

/* Coleira: anel que segue a forma real do pescoço. Em cada direção do plano
   perpendicular ao pescoço, procura onde a pedra acaba e passa um pouco por fora. */
function anelDoPescoco(campo, A, B, t, folga){
  const C = A.map((a, i) => a + (B[i]-a)*t);
  const n = new THREE.Vector3(B[0]-A[0], B[1]-A[1], B[2]-A[2]).normalize();
  const u = new THREE.Vector3(1, 0, 0);
  const v = new THREE.Vector3().crossVectors(n, u);
  const pontos = [];
  const N = 28;
  for(let i=0;i<N;i++){
    const a = i/N*Math.PI*2;
    const d = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
    const em = (r) => campo(C[0] + d.x*r, C[1] + d.y*r, C[2] + d.z*r);
    let r0 = 0, r1 = 0.01;
    while(em(r1) < 0 && r1 < 0.5){ r0 = r1; r1 += 0.01; }
    for(let j=0;j<16;j++){ const m = (r0+r1)/2; if(em(m) < 0) r0 = m; else r1 = m; }
    pontos.push(new THREE.Vector3(C[0], C[1], C[2]).addScaledVector(d, r1 + folga));
  }
  // a frente da garganta: para baixo e para a frente, onde a medalha pendura
  const frente = v.clone().negate();
  return { pontos, frente, n };
}

const CACHE = new Map();

/* devolve { corpo, coleira, medalha, largura, profundidade, altura }: geometrias
   já assentadas em y = 0 e centradas. Deitado, de perfil com o focinho para +x;
   sentado, de três quartos, porque de frente e de perfil a pose some. */
export function geoEstatua(raca, celula, pose = poseDaRaca(raca)){
  const chave = raca + pose + celula;
  if(CACHE.has(chave)) return CACHE.get(chave);
  const { campo, campoPescoco, caixa, corpo: mov, M } = campoEstatua(raca, pose);
  const corpo = malhaSDF(comAtalho(campo, caixa, celula), caixa, celula);

  const [A, B] = M.pescoco.map(mov.ponto);
  const anel = anelDoPescoco(campoPescoco, A, B, 0.62, 0.006);
  const espessura = 0.017;
  const coleira = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(anel.pontos, true, 'centripetal'), 72, espessura, 8, true);

  // medalha dourada pendurada na frente da coleira
  const iFrente = anel.pontos.reduce((melhor, p, i, arr) => (p.dot(anel.frente) > arr[melhor].dot(anel.frente) ? i : melhor), 0);
  const rMed = 0.03;
  const medalha = new THREE.CylinderGeometry(rMed, rMed, 0.008, 18);
  const baixo = new THREE.Vector3(0, -1, 0).projectOnPlane(anel.frente).normalize();
  medalha.applyMatrix4(new THREE.Matrix4().compose(
    anel.pontos[iFrente].clone().addScaledVector(anel.frente, espessura*0.6).addScaledVector(baixo, rMed*1.05),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), anel.frente),
    new THREE.Vector3(1, 1, 1),
  ));

  const giro = pose === 'sentado' ? 0.6 : Math.PI/2;
  [corpo, coleira, medalha].forEach(g => g.rotateY(giro));
  corpo.computeBoundingBox();
  const bb = corpo.boundingBox;
  const cx = (bb.min.x + bb.max.x)/2, cz = (bb.min.z + bb.max.z)/2;
  [corpo, coleira, medalha].forEach(g => { g.translate(-cx, 0, -cz); g.computeBoundingSphere(); });
  const res = {
    corpo, coleira, medalha,
    largura: bb.max.x - bb.min.x,
    profundidade: bb.max.z - bb.min.z,
    altura: bb.max.y,
  };
  CACHE.set(chave, res);
  return res;
}
