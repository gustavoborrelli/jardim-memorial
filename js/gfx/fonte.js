/*
  FONTE
  Pedra torneada de verdade (perfil de bacia, borda e fuste em vez de cilindros
  empilhados) e água em shader: reflexo do céu pelo ângulo de visão, ondas e
  anéis saindo de onde a água cai, brilho do sol (HDR — o bloom cuida do resto)
  e cáusticas no fundo. A cachorrinha do topo continua lá, agora esculpida.
*/
import * as THREE from 'three';
import { texturaRuido, sorteador } from './ruido.js';
import { matPedra, torneado } from './materiais.js';
import { malhaSDF, esculpir, elipsoide, cone, esfera, espelharX } from './sdf.js';

const AGUA_VERT = /* glsl */`
  varying vec3 vWP;
  varying vec2 vL;
  uniform float uRaioL;
  #include <fog_pars_vertex>
  void main(){
    vec4 mvPosition = modelViewMatrix*vec4(position, 1.0);
    vWP = (modelMatrix*vec4(position, 1.0)).xyz;
    vL = uv*2.0 - 1.0;
    gl_Position = projectionMatrix*mvPosition;
    #include <fog_vertex>
  }
`;
const AGUA_FRAG = /* glsl */`
  varying vec3 vWP;
  varying vec2 vL;
  uniform float uTempo, uForca;
  uniform vec3 uFundo, uBorda;
  uniform vec3 uSolDir, uSolCor, uZenite, uMeio, uHorizonte;
  uniform sampler2D tRuido;
  #include <fog_pars_fragment>

  float altura(vec2 p){
    float a = texture2D(tRuido, p*0.42 + uTempo*vec2(0.022, 0.015)).g;
    float b = texture2D(tRuido, p*0.91 - uTempo*vec2(0.018, 0.031)).g;
    // anéis concêntricos, de onde a água cai
    float d = length(vL);
    float anel = sin(d*26.0 - uTempo*3.1)*smoothstep(1.0, 0.05, d)*0.2;
    float anel2 = sin(d*11.0 - uTempo*1.7 + a*4.0)*0.1;
    return (a*0.6 + b*0.4) + (anel + anel2)*uForca;
  }

  void main(){
    vec2 p = vWP.xz;
    float e = 0.045;
    float h0 = altura(p);
    vec3 n = normalize(vec3((h0 - altura(p+vec2(e,0.0)))*0.36, 1.0, (h0 - altura(p+vec2(0.0,e)))*0.36));
    vec3 v = normalize(cameraPosition - vWP);
    float nv = max(dot(n, v), 0.0);
    float fresnel = 0.03 + 0.72*pow(1.0 - nv, 5.0);

    vec3 r = reflect(-v, n);
    float ry = max(r.y, 0.0);
    vec3 ceu = mix(uHorizonte, uMeio, smoothstep(0.0, 0.22, ry));
    ceu = mix(ceu, uZenite, smoothstep(0.15, 0.8, ry));

    // corpo d'água: mais turquesa no meio, mais claro perto da borda
    float d = length(vL);
    vec3 corpo = mix(uFundo, uBorda, smoothstep(0.1, 1.0, d));

    // cáusticas: a luz dançando no fundo
    float cau = texture2D(tRuido, p*0.55 + uTempo*0.02).b;
    float cau2 = texture2D(tRuido, p*0.8 - uTempo*0.025).b;
    corpo += uSolCor*smoothstep(0.3, 0.7, abs(cau - cau2)*2.2)*0.045;

    vec3 cor = mix(corpo, ceu, fresnel);

    // brilho do sol
    float sp = pow(max(dot(r, uSolDir), 0.0), 340.0);
    float sp2 = pow(max(dot(r, uSolDir), 0.0), 40.0);
    cor += uSolCor*(sp*2.6 + sp2*0.02);

    float alfa = mix(0.72, 0.97, fresnel);
    gl_FragColor = vec4(cor, alfa);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/* a cachorrinha do topo: sentada, focinho pra cima */
function geoEstatua(celula){
  const corpo = esculpir([
    [cone([0, 0.1, -0.05], [0, 0.22, 0.04], 0.1, 0.075), 0],
    [cone([0, 0.2, 0.04], [0, 0.32, 0.08], 0.07, 0.06), 0.05],
    [esfera(0, 0.37, 0.1, 0.085), 0.04],
    [cone([0, 0.355, 0.13], [0, 0.34, 0.215], 0.05, 0.034), 0.03],
    [espelharX(cone([0.05, 0.02, 0.09], [0.05, 0.2, 0.05], 0.032, 0.03)), 0.03],
    [espelharX(elipsoide(0.085, 0.05, -0.04, 0.05, 0.05, 0.085)), 0.04],
    [espelharX(cone([0.062, 0.44, 0.07], [0.075, 0.5, 0.055], 0.03, 0.018)), 0.02],
    [cone([0, 0.08, -0.15], [0, 0.03, -0.26], 0.03, 0.022), 0.025],
  ]);
  return malhaSDF(corpo, [[-0.2, -0.02, -0.32], [0.2, 0.56, 0.28]], celula);
}

export function criarFonte(scene, { perfil, PLAZA, ceu, luz }){
  const grupo = new THREE.Group();
  const ruido = texturaRuido();
  const pedra = matPedra({ cor: 0xc4baa3, escala: 1.7, relevo: 0.008, musgo: 0.34, alturaMusgo: 0.34, manchas: 0.32, veios: 0.04 });
  const pedraAlta = matPedra({ cor: 0xc9bfa9, escala: 1.9, relevo: 0.007, musgo: 0.38, alturaMusgo: 1.5, manchas: 0.3 });

  const uTempo = { value: 0 };
  const compart = {
    uTempo,
    uSolDir: luz.uSolDir,
    uSolCor: luz.uSolCor,
    uZenite: ceu.uniforms.uZenite,
    uMeio: ceu.uniforms.uMeio,
    uHorizonte: ceu.uniforms.uHorizonte,
    tRuido: { value: ruido },
  };

  /* ---- bacia inferior ---- */
  // o perfil vai por fora, sobe, passa pela borda e desce por dentro: a ordem é
  // o que define pra que lado cada face olha
  const bacia = new THREE.Mesh(torneado([
    [2.06, 0.0], [2.06, 0.02], [2.0, 0.07], [1.9, 0.14], [1.9, 0.3], [1.96, 0.38], [2.02, 0.46], [2.0, 0.55],
    [1.92, 0.61], [1.78, 0.62], [1.68, 0.58], [1.64, 0.52], [1.66, 0.4], [1.62, 0.06], [1.42, 0.06],
  ], 56), pedra);
  bacia.castShadow = true;
  bacia.receiveShadow = true;
  grupo.add(bacia);

  const fundo = new THREE.Mesh(new THREE.CircleGeometry(1.64, 40), matPedra({ cor: 0x5f7f7a, escala: 2, relevo: 0.03, manchas: 0.4 }));
  fundo.rotation.x = -Math.PI/2;
  fundo.position.y = 0.07;
  grupo.add(fundo);

  /* ---- fuste + prato de cima + base da estátua ---- */
  const fuste = new THREE.Mesh(torneado([
    [0, 0.06], [0.42, 0.06], [0.42, 0.14], [0.34, 0.2], [0.27, 0.36], [0.2, 0.6], [0.17, 0.86], [0.19, 1.02], [0.26, 1.1],
    [0.3, 1.16], [0.5, 1.28], [0.76, 1.42], [0.86, 1.49], [0.92, 1.56], [0.9, 1.62], [0.82, 1.61], [0.76, 1.53], [0.3, 1.5], [0.24, 1.51],
    [0.2, 1.6], [0.17, 1.78], [0.2, 1.84], [0.22, 1.87], [0, 1.87],
  ], 40), pedraAlta);
  fuste.castShadow = true;
  fuste.receiveShadow = true;
  grupo.add(fuste);

  const estatua = new THREE.Mesh(
    geoEstatua(0.011*perfil.celulaSDF),
    matPedra({ cor: 0xd6cfbd, escala: 3, relevo: 0.004, musgo: 0.25, alturaMusgo: 2.2, manchas: 0.2 })
  );
  estatua.position.y = 1.87;
  estatua.castShadow = true;
  estatua.receiveShadow = true;
  grupo.add(estatua);

  /* ---- água ---- */
  const novaAgua = (raio, forca, y) => {
    const u = {
      ...compart,
      uForca: { value: forca },
      uFundo: { value: new THREE.Color(0x12707a) },
      uBorda: { value: new THREE.Color(0x3fb4b0) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
      vertexShader: AGUA_VERT, fragmentShader: AGUA_FRAG, transparent: true, fog: true, depthWrite: true,
    });
    Object.assign(mat.uniforms, u);
    const m = new THREE.Mesh(new THREE.CircleGeometry(raio, 48), mat);
    m.rotation.x = -Math.PI/2;
    m.position.y = y;
    m.userData.semAO = true;
    grupo.add(m);
    return m;
  };
  const aguaBaixa = novaAgua(1.645, 1.0, 0.44);
  const aguaAlta = novaAgua(0.8, 0.8, 1.565);

  /* ---- véu de água caindo do prato de cima ---- */
  const veu = new THREE.Mesh(
    torneado([[0.92, 1.56], [0.965, 1.3], [1.0, 0.9], [1.02, 0.44]], 48),
    new THREE.ShaderMaterial({
      uniforms: { uTempo, tRuido: { value: ruido }, uCor: { value: new THREE.Color(0xdff5f4) }, uSolCor: luz.uSolCor },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vN, vV;
        void main(){
          vUv = uv;
          vec4 mv = modelViewMatrix*vec4(position, 1.0);
          vN = normalize(normalMatrix*normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix*mv;
        }
      `,
      fragmentShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vN, vV;
        uniform float uTempo;
        uniform vec3 uCor, uSolCor;
        uniform sampler2D tRuido;
        void main(){
          // filetes: ruído esticado na vertical e escorrendo
          float n = texture2D(tRuido, vec2(vUv.x*5.0, vUv.y*0.35 - uTempo*0.32)).g;
          float n2 = texture2D(tRuido, vec2(vUv.x*11.0 + 0.3, vUv.y*0.5 - uTempo*0.5)).r;
          float fio = smoothstep(0.5, 0.74, n*0.6 + n2*0.4);
          float beira = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
          float base = smoothstep(0.0, 0.14, vUv.y);
          float a = fio*(0.34 + beira*0.34)*base;
          gl_FragColor = vec4(uCor*(0.9 + uSolCor*0.22), a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  veu.userData.semAO = true;
  grupo.add(veu);

  /* ---- jato e gotas: tudo no vertex shader, sem atualização por objeto ---- */
  const nGotas = Math.round(260*perfil.particulas);
  const r = sorteador(13);
  const ini = new Float32Array(nGotas*4);
  for(let i=0;i<nGotas;i++){
    ini[i*4] = r();                // fase
    ini[i*4+1] = r()*Math.PI*2;    // ângulo
    ini[i*4+2] = 0.45 + r()*0.55;  // velocidade radial
    ini[i*4+3] = 0.6 + r()*0.4;    // energia
  }
  const geoG = new THREE.BufferGeometry();
  geoG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nGotas*3), 3));
  geoG.setAttribute('aIni', new THREE.BufferAttribute(ini, 4));
  const uAltura = { value: 900 };
  const gotas = new THREE.Points(geoG, new THREE.ShaderMaterial({
    uniforms: { uTempo, uAltura, uSolCor: luz.uSolCor },
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      attribute vec4 aIni;
      uniform float uTempo, uAltura;
      varying float vFim;
      void main(){
        float t = fract(uTempo*(0.42 + aIni.a*0.26) + aIni.x);
        float v0 = 1.2*aIni.a;
        // jato sai da boca da cachorrinha, sobe, abre e cai no prato
        float y = 2.28 + v0*t - 1.75*t*t;
        float rd = aIni.z*t*0.55;
        vec3 p = vec3(cos(aIni.y)*rd, y, sin(aIni.y)*rd + 0.06*(1.0-t));
        if(y < 1.57) p.y = 1.57;
        vFim = smoothstep(1.56, 1.66, y);
        vec4 mv = modelViewMatrix*vec4(p, 1.0);
        gl_PointSize = clamp(uAltura*0.022/(-mv.z), 1.0, 11.0);
        gl_Position = projectionMatrix*mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying float vFim;
      uniform vec3 uSolCor;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.16, length(c));
        if(a < 0.01) discard;
        gl_FragColor = vec4(vec3(0.86, 0.96, 1.0)*(0.9 + uSolCor*0.5), a*0.8*vFim);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }));
  gotas.frustumCulled = false;
  gotas.userData.semAO = true;
  grupo.add(gotas);

  grupo.position.set(PLAZA.x, 0, PLAZA.z);
  scene.add(grupo);

  return {
    grupo,
    atualizar(elapsed, alturaTela){
      uTempo.value = elapsed;
      uAltura.value = alturaTela;
    },
  };
}
