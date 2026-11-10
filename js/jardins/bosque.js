"use strict";

/*
  A PLANTA DO BOSQUE DOS VAGA-LUMES (etapa 40)
  O terceiro jardim dos Jardins do Arco-Íris, da miniatura do mapa-múndi e da
  descrição aprovada em 2026-11-09: uma trilha sinuosa entre pinheiros, clareiras
  de três ou quatro vagas, um riacho com uma pontezinha de pedra e vaga-lumes ao
  entardecer.

  O riacho atravessa o bosque na diagonal, de noroeste para sudeste, e divide o
  jardim em duas metades; a trilha sai do patamar da Ponte do Arco-Íris, a
  sudoeste, cruza o riacho pela ponte de pedra e termina na Clareira da Lua, ao
  norte. Ramais levam às outras três clareiras. São 14 vagas.

  Só medidas e contas (nada de 3D), como a planta do Lago.
  Coordenadas: x para leste, z para o sul.
*/
import { raioEm, suave, catmull, medidorDeLinhas, redeDeTrilhas, aoLongo, ladoDa } from './comum.js';

/* ============ A TERRA DO BOSQUE ============ */
export const BORDA = { r: 26.5, ondas: [[2, 0.05, 2.3], [3, 0.04, 0.8], [5, 0.03, 1.6], [7, 0.02, 0.2]] };
export const raioBorda = (x, z) => BORDA.r*raioEm(BORDA.ondas, Math.atan2(z, x));
export const NIVEL_AGUA = -0.32;

/* ============ O RIACHO ============
   Entra pela mata a noroeste e sai a sudeste, fazendo curvas. */
export const RIACHO = catmull([
  [-36, -11.5], [-27, -8.5], [-19, -5.5], [-12, -7], [-5, -3.5], [1, 0], [7, -1.5], [13, 2.5], [19, 5], [26, 8.5], [36, 10.5],
], false, 8);
const MEDIDOR_RIACHO = medidorDeLinhas([RIACHO], { min: -40, lado: 2, n: 40, perto: 4 });
export const distRiacho = (x, z) => MEDIDOR_RIACHO.distancia(x, z);
// para onde a água corre (de noroeste para sudeste, em média), para as ondinhas andarem
export const FLUXO = [0.93, 0.36];
export const sdAgua = (x, z) => distRiacho(x, z) - 1.5;

/* ============ A PONTE DE PEDRA ============
   Onde a trilha cruza o riacho: atravessada no rumo da água, um arquinho baixo. */
export const PONTE_PEDRA = (() => {
  const c = MEDIDOR_RIACHO.pontoMaisPerto(1, 0.2);
  // o rumo da água ali, pelos pontos vizinhos
  let melhor = 0, dm = Infinity;
  RIACHO.forEach((p, i) => { const d = Math.hypot(p[0] - c[0], p[1] - c[1]); if(d < dm){ dm = d; melhor = i; } });
  const a = RIACHO[Math.max(0, melhor - 2)], b = RIACHO[Math.min(RIACHO.length - 1, melhor + 2)];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const agua = [(b[0] - a[0])/l, (b[1] - a[1])/l];
  // o eixo da ponte é de lado para a água, apontando para o sul
  let eixo = [-agua[1], agua[0]];
  if(eixo[1] < 0) eixo = [-eixo[0], -eixo[1]];
  return { x: c[0], z: c[1], eixo, meio: 2.9, meiaLargura: 0.95, alto: 0.55 };
})();
const naPontePedra = (x, z) => {
  const P = PONTE_PEDRA, dx = x - P.x, dz = z - P.z;
  return { s: dx*P.eixo[0] + dz*P.eixo[1], t: -dx*P.eixo[1] + dz*P.eixo[0] };
};

/* ============ AS CLAREIRAS E AS VAGAS ============
   Quatro clareiras abertas entre os pinheiros, cada uma com as vagas num arco em
   volta do meio (de onde se vê todas) e a entrada livre do lado da trilha. */
const LADO_SUL = Math.PI/2;
export const CLAREIRAS = [
  { nome: 'Clareira da Lua', x: 3, z: -17.5, r: 5.6, entrada: LADO_SUL, vagas: 4 },
  { nome: 'Clareira do Riacho', x: 12.5, z: 10, r: 5.4, entrada: Math.PI + 0.25, vagas: 4 },
  { nome: 'Clareira das Samambaias', x: -14, z: 4.5, r: 5, entrada: 0.55, vagas: 3 },
  { nome: 'Recanto dos Vaga-lumes', x: -10.2, z: -14.6, r: 5, entrada: 0.35, vagas: 3 },
];
export const VAGAS = [];
CLAREIRAS.forEach(c => {
  // as vagas ocupam o arco do lado oposto à entrada
  const abre = c.vagas === 4 ? 2.6 : 2.0;
  for(let i = 0; i < c.vagas; i++){
    const a = c.entrada + Math.PI + (i/(c.vagas - 1) - 0.5)*abre*1.25;
    const x = c.x + Math.cos(a)*3.9, z = c.z + Math.sin(a)*3.9;
    VAGAS.push({ x: Math.round(x*100)/100, z: Math.round(z*100)/100, section: c.nome, rot: Math.atan2(c.x - x, c.z - z) });
  }
});
const pontoDeEntrada = (c, k) => [c.x + Math.cos(c.entrada)*c.r*k, c.z + Math.sin(c.entrada)*c.r*k];

/* ============ AS TRILHAS ============
   A principal sai do patamar da ponte, a sudoeste, cruza o riacho pela ponte de
   pedra e termina na Clareira da Lua; os ramais saem dela para as outras três. */
export const LARGURA_TRILHA = 1.7;
export const PONTE = { x: -17.8, z: 17.6 }; // o patamar da Ponte do Arco-Íris
const P = PONTE_PEDRA;
const antesDaPonte = (k) => [P.x + P.eixo[0]*(P.meio + k), P.z + P.eixo[1]*(P.meio + k)];
const depoisDaPonte = (k) => [P.x - P.eixo[0]*(P.meio + k), P.z - P.eixo[1]*(P.meio + k)];
const [LUA, RIACHO_C, SAMAMBAIAS, VAGALUMES] = CLAREIRAS;
export const TRILHAS = {
  principal: catmull([
    [PONTE.x, PONTE.z], [-14, 14.6], [-10, 12.4], [-6.6, 9.2], [-3.6, 6.8], antesDaPonte(1.4), antesDaPonte(0),
    depoisDaPonte(0), depoisDaPonte(1.4), [3.8, -7.2], [4.6, -11], pontoDeEntrada(LUA, 0.9), [LUA.x, LUA.z],
  ], false, 6),
  riacho: catmull([antesDaPonte(2.2), [6, 6.4], [9, 8.8], pontoDeEntrada(RIACHO_C, 0.9), [RIACHO_C.x, RIACHO_C.z]], false, 6),
  samambaias: catmull([[-6.6, 9.2], [-9.4, 7.6], pontoDeEntrada(SAMAMBAIAS, 0.9), [SAMAMBAIAS.x, SAMAMBAIAS.z]], false, 6),
  vagalumes: catmull([[3.8, -7.2], [-1.2, -9.8], [-5.6, -12.8], pontoDeEntrada(VAGALUMES, 0.9), [VAGALUMES.x, VAGALUMES.z]], false, 6),
};
const MEDIDOR = medidorDeLinhas(Object.values(TRILHAS), { min: -40, lado: 2, n: 40, perto: 4 });
export const distTrilha = (x, z) => MEDIDOR.distancia(x, z);
export function sdCaminho(x, z){
  let d = distTrilha(x, z) - LARGURA_TRILHA/2;
  for(const c of CLAREIRAS) d = Math.min(d, Math.hypot(x - c.x, z - c.z) - 1.15); // a rodinha no meio da clareira
  d = Math.min(d, Math.hypot(x - PONTE.x, z - PONTE.z) - 2.0);
  // nada de cascalho dentro do riacho (debaixo da ponte de pedra é água)
  return Math.max(d, 1.75 - distRiacho(x, z));
}
export const rotaAte = redeDeTrilhas(Object.values(TRILHAS));

/* ============ O RELEVO ============
   Um chão que ondula, subindo de leve para o norte, e o leito do riacho cavado. */
export function relevo(x, z){
  let h = 0.18*Math.sin(x*0.17 + 0.6)*Math.sin(z*0.21 + 1.1) + 0.08*Math.sin(x*0.39 - z*0.27 + 0.4);
  h += 0.55*suave(6, -24, z);
  // as clareiras são mais planas: as vagas ficam retas
  for(const c of CLAREIRAS){ const k = 1 - suave(c.r - 1, c.r + 2, Math.hypot(x - c.x, z - c.z)); if(k > 0) h = h*(1 - k*0.7); }
  const c = 1 - suave(0.6, 2.4, distRiacho(x, z));
  if(c > 0) h = h*(1 - c) - 1.15*c;
  return h;
}

/* ============ ONDE SE ANDA ============ */
const alturaDaPontePedra = (s) => P.alto*(1 - (s/P.meio)*(s/P.meio));
export function chao(x, z, alturaTerreno){
  const { s, t } = naPontePedra(x, z);
  if(Math.abs(s) < P.meio && Math.abs(t) < P.meiaLargura - 0.2) return P.base + alturaDaPontePedra(s);
  const dentro = Math.hypot(x, z) < raioBorda(x, z) - 1.2 || Math.hypot(x - PONTE.x, z - PONTE.z) < 2.2;
  if(!dentro) return null;
  const h = alturaTerreno(x, z);
  return h > NIVEL_AGUA + 0.06 ? h : null;
}
// a base da ponte de pedra (o chão nas duas cabeceiras), acertada pelo mundo
export function acertarPontePedra(alturaTerreno){
  const a = alturaTerreno(P.x + P.eixo[0]*P.meio, P.z + P.eixo[1]*P.meio);
  const b = alturaTerreno(P.x - P.eixo[0]*P.meio, P.z - P.eixo[1]*P.meio);
  P.base = Math.max(a, b) + 0.02;
  P.alturaEm = (s) => P.base + alturaDaPontePedra(s);
}
PONTE_PEDRA.base = 0;

/* ============ PLACAS, LAMPIÕES, TRONCOS ============
   Na entrada de cada clareira, uma placa de um lado da trilha e um lampião do
   outro: os lugares ao lado da entrada são testados e ficam os livres da trilha. */
const ladosDaEntrada = CLAREIRAS.map(c => {
  const [x, z] = pontoDeEntrada(c, 1.2);
  const lx = Math.cos(c.entrada + Math.PI/2), lz = Math.sin(c.entrada + Math.PI/2);
  const livres = [];
  for(const d of [1.5, 2.1, 2.7, 3.3]) for(const lado of [1, -1]){
    const px = x + lx*d*lado, pz = z + lz*d*lado;
    if(distTrilha(px, pz) >= 1.25 && !livres.some(q => Math.hypot(q.x - px, q.z - pz) < 1.6)) livres.push({ x: px, z: pz, lado });
  }
  return livres;
});
export const PLACAS = [
  { nome: 'Bosque dos Vaga-lumes', tipo: 'arco', ...aoLongo(TRILHAS.principal, 0.07) },
  ...CLAREIRAS.map((c, i) => ({ nome: c.nome, tipo: 'placa', x: ladosDaEntrada[i][0].x, z: ladosDaEntrada[i][0].z, rot: Math.atan2(Math.cos(c.entrada), Math.sin(c.entrada)) })),
];
export const LAMPADAS = [
  ladoDa(TRILHAS.principal, 0.04, 1.7), ladoDa(TRILHAS.principal, 0.04, -1.7),
  (() => { const [x, z] = antesDaPonte(0.6); return { x: x + P.eixo[1]*1.5, z: z - P.eixo[0]*1.5 }; })(),
  (() => { const [x, z] = depoisDaPonte(0.6); return { x: x - P.eixo[1]*1.5, z: z + P.eixo[0]*1.5 }; })(),
  // o lampião fica do lado oposto ao da placa, se der
  ...ladosDaEntrada.map(l => l.find(q => q.lado !== l[0].lado) || l[1]),
];
// um tronco caído em cada clareira, para sentar, atravessado do lado das vagas
export const TRONCOS = CLAREIRAS.map(c => ({
  x: c.x + Math.cos(c.entrada + Math.PI)*1.9, z: c.z + Math.sin(c.entrada + Math.PI)*1.9,
  rot: c.entrada + Math.PI/2, comp: 2.2,
}));

/* ============ A PONTE DO ARCO-ÍRIS E A CHEGADA ============ */
export const PE_DA_PONTE = (() => {
  const [ax, az] = TRILHAS.principal[3];
  const dx = PONTE.x - ax, dz = PONTE.z - az, l = Math.hypot(dx, dz);
  // sai para sudoeste e vira para oeste enquanto sobe, por fora do bosque
  return { x: PONTE.x, z: PONTE.z, rumo: [dx/l, dz/l], vira: 1, raio: 2.1, destinos: ['memorial', 'lago'] };
})();
export const folgaDaBorda = (x, z) => raioBorda(x, z) - 1.5 - Math.hypot(x, z);
export const INICIO = (() => {
  const l = TRILHAS.principal, i = Math.floor(0.16*(l.length - 1));
  const [x, z] = l[i], [ax, az] = l[i + 2];
  return { x, z, yaw: Math.atan2(ax - x, az - z) };
})();
