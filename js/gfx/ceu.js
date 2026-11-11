/*
  CÉU
  Domo de verdade (antes era um degradê colado na tela, que não acompanhava o
  olhar). Tudo num shader só: degradê, disco do sol em HDR (quem faz o halo
  grande é o bloom), lua, estrelas e nuvens por ruído — iluminadas pelo sol,
  com a borda clara do lado de onde vem a luz.

  O mesmo domo, sem nuvens, é fotografado pelo PMREM a cada mudança de hora e
  vira a luz ambiente da cena: a sombra do jardim passa a ter a cor do céu que
  está em cima dela, em qualquer hora, sem preset nenhum pra isso.
*/
import * as THREE from 'three';
import { texturaRuido } from './ruido.js';

const VERT = /* glsl */`
  varying vec3 vDir;
  void main(){
    vDir = position;
    vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
    gl_Position = p.xyww; // sempre no plano de fundo, sem precisar de far gigante
  }
`;

const FRAG = /* glsl */`
  varying vec3 vDir;
  uniform vec3 uZenite, uMeio, uHorizonte, uChao;
  uniform vec3 uSolDir, uSolCor;
  uniform float uSolDisco, uSolHalo, uSolTam;
  uniform vec3 uLuaDir;
  uniform float uLua, uEstrelas;
  uniform vec3 uNuvemLuz, uNuvemSombra;
  uniform float uCobertura, uTempo, uNuvens;
  uniform sampler2D tRuido;

  float fbmNuvem(vec2 p){
    float s = texture2D(tRuido, p).r * 0.62;
    s += texture2D(tRuido, p*2.3 + 0.17).r * 0.27;
    #if NUVEM_OITAVAS > 2
    s += texture2D(tRuido, p*5.1 + 0.41).g * 0.11;
    #endif
    #if NUVEM_OITAVAS > 3
    s += (texture2D(tRuido, p*11.0 + 0.71).g - 0.5) * 0.05;
    #endif
    return s;
  }

  void main(){
    vec3 d = normalize(vDir);
    float h = d.y;

    // degradê em três paradas: o horizonte é estreito, o azul domina o alto
    vec3 cor = mix(uHorizonte, uMeio, smoothstep(0.0, 0.2, h));
    cor = mix(cor, uZenite, smoothstep(0.1, 0.72, h));

    // espalhamento em volta do sol (o céu "esquenta" naquela direção)
    float cs = max(dot(d, uSolDir), 0.0);
    cor += uSolCor * (pow(cs, 6.0)*0.10 + pow(cs, 42.0)*0.22) * uSolHalo;

    // estrelas: células de ruído branco, com cintilação lenta
    if(uEstrelas > 0.001 && h > 0.0){
      vec2 sp = d.xz/(abs(d.y)+0.6)*38.0;
      vec2 cel = floor(sp);
      vec2 r = texture2D(tRuido, (cel+0.5)/256.0).ag;
      float tem = step(0.93, r.x);
      vec2 f = fract(sp)-0.5-(r-0.5)*0.6;
      float pisca = 0.65 + 0.35*sin(uTempo*(0.8+r.y*2.0)+r.x*40.0);
      cor += vec3(1.0, 0.97, 0.92) * tem * smoothstep(0.075, 0.0, length(f)) * pisca * uEstrelas * 1.8 * smoothstep(0.02, 0.25, h);
    }

    // lua: disco claro + halo bem largo e fraco
    if(uLua > 0.001){
      float cl = dot(d, uLuaDir);
      float dl = smoothstep(0.99925, 0.99955, cl);
      // manchinhas no disco, pra não parecer um adesivo
      // (mares escuros e a borda um pouco mais apagada: antes o disco estourava
      // num branco só, e as manchas não apareciam)
      float mare = smoothstep(0.38, 0.66, texture2D(tRuido, d.xy*2.3 + 0.31).r);
      float limbo = smoothstep(0.99925, 0.99985, cl);
      cor += vec3(1.02, 1.04, 1.12) * dl * (1.0 - 0.3*mare) * (0.8 + 0.2*limbo) * uLua;
      cor += vec3(0.42, 0.5, 0.78) * (pow(max(cl, 0.0), 180.0)*0.32 + pow(max(cl, 0.0), 14.0)*0.05) * uLua;
    }

    // disco do sol em HDR: o bloom transforma isso em brilho
    float limboSol = smoothstep(cos(uSolTam*1.25), cos(uSolTam*0.82), dot(d, uSolDir));
    cor += uSolCor * limboSol * uSolDisco;

    // nuvens: plano no alto, projetado em perspectiva
    if(uNuvens > 0.5 && h > 0.0){
      vec2 uv = d.xz/(h + 0.16)*0.11;
      vec2 vento = vec2(uTempo*0.0022, uTempo*0.0007);
      float n = fbmNuvem(uv + vento);
      float dens = smoothstep(uCobertura, uCobertura + 0.17, n);
      if(dens > 0.001){
        // amostra deslocada em direção ao sol: diferença vira luz na borda
        vec2 rumo = normalize(uSolDir.xz + 1e-4);
        float nl = fbmNuvem(uv + vento + rumo*0.035);
        float luz = clamp((n - nl)*5.5 + 0.62, 0.0, 1.0);
        vec3 cn = mix(uNuvemSombra, uNuvemLuz, luz);
        // perto do sol a nuvem acende por transmissão
        cn += uSolCor * pow(cs, 16.0) * 0.32 * uSolHalo;
        float fade = smoothstep(0.012, 0.16, h);
        cor = mix(cor, cn, dens * fade * 0.94);
      }
    }

    // abaixo do horizonte (fica atrás das colinas, mas conta na luz ambiente)
    cor = mix(cor, uChao, smoothstep(0.0, -0.09, h));

    gl_FragColor = vec4(cor, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function criarCeu(scene, renderer, perfil){
  const ruido = texturaRuido();
  const uniforms = {
    uZenite: { value: new THREE.Color() },
    uMeio: { value: new THREE.Color() },
    uHorizonte: { value: new THREE.Color() },
    uChao: { value: new THREE.Color() },
    uSolDir: { value: new THREE.Vector3(0, 1, 0) },
    uSolCor: { value: new THREE.Color() },
    uSolDisco: { value: 1 },
    uSolHalo: { value: 1 },
    uSolTam: { value: 0.03 },
    uLuaDir: { value: new THREE.Vector3(0.5, 0.7, -0.5).normalize() },
    uLua: { value: 0 },
    uEstrelas: { value: 0 },
    uNuvemLuz: { value: new THREE.Color(0xffffff) },
    uNuvemSombra: { value: new THREE.Color(0xbcc8d8) },
    uCobertura: { value: 0.55 },
    uTempo: { value: 0 },
    uNuvens: { value: 1 },
    tRuido: { value: ruido },
  };
  const defines = { NUVEM_OITAVAS: perfil.nuvens };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG, defines,
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  });
  const domo = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat);
  domo.frustumCulled = false;
  domo.renderOrder = -1000;
  domo.userData.semAO = true;
  scene.add(domo);

  /* --- luz ambiente a partir do céu --- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const cenaEnv = new THREE.Scene();
  const uniformsEnv = { ...uniforms, uNuvens: { value: 0 }, uSolDisco: { value: 0 }, uLua: { value: 0 }, uEstrelas: { value: 0 } };
  const domoEnv = new THREE.Mesh(
    new THREE.SphereGeometry(10, 24, 16),
    new THREE.ShaderMaterial({
      uniforms: uniformsEnv, defines, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: FRAG,
    })
  );
  cenaEnv.add(domoEnv);
  let rtEnv = null;
  function atualizarAmbiente(){
    if(perfil.nome === 'baixo') return; // lá a luz ambiente fica só por conta da hemisférica
    const antigo = rtEnv;
    rtEnv = pmrem.fromScene(cenaEnv, 0.02, 0.1, 40);
    scene.environment = rtEnv.texture;
    if(antigo) antigo.dispose();
  }

  return { uniforms, domo, atualizarAmbiente };
}
