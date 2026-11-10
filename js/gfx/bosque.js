/*
  O BOSQUE DOS VAGA-LUMES (etapa 40)
  O que o Bosque tem e os outros jardins não: o riacho (a mesma água do lago, numa
  faixa ao longo do leito, com as ondinhas descendo a correnteza), a pontezinha de
  pedra em arco, os troncos caídos das clareiras e o enxame de vaga-lumes, que no
  Bosque acende já no entardecer e se junta nas clareiras e na beira d'água.
*/
import * as THREE from 'three';
import { sorteador } from './ruido.js';
import { matPedra, matMadeira } from './materiais.js';
import { materialAgua } from './agua.js';

/* planta: js/jardins/bosque.js; chao: o retorno de criarChao (textura de relevo) */
export function criarBosque(scene, { perfil, ceu, luz, chao, planta, lampadas = [], altura }){
  const { RIACHO, NIVEL_AGUA, FLUXO, PONTE_PEDRA: P, TRONCOS, CLAREIRAS, distRiacho, distTrilha, raioBorda } = planta;
  const r = sorteador(4040);
  const uTempo = { value: 0 }, uBrilhoLampadas = { value: 0 }, uVagaLumes = { value: 0 };
  const grupo = new THREE.Group();
  scene.add(grupo);

  /* ---------- o riacho: uma faixa de água ao longo do leito ---------- */
  {
    const pos = [], idx = [];
    const MEIA = 2.4; // mais larga que a água: o shader recorta a margem pela profundidade
    RIACHO.forEach((p, i) => {
      const a = RIACHO[Math.max(0, i - 1)], b = RIACHO[Math.min(RIACHO.length - 1, i + 1)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1])/l, nz = (b[0] - a[0])/l;
      pos.push(p[0] + nx*MEIA, 0, p[1] + nz*MEIA, p[0] - nx*MEIA, 0, p[1] - nz*MEIA);
      // (a ordem dos vértices deixa a face virada para cima: virada para baixo, sumia)
      if(i > 0){ const k = (i - 1)*2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const agua = new THREE.Mesh(geo, materialAgua({ ceu, luz, chao, nivel: NIVEL_AGUA, lampadas, uTempo, uBrilhoLampadas, fluxo: FLUXO }));
    agua.position.y = NIVEL_AGUA;
    agua.renderOrder = 2;
    agua.userData.semAO = true;
    agua.frustumCulled = false;
    grupo.add(agua);
  }

  /* ---------- a ponte de pedra ---------- */
  {
    const L = P.meio, base = P.base, alto = P.alto;
    const topo = (s) => base + alto*(1 - (s/L)*(s/L));
    const fundo = NIVEL_AGUA - 0.5;
    const vao = L - 0.75; // o arco de baixo, por onde a água passa
    const embaixoDoMeio = topo(0) - 0.3;
    // o perfil de lado: o tabuleiro em cima, o arco embaixo
    const perfil2d = new THREE.Shape();
    perfil2d.moveTo(-L, fundo);
    for(let i = 0; i <= 24; i++){ const s = -L + 2*L*i/24; perfil2d.lineTo(s, topo(s)); }
    perfil2d.lineTo(L, fundo);
    perfil2d.lineTo(vao, fundo);
    for(let i = 0; i <= 24; i++){ const s = vao - 2*vao*i/24; const k = 1 - (s/vao)*(s/vao); perfil2d.lineTo(s, fundo + (embaixoDoMeio - fundo)*Math.sqrt(Math.max(0, k))); }
    perfil2d.lineTo(-L, fundo);
    const largura = P.meiaLargura*2;
    const corpo = new THREE.ExtrudeGeometry(perfil2d, { depth: largura, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 4 });
    corpo.translate(0, 0, -largura/2);
    // as muretas dos dois lados, acompanhando o arco
    const mureta = new THREE.Shape();
    for(let i = 0; i <= 24; i++){ const s = -L + 2*L*i/24; (i ? mureta.lineTo : mureta.moveTo).call(mureta, s, topo(s) - 0.02); }
    for(let i = 24; i >= 0; i--){ const s = -L + 2*L*i/24; mureta.lineTo(s, topo(s) + 0.34); }
    const geoMureta = new THREE.ExtrudeGeometry(mureta, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
    const pedra = matPedra({ cor: 0xb3aa98, escala: 1.4, relevo: 0.03, musgo: 0.55, alturaMusgo: 0.5, manchas: 0.42, rugosidade: 0.92 });
    const ponte = new THREE.Group();
    const m = new THREE.Mesh(corpo, pedra);
    m.castShadow = m.receiveShadow = true;
    ponte.add(m);
    [-1, 1].forEach(lado => {
      const mu = new THREE.Mesh(geoMureta, pedra);
      mu.position.z = lado > 0 ? P.meiaLargura - 0.16 : -P.meiaLargura;
      mu.castShadow = mu.receiveShadow = true;
      ponte.add(mu);
    });
    // o eixo x do perfil vai no rumo da ponte
    ponte.rotation.y = Math.atan2(-P.eixo[1], P.eixo[0]);
    ponte.position.set(P.x, 0, P.z);
    grupo.add(ponte);
  }

  /* ---------- os troncos caídos das clareiras ---------- */
  const poleiros = [];
  {
    const casca = matPedra({ cor: 0x5a4430, escala: 3.4, relevo: 0.03, manchas: 0.5, musgo: 0.4, alturaMusgo: 0.1, rugosidade: 0.95 });
    const miolo = matMadeira(0xc7a27a);
    TRONCOS.forEach(t => {
      const g = new THREE.Group();
      const raio = 0.24 + r()*0.05;
      const geo = new THREE.CylinderGeometry(raio, raio*1.08, t.comp, 14, 1, true);
      const tronco = new THREE.Mesh(geo, casca);
      tronco.rotation.z = Math.PI/2;
      tronco.castShadow = tronco.receiveShadow = true;
      g.add(tronco);
      // as pontas cortadas, com os anéis da madeira
      [-1, 1].forEach(lado => {
        const tampa = new THREE.Mesh(new THREE.CircleGeometry(raio*(lado > 0 ? 1.08 : 1), 14), miolo);
        tampa.rotation.y = lado*Math.PI/2;
        tampa.position.x = lado*t.comp/2;
        g.add(tampa);
      });
      const y = altura(t.x, t.z);
      g.position.set(t.x, y + raio*0.8, t.z);
      g.rotation.y = -t.rot;
      grupo.add(g);
      poleiros.push({ x: t.x, y: y + raio*1.8, z: t.z });
    });
  }

  /* ---------- o enxame de vaga-lumes ---------- */
  {
    const n = Math.round(640*Math.max(0.35, perfil.particulas));
    const pontos = new Float32Array(n*4);
    let k = 0, tent = 0;
    while(k < n && tent < n*40){
      tent++;
      let x, z;
      const qual = r();
      if(qual < 0.45){
        // nas clareiras
        const c = CLAREIRAS[Math.floor(r()*CLAREIRAS.length)], a = r()*Math.PI*2, d = Math.sqrt(r())*(c.r + 1.5);
        x = c.x + Math.cos(a)*d; z = c.z + Math.sin(a)*d;
      } else {
        x = (r() - 0.5)*52; z = (r() - 0.5)*52;
        const dr = distRiacho(x, z);
        // na beira do riacho e perto da trilha, mais; no meio do mato, menos
        if(qual < 0.75 && !(dr > 1.4 && dr < 4.5)) continue;
        if(qual >= 0.75 && distTrilha(x, z) > 5 && r() < 0.6) continue;
      }
      if(Math.hypot(x, z) > raioBorda(x, z) + 2) continue;
      pontos[k*4] = x; pontos[k*4 + 1] = altura(x, z) + 0.3 + Math.pow(r(), 1.6)*1.9; pontos[k*4 + 2] = z; pontos[k*4 + 3] = r();
      k++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(k*3), 3));
    geo.setAttribute('aP', new THREE.BufferAttribute(pontos.subarray(0, k*4), 4));
    const uAlturaTela = { value: 900 };
    const vagaLumes = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: { uTempo, uAltura: uAlturaTela, uVagaLumes },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute vec4 aP;
        uniform float uTempo, uAltura;
        varying float vP;
        void main(){
          float f = aP.w*6.283;
          vec3 p = aP.xyz;
          p.x += sin(uTempo*0.29 + f)*1.1 + sin(uTempo*0.83 + f*2.0)*0.3;
          p.z += cos(uTempo*0.23 + f*1.7)*1.1 + cos(uTempo*0.71 + f)*0.3;
          p.y += sin(uTempo*0.55 + f*3.0)*0.35;
          // acende e apaga, cada um no seu tempo
          vP = pow(0.5 + 0.5*sin(uTempo*(0.6 + aP.w*0.9) + f*5.0), 2.0);
          vec4 mv = modelViewMatrix*vec4(p, 1.0);
          gl_PointSize = clamp(uAltura*0.1/(-mv.z), 2.5, 34.0);
          gl_Position = projectionMatrix*mv;
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uVagaLumes;
        varying float vP;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float nucleo = smoothstep(0.1, 0.0, d);
          float halo = smoothstep(0.5, 0.0, d);
          vec3 cor = vec3(0.85, 1.0, 0.38);
          gl_FragColor = vec4(cor*(nucleo*5.0 + halo*0.9), (nucleo + halo*halo*0.8)*vP*uVagaLumes);
        }
      `,
    }));
    vagaLumes.frustumCulled = false;
    vagaLumes.userData.semAO = true;
    vagaLumes.userData.alturaTela = uAlturaTela;
    grupo.add(vagaLumes);
    grupo.userData.alturaTela = uAlturaTela;
  }

  return {
    grupo,
    poleiros,
    // brilho: os lampiões (0 de dia, 1 de noite); entardecer: 0 de dia, sobe no fim da tarde
    atualizar(elapsed, brilho = 0, entardecer = 0, alturaTela = 900){
      uTempo.value = elapsed;
      uBrilhoLampadas.value = brilho;
      uVagaLumes.value = Math.min(1, entardecer);
      grupo.userData.alturaTela.value = alturaTela;
    },
  };
}
