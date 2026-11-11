"use strict";

/*
  RETRATOS DOS COMPANHEIROS
  Na tela "Escolha seu companheiro" cada raça era só duas bolinhas de cor (o golden
  e o caramelo ficavam iguais). Aqui cada cartão ganha o retrato de verdade: o
  mesmo modelo que passeia no jardim, fotografado uma vez pelo renderizador do jogo
  numa textura pequena e colado no cartão como imagem.

  Só acontece quando a tela de escolha abre pela primeira vez, uma raça por quadro
  (esculpir os sete modelos de uma vez travaria a página num celular). Se algo der
  errado, as bolinhas de cor continuam lá.
*/
import * as THREE from 'three';
import { buildDog } from './cachorros.js';

const LADO = 320;

export function criarRetratos(renderer, cenaDoJogo){
  let comecou = false;

  function fotografar(raca, estudio){
    const { cena, camera, alvo, pixels, tela, ctx, imagem } = estudio;
    const { group } = buildDog(raca);
    group.rotation.y = 0.62; // de três quartos, olhando para quem escolhe
    cena.add(group);
    group.updateMatrixWorld(true);

    // enquadra o corpo inteiro, com a cabeça um pouco acima do meio
    const caixa = new THREE.Box3().setFromObject(group);
    const centro = caixa.getCenter(new THREE.Vector3());
    const raio = caixa.getSize(new THREE.Vector3()).length()*0.5;
    const dist = raio/Math.sin(THREE.MathUtils.degToRad(camera.fov*0.5))*0.66;
    camera.position.set(centro.x + dist*0.16, centro.y + dist*0.2, centro.z + dist);
    camera.lookAt(centro.x, centro.y + raio*0.04, centro.z);

    const antes = renderer.getRenderTarget();
    const corAntes = renderer.getClearColor(new THREE.Color()), alfaAntes = renderer.getClearAlpha();
    renderer.setRenderTarget(alvo);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(cena, camera);
    renderer.readRenderTargetPixels(alvo, 0, 0, LADO, LADO, pixels);
    renderer.setRenderTarget(antes);
    renderer.setClearColor(corAntes, alfaAntes);

    // a textura vem de cabeça para baixo
    for(let y = 0; y < LADO; y++){
      imagem.data.set(pixels.subarray((LADO - 1 - y)*LADO*4, (LADO - y)*LADO*4), y*LADO*4);
    }
    ctx.putImageData(imagem, 0, 0);

    cena.remove(group); // (as malhas são do cache de js/gfx/caes.js: nada a descartar)
    return tela.toDataURL('image/png');
  }

  function montarEstudio(){
    const cena = new THREE.Scene();
    cena.environment = cenaDoJogo.environment; // a mesma luz ambiente do jardim (nula no perfil baixo)
    cena.environmentIntensity = 0.55;
    cena.add(new THREE.HemisphereLight(0xfff4e2, 0xb9b08f, cenaDoJogo.environment ? 0.7 : 1.5));
    const sol = new THREE.DirectionalLight(0xfff0d8, 2.4);
    sol.position.set(-2.5, 4, 3.5);
    cena.add(sol);
    const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 30);
    const alvo = new THREE.WebGLRenderTarget(LADO, LADO, { samples: 4 });
    alvo.texture.colorSpace = THREE.SRGBColorSpace;
    const tela = document.createElement('canvas');
    tela.width = tela.height = LADO;
    const ctx = tela.getContext('2d');
    return { cena, camera, alvo, pixels: new Uint8Array(LADO*LADO*4), tela, ctx, imagem: ctx.createImageData(LADO, LADO) };
  }

  return {
    pintar(){
      if(comecou) return;
      comecou = true;
      const cartoes = [...document.querySelectorAll('.dog-card[data-breed]')];
      let estudio = null;
      const proximo = () => {
        const cartao = cartoes.shift();
        if(!cartao){ if(estudio) estudio.alvo.dispose(); return; }
        try {
          estudio = estudio || montarEstudio();
          const img = new Image();
          img.className = 'dog-retrato';
          img.alt = '';
          img.src = fotografar(cartao.dataset.breed, estudio);
          const bolinhas = cartao.querySelector('.dog-swatch');
          if(bolinhas) bolinhas.replaceWith(img); else cartao.prepend(img);
        } catch(e){
          console.warn('Retrato do companheiro não saiu:', e && e.message);
          if(estudio) estudio.alvo.dispose();
          return; // as bolinhas de cor ficam
        }
        requestAnimationFrame(proximo);
      };
      requestAnimationFrame(proximo);
    },
  };
}
