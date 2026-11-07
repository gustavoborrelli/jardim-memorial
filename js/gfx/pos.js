/*
  PÓS-PROCESSAMENTO
  A cena é desenhada em HDR numa textura própria (com MSAA e profundidade) e
  só depois vira a imagem da tela:

    cena HDR → sombra de contato (GTAO) → brilho (bloom) → acabamento

  O perfil "baixo" pula tudo isso e desenha direto na tela.
*/
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const ACABAMENTO = {
  uniforms: {
    tDiffuse: { value: null },
    uExposicao: { value: 1 },
    uVinheta: { value: 0.26 },
    uSaturacao: { value: 1.05 },
    uQuente: { value: new THREE.Vector3(1, 1, 1) },
    uTempo: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */`
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uExposicao, uVinheta, uSaturacao, uTempo;
    uniform vec3 uQuente;

    // ACES ajustado (Hill): segura a saturação melhor que a curva rápida e
    // não queima os tons de pele do pelo dourado
    const mat3 ENTRADA = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
    const mat3 SAIDA = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
    vec3 aces(vec3 v){
      v = ENTRADA * v;
      vec3 a = v * (v + 0.0245786) - 0.000090537;
      vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
      return clamp(SAIDA * (a / b), 0.0, 1.0);
    }
    vec3 srgb(vec3 c){
      return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(0.0031308, c));
    }
    float grao(vec2 uv){
      return fract(sin(dot(uv, vec2(12.9898, 78.233)) + uTempo) * 43758.5453);
    }

    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c *= uExposicao * uQuente / 0.6; // o ACES de Hill espera essa compensação

      // vinheta suave, medida em HDR pra não sujar o preto
      vec2 q = vUv - 0.5;
      c *= 1.0 - uVinheta * smoothstep(0.25, 0.95, dot(q, q)*2.2);

      c = aces(c);

      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturacao);
      c = clamp(c, 0.0, 1.0);

      c = srgb(c);
      // ruído de 1/255: acaba com a "escadinha" nos degradês do céu
      c += (grao(gl_FragCoord.xy*0.01) - 0.5) / 255.0;
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

/* Sombra de contato só entre objetos sólidos. Passar grama e folhagem aqui
   transforma o ruído fino delas em manchas escuras; quem carrega semAO fica de
   fora do desenho das normais, e assim o custo também cai. */
class AOJardim extends GTAOPass {
  // meia resolução: sombra de contato é suave por natureza, e custa 1/4
  setSize(w, h){ super.setSize(Math.max(1, w>>1), Math.max(1, h>>1)); }
  _overrideVisibility(){
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      if(o.visible && (o.isPoints || o.isLine || o.isSprite || o.userData.semAO)){
        o.visible = false;
        cache.push(o);
      }
    });
  }
}
function criarAO(scene, camera, w, h){
  const ao = new AOJardim(scene, camera, Math.max(1, w>>1), Math.max(1, h>>1));
  ao.output = GTAOPass.OUTPUT.Default;
  ao.blendIntensity = 0.92;
  ao.updateGtaoMaterial({
    radius: 0.5, distanceExponent: 1.3, thickness: 1.0, scale: 1.15,
    samples: 8, distanceFallOff: 1.0, screenSpaceRadius: false,
  });
  ao.updatePdMaterial({
    lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1.5, rings: 2, samples: 8,
  });
  return ao;
}

export function criarPos(renderer, scene, camera, perfil){
  const tamanho = new THREE.Vector2();
  renderer.getSize(tamanho);

  if(!perfil.pos){
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    return {
      render(){ renderer.render(scene, camera); },
      setSize(){},
      setHora(){},
      desligarAO(){}, desligarBloom(){},
      ativo: false,
    };
  }

  renderer.toneMapping = THREE.NoToneMapping;
  const dpr = renderer.getPixelRatio();
  const w = Math.floor(tamanho.x*dpr), h = Math.floor(tamanho.y*dpr);

  const rtCena = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    samples: perfil.msaa,
    colorSpace: THREE.LinearSRGBColorSpace,
  });

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType }));
  composer.setPixelRatio(dpr);
  composer.setSize(tamanho.x, tamanho.y);

  const entrada = new TexturePass(rtCena.texture);
  composer.addPass(entrada);

  let ao = null;
  if(perfil.ao){
    ao = criarAO(scene, camera, w, h);
    composer.addPass(ao);
  }
  let bloom = null;
  if(perfil.bloom){
    bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.72, 1.0);
    composer.addPass(bloom);
  }
  const acabamento = new ShaderPass(ACABAMENTO);
  composer.addPass(acabamento);

  return {
    render(elapsed = 0){
      acabamento.uniforms.uTempo.value = elapsed % 10;
      renderer.setRenderTarget(rtCena);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      composer.render();
    },
    setSize(largura, altura){
      const d = renderer.getPixelRatio();
      rtCena.setSize(Math.floor(largura*d), Math.floor(altura*d));
      composer.setPixelRatio(d);
      composer.setSize(largura, altura);
    },
    // a hora do dia também mexe no acabamento: exposição, calor e força do brilho
    setHora({ exposicao, quente, bloom: forca }){
      acabamento.uniforms.uExposicao.value = exposicao;
      acabamento.uniforms.uQuente.value.copy(quente);
      if(bloom) bloom.strength = forca;
    },
    desligarAO(){ if(ao) ao.enabled = false; },
    desligarBloom(){ if(bloom) bloom.enabled = false; },
    ativo: true,
    composer, acabamento, rtCena, get ao(){ return ao; }, get bloom(){ return bloom; },
  };
}
