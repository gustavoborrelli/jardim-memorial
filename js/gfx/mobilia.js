/*
  MOBÍLIA DO JARDIM
  Cerca, portão, bancos, postes, jardineiras, vasos e o piso da praça. As peças
  repetidas são instanciadas (12 bancos = 1 chamada de desenho); nada de canto
  vivo: toda peça tem chanfro, porque é o chanfro pegando luz que separa um
  objeto de verdade de uma caixa de computação gráfica.
*/
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sorteador, normalDeAltura } from './ruido.js';
import { matMadeira, matPedra, uvEscala, uvFibraVertical, torneado, texturaBrilho } from './materiais.js';

/* caixa chanfrada, com fibra ao longo do comprimento (eixo X) */
function tabua(x, y, z, raio = 0.018){
  const g = new RoundedBoxGeometry(x, y, z, 2, Math.min(raio, Math.min(x, y, z)*0.45));
  uvEscala(g);
  return g;
}
function pintar(geo, hex){
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const a = new Float32Array(n*3);
  for(let i=0;i<n;i++){ a[i*3] = c.r; a[i*3+1] = c.g; a[i*3+2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
const emNaoIndexado = (g) => (g.index ? g.toNonIndexed() : g);
function juntar(lista){ return mergeGeometries(lista.map(emNaoIndexado)); }

/* ---------- banco ---------- */
function geoBanco(){
  const partes = [];
  const MAD = 0xb08d62, ESC = 0x4a443e;
  for(let i=0;i<4;i++){
    const s = tabua(1.62, 0.045, 0.115);
    s.translate(0, 0.455, -0.2 + i*0.135);
    partes.push(pintar(s, MAD));
  }
  for(let i=0;i<3;i++){
    const s = tabua(1.62, 0.1, 0.035);
    s.rotateX(-0.2);
    s.translate(0, 0.62 + i*0.135, -0.285 - i*0.027);
    partes.push(pintar(s, MAD));
  }
  // laterais de ferro fundido: pé curvo e braço numa peça só
  [-0.74, 0.74].forEach(x => {
    const perna = (pts, r) => {
      const curva = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(x, p[0], p[1])));
      return pintar(new THREE.TubeGeometry(curva, 18, r, 7, false), ESC);
    };
    partes.push(perna([[0.0, 0.2], [0.22, 0.17], [0.44, 0.14]], 0.024));
    partes.push(perna([[0.0, -0.24], [0.22, -0.21], [0.44, -0.2], [0.72, -0.26], [0.88, -0.32]], 0.024));
    partes.push(perna([[0.44, 0.14], [0.56, 0.18], [0.67, 0.14], [0.68, 0.0], [0.67, -0.16], [0.68, -0.24]], 0.02));
    // sapatinhas: encostam o pé no chão
    const sap = new THREE.SphereGeometry(0.038, 8, 6); sap.scale(1, 0.5, 1.5); sap.translate(x, 0.015, 0.2);
    const sap2 = sap.clone(); sap2.translate(0, 0, -0.44);
    partes.push(pintar(sap, ESC), pintar(sap2, ESC));
  });
  return juntar(partes);
}

/* ---------- jardineira ---------- */
function geoJardineira(){
  const corpo = new RoundedBoxGeometry(0.6, 0.24, 1, 3, 0.035);
  corpo.translate(0, 0.12, 0);
  const borda = new RoundedBoxGeometry(0.68, 0.05, 1.03, 3, 0.022);
  borda.translate(0, 0.25, 0);
  const pes = [];
  [-0.4, 0.4].forEach(z => {
    const p = new THREE.BoxGeometry(0.62, 0.02, 0.09); p.translate(0, 0.01, z);
    pes.push(p);
  });
  return juntar([corpo, borda, ...pes]);
}

/* ---------- piso da praça: pedras desenhadas uma a uma, com relevo ---------- */
function texturasPraca(tam){
  const cor = document.createElement('canvas'); cor.width = cor.height = tam;
  const alt = document.createElement('canvas'); alt.width = alt.height = tam;
  const c = cor.getContext('2d'), a = alt.getContext('2d');
  const r = sorteador(404);
  const cx = tam/2, esc = tam/2/5.5;
  c.fillStyle = '#6f6452'; c.fillRect(0, 0, tam, tam);
  a.fillStyle = '#101010'; a.fillRect(0, 0, tam, tam);
  const tons = [[204,190,164],[189,174,150],[216,202,176],[176,165,146],[196,178,152],[210,190,160],[184,172,158]];
  // anéis de pedras: largura e comprimento variam um pouco por anel
  let raio = 2.15;
  while(raio < 5.5){
    const larg = 0.34 + r()*0.07;
    const comprimento = 0.46 + r()*0.12;
    const circ = 2*Math.PI*(raio+larg/2);
    const n = Math.max(6, Math.round(circ/comprimento));
    const off = r()*Math.PI*2;
    const passo = Math.PI*2/n;
    for(let i=0;i<n;i++){
      const a0 = off + i*passo + (r()-0.5)*0.012;
      const a1 = a0 + passo*(0.965 - r()*0.03);
      const rI = (raio + 0.012)*esc, rE = (raio + larg - 0.012)*esc;
      const t = tons[Math.floor(r()*tons.length)];
      const v = 0.93 + r()*0.15;
      // pedra: setor de anel com cantos ligeiramente arredondados
      const caminho = (ctx) => {
        ctx.beginPath();
        ctx.arc(cx, cx, rE, a0, a1);
        ctx.arc(cx, cx, rI, a1, a0, true);
        ctx.closePath();
      };
      c.lineJoin = a.lineJoin = 'round';
      c.lineWidth = a.lineWidth = 3*tam/2048;
      caminho(c);
      c.fillStyle = c.strokeStyle = `rgb(${t[0]*v},${t[1]*v},${t[2]*v})`;
      c.fill(); c.stroke();
      // borda clara/escura de cada pedra
      const h = 150 + r()*90;
      caminho(a);
      a.fillStyle = a.strokeStyle = `rgb(${h},${h},${h})`;
      a.fill();
      // grão e desgaste por pedra
      for(let k=0;k<7;k++){
        const aa = a0 + r()*(a1-a0), rr = rI + r()*(rE-rI);
        const claro = r() < 0.5;
        c.fillStyle = claro ? `rgba(245,232,205,${0.05 + r()*0.08})` : `rgba(70,60,50,${0.05 + r()*0.07})`;
        c.beginPath(); c.arc(cx + Math.cos(aa)*rr, cx + Math.sin(aa)*rr, (2 + r()*9)*tam/2048, 0, Math.PI*2); c.fill();
      }
    }
    raio += larg;
  }
  const map = new THREE.CanvasTexture(cor);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return { map, normal: normalDeAltura(alt, 2.6) };
}

export function criarMobilia(scene, { perfil, PLAZA, flores, bancos, lampadas, LUZES, cerca, portao, vasos }){
  const r = sorteador(321);
  const madeira = matMadeira(0xffffff, { vertexColors: true });
  const madeiraCerca = matMadeira(0x7d6048);
  const ferro = new THREE.MeshStandardMaterial({ color: 0x2b2a2c, roughness: 0.48, metalness: 0.75 });
  const terracota = matPedra({ cor: 0xc98a68, escala: 5, relevo: 0.004, manchas: 0.42, rugosidade: 0.88 });

  /* ---------- BANCOS ---------- */
  {
    const im = new THREE.InstancedMesh(geoBanco(), madeira, bancos.length);
    const d = new THREE.Object3D();
    bancos.forEach((b, i) => {
      d.position.set(b.x, 0, b.z);
      d.rotation.set(0, b.rot, 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    scene.add(im);
  }

  /* ---------- CERCA ---------- */
  const birdPerches = [];
  {
    const postos = [];
    const trilhos = [];
    const adicionar = (x1, z1, x2, z2) => {
      const len = Math.hypot(x2-x1, z2-z1);
      const n = Math.round(len/3);
      for(let i=0;i<=n;i++){
        const t = i/n;
        const px = x1+(x2-x1)*t, pz = z1+(z2-z1)*t;
        postos.push({ x: px, z: pz, r: r()*6.283, e: 0.97 + r()*0.06 });
        if(i%3 === 0) birdPerches.push({ x: px, y: 1.47, z: pz });
      }
      const ang = Math.atan2(z2-z1, x2-x1);
      [0.95, 0.55].forEach((y) => {
        const g = tabua(len, 0.085, 0.05, 0.02);
        g.rotateY(-ang);
        g.translate((x1+x2)/2, y, (z1+z2)/2);
        trilhos.push(g);
      });
    };
    cerca.forEach(c => adicionar(...c));

    const perfilPosto = [
      [0.0, 0], [0.105, 0], [0.11, 0.05], [0.092, 0.12], [0.085, 1.16], [0.1, 1.2], [0.105, 1.22], [0.082, 1.25],
      [0.075, 1.27], [0.098, 1.32], [0.104, 1.36], [0.09, 1.41], [0.05, 1.45], [0, 1.46],
    ];
    const geoPosto = torneado(perfilPosto, 10);
    uvFibraVertical(geoPosto);
    const im = new THREE.InstancedMesh(geoPosto, madeiraCerca, postos.length);
    const d = new THREE.Object3D();
    postos.forEach((p, i) => {
      d.position.set(p.x, 0, p.z);
      d.rotation.y = p.r;
      d.scale.setScalar(p.e);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    scene.add(im);

    const m = new THREE.Mesh(juntar(trilhos), madeiraCerca);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }

  /* ---------- PORTÃO ---------- */
  {
    const partes = [];
    const perfilPila = [
      [0, 0], [0.19, 0], [0.2, 0.08], [0.16, 0.14], [0.135, 0.24], [0.125, 1.9], [0.16, 1.96], [0.165, 2.02],
      [0.12, 2.06], [0.11, 2.1], [0.15, 2.16], [0.16, 2.22], [0.13, 2.3], [0.06, 2.35], [0, 2.36],
    ];
    portao.pilares.forEach(([x, z]) => {
      const g = torneado(perfilPila, 14);
      uvFibraVertical(g);
      g.translate(x, 0, z);
      partes.push(g);
    });
    // arco suave em vez de uma viga reta: convida a entrar
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.4, 2.02, portao.z), new THREE.Vector3(-1.2, 2.36, portao.z),
      new THREE.Vector3(0, 2.48, portao.z), new THREE.Vector3(1.2, 2.36, portao.z), new THREE.Vector3(2.4, 2.02, portao.z),
    ]);
    const arco = new THREE.TubeGeometry(curva, 30, 0.075, 8, false);
    uvFibraVertical(arco);
    partes.push(arco);
    const m = new THREE.Mesh(juntar(partes), madeiraCerca);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }

  /* ---------- POSTES DE LUZ ---------- */
  const lampHeadMats = [];
  const lampGlows = [];
  const lampLuzes = [];
  {
    const geoPoste = mergeGeometries([
      torneado([
        [0, 0], [0.17, 0], [0.18, 0.04], [0.12, 0.09], [0.1, 0.2], [0.07, 0.3], [0.055, 0.5], [0.042, 2.2],
        [0.06, 2.24], [0.07, 2.27], [0.05, 2.3], [0.09, 2.33], [0.12, 2.37], [0, 2.37],
      ], 14),
      (() => {
        const c = new THREE.SphereGeometry(0.2, 18, 10, 0, Math.PI*2, 0, Math.PI*0.42);
        c.translate(0, 2.68, 0);
        return c;
      })(),
      (() => {
        const b = new THREE.SphereGeometry(0.035, 10, 8);
        b.translate(0, 2.885, 0);
        return b;
      })(),
    ].map(g => { const h = g.index ? g.toNonIndexed() : g; h.deleteAttribute('uv'); return h; }));
    const postes = new THREE.InstancedMesh(geoPoste, ferro, lampadas.length);
    const d = new THREE.Object3D();
    lampadas.forEach((l, i) => {
      d.position.set(l.x, 0, l.z);
      d.rotation.y = r()*6.28;
      d.updateMatrix();
      postes.setMatrixAt(i, d.matrix);
    });
    postes.castShadow = true;
    postes.computeBoundingSphere();
    scene.add(postes);

    const geoGlobo = new THREE.SphereGeometry(0.19, 22, 14);
    geoGlobo.translate(0, 2.55, 0);
    const matGlobo = new THREE.MeshStandardMaterial({
      color: 0xfff1d8, roughness: 0.4, emissive: 0xffc27a, emissiveIntensity: 0.5,
    });
    lampHeadMats.push(matGlobo);
    const globos = new THREE.InstancedMesh(geoGlobo, matGlobo, lampadas.length);
    lampadas.forEach((l, i) => {
      d.position.set(l.x, 0, l.z); d.rotation.y = 0; d.updateMatrix();
      globos.setMatrixAt(i, d.matrix);
    });
    globos.computeBoundingSphere();
    scene.add(globos);

    const tex = texturaBrilho();
    lampadas.forEach(l => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffc98d,
      }));
      s.scale.set(2.6, 2.6, 1);
      s.position.set(l.x, 2.55, l.z);
      s.userData.semAO = true;
      scene.add(s);
      lampGlows.push(s);
      if(LUZES){
        const luz = new THREE.PointLight(0xffb36b, 0, 11, 1.7);
        luz.position.set(l.x, 2.4, l.z);
        scene.add(luz);
        lampLuzes.push(luz);
      }
    });
  }

  /* ---------- JARDINEIRAS DAS AVENIDAS ---------- */
  const BED_H = 0.27;
  const EDGE = 2.55;
  const RUNS_NS = [[6.6,10.3],[13.7,17.1],[18.9,25.6]];
  const RUNS_EW = [[6.6,11.1],[12.9,17.1],[18.9,25.6]];
  const caixas = [];
  const florDeCanteiro = [];
  {
    const CORES = [0xe8446f, 0xf7cf1f, 0xfff8ee, 0xa74bd4, 0xff7f30, 0x5ea9ff];
    const addRun = (alongZ, sign, edge, a, b) => {
      const len = b-a;
      const n = Math.max(1, Math.round(len/2.6));
      const boxLen = (len - (n-1)*0.35)/n;
      for(let i=0;i<n;i++){
        const start = a + i*(boxLen+0.35);
        const mid = sign*(start + boxLen/2);
        caixas.push(alongZ ? { x: edge, z: mid, len: boxLen, alongZ } : { x: mid, z: edge, len: boxLen, alongZ });
        // canteiro em blocos de cor (como se planta de verdade, não mistura aleatória)
        let d = start + 0.2;
        let corAtual = CORES[Math.floor(r()*CORES.length)], resta = 3 + Math.floor(r()*3);
        while(d < start + boxLen - 0.14){
          if(resta-- <= 0){
            let nova;
            do { nova = CORES[Math.floor(r()*CORES.length)]; } while(nova === corAtual);
            corAtual = nova;
            resta = 3 + Math.floor(r()*3);
          }
          [(-0.14 + (r()-0.5)*0.06), (0.14 + (r()-0.5)*0.06)].forEach((lado, k) => {
            const along = sign*(d + k*0.12);
            const off = edge + lado;
            florDeCanteiro.push({
              x: alongZ ? off : along, z: alongZ ? along : off, y: BED_H - 0.015, cor: corAtual,
              escala: 0.78 + r()*0.28,
            });
          });
          d += 0.23 + r()*0.06;
        }
      }
    };
    [1, -1].forEach(sign => {
      [-EDGE, EDGE].forEach(edge => {
        RUNS_NS.forEach(([a, b]) => addRun(true, sign, edge, a, b));
        RUNS_EW.forEach(([a, b]) => addRun(false, sign, edge, a, b));
      });
    });

    const im = new THREE.InstancedMesh(geoJardineira(), terracota, caixas.length);
    const solo = new THREE.InstancedMesh(
      (() => {
        const g = new THREE.BoxGeometry(0.55, 0.04, 1, 4, 1, 8);
        const p = g.attributes.position;
        for(let i=0;i<p.count;i++){
          if(p.getY(i) > 0) p.setY(i, p.getY(i) + (r()-0.5)*0.022);
        }
        g.computeVertexNormals();
        return g;
      })(),
      matPedra({ cor: 0x352415, escala: 7, relevo: 0.05, manchas: 0.5, rugosidade: 1 }),
      caixas.length
    );
    const d = new THREE.Object3D();
    caixas.forEach((b, i) => {
      d.position.set(b.x, 0, b.z);
      d.rotation.set(0, b.alongZ ? 0 : Math.PI/2, 0);
      d.scale.set(1, 1, b.len);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
      d.position.y = BED_H - 0.012;
      d.scale.set(1, 1, b.len - 0.05);
      d.updateMatrix();
      solo.setMatrixAt(i, d.matrix);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    solo.receiveShadow = true;
    im.computeBoundingSphere();
    solo.computeBoundingSphere();
    scene.add(im, solo);
    flores.instanciar(florDeCanteiro, { semente: 88, sombra: perfil.nome === 'alto' });
  }

  /* ---------- PISO DA PRAÇA ---------- */
  {
    const { map, normal } = texturasPraca(perfil.nome === 'baixo' ? 1024 : 2048);
    const piso = new THREE.Mesh(
      new THREE.CircleGeometry(PLAZA.r, 72),
      new THREE.MeshStandardMaterial({ map, color: 0xf3e4c8, normalMap: normal, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.92 })
    );
    piso.rotation.x = -Math.PI/2;
    piso.position.set(PLAZA.x, 0.025, PLAZA.z);
    piso.receiveShadow = true;
    scene.add(piso);

    // meio-fio arredondado: dá borda real entre a pedra e o cascalho
    const fio = new THREE.Mesh(
      torneado([[PLAZA.r+0.22, 0.0], [PLAZA.r+0.2, 0.06], [PLAZA.r+0.12, 0.09], [PLAZA.r+0.02, 0.085], [PLAZA.r-0.02, 0.05], [PLAZA.r-0.02, 0.0]], 72),
      matPedra({ cor: 0xbdb3a1, escala: 2.6, relevo: 0.006, musgo: 0.3, alturaMusgo: 0.1, manchas: 0.32 })
    );
    fio.position.set(PLAZA.x, 0, PLAZA.z);
    fio.receiveShadow = true;
    scene.add(fio);
  }

  /* ---------- VASOS DA PRAÇA ---------- */
  const moitas = [];
  {
    const geoVaso = torneado([
      [0, 0.0], [0.19, 0.0], [0.2, 0.03], [0.24, 0.18], [0.3, 0.36], [0.33, 0.39], [0.345, 0.43], [0.34, 0.47], [0.3, 0.47], [0.29, 0.42], [0, 0.42],
    ], 24);
    const im = new THREE.InstancedMesh(geoVaso, terracota, vasos.length);
    const d = new THREE.Object3D();
    const floresVaso = [];
    const COR = [0xff6fa5, 0xffc93c, 0xff8a3d, 0xb14fd8, 0xffffff, 0xff5577];
    vasos.forEach((v, i) => {
      d.position.set(v.x, 0.03, v.z);
      d.rotation.y = r()*6.28;
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
      moitas.push({ x: v.x, z: v.z, y: 0.76, escala: 1.0, tipo: 'moita' });
      for(let k=0;k<9;k++){
        const a = r()*6.283, rd = 0.08 + r()*0.28;
        floresVaso.push({ x: v.x+Math.cos(a)*rd, z: v.z+Math.sin(a)*rd, y: 0.62 + r()*0.08, cor: COR[Math.floor(r()*COR.length)], escala: 0.72 + r()*0.2 });
      }
    });
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    scene.add(im);
    flores.instanciar(floresVaso, { semente: 21, sombra: perfil.nome === 'alto' });
  }

  return { birdPerches, lampHeadMats, lampGlows, lampLuzes, moitas, caixas, BED_H };
}
