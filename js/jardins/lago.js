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

/* contorno natural: um raio que ondula com o ângulo (o mesmo do esboço) */
export const raioEm = (ondas, a) => {
  let k = 1;
  for(const [f, amp, fase] of ondas) k += amp*Math.sin(f*a + fase);
  return k;
};
const suave = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a)/(b - a)));
  return t*t*(3 - 2*t);
};

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
function catmull(pts, fechada, passos = 6){
  const n = pts.length, P = (i) => fechada ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  const out = [];
  const ate = fechada ? n : n - 1;
  for(let i = 0; i < ate; i++){
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for(let k = 0; k < passos; k++){
      const t = k/passos, t2 = t*t, t3 = t2*t;
      const f = (a, b, c, d) => 0.5*((2*b) + (-a + c)*t + (2*a - 5*b + 4*c - d)*t2 + (-a + 3*b - 3*c + d)*t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(fechada ? out[0] : pts[n - 1]);
  return out;
}
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

/* distância até a trilha mais perto. O chão consulta isso um milhão de vezes ao
   assar a máscara: os segmentos ficam numa grade, e longe de tudo a resposta é
   só "longe" (o chão só usa o valor exato abaixo de ~3,2). */
const SEGMENTOS = [];
Object.values(TRILHAS).forEach(l => { for(let i = 0; i < l.length - 1; i++) SEGMENTOS.push([l[i][0], l[i][1], l[i + 1][0], l[i + 1][1]]); });
const GRADE = { min: -36, lado: 2, n: 36, perto: 4 };
const CELULAS = Array.from({ length: GRADE.n*GRADE.n }, () => []);
SEGMENTOS.forEach((s, k) => {
  const x0 = Math.min(s[0], s[2]) - GRADE.perto, x1 = Math.max(s[0], s[2]) + GRADE.perto;
  const z0 = Math.min(s[1], s[3]) - GRADE.perto, z1 = Math.max(s[1], s[3]) + GRADE.perto;
  for(let j = Math.max(0, Math.floor((z0 - GRADE.min)/GRADE.lado)); j <= Math.min(GRADE.n - 1, Math.floor((z1 - GRADE.min)/GRADE.lado)); j++)
    for(let i = Math.max(0, Math.floor((x0 - GRADE.min)/GRADE.lado)); i <= Math.min(GRADE.n - 1, Math.floor((x1 - GRADE.min)/GRADE.lado)); i++)
      CELULAS[j*GRADE.n + i].push(k);
});
function distSegmento(x, z, s){
  const vx = s[2] - s[0], vz = s[3] - s[1];
  const t = Math.max(0, Math.min(1, ((x - s[0])*vx + (z - s[1])*vz)/(vx*vx + vz*vz)));
  return Math.hypot(x - s[0] - vx*t, z - s[1] - vz*t);
}
export function distTrilha(x, z){
  const i = Math.floor((x - GRADE.min)/GRADE.lado), j = Math.floor((z - GRADE.min)/GRADE.lado);
  let d = 99;
  if(i >= 0 && j >= 0 && i < GRADE.n && j < GRADE.n) for(const k of CELULAS[j*GRADE.n + i]) d = Math.min(d, distSegmento(x, z, SEGMENTOS[k]));
  return d;
}
// o ponto da trilha mais perto (para as pedras olharem para quem passa)
function pontoNaTrilha(x, z){
  let melhor = null, dm = Infinity;
  for(const s of SEGMENTOS){
    const vx = s[2] - s[0], vz = s[3] - s[1];
    const t = Math.max(0, Math.min(1, ((x - s[0])*vx + (z - s[1])*vz)/(vx*vx + vz*vz)));
    const px = s[0] + vx*t, pz = s[1] + vz*t, d = Math.hypot(x - px, z - pz);
    if(d < dm){ dm = d; melhor = [px, pz]; }
  }
  return melhor;
}
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
// um ponto da polilinha (t de 0 a 1) e o giro para atravessar a trilha ali
function ao(linha, t){
  const i = Math.min(linha.length - 2, Math.floor(t*(linha.length - 1)));
  const [x0, z0] = linha[i], [x1, z1] = linha[i + 1];
  return { x: x0, z: z0, rot: Math.atan2(x1 - x0, z1 - z0) };
}

/* ============ ONDE SE ANDA ============
   Dentro da terra do jardim, mais a trilha que sai até a ponte; fora d'água,
   menos no deque. Devolve a altura do chão ali, ou null. */
export function chao(x, z, alturaTerreno){
  // no deque: longe da beirada e parando antes do banco da ponta
  if(noDeque(x, z, -0.2)){
    const u = (x - DEQUE.x)*DEQUE.dir[0] + (z - DEQUE.z)*DEQUE.dir[1];
    if(u < DEQUE.u1 - 1.25) return DEQUE.y;
  }
  if(noDeque(x, z)) return null;
  const dentro = Math.hypot(x, z) < raioBorda(x, z) - 1.2 || distTrilha(x, z) < 1.1 || Math.hypot(x - PONTE.x, z - PONTE.z) < 2.2;
  if(!dentro) return null;
  const h = alturaTerreno(x, z);
  return h > NIVEL_AGUA + 0.05 ? h : null;
}

/* ============ O QUE CRESCE ============ */
export const SALGUEIRO = (() => { const [x, z] = naMargem(-1.25, 0.6); return { x, z }; })();
export const BANCOS = (() => {
  const rumo = (x, z, ax, az) => Math.atan2(ax - x, az - z);
  // entre a trilha e a água, de frente para o lago
  const naBeira = (a) => { const [x, z] = naMargem(a, 1.7); return { x, z, rot: rumo(x, z, LAGO.x, LAGO.z) }; };
  const [bx, bz] = doDeque(4.3, 0);
  return [
    // na roda da clareira, olhando o lago lá embaixo
    { x: MORRO.x - 1.9, z: MORRO.z + 0.6, rot: rumo(MORRO.x - 1.9, MORRO.z + 0.6, LAGO.x, LAGO.z) },
    // na ponta do deque, de frente para a água
    { x: bx, z: bz, rot: Math.atan2(DEQUE.dir[0], DEQUE.dir[1]), y: DEQUE.y },
    // na prainha e debaixo do salgueiro
    naBeira(0.5), naBeira(-1.02),
  ];
})();
// lampiões na beira da trilha: acendem no fim da tarde
export const LAMPADAS = [
  ladoDa(TRILHAS.ponte, 0.97, 1.9), ladoDa(TRILHAS.ponte, 0.97, -1.9),
  ladoDa(TRILHAS.ponte, 0.45, 1.9), ladoDa(TRILHAS.clareira, 0.7, -1.9),
  ladoDa(TRILHAS.volta, 0.04, -1.9), ladoDa(TRILHAS.volta, 0.42, -1.9), ladoDa(TRILHAS.volta, 0.62, -1.9), ladoDa(TRILHAS.volta, 0.84, -1.9),
];
function ladoDa(linha, t, lado){
  const i = Math.min(linha.length - 2, Math.floor(t*(linha.length - 1)));
  const [x0, z0] = linha[i], [x1, z1] = linha[i + 1];
  const l = Math.hypot(x1 - x0, z1 - z0) || 1;
  return { x: x0 - (z1 - z0)/l*lado, z: z0 + (x1 - x0)/l*lado };
}

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
const NOS = [], ARESTAS = [];
{
  const indice = (p) => { NOS.push(p); ARESTAS.push([]); return NOS.length - 1; };
  const ligar = (a, b) => { const d = Math.hypot(NOS[a][0] - NOS[b][0], NOS[a][1] - NOS[b][1]); ARESTAS[a].push([b, d]); ARESTAS[b].push([a, d]); };
  const daVolta = [];
  TRILHAS.volta.slice(0, -1).forEach((p, k) => { daVolta.push(indice(p)); if(k > 0) ligar(daVolta[k - 1], daVolta[k]); });
  ligar(daVolta[daVolta.length - 1], daVolta[0]);
  [TRILHAS.clareira, TRILHAS.ponte].forEach(linha => {
    let ant = null;
    linha.forEach((p, k) => {
      const n = indice(p);
      if(ant !== null) ligar(ant, n);
      // a ponta que sai da volta do lago encosta no ponto da volta mais perto
      if(k === 0){
        let melhor = daVolta[0], dm = Infinity;
        daVolta.forEach(v => { const d = Math.hypot(NOS[v][0] - p[0], NOS[v][1] - p[1]); if(d < dm){ dm = d; melhor = v; } });
        ligar(n, melhor);
      }
      ant = n;
    });
  });
}
const noMaisPerto = (x, z) => {
  let melhor = 0, dm = Infinity;
  NOS.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - z); if(d < dm){ dm = d; melhor = i; } });
  return melhor;
};
// pontos [x, z] da trilha, de perto de `de` até perto de `para`, terminando em `para`
export function rotaAte(de, para){
  const a = noMaisPerto(de[0], de[1]), b = noMaisPerto(para[0], para[1]);
  const dist = new Array(NOS.length).fill(Infinity), veio = new Array(NOS.length).fill(-1), feito = new Array(NOS.length).fill(false);
  dist[a] = 0;
  for(;;){
    let u = -1;
    for(let i = 0; i < NOS.length; i++) if(!feito[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if(u < 0 || u === b) break;
    feito[u] = true;
    for(const [v, d] of ARESTAS[u]) if(dist[u] + d < dist[v]){ dist[v] = dist[u] + d; veio[v] = u; }
  }
  const caminho = [];
  for(let n = b; n >= 0; n = veio[n]){ caminho.push(NOS[n]); if(n === a) break; }
  caminho.reverse();
  // um ponto a cada ~1,5 m basta para o cachorro seguir a curva
  const pontos = [];
  caminho.forEach(p => { const u = pontos[pontos.length - 1]; if(!u || Math.hypot(p[0] - u[0], p[1] - u[1]) > 1.5) pontos.push(p); });
  pontos.push(para);
  return pontos;
}
// quanto falta até a borda do jardim (a câmera da chegada não para dentro da mata)
export const folgaDaBorda = (x, z) => raioBorda(x, z) - 1.5 - Math.hypot(x, z);

/* onde o cachorro chega (perto da ponte, já passado o arco de boas-vindas, virado
   trilha abaixo); enquanto a ponte não existe, é por aqui que se entra */
export const INICIO = (() => {
  const l = TRILHAS.ponte, i = Math.floor(0.68*(l.length - 1));
  const [x, z] = l[i], [ax, az] = l[i - 2];
  return { x, z, yaw: Math.atan2(ax - x, az - z) };
})();
