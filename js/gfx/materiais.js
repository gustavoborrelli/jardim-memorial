/*
  MATERIAIS
  Pedra, terracota e madeira. Nada de arquivo de imagem: a pedra é ruído aplicado
  em três eixos no próprio shader (por isso qualquer forma, até as sem UV, ganha
  grão e relevo sem emenda), e a madeira é um veio desenhado em canvas.
*/
import * as THREE from 'three';
import { sorteador, texturaRuido, normalDeAltura } from './ruido.js';

/* ------------------------------ pedra ------------------------------ */
export function matPedra({
  cor = 0xd4cbb8, rugosidade = 0.86, metal = 0, escala = 1.5, relevo = 0.016,
  musgo = 0, alturaMusgo = 0.35, manchas = 0.3, veios = 0, pontos = 0.14, vertexColors = false, envMapIntensity = 1,
} = {}){
  const m = new THREE.MeshStandardMaterial({ color: cor, roughness: rugosidade, metalness: metal, vertexColors, envMapIntensity });
  const u = {
    tRuido: { value: texturaRuido() },
    uEsc: { value: escala },
    uRelevo: { value: relevo },
    uMusgo: { value: musgo },
    uAltMusgo: { value: alturaMusgo },
    uManchas: { value: manchas },
    uVeios: { value: veios },
    uPontos: { value: pontos },
  };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;`)
      .replace('#include <begin_vertex>', /* glsl */`#include <begin_vertex>
        vec4 wp_ = vec4(transformed, 1.0);
        vec3 wn_ = objectNormal;
        #ifdef USE_INSTANCING
          wp_ = instanceMatrix*wp_;
          wn_ = mat3(instanceMatrix)*wn_;
        #endif
        vWP = (modelMatrix*wp_).xyz;
        vWN = normalize(mat3(modelMatrix)*wn_);
      `);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', /* glsl */`#include <common>
        varying vec3 vWP;
        varying vec3 vWN;
        uniform sampler2D tRuido;
        uniform float uEsc, uRelevo, uMusgo, uAltMusgo, uManchas, uVeios, uPontos;
        vec4 tri(vec3 p, vec3 b){
          return texture2D(tRuido, p.zy)*b.x + texture2D(tRuido, p.xz)*b.y + texture2D(tRuido, p.xy)*b.z;
        }
        vec3 relevoN(vec3 pos, vec3 n, float h, float k){
          vec3 sx = dFdx(pos), sy = dFdy(pos);
          vec2 d = vec2(dFdx(h), dFdy(h))*k;
          vec3 r1 = cross(sy, n), r2 = cross(n, sx);
          float det = dot(sx, r1)*(gl_FrontFacing ? 1.0 : -1.0);
          vec3 g = sign(det)*(d.x*r1 + d.y*r2);
          return normalize(abs(det)*n - g);
        }
        float altPedra;
      `)
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
        vec3 bl = pow(abs(normalize(vWN)), vec3(4.0));
        bl /= bl.x + bl.y + bl.z;
        vec4 n1 = tri(vWP*uEsc*0.25, bl);
        vec4 n2 = tri(vWP*uEsc*1.3, bl);
        altPedra = n2.g*0.65 + n2.b*0.35;
        // manchas largas + pontinhos: a variação que faz pedra parecer pedra
        diffuseColor.rgb *= 1.0 + (n1.r - 0.5)*uManchas;
        diffuseColor.rgb *= 1.0 - uPontos*(1.0 - smoothstep(0.08, 0.22, n2.b));
        diffuseColor.rgb *= 0.95 + n2.a*0.09;
        if(uVeios > 0.0){
          float v = abs(sin((vWP.x*2.1 + vWP.y*3.4 + vWP.z*1.3)*1.8 + n1.r*9.0));
          diffuseColor.rgb *= 1.0 - uVeios*smoothstep(0.1, 0.0, v);
        }
        if(uMusgo > 0.0){
          // musgo nasce embaixo e em frestas, nunca uma faixa reta
          float baixo = 1.0 - smoothstep(uAltMusgo*0.3, uAltMusgo*(0.8 + n1.r), vWP.y);
          float k = smoothstep(0.42, 0.68, n1.g*0.5 + n2.r*0.5)*baixo*uMusgo;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.26, 0.07)*(0.7 + n2.g*0.8), k);
        }
      `)
      .replace('#include <normal_fragment_maps>', /* glsl */`#include <normal_fragment_maps>
        normal = relevoN(-vViewPosition, normal, altPedra, uRelevo);
      `);
  };
  m.customProgramCacheKey = () => 'pedra';
  return m;
}

/* ------------------------------ madeira ------------------------------ */
let madeiraTex = null;
function texturasMadeira(){
  if(madeiraTex) return madeiraTex;
  const T = 512;
  const cor = document.createElement('canvas'); cor.width = cor.height = T;
  const alt = document.createElement('canvas'); alt.width = alt.height = T;
  const c = cor.getContext('2d'), a = alt.getContext('2d');
  const r = sorteador(31);
  c.fillStyle = '#cfcfcf'; c.fillRect(0, 0, T, T);
  a.fillStyle = '#909090'; a.fillRect(0, 0, T, T);
  // tábuas de tom ligeiramente diferente (o tingimento vem da cor do material)
  for(let i=0;i<90;i++){
    const y = r()*T, h = 1 + r()*5, v = 165 + r()*90;
    c.fillStyle = `rgba(${v},${v},${v},0.5)`;
    c.fillRect(0, y, T, h);
    const q = 70 + r()*110;
    a.fillStyle = `rgba(${q},${q},${q},0.6)`;
    a.fillRect(0, y, T, h);
  }
  // veios longos e tortinhos
  for(let i=0;i<150;i++){
    let y = r()*T;
    const v = 70 + r()*90;
    c.strokeStyle = `rgba(${v},${v},${v},${0.1 + r()*0.28})`;
    a.strokeStyle = `rgba(30,30,30,${0.1 + r()*0.3})`;
    const lw = 0.5 + r()*1.8;
    c.lineWidth = a.lineWidth = lw;
    c.beginPath(); a.beginPath();
    c.moveTo(0, y); a.moveTo(0, y);
    const amp = (r()-0.5)*7;
    for(let x=32; x<=T; x+=32){
      const yy = y + Math.sin(x/T*Math.PI*2*(1+Math.floor(r()*2)))*amp;
      c.lineTo(x, yy); a.lineTo(x, yy);
    }
    c.stroke(); a.stroke();
  }
  // nós de madeira
  for(let i=0;i<4;i++){
    const x = r()*T, y = r()*T, rr = 5 + r()*8;
    for(let k=4;k>=0;k--){
      const v = 80 + k*18;
      c.fillStyle = `rgba(${v},${v},${v},0.4)`;
      c.beginPath(); c.ellipse(x, y, rr*(k+1)*0.5, rr*(k+1)*0.28, 0, 0, Math.PI*2); c.fill();
    }
  }
  const map = new THREE.CanvasTexture(cor);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  madeiraTex = { map, normal: normalDeAltura(alt, 2.0) };
  return madeiraTex;
}
export function matMadeira(cor = 0x8a6a48, opts = {}){
  const { map, normal } = texturasMadeira();
  return new THREE.MeshStandardMaterial({
    color: cor, map, normalMap: normal, normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.82, metalness: 0, ...opts,
  });
}

/* UV em escala de mundo com a fibra ao longo do eixo X: as peças podem ter
   qualquer tamanho que o veio mantém a mesma densidade */
export function uvEscala(geo, esc = 0.7){
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let a, b;
    if(ax >= ay && ax >= az){ a = p.getZ(i); b = p.getY(i); }
    else if(ay >= az){ a = p.getX(i); b = p.getZ(i); }
    else { a = p.getX(i); b = p.getY(i); }
    uv[i*2] = a*esc; uv[i*2+1] = b*esc;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/* cilindro/torneado com a fibra ao longo da altura: troca U por V */
export function uvFibraVertical(geo, esc = 0.7){
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){
    uv[i*2] = p.getY(i)*esc;
    uv[i*2+1] = Math.atan2(p.getZ(i), p.getX(i))/(Math.PI*2)*0.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/* peça torneada a partir de um perfil [[raio, altura], ...] */
export function torneado(perfil, segs = 24){
  const pts = perfil.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, segs);
}

/* ------------------------------ brilho ------------------------------ */
let brilho = null;
export function texturaBrilho(){
  if(brilho) return brilho;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,226,170,1)');
  g.addColorStop(0.18, 'rgba(255,196,120,0.55)');
  g.addColorStop(0.5, 'rgba(255,170,90,0.14)');
  g.addColorStop(1, 'rgba(255,160,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  brilho = new THREE.CanvasTexture(c);
  brilho.colorSpace = THREE.SRGBColorSpace;
  return brilho;
}
