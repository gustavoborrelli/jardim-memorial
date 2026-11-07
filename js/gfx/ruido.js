/*
  RUÍDO
  Base de tudo que é procedural no jardim. Uma única textura de ruído
  "ladrilhável" é compartilhada por céu, chão, grama, pedra e água (lookup de
  textura é muito mais barato em celular do que calcular fbm no shader), e as
  mesmas ideias existem em JS pra quem precisa do valor na hora de construir.
*/
import * as THREE from 'three';

/* PRNG com semente: quem constrói o cenário usa isso em vez de Math.random,
   pra o jardim ser o mesmo em toda visita e em toda máquina */
export function sorteador(semente = 1){
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, z){
  const h = Math.sin(x*127.1 + z*311.7) * 43758.5453;
  return h - Math.floor(h);
}

export const suave = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x-a)/(b-a)));
  return t*t*(3-2*t);
};

/* value noise contínuo, em JS */
export function vnoise(x, z){
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x-xi, zf = z-zi;
  const u = xf*xf*(3-2*xf), v = zf*zf*(3-2*zf);
  const a = hash2(xi, zi), b = hash2(xi+1, zi), c = hash2(xi, zi+1), d = hash2(xi+1, zi+1);
  return a + (b-a)*u + (c-a)*v + (a-b-c+d)*u*v;
}
export function fbm(x, z, oitavas = 4){
  let s = 0, amp = 0.5, tot = 0;
  for(let i=0;i<oitavas;i++){
    s += vnoise(x, z)*amp; tot += amp;
    x = x*2.03 + 17.1; z = z*2.03 + 9.2;
    amp *= 0.5;
  }
  return s/tot;
}

/* --- textura ladrilhável --- */
function ruidoPeriodico(grade, u, v, periodo, n){
  const x = u*periodo, y = v*periodo;
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x-xi, yf = y-yi;
  const sx = xf*xf*(3-2*xf), sy = yf*yf*(3-2*yf);
  const g = (a, b) => grade[((((a%periodo)+periodo)%periodo)*7919 + ((b%periodo)+periodo)%periodo*104729) & (n-1)];
  const a = g(xi, yi), b = g(xi+1, yi), c = g(xi, yi+1), d = g(xi+1, yi+1);
  return a + (b-a)*sx + (c-a)*sy + (a-b-c+d)*sx*sy;
}
function celularPeriodico(pontos, u, v, periodo){
  const x = u*periodo, y = v*periodo;
  const xi = Math.floor(x), yi = Math.floor(y);
  let min = 9;
  for(let j=-1;j<=1;j++) for(let i=-1;i<=1;i++){
    const cx = ((xi+i)%periodo+periodo)%periodo, cy = ((yi+j)%periodo+periodo)%periodo;
    const p = pontos[cy*periodo + cx];
    const dx = xi+i+p[0]-x, dy = yi+j+p[1]-y;
    const d = dx*dx+dy*dy;
    if(d < min) min = d;
  }
  return Math.sqrt(min);
}

let texturaCompartilhada = null;

/* R: fbm largo · G: fbm fino · B: celular (pedrinhas, escamas) · A: ruído branco */
export function texturaRuido(){
  if(texturaCompartilhada) return texturaCompartilhada;
  const N = 256;
  const r = sorteador(4242);
  const tam = 65536;
  const grade = new Float32Array(tam);
  for(let i=0;i<tam;i++) grade[i] = r();
  const periodoCel = 14;
  const pontos = [];
  for(let i=0;i<periodoCel*periodoCel;i++) pontos.push([r(), r()]);

  const dados = new Uint8Array(N*N*4);
  for(let y=0;y<N;y++){
    for(let x=0;x<N;x++){
      const u = x/N, v = y/N;
      let largo = 0, a = 0.5, tot = 0;
      for(let o=0, p=4; o<5; o++, p*=2){ largo += ruidoPeriodico(grade, u, v, p, tam)*a; tot += a; a *= 0.5; }
      largo /= tot;
      let fino = 0; a = 0.5; tot = 0;
      for(let o=0, p=24; o<3; o++, p*=2){ fino += ruidoPeriodico(grade, u, v, p, tam)*a; tot += a; a *= 0.5; }
      fino /= tot;
      const cel = Math.min(1, celularPeriodico(pontos, u, v, periodoCel)*1.25);
      const i = (y*N+x)*4;
      // o fbm concentra em volta de 0.5: estica pra usar a faixa toda
      dados[i]   = Math.max(0, Math.min(255, ((largo-0.5)*1.9+0.5)*255));
      dados[i+1] = Math.max(0, Math.min(255, ((fino-0.5)*1.9+0.5)*255));
      dados[i+2] = cel*255;
      dados[i+3] = r()*255;
    }
  }
  const t = new THREE.DataTexture(dados, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  texturaCompartilhada = t;
  return t;
}

/* gera uma textura de normais a partir de um canvas de altura (tons de cinza) */
export function normalDeAltura(canvas, forca = 2){
  const w = canvas.width, h = canvas.height;
  const src = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const alt = (x, y) => src[(((y+h)%h)*w + ((x+w)%w))*4]/255;
  const dados = new Uint8Array(w*h*4);
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const dx = (alt(x+1, y)-alt(x-1, y))*forca;
      const dy = (alt(x, y+1)-alt(x, y-1))*forca;
      const il = 1/Math.sqrt(dx*dx+dy*dy+1);
      const i = (y*w+x)*4;
      dados[i]   = (-dx*il*0.5+0.5)*255;
      dados[i+1] = (-dy*il*0.5+0.5)*255;
      dados[i+2] = (il*0.5+0.5)*255;
      dados[i+3] = 255;
    }
  }
  const t = new THREE.DataTexture(dados, w, h, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}
