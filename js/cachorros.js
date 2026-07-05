"use strict";

/*
  CACHORROS
  Constrói os três modelos de cachorro (Pastor Alemão, Dachshund, Golden
  Retriever) e controla o movimento do cachorro escolhido: teclado (WASD /
  setas), a câmera que gira ao redor dele (touchpad / roda do mouse / toque)
  e a animação simples de andar (pernas e rabo).

  createDogController(scene, renderer, opts) devolve as funções que
  main.js usa a cada frame para mover o cachorro e atualizar a câmera.
*/

const eyeWhiteMat = new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.4});
const pupilMat = new THREE.MeshStandardMaterial({color:0x231a12, roughness:0.3});
const noseMat = new THREE.MeshStandardMaterial({color:0x2c2018, roughness:0.4});

function addEyes(g, x, y, z){
  [-x, x].forEach(ex=>{
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.052,10,10), eyeWhiteMat);
    white.position.set(ex, y, z);
    g.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028,8,8), pupilMat);
    pupil.position.set(ex, y+0.004, z+0.033);
    g.add(pupil);
  });
}

export function buildDog(breed){
  const g = new THREE.Group();
  const parts = {group:g, legs:[], tail:null, body:null, bodyBaseY:0.42, breed};

  if(breed === 'golden'){
    /* ---- GOLDEN RETRIEVER: warm gold coat, floppy ears, happy feathered tail ---- */
    const fur = new THREE.MeshStandardMaterial({color:0xdfa14e, roughness:0.85});
    const furDark = new THREE.MeshStandardMaterial({color:0xc08339, roughness:0.85});
    const cream = new THREE.MeshStandardMaterial({color:0xf3e3c2, roughness:0.8});

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34,7,6), fur);
    body.scale.set(1, 0.72, 1.35);
    body.position.y = 0.42; body.castShadow = true;
    g.add(body); parts.body = body; parts.bodyBaseY = 0.42;

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.24,6,5), cream);
    chest.scale.set(0.85, 0.55, 1.0);
    chest.position.set(0, 0.28, 0.18);
    g.add(chest);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22,7,6), fur);
    head.scale.set(0.95, 0.9, 0.85);
    head.position.set(0, 0.64, 0.44);
    head.castShadow = true;
    g.add(head);

    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.135,6,5), cream);
    muzzle.scale.set(0.8, 0.68, 1.25);
    muzzle.position.set(0, 0.575, 0.66);
    g.add(muzzle);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05,8,8), noseMat);
    nose.scale.set(1, 0.85, 0.9);
    nose.position.set(0, 0.605, 0.79);
    g.add(nose);

    addEyes(g, 0.095, 0.70, 0.58);

    [-1, 1].forEach(side=>{
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.12,6,5), furDark);
      ear.scale.set(0.5, 1.35, 0.28);
      ear.position.set(side*0.20, 0.62, 0.36);
      ear.rotation.z = side*0.35;
      ear.rotation.x = 0.35;
      ear.castShadow = true;
      g.add(ear);
    });

    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.48, -0.58);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.07,0.36,6), fur);
    seg.position.set(0,0.04,-0.06);
    seg.rotation.x = -1.0;
    tailGroup.add(seg);
    // feathered plume
    const plume = new THREE.Mesh(new THREE.SphereGeometry(0.09,8,7), furDark);
    plume.scale.set(0.7,1.5,0.7);
    plume.position.set(0, 0.26, -0.26);
    plume.rotation.x = -0.7;
    tailGroup.add(plume);
    g.add(tailGroup); parts.tail = tailGroup;

    [[-0.17,-0.28],[0.17,-0.28],[-0.17,0.26],[0.17,0.26]].forEach(([x,z])=>{
      const legG = new THREE.Group();
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.065,0.3,7), fur);
      leg.position.y = 0.15; leg.castShadow = true;
      legG.add(leg);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.07,8,7), cream);
      paw.scale.set(1,0.6,1.1); paw.position.y = 0.02;
      legG.add(paw);
      legG.position.set(x, 0.17, z);
      g.add(legG); parts.legs.push(legG);
    });
  }

  else if(breed === 'shepherd'){
    /* ---- PASTOR ALEMÃO: tan + black saddle, erect ears, dark mask, low bushy tail ---- */
    const tan = new THREE.MeshStandardMaterial({color:0xc0803d, roughness:0.85});
    const black = new THREE.MeshStandardMaterial({color:0x2b2320, roughness:0.85});
    const tanLight = new THREE.MeshStandardMaterial({color:0xd6a468, roughness:0.85});

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34,7,6), tan);
    body.scale.set(1, 0.74, 1.45);
    body.position.y = 0.44; body.castShadow = true;
    g.add(body); parts.body = body; parts.bodyBaseY = 0.44;

    // black saddle draped over the back — the breed signature
    const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.31,6,5), black);
    saddle.scale.set(1.02, 0.52, 1.15);
    saddle.position.set(0, 0.56, -0.08);
    g.add(saddle);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.22,6,5), tanLight);
    chest.scale.set(0.85, 0.55, 0.95);
    chest.position.set(0, 0.30, 0.22);
    g.add(chest);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22,7,6), tan);
    head.scale.set(0.92, 0.9, 0.92);
    head.position.set(0, 0.68, 0.48);
    head.castShadow = true;
    g.add(head);

    // longer wolfish muzzle with black mask on top
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.125,6,5), tan);
    muzzle.scale.set(0.72, 0.6, 1.5);
    muzzle.position.set(0, 0.60, 0.72);
    g.add(muzzle);
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.105,6,5), black);
    mask.scale.set(0.68, 0.5, 1.3);
    mask.position.set(0, 0.645, 0.72);
    g.add(mask);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05,8,8), noseMat);
    nose.scale.set(1, 0.85, 0.9);
    nose.position.set(0, 0.625, 0.89);
    g.add(nose);

    addEyes(g, 0.09, 0.74, 0.62);

    // tall erect triangular ears — unmistakably a shepherd
    [-1, 1].forEach(side=>{
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.085,0.24,6), black);
      ear.position.set(side*0.115, 0.90, 0.42);
      ear.rotation.z = side*-0.12;
      ear.castShadow = true;
      g.add(ear);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.045,0.13,5), tanLight);
      inner.position.set(side*0.115, 0.885, 0.445);
      g.add(inner);
    });

    // bushy tail carried low
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.42, -0.66);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.07,0.46,6), black);
    seg.position.set(0,-0.14,-0.10);
    seg.rotation.x = -2.55;
    tailGroup.add(seg);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06,8,6), black);
    tip.position.set(0, -0.32, -0.20);
    tailGroup.add(tip);
    g.add(tailGroup); parts.tail = tailGroup;

    [[-0.17,-0.30],[0.17,-0.30],[-0.17,0.28],[0.17,0.28]].forEach(([x,z])=>{
      const legG = new THREE.Group();
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.065,0.32,7), tan);
      leg.position.y = 0.16; leg.castShadow = true;
      legG.add(leg);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.068,8,7), black);
      paw.scale.set(1,0.6,1.1); paw.position.y = 0.02;
      legG.add(paw);
      legG.position.set(x, 0.17, z);
      g.add(legG); parts.legs.push(legG);
    });
  }

  else {
    /* ---- DACHSHUND: long low body, stubby legs, long muzzle, huge floppy ears ---- */
    const choc = new THREE.MeshStandardMaterial({color:0x8a4a26, roughness:0.85});
    const chocDark = new THREE.MeshStandardMaterial({color:0x5f3014, roughness:0.85});
    const chocLight = new THREE.MeshStandardMaterial({color:0xb06f3e, roughness:0.85});

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.30,7,6), choc);
    body.scale.set(0.9, 0.68, 2.35);
    body.position.y = 0.30; body.castShadow = true;
    g.add(body); parts.body = body; parts.bodyBaseY = 0.30;

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.19,6,5), chocLight);
    chest.scale.set(0.8, 0.5, 1.4);
    chest.position.set(0, 0.18, 0.22);
    g.add(chest);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.175,7,6), choc);
    head.scale.set(0.9, 0.9, 1.0);
    head.position.set(0, 0.46, 0.74);
    head.castShadow = true;
    g.add(head);

    // extra-long muzzle — classic sausage-dog profile
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.10,6,5), choc);
    muzzle.scale.set(0.75, 0.6, 2.0);
    muzzle.position.set(0, 0.41, 0.97);
    g.add(muzzle);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045,8,8), noseMat);
    nose.position.set(0, 0.425, 1.16);
    g.add(nose);

    addEyes(g, 0.078, 0.52, 0.86);

    // very long floppy ears hanging past the jaw
    [-1, 1].forEach(side=>{
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11,6,5), chocDark);
      ear.scale.set(0.42, 1.75, 0.24);
      ear.position.set(side*0.155, 0.40, 0.68);
      ear.rotation.z = side*0.22;
      ear.rotation.x = 0.18;
      ear.castShadow = true;
      g.add(ear);
    });

    // thin tail angled up
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.36, -0.72);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.032,0.42,5), choc);
    seg.position.set(0,0.12,-0.10);
    seg.rotation.x = -0.85;
    tailGroup.add(seg);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03,6,5), chocDark);
    tip.position.set(0, 0.30, -0.24);
    tailGroup.add(tip);
    g.add(tailGroup); parts.tail = tailGroup;

    // stubby little legs
    [[-0.14,-0.48],[0.14,-0.48],[-0.14,0.44],[0.14,0.44]].forEach(([x,z])=>{
      const legG = new THREE.Group();
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.048,0.055,0.17,7), choc);
      leg.position.y = 0.085; leg.castShadow = true;
      legG.add(leg);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.058,8,7), chocDark);
      paw.scale.set(1,0.6,1.1); paw.position.y = 0.015;
      legG.add(paw);
      legG.position.set(x, 0.09, z);
      g.add(legG); parts.legs.push(legG);
    });
  }

  return parts;
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

  const keys = {};
  window.addEventListener('keydown', e=>{ keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()] = false; });

  // Trackpad: swipe with two fingers to look around (fires as a 'wheel' event in browsers)
  renderer.domElement.addEventListener('wheel', e=>{
    e.preventDefault();
    if(isPaused()) return;
    camAzimuth -= e.deltaX*0.003;
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
    camAzimuth -= dx*0.006;
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

  function updateMovement(dt, elapsed){
    if(!dog || !dogParts) return;
    let moveX=0, moveZ=0;
    if(keys['w']||keys['arrowup']) moveZ -= 1;
    if(keys['s']||keys['arrowdown']) moveZ += 1;
    if(keys['a']||keys['arrowleft']) moveX -= 1;
    if(keys['d']||keys['arrowright']) moveX += 1;

    const moving = (moveX!==0 || moveZ!==0);
    if(moving){
      // movement relative to camera azimuth so controls feel natural
      const len = Math.hypot(moveX,moveZ) || 1;
      moveX/=len; moveZ/=len;
      const worldX = moveX*Math.cos(camAzimuth) + moveZ*Math.sin(camAzimuth);
      const worldZ = -moveX*Math.sin(camAzimuth) + moveZ*Math.cos(camAzimuth);
      const speed = 3.2;
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

      const targetYaw = Math.atan2(worldX, worldZ);
      let diff = targetYaw - dogYaw;
      while(diff>Math.PI) diff-=Math.PI*2;
      while(diff<-Math.PI) diff+=Math.PI*2;
      dogYaw += diff*Math.min(1, dt*8);
      dog.rotation.y = dogYaw;

      dogParts.legs.forEach((leg, i)=>{
        const phase = i%2===0? elapsed*9 : elapsed*9+Math.PI;
        leg.rotation.x = Math.sin(phase)*0.5;
      });
      dogParts.tail.rotation.z = Math.sin(elapsed*10)*0.25;
    } else {
      dogParts.legs.forEach(leg=> leg.rotation.x *= 0.8);
      dogParts.tail.rotation.z = Math.sin(elapsed*3)*0.18;
    }
    dogParts.body.position.y = dogParts.bodyBaseY + Math.sin(elapsed*(moving?9:2))*(moving?0.015:0.008);
  }

  function updateCamera(camera){
    const tx = dog ? dog.position.x : plaza.x;
    const tz = dog ? dog.position.z : plaza.z;
    const target = new THREE.Vector3(tx, 0.9, tz);
    const cx = target.x + camDist*Math.sin(camAzimuth)*Math.cos(camElevation);
    const cz = target.z + camDist*Math.cos(camAzimuth)*Math.cos(camElevation);
    const cy = target.y + camDist*Math.sin(camElevation) + 1.1;
    camera.position.set(cx,cy,cz);
    camera.lookAt(target.x, target.y+0.3, target.z);
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
    getDog: () => dog,
    updateMovement,
    updateCamera,
    orbitIdle,
    consumeTouchMoved,
  };
}
