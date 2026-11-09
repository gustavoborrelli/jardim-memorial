/*
  OS GATOS
  Mesma técnica dos cachorros (caes.js): cada parte é um campo de distância
  esculpido, com pelo em cascas por cima. Aqui mora só a receita de cada raça;
  a montagem e a animação são as de caes.js, que reconhece `especie: 'gato'`
  e troca o que é de gato: olhos coloridos com pupila em fenda, bigodes, nariz
  pequeno, sem língua de fora, andar de gato e câmera sem balanço de respiração.

  As três raças mais comuns no Brasil: Siamês, Persa e Maine Coon. O corpo é o
  mesmo molde com proporções diferentes (montarGato): o siamês é esguio, de
  cabeça em cunha e orelhas grandes; o persa é atarracado, de cara achatada,
  orelhas pequenas e pelo longo; o maine coon é grande, de pelo médio, com
  tufos na ponta das orelhas e listras de tigrado.
*/
import * as THREE from 'three';
import { esculpir, esfera, elipsoide, cone, corrente } from './sdf.js';

export const GATOS = ['siames', 'persa', 'mainecoon'];

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const mixv = (a, b, t, o) => { o[0] = a[0]+(b[0]-a[0])*t; o[1] = a[1]+(b[1]-a[1])*t; o[2] = a[2]+(b[2]-a[2])*t; return o; };
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x-a)/(b-a))); return t*t*(3-2*t); };
const ruido3 = (x, y, z) => {
  const h = Math.sin(x*12.9 + y*27.1 + z*19.3)*0.5 + Math.sin(x*31.7 - z*23.1 + y*11.0)*0.3 + Math.sin(z*41.0 + y*37.0)*0.2;
  return h*0.5 + 0.5;
};
const achatarZ = (f, cz, k) => (x, y, z) => f(x, y, cz + (z-cz)*k)/k;
function caixaDe(pontos, m){
  const c = [[1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]];
  pontos.forEach(p => { for(let i=0;i<3;i++){ c[0][i] = Math.min(c[0][i], p[i] - m); c[1][i] = Math.max(c[1][i], p[i] + m); } });
  return c;
}
// leva um ponto até a superfície do campo (a mesma conta de caes.js)
function naSuperficie(f, p, afastar = 0){
  let [x, y, z] = p;
  const e = 0.002;
  for(let i=0;i<12;i++){
    const d = f(x, y, z) - afastar;
    const gx = f(x+e, y, z) - f(x-e, y, z), gy = f(x, y+e, z) - f(x, y-e, z), gz = f(x, y, z+e) - f(x, y, z-e);
    const il = 1/(Math.hypot(gx, gy, gz) || 1);
    x -= gx*il*d; y -= gy*il*d; z -= gz*il*d;
  }
  return [x, y, z];
}

/* O molde: proporções em `m`, cores em `cores(G)` (G traz as medidas já montadas,
   para as cores saberem onde ficam a cara, as patas e o rabo). */
function montarGato(m){
  const S = m.escala;
  const P = m.quadril*S, Rb = m.corpo*S;
  const zr = m.traseiro*S, zc = m.peito*S;
  const yB = P + 0.012*S;
  const [rx, ry, rz] = m.cranio.map(v => v*S);
  const foc = m.focinho*S;
  const H = [0, yB + 0.2*S, zc + 0.17*S + rz*0.35];
  const pescoco = [0, yB + 0.11*S, zc + 0.09*S];

  const tronco = esculpir([
    [corrente([[0, yB, zr, Rb*1.05], [0, yB + 0.01*S, (zr + zc)/2, Rb*m.cintura], [0, yB + 0.02*S, zc, Rb*1.08]], 0.05*S), 0],
    [elipsoide(0, yB - 0.006*S, zc + 0.02*S, Rb*0.86, Rb*1.04, Rb*0.86), 0.06*S],
    [cone([0, yB + 0.03*S, zc + 0.03*S], [0, yB + 0.14*S, zc + 0.12*S], Rb*0.8, Rb*0.66), 0.06*S],
  ]);
  const caixaTronco = caixaDe([[0, yB, zr], [0, yB, zc], [0, yB + 0.14*S, zc + 0.12*S]], Rb*1.3 + 0.03);

  // cabeça redonda: crânio, bochechas cheias, almofada do focinho e queixo
  const yFoc = H[1] - ry*0.4, zFoc = H[2] + rz*0.78 + foc*0.5;
  const partesCabeca = [
    [elipsoide(H[0], H[1], H[2], rx, ry, rz), 0],
    [esfera(rx*0.48, H[1] - ry*0.32, H[2] + rz*0.42, rx*0.5), 0.04*S],
    [esfera(-rx*0.48, H[1] - ry*0.32, H[2] + rz*0.42, rx*0.5), 0.04*S],
    [elipsoide(0, yFoc, zFoc, rx*0.44, ry*0.33, rz*0.3 + foc*0.5), 0.03*S],
    [elipsoide(0, H[1] - ry*0.66, H[2] + rz*0.66 + foc*0.4, rx*0.3, ry*0.2, rz*0.24), 0.025*S],
    [cone(pescoco, [0, H[1] - ry*0.3, H[2] - rz*0.35], Rb*0.72, rx*0.62), 0.05*S],
  ];
  if(m.cunha) partesCabeca.push([cone([0, H[1] + ry*0.1, H[2]], [0, yFoc + 0.004*S, zFoc + 0.01*S], rx*0.6, rx*0.34), 0.04*S]);
  const cabeca = esculpir(partesCabeca);
  // na estátua o pescoço é só o do corpo: com o da cabeça junto, os dois somavam
  // um calombo na nuca (o "pescoço corcunda" que o Gustavo viu)
  const cabecaEstatua = esculpir(partesCabeca.filter((p, i) => i !== 5));
  const caixaCabeca = caixaDe([H, pescoco, [0, yFoc, zFoc + foc]], Math.max(rx, ry, rz)*1.35 + 0.04);

  // nariz e boca nascem da superfície de verdade
  const nariz = naSuperficie(cabeca, [0, yFoc + ry*0.2, zFoc + 0.1*S], 0.002);
  const ponta = [0, nariz[1] - 0.016*S, nariz[2]];
  const boca = {
    haste: [0, nariz[1] - 0.006*S, nariz[2] + 0.002],
    a: ponta,
    b: [0.015*S, ponta[1] - 0.008*S, ponta[2] - 0.006*S],
    c: [0.028*S, ponta[1] - 0.002*S, ponta[2] - 0.016*S],
  };
  const olhos = { x: rx*0.47, y: H[1] + ry*0.1, z: H[2] + rz*0.72, r: m.olho*S, iris: m.iris };

  // orelhas: triângulo em pé, achatado; o maine coon ganha um tufo na ponta
  const O = m.orelha;
  const orelha = {
    forma: (s) => {
      const base = [s*rx*O.abre, H[1] + ry*0.55, H[2] - rz*0.12];
      const topo = [s*(rx*O.abre + O.inclina*S), H[1] + ry*0.55 + O.alt*S, H[2] - rz*0.18];
      const partes = [[achatarZ(cone(base, topo, O.larg*S, O.larg*S*0.16), base[2], 2.4), 0]];
      if(O.tufo) partes.push([cone([topo[0]*0.98, topo[1] - 0.008*S, topo[2]], [topo[0]*1.04, topo[1] + O.tufo*S, topo[2] - 0.004], 0.009*S, 0.002*S), 0.006*S]);
      return esculpir(partes);
    },
    caixa: (s) => caixaDe([[s*rx*O.abre, H[1] + ry*0.55, H[2] - rz*0.12], [s*(rx*O.abre + O.inclina*S), H[1] + ry*0.55 + (O.alt + (O.tufo || 0))*S, H[2] - rz*0.18]], O.larg*S + 0.03),
    pivo: (s) => [s*rx*O.abre, H[1] + ry*0.5, H[2] - rz*0.12],
    plano: H[2] - rz*0.12,
  };

  // patas: a traseira tem o jarrete (a "dobra" para trás); pé redondinho
  const xT = Rb*0.6, xF = Rb*0.54, rp = m.pata*S;
  const pataTras = (x) => esculpir([
    [corrente([[x, P, zr, Rb*0.62], [x, P*0.62, zr + 0.03*S, rp*1.5], [x, P*0.3, zr - 0.05*S, rp], [x, 0.03*S, zr - 0.02*S, rp]], 0.03*S), 0],
    [elipsoide(x, 0.02*S, zr - 0.005*S, rp*1.25, 0.02*S, rp*1.5), 0.02*S],
  ]);
  const pataFrente = (x) => esculpir([
    [corrente([[x, P, zc, Rb*0.5], [x, P*0.5, zc + 0.005*S, rp*1.2], [x, 0.035*S, zc + 0.01*S, rp]], 0.02*S), 0],
    [elipsoide(x, 0.02*S, zc + 0.02*S, rp*1.25, 0.02*S, rp*1.45), 0.02*S],
  ]);
  const patas = [
    { pivo: [-xT, P, zr], forma: pataTras },
    { pivo: [xT, P, zr], forma: pataTras },
    { pivo: [-xF, P, zc], forma: pataFrente },
    { pivo: [xF, P, zc], forma: pataFrente },
  ];

  // rabo erguido, com a ponta virando para a frente (o "ponto de interrogação")
  const rt = m.rabo*S, y0 = yB + Rb*0.45, z0 = zr - Rb*0.85;
  const pontosRabo = [
    [0, y0, z0, rt], [0, y0 + 0.1*S, z0 - 0.08*S, rt*0.96], [0, y0 + 0.24*S, z0 - 0.11*S, rt*0.92],
    [0, y0 + 0.36*S, z0 - 0.07*S, rt*0.86], [0, y0 + 0.41*S, z0 + 0.0, rt*0.7],
  ];
  const rabo = { pivo: [0, y0, z0], forma: corrente(pontosRabo, 0.02*S), caixa: caixaDe(pontosRabo, rt + 0.03) };

  const G = { S, P, Rb, zr, zc, yB, H, rx, ry, rz, yFoc, zFoc, nariz, olhos, orelha, y0, z0 };
  const pinta = m.cores(G);

  // pelo: cara curta (no persa, nem tanto), juba no peito, barriga mais comprida
  const pelo = (x, y, z) => {
    let p = 1;
    const cara = sst(H[2] + rz*0.25, H[2] + rz*0.7, z)*(y > H[1] - ry*1.1 ? 1 : 0);
    p *= 1 - cara*m.caraCurta;
    p += sst(zc - 0.02*S, zc + 0.1*S, z)*sst(yB + 0.12*S, yB - 0.04*S, y)*m.juba;
    p += sst(yB - Rb*0.4, yB - Rb, y)*0.3;
    if(y < 0.06*S) p *= 0.4;
    const dOlho = Math.hypot(Math.abs(x) - olhos.x, y - olhos.y, z - olhos.z);
    p *= sst(olhos.r*1.15, olhos.r*1.9, dOlho);
    const dNariz = Math.hypot(x, y - nariz[1], z - nariz[2]);
    p *= sst(0.015*S, 0.04*S, dNariz);
    return p;
  };

  return {
    especie: 'gato',
    velocidade: 0.82,
    semLingua: true,
    comprimento: m.pelo, densidade: m.densidade,
    olhos,
    nariz: { pos: nariz, esc: [0.012*S*m.narizEsc, 0.009*S*m.narizEsc, 0.009*S*m.narizEsc], cor: m.narizCor },
    boca, bocaEspessura: 0.0026*S,
    lingua: { pos: [0, ponta[1] - 0.004, ponta[2] - 0.004], esc: [0.008, 0.012, 0.004] },
    bigodes: { raiz: [rx*0.34, yFoc - ry*0.04, zFoc + 0.01*S], comp: 0.15*S },
    pescocoPivo: pescoco,
    olhoAltura: olhos.y, olhoFrente: nariz[2] + 0.07,
    tronco, caixaTronco, cabeca, cabecaEstatua, caixaCabeca, orelha, patas, rabo,
    cor: pinta.cor, corOrelha: pinta.corOrelha, corPata: pinta.corPata, corRabo: pinta.corRabo,
    pelo,
    peloRabo: () => m.peloRabo,
  };
}

export function receitaGato(raca){
  if(raca === 'persa'){
    // persa creme-claro, olhos cor de cobre, nariz rosado
    const CREME = lin(0xf1eadf), SOMBRA = lin(0xd8cdbd), ROSA = lin(0xe9b4ae);
    return montarGato({
      escala: 1, quadril: 0.235, corpo: 0.125, cintura: 1.0, traseiro: -0.2, peito: 0.15,
      cranio: [0.112, 0.1, 0.092], focinho: 0.004, cunha: false, olho: 0.031, iris: 0xd9852a,
      orelha: { abre: 0.62, inclina: 0.03, alt: 0.058, larg: 0.035 },
      pata: 0.026, rabo: 0.034, pelo: 0.038, densidade: 165, caraCurta: 0.55, juba: 0.9, peloRabo: 1.7,
      narizCor: 0xd99a98, narizEsc: 0.9,
      cores: (G) => ({
        cor(x, y, z, o){
          const n = ruido3(x*3, y*3, z*3);
          mixv(CREME, SOMBRA, sst(G.yB + G.Rb*0.5, G.yB + G.Rb*1.1, y + (n - .5)*0.04)*0.45, o);
          const dOlho = Math.hypot(Math.abs(x) - G.olhos.x, y - G.olhos.y, z - G.olhos.z);
          if(dOlho < G.olhos.r*2) mixv(o, SOMBRA, sst(G.olhos.r*2, G.olhos.r*1.2, dOlho)*0.6, o);
        },
        corOrelha(x, y, z, o){ mixv(CREME, ROSA, z > G.orelha.plano + 0.004 ? 0.55 : 0, o); },
        corPata(x, y, z, o){ o[0] = CREME[0]; o[1] = CREME[1]; o[2] = CREME[2]; },
        corRabo(x, y, z, o){ mixv(CREME, SOMBRA, 0.25, o); },
      }),
    });
  }
  if(raca === 'mainecoon'){
    // maine coon tigrado marrom com peito e focinho brancos, olhos verde-dourados
    const BASE = lin(0x8d6a47), LISTRA = lin(0x3b2a1d), CLARO = lin(0xc6a57c), BRANCO = lin(0xf1e9db), ROSA = lin(0xd8a59c);
    return montarGato({
      escala: 1.16, quadril: 0.3, corpo: 0.112, cintura: 0.96, traseiro: -0.3, peito: 0.21,
      cranio: [0.1, 0.092, 0.1], focinho: 0.036, cunha: false, olho: 0.026, iris: 0xa9a43a,
      orelha: { abre: 0.58, inclina: 0.012, alt: 0.11, larg: 0.043, tufo: 0.035 },
      pata: 0.028, rabo: 0.036, pelo: 0.032, densidade: 160, caraCurta: 0.7, juba: 0.7, peloRabo: 1.9,
      narizCor: 0x9c4f42, narizEsc: 0.85,
      cores: (G) => ({
        cor(x, y, z, o){
          const n = ruido3(x*3, y*3, z*3);
          mixv(BASE, CLARO, sst(G.yB, G.yB - G.Rb*0.9, y)*0.6, o);
          // listras de tigrado nos flancos e no dorso, onduladas
          const naCabeca = z > G.H[2] - G.rz*0.6 && y > G.H[1] - G.ry*1.2;
          if(!naCabeca){
            const t = Math.sin(z*36 + Math.sin(y*22 + x*8)*1.4 + n*2.2);
            mixv(o, LISTRA, sst(0.25, 0.7, t)*sst(G.yB - G.Rb*0.5, G.yB + G.Rb*0.3, y)*0.85, o);
          } else {
            // o "M" da testa, em traços verticais
            const t = Math.sin(x*95 + n);
            mixv(o, LISTRA, sst(0.4, 0.85, t)*sst(G.H[1] + G.ry*0.15, G.H[1] + G.ry*0.6, y)*sst(G.rx*0.6, G.rx*0.3, Math.abs(x))*0.8, o);
          }
          // peito, barriga, focinho e queixo brancos
          const peito = sst(G.zc - 0.02, G.zc + 0.1, z)*sst(G.yB + 0.06, G.yB - 0.06, y);
          const barriga = sst(G.yB - G.Rb*0.6, G.yB - G.Rb*1.0, y);
          const focinho = Math.hypot(x*0.8, y - G.yFoc, z - G.zFoc) < G.rx*0.55 ? 1 : 0;
          const queixo = sst(G.H[1] - G.ry*0.45, G.H[1] - G.ry*0.75, y)*(z > G.H[2] ? 1 : 0);
          mixv(o, BRANCO, Math.min(1, peito + barriga + focinho*0.9 + queixo)*0.92, o);
        },
        corOrelha(x, y, z, o){ mixv(BASE, ROSA, z > G.orelha.plano + 0.004 ? 0.5 : 0, o); if(y > G.H[1] + G.ry*0.55 + 0.1) mixv(o, LISTRA, 0.7, o); },
        corPata(x, y, z, o){
          mixv(BASE, LISTRA, sst(0.3, 0.75, Math.sin(y*48))*0.7, o);
          mixv(o, BRANCO, sst(0.06, 0.025, y), o);
        },
        corRabo(x, y, z, o){
          const t = Math.sin((y - G.y0)*34 - (z - G.z0)*20);
          mixv(BASE, LISTRA, sst(0.2, 0.7, t)*0.9, o);
        },
      }),
    });
  }
  // siamês: corpo creme, "pontas" escuras (máscara, orelhas, patas e rabo), olhos azuis
  const CREME = lin(0xefe3cc), FULVO = lin(0xd6bf9b), ESCURO = lin(0x3e2c22);
  return montarGato({
    escala: 1, quadril: 0.3, corpo: 0.094, cintura: 0.9, traseiro: -0.27, peito: 0.19,
    cranio: [0.082, 0.078, 0.094], focinho: 0.05, cunha: true, olho: 0.025, iris: 0x4c98da,
    orelha: { abre: 0.6, inclina: 0.035, alt: 0.115, larg: 0.042 },
    pata: 0.022, rabo: 0.022, pelo: 0.009, densidade: 230, caraCurta: 0.8, juba: 0.1, peloRabo: 1.1,
    narizCor: 0x35261f, narizEsc: 1,
    cores: (G) => ({
      cor(x, y, z, o){
        const n = ruido3(x*3, y*3, z*3);
        mixv(CREME, FULVO, sst(G.yB, G.yB + G.Rb, y + (n - .5)*0.03)*0.6, o);
        // máscara: escura no focinho, clareando até os olhos
        const d = Math.hypot(x*0.9, (y - G.yFoc)*1.1, z - G.zFoc);
        mixv(o, ESCURO, sst(G.rx*1.75, G.rx*0.55, d)*0.95, o);
      },
      corOrelha(x, y, z, o){ o[0] = ESCURO[0]; o[1] = ESCURO[1]; o[2] = ESCURO[2]; },
      corPata(x, y, z, o){ mixv(FULVO, ESCURO, sst(G.P*0.85, G.P*0.35, y), o); },
      corRabo(x, y, z, o){ mixv(FULVO, ESCURO, sst(G.y0 - 0.02, G.y0 + 0.08, y), o); },
    }),
  });
}
