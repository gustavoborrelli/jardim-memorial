"use strict";

/*
  CACHORROS
  Controla o movimento do cachorro escolhido: teclado (WASD / setas), a câmera
  que gira ao redor dele (touchpad / roda do mouse / toque). Os modelos das três
  raças (Pastor Alemão, Dachshund, Golden Retriever) e a animação moram em
  js/gfx/caes.js.

  createDogController(scene, renderer, opts) devolve as funções que
  main.js usa a cada frame para mover o cachorro e atualizar a câmera.
*/
import * as THREE from 'three';
import { construirCao, animarCao } from './gfx/caes.js';

// a escultura de cada raça mora em js/gfx/caes.js
export function buildDog(breed){
  return construirCao(breed);
}

/*
  scene: onde o cachorro é adicionado/removido ao trocar de raça
  renderer: para escutar wheel/touch (giro de câmera) no canvas
  opts.isPaused(): função que diz se o jogo está pausado (menu aberto)
  opts.plaza: {x,z,r} da praça central, para o cachorro não atravessar a fonte
  opts.bounds: limite do terreno (o cachorro não passa da cerca)
*/
export function createDogController(scene, renderer, { isPaused, plaza, bounds }){
  let dog = null;
  let dogParts = null;

  let dogYaw = Math.PI; // facing -z initially
  let camAzimuth = Math.PI; // behind the dog
  let camElevation = 0.35;
  let camDist = 5.2;
  let firstPerson = false;
  let isMoving = false;

  // em tela de toque, um dedo já vai pro joystick — não sobra outro fácil
  // pra girar a câmera junto. Por isso, só em telas de toque, a câmera de
  // 3ª pessoa se alinha sozinha atrás do cachorro enquanto ele anda (ver
  // updateMovement), a não ser que a pessoa esteja arrastando a tela na
  // hora (aí o gesto manual manda, como sempre).
  const isTouchDevice = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;

  const keys = {};
  function isTypingInField(e){
    const tag = e.target && e.target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA';
  }
  window.addEventListener('keydown', e=>{ if(isTypingInField(e)) return; keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', e=>{ if(isTypingInField(e)) return; keys[e.key.toLowerCase()] = false; });

  // Joystick virtual: só aparece em telas de toque (CSS), mas a lógica roda sempre.
  const joystickEl = document.getElementById('joystick');
  const joystickKnob = document.getElementById('joystickKnob');
  const JOY_RADIUS = 40;
  let joyX = 0, joyZ = 0, joyPointerId = null;

  function updateJoystick(e){
    const rect = joystickEl.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width/2);
    let dy = e.clientY - (rect.top + rect.height/2);
    const dist = Math.hypot(dx, dy);
    if(dist > JOY_RADIUS){ dx = dx/dist*JOY_RADIUS; dy = dy/dist*JOY_RADIUS; }
    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    joyX = dx / JOY_RADIUS; // -1..1
    joyZ = dy / JOY_RADIUS; // -1..1
  }
  function endJoystick(e){
    if(joyPointerId !== e.pointerId) return;
    joyPointerId = null;
    joyX = 0; joyZ = 0;
    joystickKnob.style.transform = 'translate(0px, 0px)';
  }
  if(joystickEl){
    joystickEl.addEventListener('pointerdown', e=>{
      if(isPaused()) return;
      joyPointerId = e.pointerId;
      joystickEl.setPointerCapture(e.pointerId);
      updateJoystick(e);
    });
    joystickEl.addEventListener('pointermove', e=>{ if(joyPointerId === e.pointerId) updateJoystick(e); });
    joystickEl.addEventListener('pointerup', endJoystick);
    joystickEl.addEventListener('pointercancel', endJoystick);
  }

  function resetKeys(){
    Object.keys(keys).forEach(k=> keys[k]=false);
    joyPointerId = null; joyX = 0; joyZ = 0;
    if(joystickKnob) joystickKnob.style.transform = 'translate(0px, 0px)';
  }

  // "olhar" (girar horizontalmente): em 1ª pessoa gira o próprio cachorro
  // (dogYaw), já que W/S/A/D passam a ser relativos a pra onde ele está
  // olhando; em 3ª pessoa continua girando só a câmera livre (camAzimuth)
  // ao redor dele, como sempre foi.
  function look(deltaAzimuth){
    if(firstPerson){
      dogYaw -= deltaAzimuth;
      if(dog) dog.rotation.y = dogYaw;
    } else {
      camAzimuth -= deltaAzimuth;
    }
  }

  // Trackpad: swipe with two fingers to look around (fires as a 'wheel' event in browsers)
  renderer.domElement.addEventListener('wheel', e=>{
    e.preventDefault();
    if(isPaused()) return;
    look(e.deltaX*0.003);
    camElevation = Math.max(0.08, Math.min(0.9, camElevation - e.deltaY*0.002));
  }, {passive:false});

  // Touch: drag with a finger to look around (no hover on touchscreens)
  let touchDragging = false, lastTX=0, lastTY=0, touchMoved = false;
  renderer.domElement.addEventListener('touchstart', e=>{ touchDragging=true; lastTX=e.touches[0].clientX; lastTY=e.touches[0].clientY; }, {passive:true});
  renderer.domElement.addEventListener('touchmove', e=>{
    if(!touchDragging) return;
    const dx = e.touches[0].clientX-lastTX, dy = e.touches[0].clientY-lastTY;
    lastTX=e.touches[0].clientX; lastTY=e.touches[0].clientY;
    if(Math.hypot(dx,dy) > 3) touchMoved = true;
    look(dx*0.006);
    camElevation = Math.max(0.08, Math.min(0.9, camElevation - dy*0.004));
  }, {passive:true});
  renderer.domElement.addEventListener('touchend', ()=> touchDragging=false);

  function selectDog(breed){
    const prevPos = dog ? dog.position.clone() : new THREE.Vector3(0, 0, 14);
    const prevYaw = dog ? dogYaw : Math.PI;
    if(dog) scene.remove(dog);
    dogParts = buildDog(breed);
    dog = dogParts.group;
    dog.position.copy(prevPos);
    dog.rotation.y = prevYaw;
    scene.add(dog);
  }

  /* ============ CAMINHADA SOZINHO (quem chega pelo link de uma homenagem) ============
     O cachorro segue uma lista de pontos [x, z] com o mesmo movimento do controle
     (fonte, cerca, giro), e no fim vira para `olharPara`. Qualquer tecla ou toque
     no joystick devolve o controle a quem está jogando. */
  let rota = null;
  let virarPara = null;
  let camAlvo = null;
  // na chegada a câmera mira o meio entre o cachorro e a pedra (`foco`) e se afasta
  // um pouco: mirando só o cachorro, a pedra saía cortada na tela de celular em pé
  const CAM_DIST = 5.2;
  let foco = null, focoPeso = 0, camDistAlvo = CAM_DIST;
  const distanciaChegada = () => (window.innerHeight > window.innerWidth ? 7.2 : 6.0);
  // `camera`: azimute em que a câmera termina (padrão: atrás do cachorro). Quem chama
  // escolhe um ângulo que não caia dentro de uma copa de árvore.
  function caminharPor(pontos, { olharPara = null, aoChegar = null, camera = null } = {}){
    rota = { pontos, i: 0, olharPara, aoChegar, camera, melhor: Infinity, parado: 0 };
    virarPara = null; camAlvo = null;
  }
  function cancelarCaminhada(){ rota = null; virarPara = null; camAlvo = null; }
  function caminhando(){ return !!rota; }

  // coloca o cachorro num ponto, já virado (sem andar até lá)
  function posicionar(x, z, yaw){
    if(!dog) return;
    dog.position.set(x, 0, z);
    dogYaw = yaw;
    dog.rotation.y = yaw;
  }

  const angulo = (a) => { while(a > Math.PI) a -= Math.PI*2; while(a < -Math.PI) a += Math.PI*2; return a; };

  function updateMovement(dt, elapsed){
    if(!dog || !dogParts) return;
    let moveX=0, moveZ=0;
    if(keys['w']||keys['arrowup']) moveZ -= 1;
    if(keys['s']||keys['arrowdown']) moveZ += 1;
    if(keys['a']||keys['arrowleft']) moveX -= 1;
    if(keys['d']||keys['arrowright']) moveX += 1;
    if(Math.abs(joyX) > 0.08 || Math.abs(joyZ) > 0.08){ moveX = joyX; moveZ = joyZ; }

    const manual = (moveX!==0 || moveZ!==0);
    if(manual && (rota || virarPara !== null || camAlvo !== null)) cancelarCaminhada();

    // piloto: o rumo é o próximo ponto da rota
    let rumoX = 0, rumoZ = 0;
    if(!manual && rota){
      const [px, pz] = rota.pontos[rota.i];
      const dx = px - dog.position.x, dz = pz - dog.position.z;
      const d = Math.hypot(dx, dz);
      // preso (empurrado pela fonte, por exemplo): pula para o ponto seguinte
      if(d < rota.melhor - 0.02){ rota.melhor = d; rota.parado = 0; } else rota.parado += dt;
      if(d < 0.3 || rota.parado > 2.5){
        rota.i++;
        rota.melhor = Infinity; rota.parado = 0;
        if(rota.i >= rota.pontos.length){
          const { olharPara, aoChegar, camera } = rota;
          rota = null;
          if(olharPara) virarPara = Math.atan2(olharPara.x - dog.position.x, olharPara.z - dog.position.z);
          camAlvo = camera !== null ? camera : (virarPara !== null ? virarPara + Math.PI : null);
          camElevation = 0.42;
          if(olharPara){
            foco = { x: (dog.position.x + olharPara.x)/2, z: (dog.position.z + olharPara.z)/2 };
            camDistAlvo = distanciaChegada();
          }
          if(aoChegar) setTimeout(aoChegar, olharPara ? 650 : 0);
        }
      } else {
        rumoX = dx/d; rumoZ = dz/d;
      }
    }
    const piloto = rumoX !== 0 || rumoZ !== 0;

    // chegou: termina de virar para a pedra, e a câmera vai para o ângulo final
    if(!manual && !piloto && virarPara !== null){
      const diff = angulo(virarPara - dogYaw);
      dogYaw += diff*Math.min(1, dt*5);
      dog.rotation.y = dogYaw;
      if(Math.abs(diff) < 0.01) virarPara = null;
    }
    if(!manual && !piloto && camAlvo !== null){
      const diff = angulo(camAlvo - camAzimuth);
      camAzimuth += diff*Math.min(1, dt*2.4);
      if(Math.abs(diff) < 0.01) camAlvo = null;
    }
    // andou por conta própria: a câmera volta a seguir só o cachorro, na distância de sempre
    if(manual){ camDistAlvo = CAM_DIST; }
    focoPeso += ((foco && !manual ? 1 : 0) - focoPeso)*Math.min(1, dt*1.8);
    if(manual && focoPeso < 0.01) foco = null;
    camDist += (camDistAlvo - camDist)*Math.min(1, dt*1.5);

    const moving = manual || piloto;
    isMoving = moving;
    if(moving){
      const len = Math.hypot(moveX,moveZ) || 1;
      moveX/=len; moveZ/=len;

      let worldX, worldZ;
      if(piloto){
        worldX = rumoX; worldZ = rumoZ;
      } else if(firstPerson){
        // 1ª pessoa: W/S/A/D são sempre relativos a pra onde o cachorro está
        // de fato olhando (dogYaw), que só muda quando você "olha" (touchpad/
        // roda/arrasto). Assim W é sempre pra frente e S é sempre pra trás
        // na tela, sem depender de onde a câmera livre ficou apontando da
        // última vez — é o que fazia às vezes "trás" parecer "frente".
        const fwdX = Math.sin(dogYaw), fwdZ = Math.cos(dogYaw);
        const rightX = -Math.cos(dogYaw), rightZ = Math.sin(dogYaw);
        worldX = fwdX*(-moveZ) + rightX*moveX;
        worldZ = fwdZ*(-moveZ) + rightZ*moveX;
      } else {
        // 3ª pessoa: relativo à câmera orbital livre, e o cachorro sempre
        // vira de frente pro rumo — comportamento de sempre.
        worldX = moveX*Math.cos(camAzimuth) + moveZ*Math.sin(camAzimuth);
        worldZ = -moveX*Math.sin(camAzimuth) + moveZ*Math.cos(camAzimuth);
      }

      const speed = piloto ? 2.9 : 3.2;
      dog.position.x += worldX*speed*dt;
      dog.position.z += worldZ*speed*dt;
      dog.position.x = Math.max(-bounds, Math.min(bounds, dog.position.x));
      dog.position.z = Math.max(-bounds, Math.min(bounds, dog.position.z));

      // fountain collision: gently push the dog out of the basin
      const fdx = dog.position.x - plaza.x, fdz = dog.position.z - plaza.z;
      const fdist = Math.hypot(fdx, fdz);
      const FOUNTAIN_R = 2.15;
      if(fdist < FOUNTAIN_R && fdist > 0.001){
        dog.position.x = plaza.x + (fdx/fdist)*FOUNTAIN_R;
        dog.position.z = plaza.z + (fdz/fdist)*FOUNTAIN_R;
      }

      if(!firstPerson || piloto){
        const targetYaw = Math.atan2(worldX, worldZ);
        let diff = targetYaw - dogYaw;
        while(diff>Math.PI) diff-=Math.PI*2;
        while(diff<-Math.PI) diff+=Math.PI*2;
        dogYaw += diff*Math.min(1, dt*8);
        dog.rotation.y = dogYaw;

        // toque: câmera acompanha sozinha, um pouco mais devagar que o
        // giro do cachorro (fica "chegando por trás" em vez de grudar),
        // exceto se a pessoa estiver arrastando a tela pra olhar na mão
        // no piloto, em qualquer aparelho: quem chegou pelo link só assiste
        if((isTouchDevice || piloto) && !touchDragging){
          let camDiff = (dogYaw + Math.PI) - camAzimuth;
          while(camDiff>Math.PI) camDiff-=Math.PI*2;
          while(camDiff<-Math.PI) camDiff+=Math.PI*2;
          camAzimuth += camDiff*Math.min(1, dt*2.1); // 30% mais devagar que antes
        }
      }

    }
    animarCao(dogParts, dt, elapsed, moving);
  }

  function updateCamera(camera, elapsed=0){
    const tx = dog ? dog.position.x : plaza.x;
    const tz = dog ? dog.position.z : plaza.z;

    if(firstPerson && dog){
      // câmera presa na cabeça do cachorro de verdade: usa dogYaw (pra onde
      // ele está de fato olhando) — controlado só pelo "olhar" (touchpad/
      // roda/arrasto), nunca pelo WASD. W/S/A/D andam relativos a essa mesma
      // direção (ver updateMovement), então frente/trás na tela batem sempre
      // com o que as teclas fazem, feito controle de FPS de verdade.
      // eyeForward passa do focinho de cada raça, senão a câmera renderiza
      // de dentro da própria cabeça do cachorro.
      const fwdX = Math.sin(dogYaw), fwdZ = Math.cos(dogYaw);
      const rightX = Math.cos(dogYaw), rightZ = -Math.sin(dogYaw);

      // leve embalo de andada: sobe/desce no dobro da passada, balanço
      // lateral na passada — só pra não parecer uma câmera de espectador
      // flutuando, mesmo sutil.
      const bobY = Math.sin(elapsed*18) * (isMoving ? 0.022 : 0.006);
      const bobX = Math.sin(elapsed*9) * (isMoving ? 0.016 : 0);

      const px = tx + fwdX*dogParts.eyeForward + rightX*bobX;
      const pz = tz + fwdZ*dogParts.eyeForward + rightZ*bobX;
      const eyeY = dogParts.eyeHeight + bobY;
      camera.position.set(px, eyeY, pz);
      camera.lookAt(px + fwdX, eyeY, pz + fwdZ);
      return;
    }

    const target = new THREE.Vector3(tx, 0.9, tz);
    if(foco && dog){
      target.x += (foco.x - tx)*focoPeso;
      target.z += (foco.z - tz)*focoPeso;
    }
    // sem cachorro ainda (menu inicial): passeio lento e aberto em volta da praça
    // (alto o bastante pra passar por cima de todas as árvores)
    const dist = dog ? camDist : 17;
    const cx = target.x + dist*Math.sin(camAzimuth)*Math.cos(camElevation);
    const cz = target.z + dist*Math.cos(camAzimuth)*Math.cos(camElevation);
    const cy = dog ? target.y + dist*Math.sin(camElevation) + 1.1 : 7.4;
    camera.position.set(cx,cy,cz);
    camera.lookAt(target.x, target.y+0.3, target.z);
  }

  function toggleFirstPerson(){
    firstPerson = !firstPerson;
    if(!firstPerson){
      // volta pra 3ª pessoa: alinha a câmera orbital livre com a direção
      // que o cachorro ficou olhando em 1ª pessoa, senão ela pularia pro
      // ângulo antigo, de antes de entrar na visão de olhos
      camAzimuth = dogYaw + Math.PI;
    }
    return firstPerson;
  }
  function isFirstPerson(){
    return firstPerson;
  }

  // ao entrar no jardim a câmera vem pra trás do cachorro, olhando pra onde ele olha:
  // no menu ela fica passeando, e entrar de frente pro portão é a pior primeira vista
  function alinharCamera(){
    camAzimuth = dogYaw + Math.PI;
    camElevation = 0.35;
  }

  function orbitIdle(dt){
    // slow cinematic orbit behind the menu, while paused
    camAzimuth += dt*0.06;
  }

  function consumeTouchMoved(){
    const v = touchMoved;
    touchMoved = false;
    return v;
  }

  return {
    selectDog,
    alinharCamera,
    caminharPor,
    cancelarCaminhada,
    distanciaChegada,
    caminhando,
    posicionar,
    getDog: () => dog,
    getBreed: () => dogParts && dogParts.breed,
    updateMovement,
    updateCamera,
    orbitIdle,
    consumeTouchMoved,
    resetKeys,
    toggleFirstPerson,
    isFirstPerson,
  };
}
