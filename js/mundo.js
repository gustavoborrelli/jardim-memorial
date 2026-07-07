"use strict";

/*
  MUNDO / CENÁRIO
  Constrói tudo o que forma o ambiente do jardim: céu, luz, chão, caminhos,
  cerca, árvores, bancos, lâmpadas, a praça central com a fonte, os vasos
  de flor, as flores plantáveis e as borboletas.

  createWorld(scene) monta tudo dentro da scene recebida e devolve um
  pequeno "controle remoto" com o que os outros módulos precisam usar:
  o chão (para o raycast de cliques), a praça (para colisão do cachorro),
  e funções para plantar flores / juntar as borboletas perto de uma lápide.
*/

import { supabase } from './supabaseClient.js';

export function createWorld(scene) {

  /* ============ CÉU ============ */
  function makeSkyTexture(){
    const c = document.createElement('canvas');
    c.width = 8; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0,0,0,256);
    g.addColorStop(0, '#3f8edb');
    g.addColorStop(0.45, '#74bdea');
    g.addColorStop(0.75, '#cfe6f2');
    g.addColorStop(1, '#ffe9c9');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,8,256);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog(0xcfe8f5, 42, 115);

  /* ============ LIGHTING ============ */
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0xd9b98a, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe9c2, 1.25);
  sun.position.set(-14, 30, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536,1536);
  sun.shadow.camera.left = -35;
  sun.shadow.camera.right = 35;
  sun.shadow.camera.top = 35;
  sun.shadow.camera.bottom = -35;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0015;
  scene.add(sun);

  // friendly little sun disc up in the sky, purely visual
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 24),
    new THREE.MeshBasicMaterial({color:0xfff2b0, transparent:true, opacity:0.9})
  );
  sunDisc.position.set(-30, 34, -20);
  sunDisc.lookAt(0,10,0);
  scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(4.2, 24),
    new THREE.MeshBasicMaterial({color:0xfff8d8, transparent:true, opacity:0.35})
  );
  sunGlow.position.copy(sunDisc.position);
  sunGlow.lookAt(0,10,0);
  scene.add(sunGlow);

  const fillLight = new THREE.PointLight(0xfff0c0, 0.35, 30);
  fillLight.position.set(0, 6, 20);
  scene.add(fillLight);

  /* low-poly drifting clouds */
  const clouds = [];
  function makeCloud(x,y,z,sc){
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({color:0xffffff, roughness:1});
    [[0,0,0,1],[0.9,0.12,0.25,0.72],[-0.85,0.05,-0.15,0.62],[0.15,0.4,-0.2,0.5]].forEach(([cx,cy,cz,cs])=>{
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9,0), m);
      puff.position.set(cx,cy,cz);
      puff.scale.setScalar(cs);
      g.add(puff);
    });
    g.scale.setScalar(sc);
    g.position.set(x,y,z);
    scene.add(g);
    clouds.push(g);
  }
  makeCloud(-20,16,-32,2.4);
  makeCloud(16,19,-40,3.0);
  makeCloud(32,17,8,2.5);
  makeCloud(-34,21,16,2.8);
  makeCloud(4,23,38,2.3);

  /* ============ GROUND ============ */
  function makeGrassTexture(){
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#6fae4e';
    ctx.fillRect(0,0,256,256);
    for(let i=0;i<3200;i++){
      const x = Math.random()*256, y = Math.random()*256;
      const shade = 110 + Math.random()*80;
      ctx.fillStyle = `rgba(${shade-40},${shade+30},${shade-60},0.5)`;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14,14);
    return tex;
  }
  const groundGeo = new THREE.PlaneGeometry(130, 130, 44, 44);
  {
    const pos = groundGeo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const gx = pos.getX(i), gy = pos.getY(i);
      const d = Math.hypot(gx, gy);
      if(d > 29){
        const t = d - 29;
        pos.setZ(i, t*0.22 + Math.sin(gx*0.33)*Math.cos(gy*0.29)*t*0.12 + Math.random()*0.5);
      }
    }
    groundGeo.computeVertexNormals();
  }
  const groundMat = new THREE.MeshStandardMaterial({color:0x8cb56a, roughness:1});
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* path */
  function makeStoneTexture(){
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#b7ac9c';
    ctx.fillRect(0,0,128,128);
    for(let i=0;i<400;i++){
      const shade = 150 + Math.random()*60;
      ctx.fillStyle = `rgba(${shade},${shade-10},${shade-25},0.4)`;
      ctx.fillRect(Math.random()*128, Math.random()*128, 3,3);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1,7);
    return tex;
  }
  const pathMat = new THREE.MeshStandardMaterial({color:0xe2cfa6, roughness:1});
  // four symmetric avenues radiating from the central plaza (N, S, E, W)
  [[0,-16.5,0],[0,16.5,0],[-16.5,0,Math.PI/2],[16.5,0,Math.PI/2]].forEach(([px,pz,rz])=>{
    const av = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 22), pathMat);
    av.rotation.x = -Math.PI/2;
    av.rotation.z = rz;
    av.position.set(px, 0.02, pz);
    av.receiveShadow = true;
    scene.add(av);
  });

  /* ============ FENCE ============ */
  const fenceMat = new THREE.MeshStandardMaterial({color:0x5b4a3d, roughness:0.9});
  const fenceGroup = new THREE.Group();
  function addFenceRun(x1,z1,x2,z2){
    const len = Math.hypot(x2-x1, z2-z1);
    const postCount = Math.round(len/3);
    for(let i=0;i<=postCount;i++){
      const t = i/postCount;
      const px = x1 + (x2-x1)*t;
      const pz = z1 + (z2-z1)*t;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.11,1.3,6), fenceMat);
      post.position.set(px, 0.65, pz);
      post.castShadow = true;
      fenceGroup.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(
      Math.abs(x2-x1)||0.12, 0.1, Math.abs(z2-z1)||0.12
    ), fenceMat);
    rail.position.set((x1+x2)/2, 0.95, (z1+z2)/2);
    rail.castShadow = true;
    fenceGroup.add(rail);
    const rail2 = rail.clone();
    rail2.position.y = 0.55;
    fenceGroup.add(rail2);
  }
  const B = 27;
  addFenceRun(-B,-B, B,-B);
  addFenceRun(-B, B, -3.2, B);
  addFenceRun(3.2, B, B, B);
  addFenceRun(-B,-B, -B, B);
  addFenceRun(B,-B, B, B);
  scene.add(fenceGroup);

  // gate posts
  [[2.4,B-0.2],[-2.4,B-0.2]].forEach(([x,z])=>{
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.16,2.1,8), fenceMat);
    post.position.set(x,1.05,z);
    post.castShadow = true;
    scene.add(post);
  });
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.2,0.18,0.18), fenceMat);
  lintel.position.set(0, 2.05, B-0.2);
  scene.add(lintel);

  /* ============ TREES ============ */
  function makeTree(x,z,scale=1){
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16*scale, 0.26*scale, 1.4*scale, 5),
      new THREE.MeshStandardMaterial({color:0x6e4a30, roughness:1})
    );
    trunk.position.y = 0.7*scale;
    trunk.castShadow = true;
    g.add(trunk);
    const greens = [0x4e8a4a, 0x5e9e56, 0x74b061];
    const pick = Math.floor(Math.random()*3);
    [[1.5,1.6,1.15],[1.15,1.35,2.05],[0.8,1.1,2.85]].forEach(([r,h,y],i)=>{
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(r*scale, h*scale, 6),
        new THREE.MeshStandardMaterial({color:greens[(i+pick)%3], roughness:0.95})
      );
      cone.position.y = y*scale;
      cone.rotation.y = Math.random()*Math.PI;
      cone.castShadow = true;
      g.add(cone);
    });
    g.position.set(x,0,z);
    return g;
  }
  [[-22,-22,1.2],[22,-22,1],[-22,20,0.9],[22,21,1.15],[-24,2,0.8],[24,-2,0.85]].forEach(([x,z,s])=>{
    scene.add(makeTree(x,z,s));
  });

  // tree-lined avenues: both sides of all four avenues, symmetric
  [9, 15, 21].forEach(d=>{
    [-3.6, 3.6].forEach(off=>{
      const s = 0.6 + Math.random()*0.12;
      scene.add(makeTree(off,  d, s));
      scene.add(makeTree(off, -d, 0.6 + Math.random()*0.12));
      scene.add(makeTree( d, off, 0.6 + Math.random()*0.12));
      scene.add(makeTree(-d, off, 0.6 + Math.random()*0.12));
    });
  });

  /* benches + lamps arranged symmetrically around the central plaza */
  const benchMat = new THREE.MeshStandardMaterial({color:0x6b5744, roughness:0.9});
  function makeBench(){
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.12,0.5), benchMat);
    seat.position.y = 0.45; seat.castShadow = true;
    g.add(seat);
    [[-0.65,-0.2],[0.65,-0.2],[-0.65,0.2],[0.65,0.2]].forEach(([x,z])=>{
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.45,0.08), benchMat);
      leg.position.set(x,0.22,z);
      g.add(leg);
    });
    return g;
  }
  function makeLamp(){
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,2.6,8), fenceMat);
    pole.position.y = 1.3; pole.castShadow = true;
    g.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22,6,5), new THREE.MeshStandardMaterial({
      color:0xffe3b0, emissive:0xffb877, emissiveIntensity:0.6
    }));
    head.position.y = 2.65;
    g.add(head);
    return g;
  }
  // 4 lamps on the diagonals just outside the plaza
  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sz])=>{
    const l = makeLamp();
    l.position.set(sx*5.0, 0, sz*5.0);
    scene.add(l);
  });
  // 4 benches a bit further out on the diagonals, facing the fountain
  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sz])=>{
    const b = makeBench();
    b.position.set(sx*6.4, 0, sz*6.4);
    b.rotation.y = Math.atan2(-sx, -sz) + Math.PI/2;
    scene.add(b);
  });

  /* ============ CENTRAL PLAZA + FOUNTAIN ============ */
  const PLAZA = { x:0, z:0, r:5.5 };

  // circular stone plaza floor
  function makePlazaTexture(){
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c3b8a6';
    ctx.fillRect(0,0,256,256);
    // concentric ring joints, like cobbled plaza
    ctx.strokeStyle = 'rgba(120,108,92,0.55)';
    ctx.lineWidth = 2;
    for(let r=20; r<=128; r+=22){
      ctx.beginPath(); ctx.arc(128,128,r,0,Math.PI*2); ctx.stroke();
    }
    for(let a=0; a<Math.PI*2; a+=Math.PI/10){
      ctx.beginPath();
      ctx.moveTo(128+Math.cos(a)*20, 128+Math.sin(a)*20);
      ctx.lineTo(128+Math.cos(a)*128, 128+Math.sin(a)*128);
      ctx.stroke();
    }
    for(let i=0;i<600;i++){
      const shade = 160+Math.random()*50;
      ctx.fillStyle = `rgba(${shade},${shade-8},${shade-22},0.35)`;
      ctx.fillRect(Math.random()*256, Math.random()*256, 2.5, 2.5);
    }
    return new THREE.CanvasTexture(c);
  }
  const plazaFloor = new THREE.Mesh(
    new THREE.CircleGeometry(PLAZA.r, 24),
    new THREE.MeshStandardMaterial({color:0xd9c49a, roughness:1})
  );
  plazaFloor.rotation.x = -Math.PI/2;
  plazaFloor.position.set(PLAZA.x, 0.03, PLAZA.z);
  plazaFloor.receiveShadow = true;
  scene.add(plazaFloor);
  const plazaRing = new THREE.Mesh(
    new THREE.RingGeometry(PLAZA.r-0.55, PLAZA.r-0.22, 24),
    new THREE.MeshStandardMaterial({color:0xbfa87e, roughness:1})
  );
  plazaRing.rotation.x = -Math.PI/2;
  plazaRing.position.set(PLAZA.x, 0.045, PLAZA.z);
  scene.add(plazaRing);

  // fountain
  const fountain = new THREE.Group();
  const basinMat = new THREE.MeshStandardMaterial({color:0xb8ac98, roughness:0.8});
  const waterMat = new THREE.MeshStandardMaterial({color:0x5fb7e8, roughness:0.15, metalness:0.1, transparent:true, opacity:0.85});

  // outer basin wall
  const basinWall = new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.85,0.5,12,1,true), basinMat);
  basinWall.position.y = 0.25; basinWall.castShadow = true; basinWall.receiveShadow = true;
  fountain.add(basinWall);
  const basinRim = new THREE.Mesh(new THREE.TorusGeometry(1.7,0.1,6,12), basinMat);
  basinRim.rotation.x = Math.PI/2;
  basinRim.position.y = 0.5;
  fountain.add(basinRim);
  const basinFloor = new THREE.Mesh(new THREE.CircleGeometry(1.72,12), basinMat);
  basinFloor.rotation.x = -Math.PI/2;
  basinFloor.position.y = 0.06;
  fountain.add(basinFloor);

  // lower water surface
  const waterLow = new THREE.Mesh(new THREE.CircleGeometry(1.62,12), waterMat);
  waterLow.rotation.x = -Math.PI/2;
  waterLow.position.y = 0.38;
  fountain.add(waterLow);

  // central pedestal + upper bowl
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.26,0.9,7), basinMat);
  pedestal.position.y = 0.5+0.45; pedestal.castShadow = true;
  fountain.add(pedestal);
  const upperBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.3,0.28,10,1,true), basinMat);
  upperBowl.position.y = 1.45; upperBowl.castShadow = true;
  fountain.add(upperBowl);
  const upperWater = new THREE.Mesh(new THREE.CircleGeometry(0.56,10), waterMat.clone());
  upperWater.rotation.x = -Math.PI/2;
  upperWater.position.y = 1.52;
  fountain.add(upperWater);

  // little dog statue on top spouting the jet (a nod to the theme)
  const statueMat = new THREE.MeshStandardMaterial({color:0xd8d0c2, roughness:0.7});
  const statue = new THREE.Group();
  const stBody = new THREE.Mesh(new THREE.SphereGeometry(0.14,6,5), statueMat);
  stBody.scale.set(1,0.8,1.3); stBody.position.y = 0.12;
  statue.add(stBody);
  const stHead = new THREE.Mesh(new THREE.SphereGeometry(0.09,6,5), statueMat);
  stHead.position.set(0,0.24,0.14);
  statue.add(stHead);
  const stSnout = new THREE.Mesh(new THREE.SphereGeometry(0.05,8,6), statueMat);
  stSnout.scale.set(0.8,0.7,1.3); stSnout.position.set(0,0.22,0.24);
  statue.add(stSnout);
  [[-0.05],[0.05]].forEach(([sx])=>{
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035,0.08,5), statueMat);
    ear.position.set(sx,0.33,0.1);
    statue.add(ear);
  });
  statue.position.y = 1.55;
  fountain.add(statue);

  // water jet (cone of water) + droplets
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.05,0.6,8), waterMat.clone());
  jet.position.y = 2.15;
  fountain.add(jet);

  const fountainDrops = [];
  for(let i=0;i<14;i++){
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.035,6,6), waterMat.clone());
    d.userData = { t: Math.random(), speed: 0.5+Math.random()*0.4, angle: Math.random()*Math.PI*2, radius: 0.15+Math.random()*0.45 };
    fountain.add(d);
    fountainDrops.push(d);
  }

  fountain.position.set(PLAZA.x, 0, PLAZA.z);
  scene.add(fountain);

  // four flower pots around the plaza rim
  const potMat = new THREE.MeshStandardMaterial({color:0xb06a48, roughness:0.9});
  [0, Math.PI/2, Math.PI, Math.PI*1.5].forEach(a=>{
    const px = PLAZA.x + Math.cos(a+Math.PI/4)*(PLAZA.r-0.7);
    const pz = PLAZA.z + Math.sin(a+Math.PI/4)*(PLAZA.r-0.7);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.22,0.4,10), potMat);
    pot.position.set(px, 0.2, pz);
    pot.castShadow = true;
    scene.add(pot);
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.32,8,7), new THREE.MeshStandardMaterial({color:0x5f8f4a, roughness:0.95}));
    bush.position.set(px, 0.55, pz);
    bush.castShadow = true;
    scene.add(bush);
    for(let f=0; f<5; f++){
      const dotColor = [0xff6fa5,0xffc93c,0xff8a3d,0xb14fd8,0xffffff][f];
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045,6,5), new THREE.MeshStandardMaterial({color:dotColor, roughness:0.5}));
      const fa = Math.random()*Math.PI*2, fe = Math.random()*Math.PI/2;
      dot.position.set(px+Math.cos(fa)*Math.cos(fe)*0.3, 0.55+Math.sin(fe)*0.3, pz+Math.sin(fa)*Math.cos(fe)*0.3);
      scene.add(dot);
    }
  });

  /* ============ FLOWERS ============ */
  const flowerGroup = new THREE.Group();
  scene.add(flowerGroup);
  const flowerColors = [0xe8547a, 0xf5d020, 0xffffff, 0xb14fd8, 0xff8a3d, 0xff5fa0, 0x6fb7ff, 0xfff066];
  const witheringFlowers = []; // só as plantadas por alguém (persistidas); as decorativas nunca murcham
  const murchaColor = new THREE.Color(0x8a7a5a);

  // lifespan = {murchaEm, expiraEm} em epoch ms; sem isso a flor é só decoração e nunca murcha
  function plantFlower(x, z, instant, color, lifespan){
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.28,5), new THREE.MeshStandardMaterial({color:0x4f6b3f}));
    stem.position.y = 0.14;
    g.add(stem);
    const bloomColor = color != null ? color : flowerColors[Math.floor(Math.random()*flowerColors.length)];
    const bloomMat = new THREE.MeshStandardMaterial({color:bloomColor, roughness:0.6});
    const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085,0), bloomMat);
    bloom.position.y = 0.31;
    bloom.rotation.set(Math.random(), Math.random(), Math.random());
    g.add(bloom);
    const center = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04,0), new THREE.MeshStandardMaterial({color:0xf5c542}));
    center.position.y = 0.40;
    g.add(center);
    g.position.set(x + (Math.random()-0.5)*0.4, 0, z + (Math.random()-0.5)*0.4);
    g.rotation.y = Math.random()*Math.PI*2;
    flowerGroup.add(g);

    if(lifespan){
      g.userData = { murchaEm: lifespan.murchaEm, expiraEm: lifespan.expiraEm, bloomMat, freshColor: new THREE.Color(bloomColor) };
      witheringFlowers.push(g);
    }

    if(instant){ g.scale.setScalar(0.85+Math.random()*0.3); return g; }
    g.scale.setScalar(0);
    const start = performance.now();
    function grow(){
      const t = Math.min(1,(performance.now()-start)/380);
      g.scale.setScalar(t);
      if(t<1) requestAnimationFrame(grow);
    }
    grow();
    return g;
  }

  /* ============ SUPABASE: flores persistentes ============ */
  const DAY_MS = 24*60*60*1000;
  function randomLifespan(){
    return {
      murchaEm: Date.now() + 3*DAY_MS + Math.random()*DAY_MS,   // começa a murchar entre 3 e 4 dias
      expiraEm: Date.now() + 6*DAY_MS + Math.random()*DAY_MS,   // some entre 6 e 7 dias
    };
  }

  // planta na hora (otimista) e salva no banco em segundo plano
  function plantAndSaveFlor(x, z){
    const color = flowerColors[Math.floor(Math.random()*flowerColors.length)];
    const lifespan = randomLifespan();
    plantFlower(x, z, false, color, lifespan);
    supabase.from('flores').insert({
      x, z, cor: color,
      murcha_em: new Date(lifespan.murchaEm).toISOString(),
      expira_em: new Date(lifespan.expiraEm).toISOString(),
    }).then(({ error })=>{
      if(error) console.error('Não foi possível salvar a flor:', error.message);
    });
  }

  async function loadFlores(){
    const { data: rows, error } = await supabase.from('flores').select('*');
    if(error){
      console.error('Não foi possível carregar as flores:', error.message);
      return;
    }
    rows.forEach(row=>{
      plantFlower(Number(row.x), Number(row.z), true, row.cor, {
        murchaEm: new Date(row.murcha_em).getTime(),
        expiraEm: new Date(row.expira_em).getTime(),
      });
    });
  }
  loadFlores();
  function isFreeSpot(x,z,plots){
    if(Math.abs(x) < 2.8 || Math.abs(z) < 2.8) return false; // the four avenues
    if(Math.hypot(x-PLAZA.x, z-PLAZA.z) < PLAZA.r + 0.5) return false; // central plaza
    for(const plot of plots){
      if(Math.hypot(x-plot.x, z-plot.z) < 1.5) return false;
    }
    return true;
  }
  const BOUNDS_FOR_FLOWERS = 25;
  function scatterFlowers(count, plots){
    let placed = 0, tries = 0;
    while(placed < count && tries < count*6){
      tries++;
      const x = (Math.random()-0.5)*2*BOUNDS_FOR_FLOWERS;
      const z = (Math.random()-0.5)*2*BOUNDS_FOR_FLOWERS;
      if(isFreeSpot(x,z,plots)){
        plantFlower(x,z,true);
        placed++;
      }
    }
  }

  /* ============ BUTTERFLIES ============ */
  const fireflyGroup = new THREE.Group();
  scene.add(fireflyGroup);
  const butterflyPalette = [0xff6fa5, 0xffc93c, 0x6fc8ff, 0xff8a3d, 0xb14fd8, 0x6fe3a1];
  const fireflies = [];
  for(let i=0;i<22;i++){
    const m = new THREE.Group();
    const color = butterflyPalette[i % butterflyPalette.length];
    const wingMat = new THREE.MeshStandardMaterial({color, roughness:0.6, side:THREE.DoubleSide});
    const wingL = new THREE.Mesh(new THREE.CircleGeometry(0.09,5), wingMat);
    wingL.position.x = -0.06;
    const wingR = new THREE.Mesh(new THREE.CircleGeometry(0.09,5), wingMat);
    wingR.position.x = 0.06;
    m.add(wingL, wingR);
    const bodyDot = new THREE.Mesh(new THREE.SphereGeometry(0.02,5,5), new THREE.MeshStandardMaterial({color:0x3a2c22}));
    m.add(bodyDot);
    const bx = (Math.random()-0.5)*40, bz = (Math.random()-0.5)*40;
    m.position.set(bx, 0.6+Math.random()*1.6, bz);
    fireflyGroup.add(m);
    fireflies.push({mesh:m, wingL, wingR, baseX:bx, baseZ:bz, phase:Math.random()*Math.PI*2, speed:0.4+Math.random()*0.4});
  }

  /* ============ FIREFLY GATHER EFFECT ============ */
  let gatherTarget = null;
  let gatherUntil = 0;
  function gatherFireflies(x,z){
    gatherTarget = {x, z:z};
    gatherUntil = performance.now() + 3200;
  }

  /* ============ FLOWERS: murchar e sumir ============ */
  function updateWither(){
    const now = Date.now();
    for(let i=witheringFlowers.length-1; i>=0; i--){
      const f = witheringFlowers[i];
      const { murchaEm, expiraEm, bloomMat, freshColor } = f.userData;
      if(now >= expiraEm){
        flowerGroup.remove(f);
        witheringFlowers.splice(i,1);
        continue;
      }
      if(now >= murchaEm){
        if(f.userData.baseScale == null) f.userData.baseScale = f.scale.x;
        const t = Math.min(1, (now-murchaEm)/(expiraEm-murchaEm));
        f.scale.setScalar(f.userData.baseScale * (1 - t*0.55));
        bloomMat.color.copy(freshColor).lerp(murchaColor, t);
      }
    }
  }

  /* ============ PER-FRAME UPDATE ============ */
  function update(dt, elapsed){
    updateWither();
    fireflies.forEach((f,i)=>{
      let tx = f.baseX, tz = f.baseZ;
      if(gatherTarget && performance.now() < gatherUntil && i%2===0){
        tx = gatherTarget.x + Math.sin(elapsed*2+i)*0.6;
        tz = gatherTarget.z + Math.cos(elapsed*2+i)*0.6;
      }
      f.mesh.position.x = tx + Math.sin(elapsed*f.speed+f.phase)*1.4;
      f.mesh.position.z = tz + Math.cos(elapsed*f.speed*0.8+f.phase)*1.4;
      f.mesh.position.y = 0.5 + Math.sin(elapsed*1.3+f.phase)*0.35 + (0.5+0.5*Math.sin(elapsed*0.6+i));
      const flap = Math.sin(elapsed*14+f.phase)*0.8;
      f.wingL.rotation.y = flap;
      f.wingR.rotation.y = -flap;
    });

    // fountain water animation
    fountainDrops.forEach(d=>{
      d.userData.t += dt * d.userData.speed;
      if(d.userData.t > 1){
        d.userData.t = 0;
        d.userData.angle = Math.random()*Math.PI*2;
        d.userData.radius = 0.15 + Math.random()*0.45;
      }
      const t = d.userData.t;
      // parabolic arc: up from the jet, out and down into the basin
      const h = 2.35 + t*0.4 - t*t*2.4;
      const r = d.userData.radius + t*1.1;
      d.position.set(Math.cos(d.userData.angle)*r, Math.max(0.4, h), Math.sin(d.userData.angle)*r);
      d.material.opacity = 0.85 * (1 - t*0.4);
    });
    clouds.forEach(c=>{ c.position.x += dt*0.4; if(c.position.x > 58) c.position.x = -58; });
    waterLow.position.y = 0.38 + Math.sin(elapsed*2.2)*0.012;
    upperWater.position.y = 1.52 + Math.sin(elapsed*3.1)*0.008;
    jet.scale.y = 1 + Math.sin(elapsed*6)*0.08;
  }

  return {
    ground,
    PLAZA,
    plantAndSaveFlor,
    scatterFlowers,
    isFreeSpot,
    gatherFireflies,
    update,
  };
}
