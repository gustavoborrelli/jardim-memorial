/*
  CHÃO
  Terreno, caminhos e grama. O coração é uma "máscara" assada uma vez no início
  (uma textura cobrindo o jardim) que diz, ponto a ponto: quanto é caminho,
  quanto a grama está desgastada, quanta grama nasce ali e quanta sombra de
  contato tem. O chão e a grama leem a mesma máscara, por isso a borda da grama
  coincide com a borda do caminho, sem nenhuma costura.

  A grama é uma nuvem de lâminas instanciadas, uma chamada de desenho só. As
  posições "dão a volta" em torno da câmera (mod no shader): o custo é fixo,
  sempre há grama densa onde se está olhando, e cada lâmina continua parada no
  mesmo ponto do mundo. Vento e o cachorro empurrando a grama também são shader.
*/
import * as THREE from 'three';
import { fbm, sorteador, suave, texturaRuido, vnoise, normalDeAltura } from './ruido.js';

const MEIA_MASCARA = 34; // a máscara cobre ±34 unidades (a cerca está em ±27)
const CERCA = 27;

/* relevo: plano onde se anda; depois sobe em colinas suaves. Plano até d=44,
   de propósito: a diagonal da cerca chega em ~38 */
export function alturaTerreno(x, z){
  const d = Math.hypot(x, z);
  const t = d - 44;
  if(t <= 0) return 0;
  // colinas baixas e arredondadas: o sol da tarde (11° de altura) precisa passar
  // por cima delas, e serra alta faz o jardim parecer um fosso
  const sobe = 1 - Math.exp(-t/120);
  const crista = fbm(x*0.0062 + 3.1, z*0.0062 + 7.7, 3);
  const crista2 = fbm(x*0.021, z*0.021, 2);
  return sobe*(5 + crista*crista*52) + (crista2-0.5)*Math.min(t*0.05, 2.6);
}

/* --- cascalho das avenidas: seixos desenhados um a um, com altura própria --- */
function texturaCascalho(tam){
  const cor = document.createElement('canvas'); cor.width = cor.height = tam;
  const alt = document.createElement('canvas'); alt.width = alt.height = tam;
  const c = cor.getContext('2d'), a = alt.getContext('2d');
  const r = sorteador(77);
  c.fillStyle = '#a58f6c'; c.fillRect(0, 0, tam, tam);
  a.fillStyle = '#303030'; a.fillRect(0, 0, tam, tam);
  const esc = tam/1024;
  const total = Math.round(6400);
  const tons = [[214,197,165],[199,180,146],[224,210,182],[183,163,131],[206,184,150],[171,152,124],[232,219,196]];
  for(let i=0;i<total;i++){
    const x = r()*tam, y = r()*tam;
    const raio = (3.2 + r()*r()*11)*esc;
    const ach = 0.65 + r()*0.35, rot = r()*Math.PI;
    const t = tons[Math.floor(r()*tons.length)];
    const v = 0.9 + r()*0.18;
    const desenhar = (dx, dy) => {
      c.save(); c.translate(x+dx, y+dy); c.rotate(rot); c.scale(1, ach);
      const g = c.createRadialGradient(-raio*0.25, -raio*0.3, raio*0.1, 0, 0, raio);
      g.addColorStop(0, `rgb(${t[0]*v*1.08},${t[1]*v*1.08},${t[2]*v*1.08})`);
      g.addColorStop(0.75, `rgb(${t[0]*v},${t[1]*v},${t[2]*v})`);
      g.addColorStop(1, `rgb(${t[0]*v*0.62},${t[1]*v*0.6},${t[2]*v*0.56})`);
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, raio, 0, Math.PI*2); c.fill();
      c.restore();
      a.save(); a.translate(x+dx, y+dy); a.rotate(rot); a.scale(1, ach);
      const h = a.createRadialGradient(0, 0, 0, 0, 0, raio);
      const topo = Math.round(120 + raio/esc*9);
      h.addColorStop(0, `rgb(${topo},${topo},${topo})`);
      h.addColorStop(0.7, `rgb(${topo-30},${topo-30},${topo-30})`);
      h.addColorStop(1, 'rgb(40,40,40)');
      a.fillStyle = h;
      a.beginPath(); a.arc(0, 0, raio, 0, Math.PI*2); a.fill();
      a.restore();
    };
    desenhar(0, 0);
    // repete do outro lado da borda: a textura precisa ladrilhar sem emenda
    if(x < raio) desenhar(tam, 0); else if(x > tam-raio) desenhar(-tam, 0);
    if(y < raio) desenhar(0, tam); else if(y > tam-raio) desenhar(0, -tam);
  }
  const mapa = new THREE.CanvasTexture(cor);
  mapa.wrapS = mapa.wrapT = THREE.RepeatWrapping;
  mapa.colorSpace = THREE.SRGBColorSpace;
  mapa.anisotropy = 8;
  return { mapa, normal: normalDeAltura(alt, 3.2) };
}

/* Assa a máscara. sdCaminho(x,z) devolve a distância até o caminho (negativa
   dentro); `semGrama` são círculos onde a grama não nasce; `manchas` são as
   sombras de contato já conhecidas (copas, bancos, canteiros). */
function assarMascara({ tam, sdCaminho, semGrama, manchas }){
  const dados = new Uint8Array(tam*tam*4);
  const lado = 2*MEIA_MASCARA/tam;
  for(let j=0;j<tam;j++){
    const z = -MEIA_MASCARA + (j+0.5)*lado;
    for(let i=0;i<tam;i++){
      const x = -MEIA_MASCARA + (i+0.5)*lado;
      const ii = (j*tam+i)*4;
      let d = sdCaminho(x, z);
      let caminho = 0, desgaste = 0, grama = 1;
      if(d < 3.2){
        // borda orgânica: o ruído empurra a linha do caminho pra dentro e pra fora
        const b = (fbm(x*0.42, z*0.42, 3)-0.5)*1.05 + (vnoise(x*2.3, z*2.3)-0.5)*0.32;
        d += b;
        caminho = 1 - suave(-0.2, 0.14, d);
        desgaste = 1 - suave(-0.1, 1.5, d);
        grama = suave(-0.05, 0.42, d);
      }
      dados[ii] = caminho*255;
      dados[ii+1] = desgaste*255;
      dados[ii+2] = grama*255;
      dados[ii+3] = 255;
    }
  }
  const pintar = (x, z, r, fn) => {
    const i0 = Math.max(0, Math.floor((x-r+MEIA_MASCARA)/lado)), i1 = Math.min(tam-1, Math.ceil((x+r+MEIA_MASCARA)/lado));
    const j0 = Math.max(0, Math.floor((z-r+MEIA_MASCARA)/lado)), j1 = Math.min(tam-1, Math.ceil((z+r+MEIA_MASCARA)/lado));
    for(let j=j0;j<=j1;j++){
      const pz = -MEIA_MASCARA + (j+0.5)*lado;
      for(let i=i0;i<=i1;i++){
        const px = -MEIA_MASCARA + (i+0.5)*lado;
        const dist = Math.hypot(px-x, pz-z);
        if(dist < r) fn((j*tam+i)*4, dist/r);
      }
    }
  };
  semGrama.forEach(c => pintar(c.x, c.z, c.r, (ii, t) => {
    dados[ii+2] = Math.min(dados[ii+2], suave(0.3, 1, t)*255);
  }));
  manchas.forEach(c => pintar(c.x, c.z, c.r, (ii, t) => {
    const k = 1 - (1-suave(0, 1, t))*(c.forca ?? 0.5);
    dados[ii+3] = dados[ii+3]*k;
  }));
  const t = new THREE.DataTexture(dados, tam, tam, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/* Cor da grama em função da posição — a MESMA conta no chão e nas lâminas */
const GLSL_COR_GRAMA = /* glsl */`
  uniform vec3 uGramaFunda, uGramaViva, uGramaSeca;
  uniform sampler2D tRuido, tMascara;
  vec4 lerMascara(vec2 p){
    vec2 uv = p/${(2*MEIA_MASCARA).toFixed(1)} + 0.5;
    vec4 m = texture2D(tMascara, uv);
    // fora da máscara: campo aberto
    float fora = step(${MEIA_MASCARA.toFixed(1)}, max(abs(p.x), abs(p.y)));
    return mix(m, vec4(0.0, 0.0, 1.0, 1.0), fora);
  }
  vec3 corGrama(vec2 p, float desgaste){
    float a = texture2D(tRuido, p*0.021).r;
    float b = texture2D(tRuido, p*0.067 + 0.31).r;
    float c = texture2D(tRuido, p*0.21 + 0.73).g;
    vec3 cor = mix(uGramaFunda, uGramaViva, smoothstep(0.32, 0.68, a*0.6 + b*0.4));
    cor = mix(cor, uGramaSeca, smoothstep(0.58, 0.82, b)*0.42);
    cor *= 0.9 + c*0.2;
    // fora da cerca o campo fica mais solto e mais amarelado
    float fora = smoothstep(${CERCA.toFixed(1)}, ${(CERCA+6).toFixed(1)}, max(abs(p.x), abs(p.y)));
    cor = mix(cor, uGramaSeca*vec3(0.95, 1.0, 0.86), fora*0.28);
    return mix(cor, uGramaSeca*vec3(1.05, 0.96, 0.8), desgaste*0.62);
  }
`;

export function criarChao(scene, { perfil, sdCaminho, semGrama, manchas }){
  const ruido = texturaRuido();
  const tamMascara = perfil.nome === 'baixo' ? 512 : 1024;
  const mascara = assarMascara({ tam: tamMascara, sdCaminho, semGrama, manchas });
  const cascalho = texturaCascalho(perfil.nome === 'baixo' ? 512 : 1024);

  const comum = {
    tRuido: { value: ruido },
    tMascara: { value: mascara },
    uGramaFunda: { value: new THREE.Color(0x4f8c37) },
    uGramaViva: { value: new THREE.Color(0x86b447) },
    uGramaSeca: { value: new THREE.Color(0xc4b85e) },
    uCam: { value: new THREE.Vector3() },
    uRaioGrama: { value: perfil.grama.longe.raio },
    uFloresta: { value: new THREE.Color(0x46784a) },
  };

  /* ---------- terreno ---------- */
  // no perfil baixo o chão e a grama cobrem a tela inteira com a conta de luz mais
  // barata que existe; é aí que um celular fraco ganha quadros de verdade
  const barato = perfil.nome === 'baixo';
  const Mat = barato ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial;
  const opcoesPBR = barato ? {} : { roughness: 1, metalness: 0, envMapIntensity: 0.9 };
  const matTerreno = new Mat({ ...opcoesPBR });
  matTerreno.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, comum, {
      tCascalho: { value: cascalho.mapa },
      tCascalhoN: { value: cascalho.normal },
    });
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWP;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvWP = (modelMatrix*vec4(transformed, 1.0)).xyz;`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP;
        uniform vec3 uCam, uFloresta;
        uniform float uRaioGrama;
        uniform sampler2D tCascalho, tCascalhoN;
        ${GLSL_COR_GRAMA}
      `)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 pm = vWP.xz;
        vec4 masc = lerMascara(pm);
        vec3 grama = corGrama(pm, masc.g);

        // sob as lâminas o chão é escuro (dá fundo à grama); longe, onde a grama
        // já sumiu, ele assume a cor média dela e a transição não aparece
        float distCam = length(pm - uCam.xz);
        // (só onde há lâminas: numa clareira o chão aparece de verdade)
        float sobLaminas = mix(0.6, 0.94, smoothstep(uRaioGrama*0.45, uRaioGrama*0.95, distCam));
        grama *= mix(0.86, sobLaminas, masc.b);
        grama = mix(mix(uGramaFunda*vec3(1.05, 0.92, 0.7), grama, 0.5), grama, masc.b);

        // colinas: manchas de mata conforme sobe, sem rocha nenhuma
        float alt = vWP.y;
        if(alt > 0.1){
          float mata = smoothstep(0.42, 0.56, texture2D(tRuido, pm*0.0058).r + texture2D(tRuido, pm*0.024).g*0.18);
          grama = mix(grama, uFloresta, mata*smoothstep(0.3, 4.0, alt)*0.8);
        }

        vec3 pedrisco = texture2D(tCascalho, pm*0.62).rgb;
        pedrisco = mix(pedrisco, vec3(0.6, 0.47, 0.31), 0.42); // menos contraste entre seixos
        pedrisco *= 0.9 + texture2D(tRuido, pm*0.06).r*0.2;
        vec3 corChao = mix(grama, pedrisco, masc.r);
        diffuseColor.rgb = corChao * masc.a;
      `)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if(masc.r > 0.01){
          vec3 nc = texture2D(tCascalhoN, pm*0.62).xyz*2.0 - 1.0;
          vec3 nw = normalize(vec3(nc.x, 1.35, nc.y));
          normal = normalize(mix(normal, normalize((viewMatrix*vec4(nw, 0.0)).xyz), masc.r));
        }
      `);
  };

  const segs = perfil.nome === 'baixo' ? 56 : 96;
  const geoChao = new THREE.PlaneGeometry(140, 140, segs, segs);
  geoChao.rotateX(-Math.PI/2);
  {
    const pos = geoChao.attributes.position;
    for(let i=0;i<pos.count;i++) pos.setY(i, alturaTerreno(pos.getX(i), pos.getZ(i)));
    geoChao.computeVertexNormals();
  }
  const ground = new THREE.Mesh(geoChao, matTerreno);
  ground.receiveShadow = true;
  scene.add(ground);

  // colinas ao longe: um anel em torno do plano, mesmo relevo e mesmo material
  {
    const anel = [];
    const ANG = perfil.nome === 'baixo' ? 96 : 220, RAD = perfil.nome === 'baixo' ? 30 : 56, R0 = 62, R1 = 520;
    const pts = new Float32Array((ANG+1)*(RAD+1)*3);
    for(let j=0;j<=RAD;j++){
      const r = R0 + (R1-R0)*Math.pow(j/RAD, 1.7);
      for(let i=0;i<=ANG;i++){
        const a = i/ANG*Math.PI*2;
        const x = Math.cos(a)*r, z = Math.sin(a)*r;
        const k = (j*(ANG+1)+i)*3;
        pts[k] = x; pts[k+1] = alturaTerreno(x, z); pts[k+2] = z;
      }
    }
    for(let j=0;j<RAD;j++){
      for(let i=0;i<ANG;i++){
        const a = j*(ANG+1)+i, b = a+1, c = a+ANG+1, d = c+1;
        anel.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    g.setIndex(anel);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, matTerreno);
    m.frustumCulled = false;
    scene.add(m);
  }

  /* ---------- lâminas ---------- */
  // dois anéis: perto, poucas lâminas muito bem feitas; longe, muitas e simples,
  // que de lá ninguém distingue. É o que custa menos vértices para o mesmo gramado.
  function geoLaminas({ raio, densidade, segmentos }, semente){
    const total = Math.round((2*raio)*(2*raio)*densidade);
    const ts = { 2: [0, 0.6, 1], 3: [0, 0.45, 0.8, 1], 4: [0, 0.4, 0.7, 0.9, 1] }[segmentos];
    const g = new THREE.InstancedBufferGeometry();
    // ponta arredondada: largura segue sqrt(1-t⁴) e não um triângulo — ponta fina
    // vira "espinho" a esta escala, e o jardim não tem espinhos
    const v = [], idx = [];
    ts.forEach((t, i) => {
      const w = Math.sqrt(Math.max(0, 1 - t*t*t*t));
      v.push(-w, t, 0, w, t, 0);
      if(i > 0){
        const a = (i-1)*2, b = a+1, c = a+2, d = a+3;
        idx.push(a, b, c, b, d, c);
      }
    });
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    // o shader calcula a normal, mas sem esse atributo o three liga flat shading sozinho
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(v.length), 3));
    g.setIndex(idx);
    const base = new Float32Array(total*4);
    const r = sorteador(semente);
    for(let i=0;i<total;i++){
      base[i*4] = r()*2*raio;
      base[i*4+1] = r()*2*raio;
      base[i*4+2] = r();
      base[i*4+3] = r();
    }
    g.setAttribute('iBase', new THREE.InstancedBufferAttribute(base, 4));
    g.instanceCount = total;
    return g;
  }

  const uGrama = {
    uTempo: { value: 0 },
    uCao: { value: new THREE.Vector2(9999, 9999) },
    uSolDir: { value: new THREE.Vector3(0, 1, 0) },
    uSolCor: { value: new THREE.Color(0xffffff) },
    uVento: { value: 1 },
  };
  const novoMatGrama = (raio, miolo) => {
    const m = new Mat({ ...opcoesPBR, side: THREE.DoubleSide });
    m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, comum, uGrama, { uRaioL: { value: raio }, uMiolo: { value: miolo } });
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 iBase;
        uniform vec3 uCam, uSolDir;
        uniform float uRaioL, uMiolo, uTempo, uVento;
        uniform vec2 uCao;
        varying vec3 vTint;
        varying float vT;
        varying float vBrilho;
        vec3 posLamina;
        ${GLSL_COR_GRAMA}
      `)
      .replace('#include <beginnormal_vertex>', /* glsl */`
        float t = position.y, lado = position.x;
        float r1 = iBase.z, r2 = iBase.w;
        vec2 q = mod(iBase.xy - uCam.xz + uRaioL, 2.0*uRaioL) - uRaioL;
        vec2 w = q + uCam.xz;
        float dist = length(q);
        float borda = 1.0 - smoothstep(uRaioL*0.72, uRaioL*0.98, dist);
        // o anel de longe abre um buraco onde o de perto já está cuidando
        if(uMiolo > 0.0) borda *= smoothstep(uMiolo*0.72, uMiolo*0.98, dist);
        vec4 m = lerMascara(w);
        float qtd = m.b*borda;

        // gramado aparado dentro da cerca, campo mais alto do lado de fora
        float fora = smoothstep(${CERCA.toFixed(1)}, ${(CERCA+2.5).toFixed(1)}, max(abs(w.x), abs(w.y)));
        float tufos = texture2D(tRuido, w*0.11).g;
        float alt = mix(0.11 + r1*0.11, 0.22 + r1*0.34, fora) * (0.8 + tufos*0.5) * qtd;

        // vento: uma frente de onda que atravessa o gramado + tremor próprio
        vec2 rumo = vec2(0.82, 0.57);
        float onda = texture2D(tRuido, w*0.032 - rumo*uTempo*0.045).r - 0.42;
        float tremor = sin(uTempo*2.3 + w.x*1.4 + w.y*1.1 + r2*6.283)*0.2;
        vec2 dobra = rumo*(onda*1.55 + tremor*0.55)*uVento;

        // o cachorro abre caminho
        vec2 dc = w - uCao;
        float dl = length(dc);
        float kc = 1.0 - smoothstep(0.14, 0.66, dl);
        if(dl > 0.001) dobra += dc/dl*kc*1.9;
        alt *= 1.0 - kc*0.28;

        float ang = r2*6.283;
        vec2 eixo = vec2(cos(ang), sin(ang));
        vec2 inclina = vec2(eixo.y, -eixo.x)*(r1 - 0.5)*0.75;
        float curva = t*t;
        vec2 desl = (dobra + inclina)*curva*alt;
        // de longe a lâmina engrossa e cobre mais chão com menos geometria
        float larg = (0.0075 + r2*0.0075)*(1.0 + dist*0.085)*min(1.0, alt*14.0);
        float encolhe = 1.0 - min(0.5, dot(dobra, dobra)*0.16)*curva;
        posLamina = vec3(
          w.x + eixo.x*lado*larg + desl.x,
          t*alt*encolhe,
          w.y + eixo.y*lado*larg + desl.y
        );
        vec3 objectNormal = normalize(vec3(-dobra.x*0.55, 1.0, -dobra.y*0.55) + vec3(eixo.y, 0.0, -eixo.x)*lado*0.22);

        vT = t;
        vec3 tinta = corGrama(w, m.g);
        tinta *= 0.84 + r1*0.32;
        // uma ou outra lâmina mais clara ou mais queimada, como numa grama de verdade
        tinta = mix(tinta, uGramaSeca, step(0.985, r2)*0.4);
        vTint = tinta * m.a;
        vBrilho = kc;
      `)
      .replace('#include <begin_vertex>', `vec3 transformed = posLamina;`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uSolDir, uSolCor;
        varying vec3 vTint;
        varying float vT;
        varying float vBrilho;
      `)
      .replace('#include <color_fragment>', /* glsl */`
        // raiz escura → ponta clara: é isso que dá volume ao gramado
        float gradiente = mix(0.6, 1.12, smoothstep(0.0, 0.85, vT));
        diffuseColor.rgb = vTint * gradiente;
      `)
      // sem inverter a normal no verso: uma lâmina não tem "lado errado"
      .replace('#include <normal_fragment_begin>', /* glsl */`
        vec3 normal = normalize(vNormal);
        vec3 nonPerturbedNormal = normal;
      `)
      .replace('#include <emissivemap_fragment>', /* glsl */`
        // contraluz: olhando na direção do sol, a ponta da lâmina acende
        vec3 solV = normalize((viewMatrix*vec4(uSolDir, 0.0)).xyz);
        float contra = pow(max(dot(normalize(-vViewPosition), solV), 0.0), 5.0);
        totalEmissiveRadiance += uSolCor * vTint * contra * vT * vT * 0.5;
      `);
  };
    return m;
  };
  const camadasGrama = [];
  const addCamada = (cfg, miolo, semente) => {
    const g = geoLaminas(cfg, semente);
    const m = new THREE.Mesh(g, novoMatGrama(cfg.raio, miolo));
    m.frustumCulled = false;
    m.receiveShadow = true;
    m.userData.semAO = true;
    scene.add(m);
    camadasGrama.push(m);
  };
  if(perfil.grama.perto) addCamada(perfil.grama.perto, 0, 9);
  addCamada(perfil.grama.longe, perfil.grama.perto ? perfil.grama.perto.raio : 0, 17);

  return {
    ground, camadasGrama, uniforms: comum, uGrama, mascara,
    atualizar(elapsed, camera, posCao){
      comum.uCam.value.copy(camera.position);
      uGrama.uTempo.value = elapsed;
      if(posCao) uGrama.uCao.value.set(posCao.x, posCao.z);
    },
    // governador: menos lâminas sem precisar recompilar nada
    reduzirGrama(fator){ camadasGrama.forEach(m => { m.geometry.instanceCount = Math.floor(m.geometry.instanceCount*fator); }); },
  };
}
