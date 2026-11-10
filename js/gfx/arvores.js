/*
  ÁRVORES
  A copa não é mais uma pedra facetada: são centenas de "tufos" de folha (cartões
  com textura de folhas) sempre virados pra câmera, distribuídos sobre volumes
  arredondados. O truque que dá o ar macio é a normal: em vez da normal do
  cartão, cada tufo usa a direção a partir do centro do volume — a copa inteira
  se ilumina como uma forma redonda e fofa, com luz de um lado e sombra do outro.

  Uma geometria por tipo + InstancedMesh: uma floresta custa poucas chamadas de
  desenho. Vento e contraluz estão no shader.
*/
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sorteador } from './ruido.js';
import { matPedra } from './materiais.js';

/* Num canvas, pixel transparente é preto. Ao gerar as versões reduzidas da textura o
   preto vaza pra borda de cada folha, e de longe a copa inteira vira um pontilhado
   escuro. Aqui o fundo transparente ganha a cor clara das próprias folhas. */
function semFranja(canvas, cinza = 215){
  const dados = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  const d = dados.data;
  for(let i=0;i<d.length;i+=4){
    if(d[i+3] < 250){
      // mantém a cor do que é parcialmente coberto, só puxa o totalmente vazio
      const a = d[i+3]/255;
      d[i] = d[i]*a + cinza*(1-a);
      d[i+1] = d[i+1]*a + cinza*(1-a);
      d[i+2] = d[i+2]*a + cinza*(1-a);
    }
  }
  const t = new THREE.DataTexture(new Uint8Array(d), canvas.width, canvas.height, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/* ---------- texturas dos tufos (só formas arredondadas: nada de ponta) ---------- */
function texturaFolhas(){
  const T = 256;
  const c = document.createElement('canvas'); c.width = c.height = T;
  const x = c.getContext('2d');
  const r = sorteador(5);
  x.clearRect(0, 0, T, T);
  const qtd = 74;
  for(let i=0;i<qtd;i++){
    const a = r()*Math.PI*2, d = Math.sqrt(r())*T*0.4;
    const px = T/2 + Math.cos(a)*d, py = T/2 + Math.sin(a)*d;
    const comp = 15 + r()*12, larg = comp*(0.5 + r()*0.16), rot = r()*Math.PI*2;
    const v = 188 + r()*67;
    x.save();
    x.translate(px, py); x.rotate(rot);
    const g = x.createLinearGradient(0, -larg, 0, larg);
    g.addColorStop(0, `rgb(${v},${v},${v})`);
    g.addColorStop(1, `rgb(${v*0.72},${v*0.72},${v*0.72})`);
    x.fillStyle = g;
    x.beginPath(); x.ellipse(0, 0, comp, larg, 0, 0, Math.PI*2); x.fill();
    x.strokeStyle = `rgba(${v*0.5},${v*0.5},${v*0.5},0.5)`;
    x.lineWidth = 1;
    x.beginPath(); x.moveTo(-comp*0.85, 0); x.lineTo(comp*0.85, 0); x.stroke();
    x.restore();
  }
  return semFranja(c, 215);
}
function texturaFlorada(){
  const T = 256;
  const c = document.createElement('canvas'); c.width = c.height = T;
  const x = c.getContext('2d');
  const r = sorteador(8);
  x.clearRect(0, 0, T, T);
  for(let i=0;i<34;i++){
    const a = r()*Math.PI*2, d = Math.sqrt(r())*T*0.4;
    const px = T/2 + Math.cos(a)*d, py = T/2 + Math.sin(a)*d;
    const raio = 13 + r()*9, rot = r()*Math.PI;
    const v = 208 + r()*47;
    x.save(); x.translate(px, py); x.rotate(rot);
    for(let p=0;p<5;p++){
      x.save(); x.rotate(p/5*Math.PI*2);
      const g = x.createRadialGradient(0, raio*0.55, 0, 0, raio*0.55, raio*0.75);
      g.addColorStop(0, `rgb(${v},${v},${v})`);
      g.addColorStop(1, `rgb(${v*0.86},${v*0.86},${v*0.86})`);
      x.fillStyle = g;
      x.beginPath(); x.ellipse(0, raio*0.55, raio*0.42, raio*0.6, 0, 0, Math.PI*2); x.fill();
      x.restore();
    }
    // miolo escuro: é o que faz o tufo ler como flor mesmo tingido de rosa
    x.fillStyle = `rgb(${v*0.46},${v*0.4},${v*0.4})`;
    x.beginPath(); x.arc(0, 0, raio*0.2, 0, Math.PI*2); x.fill();
    x.restore();
  }
  return semFranja(c, 235);
}

/* salgueiro: fios pendurados de folhinhas estreitas, do alto do cartão até embaixo.
   O cartão do salgueiro é alto e pendurado no ponto do tufo (ver CANTOS_PENDURADOS),
   e a copa inteira vira uma cortina. */
function texturaSalgueiro(){
  const L = 128, A = 256;
  const c = document.createElement('canvas'); c.width = L; c.height = A;
  const x = c.getContext('2d');
  const r = sorteador(13);
  x.clearRect(0, 0, L, A);
  for(let f=0;f<7;f++){
    let px = 10 + r()*(L - 20), py = r()*18;
    const fim = A*(0.62 + r()*0.36), curva = (r() - 0.5)*0.5;
    while(py < fim){
      const v = 180 + r()*75;
      const comp = 7 + r()*4, larg = 1.9 + r()*0.7;
      [-1, 1].forEach(lado => {
        x.save();
        x.translate(px + lado*2.2, py);
        x.rotate(lado*(0.35 + r()*0.25) + curva*0.4);
        x.fillStyle = `rgb(${v*(lado > 0 ? 1 : 0.82)},${v*(lado > 0 ? 1 : 0.82)},${v*(lado > 0 ? 1 : 0.82)})`;
        x.beginPath(); x.ellipse(0, comp*0.5, larg, comp, 0, 0, Math.PI*2); x.fill();
        x.restore();
      });
      py += 6 + r()*3;
      px += curva*2 + (r() - 0.5)*0.8;
    }
  }
  return semFranja(c, 205);
}

/* ---------- tronco: tubo de raio variável, com raiz alargada ---------- */
function tubo(pontos, raioFn, segs = 10, lados = 8){
  const curva = new THREE.CatmullRomCurve3(pontos.map(p => new THREE.Vector3(...p)));
  const quadros = curva.computeFrenetFrames(segs, false);
  const pos = [], nor = [], idx = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for(let i=0;i<=segs;i++){
    const t = i/segs;
    const c = curva.getPointAt(t);
    const raio = raioFn(t);
    for(let j=0;j<=lados;j++){
      const a = j/lados*Math.PI*2;
      n.copy(quadros.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(quadros.binormals[i], Math.sin(a));
      v.copy(c).addScaledVector(n, raio);
      pos.push(v.x, v.y, v.z);
      nor.push(n.x, n.y, n.z);
    }
  }
  for(let i=0;i<segs;i++){
    for(let j=0;j<lados;j++){
      const a = i*(lados+1)+j, b = a+1, d = a+lados+1, e = d+1;
      idx.push(a, b, d, b, e, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/* ---------- copa: distribui tufos sobre volumes ---------- */
function gerarCopa({ volumes, tufos, tamanho, paleta, r, base = 0, altura = 1, internos = 0.22, sombraBaixo = 0.45, cantos = null, giro = Math.PI*2 }){
  const pos = [], nor = [], cor = [], canto = [], info = [], uv = [], idx = [];
  const c = new THREE.Color(), n = new THREE.Vector3();
  const centro = new THREE.Vector3();
  let somaV = 0;
  volumes.forEach(v => { const k = v[3]*v[3]; centro.addScaledVector(new THREE.Vector3(v[0], v[1], v[2]), k); somaV += k; });
  centro.multiplyScalar(1/somaV);
  const pesos = volumes.map(v => v[3]*v[3]);
  const somaP = pesos.reduce((a, b) => a+b, 0);
  const pick = () => {
    let k = r()*somaP;
    for(let i=0;i<volumes.length;i++){ k -= pesos[i]; if(k <= 0) return volumes[i]; }
    return volumes[0];
  };
  const CANTOS = [[-1,-1],[1,-1],[1,1],[-1,1]];
  const formato = cantos || CANTOS;
  let k = 0;
  for(let i=0;i<tufos;i++){
    const v = pick();
    const [vx, vy, vz, vr] = v;
    const achatado = v[4] ?? 1;
    // direção uniforme na esfera; só uma parte dos tufos fica por dentro, pra tapar os buracos
    const interno = r() < internos;
    const dy = r()*2-1, a = r()*Math.PI*2, h = Math.sqrt(1-dy*dy);
    n.set(Math.cos(a)*h, dy, Math.sin(a)*h);
    const raio = vr*(interno ? 0.45 + r()*0.3 : 0.82 + r()*0.24);
    const x = vx + n.x*raio, y = vy + n.y*raio*achatado, z = vz + n.z*raio;

    // normal: mistura do volume local com a forma geral da copa
    const nx = n.x*0.72 + (x-centro.x)*0.18, ny = n.y*0.72 + (y-centro.y)*0.18 + 0.12, nz = n.z*0.72 + (z-centro.z)*0.18;
    // cada tufo vira um pouco pro seu lado: quebra a linha dura entre luz e sombra, que
    // com o sol baixo de fim de tarde dividia a copa em duas metades lisas
    const jit = 0.42;
    const nx2 = nx + (r()-0.5)*jit, ny2 = ny + (r()-0.5)*jit, nz2 = nz + (r()-0.5)*jit;
    const il = 1/Math.hypot(nx2, ny2, nz2);

    // cor: paleta + mais claro no topo e na parte voltada pra fora, mais escuro por dentro/embaixo
    c.setHex(paleta[Math.floor(r()*paleta.length)]);
    const altRel = Math.max(0, Math.min(1, (y-base)/altura));
    let luz = (1-sombraBaixo) + sombraBaixo*altRel;
    if(interno) luz *= 0.74;
    luz *= 0.96 + r()*0.08;
    c.multiplyScalar(luz);

    const tam = tamanho*(0.78 + r()*0.44)*(interno ? 1.15 : 1);
    const rot = giro >= Math.PI*2 ? r()*Math.PI*2 : (r() - 0.5)*giro;
    CANTOS.forEach(([cx, cy], q) => {
      pos.push(x, y, z);
      nor.push(nx2*il, ny2*il, nz2*il);
      cor.push(c.r, c.g, c.b);
      canto.push(formato[q][0], formato[q][1]);
      info.push(tam, rot);
      // a textura não é virada (DataTexture): no cartão pendurado, o alto do desenho vai no alto
      uv.push(cx*0.5+0.5, cantos ? 0.5 - cy*0.5 : cy*0.5+0.5);
    });
    idx.push(k, k+1, k+2, k, k+2, k+3);
    k += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.setAttribute('aCanto', new THREE.Float32BufferAttribute(canto, 2));
  g.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 2));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  g.boundingSphere.radius += tamanho*1.5;
  return g;
}

/* ---------- o mesmo vento/billboard vale para a cor e para a sombra ---------- */
const GLSL_VENTO = /* glsl */`
  attribute vec2 aCanto;
  attribute vec2 aInfo;
  uniform float uTempo;
  vec3 ventoTufo(vec3 p, float h){
    #ifdef USE_INSTANCING
      float fase = instanceMatrix[3].x*0.61 + instanceMatrix[3].z*0.47;
    #else
      float fase = 0.0;
    #endif
    float rajada = 0.6 + 0.4*sin(uTempo*0.23 + fase*0.2)*sin(uTempo*0.61);
    float k = h*h;
    vec3 v = vec3(0.0);
    v.x = sin(uTempo*1.1 + fase)*0.05*k*rajada;
    v.z = cos(uTempo*0.87 + fase*1.3)*0.035*k*rajada;
    // tremor das folhas: cada tufo com a própria fase
    float f = p.x*3.1 + p.y*2.3 + p.z*2.7;
    v += vec3(sin(uTempo*2.7 + f), sin(uTempo*3.1 + f*1.3)*0.6, cos(uTempo*2.3 + f*0.7))*0.013*(0.35 + k)*rajada;
    return v;
  }
`;
const GLSL_BILLBOARD = /* glsl */`
  vec4 mvPosition = vec4(transformed, 1.0);
  float escInst = 1.0;
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix*mvPosition;
    escInst = length(instanceMatrix[0].xyz);
  #endif
  mvPosition = modelViewMatrix*mvPosition;
  {
    float cs = cos(aInfo.y), sn = sin(aInfo.y);
    vec2 cn = aCanto*aInfo.x*escInst;
    mvPosition.xy += vec2(cn.x*cs - cn.y*sn, cn.x*sn + cn.y*cs);
  }
  gl_Position = projectionMatrix*mvPosition;
`;

/* abrePerto (uAlvo): os tufos a menos de ~2 m da câmera e os que ficam entre a
   câmera e o cachorro se desfazem. No Jardim do Lago a trilha passa por baixo do
   salgueiro e a câmera, atrás do cachorro, entrava na cortina de folhas (a tela
   inteira ficava verde). uAlvo: o cachorro, já no espaço da câmera. */
function materialCopa(mapa, uTempo, luz, { contraluz = 0.55, roughness = 0.82, cobertura = true, abrePerto = false, uAlvo = null } = {}){
  const m = new THREE.MeshStandardMaterial({
    map: mapa, vertexColors: true, roughness, metalness: 0,
    alphaTest: 0.42, alphaToCoverage: cobertura, side: THREE.DoubleSide, envMapIntensity: 1.85,
  });
  const k = { value: contraluz };
  m.onBeforeCompile = (s) => {
    s.uniforms.uTempo = uTempo;
    s.uniforms.uSolDir = luz.uSolDir;
    s.uniforms.uSolCor = luz.uSolCor;
    s.uniforms.uContraluz = k;
    if(abrePerto) s.uniforms.uAlvo = uAlvo;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL_VENTO}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += ventoTufo(transformed, clamp(transformed.y*0.28, 0.0, 1.3));`)
      .replace('#include <project_vertex>', GLSL_BILLBOARD);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uSolDir, uSolCor;\nuniform float uContraluz;${abrePerto ? '\nuniform vec3 uAlvo;' : ''}`)
      .replace('#include <alphatest_fragment>', abrePerto ? /* glsl */`
        {
          vec3 p = -vViewPosition;
          float abre = smoothstep(1.0, 2.6, length(p));
          // na linha entre a câmera e o cachorro: um túnel que se estreita perto dele
          float t = dot(p, uAlvo)/max(dot(uAlvo, uAlvo), 1e-3);
          if(t > 0.0 && t < 0.92) abre *= smoothstep(0.55, 1.5 - t*0.6, length(p - uAlvo*t));
          diffuseColor.a *= abre;
        }
        #include <alphatest_fragment>` : '#include <alphatest_fragment>')
      .replace('#include <normal_fragment_begin>', `vec3 normal = normalize(vNormal);\nvec3 nonPerturbedNormal = normal;`)
      .replace('#include <emissivemap_fragment>', /* glsl */`
        // luz atravessando as folhas: olhando contra o sol, a borda da copa acende
        vec3 solV = normalize((viewMatrix*vec4(uSolDir, 0.0)).xyz);
        vec3 olhar = normalize(-vViewPosition);
        float contra = pow(max(dot(olhar, solV), 0.0), 3.0);
        float beira = pow(1.0 - abs(dot(normal, -olhar)), 2.0);
        totalEmissiveRadiance += uSolCor*diffuseColor.rgb*contra*(0.25 + beira)*uContraluz;
      `);
  };
  m.customProgramCacheKey = () => abrePerto ? 'copa-abre' : 'copa';
  return m;
}
function materialSombraCopa(mapa, uTempo){
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: mapa, alphaTest: 0.42, side: THREE.DoubleSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTempo = uTempo;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL_VENTO}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += ventoTufo(transformed, clamp(transformed.y*0.28, 0.0, 1.3));`)
      .replace('#include <project_vertex>', GLSL_BILLBOARD);
  };
  m.customProgramCacheKey = () => 'copa-sombra';
  return m;
}

/* ---------- catálogo ---------- */
const VERDES_CIPRESTE = [0x5a9e58, 0x69ad60, 0x529660, 0x76b866];
const VERDES_FRONDOSA = [0x6fae4e, 0x82bd54, 0x97c95c, 0x5f9e4b, 0xa8d063];
const VERDES_MOITA = [0x63a551, 0x76b65a, 0x57984f];
const ROSAS = [0xffb0c8, 0xff9dbb, 0xffc4d6, 0xffd7e4, 0xff8cb0];
const VERDES_SALGUEIRO = [0x9cc06a, 0x8ab35e, 0xaccb76, 0x7ea455];
// o cartão do salgueiro: estreito e alto, preso pelo topo no ponto do tufo
const CANTOS_PENDURADOS = [[-0.55, -2.2], [0.55, -2.2], [0.55, 0.2], [-0.55, 0.2]];

function especificacao(tipo, r, folhagem){
  if(tipo === 'cipreste'){
    // coluna arredondada que afunila, sem ponta
    const vols = [];
    const n = 6;
    for(let i=0;i<n;i++){
      const t = i/(n-1);
      const y = 1.25 + t*3.35;
      const raio = 1.02*Math.sqrt(1 - Math.pow(t, 1.5)*0.82);
      const dx = (r()-0.5)*0.12, dz = (r()-0.5)*0.12;
      vols.push([dx, y, dz, raio, 0.95]);
    }
    return {
      volumes: vols, tufos: Math.round(520*folhagem), tamanho: 0.27/Math.sqrt(folhagem), paleta: VERDES_CIPRESTE,
      base: 0.6, altura: 4.4, sombraBaixo: 0.5, mapa: 'folhas',
      tronco: { pts: [[0, 0, 0], [0, 0.7, 0], [0, 1.6, 0]], r0: 0.26, r1: 0.1, galhos: [] },
      cascaCor: 0x4a3526,
    };
  }
  if(tipo === 'frondosa'){
    const vols = [
      [0, 3.0, 0, 1.75, 0.82], [1.3, 2.55, 0.5, 1.2, 0.82], [-1.25, 2.6, -0.45, 1.25, 0.82],
      [0.45, 2.45, -1.3, 1.15, 0.82], [-0.5, 2.5, 1.25, 1.15, 0.82], [0.2, 3.8, 0.1, 1.15, 0.82],
    ];
    return {
      volumes: vols, tufos: Math.round(1250*folhagem), tamanho: 0.33/Math.sqrt(folhagem), paleta: VERDES_FRONDOSA,
      base: 1.4, altura: 3.3, sombraBaixo: 0.56, mapa: 'folhas',
      tronco: { pts: [[0, 0, 0], [0.04, 0.8, 0.02], [-0.03, 1.8, 0], [0.02, 2.5, 0]], r0: 0.3, r1: 0.13,
        galhos: [
          [[0, 1.6, 0], [0.55, 2.1, 0.2], [1.1, 2.5, 0.42]],
          [[0, 1.7, 0], [-0.55, 2.2, -0.2], [-1.05, 2.6, -0.4]],
          [[0, 1.9, 0], [0.2, 2.35, -0.6], [0.4, 2.5, -1.1]],
          [[0, 1.9, 0], [-0.2, 2.35, 0.6], [-0.45, 2.55, 1.1]],
        ] },
      cascaCor: 0x5a4231,
    };
  }
  if(tipo === 'cerejeira'){
    const vols = [
      [0, 3.0, 0, 1.55, 0.72], [1.45, 2.65, 0.45, 1.12, 0.72], [-1.4, 2.7, -0.4, 1.15, 0.72],
      [0.5, 2.6, -1.35, 1.05, 0.72], [-0.55, 2.55, 1.35, 1.05, 0.72], [0.15, 3.65, -0.1, 1.0, 0.72],
      [1.0, 3.25, -0.7, 0.8, 0.72], [-1.0, 3.25, 0.7, 0.8, 0.72],
    ];
    return {
      volumes: vols, tufos: Math.round(1350*folhagem), tamanho: 0.32/Math.sqrt(folhagem), paleta: ROSAS,
      base: 1.6, altura: 2.9, sombraBaixo: 0.3, mapa: 'flores', contraluz: 0.8,
      tronco: { pts: [[0, 0, 0], [0.09, 0.7, 0.03], [0.02, 1.4, 0.06], [-0.05, 2.1, 0]], r0: 0.28, r1: 0.11,
        galhos: [
          [[0.04, 1.2, 0.05], [0.65, 1.85, 0.2], [1.3, 2.35, 0.42]],
          [[0.02, 1.35, 0.05], [-0.6, 1.95, -0.18], [-1.25, 2.45, -0.36]],
          [[0.02, 1.6, 0], [0.22, 2.1, -0.6], [0.45, 2.45, -1.15]],
          [[0, 1.65, 0.05], [-0.22, 2.15, 0.65], [-0.5, 2.45, 1.2]],
          [[-0.04, 2.0, 0], [0.04, 2.7, -0.05], [0.12, 3.25, -0.08]],
        ] },
      cascaCor: 0x4f3a36,
    };
  }
  if(tipo === 'salgueiro'){
    // cúpula larga e baixa e, em volta, a cortina caindo quase até o chão: anéis de
    // volumes cada vez mais abertos, com cartões altos pendurados (ver texturaSalgueiro)
    const vols = [[0, 3.9, 0, 1.6, 0.7], [0.5, 3.6, 0.4, 1.2, 0.7], [-0.6, 3.7, -0.3, 1.2, 0.7]];
    [[3.5, 1.7, 9, 0.75], [2.9, 2.35, 11, 0.7], [2.25, 2.85, 12, 0.62]].forEach(([y, raio, n, vr], k) => {
      for(let i=0;i<n;i++){
        const a = i/n*Math.PI*2 + k*0.37 + (r() - 0.5)*0.3;
        vols.push([Math.cos(a)*raio, y, Math.sin(a)*raio, vr, 0.8]);
      }
    });
    return {
      volumes: vols, tufos: Math.round(880*folhagem), tamanho: 0.5/Math.sqrt(folhagem), paleta: VERDES_SALGUEIRO,
      base: 0.6, altura: 3.6, sombraBaixo: 0.4, mapa: 'salgueiro', contraluz: 0.75, internos: 0.12,
      cantos: CANTOS_PENDURADOS, giro: 0.35,
      tronco: { pts: [[0, 0, 0], [0.18, 0.9, 0.05], [0.12, 1.9, 0.1], [0, 2.8, 0]], r0: 0.36, r1: 0.14,
        galhos: [
          [[0.15, 1.9, 0.08], [0.9, 2.8, 0.3], [1.7, 3.3, 0.6]],
          [[0.12, 2.0, 0.08], [-0.8, 2.9, -0.3], [-1.6, 3.4, -0.5]],
          [[0.1, 2.2, 0.1], [0.3, 3.0, -0.9], [0.5, 3.5, -1.6]],
          [[0.1, 2.2, 0.1], [-0.3, 3.0, 0.9], [-0.4, 3.5, 1.6]],
        ] },
      cascaCor: 0x5b4836,
    };
  }
  if(tipo === 'moita'){
    const vols = [[0, 0.02, 0, 0.5, 0.85], [0.26, -0.05, 0.1, 0.33, 0.85], [-0.24, -0.04, -0.12, 0.34, 0.85]];
    return { volumes: vols, tufos: Math.round(150*folhagem), tamanho: 0.15/Math.sqrt(folhagem), paleta: VERDES_MOITA, base: -0.3, altura: 0.8, sombraBaixo: 0.42, mapa: 'folhas' };
  }
  // 'longe': silhueta de mata atrás da cerca, com pouquíssimos tufos grandes
  const vols = [[0, 3.2, 0, 2.3, 0.95], [1.4, 2.5, 0.6, 1.55, 0.95], [-1.4, 2.6, -0.5, 1.6, 0.95], [0, 4.5, 0, 1.5, 0.95]];
  return { volumes: vols, tufos: Math.round(150*Math.max(0.5, folhagem)), tamanho: 1.05, paleta: [0x5d9a58, 0x6bab5e, 0x528c54, 0x7cb866], base: 0.8, altura: 5.2, sombraBaixo: 0.55, mapa: 'folhas', semTronco: false,
    tronco: { pts: [[0, 0, 0], [0, 1.4, 0]], r0: 0.28, r1: 0.18, galhos: [] }, cascaCor: 0x45352a };
}

/*
  lista: [{ x, z, escala, tipo, y? }]
  Devolve o que o mundo precisa atualizar a cada quadro.
*/
export function criarArvores(scene, lista, { perfil, luz, abrePerto = false }){
  const uTempo = { value: 0 };
  const uAlvo = { value: new THREE.Vector3(0, 0, -1e4) };
  const texFolhas = texturaFolhas();
  const texFlores = texturaFlorada();
  const texSalgueiro = lista.some(a => a.tipo === 'salgueiro') ? texturaSalgueiro() : null;
  const r = sorteador(1234);

  const porTipo = new Map();
  lista.forEach(a => { (porTipo.get(a.tipo) || porTipo.set(a.tipo, []).get(a.tipo)).push(a); });

  const meshes = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const eixoY = new THREE.Vector3(0, 1, 0);
  const tinta = new THREE.Color();

  porTipo.forEach((itens, tipo) => {
    const longe = tipo === 'longe';
    const esp = especificacao(tipo, r, perfil.folhagem);
    const geoCopa = gerarCopa({ ...esp, r });
    const mapa = esp.mapa === 'flores' ? texFlores : esp.mapa === 'salgueiro' ? texSalgueiro : texFolhas;
    const matCopa = materialCopa(mapa, uTempo, luz, { contraluz: esp.contraluz ?? 0.55, cobertura: perfil.msaa > 0, abrePerto, uAlvo });
    const copa = new THREE.InstancedMesh(geoCopa, matCopa, itens.length);
    copa.castShadow = !longe;
    // cada tufo receber a sombra dos vizinhos só escurece a copa inteira; a forma
    // redonda já vem das normais
    copa.receiveShadow = false;
    copa.customDepthMaterial = materialSombraCopa(mapa, uTempo);
    copa.userData.semAO = true;

    let tronco = null;
    if(esp.tronco){
      const t = esp.tronco;
      const partes = [tubo(t.pts, (u) => {
        const flare = 1 + 0.55*Math.pow(1-Math.min(1, u*3.5), 3);
        return (t.r0 + (t.r1-t.r0)*u)*flare;
      }, longe ? 4 : 10, longe ? 5 : 9)];
      t.galhos.forEach(g => partes.push(tubo(g, (u) => t.r1*(0.72 - u*0.45), 6, 6)));
      const geo = partes.length > 1 ? mergeGeometries(partes) : partes[0];
      tronco = new THREE.InstancedMesh(geo, matPedra({ cor: esp.cascaCor, escala: 3.2, relevo: 0.022, manchas: 0.5, rugosidade: 0.95 }), itens.length);
      tronco.castShadow = !longe;
      tronco.receiveShadow = true;
    }

    itens.forEach((a, i) => {
      q.setFromAxisAngle(eixoY, r()*Math.PI*2);
      const e = a.escala;
      p.set(a.x, a.y ?? 0, a.z);
      s.set(e, e*(0.94 + r()*0.12), e);
      m4.compose(p, q, s);
      copa.setMatrixAt(i, m4);
      if(tronco) tronco.setMatrixAt(i, m4);
      // cada árvore com seu próprio tom (senão a alameda parece carimbada)
      const v = 0.86 + r()*0.28;
      tinta.setRGB(v*(0.96 + r()*0.08), v, v*(0.92 + r()*0.12));
      copa.setColorAt(i, tinta);
    });
    copa.instanceMatrix.needsUpdate = true;
    if(copa.instanceColor) copa.instanceColor.needsUpdate = true;
    copa.computeBoundingSphere();
    scene.add(copa);
    meshes.push(copa);
    if(tronco){ tronco.computeBoundingSphere(); scene.add(tronco); meshes.push(tronco); }
  });

  return {
    meshes,
    // camera e alvo (o cachorro) só importam com abrePerto
    atualizar(elapsed, camera = null, alvo = null){
      uTempo.value = elapsed;
      if(abrePerto && camera && alvo){
        camera.updateMatrixWorld();
        uAlvo.value.set(alvo.x, alvo.y + 0.5, alvo.z).applyMatrix4(camera.matrixWorldInverse);
      }
    },
  };
}
