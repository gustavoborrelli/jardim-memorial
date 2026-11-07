/*
  ESCULTURA POR CAMPO DE DISTÂNCIA
  Em vez de empilhar esferas que se atravessam (de onde vinha o ar de "boneco de
  bolas"), cada forma orgânica é descrita por uma função: "a que distância este
  ponto está da superfície?". Primitivas se fundem com união suave, como argila,
  e a malha sai de uma só vez, contínua, com normais perfeitas. O custo é só na
  hora de montar (milissegundos), e a malha resultante fica em cache.

  Malha gerada por Surface Nets: mais simples que marching cubes e dá triângulos
  mais bem-comportados.
*/
import * as THREE from 'three';

/* --- primitivas: devolvem uma função (x,y,z) → distância, já com tudo pré-calculado --- */
export const esfera = (cx, cy, cz, r) => (x, y, z) => Math.hypot(x-cx, y-cy, z-cz) - r;

export const elipsoide = (cx, cy, cz, rx, ry, rz) => (x, y, z) => {
  const ax = (x-cx)/rx, ay = (y-cy)/ry, az = (z-cz)/rz;
  const k0 = Math.sqrt(ax*ax + ay*ay + az*az);
  const bx = ax/rx, by = ay/ry, bz = az/rz;
  const k1 = Math.sqrt(bx*bx + by*by + bz*bz);
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : k0*(k0-1)/k1;
};

/* cone de pontas arredondadas (iq): dois centros, dois raios */
export const cone = (a, b, r1, r2) => {
  const bax = b[0]-a[0], bay = b[1]-a[1], baz = b[2]-a[2];
  const l2 = bax*bax + bay*bay + baz*baz;
  const rr = r1-r2;
  const a2 = l2 - rr*rr;
  const il2 = 1/l2;
  return (x, y, z) => {
    const pax = x-a[0], pay = y-a[1], paz = z-a[2];
    const ya = pax*bax + pay*bay + paz*baz;
    const za = ya - l2;
    const qx = pax*l2 - bax*ya, qy = pay*l2 - bay*ya, qz = paz*l2 - baz*ya;
    const x2 = qx*qx + qy*qy + qz*qz;
    const y2 = ya*ya*l2;
    const z2 = za*za*l2;
    const k = Math.sign(rr)*rr*rr*x2;
    if(Math.sign(za)*a2*z2 > k) return Math.sqrt(x2+z2)*il2 - r2;
    if(Math.sign(ya)*a2*y2 < k) return Math.sqrt(x2+y2)*il2 - r1;
    return (Math.sqrt(x2*a2*il2) + ya*rr)*il2 - r1;
  };
};

/* corrente de cones: uma "linguiça" com vários raios */
export const corrente = (pontos, k = 0) => {
  const partes = [];
  for(let i=0;i<pontos.length-1;i++){
    partes.push(cone(pontos[i].slice(0, 3), pontos[i+1].slice(0, 3), pontos[i][3], pontos[i+1][3]));
  }
  return k > 0 ? uniaoSuave(partes, k) : (x, y, z) => {
    let d = 1e9;
    for(let i=0;i<partes.length;i++){ const v = partes[i](x, y, z); if(v < d) d = v; }
    return d;
  };
};

/* caixa de cantos arredondados */
export const caixa = (cx, cy, cz, hx, hy, hz, r = 0) => (x, y, z) => {
  const qx = Math.abs(x-cx) - hx + r, qy = Math.abs(y-cy) - hy + r, qz = Math.abs(z-cz) - hz + r;
  const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0);
  return Math.sqrt(mx*mx + my*my + mz*mz) + Math.min(Math.max(qx, qy, qz), 0) - r;
};

/* união suave (polinomial): k é o tamanho da "massa" que une as duas formas */
export const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a-b), 0)/k;
  return Math.min(a, b) - h*h*k*0.25;
};
export const uniaoSuave = (lista, k) => (x, y, z) => {
  let d = lista[0](x, y, z);
  for(let i=1;i<lista.length;i++) d = smin(d, lista[i](x, y, z), k);
  return d;
};
/* cada item: [forma, k] — k próprio por junção */
export const esculpir = (lista) => (x, y, z) => {
  let d = lista[0][0](x, y, z);
  for(let i=1;i<lista.length;i++){
    const [f, k] = lista[i];
    d = k > 0 ? smin(d, f(x, y, z), k) : Math.min(d, f(x, y, z));
  }
  return d;
};
export const subtrair = (a, b, k = 0.01) => (x, y, z) => {
  const da = a(x, y, z), db = -b(x, y, z);
  const h = Math.max(k - Math.abs(da-db), 0)/k;
  return Math.max(da, db) + h*h*k*0.25;
};
export const espelharX = (f) => (x, y, z) => f(Math.abs(x), y, z);

/*
  f: campo; caixa: [[x0,y0,z0],[x1,y1,z1]]; h: tamanho da célula
  opts.cor(x,y,z,out): preenche out[0..2]
  opts.atributos: { nome: (x,y,z) => número }, viram atributos de 1 componente
*/
export function malhaSDF(f, [[x0, y0, z0], [x1, y1, z1]], h, opts = {}){
  const nx = Math.ceil((x1-x0)/h)+1, ny = Math.ceil((y1-y0)/h)+1, nz = Math.ceil((z1-z0)/h)+1;
  const total = nx*ny*nz;
  const campo = new Float32Array(total);
  const I = (i, j, k) => i + nx*(j + ny*k);
  for(let k=0;k<nz;k++){
    const pz = z0 + k*h;
    for(let j=0;j<ny;j++){
      const py = y0 + j*h;
      for(let i=0;i<nx;i++){
        campo[I(i, j, k)] = f(x0 + i*h, py, pz);
      }
    }
  }
  const mapa = new Int32Array(total).fill(-1);
  const pos = [];
  const CANTOS = [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]];
  const ARESTAS = [[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
  const valores = new Float32Array(8);
  for(let k=0;k<nz-1;k++){
    for(let j=0;j<ny-1;j++){
      for(let i=0;i<nx-1;i++){
        let mask = 0;
        for(let c=0;c<8;c++){
          const [a, b, d] = CANTOS[c];
          const v = campo[I(i+a, j+b, k+d)];
          valores[c] = v;
          if(v < 0) mask |= 1<<c;
        }
        if(mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for(let e=0;e<12;e++){
          const [a, b] = ARESTAS[e];
          const va = valores[a], vb = valores[b];
          if((va < 0) === (vb < 0)) continue;
          const t = va/(va-vb);
          const ca = CANTOS[a], cb = CANTOS[b];
          sx += ca[0] + (cb[0]-ca[0])*t;
          sy += ca[1] + (cb[1]-ca[1])*t;
          sz += ca[2] + (cb[2]-ca[2])*t;
          n++;
        }
        mapa[I(i, j, k)] = pos.length/3;
        pos.push(x0 + (i + sx/n)*h, y0 + (j + sy/n)*h, z0 + (k + sz/n)*h);
      }
    }
  }
  const idx = [];
  const quad = (a, b, c, d, inverte) => {
    if(a < 0 || b < 0 || c < 0 || d < 0) return;
    if(inverte) idx.push(a, b, c, a, c, d);
    else idx.push(a, c, b, a, d, c);
  };
  for(let k=1;k<nz-1;k++){
    for(let j=1;j<ny-1;j++){
      for(let i=1;i<nx-1;i++){
        const v0 = campo[I(i, j, k)];
        const dentro = v0 < 0;
        const vx = campo[I(i+1, j, k)];
        if((vx < 0) !== dentro){
          quad(mapa[I(i, j-1, k-1)], mapa[I(i, j, k-1)], mapa[I(i, j, k)], mapa[I(i, j-1, k)], dentro);
        }
        const vy = campo[I(i, j+1, k)];
        if((vy < 0) !== dentro){
          quad(mapa[I(i-1, j, k-1)], mapa[I(i-1, j, k)], mapa[I(i, j, k)], mapa[I(i, j, k-1)], dentro);
        }
        const vz = campo[I(i, j, k+1)];
        if((vz < 0) !== dentro){
          quad(mapa[I(i-1, j-1, k)], mapa[I(i, j-1, k)], mapa[I(i, j, k)], mapa[I(i-1, j, k)], dentro);
        }
      }
    }
  }
  const nv = pos.length/3;
  const posicoes = new Float32Array(pos);
  const normais = new Float32Array(nv*3);
  const e = h*0.5;
  for(let i=0;i<nv;i++){
    const x = posicoes[i*3], y = posicoes[i*3+1], z = posicoes[i*3+2];
    const gx = f(x+e, y, z) - f(x-e, y, z);
    const gy = f(x, y+e, z) - f(x, y-e, z);
    const gz = f(x, y, z+e) - f(x, y, z-e);
    const il = 1/(Math.hypot(gx, gy, gz) || 1);
    normais[i*3] = gx*il; normais[i*3+1] = gy*il; normais[i*3+2] = gz*il;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normais, 3));
  if(opts.cor){
    const cores = new Float32Array(nv*3);
    const o = [1, 1, 1];
    for(let i=0;i<nv;i++){
      opts.cor(posicoes[i*3], posicoes[i*3+1], posicoes[i*3+2], o);
      cores[i*3] = o[0]; cores[i*3+1] = o[1]; cores[i*3+2] = o[2];
    }
    g.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  }
  if(opts.atributos){
    Object.entries(opts.atributos).forEach(([nome, fn]) => {
      const a = new Float32Array(nv);
      for(let i=0;i<nv;i++) a[i] = fn(posicoes[i*3], posicoes[i*3+1], posicoes[i*3+2]);
      g.setAttribute(nome, new THREE.BufferAttribute(a, 1));
    });
  }
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
