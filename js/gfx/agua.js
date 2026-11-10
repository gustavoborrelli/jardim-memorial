/*
  O LAGO (Jardim do Lago, etapa 37)
  Água em shader, como a da fonte, mas de lago: a profundidade vem da textura de
  relevo do chão (a mesma que a grama usa), e com ela a água fica transparente no
  raso, verde-escura no fundo e com espuma fina na margem, sem costura com o
  terreno. O reflexo é o do céu, e perto do horizonte vira a mata da outra margem
  (sem desenhar a cena duas vezes: no celular não cabe). O sol de fim de tarde
  deixa um rastro de brilho na água.

  Em volta: nenúfares com flor, juncos e taboas balançando na margem e o deque de
  madeira avançando sobre a água.
*/
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sorteador } from './ruido.js';
import { matMadeira } from './materiais.js';

const MEIA = 34; // a textura de relevo cobre ±34, como a máscara do chão

const VERT = /* glsl */`
  varying vec3 vWP;
  #include <fog_pars_vertex>
  void main(){
    vec4 mvPosition = modelViewMatrix*vec4(position, 1.0);
    vWP = (modelMatrix*vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix*mvPosition;
    #include <fog_vertex>
  }
`;
const FRAG = /* glsl */`
  varying vec3 vWP;
  uniform float uTempo, uNivel;
  uniform vec2 uFluxo;
  uniform vec3 uSolDir, uSolCor, uZenite, uMeio, uHorizonte;
  uniform sampler2D tRuido, tRelevo;
  uniform vec3 uLampadas[8];
  uniform int uNLampadas;
  uniform float uBrilhoLampadas;
  #include <fog_pars_fragment>

  float onda(vec2 p){
    // (no riacho as ondinhas descem com a correnteza: uFluxo; no lago, zero)
    float a = texture2D(tRuido, p*0.07 + uTempo*vec2(0.011, 0.006) - uFluxo*uTempo*0.05).g;
    float b = texture2D(tRuido, p*0.19 - uTempo*vec2(0.008, 0.014) - uFluxo*uTempo*0.11).r;
    float c = texture2D(tRuido, p*0.53 + uTempo*vec2(-0.017, 0.012)).b;
    return a*0.5 + b*0.33 + c*0.17;
  }

  void main(){
    vec2 p = vWP.xz;
    vec4 rel = texture2D(tRelevo, clamp(p/${(2*MEIA).toFixed(1)} + 0.5, 0.0, 1.0));
    float prof = uNivel - rel.r;
    if(prof < 0.0) discard;

    // ondinhas: mais calmas no raso, perto da margem
    float e = 0.07;
    float h0 = onda(p);
    float k = mix(0.55, 1.5, smoothstep(0.0, 0.6, prof));
    vec3 n = normalize(vec3((h0 - onda(p + vec2(e, 0.0)))*k, 1.0, (h0 - onda(p + vec2(0.0, e)))*k));

    vec3 v = normalize(cameraPosition - vWP);
    float nv = max(dot(n, v), 0.0);
    float fresnel = 0.02 + 0.98*pow(1.0 - nv, 5.0);
    vec3 r = reflect(-v, n);
    float ry = max(r.y, 0.0);
    vec3 ceu = mix(uHorizonte, uMeio, smoothstep(0.0, 0.25, ry));
    ceu = mix(ceu, uZenite, smoothstep(0.2, 0.85, ry));

    // luz do momento: de dia ~1, à noite bem menos (a água não tem luz própria)
    float luz = clamp(dot(uSolCor, vec3(0.3, 0.45, 0.25)), 0.0, 1.2);
    // a mata da outra margem refletida: um recorte de copas perto do horizonte
    vec2 rumo = normalize(r.xz + vec2(1e-4));
    float copas = 0.09 + 0.12*texture2D(tRuido, rumo*0.31 + 0.5).r + 0.05*texture2D(tRuido, rumo*0.9 + 0.2).g;
    float naMata = 1.0 - smoothstep(copas - 0.03, copas + 0.025, ry);
    vec3 mata = vec3(0.1, 0.17, 0.09)*(0.3 + 0.8*luz) + uHorizonte*0.06;
    vec3 reflexo = mix(ceu, mata, naMata*0.92);

    // o corpo d'água: o fundo aparece no raso, verde-escuro no fundo
    vec3 raso = mix(vec3(0.27, 0.38, 0.28), vec3(0.46, 0.42, 0.29), rel.g);
    vec3 fundo = vec3(0.04, 0.11, 0.1);
    vec3 corpo = mix(raso, fundo, smoothstep(0.0, 1.0, prof))*(0.3 + 0.7*luz);

    vec3 cor = mix(corpo, reflexo, fresnel);
    float alfa = mix(0.12, 0.93, smoothstep(0.0, 0.85, prof));
    alfa = max(alfa, fresnel*0.98);

    // espuma fina na beira, que respira devagar
    float borda = 0.03 + 0.025*sin(uTempo*0.7 + p.x*0.8 + p.y*0.6);
    float espuma = (1.0 - smoothstep(0.0, borda, prof))*(0.5 + 0.5*texture2D(tRuido, p*0.9 + uTempo*0.02).r);
    cor = mix(cor, vec3(0.92, 0.95, 0.9)*(0.25 + 0.75*luz), espuma*0.55);
    alfa = max(alfa, espuma*0.75);

    // o sol na água: ponto forte (o bloom acende em volta) e um rastro largo
    float sd = max(dot(r, uSolDir), 0.0);
    cor += uSolCor*(pow(sd, 700.0)*5.0 + pow(sd, 70.0)*0.16 + pow(sd, 9.0)*0.025);

    // os lampiões acesos refletidos: as ondinhas esticam cada um num rastro quente
    if(uBrilhoLampadas > 0.01){
      for(int i = 0; i < 8; i++){
        if(i >= uNLampadas) break;
        vec3 l = uLampadas[i] - vWP;
        float dl = length(l);
        float s = pow(max(dot(r, l/dl), 0.0), 150.0);
        cor += vec3(1.0, 0.7, 0.4)*s*uBrilhoLampadas*5.0/(1.0 + dl*dl*0.012);
      }
    }

    gl_FragColor = vec4(cor, alfa);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/* planta: o módulo js/jardins/lago.js; chao: o retorno de criarChao (textura de relevo) */
/* O material da água, para o lago e para o riacho do Bosque (etapa 40). A
   profundidade vem da textura de relevo do chão; `fluxo` é para onde a água corre. */
export function materialAgua({ ceu, luz, chao, nivel, lampadas = [], uTempo, uBrilhoLampadas, fluxo = [0, 0] }){
  const u = ceu.uniforms;
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, fog: true,
  });
  Object.assign(mat.uniforms, {
    uTempo, uNivel: { value: nivel }, uFluxo: { value: new THREE.Vector2(fluxo[0], fluxo[1]) },
    uSolDir: luz.uSolDir, uSolCor: luz.uSolCor,
    uZenite: u.uZenite, uMeio: u.uMeio, uHorizonte: u.uHorizonte,
    tRuido: chao.uniforms.tRuido, tRelevo: { value: chao.texRelevo },
    uLampadas: { value: Array.from({ length: 8 }, (_, i) => lampadas[i] ? new THREE.Vector3(lampadas[i].x, 2.55 + (lampadas[i].y ?? 0), lampadas[i].z) : new THREE.Vector3()) },
    uNLampadas: { value: Math.min(8, lampadas.length) },
    uBrilhoLampadas,
  });
  return mat;
}

/* lampadas: [{x, y, z}] os postes (y = chão), para o reflexo deles à noite */
export function criarLago(scene, { perfil, ceu, luz, chao, planta, lampadas = [] }){
  const { LAGO, NIVEL_AGUA, naMargem, DEQUE, doDeque, NENUFARES, JUNCOS } = planta;
  const r = sorteador(808);
  const uTempo = { value: 0 };
  const uBrilhoLampadas = { value: 0 };
  const grupo = new THREE.Group();
  scene.add(grupo);

  /* ---------- a água ---------- */
  {
    // um pouco maior que a margem: o terreno tapa o excesso e o shader recorta a beira
    const forma = new THREE.Shape();
    for(let i = 0; i < 96; i++){
      const [x, z] = naMargem(i/96*Math.PI*2, 2.2);
      if(i === 0) forma.moveTo(x, -z); else forma.lineTo(x, -z);
    }
    const geo = new THREE.ShapeGeometry(forma, 4);
    geo.rotateX(-Math.PI/2);
    const mat = materialAgua({ ceu, luz, chao, nivel: NIVEL_AGUA, lampadas, uTempo, uBrilhoLampadas });
    const agua = new THREE.Mesh(geo, mat);
    agua.position.y = NIVEL_AGUA;
    agua.renderOrder = 2;
    agua.userData.semAO = true;
    grupo.add(agua);
  }

  /* ---------- nenúfares ---------- */
  {
    // folha redonda com o corte em V, a borda levemente erguida
    const g = new THREE.CircleGeometry(1, 22, 0.32, Math.PI*2 - 0.64);
    const p = g.attributes.position;
    for(let i = 0; i < p.count; i++){
      const x = p.getX(i), y = p.getY(i), d = Math.hypot(x, y);
      p.setZ(i, d*d*0.07);
    }
    g.rotateX(-Math.PI/2);
    g.computeVertexNormals();
    const folhas = [], flores = [];
    NENUFARES.forEach(([cx, cz]) => {
      const n = 5 + Math.floor(r()*5);
      for(let i = 0; i < n; i++){
        const a = r()*Math.PI*2, d = Math.sqrt(r())*1.3;
        folhas.push({ x: cx + Math.cos(a)*d, z: cz + Math.sin(a)*d, e: 0.22 + r()*0.2, rot: r()*6.28 });
      }
      for(let i = 0; i < 1 + Math.floor(r()*2); i++) flores.push({ x: cx + (r() - 0.5)*1.2, z: cz + (r() - 0.5)*1.2, e: 0.85 + r()*0.4 });
    });
    const matFolha = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, side: THREE.DoubleSide });
    const im = new THREE.InstancedMesh(g, matFolha, folhas.length);
    const d = new THREE.Object3D(), c = new THREE.Color();
    const verdes = [0x5d8c3a, 0x6b9a44, 0x4f7d35, 0x78a24c];
    folhas.forEach((f, i) => {
      d.position.set(f.x, NIVEL_AGUA + 0.012, f.z);
      d.rotation.set(0, f.rot, 0);
      d.scale.setScalar(f.e);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
      im.setColorAt(i, c.setHex(verdes[i % verdes.length]));
    });
    im.receiveShadow = true;
    im.userData.semAO = true;
    im.computeBoundingSphere();
    grupo.add(im);

    // a flor: duas coroas de pétalas em taça, rosa claro com miolo amarelo
    const petala = () => {
      const s = new THREE.SphereGeometry(1, 8, 6, 0, Math.PI*2, 0, Math.PI*0.5);
      s.scale(0.03, 0.012, 0.075);
      s.translate(0, 0, 0.06);
      return s;
    };
    const partes = [];
    [[7, 0.5, 0.0], [6, 0.95, 0.4]].forEach(([n, ergue, giro]) => {
      for(let i = 0; i < n; i++){
        const pe = petala();
        pe.rotateX(-ergue);
        pe.rotateY(i/n*Math.PI*2 + giro);
        partes.push(pe);
      }
    });
    const geoFlor = mergeGeometries(partes.map(x => x.toNonIndexed()));
    const imF = new THREE.InstancedMesh(geoFlor, new THREE.MeshStandardMaterial({ color: 0xf6c6d4, roughness: 0.55, emissive: 0x3a1a20, emissiveIntensity: 0.2 }), flores.length);
    const miolo = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf2c43a, roughness: 0.6 }), flores.length);
    flores.forEach((f, i) => {
      d.position.set(f.x, NIVEL_AGUA + 0.02, f.z);
      d.rotation.set(0, r()*6.28, 0);
      d.scale.setScalar(f.e);
      d.updateMatrix();
      imF.setMatrixAt(i, d.matrix);
      d.position.y += 0.03*f.e;
      d.updateMatrix();
      miolo.setMatrixAt(i, d.matrix);
    });
    imF.castShadow = true;
    [imF, miolo].forEach(m => { m.userData.semAO = true; m.computeBoundingSphere(); grupo.add(m); });
  }

  /* ---------- juncos e taboas ---------- */
  const matJunco = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
  matJunco.onBeforeCompile = (s) => {
    s.uniforms.uTempo = uTempo;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTempo;')
      .replace('#include <begin_vertex>', /* glsl */`#include <begin_vertex>
        // balanço do vento: a ponta anda, a base fica; cada touceira com a sua fase
        #ifdef USE_INSTANCING
          float fase = instanceMatrix[3].x*0.9 + instanceMatrix[3].z*0.7;
        #else
          float fase = 0.0;
        #endif
        float alto = max(transformed.y, 0.0);
        float k = alto*alto*0.09;
        transformed.x += sin(uTempo*1.3 + fase)*k + sin(uTempo*3.1 + fase*2.0 + transformed.y*3.0)*k*0.25;
        transformed.z += cos(uTempo*1.1 + fase*1.3)*k*0.6;
      `);
  };
  matJunco.customProgramCacheKey = () => 'junco';
  {
    // uma touceira: folhas finas e compridas, algumas com a espiga marrom da taboa
    const touceira = (sem, comTaboa) => {
      const rr = sorteador(sem);
      const pos = [], cor = [], idx = [];
      let base = 0;
      const n = 11;
      for(let i = 0; i < n; i++){
        const a = rr()*Math.PI*2, d = rr()*0.16;
        const x0 = Math.cos(a)*d, z0 = Math.sin(a)*d;
        const alt = 0.75 + rr()*0.65, larg = 0.018 + rr()*0.012;
        const inc = 0.12 + rr()*0.3, rumo = a + (rr() - 0.5);
        const lx = Math.cos(rumo + Math.PI/2), lz = Math.sin(rumo + Math.PI/2);
        const verde = [0.36 + rr()*0.1, 0.5 + rr()*0.1, 0.22];
        for(let k = 0; k <= 4; k++){
          const t = k/4, w = larg*(1 - t*0.85);
          const cx = x0 + Math.cos(rumo)*inc*t*t*alt, cz = z0 + Math.sin(rumo)*inc*t*t*alt;
          pos.push(cx - lx*w, t*alt, cz - lz*w, cx + lx*w, t*alt, cz + lz*w);
          const escuro = 0.55 + t*0.5;
          cor.push(verde[0]*escuro, verde[1]*escuro, verde[2]*escuro, verde[0]*escuro, verde[1]*escuro, verde[2]*escuro);
          if(k > 0){ const a0 = base + (k - 1)*2; idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
        }
        base += 10;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const partes = [g];
      if(comTaboa){
        for(let i = 0; i < 3; i++){
          const a = rr()*Math.PI*2, d = 0.05 + rr()*0.08, alt = 1.15 + rr()*0.35;
          const haste = new THREE.CylinderGeometry(0.006, 0.008, alt, 4); haste.translate(Math.cos(a)*d, alt/2, Math.sin(a)*d);
          const espiga = new THREE.CapsuleGeometry(0.028, 0.16, 2, 6); espiga.translate(Math.cos(a)*d, alt - 0.1, Math.sin(a)*d);
          const pinta = (geo, rgb) => { const c = new Float32Array(geo.attributes.position.count*3); for(let j = 0; j < c.length; j += 3){ c[j] = rgb[0]; c[j + 1] = rgb[1]; c[j + 2] = rgb[2]; } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.deleteAttribute('uv'); return geo; };
          partes.push(pinta(haste, [0.42, 0.5, 0.25]), pinta(espiga, [0.36, 0.22, 0.12]));
        }
      }
      return mergeGeometries(partes.map(x => x.index ? x.toNonIndexed() : x));
    };
    const tipos = [touceira(3, false), touceira(9, true)];
    const lugares = [[], []];
    JUNCOS.forEach(({ a, extra }, i) => {
      // duas ou três touceiras por lugar, umas dentro d'água, outras na lama da beira
      for(let k = 0; k < 2 + (i % 2); k++){
        const [x, z] = naMargem(a + (r() - 0.5)*0.07, extra + (r() - 0.5)*0.9);
        lugares[r() < 0.3 ? 1 : 0].push({ x, z });
      }
    });
    const d = new THREE.Object3D();
    tipos.forEach((geo, t) => {
      const lista = lugares[t];
      const im = new THREE.InstancedMesh(geo, matJunco, lista.length);
      lista.forEach((l, i) => {
        d.position.set(l.x, NIVEL_AGUA - 0.08, l.z);
        d.rotation.set(0, r()*6.28, 0);
        d.scale.setScalar(0.8 + r()*0.45);
        d.updateMatrix();
        im.setMatrixAt(i, d.matrix);
      });
      im.castShadow = perfil.nome !== 'baixo';
      im.receiveShadow = true;
      im.userData.semAO = true;
      im.computeBoundingSphere();
      grupo.add(im);
    });
  }

  /* ---------- o deque ---------- */
  const poleiros = [];
  {
    const madeira = matMadeira(0x9b7a55);
    const escura = matMadeira(0x6e5338);
    const { u0, u1, meia, y } = DEQUE;
    const comp = u1 - u0;
    const ang = Math.atan2(DEQUE.dir[0], DEQUE.dir[1]); // o giro que leva +z para o rumo do deque
    const deque = new THREE.Group();
    const [cx, cz] = doDeque((u0 + u1)/2, 0);
    deque.position.set(cx, 0, cz);
    deque.rotation.y = ang;
    // tábuas atravessadas, com uma frestinha entre elas e um tom diferente cada uma
    const nT = Math.round(comp/0.3);
    const tabuas = [];
    for(let i = 0; i < nT; i++){
      const t = new THREE.BoxGeometry(meia*2 - 0.02 + (r() - 0.5)*0.06, 0.05, comp/nT - 0.025);
      t.translate((r() - 0.5)*0.03, y - 0.025 + (r() - 0.5)*0.008, -comp/2 + (i + 0.5)*comp/nT);
      tabuas.push(t);
    }
    const piso = new THREE.Mesh(mergeGeometries(tabuas), madeira);
    piso.castShadow = piso.receiveShadow = true;
    deque.add(piso);
    // vigas por baixo e os pilares descendo até o fundo
    const vigas = [-meia + 0.12, meia - 0.12].map(x => { const g = new THREE.BoxGeometry(0.12, 0.14, comp); g.translate(x, y - 0.12, 0); return g; });
    const pilares = [];
    [-comp/2 + 1.3, 0.4, comp/2 - 0.15].forEach(z => [-meia + 0.06, meia - 0.06].forEach(x => {
      const ponta = z > comp/2 - 0.5; // na ponta, os pilares sobem um pouco: dá onde amarrar um barco
      const topo = ponta ? y + 0.42 : y - 0.05;
      const g = new THREE.CylinderGeometry(0.075, 0.085, topo - (NIVEL_AGUA - 1.2), 9);
      g.translate(x, (topo + NIVEL_AGUA - 1.2)/2, z);
      pilares.push(g);
      if(ponta){
        const [px, pz] = doDeque(u0 + comp/2 + z, x);
        poleiros.push({ x: px, y: topo + 0.06, z: pz });
      }
    }));
    const estrutura = new THREE.Mesh(mergeGeometries([...vigas, ...pilares].map(g => g.toNonIndexed())), escura);
    estrutura.castShadow = estrutura.receiveShadow = true;
    deque.add(estrutura);
    grupo.add(deque);
  }

  return {
    grupo,
    poleiros,
    // brilho: 0 de dia, 1 com os lampiões acesos de noite
    atualizar(elapsed, brilho = 0){ uTempo.value = elapsed; uBrilhoLampadas.value = brilho; },
  };
}
