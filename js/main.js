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

/* ============ BASIC SETUP ============ */
const appEl = document.getElementById('app');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(52, window.innerWidth/window.innerHeight, 0.1, 200);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

const menuUi = createMenuUi({ camera, lapides, world, dogController, pausedState });

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

  // stone -> just show card (handled by hover, but click also fine on touch)
  const stone = lapides.pickStone(raycaster);
  if(stone) return;

  // ground -> plant flower
  const groundHits = raycaster.intersectObject(world.ground);
  if(groundHits.length){
    const p = groundHits[0].point;
    if(Math.abs(p.x)<BOUNDS && Math.abs(p.z)<BOUNDS){
      world.plantFlower(p.x, p.z);
      menuUi.chime(520, 0.05);
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
  dogController.updateCamera(camera);

  world.update(dt, elapsed);
  menuUi.updateHints(hoveredEmptyPlot, hoveredStone);

  renderer.render(scene, camera);
}

/* ============ START ============ */
document.getElementById('loading').style.display = 'none';
animate();
