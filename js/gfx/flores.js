/*
  FLORES
  Três flores de verdade (margarida, cosmos e tulipa), com pétalas arredondadas,
  caule e folhas. As decorativas e as dos canteiros são instanciadas (e balançam
  no shader); as plantadas pelas pessoas continuam objetos individuais, porque
  cada uma murcha no seu tempo e precisa do próprio material.
*/
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sorteador } from './ruido.js';

/* pétala: tira curva de ponta redonda, em volta do eixo Y */
// fileiras ao longo da pétala, concentradas na ponta: é ela que precisa ser redonda
const NIVEIS = {
  fino: { ts: [0, 0.14, 0.32, 0.5, 0.67, 0.8, 0.9, 0.97, 1], NL: 4 },
  medio: { ts: [0, 0.28, 0.56, 0.8, 0.94, 1], NL: 2 },
  simples: { ts: [0, 0.45, 0.82, 1], NL: 1 },
};
let DETALHE = NIVEIS.fino;
function petala({ comp, larg, curva = 0.3, ergue = 0.15, inclinacao = 0 }){
  const { ts, NL } = DETALHE;
  const NC = ts.length - 1;
  const pos = [], cor = [], idx = [];
  for(let i=0;i<=NC;i++){
    const t = ts[i];
    // largura: nasce estreita, abre e fecha em arco — a ponta é um semicírculo
    const perfil = Math.pow(Math.max(0, Math.sin(Math.PI*Math.pow(t, 0.72))), 0.55)*0.56;
    for(let j=0;j<=NL;j++){
      const u = j/NL*2-1;
      const w = u*larg*Math.max(0.02, perfil);
      const r = t*comp;
      // côncava: a borda sobe em curva suave, sem vinco nenhum no meio
      const y = ergue*t*comp + curva*comp*t*t*(inclinacao >= 0 ? 1 : -1) + u*u*0.14*comp*Math.sin(Math.PI*t);
      pos.push(w, y, r);
      // mais escura na base e no centro, como numa pétala de verdade
      const v = (0.62 + Math.min(1, t*1.5)*0.42)*(1 - (1-Math.abs(u))*0.07*(1-t));
      cor.push(v, v, v);
    }
  }
  for(let i=0;i<NC;i++){
    for(let j=0;j<NL;j++){
      const a = i*(NL+1)+j, b = a+1, c = a+NL+1, d = c+1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function comAtributos(geo, r, g, b, tinta){
  const n = geo.attributes.position.count;
  if(!geo.attributes.color){
    const c = new Float32Array(n*3);
    for(let i=0;i<n;i++){ c[i*3] = r; c[i*3+1] = g; c[i*3+2] = b; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  const t = new Float32Array(n).fill(tinta);
  geo.setAttribute('aTinta', new THREE.BufferAttribute(t, 1));
  geo.deleteAttribute('uv');
  return geo.index ? geo.toNonIndexed() : geo;
}

function roseta({ n, comp, larg, y, ergue, curva, cor = null }){
  const partes = [];
  for(let i=0;i<n;i++){
    const p = petala({ comp, larg, ergue, curva });
    p.rotateY(i/n*Math.PI*2);
    p.translate(0, y, 0);
    partes.push(comAtributos(p, 1, 1, 1, 1));
  }
  return partes;
}
function miolo(y, r, cor = [0.95, 0.68, 0.14]){
  const g = new THREE.SphereGeometry(r, 8, 6);
  g.scale(1, 0.6, 1);
  g.translate(0, y, 0);
  return comAtributos(g, cor[0], cor[1], cor[2], 0);
}
function caule(altura, curva = 0.02){
  const g = new THREE.CylinderGeometry(0.009, 0.013, altura, DETALHE === NIVEIS.simples ? 4 : 7, 4);
  g.translate(0, altura/2, 0);
  const p = g.attributes.position;
  for(let i=0;i<p.count;i++){
    const t = p.getY(i)/altura;
    p.setX(i, p.getX(i) + t*t*curva);
  }
  g.computeVertexNormals();
  return comAtributos(g, 0.2, 0.42, 0.14, 0);
}
function folha(y, ang, comp = 0.13){
  const f = petala({ comp, larg: comp*0.42, ergue: 0.55, curva: -0.35 });
  f.rotateY(ang);
  f.translate(0, y, 0);
  const c = f.attributes.color;
  for(let i=0;i<c.count;i++){ const v = c.getX(i); c.setXYZ(i, 0.2*v, 0.46*v, 0.15*v); }
  return comAtributos(f, 0, 0, 0, 0);
}

/* altura total ~0.5: precisa ficar acima da grama aparada */
const CATALOGO = {
  margarida(){
    return {
      caule: [caule(0.38, 0.018), folha(0.1, 0.8), folha(0.18, 3.6)],
      flor: [...roseta({ n: 11, comp: 0.075, larg: 0.05, y: 0.385, ergue: 0.22, curva: 0.06 })],
      miolo: [miolo(0.392, 0.03)],
    };
  },
  cosmos(){
    return {
      caule: [caule(0.42, -0.02), folha(0.12, 2.2, 0.11), folha(0.22, 5.1, 0.1)],
      flor: [...roseta({ n: 6, comp: 0.09, larg: 0.1, y: 0.425, ergue: 0.32, curva: 0.1 })],
      miolo: [miolo(0.43, 0.024)],
    };
  },
  tulipa(){
    // taça de pétalas largas viradas pra cima, sem pontas
    const partes = [];
    for(let i=0;i<6;i++){
      // pétala de tulipa sobe e fecha pra dentro na ponta: taça, não estrela
      const p = petala({ comp: 0.078, larg: 0.15, ergue: 2.4, curva: -0.95 });
      p.rotateY(i/6*Math.PI*2);
      p.translate(0, 0.372, 0);
      partes.push(comAtributos(p, 1, 1, 1, 1));
    }
    const fundo = new THREE.SphereGeometry(0.058, 12, 8);
    fundo.scale(1, 1.05, 1);
    fundo.translate(0, 0.418, 0);
    return {
      caule: [caule(0.37, 0.012), folha(0.05, 1.1, 0.2), folha(0.07, 4.2, 0.19)],
      flor: [...partes, comAtributos(fundo, 1, 1, 1, 1)],
      miolo: [],
    };
  },
};

const cache = new Map();
function geometrias(tipo, nivel = 'fino'){
  const chave = tipo + nivel;
  if(cache.has(chave)) return cache.get(chave);
  DETALHE = NIVEIS[nivel];
  const c = CATALOGO[tipo]();
  const inteira = mergeGeometries([...c.caule, ...c.flor, ...c.miolo]);
  const resultado = {
    inteira,
    caule: mergeGeometries([...c.caule, ...c.miolo.length ? c.miolo : []]),
    flor: mergeGeometries(c.flor),
  };
  cache.set(chave, resultado);
  return resultado;
}

/* tinta: o que tem aTinta=1 (pétalas) multiplica pela cor da instância; caule e miolo, não */
function materialFlores(uTempo, { instanciado = true } = {}){
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.85 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTempo = uTempo;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float aTinta;\nuniform float uTempo;`)
      .replace('#include <color_vertex>', instanciado ? /* glsl */`
        vColor = vec4(1.0);
        vColor.rgb = color.rgb;
        #ifdef USE_INSTANCING_COLOR
          vColor.rgb *= mix(vec3(1.0), instanceColor.rgb, aTinta);
        #endif
      ` : '#include <color_vertex>')
      .replace('#include <begin_vertex>', /* glsl */`#include <begin_vertex>
        #ifdef USE_INSTANCING
          float fv = instanceMatrix[3].x*0.7 + instanceMatrix[3].z*0.5;
          float rajada = 0.6 + 0.4*sin(uTempo*0.23)*sin(uTempo*0.611);
          float hv = transformed.y/0.45; hv *= hv;
          transformed.x += sin(uTempo*1.7 + fv)*0.03*hv*rajada;
          transformed.z += cos(uTempo*1.3 + fv*1.2)*0.022*hv*rajada;
        #endif
      `);
  };
  m.customProgramCacheKey = () => 'flor' + (instanciado ? '-i' : '');
  return m;
}

export function criarFlores(scene, { perfil }){
  const uTempo = { value: 0 };
  const matI = materialFlores(uTempo);
  const tipos = Object.keys(CATALOGO);

  /* conjunto instanciado: pontos [{x, y, z, cor, escala?}] */
  function instanciar(pontos, { semente = 3, tipo = null, sombra = true } = {}){
    const r = sorteador(semente);
    const grupos = new Map();
    pontos.forEach(p => {
      const t = tipo || p.tipo || tipos[Math.floor(r()*tipos.length)];
      (grupos.get(t) || grupos.set(t, []).get(t)).push(p);
    });
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    const eixo = new THREE.Vector3(0, 1, 0), cor = new THREE.Color();
    const meshes = [];
    grupos.forEach((lista, t) => {
      const im = new THREE.InstancedMesh(geometrias(t, perfil.nome === 'alto' ? 'medio' : 'simples').inteira, matI, lista.length);
      lista.forEach((p, i) => {
        q.setFromAxisAngle(eixo, r()*Math.PI*2);
        const e = p.escala ?? (0.9 + r()*0.32);
        v.set(p.x, p.y ?? 0, p.z);
        s.set(e, e, e);
        m.compose(v, q, s);
        im.setMatrixAt(i, m);
        cor.set(p.cor);
        im.setColorAt(i, cor);
      });
      im.castShadow = sombra;
      im.receiveShadow = true;
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.userData.semAO = true;
      scene.add(im);
      meshes.push(im);
    });
    return meshes;
  }

  /* uma flor só, com material próprio (pra murchar) */
  function florUnica(cor, r = Math.random){
    const t = tipos[Math.floor(r()*tipos.length)];
    const g = geometrias(t);
    const grupo = new THREE.Group();
    const matCaule = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
    const matFlor = new THREE.MeshStandardMaterial({ color: cor, vertexColors: true, roughness: 0.62, side: THREE.DoubleSide });
    const caule = new THREE.Mesh(g.caule, matCaule);
    const flor = new THREE.Mesh(g.flor, matFlor);
    caule.castShadow = flor.castShadow = true;
    caule.receiveShadow = flor.receiveShadow = true;
    grupo.add(caule, flor);
    return { grupo, matFlor };
  }

  return { instanciar, florUnica, atualizar(elapsed){ uTempo.value = elapsed; } };
}

/* margaridinhas rentes à grama: cor de longe, detalhe de perto */
export function criarFloresDoGramado(scene, { perfil, livre, uTempo, altura = null }){
  const total = Math.round(1500*perfil.particulas);
  const pontal = [];
  const r = sorteador(55);
  let tentativas = 0;
  while(pontal.length < total && tentativas < total*30){
    tentativas++;
    const cx = (r()-0.5)*58, cz = (r()-0.5)*58;
    if(!livre(cx, cz)) continue;
    // em manchas: um ponto puxa alguns vizinhos, como acontece num gramado
    const n = 3 + Math.floor(r()*9);
    const tom = r();
    for(let i=0;i<n && pontal.length < total;i++){
      const x = cx + (r()-0.5)*1.6, z = cz + (r()-0.5)*1.6;
      if(livre(x, z)) pontal.push({ x, z, tom });
    }
  }
  const partes = [];
  DETALHE = NIVEIS.simples;
  for(let i=0;i<6;i++){
    const p = petala({ comp: 0.032, larg: 0.026, ergue: 0.16, curva: 0.04 });
    p.rotateY(i/6*Math.PI*2);
    p.translate(0, 0.122, 0);
    partes.push(comAtributos(p, 1, 1, 1, 1));
  }
  const m = new THREE.SphereGeometry(0.012, 5, 3); m.scale(1, 0.6, 1); m.translate(0, 0.125, 0);
  partes.push(comAtributos(m, 0.95, 0.72, 0.14, 0));
  const hasta = new THREE.CylinderGeometry(0.004, 0.005, 0.12, 3); hasta.translate(0, 0.06, 0);
  partes.push(comAtributos(hasta, 0.25, 0.45, 0.16, 0));
  const geo = mergeGeometries(partes);
  const mat = materialFlores(uTempo);
  const im = new THREE.InstancedMesh(geo, mat, pontal.length);
  const q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), mm = new THREE.Matrix4(), eixo = new THREE.Vector3(0, 1, 0), cor = new THREE.Color();
  pontal.forEach((p, i) => {
    q.setFromAxisAngle(eixo, r()*6.283);
    const e = 0.85 + r()*0.55;
    v.set(p.x, altura ? altura(p.x, p.z) : 0, p.z); s.set(e, e, e);
    mm.compose(v, q, s);
    im.setMatrixAt(i, mm);
    cor.set(p.tom < 0.74 ? 0xfdfbf2 : (p.tom < 0.88 ? 0xf7e36a : 0xd9c7ff));
    im.setColorAt(i, cor);
  });
  im.receiveShadow = true;
  im.computeBoundingSphere();
  im.userData.semAO = true;
  scene.add(im);
  return im;
}
