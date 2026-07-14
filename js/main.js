"use strict";

/*
  MAIN
  Ponto de entrada do jogo. Aqui montamos a cena 3D básica (câmera,
  renderizador), chamamos os outros módulos na ordem certa, ligamos os
  cliques/movimentos do mouse às lápides, e rodamos o loop de animação
  que redesenha o jardim quadro a quadro.

  Ordem dos imports importa: three-flat-shading.js precisa vir primeiro,
  porque ele muda como o THREE.MeshStandardMaterial se comporta antes que
  mundo.js/lapides.js/cachorros.js criem qualquer material.
*/
import './three-flat-shading.js';
import { createWorld } from './mundo.js';
import { createLapides } from './lapides.js';
import { createDogController } from './cachorros.js';
import { createMenuUi } from './menuUi.js';
import { createAuth } from './auth.js';
import { createPresence } from './presenca.js';
import { createMapaUi } from './mapa.js';

/* ============ BASIC SETUP ============ */
const appEl = document.getElementById('app');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(52, window.innerWidth/window.innerHeight, 0.1, 200);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// tonemapping + color: dá aquele contraste suave e quente de "golden hour"
// em vez do visual "cru" padrão do WebGL, sem perder o look baixo-poli.
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
appEl.insertBefore(renderer.domElement, appEl.firstChild);

window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ============ MÓDULOS DO JOGO ============ */
const world = createWorld(scene);
const lapides = createLapides(scene);
world.scatterFlowers(90, lapides.plots);

const BOUNDS = 25.5;
const pausedState = { value: true }; // starts on the menu

const dogController = createDogController(scene, renderer, {
  isPaused: () => pausedState.value,
  plaza: world.PLAZA,
  bounds: BOUNDS,
});

const auth = createAuth();
const mapaUi = createMapaUi({ lapides, world, dogController, bounds: BOUNDS });
const menuUi = createMenuUi({ camera, lapides, world, dogController, pausedState, auth, mapaUi });
const presence = createPresence({ scene, dogController, pausedState });

/* ============ RAYCAST INTERACTION ============ */
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();
let hoveredEmptyPlot = null;
let hoveredStone = null;

function onPointerMove(e){
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((e.clientX-rect.left)/rect.width)*2-1;
  mouseNDC.y = -((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouseNDC, camera);

  hoveredEmptyPlot = lapides.pickEmptyPlot(raycaster);
  hoveredStone = lapides.pickStone(raycaster);
}
renderer.domElement.addEventListener('mousemove', onPointerMove);

function onClick(e){
  if(dogController.consumeTouchMoved()) return;
  if(pausedState.value) return;
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((e.clientX-rect.left)/rect.width)*2-1;
  mouseNDC.y = -((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouseNDC, camera);

  // empty plot -> open modal
  const emptyPlot = lapides.pickEmptyPlot(raycaster);
  if(emptyPlot){
    menuUi.openModalFor(emptyPlot);
    return;
  }

  // stone -> abre o modal de ler/deixar mensagens (card do hover continua só leitura)
  const stone = lapides.pickStone(raycaster);
  if(stone){ menuUi.openMessagesFor(stone); return; }

  // ground -> plant flower or candle, conforme o botão de alternar (exige login, só na grama)
  const groundHits = raycaster.intersectObject(world.ground);
  if(groundHits.length){
    const p = groundHits[0].point;
    if(Math.abs(p.x)<BOUNDS && Math.abs(p.z)<BOUNDS && world.isFreeSpot(p.x, p.z, lapides.plots)){
      menuUi.requireAuth(()=>{
        if(menuUi.getPlantMode() === 'vela'){
          world.plantAndSaveVela(p.x, p.z);
          menuUi.chime(440, 0.06);
        } else {
          world.plantAndSaveFlor(p.x, p.z);
          menuUi.chime(520, 0.05);
        }
      });
    }
  }
}
renderer.domElement.addEventListener('click', onClick);

/* ============ RENDER LOOP ============ */
const clock = new THREE.Clock();

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const elapsed = clock.elapsedTime;

  if(!pausedState.value){
    dogController.updateMovement(dt, elapsed);
  } else {
    dogController.orbitIdle(dt);
  }
  dogController.updateCamera(camera, elapsed);

  world.update(dt, elapsed);
  presence.update(dt, elapsed);
  menuUi.updateHints(hoveredEmptyPlot, hoveredStone);

  renderer.render(scene, camera);
}

/* ============ START ============ */
document.getElementById('loading').style.display = 'none';
animate();
