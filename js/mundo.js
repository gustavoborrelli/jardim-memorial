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
  // o gradiente do céu agora é repintável: a hora do dia (bloco "RELÓGIO DO
  // JARDIM", mais abaixo) troca as cores das mesmas 5 paradas do degradê
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 8; skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d');
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.magFilter = THREE.LinearFilter;
  scene.background = skyTex;
  const SKY_OFFSETS = [0, 0.38, 0.68, 0.86, 1];
  function paintSky(colors){
    const g = skyCtx.createLinearGradient(0,0,0,256);
    SKY_OFFSETS.forEach((o,i)=> g.addColorStop(o, '#'+colors[i].getHexString()));
    skyCtx.fillStyle = g;
    skyCtx.fillRect(0,0,8,256);
    skyTex.needsUpdate = true;
  }
  scene.fog = new THREE.Fog(0xe8b98f, 36, 122);

  /* ============ LIGHTING ============ */
  // luz de ambiente (céu/chão) puxando pro quente, senão a sombra parece cinza morta
  const hemi = new THREE.HemisphereLight(0xcfc4ff, 0xd9b471, 0.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffcf8e, 1.0);
  sun.position.set(-16, 24, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left = -35;
  sun.shadow.camera.right = 35;
  sun.shadow.camera.top = 35;
  sun.shadow.camera.bottom = -35;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0015;
  sun.shadow.radius = 3.2;
  scene.add(sun);

  // luz de contorno fria e suave do lado oposto ao sol, só pra separar as
  // formas na sombra do dourado geral (contraste quente/frio, sem ficar dura)
  const rimLight = new THREE.DirectionalLight(0x8fb4dd, 0.15);
  rimLight.position.set(18, 14, -14);
  scene.add(rimLight);

  // friendly little sun disc up in the sky, purely visual
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 24),
    new THREE.MeshBasicMaterial({color:0xfff1c4, transparent:true, opacity:0.92})
  );
  sunDisc.position.set(-32, 26, -22);
  sunDisc.lookAt(0,10,0);
  scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(5.4, 24),
    new THREE.MeshBasicMaterial({color:0xffcf95, transparent:true, opacity:0.3})
  );
  sunGlow.position.copy(sunDisc.position);
  sunGlow.lookAt(0,10,0);
  scene.add(sunGlow);

  const fillLight = new THREE.PointLight(0xffdca0, 0.2, 30);
  fillLight.position.set(0, 6, 20);
  scene.add(fillLight);

  /* low-poly drifting clouds */
  const clouds = [];
  const cloudMats = []; // tingidas pela hora do dia (branco → rosado → azulado)
  function makeCloud(x,y,z,sc){
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({color:0xffffff, roughness:1});
    cloudMats.push(m);
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
    c.width = c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#74a852';
    ctx.fillRect(0,0,512,512);

    // manchas macias de relevo, poucas e bem contrastadas, sem empilhar
    // camadas translúcidas demais (isso é o que deixava tudo acinzentado)
    const patches = [
      ['#82b862', 20], ['#5f9847', 16], ['#8fc06a', 12],
    ];
    patches.forEach(([color, count])=>{
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      for(let i=0;i<count;i++){
        const x = Math.random()*512, y = Math.random()*512, r = 20+Math.random()*44;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r*(0.6+Math.random()*0.4), Math.random()*Math.PI, 0, Math.PI*2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;

    // grão fino por cima, quente (tira o aspecto "plano demais")
    for(let i=0;i<4200;i++){
      const x = Math.random()*512, y = Math.random()*512;
      const dark = Math.random() < 0.5;
      ctx.fillStyle = dark ? 'rgba(60,96,44,0.3)' : 'rgba(158,196,110,0.35)';
      ctx.fillRect(x, y, 1.8, 1.8);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16,16);
    return tex;
  }
  const groundGeo = new THREE.PlaneGeometry(130, 130, 44, 44);
  {
    // relevo elevado só bem longe da cerca (cerca vai até ±27, diagonal até
    // ~38.2) — antes começava em d>29 e "comia" a cerca nos cantos; agora só
    // sobe depois de d>44, sempre fora da área caminhável do jardim.
    const RISE_START = 44;
    const pos = groundGeo.attributes.position;
    // manchas de tom em larga escala pintadas por vértice: a textura repete a
    // cada ~8 unidades e não consegue variar em escala de jardim. Ruído suave
    // em duas frequências (manchas de ~7 e ~13 unidades) alterna trechos mais
    // secos/quentes com trechos de verde mais fundo, como gramado de verdade.
    const tones = new Float32Array(pos.count*3);
    for(let i=0;i<pos.count;i++){
      const gx = pos.getX(i), gy = pos.getY(i);
      const d = Math.hypot(gx, gy);
      if(d > RISE_START){
        const t = d - RISE_START;
        pos.setZ(i, t*0.22 + Math.sin(gx*0.33)*Math.cos(gy*0.29)*t*0.12 + Math.random()*0.5);
      }
      let n = 0.55*Math.sin(gx*0.25+2.1)*Math.sin(gy*0.21+0.7)
            + 0.45*Math.sin(gx*0.43-1.3)*Math.sin(gy*0.38+3.0);
      // o produto de senos passa tempo demais perto de zero e o tonemapping
      // achata o resto — amplifica e satura pra mancha existir de verdade
      n = Math.max(-1, Math.min(1, n*1.5));
      if(n >= 0){
        // trecho seco/ensolarado: puxa pro amarelo, tira azul
        tones[i*3]   = 1 + 0.28*n;
        tones[i*3+1] = 1 + 0.10*n;
        tones[i*3+2] = 1 - 0.16*n;
      } else {
        // trecho úmido: verde mais fundo — escurece sem azular (azul a mais
        // deixava a grama com cara de cinza-lavado nos testes)
        tones[i*3]   = 1 + 0.34*n;
        tones[i*3+1] = 1 + 0.08*n;
        tones[i*3+2] = 1 + 0.10*n;
      }
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(tones, 3));
    groundGeo.computeVertexNormals();
  }
  const groundMat = new THREE.MeshStandardMaterial({color:0x8fb56d, roughness:1, vertexColors:true});
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* path */
  function makeStoneTexture(){
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d9c7a0';
    ctx.fillRect(0,0,256,256);
    // desgaste: uma faixa mais clara no centro do caminho (pisada) e
    // bordas mais escuras/terrosas se misturando com a grama
    const wear = ctx.createLinearGradient(0,0,256,0);
    wear.addColorStop(0, 'rgba(120,96,58,0.28)');
    wear.addColorStop(0.5, 'rgba(255,240,205,0.35)');
    wear.addColorStop(1, 'rgba(120,96,58,0.28)');
    ctx.fillStyle = wear;
    ctx.fillRect(0,0,256,256);
    for(let i=0;i<820;i++){
      const shade = 150 + Math.random()*70;
      ctx.fillStyle = `rgba(${shade},${shade-14},${shade-32},0.35)`;
      ctx.fillRect(Math.random()*256, Math.random()*256, 2.6,2.6);
    }
    // pedrinhas esparsas
    for(let i=0;i<26;i++){
      const x = Math.random()*256, y = Math.random()*256, r = 2+Math.random()*3.5;
      ctx.fillStyle = 'rgba(150,130,100,0.5)';
      ctx.beginPath(); ctx.ellipse(x,y,r,r*0.7,Math.random()*Math.PI,0,Math.PI*2); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1,7);
    return tex;
  }
  const pathMat = new THREE.MeshStandardMaterial({map:makeStoneTexture(), color:0xe2cfa6, roughness:1});
  // four symmetric avenues radiating from the central plaza (N, S, E, W)
  [[0,-16.5,0],[0,16.5,0],[-16.5,0,Math.PI/2],[16.5,0,Math.PI/2]].forEach(([px,pz,rz])=>{
    const av = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 22), pathMat);
    av.rotation.x = -Math.PI/2;
    av.rotation.z = rz;
    av.position.set(px, 0.02, pz);
    av.receiveShadow = true;
    scene.add(av);
  });
  // mesmo layout de cima, só descrito como retângulo (x,z = centro; w,l =
  // extensão nos eixos x/z já considerando a rotação) pro mapa 2D desenhar
  // sem duplicar a lógica de rotação da malha 3D
  const AVENUES = [
    { x:0, z:-16.5, w:4.2, l:22 },
    { x:0, z:16.5, w:4.2, l:22 },
    { x:-16.5, z:0, w:22, l:4.2 },
    { x:16.5, z:0, w:22, l:4.2 },
  ];

  /* ============ JARDINEIRAS DAS AVENIDAS ============ */
  // canteiros elevados ladeando as avenidas: jardineiras de terracota (mesmo
  // barro dos vasos da praça), em fileira com pequenos vãos entre uma e
  // outra, com terra dentro e as flores plantadas em cima. A 1ª versão era
  // uma faixa rasa de terra direto no chão e lia como tábua de madeira.
  // Caixas e flores são InstancedMesh — tudo custa 6 draw calls, o que
  // importa no celular. Por isso as flores também ficam fora do balanço de
  // vento do flowerGroup (matriz estática); numa massa densa de cor a
  // quietude não aparece.
  const BED_H = 0.27; // altura da terra: as flores nascem daqui pra cima
  {
    const EDGE = 2.55; // distância do centro da avenida à linha das jardineiras
    // trechos [início, fim] medidos a partir da praça. Os vãos maiores deixam
    // livres as entradas dos arcos das seções (|z|≈12, só existem nas
    // avenidas norte-sul) e a frente dos bancos (|z|=18 nas N-S; |x|=12 e 18
    // nas L-O).
    const RUNS_NS = [[6.6,10.3],[13.7,17.1],[18.9,25.6]];
    const RUNS_EW = [[6.6,11.1],[12.9,17.1],[18.9,25.6]];
    const boxes = [];    // {x, z, len, alongZ} de cada jardineira
    const bedSpots = []; // posição de cada flor, na ordem das jardineiras
    function addRun(alongZ, sign, edge, a, b){
      const len = b - a;
      const n = Math.max(1, Math.round(len/2.6)); // jardineiras de ~2.6
      const boxLen = (len - (n-1)*0.35)/n;
      for(let i=0;i<n;i++){
        const start = a + i*(boxLen+0.35);
        const mid = sign*(start + boxLen/2);
        boxes.push(alongZ ? {x:edge, z:mid, len:boxLen, alongZ} : {x:mid, z:edge, len:boxLen, alongZ});
        for(let d=start+0.24; d<start+boxLen-0.2; d+=0.4+Math.random()*0.12){
          const off = edge + (Math.random()-0.5)*0.3;
          const along = sign*d;
          bedSpots.push(alongZ ? {x:off, z:along} : {x:along, z:off});
        }
      }
    }
    [1,-1].forEach(sign=>{
      [-EDGE, EDGE].forEach(edge=>{
        RUNS_NS.forEach(([a,b])=> addRun(true, sign, edge, a, b));
        RUNS_EW.forEach(([a,b])=> addRun(false, sign, edge, a, b));
      });
    });

    // corpo de terracota + borda saliente + terra escura dentro; a caixa
    // unitária estica no eixo do comprimento via escala por instância
    const bodies = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.6,0.24,1),
      new THREE.MeshStandardMaterial({color:0xb06a48, roughness:0.9}),
      boxes.length
    );
    bodies.castShadow = true;
    const lips = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.68,0.05,1),
      new THREE.MeshStandardMaterial({color:0x9c5c3e, roughness:0.9}),
      boxes.length
    );
    const soils = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.52,0.03,1),
      new THREE.MeshStandardMaterial({color:0x5f452f, roughness:1}),
      boxes.length
    );
    const boxDummy = new THREE.Object3D();
    boxes.forEach((bx,i)=>{
      boxDummy.position.set(bx.x, 0, bx.z);
      boxDummy.rotation.set(0, bx.alongZ ? 0 : Math.PI/2, 0);
      boxDummy.position.y = 0.12;
      boxDummy.scale.set(1, 1, bx.len);
      boxDummy.updateMatrix();
      bodies.setMatrixAt(i, boxDummy.matrix);
      boxDummy.position.y = 0.245;
      boxDummy.scale.set(1, 1, bx.len + 0.06);
      boxDummy.updateMatrix();
      lips.setMatrixAt(i, boxDummy.matrix);
      boxDummy.position.y = BED_H;
      boxDummy.scale.set(1, 1, bx.len - 0.1);
      boxDummy.updateMatrix();
      soils.setMatrixAt(i, boxDummy.matrix);
    });
    scene.add(bodies, lips, soils);

    const BED_COLORS = [0xe8547a, 0xf5d020, 0xffffff, 0xb14fd8, 0xff8a3d, 0x6fb7ff];
    const stems = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.02,0.02,0.28,5),
      new THREE.MeshStandardMaterial({color:0x4f6b3f}),
      bedSpots.length
    );
    const blooms = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.085,0),
      new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.6}),
      bedSpots.length
    );
    const bedCenters = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.04,0),
      new THREE.MeshStandardMaterial({color:0xf5c542}),
      bedSpots.length
    );
    const dummy = new THREE.Object3D();
    const runColor = new THREE.Color();
    let runLeft = 0, lastPick = -1;
    bedSpots.forEach((s,i)=>{
      if(runLeft-- <= 0){
        let pick;
        do { pick = Math.floor(Math.random()*BED_COLORS.length); } while(pick === lastPick);
        lastPick = pick;
        runColor.set(BED_COLORS[pick]);
        runLeft = 3 + Math.floor(Math.random()*3);
      }
      const sc = 0.85 + Math.random()*0.3;
      dummy.scale.setScalar(sc);
      dummy.rotation.set(0, Math.random()*Math.PI*2, 0);
      dummy.position.set(s.x, BED_H + 0.14*sc, s.z);
      dummy.updateMatrix();
      stems.setMatrixAt(i, dummy.matrix);
      dummy.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
      dummy.position.set(s.x, BED_H + 0.31*sc, s.z);
      dummy.updateMatrix();
      blooms.setMatrixAt(i, dummy.matrix);
      blooms.setColorAt(i, runColor);
      dummy.rotation.set(0,0,0);
      dummy.position.set(s.x, BED_H + 0.40*sc, s.z);
      dummy.updateMatrix();
      bedCenters.setMatrixAt(i, dummy.matrix);
    });
    scene.add(stems, blooms, bedCenters);
  }

  /* ============ FENCE ============ */
  const fenceMat = new THREE.MeshStandardMaterial({color:0x5b4a3d, roughness:0.9});
  const fenceGroup = new THREE.Group();
  const birdPerches = []; // topo de alguns mourões — pontos de pouso dos passarinhos
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
      // remate torneado no topo, como mourão de cerca de jardim de verdade —
      // tira o ar de "estaca cortada"
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.1,6,5), fenceMat);
      finial.position.set(px, 1.32, pz);
      fenceGroup.add(finial);
      if(i % 3 === 0) birdPerches.push({ x:px, y:1.46, z:pz });
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
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.16,6,5), fenceMat);
    finial.position.set(x, 2.16, z);
    scene.add(finial);
  });
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.2,0.18,0.18), fenceMat);
  lintel.position.set(0, 2.05, B-0.2);
  scene.add(lintel);

  /* ============ TREES ============ */
  // três variedades pra dar mais vida ao jardim: pinheiro (a original),
  // frondosa (copa redonda, mais sombra) e cerejeira (florida, um toque
  // alegre e colorido) — escolhidas por ficarem bonitas e leves, sem pesar
  // o tom contemplativo do lugar.
  // vida ambiente: toda árvore balança de leve com o vento (rotação sutil
  // na base do grupo, fase/velocidade próprias pra não parecer coreografia)
  const swayingTrees = [];
  function makeTree(x,z,scale=1,type){
    const g = new THREE.Group();
    const t = type || 'pine';

    if(t === 'blossom'){
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13*scale, 0.2*scale, 1.05*scale, 6),
        new THREE.MeshStandardMaterial({color:0x6b5044, roughness:1})
      );
      trunk.position.y = 0.53*scale;
      trunk.rotation.z = 0.08;
      trunk.castShadow = true;
      g.add(trunk);
      const pinks = [0xffc4d6, 0xffb7c5, 0xffd9e6, 0xffe6ee];
      [[0.05,1.05,0,0.95],[0.65,0.75,0.25,0.62],[-0.55,0.7,-0.2,0.66],[0.15,1.4,-0.25,0.58],[-0.3,1.3,0.35,0.55]].forEach(([px,py,pz,ps],i)=>{
        const puff = new THREE.Mesh(
          new THREE.IcosahedronGeometry(ps*scale,0),
          new THREE.MeshStandardMaterial({color:pinks[i%pinks.length], roughness:0.7})
        );
        puff.position.set(px*scale, py*scale + 0.5*scale, pz*scale);
        puff.castShadow = true;
        g.add(puff);
      });
      const dotMat = new THREE.MeshStandardMaterial({color:0xff6fa0, roughness:0.5});
      for(let i=0;i<8;i++){
        const dot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08*scale,0), dotMat);
        const a = Math.random()*Math.PI*2, r = (0.45+Math.random()*0.55)*scale, y = (1.1+Math.random()*0.85)*scale;
        dot.position.set(Math.cos(a)*r, y, Math.sin(a)*r);
        g.add(dot);
      }
    } else if(t === 'leafy'){
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16*scale, 0.24*scale, 1.0*scale, 6),
        new THREE.MeshStandardMaterial({color:0x6b4a34, roughness:1})
      );
      trunk.position.y = 0.5*scale;
      trunk.castShadow = true;
      g.add(trunk);
      const greens = [0x5e9e56, 0x74b061, 0x8fc06a, 0x4e8a4a];
      [[0,0.95,0,1.05],[0.62,0.65,0.2,0.7],[-0.6,0.6,-0.25,0.72],[0.1,1.35,-0.3,0.65],[-0.35,1.25,0.4,0.6]].forEach(([px,py,pz,ps],i)=>{
        const puff = new THREE.Mesh(
          new THREE.IcosahedronGeometry(ps*scale,0),
          new THREE.MeshStandardMaterial({color:greens[i%greens.length], roughness:0.95})
        );
        puff.position.set(px*scale, py*scale + 0.5*scale, pz*scale);
        puff.castShadow = true;
        g.add(puff);
      });
    } else {
      // cipreste/tuia de alameda: silhueta alta que afunila, mas feita de
      // gomos arredondados em vez dos cones de pinheiro de antes — pontas
      // liam como algo hostil, e árvore de alameda de jardim real (cipreste,
      // tuia) tem justamente esse corpo cheio de topo redondo
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16*scale, 0.26*scale, 1.4*scale, 5),
        new THREE.MeshStandardMaterial({color:0x6e4a30, roughness:1})
      );
      trunk.position.y = 0.7*scale;
      trunk.castShadow = true;
      g.add(trunk);
      const greens = [0x4e8a4a, 0x5e9e56, 0x74b061];
      const pick = Math.floor(Math.random()*3);
      [[1.15,0.75,1.35],[0.9,0.8,2.15],[0.6,1,2.8]].forEach(([r,sy,y],i)=>{
        const puff = new THREE.Mesh(
          new THREE.IcosahedronGeometry(r*scale, 0),
          new THREE.MeshStandardMaterial({color:greens[(i+pick)%3], roughness:0.95})
        );
        puff.scale.y = sy;
        puff.position.y = y*scale;
        puff.rotation.y = Math.random()*Math.PI;
        puff.castShadow = true;
        g.add(puff);
      });
    }
    g.position.set(x,0,z);
    swayingTrees.push({ g, phase: Math.random()*Math.PI*2, speed: 0.8+Math.random()*0.6, amp: 0.008+Math.random()*0.008 });
    return g;
  }
  // uma cerejeira grande em cada um dos quatro jardins (seções de lápides),
  // como marco colorido e alegre na árvore mais isolada de cada um; as duas
  // árvores extras junto às avenidas continuam pinheiro
  const BLOSSOM_SPOTS = [[-22,-22,1.5],[22,-22,1.5],[-22,20,1.5],[22,21,1.5]];
  BLOSSOM_SPOTS.forEach(([x,z,s])=> scene.add(makeTree(x,z,s,'blossom')));
  [[-24,2,0.8],[24,-2,0.85]].forEach(([x,z,s])=> scene.add(makeTree(x,z,s,'pine')));

  /* vida ambiente: pétalas caindo devagar das cerejeiras — cada uma nasce
     num ponto aleatório da copa, cai rodopiando com deriva de vento, deita
     no chão por alguns segundos desbotando e renasce lá em cima */
  const petals = [];
  {
    const petalGeo = new THREE.PlaneGeometry(0.09, 0.07);
    const petalPinks = [0xffb7c5, 0xffc4d6, 0xffd9e6];
    BLOSSOM_SPOTS.forEach(([bx,bz,bs])=>{
      for(let i=0;i<7;i++){
        const m = new THREE.Mesh(petalGeo, new THREE.MeshBasicMaterial({
          color: petalPinks[i%petalPinks.length], transparent:true, opacity:0.9, side:THREE.DoubleSide
        }));
        const p = {
          mesh: m, baseX: bx, baseZ: bz, scale: bs,
          phase: Math.random()*Math.PI*2,
          fallSpeed: 0.18+Math.random()*0.1,
          spin: 1.5+Math.random()*2,
          state: 'falling', rest: 0,
        };
        respawnPetal(p, true);
        petals.push(p);
        scene.add(m);
      }
    });
  }
  function respawnPetal(p, scatterY){
    const a = Math.random()*Math.PI*2, r = Math.random()*1.1*p.scale;
    p.mesh.position.set(
      p.baseX + Math.cos(a)*r,
      (1.1 + Math.random()*0.8)*p.scale + (scatterY ? -Math.random()*1.5 : 0),
      p.baseZ + Math.sin(a)*r
    );
    p.mesh.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
    p.mesh.material.opacity = 0.9;
    p.state = 'falling';
  }

  // tree-lined avenues: sempre pinheiros, ladeando a fonte e os caminhos
  [9, 15, 21].forEach(d=>{
    [-3.6, 3.6].forEach(off=>{
      const s = 0.6 + Math.random()*0.12;
      scene.add(makeTree(off,  d, s, 'pine'));
      scene.add(makeTree(off, -d, 0.6 + Math.random()*0.12, 'pine'));
      scene.add(makeTree( d, off, 0.6 + Math.random()*0.12, 'pine'));
      scene.add(makeTree(-d, off, 0.6 + Math.random()*0.12, 'pine'));
    });
  });

  /* pequenos detalhes espalhados pelo gramado — pedrinhas e tufos de grama,
     só pra quebrar a repetição da textura e dar profundidade ao chão */
  function scatterGroundDetail(){
    const pebbleMat = new THREE.MeshStandardMaterial({color:0xb7ab90, roughness:0.9});
    const tuftMats = [0x5e9450, 0x74a85e, 0x8fae5a].map(c=> new THREE.MeshStandardMaterial({color:c, roughness:0.95}));
    let placed = 0, tries = 0;
    while(placed < 70 && tries < 500){
      tries++;
      const x = (Math.random()-0.5)*2*24;
      const z = (Math.random()-0.5)*2*24;
      if(Math.abs(x) < 3.2 || Math.abs(z) < 3.2) continue; // avenidas
      if(Math.hypot(x,z) < PLAZA_R_GUARD) continue; // praça
      placed++;
      if(Math.random() < 0.45){
        const peb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08+Math.random()*0.07,0), pebbleMat);
        peb.scale.y = 0.55;
        peb.position.set(x, 0.04, z);
        peb.rotation.y = Math.random()*Math.PI;
        peb.receiveShadow = true;
        scene.add(peb);
      } else {
        // moitinha baixa de gomos redondos em vez das lâminas-cone de antes
        // (espinhos minúsculos espalhados pelo gramado inteiro somavam ao ar
        // pontiagudo geral) — lê como trevo/touceira cheia, não como espeto
        const tuft = new THREE.Group();
        const mat = tuftMats[Math.floor(Math.random()*tuftMats.length)];
        const clumps = 2 + Math.floor(Math.random()*2);
        for(let b=0;b<clumps;b++){
          const clump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06+Math.random()*0.03,0), mat);
          clump.scale.y = 0.7;
          clump.position.set((Math.random()-0.5)*0.14, 0.05, (Math.random()-0.5)*0.14);
          clump.rotation.y = Math.random()*Math.PI;
          tuft.add(clump);
        }
        tuft.position.set(x,0,z);
        tuft.rotation.y = Math.random()*Math.PI;
        scene.add(tuft);
      }
    }
  }
  const PLAZA_R_GUARD = 6.2;
  scatterGroundDetail();

  /* benches + lamps arranged symmetrically around the central plaza */
  const benchMat = new THREE.MeshStandardMaterial({color:0x6b5744, roughness:0.9});
  const benchDarkMat = new THREE.MeshStandardMaterial({color:0x59493a, roughness:0.9});
  // banco de jardim: assento em ripas, encosto inclinado e braços — mais
  // convidativo que a tábua lisa de antes
  function makeBench(){
    const g = new THREE.Group();
    for(let i=0;i<3;i++){
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.06,0.15), benchMat);
      slat.position.set(0, 0.45, -0.18+i*0.18);
      slat.castShadow = true;
      g.add(slat);
    }
    const back = new THREE.Group();
    for(let i=0;i<2;i++){
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.16,0.06), benchMat);
      slat.position.set(0, 0.22+i*0.22, 0);
      back.add(slat);
    }
    back.position.set(0, 0.55, -0.24);
    back.rotation.x = -0.18;
    g.add(back);
    [-0.78, 0.78].forEach(x=>{
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.05,0.42), benchDarkMat);
      arm.position.set(x, 0.68, -0.03);
      arm.castShadow = true;
      g.add(arm);
      const armPost = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.24,0.07), benchDarkMat);
      armPost.position.set(x, 0.56, 0.14);
      g.add(armPost);
    });
    [[-0.7,0.18],[0.7,0.18],[-0.7,-0.2],[0.7,-0.2]].forEach(([x,z])=>{
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.45,0.09), benchDarkMat);
      leg.position.set(x,0.22,z);
      leg.castShadow = true;
      g.add(leg);
    });
    return g;
  }
  const lampHeadMats = []; // emissivo controlado pela hora do dia
  const lampGlowSpots = []; // posição das cabeças, pros sprites de brilho noturno
  function makeLamp(){
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,2.6,8), fenceMat);
    pole.position.y = 1.3; pole.castShadow = true;
    g.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22,6,5), new THREE.MeshStandardMaterial({
      color:0xffe3b0, emissive:0xffb877, emissiveIntensity:0.6
    }));
    head.position.y = 2.65;
    lampHeadMats.push(head.material);
    g.add(head);
    return g;
  }
  // 4 lamps on the diagonals just outside the plaza
  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sz])=>{
    const l = makeLamp();
    l.position.set(sx*5.0, 0, sz*5.0);
    lampGlowSpots.push({x:sx*5.0, y:2.65, z:sz*5.0});
    scene.add(l);
  });
  // bancos em todos os vãos entre dois pinheiros da mesma fileira, exceto
  // os que ficam bem ao lado do letreiro de entrada de cada jardim (ali o
  // banco brigava visualmente com a placa)
  const AVENUE_BENCH_SPOTS = [
    // avenida norte-sul, lado leste (x=3.6) — vão perto da praça (z=12)
    // fica de fora por causa dos letreiros "Campo das Estrelas"/"Recanto do Sol"
    { x: 3.6, z: 18,  rot: -Math.PI/2 },
    { x: 3.6, z: -18, rot: -Math.PI/2 },
    // avenida norte-sul, lado oeste (x=-3.6) — mesma exceção pros letreiros
    // "Prado dos Companheiros"/"Bosque da Saudade"
    { x: -3.6, z: 18,  rot: Math.PI/2 },
    { x: -3.6, z: -18, rot: Math.PI/2 },
    // avenida leste-oeste, lado norte (z=3.6) — sem letreiros por perto
    { x: 12, z: 3.6,  rot: Math.PI },
    { x: 18, z: 3.6,  rot: Math.PI },
    { x: -12, z: 3.6, rot: Math.PI },
    { x: -18, z: 3.6, rot: Math.PI },
    // avenida leste-oeste, lado sul (z=-3.6)
    { x: 12, z: -3.6,  rot: 0 },
    { x: 18, z: -3.6,  rot: 0 },
    { x: -12, z: -3.6, rot: 0 },
    { x: -18, z: -3.6, rot: 0 },
  ];
  AVENUE_BENCH_SPOTS.forEach(spot=>{
    const b = makeBench();
    b.position.set(spot.x, 0, spot.z);
    b.rotation.y = spot.rot;
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
    new THREE.MeshStandardMaterial({map:makePlazaTexture(), color:0xddc79e, roughness:1})
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
  function makeBasinStoneTexture(){
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#cabfa4';
    ctx.fillRect(0,0,256,128);
    for(let i=0;i<520;i++){
      const shade = 150+Math.random()*60;
      ctx.fillStyle = `rgba(${shade},${shade-10},${shade-24},0.35)`;
      ctx.fillRect(Math.random()*256, Math.random()*128, 2.4,2.4);
    }
    // leve mancha de musgo perto da base, por causa da água
    ctx.fillStyle = 'rgba(94,124,72,0.22)';
    for(let i=0;i<10;i++){
      const x = Math.random()*256, r = 10+Math.random()*16;
      ctx.beginPath(); ctx.ellipse(x, 118, r, r*0.5, 0, 0, Math.PI*2); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(3,1);
    return tex;
  }
  const basinMat = new THREE.MeshStandardMaterial({map:makeBasinStoneTexture(), color:0xe3d8bd, roughness:0.85});
  const waterMat = new THREE.MeshStandardMaterial({color:0x5cc2c9, emissive:0x2a6a72, emissiveIntensity:0.18, roughness:0.12, metalness:0.15, transparent:true, opacity:0.82});

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
    // orelha arredondada (gota) em vez do cone pontudo — combina com o resto
    // da estátua, que já é toda de esferas
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.045,6,5), statueMat);
    ear.scale.set(0.7,1.2,0.5);
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

  // brilhos do sol na água: pontinhos brancos que piscam em posições
  // aleatórias da superfície, como reflexo tremulando
  const sparkleMat = new THREE.MeshBasicMaterial({color:0xfff6df, transparent:true, opacity:0});
  const waterSparkles = [];
  [[waterLow, 1.55, 0.39],[upperWater, 0.5, 1.53]].forEach(([surface, radius, y])=>{
    for(let i=0;i<6;i++){
      const s = new THREE.Mesh(new THREE.CircleGeometry(0.03,6), sparkleMat.clone());
      s.rotation.x = -Math.PI/2;
      const a = Math.random()*Math.PI*2, r = Math.random()*radius;
      s.position.set(Math.cos(a)*r, y+0.005, Math.sin(a)*r);
      s.userData = { phase: Math.random()*Math.PI*2, speed: 0.8+Math.random()*1.4 };
      fountain.add(s);
      waterSparkles.push(s);
    }
  });

  // ondinhas: anéis finos que nascem no centro da bacia de baixo e se
  // expandem até sumir, em loop, pra água não parecer parada
  const rippleMat = new THREE.MeshBasicMaterial({color:0xe8fbff, transparent:true, opacity:0.5, side:THREE.DoubleSide});
  const ripples = [0,1,2].map(i=>{
    const r = new THREE.Mesh(new THREE.RingGeometry(0.05,0.09,20), rippleMat.clone());
    r.rotation.x = -Math.PI/2;
    r.position.y = 0.385;
    r.userData = { t: i/3 };
    fountain.add(r);
    return r;
  });

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

  /* ============ VELAS (segundo tipo de tributo, vida útil mais longa) ============ */
  const candleGroup = new THREE.Group();
  scene.add(candleGroup);
  const witheringCandles = []; // igual witheringFlowers, mas com apagaEm/expiraEm

  function makeGlowTexture(){
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32,32,0, 32,32,32);
    g.addColorStop(0, 'rgba(255,214,140,0.9)');
    g.addColorStop(0.4, 'rgba(255,170,80,0.45)');
    g.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(c);
  }
  const glowTexture = makeGlowTexture();

  // halo quente nas cabeças das lâmpadas — invisível de dia, é o que faz a
  // praça parecer iluminada de verdade no entardecer/noite sem pagar o preço
  // de 4 point lights de verdade (mesmo truque barato do brilho das velas)
  const lampGlows = lampGlowSpots.map(spot=>{
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map:glowTexture, transparent:true, opacity:0, depthWrite:false
    }));
    s.scale.set(1.6,1.6,1);
    s.position.set(spot.x, spot.y, spot.z);
    scene.add(s);
    return s;
  });
  const waxColors = [0xf4ead8, 0xe8caa0, 0xd9b98c];

  // lifespan = {apagaEm, expiraEm} em epoch ms; sem isso a vela nunca apaga nem some
  function plantCandle(x, z, instant, lifespan){
    const g = new THREE.Group();
    const waxColor = waxColors[Math.floor(Math.random()*waxColors.length)];
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055,0.06,0.26,8),
      new THREE.MeshStandardMaterial({color:waxColor, roughness:0.7})
    );
    body.position.y = 0.13;
    g.add(body);
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.05,5), new THREE.MeshStandardMaterial({color:0x2a2018}));
    wick.position.y = 0.285;
    g.add(wick);

    const flameMat = new THREE.MeshBasicMaterial({color:0xffb347});
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.03,6,6), flameMat);
    flame.scale.set(0.7,1.3,0.7);
    flame.position.y = 0.335;
    g.add(flame);

    const glowMat = new THREE.SpriteMaterial({map:glowTexture, transparent:true, opacity:0.7, depthWrite:false});
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(0.55,0.55,1);
    glow.position.y = 0.32;
    g.add(glow);

    g.position.set(x + (Math.random()-0.5)*0.4, 0, z + (Math.random()-0.5)*0.4);
    candleGroup.add(g);

    const flickerPhase = Math.random()*Math.PI*2;
    g.userData = { flame, glow, flickerPhase, lit:true };
    if(lifespan){
      g.userData.apagaEm = lifespan.apagaEm;
      g.userData.expiraEm = lifespan.expiraEm;
      witheringCandles.push(g);
    }

    if(instant){ g.scale.setScalar(0.9+Math.random()*0.2); return g; }
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

  function extinguishCandle(g){
    g.userData.lit = false;
    g.userData.flame.visible = false;
    g.userData.glow.visible = false;
  }

  /* ============ SUPABASE: velas persistentes ============ */
  function randomVelaLifespan(){
    return {
      apagaEm: Date.now() + 8*DAY_MS + Math.random()*2*DAY_MS,   // queima entre 8 e 10 dias
      expiraEm: Date.now() + 14*DAY_MS + Math.random()*2*DAY_MS, // some entre 14 e 16 dias
    };
  }

  function plantAndSaveVela(x, z){
    const lifespan = randomVelaLifespan();
    plantCandle(x, z, false, lifespan);
    supabase.from('velas').insert({
      x, z,
      apaga_em: new Date(lifespan.apagaEm).toISOString(),
      expira_em: new Date(lifespan.expiraEm).toISOString(),
    }).then(({ error })=>{
      if(error) console.error('Não foi possível salvar a vela:', error.message);
    });
  }

  async function loadVelas(){
    const { data: rows, error } = await supabase.from('velas').select('*');
    if(error){
      console.error('Não foi possível carregar as velas:', error.message);
      return;
    }
    rows.forEach(row=>{
      const g = plantCandle(Number(row.x), Number(row.z), true, {
        apagaEm: new Date(row.apaga_em).getTime(),
        expiraEm: new Date(row.expira_em).getTime(),
      });
      if(Date.now() >= g.userData.apagaEm) extinguishCandle(g);
    });
  }
  loadVelas();

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

  /* ============ PASSARINHOS ============ */
  // vida ambiente: dois sabiás que de tempos em tempos voam até o topo de um
  // mourão da cerca, ficam um pouco (balançando de leve) e vão embora.
  // Máquina de estados simples: away → flyin → perched → flyout → away.
  const birdBackMat = new THREE.MeshStandardMaterial({color:0x6b6257, roughness:0.9});
  const birdBreastMat = new THREE.MeshStandardMaterial({color:0xe08a3c, roughness:0.8});
  const birdBeakMat = new THREE.MeshStandardMaterial({color:0xd9b13b, roughness:0.6});
  function buildBird(){
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.055,7,6), birdBackMat);
    body.scale.set(1,0.85,1.3);
    body.position.y = 0.05;
    g.add(body);
    const breast = new THREE.Mesh(new THREE.SphereGeometry(0.042,7,6), birdBreastMat);
    breast.scale.set(0.9,0.8,1);
    breast.position.set(0, 0.032, 0.028);
    g.add(breast);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.036,7,6), birdBackMat);
    head.position.set(0, 0.105, 0.045);
    g.add(head);
    const beak = new THREE.Mesh(new THREE.SphereGeometry(0.014,6,5), birdBeakMat);
    beak.scale.set(0.6,0.5,1.4);
    beak.position.set(0, 0.1, 0.085);
    g.add(beak);
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.028,6,5), birdBackMat);
    tail.scale.set(0.7,0.35,1.9);
    tail.position.set(0, 0.055, -0.08);
    tail.rotation.x = 0.35;
    g.add(tail);
    const wings = [];
    [-1,1].forEach(side=>{
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.04,6,5), birdBackMat);
      wing.scale.set(1.6,0.25,1);
      wing.position.set(side*0.05, 0.06, 0);
      g.add(wing);
      wings.push(wing);
    });
    g.visible = false;
    scene.add(g);
    return { g, wings };
  }
  const birds = [0,1].map(i=>({
    ...buildBird(),
    state: 'away',
    timer: 4 + i*9 + Math.random()*6, // defasados pra não agirem em dupla
    from: new THREE.Vector3(), to: new THREE.Vector3(),
    t: 0, dur: 1, phase: Math.random()*Math.PI*2,
  }));
  function updateBirds(dt, elapsed){
    birds.forEach(b=>{
      if(b.state === 'away'){
        b.timer -= dt;
        if(b.timer <= 0 && birdPerches.length){
          const perch = birdPerches[Math.floor(Math.random()*birdPerches.length)];
          b.to.set(perch.x, perch.y, perch.z);
          // entra voando de fora da cerca, um pouco acima
          const outward = Math.hypot(perch.x, perch.z) || 1;
          b.from.set(perch.x/outward*40, perch.y+7, perch.z/outward*40);
          b.t = 0; b.dur = 2.6;
          b.state = 'flyin';
          b.g.visible = true;
        }
        return;
      }
      if(b.state === 'flyin' || b.state === 'flyout'){
        b.t = Math.min(1, b.t + dt/b.dur);
        const e = b.t*b.t*(3-2*b.t); // easing suave nas duas pontas
        b.g.position.lerpVectors(b.from, b.to, e);
        b.g.position.y += Math.sin(b.t*Math.PI)*0.8; // arco de voo
        b.g.rotation.y = Math.atan2(b.to.x-b.from.x, b.to.z-b.from.z);
        const flap = Math.sin(elapsed*16+b.phase)*0.7;
        b.wings[0].rotation.z = flap;
        b.wings[1].rotation.z = -flap;
        if(b.t >= 1){
          if(b.state === 'flyin'){
            b.state = 'perched';
            b.timer = 6 + Math.random()*9;
            b.wings[0].rotation.z = 0.15;
            b.wings[1].rotation.z = -0.15;
            b.baseY = b.g.position.y;
          } else {
            b.state = 'away';
            b.g.visible = false;
            b.timer = 10 + Math.random()*18;
          }
        }
        return;
      }
      // perched: balanço de corpo + viradinhas de cabeça ocasionais
      b.timer -= dt;
      b.g.position.y = b.baseY + Math.abs(Math.sin(elapsed*2.4+b.phase))*0.012;
      b.g.rotation.y += Math.sin(elapsed*0.7+b.phase)*dt*0.6;
      if(b.timer <= 0){
        b.from.copy(b.g.position);
        const a = Math.random()*Math.PI*2;
        b.to.set(b.g.position.x+Math.cos(a)*35, b.g.position.y+9, b.g.position.z+Math.sin(a)*35);
        b.t = 0; b.dur = 2.6;
        b.state = 'flyout';
      }
    });
  }

  /* ============ RELÓGIO DO JARDIM ============ */
  // o jardim segue a hora local de quem visita: dia claro, golden hour no
  // fim da tarde (sol baixo e grande, sombras longas) e noite — pensada pra
  // ser acolhedora, não melancólica: azuis claros arroxeados com resto de
  // calor no horizonte, luar forte o bastante pra ler as cores, e os pontos
  // quentes (lâmpadas, velas) finalmente brilhando de verdade. Três presets
  // e interpolação suave entre eles; reavaliado a cada minuto.

  // lua + estrelas, invisíveis fora da noite
  const moonMat = new THREE.MeshBasicMaterial({color:0xf2f4ff, transparent:true, opacity:0, fog:false});
  const moon = new THREE.Mesh(new THREE.CircleGeometry(1.9, 24), moonMat);
  moon.position.set(26, 30, -28);
  moon.lookAt(0,10,0);
  scene.add(moon);
  const moonGlowMat = new THREE.MeshBasicMaterial({color:0xcdd8f5, transparent:true, opacity:0, fog:false});
  const moonGlow = new THREE.Mesh(new THREE.CircleGeometry(3.4, 24), moonGlowMat);
  moonGlow.position.copy(moon.position);
  moonGlow.lookAt(0,10,0);
  scene.add(moonGlow);
  const starMat = new THREE.PointsMaterial({color:0xffffff, size:0.9, transparent:true, opacity:0, fog:false, depthWrite:false});
  {
    const starPos = new Float32Array(170*3);
    for(let i=0;i<170;i++){
      const az = Math.random()*Math.PI*2;
      const el = (8 + Math.random()*72) * Math.PI/180;
      const r = 88;
      starPos[i*3]   = Math.cos(az)*Math.cos(el)*r;
      starPos[i*3+1] = Math.sin(el)*r;
      starPos[i*3+2] = Math.sin(az)*Math.cos(el)*r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, starMat));
  }

  const C = (hex)=> new THREE.Color(hex);
  const PHASES = {
    dia: {
      sky: [C(0x6fbdf2), C(0x9dd4f2), C(0xc8e7f5), C(0xe8f4ee), C(0xfdf8d8)],
      fog: C(0xd8e8ea),
      hemiSky: C(0xcfe4ff), hemiGround: C(0xa9c07e), hemiInt: 0.6,
      sunColor: C(0xfff3d2), sunInt: 1.05, sunPos: [-12, 32, 10],
      rimInt: 0.1, fillInt: 0.08,
      discColor: C(0xfffbe4), discScale: 0.85, discPos: [-22, 36, -24],
      glowColor: C(0xfff3cf), glowOpacity: 0.18,
      cloudColor: C(0xffffff),
      lampEmissive: 0.15, lampGlow: 0,
    },
    dourado: {
      sky: [C(0xa9d3f7), C(0xcfe1ee), C(0xf2ae82), C(0xffd39b), C(0xfff0cf)],
      fog: C(0xe8b98f),
      hemiSky: C(0xcfc4ff), hemiGround: C(0xd9b471), hemiInt: 0.48,
      sunColor: C(0xffb163), sunInt: 1.2, sunPos: [-26, 10, 18],
      rimInt: 0.18, fillInt: 0.22,
      discColor: C(0xffdf9e), discScale: 1.7, discPos: [-34, 17, -23],
      glowColor: C(0xffb877), glowOpacity: 0.42,
      cloudColor: C(0xffdfc8),
      lampEmissive: 0.8, lampGlow: 0.3,
    },
    noite: {
      sky: [C(0x252e52), C(0x303c66), C(0x424e76), C(0x5a628c), C(0x8a7796)],
      fog: C(0x4a5378),
      hemiSky: C(0x5c6a9e), hemiGround: C(0x2e3448), hemiInt: 0.38,
      sunColor: C(0xaebfe8), sunInt: 0.32, sunPos: [18, 26, -12],
      rimInt: 0.06, fillInt: 0.3,
      discColor: C(0xf2f4ff), discScale: 0, discPos: [-22, 36, -24],
      glowColor: C(0xcdd8f5), glowOpacity: 0,
      cloudColor: C(0x59628a),
      lampEmissive: 1.5, lampGlow: 0.6,
    },
  };

  const timeWeights = { dia: 1, dourado: 0, noite: 0 };
  function phaseWeights(h){
    // noite → dia 5h30–7h; dia → dourado 16h30–17h30; dourado full até 19h;
    // dourado → noite 19h–19h45
    const s = (a,b,x)=>{ const t = Math.min(1, Math.max(0, (x-a)/(b-a))); return t*t*(3-2*t); };
    let dia=0, dourado=0, noite=0;
    if(h < 5.5) noite = 1;
    else if(h < 7){ dia = s(5.5,7,h); noite = 1-dia; }
    else if(h < 16.5) dia = 1;
    else if(h < 17.5){ dourado = s(16.5,17.5,h); dia = 1-dourado; }
    else if(h < 19) dourado = 1;
    else if(h < 19.75){ noite = s(19,19.75,h); dourado = 1-noite; }
    else noite = 1;
    return {dia, dourado, noite};
  }
  function mixColor(target, key, idx){
    const get = (p)=> idx == null ? p[key] : p[key][idx];
    const a = get(PHASES.dia), b = get(PHASES.dourado), c = get(PHASES.noite);
    target.setRGB(
      a.r*timeWeights.dia + b.r*timeWeights.dourado + c.r*timeWeights.noite,
      a.g*timeWeights.dia + b.g*timeWeights.dourado + c.g*timeWeights.noite,
      a.b*timeWeights.dia + b.b*timeWeights.dourado + c.b*timeWeights.noite
    );
  }
  function mixNum(key){
    return PHASES.dia[key]*timeWeights.dia
         + PHASES.dourado[key]*timeWeights.dourado
         + PHASES.noite[key]*timeWeights.noite;
  }
  function mixVec(target, key){
    const a = PHASES.dia[key], b = PHASES.dourado[key], c = PHASES.noite[key];
    target.set(
      a[0]*timeWeights.dia + b[0]*timeWeights.dourado + c[0]*timeWeights.noite,
      a[1]*timeWeights.dia + b[1]*timeWeights.dourado + c[1]*timeWeights.noite,
      a[2]*timeWeights.dia + b[2]*timeWeights.dourado + c[2]*timeWeights.noite
    );
  }

  let horaForcada = null; // pro futuro botão "ver ao entardecer" e pros testes
  const skyColors = [0,1,2,3,4].map(()=> new THREE.Color());
  function applyTimeOfDay(){
    const agora = new Date();
    const h = horaForcada != null ? horaForcada : agora.getHours() + agora.getMinutes()/60;
    const w = phaseWeights(h);
    timeWeights.dia = w.dia; timeWeights.dourado = w.dourado; timeWeights.noite = w.noite;

    skyColors.forEach((c,i)=> mixColor(c, 'sky', i));
    paintSky(skyColors);
    mixColor(scene.fog.color, 'fog');
    mixColor(hemi.color, 'hemiSky');
    mixColor(hemi.groundColor, 'hemiGround');
    hemi.intensity = mixNum('hemiInt');
    mixColor(sun.color, 'sunColor');
    sun.intensity = mixNum('sunInt');
    mixVec(sun.position, 'sunPos');
    rimLight.intensity = mixNum('rimInt');
    fillLight.intensity = mixNum('fillInt');

    const ds = Math.max(0.001, mixNum('discScale'));
    mixColor(sunDisc.material.color, 'discColor');
    sunDisc.scale.setScalar(ds);
    mixVec(sunDisc.position, 'discPos');
    sunDisc.lookAt(0,10,0);
    mixColor(sunGlow.material.color, 'glowColor');
    sunGlow.material.opacity = mixNum('glowOpacity');
    sunGlow.scale.setScalar(ds);
    sunGlow.position.copy(sunDisc.position);
    sunGlow.lookAt(0,10,0);

    cloudMats.forEach(m=> mixColor(m.color, 'cloudColor'));
    lampHeadMats.forEach(m=>{ m.emissiveIntensity = mixNum('lampEmissive'); });
    lampGlows.forEach(s=>{ s.material.opacity = mixNum('lampGlow'); });
    moonMat.opacity = w.noite*0.95;
    moonGlowMat.opacity = w.noite*0.3;
    starMat.opacity = w.noite*0.85;
  }
  applyTimeOfDay();
  setInterval(applyTimeOfDay, 60000);

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

  /* ============ VELAS: apagar e sumir ============ */
  function updateCandles(elapsed){
    const now = Date.now();
    for(let i=witheringCandles.length-1; i>=0; i--){
      const c = witheringCandles[i];
      const { apagaEm, expiraEm } = c.userData;
      if(now >= expiraEm){
        candleGroup.remove(c);
        witheringCandles.splice(i,1);
        continue;
      }
      if(c.userData.lit && now >= apagaEm) extinguishCandle(c);
    }
    candleGroup.children.forEach(g=>{
      if(!g.userData.lit) return;
      const flicker = 0.85 + Math.sin(elapsed*9 + g.userData.flickerPhase)*0.12 + Math.sin(elapsed*23 + g.userData.flickerPhase)*0.05;
      g.userData.flame.scale.set(0.7*flicker, 1.3*flicker, 0.7*flicker);
      // à noite o halo da vela cresce — é a hora dela aparecer
      g.userData.glow.material.opacity = (0.55 + flicker*0.2) * (1 + timeWeights.noite*0.5);
    });
  }

  /* ============ PER-FRAME UPDATE ============ */
  function update(dt, elapsed){
    updateWither();
    updateCandles(elapsed);
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

    waterSparkles.forEach(s=>{
      const tw = Math.sin(elapsed*s.userData.speed + s.userData.phase);
      s.material.opacity = Math.max(0, tw*0.8 - 0.35);
    });
    ripples.forEach(r=>{
      r.userData.t += dt*0.18;
      if(r.userData.t > 1) r.userData.t -= 1;
      const t = r.userData.t;
      const s = 0.15 + t*1.35;
      r.scale.set(s,s,s);
      r.material.opacity = 0.5*(1-t);
    });

    /* ===== vida ambiente ===== */
    // vento: rajadas lentas compartilhadas (mesmo "clima" pra todo mundo)
    // moduladas pela fase própria de cada árvore/flor
    const gust = 0.6 + 0.4*Math.sin(elapsed*0.23) * Math.sin(elapsed*0.611);
    swayingTrees.forEach(t=>{
      const w = Math.sin(elapsed*t.speed + t.phase) * t.amp * gust;
      t.g.rotation.z = w;
      t.g.rotation.x = Math.sin(elapsed*t.speed*0.8 + t.phase*1.7) * t.amp * 0.6 * gust;
    });
    flowerGroup.children.forEach(f=>{
      // fase derivada da posição: flores vizinhas ondulam quase juntas,
      // como uma onda de vento passando pelo gramado
      f.rotation.z = Math.sin(elapsed*1.7 + f.position.x*0.7 + f.position.z*0.5) * 0.07 * gust;
    });

    petals.forEach(p=>{
      if(p.state === 'falling'){
        p.mesh.position.y -= dt * p.fallSpeed;
        p.mesh.position.x += Math.sin(elapsed*1.3 + p.phase) * dt * 0.25;
        p.mesh.position.z += Math.cos(elapsed*1.1 + p.phase) * dt * 0.18;
        p.mesh.rotation.x += dt * p.spin;
        p.mesh.rotation.y += dt * p.spin * 0.6;
        if(p.mesh.position.y <= 0.03){
          p.mesh.position.y = 0.03;
          p.mesh.rotation.set(-Math.PI/2, 0, Math.random()*Math.PI);
          p.state = 'resting';
          p.rest = 2.5 + Math.random()*3;
        }
      } else {
        p.rest -= dt;
        p.mesh.material.opacity = Math.max(0, Math.min(0.9, p.rest * 0.6));
        if(p.rest <= 0) respawnPetal(p, false);
      }
    });

    updateBirds(dt, elapsed);
  }

  return {
    ground,
    PLAZA,
    AVENUES,
    plantAndSaveFlor,
    plantAndSaveVela,
    scatterFlowers,
    isFreeSpot,
    gatherFireflies,
    update,
    // força uma hora específica (0–24) ou volta ao relógio real com null —
    // usado nos testes visuais e reservado pro futuro botão "ver ao entardecer"
    setHora(h){ horaForcada = h; applyTimeOfDay(); },
  };
}
