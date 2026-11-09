/*
  OS CACHORROS
  Cada raça é esculpida por campos de distância (ver sdf.js): uma superfície
  contínua, sem esferas se atravessando. O pelo é de verdade: a mesma malha é
  redesenhada em várias "cascas" empurradas para fora, e em cada casca só
  sobrevivem os pontos que pertencem a um fio. Empilhadas, viram fios com volume.

  Tudo é dividido nas partes que se movem (tronco, cabeça, orelhas, patas, rabo),
  cada uma com seu pivô, e animarCao() cuida de andar, respirar, olhar em volta,
  piscar, abanar o rabo e pôr a língua pra fora.

  As malhas ficam em cache por raça: cachorro-fantasma de outra pessoa não paga
  de novo a escultura.
*/
import * as THREE from 'three';
import { malhaSDF, esculpir, esfera, elipsoide, cone, corrente } from './sdf.js';
import { escolherPerfil } from './qualidade.js';
import { GATOS, receitaGato } from './gatos.js';

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const mixv = (a, b, t, o) => { o[0] = a[0]+(b[0]-a[0])*t; o[1] = a[1]+(b[1]-a[1])*t; o[2] = a[2]+(b[2]-a[2])*t; return o; };
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x-a)/(b-a))); return t*t*(3-2*t); };
const ruido3 = (x, y, z) => {
  const h = Math.sin(x*12.9 + y*27.1 + z*19.3)*0.5 + Math.sin(x*31.7 - z*23.1 + y*11.0)*0.3 + Math.sin(z*41.0 + y*37.0)*0.2;
  return h*0.5 + 0.5;
};
const achatarX = (f, cx, k) => (x, y, z) => f(cx + (x-cx)*k, y, z)/k;
const achatarZ = (f, cz, k) => (x, y, z) => f(x, y, cz + (z-cz)*k)/k;
// achata ao longo de uma direção qualquer (n unitário), em volta do ponto c
const achatarDir = (f, [cx, cy, cz], [nx, ny, nz], k) => (x, y, z) => {
  const t = ((x-cx)*nx + (y-cy)*ny + (z-cz)*nz)*(k-1);
  return f(x + nx*t, y + ny*t, z + nz*t)/k;
};

/* ============ material do pelo ============ */
function materialPelo({ comprimento, densidade, cascas, rim = 0.32 }){
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 1.15, alphaToCoverage: true });
  m.onBeforeCompile = (s) => {
    s.uniforms.uComp = { value: comprimento };
    s.uniforms.uDens = { value: densidade };
    s.uniforms.uRim = { value: rim };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', /* glsl */`#include <common>
        attribute float aPelo;
        uniform float uComp;
        varying float vS;
        varying vec3 vOP;
        varying float vPelo;
      `)
      .replace('#include <begin_vertex>', /* glsl */`#include <begin_vertex>
        float s_ = (float(gl_InstanceID) + 1.0)/${cascas.toFixed(1)};
        vS = s_;
        vOP = position;
        vPelo = aPelo;
        float l_ = aPelo*uComp;
        // penteado: empurra pra fora, depois cai um pouco e corre pra trás
        transformed += objectNormal*l_*s_;
        transformed += vec3(0.0, -0.46, -0.62)*l_*s_*s_;
      `);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', /* glsl */`#include <common>
        uniform float uDens, uRim;
        varying float vS;
        varying vec3 vOP;
        varying float vPelo;
        float hash3(vec3 p){
          p = fract(p*vec3(0.1031, 0.1030, 0.0973));
          p += dot(p, p.yxz + 33.33);
          return fract((p.x + p.y)*p.z);
        }
      `)
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
        if(vPelo < 0.02) discard; // focinho, em volta dos olhos: sem pelo
        // grade girada e fios fora de centro: sem isso o peito parece tecido
        vec3 qp = mat3(0.80, 0.36, -0.48, -0.60, 0.48, -0.64, 0.0, 0.80, 0.60)*vOP*uDens;
        vec3 id = floor(qp);
        vec3 fr = fract(qp) - 0.5;
        fr += (vec3(hash3(id + 3.1), hash3(id + 5.7), hash3(id + 9.3)) - 0.5)*0.55;
        float h = hash3(id);
        float compFio = 0.32 + h*0.68;
        if(vS > compFio) discard;
        // o fio afina até a ponta mas nunca vira agulha: a ponta é redonda e a borda
        // é macia (cobertura parcial no MSAA), senão a silhueta do bicho fica espetada
        float raio = (1.0 - vS/compFio)*0.6 + 0.24;
        float dFio = length(fr);
        if(dFio > raio) discard;
        diffuseColor.a = smoothstep(raio, raio*0.62, dFio);
        // raiz na sombra, ponta na luz: o volume do pelo mora nessa diferença
        diffuseColor.rgb *= mix(0.6, 1.2, vS*vS*0.4 + vS*0.6);
        diffuseColor.rgb *= 0.9 + hash3(id + 7.0)*0.2;
      `)
      .replace('#include <emissivemap_fragment>', /* glsl */`
        // luz rasante nas pontas da borda: dá a maciez da silhueta
        float beiraPelo = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += diffuseColor.rgb*beiraPelo*uRim*vS;
      `);
  };
  m.customProgramCacheKey = () => 'pelo' + cascas;
  return m;
}

/* ============ as quatro raças (os gatos moram em gatos.js) ============ */
export function receita(raca){
  if(GATOS.includes(raca)) return receitaGato(raca);
  if(raca === 'golden'){
    const OURO = lin(0xe2b066), MEL = lin(0xc48a3e), CREME = lin(0xf6e6c4), NARIZ_COR = lin(0x8d6236);
    const olhos = { x: 0.082, y: 0.868, z: 0.655, r: 0.041 };
    return {
      comprimento: 0.046, densidade: 150,
      olhos,
      nariz: { pos: [0, 0.797, 0.826], esc: [0.042, 0.034, 0.03] },
      boca: { a: [0, 0.752, 0.822], b: [0.05, 0.744, 0.77], c: [0.088, 0.758, 0.702], haste: [0, 0.778, 0.836] },
      lingua: { pos: [0.005, 0.733, 0.79], esc: [0.038, 0.066, 0.016] },
      pescocoPivo: [0, 0.72, 0.42],
      olhoAltura: 0.84, olhoFrente: 0.98,
      tronco: esculpir([
        [corrente([[0, 0.52, -0.31, 0.205], [0, 0.515, -0.02, 0.195], [0, 0.53, 0.24, 0.225]], 0.05), 0],
        [elipsoide(0, 0.47, 0.32, 0.15, 0.19, 0.125), 0.08],
        [cone([0, 0.58, 0.31], [0, 0.74, 0.44], 0.17, 0.122), 0.08],
      ]),
      caixaTronco: [[-0.32, 0.18, -0.6], [0.32, 0.86, 0.58]],
      cabeca: esculpir([
        [elipsoide(0, 0.84, 0.52, 0.155, 0.15, 0.165), 0],
        [esfera(0.068, 0.885, 0.6, 0.058), 0.05],
        [esfera(-0.068, 0.885, 0.6, 0.058), 0.05],
        [esfera(0.088, 0.795, 0.59, 0.072), 0.07],
        [esfera(-0.088, 0.795, 0.59, 0.072), 0.07],
        [cone([0, 0.805, 0.63], [0, 0.782, 0.77], 0.09, 0.069), 0.07],
        [cone([0, 0.742, 0.66], [0, 0.744, 0.75], 0.052, 0.042), 0.035],
        [cone([0, 0.72, 0.42], [0, 0.81, 0.5], 0.12, 0.125), 0.07],
      ]),
      caixaCabeca: [[-0.26, 0.56, 0.26], [0.26, 1.08, 0.92]],
      orelha: {
        forma: (s) => achatarX(corrente([[s*0.142, 0.945, 0.47, 0.058], [s*0.172, 0.87, 0.475, 0.075], [s*0.188, 0.76, 0.48, 0.062], [s*0.19, 0.69, 0.48, 0.04]], 0.04), s*0.17, 2.1),
        caixa: (s) => [[s*0.17 - 0.1, 0.6, 0.36], [s*0.17 + 0.1, 1.03, 0.6]],
        pivo: (s) => [s*0.142, 0.95, 0.47],
      },
      patas: [
        { pivo: [-0.125, 0.47, -0.31], forma: (x) => esculpir([[corrente([[x, 0.47, -0.31, 0.118], [x, 0.29, -0.355, 0.074], [x, 0.16, -0.395, 0.05], [x, 0.065, -0.365, 0.052]], 0.04), 0], [elipsoide(x, 0.042, -0.33, 0.068, 0.046, 0.088), 0.03]]) },
        { pivo: [0.125, 0.47, -0.31], forma: (x) => esculpir([[corrente([[x, 0.47, -0.31, 0.118], [x, 0.29, -0.355, 0.074], [x, 0.16, -0.395, 0.05], [x, 0.065, -0.365, 0.052]], 0.04), 0], [elipsoide(x, 0.042, -0.33, 0.068, 0.046, 0.088), 0.03]]) },
        { pivo: [-0.118, 0.45, 0.27], forma: (x) => esculpir([[corrente([[x, 0.45, 0.27, 0.088], [x, 0.25, 0.275, 0.056], [x, 0.065, 0.285, 0.05]], 0.03), 0], [elipsoide(x, 0.042, 0.315, 0.066, 0.046, 0.086), 0.03]]) },
        { pivo: [0.118, 0.45, 0.27], forma: (x) => esculpir([[corrente([[x, 0.45, 0.27, 0.088], [x, 0.25, 0.275, 0.056], [x, 0.065, 0.285, 0.05]], 0.03), 0], [elipsoide(x, 0.042, 0.315, 0.066, 0.046, 0.086), 0.03]]) },
      ],
      rabo: {
        pivo: [0, 0.6, -0.47],
        forma: corrente([[0, 0.6, -0.47, 0.058], [0, 0.665, -0.62, 0.062], [0, 0.7, -0.77, 0.056], [0, 0.695, -0.9, 0.03]], 0.03),
        caixa: [[-0.2, 0.42, -1.08], [0.2, 0.88, -0.36]],
      },
      cor(x, y, z, o){
        const n = ruido3(x*2, y*2, z*2);
        // dorso mais escuro, peito e barriga creme
        mixv(OURO, MEL, sst(0.62, 0.74, y + (n-0.5)*0.06)*(z < 0.42 ? 1 : sst(0.62, 0.42, z)), o);
        const baixo = sst(0.38, 0.27, y + (n-0.5)*0.06);
        mixv(o, CREME, baixo*0.75, o);
        const peito = sst(0.24, 0.32, z)*sst(0.62, 0.42, y);
        mixv(o, CREME, peito*0.85, o);
        // focinho claro, com a transição pro dourado da testa
        const foc = sst(0.64, 0.74, z)*sst(0.9, 0.82, y);
        mixv(o, CREME, foc*0.9, o);
        // em volta do olho e da boca, um pouco mais escuro
        const dOlho = Math.hypot(Math.abs(x)-0.082, y-0.873, z-0.648);
        if(dOlho < 0.07) mixv(o, NARIZ_COR, sst(0.07, 0.038, dOlho)*0.8, o);
      },
      pelo(x, y, z){
        let p = 1;
        // pelo curto na cara, longo no peito/barriga e atrás das patas
        const cara = sst(0.64, 0.76, z)*(y > 0.6 ? 1 : 0);
        p *= 1 - cara*0.82;
        p += sst(0.42, 0.26, y)*(y > 0.18 ? 0.45 : 0);
        p += sst(0.24, 0.34, z)*sst(0.6, 0.42, y)*0.7;
        if(y < 0.12) p *= 0.3;
        const dOlho = Math.hypot(Math.abs(x)-0.082, y-0.873, z-0.648);
        p *= sst(0.046, 0.085, dOlho);
        const dNariz = Math.hypot(x, y-0.79, z-0.83);
        p *= sst(0.04, 0.09, dNariz);
        return p;
      },
      peloRabo(x, y, z){ return 1.1 + sst(-0.55, -0.9, z)*0.5; },
    };
  }

  if(raca === 'shepherd'){
    const CASTANHO = lin(0xbe8d4f), CLARO = lin(0xdcbb83), PRETO = lin(0x2a2320);
    const olhos = { x: 0.073, y: 0.872, z: 0.64, r: 0.036 };
    return {
      comprimento: 0.03, densidade: 165,
      olhos,
      nariz: { pos: [0, 0.81, 0.868], esc: [0.036, 0.029, 0.027] },
      boca: { a: [0, 0.772, 0.86], b: [0.046, 0.756, 0.79], c: [0.076, 0.77, 0.71], haste: [0, 0.785, 0.868] },
      lingua: { pos: [0.004, 0.746, 0.825], esc: [0.03, 0.058, 0.014] },
      pescocoPivo: [0, 0.72, 0.42],
      olhoAltura: 0.86, olhoFrente: 1.02,
      tronco: esculpir([
        [corrente([[0, 0.47, -0.34, 0.178], [0, 0.525, -0.04, 0.175], [0, 0.55, 0.25, 0.205]], 0.05), 0],
        [elipsoide(0, 0.5, 0.31, 0.13, 0.17, 0.115), 0.08],
        [cone([0, 0.6, 0.31], [0, 0.76, 0.44], 0.145, 0.106), 0.08],
      ]),
      caixaTronco: [[-0.28, 0.2, -0.58], [0.28, 0.86, 0.56]],
      cabeca: esculpir([
        [elipsoide(0, 0.85, 0.51, 0.135, 0.125, 0.15), 0],
        [esfera(0.06, 0.885, 0.59, 0.046), 0.04],
        [esfera(-0.06, 0.885, 0.59, 0.046), 0.04],
        [cone([0, 0.825, 0.61], [0, 0.796, 0.81], 0.078, 0.05), 0.065],
        [cone([0, 0.76, 0.65], [0, 0.76, 0.79], 0.045, 0.034), 0.03],
        [cone([0, 0.72, 0.42], [0, 0.82, 0.49], 0.106, 0.11), 0.07],
      ]),
      caixaCabeca: [[-0.22, 0.58, 0.28], [0.22, 1.02, 0.94]],
      orelha: {
        // orelhas em pé: marca da raça, com a ponta arredondada
        forma: (s) => achatarZ(cone([s*0.082, 0.945, 0.465], [s*0.102, 1.11, 0.452], 0.06, 0.018), 0.46, 2.3),
        caixa: (s) => [[s*0.09 - 0.1, 0.87, 0.38], [s*0.09 + 0.1, 1.17, 0.54]],
        pivo: (s) => [s*0.082, 0.94, 0.465],
      },
      patas: [
        { pivo: [-0.115, 0.46, -0.34], forma: (x) => esculpir([[corrente([[x, 0.46, -0.34, 0.105], [x, 0.28, -0.4, 0.062], [x, 0.15, -0.43, 0.042], [x, 0.06, -0.39, 0.044]], 0.04), 0], [elipsoide(x, 0.038, -0.36, 0.056, 0.04, 0.078), 0.025]]) },
        { pivo: [0.115, 0.46, -0.34], forma: (x) => esculpir([[corrente([[x, 0.46, -0.34, 0.105], [x, 0.28, -0.4, 0.062], [x, 0.15, -0.43, 0.042], [x, 0.06, -0.39, 0.044]], 0.04), 0], [elipsoide(x, 0.038, -0.36, 0.056, 0.04, 0.078), 0.025]]) },
        { pivo: [-0.105, 0.47, 0.27], forma: (x) => esculpir([[corrente([[x, 0.47, 0.27, 0.078], [x, 0.26, 0.275, 0.048], [x, 0.06, 0.285, 0.042]], 0.03), 0], [elipsoide(x, 0.038, 0.31, 0.056, 0.04, 0.076), 0.025]]) },
        { pivo: [0.105, 0.47, 0.27], forma: (x) => esculpir([[corrente([[x, 0.47, 0.27, 0.078], [x, 0.26, 0.275, 0.048], [x, 0.06, 0.285, 0.042]], 0.03), 0], [elipsoide(x, 0.038, 0.31, 0.056, 0.04, 0.076), 0.025]]) },
      ],
      rabo: {
        pivo: [0, 0.5, -0.5],
        forma: corrente([[0, 0.5, -0.5, 0.05], [0, 0.42, -0.63, 0.058], [0, 0.32, -0.72, 0.06], [0, 0.23, -0.78, 0.034]], 0.03),
        caixa: [[-0.16, 0.12, -0.92], [0.16, 0.62, -0.4]],
      },
      cor(x, y, z, o){
        const n = ruido3(x*2.5, y*2.5, z*2.5);
        o[0] = CASTANHO[0]; o[1] = CASTANHO[1]; o[2] = CASTANHO[2];
        const baixo = sst(0.34, 0.2, y);
        mixv(o, CLARO, baixo*0.8, o);
        // sela preta no dorso, com borda irregular
        if(z < 0.4){
          const sela = sst(0.47, 0.53, y + (n-0.5)*0.08 - Math.abs(x)*0.14)*sst(0.42, 0.26, z + (n-0.5)*0.1)*sst(-0.66, -0.5, z);
          mixv(o, PRETO, sela, o);
        }
        // máscara: focinho e testa escuros, bochecha castanha
        if(z > 0.5){
          // focinho preto + faixa estreita subindo entre os olhos; bochecha e sobrancelha ficam castanhas
          const focinho = sst(0.66, 0.74, z + (n-0.5)*0.03);
          const faixa = sst(0.055, 0.03, Math.abs(x))*sst(0.86, 0.9, y)*sst(0.5, 0.56, z);
          mixv(o, PRETO, Math.min(1, focinho + faixa)*0.94, o);
        }
        const dOlho = Math.hypot(Math.abs(x)-0.073, y-0.875, z-0.635);
        if(dOlho < 0.06) mixv(o, PRETO, sst(0.06, 0.034, dOlho)*0.9, o);
      },
      corOrelha(x, y, z, o){ o[0] = PRETO[0]*1.4; o[1] = PRETO[1]*1.3; o[2] = PRETO[2]*1.3; },
      corRabo(x, y, z, o){ const k = sst(0.3, 0.46, y); mixv(CASTANHO, PRETO, 0.45 + k*0.55, o); },
      pelo(x, y, z){
        let p = 1;
        p *= 1 - sst(0.64, 0.76, z)*(y > 0.6 ? 0.8 : 0);
        p += sst(0.22, 0.34, z)*sst(0.62, 0.42, y)*0.45;
        if(y < 0.12) p *= 0.3;
        const dOlho = Math.hypot(Math.abs(x)-0.073, y-0.875, z-0.635);
        p *= sst(0.04, 0.072, dOlho);
        const dNariz = Math.hypot(x, y-0.805, z-0.87);
        p *= sst(0.035, 0.08, dNariz);
        return p;
      },
      peloRabo(){ return 1.5; },
    };
  }

  if(raca === 'caramelo'){
    // o vira-lata caramelo: magro, de peito fundo e barriga recolhida, pelo curto
    // cor de caramelo com peito e garganta creme, ponta do focinho escura, orelha
    // em pé com a ponta dobrada para a frente e rabo em foice por cima do dorso
    const CARAMELO = lin(0xdb9a52), TOSTADO = lin(0xb6712f), CREME = lin(0xf3e0bc), CLARO = lin(0xebc18a), MASCARA = lin(0x3a2416);
    const olhos = { x: 0.072, y: 0.873, z: 0.638, r: 0.035 };
    const normalFlap = [0, 0.94, 0.342];
    return {
      comprimento: 0.018, densidade: 180,
      olhos,
      nariz: { pos: [0, 0.806, 0.85], esc: [0.034, 0.027, 0.025] },
      boca: { a: [0, 0.77, 0.842], b: [0.044, 0.755, 0.775], c: [0.073, 0.768, 0.7], haste: [0, 0.783, 0.85] },
      lingua: { pos: [0.004, 0.745, 0.808], esc: [0.029, 0.056, 0.014] },
      pescocoPivo: [0, 0.72, 0.42],
      olhoAltura: 0.86, olhoFrente: 1.0,
      tronco: esculpir([
        [corrente([[0, 0.5, -0.33, 0.152], [0, 0.54, -0.04, 0.152], [0, 0.555, 0.24, 0.188]], 0.05), 0],
        [elipsoide(0, 0.48, 0.3, 0.118, 0.172, 0.112), 0.08],
        [cone([0, 0.6, 0.31], [0, 0.76, 0.44], 0.135, 0.1), 0.08],
      ]),
      caixaTronco: [[-0.26, 0.22, -0.56], [0.26, 0.86, 0.54]],
      cabeca: esculpir([
        [elipsoide(0, 0.85, 0.51, 0.138, 0.127, 0.148), 0],
        [esfera(0.06, 0.886, 0.592, 0.046), 0.04],
        [esfera(-0.06, 0.886, 0.592, 0.046), 0.04],
        [esfera(0.072, 0.8, 0.585, 0.058), 0.06],
        [esfera(-0.072, 0.8, 0.585, 0.058), 0.06],
        [cone([0, 0.824, 0.61], [0, 0.8, 0.79], 0.079, 0.052), 0.065],
        [cone([0, 0.762, 0.65], [0, 0.762, 0.772], 0.044, 0.033), 0.03],
        [cone([0, 0.72, 0.42], [0, 0.82, 0.49], 0.104, 0.108), 0.07],
      ]),
      caixaCabeca: [[-0.22, 0.58, 0.28], [0.22, 1.02, 0.92]],
      orelha: {
        // em pé até o meio e a ponta dobrada para a frente: cada metade é achatada
        // no próprio plano, senão a dobra encolhe junto com a orelha
        forma: (s) => esculpir([
          [achatarZ(cone([s*0.088, 0.925, 0.465], [s*0.108, 1.05, 0.46], 0.074, 0.034), 0.462, 2.7), 0],
          [achatarDir(cone([s*0.107, 1.058, 0.468], [s*0.112, 1.03, 0.545], 0.034, 0.013), [s*0.107, 1.055, 0.47], normalFlap, 2.4), 0.015],
        ]),
        caixa: (s) => [[s*0.1 - 0.11, 0.84, 0.38], [s*0.1 + 0.11, 1.13, 0.6]],
        pivo: (s) => [s*0.084, 0.93, 0.465],
      },
      patas: [
        { pivo: [-0.11, 0.46, -0.33], forma: (x) => esculpir([[corrente([[x, 0.46, -0.33, 0.098], [x, 0.28, -0.39, 0.058], [x, 0.15, -0.42, 0.04], [x, 0.06, -0.385, 0.042]], 0.04), 0], [elipsoide(x, 0.038, -0.355, 0.054, 0.038, 0.074), 0.025]]) },
        { pivo: [0.11, 0.46, -0.33], forma: (x) => esculpir([[corrente([[x, 0.46, -0.33, 0.098], [x, 0.28, -0.39, 0.058], [x, 0.15, -0.42, 0.04], [x, 0.06, -0.385, 0.042]], 0.04), 0], [elipsoide(x, 0.038, -0.355, 0.054, 0.038, 0.074), 0.025]]) },
        { pivo: [-0.098, 0.47, 0.27], forma: (x) => esculpir([[corrente([[x, 0.47, 0.27, 0.072], [x, 0.26, 0.275, 0.045], [x, 0.06, 0.285, 0.04]], 0.03), 0], [elipsoide(x, 0.038, 0.31, 0.054, 0.038, 0.072), 0.025]]) },
        { pivo: [0.098, 0.47, 0.27], forma: (x) => esculpir([[corrente([[x, 0.47, 0.27, 0.072], [x, 0.26, 0.275, 0.045], [x, 0.06, 0.285, 0.04]], 0.03), 0], [elipsoide(x, 0.038, 0.31, 0.054, 0.038, 0.072), 0.025]]) },
      ],
      rabo: {
        pivo: [0, 0.56, -0.46],
        forma: corrente([[0, 0.56, -0.46, 0.044], [0, 0.66, -0.57, 0.046], [0, 0.79, -0.6, 0.04], [0, 0.875, -0.56, 0.03], [0, 0.9, -0.5, 0.018]], 0.03),
        caixa: [[-0.14, 0.44, -0.72], [0.14, 1.0, -0.36]],
      },
      cor(x, y, z, o){
        const n = ruido3(x*2.2, y*2.2, z*2.2);
        // dorso tostado, flanco caramelo
        mixv(CARAMELO, TOSTADO, sst(0.6, 0.7, y + (n-0.5)*0.06)*(z < 0.42 ? 1 : sst(0.62, 0.42, z))*0.5, o);
        // barriga, peito e garganta creme
        mixv(o, CREME, sst(0.4, 0.3, y + (n-0.5)*0.05)*0.85, o);
        mixv(o, CREME, sst(0.24, 0.34, z)*sst(0.64, 0.44, y)*0.85, o);
        mixv(o, CREME, sst(0.79, 0.73, y)*sst(0.44, 0.56, z)*0.8, o);
        // beiço e queixo claros; a ponta do focinho escura
        mixv(o, CREME, sst(0.66, 0.74, z)*sst(0.81, 0.77, y)*0.7, o);
        // (a máscara vem de longe: só na ponta virava um anel em volta do nariz)
        mixv(o, MASCARA, sst(0.68, 0.85, z + (n-0.5)*0.03)*sst(0.72, 0.78, y)*0.62, o);
        const dOlho = Math.hypot(Math.abs(x)-0.072, y-0.876, z-0.633);
        if(dOlho < 0.06) mixv(o, TOSTADO, sst(0.06, 0.034, dOlho)*0.6, o);
      },
      corOrelha(x, y, z, o){ mixv(CARAMELO, TOSTADO, Math.min(1, sst(0.98, 1.05, y) + sst(0.49, 0.54, z))*0.75, o); },
      corPata(x, y, z, o){ mixv(CARAMELO, CLARO, sst(0.3, 0.08, y), o); },
      corRabo(x, y, z, o){
        mixv(CARAMELO, TOSTADO, 0.4, o);
        mixv(o, CREME, sst(0.86, 0.9, y)*sst(-0.56, -0.5, z)*0.8, o);
      },
      pelo(x, y, z){
        let p = 1;
        p *= 1 - sst(0.64, 0.76, z)*(y > 0.6 ? 0.85 : 0);
        p += sst(0.22, 0.34, z)*sst(0.62, 0.42, y)*0.3;
        if(y < 0.12) p *= 0.3;
        const dOlho = Math.hypot(Math.abs(x)-0.072, y-0.876, z-0.633);
        p *= sst(0.038, 0.062, dOlho);
        const dNariz = Math.hypot(x, y-0.802, z-0.852);
        p *= sst(0.03, 0.06, dNariz);
        return p;
      },
      peloRabo(){ return 1.3; },
    };
  }

  /* dachshund */
  const CHOC = lin(0x7b3f1e), ESCURO = lin(0x552811), FOGO = lin(0xc98a4e);
  const olhos = { x: 0.062, y: 0.562, z: 0.69, r: 0.032 };
  return {
    comprimento: 0.012, densidade: 190, olhos,
    nariz: { pos: [0, 0.502, 0.942], esc: [0.03, 0.025, 0.024] },
    boca: { a: [0, 0.468, 0.935], b: [0.034, 0.456, 0.865], c: [0.056, 0.468, 0.785], haste: [0, 0.48, 0.94] },
    lingua: { pos: [0.003, 0.446, 0.9], esc: [0.024, 0.042, 0.011] },
    pescocoPivo: [0, 0.42, 0.42],
    olhoAltura: 0.55, olhoFrente: 1.06,
    tronco: esculpir([
      [corrente([[0, 0.31, -0.47, 0.128], [0, 0.305, -0.1, 0.13], [0, 0.31, 0.3, 0.148]], 0.05), 0],
      [elipsoide(0, 0.265, 0.33, 0.105, 0.115, 0.1), 0.07],
      [cone([0, 0.36, 0.38], [0, 0.475, 0.52], 0.105, 0.078), 0.07],
    ]),
    caixaTronco: [[-0.22, 0.1, -0.68], [0.22, 0.6, 0.66]],
    cabeca: esculpir([
      [elipsoide(0, 0.56, 0.59, 0.108, 0.104, 0.122), 0],
      [esfera(0.048, 0.585, 0.65, 0.04), 0.035],
      [esfera(-0.048, 0.585, 0.65, 0.04), 0.035],
      [cone([0, 0.535, 0.67], [0, 0.492, 0.9], 0.062, 0.036), 0.05],
      [cone([0, 0.47, 0.7], [0, 0.462, 0.87], 0.034, 0.024), 0.025],
      [cone([0, 0.44, 0.48], [0, 0.53, 0.56], 0.078, 0.082), 0.05],
    ]),
    caixaCabeca: [[-0.18, 0.34, 0.38], [0.18, 0.72, 1.0]],
    orelha: {
      // orelhas enormes, caindo além do queixo
      forma: (s) => achatarX(corrente([[s*0.1, 0.62, 0.535, 0.048], [s*0.132, 0.53, 0.55, 0.072], [s*0.15, 0.41, 0.56, 0.075], [s*0.152, 0.33, 0.565, 0.046]], 0.04), s*0.13, 2.4),
      caixa: (s) => [[s*0.13 - 0.09, 0.23, 0.44], [s*0.13 + 0.09, 0.69, 0.66]],
      pivo: (s) => [s*0.1, 0.625, 0.535],
    },
    patas: [
      { pivo: [-0.085, 0.24, -0.47], forma: (x) => esculpir([[corrente([[x, 0.24, -0.47, 0.082], [x, 0.11, -0.5, 0.05], [x, 0.05, -0.47, 0.042]], 0.03), 0], [elipsoide(x, 0.032, -0.445, 0.05, 0.034, 0.068), 0.02]]) },
      { pivo: [0.085, 0.24, -0.47], forma: (x) => esculpir([[corrente([[x, 0.24, -0.47, 0.082], [x, 0.11, -0.5, 0.05], [x, 0.05, -0.47, 0.042]], 0.03), 0], [elipsoide(x, 0.032, -0.445, 0.05, 0.034, 0.068), 0.02]]) },
      { pivo: [-0.082, 0.24, 0.31], forma: (x) => esculpir([[corrente([[x, 0.24, 0.31, 0.072], [x, 0.12, 0.33, 0.046], [x, 0.05, 0.34, 0.04]], 0.03), 0], [elipsoide(x, 0.032, 0.365, 0.05, 0.034, 0.066), 0.02]]) },
      { pivo: [0.082, 0.24, 0.31], forma: (x) => esculpir([[corrente([[x, 0.24, 0.31, 0.072], [x, 0.12, 0.33, 0.046], [x, 0.05, 0.34, 0.04]], 0.03), 0], [elipsoide(x, 0.032, 0.365, 0.05, 0.034, 0.066), 0.02]]) },
    ],
    rabo: {
      pivo: [0, 0.37, -0.57],
      forma: corrente([[0, 0.37, -0.57, 0.04], [0, 0.44, -0.72, 0.028], [0, 0.53, -0.84, 0.014]], 0.02),
      caixa: [[-0.1, 0.27, -0.94], [0.1, 0.62, -0.48]],
    },
    cor(x, y, z, o){
      const n = ruido3(x*3, y*3, z*3);
      mixv(CHOC, ESCURO, sst(0.32, 0.42, y + (n-0.5)*0.05)*(z < 0.45 ? 1 : 0.2), o);
      // marcas de fogo: peito, focinho, patas e sobrancelhas
      const peito = sst(0.33, 0.42, z)*sst(0.42, 0.24, y);
      mixv(o, FOGO, peito, o);
      const foc = sst(0.72, 0.8, z)*sst(0.52, 0.47, y - (Math.abs(x))*0.3);
      mixv(o, FOGO, foc, o);
      const sob = Math.hypot(Math.abs(x)-0.055, y-0.61, z-0.665);
      if(sob < 0.03) mixv(o, FOGO, sst(0.03, 0.016, sob), o);
      const dOlho = Math.hypot(Math.abs(x)-0.062, y-0.565, z-0.685);
      if(dOlho < 0.05) mixv(o, ESCURO, sst(0.05, 0.028, dOlho)*0.9, o);
    },
    corOrelha(x, y, z, o){ o[0] = ESCURO[0]; o[1] = ESCURO[1]; o[2] = ESCURO[2]; },
    corPata(x, y, z, o){ mixv(CHOC, FOGO, sst(0.14, 0.06, y), o); },
    pelo(x, y, z){
      let p = 1;
      const dOlho = Math.hypot(Math.abs(x)-0.062, y-0.565, z-0.685);
      p *= sst(0.034, 0.055, dOlho);
      const dNariz = Math.hypot(x, y-0.5, z-0.94);
      p *= sst(0.03, 0.07, dNariz);
      return p;
    },
  };
}

/* Leva um ponto até a superfície do campo (com um afastamento): olho e boca passam
   a nascer da cabeça de verdade, não de um número chutado que boia ou afunda. */
export function naSuperficie(f, p, afastar = 0){
  let [x, y, z] = p;
  const e = 0.002;
  for(let i=0;i<10;i++){
    const d = f(x, y, z) - afastar;
    const gx = f(x+e, y, z) - f(x-e, y, z);
    const gy = f(x, y+e, z) - f(x, y-e, z);
    const gz = f(x, y, z+e) - f(x, y, z-e);
    const il = 1/(Math.hypot(gx, gy, gz) || 1);
    x -= gx*il*d; y -= gy*il*d; z -= gz*il*d;
  }
  return [x, y, z];
}

/* ============ montagem ============ */
const CACHE = new Map();

function esculturas(raca, perfil){
  const chave = raca + perfil.celulaSDF;
  if(CACHE.has(chave)) return CACHE.get(chave);
  const R = receita(raca);
  // sem pelo por cima (perfil baixo) a superfície aparece, e precisa de mais detalhe
  const k = perfil.pelos > 0 ? 1 : 0.8;
  const h = 0.019*perfil.celulaSDF*k;
  const fin = 0.013*perfil.celulaSDF*k;
  const opCor = (fn) => (x, y, z, o) => fn(x, y, z, o);
  const opPelo = (fn) => ({ aPelo: fn });

  const tronco = malhaSDF(R.tronco, R.caixaTronco, h, { cor: opCor(R.cor), atributos: opPelo(R.pelo) });
  const cabeca = malhaSDF(R.cabeca, R.caixaCabeca, fin, { cor: opCor(R.cor), atributos: opPelo(R.pelo) });
  cabeca.translate(-R.pescocoPivo[0], -R.pescocoPivo[1], -R.pescocoPivo[2]);

  const orelhas = [-1, 1].map(s => {
    const piv = R.orelha.pivo(s);
    const g = malhaSDF(R.orelha.forma(s), R.orelha.caixa(s), fin*1.1, {
      cor: opCor(R.corOrelha || ((x, y, z, o) => R.cor(x, y, z, o))),
      atributos: opPelo(() => 0.85),
    });
    g.translate(-piv[0], -piv[1], -piv[2]);
    return { geo: g, piv };
  });

  const patas = R.patas.map(p => {
    const x = p.pivo[0];
    const piv = p.pivo;
    const c = [[x-0.2, -0.03, piv[2]-0.26], [x+0.2, piv[1]+0.18, piv[2]+0.26]];
    const g = malhaSDF(p.forma(x), c, h*0.9, {
      cor: opCor(R.corPata || R.cor),
      atributos: opPelo((px, py, pz) => R.pelo(px, py, pz)*(py < 0.09 ? 0.45 : 1)),
    });
    g.translate(-piv[0], -piv[1], -piv[2]);
    return { geo: g, piv };
  });

  const rabo = malhaSDF(R.rabo.forma, R.rabo.caixa, fin*1.3, {
    cor: opCor(R.corRabo || R.cor),
    atributos: opPelo(R.peloRabo ? (x, y, z) => R.peloRabo(x, y, z) : () => 1),
  });
  rabo.translate(-R.rabo.pivo[0], -R.rabo.pivo[1], -R.rabo.pivo[2]);

  const res = { R, tronco, cabeca, orelhas, patas, rabo };
  CACHE.set(chave, res);
  return res;
}

const matOlho = new THREE.MeshStandardMaterial({ color: 0x1b100a, roughness: 0.08, metalness: 0, envMapIntensity: 2.2 });
const matBrilhoOlho = new THREE.MeshBasicMaterial({ color: 0xffffff });
const matNariz = new THREE.MeshStandardMaterial({ color: 0x17110f, roughness: 0.26, envMapIntensity: 1.6 });
// gato: íris colorida com pupila em fenda, nariz na cor da raça, bigodes
const matPupila = new THREE.MeshStandardMaterial({ color: 0x0b0806, roughness: 0.1, envMapIntensity: 2 });
const matBigode = new THREE.MeshBasicMaterial({ color: 0xf6f1e6, transparent: true, opacity: 0.85 });
const matsCor = new Map();
function matDaCor(hex, opts){
  const k = hex + JSON.stringify(opts);
  if(!matsCor.has(k)) matsCor.set(k, new THREE.MeshStandardMaterial({ color: hex, ...opts }));
  return matsCor.get(k);
}
const matLingua = new THREE.MeshStandardMaterial({ color: 0xe77f8d, roughness: 0.42 });
const matBoca = new THREE.MeshStandardMaterial({ color: 0x1a1110, roughness: 0.8 });
const geoOlho = new THREE.SphereGeometry(1, 18, 14);
const geoBrilho = new THREE.SphereGeometry(1, 8, 6);
const geoNariz = new THREE.SphereGeometry(1, 16, 12);
const geoLingua = (() => {
  const g = new THREE.SphereGeometry(1, 14, 10);
  g.translate(0, -0.72, 0); // pivô no topo, pra escalar a partir da boca
  return g;
})();

const matsCorpo = new Map();
function materiaisCorpo(raca, R, perfil){
  const k = raca + perfil.pelos;
  if(matsCorpo.has(k)) return matsCorpo.get(k);
  const base = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, envMapIntensity: 1.1 });
  // sem cascas (perfil baixo), a própria malha usa a cor cheia; com cascas ela é a
  // "pele", mais escura, por baixo dos fios
  if(perfil.pelos > 0) base.color.setScalar(0.62);
  const pelo = perfil.pelos > 0 ? materialPelo({ comprimento: R.comprimento, densidade: R.densidade, cascas: perfil.pelos }) : null;
  const res = { base, pelo };
  matsCorpo.set(k, res);
  return res;
}

function parte(geo, mats, cascas){
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mats.base);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  if(mats.pelo){
    if(!geo.userData.casca){
      const ig = new THREE.InstancedBufferGeometry();
      ig.index = geo.index;
      ig.attributes = geo.attributes;
      ig.instanceCount = cascas;
      ig.boundingSphere = geo.boundingSphere ? geo.boundingSphere.clone() : null;
      if(ig.boundingSphere) ig.boundingSphere.radius += 0.12;
      geo.userData.casca = ig;
    }
    const s = new THREE.Mesh(geo.userData.casca, mats.pelo);
    s.receiveShadow = true;
    s.userData.semAO = true;
    g.add(s);
  }
  return g;
}

export function construirCao(raca){
  const perfil = escolherPerfil();
  const E = esculturas(raca, perfil);
  const R = E.R;
  const mats = materiaisCorpo(raca, R, perfil);
  const cascas = perfil.pelos;

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const tronco = parte(E.tronco, mats, cascas);
  body.add(tronco);

  /* cabeça: gira em volta do pescoço */
  const head = new THREE.Group();
  head.position.set(...R.pescocoPivo);
  head.add(parte(E.cabeca, mats, cascas));
  body.add(head);
  const P = R.pescocoPivo;

  // olhos: esfera escura e funda + pontinho de brilho, nada de bolota branca
  const eyes = [-1, 1].map(s => {
    const o = new THREE.Group();
    const c = naSuperficie(R.cabeca, [s*R.olhos.x, R.olhos.y, R.olhos.z], -R.olhos.r*0.42);
    o.position.set(c[0] - P[0], c[1] - P[1], c[2] - P[2]);
    const globo = new THREE.Mesh(geoOlho, R.olhos.iris ? matDaCor(R.olhos.iris, { roughness: 0.12, envMapIntensity: 2.2 }) : matOlho);
    globo.scale.setScalar(R.olhos.r);
    o.add(globo);
    if(R.olhos.iris){
      // pupila em fenda, na frente do globo e virada um pouco para fora, como o olho
      const vira = s*0.3;
      const pupila = new THREE.Mesh(geoOlho, matPupila);
      pupila.position.set(Math.sin(vira)*R.olhos.r*0.84, 0, Math.cos(vira)*R.olhos.r*0.84);
      pupila.rotation.y = vira;
      pupila.scale.set(R.olhos.r*0.17, R.olhos.r*0.72, R.olhos.r*0.22);
      o.add(pupila);
    }
    const brilho = new THREE.Mesh(geoBrilho, matBrilhoOlho);
    brilho.scale.setScalar(R.olhos.r*0.26);
    brilho.position.set(-R.olhos.r*0.26, R.olhos.r*0.42, R.olhos.r*0.8);
    o.add(brilho);
    head.add(o);
    return o;
  });

  const nariz = new THREE.Mesh(geoNariz, R.nariz.cor ? matDaCor(R.nariz.cor, { roughness: 0.4 }) : matNariz);
  nariz.position.set(R.nariz.pos[0]-P[0], R.nariz.pos[1]-P[1], R.nariz.pos[2]-P[2]);
  nariz.scale.set(...R.nariz.esc);
  head.add(nariz);

  // boca: um sorrisinho encostado na superfície do focinho, dos dois lados
  {
    const b = R.boca;
    const afasta = R.comprimento*0.16;
    const curvaBase = (s) => new THREE.CatmullRomCurve3([
      new THREE.Vector3(b.a[0]*s, b.a[1], b.a[2]), new THREE.Vector3(b.b[0]*s, b.b[1], b.b[2]), new THREE.Vector3(b.c[0]*s, b.c[1], b.c[2]),
    ]);
    const pt = (v) => {
      const q = naSuperficie(R.cabeca, [v.x, v.y, v.z], afasta);
      return new THREE.Vector3(q[0]-P[0], q[1]-P[1], q[2]-P[2]);
    };
    [-1, 1].forEach(s => {
      const pts = curvaBase(s).getPoints(9).map(pt);
      head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, R.bocaEspessura || 0.0048, 5, false), matBoca));
    });
    const haste = [new THREE.Vector3(...b.haste), new THREE.Vector3(...b.a)].map(pt);
    head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(haste), 3, (R.bocaEspessura || 0.0048)*0.94, 5, false), matBoca));
  }

  // bigodes: três de cada lado, saindo da almofada do focinho e caindo um pouco
  if(R.bigodes){
    const B = R.bigodes, Pv = new THREE.Vector3(...P);
    [-1, 1].forEach(s => {
      for(let i = 0; i < 3; i++){
        const raiz = new THREE.Vector3(s*B.raiz[0], B.raiz[1] + (1 - i)*0.006, B.raiz[2]);
        const abre = (1 - i)*0.024;
        const meio = raiz.clone().add(new THREE.Vector3(s*B.comp*0.5, abre*0.6 + 0.005, -B.comp*0.12));
        const fim = raiz.clone().add(new THREE.Vector3(s*B.comp, abre - 0.012, -B.comp*0.3));
        const curva = new THREE.CatmullRomCurve3([raiz, meio, fim].map(v => v.sub(Pv)));
        head.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 8, 0.0016, 4, false), matBigode));
      }
    });
  }

  const tongue = new THREE.Mesh(geoLingua, matLingua);
  tongue.position.set(R.lingua.pos[0]-P[0], R.lingua.pos[1]-P[1]+0.034, R.lingua.pos[2]-P[2]);
  tongue.scale.set(R.lingua.esc[0], 0.001, R.lingua.esc[2]);
  tongue.userData.base = R.lingua.esc;
  head.add(tongue);

  const ears = E.orelhas.map(({ geo, piv }) => {
    const pp = parte(geo, mats, cascas);
    pp.position.set(piv[0]-P[0], piv[1]-P[1], piv[2]-P[2]);
    head.add(pp);
    return pp;
  });

  /* rabo: abana em volta do próprio início */
  const tail = parte(E.rabo, mats, cascas);
  tail.position.set(...R.rabo.pivo);
  body.add(tail);

  /* patas ficam fora de `body`: o corpo balança, os pés não saem do chão */
  const legs = E.patas.map(({ geo, piv }) => {
    const pp = parte(geo, mats, cascas);
    pp.position.set(...piv);
    group.add(pp);
    return pp;
  });

  return {
    group, legs, tail, body, head, ears, eyes, tongue,
    bodyBaseY: 0,
    eyeHeight: R.olhoAltura,
    eyeForward: R.olhoFrente,
    breed: raca,
    especie: R.especie || 'cao',
    velocidade: R.velocidade || 1,
    // estado de animação
    anim: { blink: 1.5 + Math.random()*3, piscando: 0, lingua: 0, olhar: 0, olharAlvo: 0, olharTimer: 1, passo: 0, peso: 0 },
  };
}

/* ============ animação: chamada a cada quadro, com ou sem movimento ============ */
export function animarCao(p, dt, elapsed, andando){
  if(p.especie === 'gato') return animarGato(p, dt, elapsed, andando);
  const a = p.anim;
  a.peso += ((andando ? 1 : 0) - a.peso)*Math.min(1, dt*7);
  const k = a.peso;
  if(andando) a.passo += dt*9.5;

  // trote: pernas em diagonal se movem juntas
  p.legs.forEach((leg, i) => {
    const emFase = (i === 0 || i === 3);
    const onda = Math.sin(a.passo + (emFase ? 0 : Math.PI));
    leg.rotation.x = -onda*0.42*k;
  });

  // corpo: sobe e desce no dobro da passada, respira quando parado
  const respira = Math.sin(elapsed*2.1)*0.5 + 0.5;
  p.body.position.y = p.bodyBaseY + Math.abs(Math.sin(a.passo))*0.016*k + respira*0.005*(1-k);
  p.body.rotation.x = Math.sin(a.passo + 0.6)*0.012*k;
  p.body.rotation.z = Math.sin(a.passo)*0.016*k;

  // rabo: abana rápido quando anda, de leve quando para
  p.tail.rotation.y = Math.sin(elapsed*(k > 0.5 ? 13 : 5))*(0.2 + 0.32*k);
  p.tail.rotation.x = Math.sin(elapsed*2.0)*0.03;

  // cabeça: acompanha o passo; parada, olha em volta de vez em quando
  a.olharTimer -= dt;
  if(a.olharTimer <= 0){
    a.olharAlvo = Math.random() < 0.35 ? 0 : (Math.random()-0.5)*0.75;
    a.olharTimer = 1.8 + Math.random()*3.5;
  }
  a.olhar += (a.olharAlvo*(1-k) - a.olhar)*Math.min(1, dt*2.4);
  p.head.rotation.y = a.olhar;
  p.head.rotation.x = Math.sin(a.passo*1 + 0.9)*0.035*k + Math.sin(elapsed*0.9)*0.012 - respira*0.006*(1-k);
  p.head.rotation.z = a.olhar*-0.12;

  // orelhas: balançam com o movimento e com a virada de cabeça
  p.ears.forEach((e, i) => {
    const s = i === 0 ? -1 : 1;
    e.rotation.z = s*(Math.abs(Math.sin(a.passo))*0.12*k) + Math.sin(elapsed*1.3 + i)*0.012 - a.olhar*0.12;
    e.rotation.x = Math.sin(a.passo*1.0 + i)*0.06*k;
  });

  // piscar
  a.blink -= dt;
  if(a.blink <= 0){ a.piscando = 0.13; a.blink = 2 + Math.random()*4.5; }
  if(a.piscando > 0) a.piscando -= dt;
  const aberto = a.piscando > 0 ? 0.12 : 1;
  p.eyes.forEach(e => { e.scale.y += (aberto - e.scale.y)*Math.min(1, dt*42); });

  // língua: aparece andando, some devagar quando para
  const alvoL = k > 0.45 ? 1 : 0.0;
  a.lingua += (alvoL - a.lingua)*Math.min(1, dt*(alvoL > 0 ? 7 : 2));
  const b = p.tongue.userData.base;
  const pulsar = 1 + Math.sin(elapsed*11)*0.1;
  p.tongue.scale.set(b[0], Math.max(0.001, b[1]*a.lingua*pulsar), b[2]);
  p.tongue.visible = a.lingua > 0.02;
}

/* Andar de gato: as quatro patas uma de cada vez, na ordem traseira esquerda,
   dianteira esquerda, traseira direita, dianteira direita (o cachorro trota, com
   as patas em diagonal aos pares). O corpo desliza quase sem quicar, a cabeça
   fica parada, o rabo erguido balança devagar e não há língua de fora. Parado,
   respira devagar; nada da respiração curta de cachorro. */
const FASE_GATO = [0, Math.PI, Math.PI/2, Math.PI*1.5]; // patas: tras. esq., tras. dir., diant. esq., diant. dir.
function animarGato(p, dt, elapsed, andando){
  const a = p.anim;
  a.peso += ((andando ? 1 : 0) - a.peso)*Math.min(1, dt*6);
  const k = a.peso;
  if(andando) a.passo += dt*7.5;

  p.legs.forEach((leg, i) => { leg.rotation.x = -Math.sin(a.passo + FASE_GATO[i])*0.34*k; });

  const respira = Math.sin(elapsed*1.3)*0.5 + 0.5;
  p.body.position.y = p.bodyBaseY + Math.sin(a.passo*2)*0.003*k + respira*0.0025*(1 - k);
  p.body.rotation.x = 0;
  p.body.rotation.z = Math.sin(a.passo)*0.012*k; // o quadril rola de leve a cada passo

  // rabo: erguido, balanço lento; andando, um pouco mais firme
  p.tail.rotation.y = Math.sin(elapsed*1.25)*(0.14 - 0.05*k);
  p.tail.rotation.x = Math.sin(elapsed*0.6)*0.05 - 0.04*k;

  // cabeça firme no andar; parado, olha em volta com calma
  a.olharTimer -= dt;
  if(a.olharTimer <= 0){
    a.olharAlvo = Math.random() < 0.4 ? 0 : (Math.random() - 0.5)*0.9;
    a.olharTimer = 2.5 + Math.random()*4;
  }
  a.olhar += (a.olharAlvo*(1 - k) - a.olhar)*Math.min(1, dt*2);
  p.head.rotation.y = a.olhar;
  p.head.rotation.x = Math.sin(a.passo*2)*0.006*k + Math.sin(elapsed*0.8)*0.008*(1 - k);
  p.head.rotation.z = a.olhar*-0.1;

  // orelhas: paradas, com uma torcidinha de vez em quando
  p.ears.forEach((e, i) => {
    const s = i === 0 ? -1 : 1;
    const torce = Math.max(0, Math.sin(elapsed*0.7 + i*2.3) - 0.93)*2.2;
    e.rotation.z = s*torce;
    e.rotation.x = 0;
  });

  // piscada lenta de gato
  a.blink -= dt;
  if(a.blink <= 0){ a.piscando = 0.28; a.blink = 3 + Math.random()*5; }
  if(a.piscando > 0) a.piscando -= dt;
  const aberto = a.piscando > 0 ? 0.1 : 1;
  p.eyes.forEach(e => { e.scale.y += (aberto - e.scale.y)*Math.min(1, dt*18); });

  p.tongue.visible = false;
}
