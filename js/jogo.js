"use strict";

/*
  JOGO
  Aqui montamos a cena 3D básica (câmera,
  renderizador), chamamos os outros módulos na ordem certa, ligamos os
  cliques/movimentos do mouse às lápides, e rodamos o loop de animação
  que redesenha o jardim quadro a quadro.
*/
import * as THREE from 'three';
import { createWorld } from './mundo.js';
import { createLapides } from './lapides.js';
import { createDogController } from './cachorros.js';
import { createMenuUi } from './menuUi.js';
import { createAuth } from './auth.js';
import { createPresence } from './presenca.js';
import { obterMapaUi } from './mapa.js';
import { escolherPerfil, criarGovernador, escalaDePixels } from './gfx/qualidade.js';
import { BOUNDS } from './planta.js';
import { criarPos } from './gfx/pos.js';

/* ============ BASIC SETUP ============ */
const appEl = document.getElementById('app');
const scene = new THREE.Scene();

const perfil = escolherPerfil();

// o céu é desenhado no fundo em shader: far só precisa alcançar as colinas
const camera = new THREE.PerspectiveCamera(52, window.innerWidth/window.innerHeight, 0.12, 620);

const renderer = new THREE.WebGLRenderer({ antialias: !perfil.pos, powerPreference: 'high-performance' });
let tetoPixels = 1; // o governador baixa isso quando precisa
const aplicarEscala = () => renderer.setPixelRatio(escalaDePixels(perfil, window.innerWidth, window.innerHeight)*tetoPixels);
aplicarEscala();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// quase tudo que projeta sombra é parado: redesenhar o mapa dia sim, dia não custa
// metade e ninguém percebe
renderer.shadowMap.autoUpdate = false;
let quadroSombra = 0;
appEl.insertBefore(renderer.domElement, appEl.firstChild);

const pos = criarPos(renderer, scene, camera, perfil);

window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  aplicarEscala();
  renderer.setSize(window.innerWidth, window.innerHeight);
  pos.setSize(window.innerWidth, window.innerHeight);
});

/* ============ MÓDULOS DO JOGO ============ */
const world = createWorld(scene, { renderer, perfil, pos });
const lapides = createLapides(scene);
world.scatterFlowers(90, lapides.plots);

// a cerca mora em planta.js, junto com as outras medidas que o mapa usa
const pausedState = { value: true }; // starts on the menu

const dogController = createDogController(scene, renderer, {
  isPaused: () => pausedState.value,
  plaza: world.PLAZA,
  bounds: BOUNDS,
});

const auth = createAuth();
// o mesmo mapa da primeira tela (main.js), agora com as homenagens vivas do jardim
const mapaUi = obterMapaUi();
mapaUi.usarJogo({ lapides, world, dogController });
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
const clock = new THREE.Timer();

function baixarResolucao(fator){
  tetoPixels = fator;
  aplicarEscala();
  renderer.setSize(window.innerWidth, window.innerHeight);
  pos.setSize(window.innerWidth, window.innerHeight);
}

// se o aparelho não sustentar o perfil, desce um degrau de cada vez, do efeito
// que mais pesa e menos se nota pro que mais se nota
const governador = criarGovernador([
  () => pos.desligarAO(),
  () => world.reduzirGrama(0.6),
  () => baixarResolucao(0.8),
  () => pos.desligarBloom(),
  () => world.reduzirGrama(0.5),
  () => baixarResolucao(0.65),
  // último recurso, pra aparelho muito fraco: o mapa de sombra
  () => { renderer.shadowMap.enabled = false; scene.traverse(o => { if(o.material) o.material.needsUpdate = true; }); },
  () => world.reduzirGrama(0), // o chão já tem a cor da grama
]);

function animate(){
  requestAnimationFrame(animate);
  clock.update();
  const dtReal = clock.getDelta();
  const dt = Math.min(0.05, dtReal);
  const elapsed = clock.getElapsed();
  governador.quadro(dtReal);

  if(!pausedState.value && !mapaUi.isOpen()){
    dogController.updateMovement(dt, elapsed);
  } else if(pausedState.value){
    dogController.orbitIdle(dt);
  }
  dogController.updateCamera(camera, elapsed);

  const cao = dogController.getDog();
  world.update(dt, elapsed, camera, cao ? cao.position : null);
  presence.update(dt, elapsed);
  menuUi.updateHints(hoveredEmptyPlot, hoveredStone);

  if((quadroSombra++ & 1) === 0) renderer.shadowMap.needsUpdate = true;
  pos.render(elapsed);
}

/* ============ START ============ */
document.getElementById('loading').style.display = 'none';
animate();
