/*
  A PONTE DO ARCO-ÍRIS (etapa 39)
  Liga os jardins. Sai de um patamar de pedra na beira de cada jardim (no Memorial,
  logo depois do portão; no Lago, a sudeste, depois do arco de boas-vindas) e sobe
  em arco por cima da mata até sumir numas nuvens. Vista de dentro do jardim, é um
  arco-íris de verdade no céu; de perto, um caminho de seis faixas de cor, com o
  brilho correndo por ele.

  Em planta ela sai reta do patamar e vai virando para um lado num arco de círculo
  enquanto sobe: indo reto para longe de quem olha, parecia uma torre; virando, se
  vê o arco de lado. A altura em cada ponto sai de uma conta só (alturaDaPonte): o
  cachorro que atravessa anda exatamente em cima dela.
*/
import * as THREE from 'three';
import { matPedra } from './materiais.js';
import { sorteador } from './ruido.js';

// as cores do arco-íris do esboço, de fora (vermelho) para dentro (violeta)
const NUVEM_DE_NOITE = new THREE.Color(0x515c8f);
const corNuvem = new THREE.Color();
const CORES = [0xe8706b, 0xf0a54f, 0xf3d36b, 0x8cc77d, 0x79b1dd, 0xa98ad4].map(c => new THREE.Color(c));
export const FORMA_DA_PONTE = { altura: 22, alcance: 55, largura: 2.6, comeco: 1.2, patamar: 0.07, curva: 26 };

// altura do caminho a `d` metros do começo: parábola que sobe e se deita lá no alto,
// com o começo suavizado para o primeiro passo não ser um degrau
export function alturaDaPonte(d){
  const { altura, alcance, patamar } = FORMA_DA_PONTE;
  if(d <= 0) return patamar;
  const u = Math.min(1, d/alcance);
  const t = Math.min(1, u/0.18), suave = t*t*(3 - 2*t);
  return patamar + altura*(1 - (1 - u)*(1 - u))*suave;
}

/* nuvem pintada num canvas: vários círculos macios encavalados, base mais reta */
function texturaNuvem(semente){
  const T = 256;
  const c = document.createElement('canvas'); c.width = c.height = T;
  const x = c.getContext('2d');
  const r = sorteador(semente);
  for(let i = 0; i < 34; i++){
    // bolhas maiores no meio e em cima, menores nas pontas: cara de cúmulo
    const k = r(), px = T*(0.14 + k*0.72), meio = 1 - Math.abs(k - 0.5)*2;
    const raio = T*(0.06 + r()*0.1 + meio*0.09), py = T*0.62 - raio*(0.4 + r()*0.9);
    const g = x.createRadialGradient(px, py - raio*0.2, raio*0.1, px, py, raio);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.72, 'rgba(250,251,253,0.92)');
    g.addColorStop(0.9, 'rgba(244,246,250,0.55)');
    g.addColorStop(1, 'rgba(240,242,248,0)');
    x.fillStyle = g;
    x.beginPath(); x.arc(px, py, raio, 0, Math.PI*2); x.fill();
  }
  // a parte de baixo mais azulada e sombreada: é o que dá volume de nuvem de verdade
  x.globalCompositeOperation = 'source-atop';
  const sombra = x.createLinearGradient(0, T*0.28, 0, T*0.66);
  sombra.addColorStop(0, 'rgba(255,255,255,0)');
  sombra.addColorStop(1, 'rgba(172,184,208,0.62)');
  x.fillStyle = sombra;
  x.fillRect(0, 0, T, T);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* pe: { x, z, y?, rumo: [dx, dz], raio, vira } — o centro do patamar (y: o chão ali),
   para onde a ponte sai e para que lado ela vira (+1 ou -1) */
export function criarPonte(scene, { pe, perfil }){
  const grupo = new THREE.Group();
  scene.add(grupo);
  const [rx, rz] = pe.rumo;
  const vira = pe.vira || 1, R = FORMA_DA_PONTE.curva;
  const lx = -rz*vira, lz = rx*vira; // para onde ela vira, em planta
  const sx = pe.x + rx*FORMA_DA_PONTE.comeco, sz = pe.z + rz*FORMA_DA_PONTE.comeco;
  const cx = sx + lx*R, cz = sz + lz*R; // o centro do arco em planta
  // o ponto do meio do caminho a `d` metros do começo, e o "para fora" ali
  const noCaminho = (d) => { const f = d/R; return [sx + rx*R*Math.sin(f) + lx*R*(1 - Math.cos(f)), sz + rz*R*Math.sin(f) + lz*R*(1 - Math.cos(f))]; };
  const paraFora = (d) => { const [x, z] = noCaminho(d); return [(x - cx)/R, (z - cz)/R]; };
  const doComeco = (x, z) => { const vx = x - cx, vz = z - cz; return Math.atan2(vx*rx + vz*rz, -(vx*lx + vz*lz))*R; };
  const uTempo = { value: 0 }, uBrilho = { value: 0.2 };
  const base = pe.y || 0;

  /* ---------- o patamar de pedra ---------- */
  {
    const pedra = matPedra({ cor: 0xd9cfbf, escala: 2.2, relevo: 0.006, musgo: 0.25, alturaMusgo: 0.04, manchas: 0.3 });
    const disco = new THREE.Mesh(new THREE.CylinderGeometry(pe.raio, pe.raio + 0.08, FORMA_DA_PONTE.patamar, 48), pedra);
    disco.position.set(pe.x, base + FORMA_DA_PONTE.patamar/2 - 0.03, pe.z);
    disco.receiveShadow = true;
    grupo.add(disco);
    // um anel com as cores do arco-íris embutido na pedra, de onde a ponte nasce
    const anel = new THREE.Mesh(
      new THREE.RingGeometry(pe.raio - 0.42, pe.raio - 0.3, 72),
      new THREE.MeshStandardMaterial({ color: 0xf3e3c4, roughness: 0.4, emissive: 0xffe2b0, emissiveIntensity: 0.25 }),
    );
    anel.rotation.x = -Math.PI/2;
    anel.position.set(pe.x, base + FORMA_DA_PONTE.patamar + 0.004 - 0.03, pe.z);
    grupo.add(anel);
  }

  /* ---------- o caminho de arco-íris ----------
     Uma faixa de luz, não uma tábua pintada: as cores passam uma na outra pela
     largura (do vermelho, por fora, ao violeta), as beiradas se desfazem, ela tem
     luz própria e deixa ver um pouco do céu através; mais alto, fica mais clara e
     some. Não faz sombra no chão: é luz. */
  {
    const N = 160, COLS = 31, L = FORMA_DA_PONTE.largura;
    const comprimento = FORMA_DA_PONTE.alcance*0.78;
    const pos = [], cor = [], aT = [], aW = [], idx = [];
    const espectro = (f) => {
      const x = f*(CORES.length - 1), a = Math.floor(x), b = Math.min(CORES.length - 1, a + 1);
      return CORES[a].clone().lerp(CORES[b], x - a);
    };
    for(let i = 0; i <= N; i++){
      const d = i/N*comprimento, y = base + alturaDaPonte(d) - 0.03;
      const [px, pz] = noCaminho(d), [ox, oz] = paraFora(d);
      for(let j = 0; j < COLS; j++){
        const f = j/(COLS - 1), w = (f - 0.5)*L;
        // um leve abaulado: o meio um tiquinho acima das beiradas
        pos.push(px + ox*w, y + 0.05*(1 - (2*f - 1)*(2*f - 1)), pz + oz*w);
        const c = espectro(f);
        cor.push(c.r, c.g, c.b);
        aT.push(d/comprimento);
        aW.push(2*f - 1);
      }
    }
    for(let i = 0; i < N; i++) for(let j = 0; j < COLS - 1; j++){
      const a = i*COLS + j, b = a + COLS;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
    geo.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
    geo.setAttribute('aW', new THREE.Float32BufferAttribute(aW, 1));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // sem escrever profundidade: as nuvens são desenhadas antes e a faixa de luz passa
    // por cima delas; escrevendo, a beirada quase transparente cortava as nuvens de trás
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    mat.onBeforeCompile = (s) => {
      s.uniforms.uTempo = uTempo;
      s.uniforms.uBrilho = uBrilho;
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aT, aW;\nvarying float vT, vW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvT = aT; vW = aW;');
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTempo, uBrilho;\nvarying float vT, vW;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          // as beiradas se desfazem; o meio tem um véu claro, como a luz de um arco-íris
          float beira = 1.0 - smoothstep(0.55, 1.0, abs(vW));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), 0.06*(1.0 - abs(vW)));
          diffuseColor.a *= beira*mix(0.96, 0.72, smoothstep(0.12, 0.55, vT))*(1.0 - smoothstep(0.48, 0.84, vT));`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          // luz própria (mais forte à noite) e um brilho fino que corre subindo
          float corre = pow(max(sin(vT*38.0 - uTempo*1.8), 0.0), 24.0);
          totalEmissiveRadiance += diffuseColor.rgb*(0.45 + uBrilho + corre*0.3);`);
    };
    const malha = new THREE.Mesh(geo, mat);
    malha.castShadow = false;
    malha.receiveShadow = true;
    malha.renderOrder = 1;
    malha.userData.semAO = true;
    grupo.add(malha);
  }

  /* ---------- as nuvens onde ela some, lá no alto ---------- */
  const nuvens = [];
  {
    const r = sorteador(77);
    const texturas = [texturaNuvem(3), texturaNuvem(9), texturaNuvem(21), texturaNuvem(33)];
    const comprimento = FORMA_DA_PONTE.alcance*0.78, L = FORMA_DA_PONTE.largura;
    const ponto = (d, w) => {
      const dd = Math.min(d, FORMA_DA_PONTE.alcance);
      const [px, pz] = noCaminho(dd), [ox, oz] = paraFora(dd);
      return [px + ox*w, base + alturaDaPonte(dd), pz + oz*w];
    };
    const nuvem = (x, y, z, largura, altura, op = 0.9) => {
      const m = new THREE.SpriteMaterial({ map: texturas[nuvens.length % texturas.length], transparent: true, depthWrite: false, opacity: op, fog: true });
      const sp = new THREE.Sprite(m);
      sp.scale.set(largura, altura, 1);
      sp.position.set(x, y, z);
      sp.renderOrder = 0; // antes da faixa de arco-íris (1)
      sp.userData.semAO = true;
      grupo.add(sp);
      nuvens.push(sp);
    };
    // o banco onde ela some, e umas soltas em volta
    for(let i = 0; i < 24; i++){
      const solta = i >= 15;
      const d = solta ? FORMA_DA_PONTE.alcance*(0.5 + r()*0.4) : comprimento*(0.56 + r()*0.4);
      const [x, y, z] = ponto(d, (r() - 0.5)*(solta ? 24 : 4.5));
      const e = 4.5 + r()*7;
      nuvem(x, y + (r() - 0.45)*(solta ? 5 : 2.2), z, e*1.7, e, 0.9);
    }
  }

  return {
    grupo,
    // a altura do caminho sobre (x, z), ou null fora da ponte (antes do começo)
    alturaEm(x, z){ const d = doComeco(x, z); return d >= 0 ? base + alturaDaPonte(d) : null; },
    // pontos [x, z] pelo meio da ponte, de d0 a d1 metros do começo
    pontos(d0, d1, n = 8){
      const lista = [];
      for(let i = 0; i <= n; i++) lista.push(noCaminho(d0 + (d1 - d0)*i/n));
      return lista;
    },
    // onde a grama não deve crescer: debaixo do começo da ponte (ainda rente ao chão)
    semGrama(){
      const lista = [];
      for(let d = 0; d <= 8; d += 0.8){ const [x, z] = noCaminho(d); lista.push({ x, z, r: 1.8 }); }
      return lista;
    },
    atualizar(elapsed, noite = 0){
      uTempo.value = elapsed;
      uBrilho.value = 0.16 + noite*0.5;
      // à noite as nuvens ganham o azul escuro das nuvens do céu (0x515c8f no relógio)
      corNuvem.setRGB(1, 1, 1).lerp(NUVEM_DE_NOITE, noite);
      nuvens.forEach(s => s.material.color.copy(corNuvem));
    },
  };
}
