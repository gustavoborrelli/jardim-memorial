"use strict";

/*
  MUNDO / CENÁRIO
  Orquestra tudo o que forma o ambiente do jardim. A construção de cada coisa
  mora em js/gfx/ (céu, chão, árvores, flores, mobília, fonte, vida ambiente);
  aqui ficam o desenho do jardim (onde cada coisa está), o relógio que muda a
  luz conforme a hora de quem visita e a persistência de flores e velas.

  createWorld(scene, {renderer, perfil, pos}) monta tudo dentro da scene e
  devolve o "controle remoto" que os outros módulos usam: o chão (raycast de
  cliques), a praça (colisão do cachorro) e as funções de plantar.
*/

import * as THREE from 'three';
import { supabase } from './supabaseClient.js';
import { POSICOES_VAGA } from './lapides.js';
import { criarCeu } from './gfx/ceu.js';
import { criarChao, alturaTerreno } from './gfx/chao.js';
import { criarArvores } from './gfx/arvores.js';
import { criarFlores, criarFloresDoGramado } from './gfx/flores.js';
import { criarMobilia } from './gfx/mobilia.js';
import { criarFonte } from './gfx/fonte.js';
import { criarBorboletas, criarPassaros, criarPetalas, criarAr } from './gfx/vida.js';
import { texturaBrilho, torneado } from './gfx/materiais.js';
import { sorteador } from './gfx/ruido.js';

export function createWorld(scene, { renderer, perfil, pos }) {
  const sorte = sorteador(2024);

  /* ============ O DESENHO DO JARDIM ============ */
  const PLAZA = { x:0, z:0, r:5.5 };
  // quatro avenidas partindo da praça; x,z = centro, w,l = extensão nos eixos
  const AVENUES = [
    { x:0, z:-16.5, w:4.2, l:22 },
    { x:0, z:16.5, w:4.2, l:22 },
    { x:-16.5, z:0, w:22, l:4.2 },
    { x:16.5, z:0, w:22, l:4.2 },
  ];
  const sdRetangulo = (x, z, cx, cz, hx, hz) => {
    const qx = Math.abs(x-cx)-hx, qz = Math.abs(z-cz)-hz;
    return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
  };
  const sdCaminho = (x, z) => {
    let d = Math.hypot(x-PLAZA.x, z-PLAZA.z) - (PLAZA.r + 0.1);
    for(const a of AVENUES) d = Math.min(d, sdRetangulo(x, z, a.x, a.z, a.w/2, a.l/2));
    return d;
  };

  const B = 27; // cerca
  const CERCA = [[-B,-B, B,-B], [-B, B, -3.2, B], [3.2, B, B, B], [-B,-B, -B, B], [B,-B, B, B]];
  const PORTAO = { z: B-0.2, pilares: [[2.4, B-0.2], [-2.4, B-0.2]] };

  // uma cerejeira grande em cada jardim, como marco colorido e alegre
  const BLOSSOM_SPOTS = [[-22,-22,1.2],[22,-22,1.2],[-22,20,1.2],[22,21,1.2]];

  const LAMPADAS = [[1,1],[1,-1],[-1,1],[-1,-1]].map(([sx, sz]) => ({ x: sx*5.0, z: sz*5.0 }));

  const VASOS = [0, 1, 2, 3].map(i => {
    const a = i*Math.PI/2 + Math.PI/4;
    return { x: PLAZA.x + Math.cos(a)*(PLAZA.r-0.7), z: PLAZA.z + Math.sin(a)*(PLAZA.r-0.7) };
  });

  // bancos nos vãos entre árvores, menos os colados nos letreiros de cada jardim
  const BANCOS = [
    { x: 3.6, z: 18,  rot: -Math.PI/2 }, { x: 3.6, z: -18, rot: -Math.PI/2 },
    { x: -3.6, z: 18,  rot: Math.PI/2 }, { x: -3.6, z: -18, rot: Math.PI/2 },
    { x: 12, z: 3.6,  rot: Math.PI }, { x: 18, z: 3.6,  rot: Math.PI },
    { x: -12, z: 3.6, rot: Math.PI }, { x: -18, z: 3.6, rot: Math.PI },
    { x: 12, z: -3.6,  rot: 0 }, { x: 18, z: -3.6,  rot: 0 },
    { x: -12, z: -3.6, rot: 0 }, { x: -18, z: -3.6, rot: 0 },
  ];

  /* árvores */
  const ARVORES = [];
  BLOSSOM_SPOTS.forEach(([x, z, escala]) => ARVORES.push({ x, z, escala, tipo: 'cerejeira' }));
  [9, 15, 21].forEach(d => {
    [-3.6, 3.6].forEach(off => {
      [[off, d], [off, -d], [d, off], [-d, off]].forEach(([x, z]) => {
        ARVORES.push({ x, z, escala: 0.76 + sorte()*0.12, tipo: 'cipreste' });
      });
    });
  });
  [[-24.6, 3.7, 0.74], [24.6, -3.7, 0.78]].forEach(([x, z, escala]) => ARVORES.push({ x, z, escala, tipo: 'cipreste' }));
  // copas grandes de sombra no canto de cada jardim
  [[21, 11], [-21, 11], [21, -11], [-21, -11], [11, 21], [-11, 21], [11, -21], [-11, -21]].forEach(([x, z]) => {
    ARVORES.push({ x, z, escala: 0.95 + sorte()*0.22, tipo: 'frondosa' });
  });
  // mata fora da cerca: tira o jardim do "tabuleiro no vazio" e dá profundidade
  for(let i=0;i<108;i++){
    const a = sorte()*Math.PI*2;
    const r = 33 + Math.pow(sorte(), 0.75)*42;
    const x = Math.cos(a)*r, z = Math.sin(a)*r;
    if(Math.max(Math.abs(x), Math.abs(z)) < 31) continue;
    if(z > 26 && Math.abs(x) < 7) continue; // a saída do portão fica aberta
    ARVORES.push({ x, z, y: alturaTerreno(x, z) - 0.15, escala: 1.0 + sorte()*0.75, tipo: 'longe' });
  }
  // arbustos encostados na cerca e no fundo dos jardins
  for(let i=0;i<44;i++){
    const lado = Math.floor(sorte()*4);
    const t = (sorte()-0.5)*50, e = 25.6 - sorte()*1.2;
    const x = lado === 0 ? t : lado === 1 ? t : lado === 2 ? e : -e;
    const z = lado === 0 ? e : lado === 1 ? -e : lado === 2 ? t : t;
    if(sdCaminho(x, z) < 1.4) continue;
    ARVORES.push({ x, z, y: 0.28, escala: 1.0 + sorte()*0.9, tipo: 'moita' });
  }

  /* máscara do chão: onde a grama não nasce e as sombras de contato */
  const semGrama = [];
  const manchas = [];
  ARVORES.forEach(a => {
    if(a.tipo === 'longe') return;
    if(a.tipo === 'moita'){ manchas.push({ x: a.x, z: a.z, r: 0.9*a.escala, forca: 0.5 }); return; }
    semGrama.push({ x: a.x, z: a.z, r: 0.5*a.escala });
    const rc = a.tipo === 'cipreste' ? 1.3 : 3.6;
    manchas.push({ x: a.x, z: a.z, r: rc*a.escala, forca: a.tipo === 'cipreste' ? 0.4 : 0.34 });
    manchas.push({ x: a.x, z: a.z, r: 0.62*a.escala, forca: 0.45 });
  });
  LAMPADAS.forEach(l => { semGrama.push({ x: l.x, z: l.z, r: 0.34 }); manchas.push({ x: l.x, z: l.z, r: 0.45, forca: 0.4 }); });
  BANCOS.forEach(b => manchas.push({ x: b.x, z: b.z, r: 1.15, forca: 0.32 }));
  POSICOES_VAGA.forEach(v => semGrama.push({ x: v.x, z: v.z, r: 1.05 }));

  /* ============ CÉU E LUZ ============ */
  scene.fog = new THREE.Fog(0xd8e8ea, 30, 290);
  const ceu = criarCeu(scene, renderer, perfil);

  // luz compartilhada com quem precisa dela dentro de shader (contraluz, água)
  const luz = {
    uSolDir: { value: new THREE.Vector3(0, 1, 0) },
    uSolCor: { value: new THREE.Color(0xffffff) },
  };

  // o céu azul sozinho deixa a sombra azulada demais; essa luz devolve o calor
  // que numa tarde de verdade vem do rebote no chão e no ar
  const hemi = new THREE.HemisphereLight(0xfff1dc, 0xc2c98c, 0.6);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0d6, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(perfil.sombra, perfil.sombra);
  const EXT = 40;
  sun.shadow.camera.left = -EXT;
  sun.shadow.camera.right = EXT;
  sun.shadow.camera.top = EXT;
  sun.shadow.camera.bottom = -EXT;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 190;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.022;
  sun.shadow.radius = perfil.nome === 'alto' ? 2.2 : 1.6;
  scene.add(sun);

  /* ============ CHÃO + GRAMA ============ */
  const chao = criarChao(scene, { perfil, sdCaminho, semGrama, manchas });
  chao.uGrama.uSolDir = luz.uSolDir;
  chao.uGrama.uSolCor = luz.uSolCor;
  const ground = chao.ground;

  /* ============ FLORES / MOBÍLIA / ÁRVORES / FONTE ============ */
  const flores = criarFlores(scene, { perfil });
  const mobilia = criarMobilia(scene, {
    perfil, PLAZA, flores, bancos: BANCOS, lampadas: LAMPADAS, LUZES: perfil.luzesLampada,
    cerca: CERCA, portao: PORTAO, vasos: VASOS,
  });
  mobilia.caixas.forEach(c => {
    const passos = Math.ceil(c.len/0.8);
    for(let i=0;i<=passos;i++){
      const t = (i/passos - 0.5)*c.len;
      manchas.push({ x: c.alongZ ? c.x : c.x+t, z: c.alongZ ? c.z+t : c.z, r: 0.75, forca: 0.3 });
    }
  });
  const arvores = criarArvores(scene, [...ARVORES, ...mobilia.moitas], { perfil, luz });
  const fonte = criarFonte(scene, { perfil, PLAZA, ceu, luz });

  const tempoFlores = { value: 0 };
  const livreGramado = (x, z) => {
    if(sdCaminho(x, z) < 0.9) return false;
    for(const v of POSICOES_VAGA) if(Math.hypot(x-v.x, z-v.z) < 1.2) return false;
    return Math.max(Math.abs(x), Math.abs(z)) < 26.6;
  };
  criarFloresDoGramado(scene, { perfil, livre: livreGramado, uTempo: tempoFlores });

  /* pedrinhas soltas no gramado */
  {
    const n = Math.round(90*Math.max(0.4, perfil.particulas));
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const p = geo.attributes.position;
    for(let i=0;i<p.count;i++){
      const k = 0.86 + sorte()*0.14;
      p.setXYZ(i, p.getX(i)*k, p.getY(i)*k*0.62, p.getZ(i)*k);
    }
    geo.computeVertexNormals();
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xaea594, roughness: 0.92 }), n);
    const d = new THREE.Object3D();
    let k = 0, tent = 0;
    while(k < n && tent < n*20){
      tent++;
      const x = (sorte()-0.5)*50, z = (sorte()-0.5)*50;
      if(!livreGramado(x, z)) continue;
      const e = 0.05 + sorte()*sorte()*0.13;
      d.position.set(x, e*0.14, z);
      d.rotation.set(0, sorte()*6.28, 0);
      d.scale.setScalar(e);
      d.updateMatrix();
      im.setMatrixAt(k++, d.matrix);
    }
    im.count = k;
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    scene.add(im);
  }

  /* ============ FLORES PLANTADAS ============ */
  const flowerGroup = new THREE.Group();
  scene.add(flowerGroup);
  const flowerColors = [0xe8547a, 0xf5d020, 0xffffff, 0xb14fd8, 0xff8a3d, 0xff5fa0, 0x6fb7ff, 0xfff066];
  const witheringFlowers = []; // só as plantadas por alguém (persistidas); as decorativas nunca murcham
  const murchaColor = new THREE.Color(0x8a7a5a);

  // lifespan = {murchaEm, expiraEm} em epoch ms; sem isso a flor é só decoração e nunca murcha
  function plantFlower(x, z, instant, color, lifespan){
    const bloomColor = color != null ? color : flowerColors[Math.floor(Math.random()*flowerColors.length)];
    const { grupo: g, matFlor: bloomMat } = flores.florUnica(bloomColor);
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
    const pontos = [];
    let tries = 0;
    while(pontos.length < count && tries < count*6){
      tries++;
      const x = (Math.random()-0.5)*2*BOUNDS_FOR_FLOWERS;
      const z = (Math.random()-0.5)*2*BOUNDS_FOR_FLOWERS;
      if(isFreeSpot(x,z,plots)){
        pontos.push({ x, z, cor: flowerColors[Math.floor(Math.random()*flowerColors.length)] });
      }
    }
    flores.instanciar(pontos, { semente: 7 });
  }

  /* ============ VELAS (segundo tipo de tributo, vida útil mais longa) ============ */
  const candleGroup = new THREE.Group();
  scene.add(candleGroup);
  const witheringCandles = []; // igual witheringFlowers, mas com apagaEm/expiraEm
  const glowTexture = texturaBrilho();
  const waxColors = [0xf4ead8, 0xe8caa0, 0xd9b98c];
  const geoCera = torneado([
    [0, 0], [0.058, 0], [0.062, 0.02], [0.056, 0.12], [0.058, 0.22], [0.054, 0.245], [0.046, 0.25], [0.03, 0.235], [0.01, 0.235], [0, 0.24],
  ], 16);
  const geoPavio = new THREE.CylinderGeometry(0.004, 0.005, 0.05, 6);
  const geoChama = torneado([
    [0, -0.018], [0.012, -0.012], [0.02, 0.008], [0.016, 0.028], [0.008, 0.05], [0.002, 0.066], [0, 0.07],
  ], 12);
  const pratinho = torneado([[0, 0.004], [0.075, 0.004], [0.09, 0.012], [0.092, 0.02], [0.08, 0.018], [0, 0.016]], 16);
  const matPrato = new THREE.MeshStandardMaterial({ color: 0xb06a48, roughness: 0.85 });
  const matPavio = new THREE.MeshStandardMaterial({ color: 0x2a2018 });

  // lifespan = {apagaEm, expiraEm} em epoch ms; sem isso a vela nunca apaga nem some
  function plantCandle(x, z, instant, lifespan){
    const g = new THREE.Group();
    const waxColor = waxColors[Math.floor(Math.random()*waxColors.length)];
    const prato = new THREE.Mesh(pratinho, matPrato);
    prato.position.y = 0.09;
    prato.castShadow = true;
    g.add(prato);
    // a cera translúcida acesa pela própria chama
    const body = new THREE.Mesh(geoCera, new THREE.MeshStandardMaterial({ color: waxColor, roughness: 0.55, emissive: 0xff9440, emissiveIntensity: 0.55 }));
    body.position.y = 0.1;
    body.castShadow = true;
    g.add(body);
    const wick = new THREE.Mesh(geoPavio, matPavio);
    wick.position.y = 0.36;
    g.add(wick);

    // chama em HDR (acima de 1): o bloom é que acende em volta
    const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5.2, 2.5, 0.7), toneMapped: true });
    const flame = new THREE.Mesh(geoChama, flameMat);
    flame.position.y = 0.385;
    g.add(flame);

    const glowMat = new THREE.SpriteMaterial({ map: glowTexture, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(0.9, 0.9, 1);
    glow.position.y = 0.41;
    glow.userData.semAO = true;
    g.add(glow);

    g.position.set(x + (Math.random()-0.5)*0.4, 0, z + (Math.random()-0.5)*0.4);
    candleGroup.add(g);

    const flickerPhase = Math.random()*Math.PI*2;
    g.userData = { flame, glow, flickerPhase, lit:true, corpo: body };
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
    g.userData.corpo.material.emissiveIntensity = 0;
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

  /* ============ VIDA AMBIENTE ============ */
  const borboletas = criarBorboletas(scene, { perfil });
  const passaros = criarPassaros(scene, mobilia.birdPerches);
  const petalas = criarPetalas(scene, BLOSSOM_SPOTS.map(([x, z, escala]) => ({ x, z, escala })), { perfil, luz });
  const ar = criarAr(scene, { perfil, luz });

  /* ============ RELÓGIO DO JARDIM ============ */
  // o jardim segue a hora local de quem visita: dia claro, golden hour no fim
  // da tarde (sol baixo e grande, sombras longas) e noite — pensada pra ser
  // acolhedora, não melancólica: azuis arroxeados com resto de calor no
  // horizonte, luar forte o bastante pra ler as cores, e os pontos quentes
  // (lâmpadas, velas, vaga-lumes) finalmente brilhando. Três presets e
  // interpolação suave entre eles; reavaliado a cada minuto.
  const C = (hex) => new THREE.Color(hex);
  const PHASES = {
    dia: {
      zenite: C(0x4a93e3), meio: C(0x8cc4f0), horizonte: C(0xe2eff0), chaoCeu: C(0x9ab07a),
      sunColor: C(0xfff0d8), sunInt: 3.0, solDir: [-0.46, 0.8, -0.38],
      solDisco: 22, solHalo: 0.55, solTam: 0.024,
      nuvemLuz: C(0xffffff), nuvemSombra: C(0xc2d0e2), cobertura: 0.47,
      ambiente: 0.62, hemiInt: 0.95, exposicao: 0.72, quente: [1.0, 1.0, 1.0], bloom: 0.16,
      lampEmissive: 0.08, lampGlow: 0, lampLuz: 0, polen: 0.25,
    },
    dourado: {
      zenite: C(0x4c6cb6), meio: C(0xdba48e), horizonte: C(0xffc98c), chaoCeu: C(0x8f7650),
      sunColor: C(0xff9c55), sunInt: 3.5, solDir: [-0.66, 0.19, -0.72],
      solDisco: 20, solHalo: 1.15, solTam: 0.04,
      nuvemLuz: C(0xffd3a8), nuvemSombra: C(0xa6889f), cobertura: 0.46,
      ambiente: 0.72, hemiInt: 0.55, exposicao: 0.78, quente: [1.05, 0.99, 0.93], bloom: 0.34,
      lampEmissive: 1.0, lampGlow: 0.26, lampLuz: 2.2, polen: 0.95,
    },
    noite: {
      zenite: C(0x151c44), meio: C(0x2c346c), horizonte: C(0x6e5c8e), chaoCeu: C(0x232a44),
      sunColor: C(0xaebff0), sunInt: 0.72, solDir: [0.5, 0.72, -0.48],
      solDisco: 0, solHalo: 0.12, solTam: 0.02,
      nuvemLuz: C(0x515c8f), nuvemSombra: C(0x262c56), cobertura: 0.5,
      ambiente: 1.4, hemiInt: 0.16, exposicao: 0.98, quente: [1.0, 1.0, 1.04], bloom: 0.4,
      lampEmissive: 2.5, lampGlow: 0.36, lampLuz: 9.5, polen: 0,
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
  function mixColor(target, key){
    const a = PHASES.dia[key], b = PHASES.dourado[key], c = PHASES.noite[key];
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

  const quente = new THREE.Vector3();
  const luaDir = new THREE.Vector3(...PHASES.noite.solDir).normalize();
  let horaForcada = null; // pro futuro botão "ver ao entardecer" e pros testes
  let ultimaChave = '';
  function applyTimeOfDay(){
    const agora = new Date();
    const h = horaForcada != null ? horaForcada : agora.getHours() + agora.getMinutes()/60;
    const w = phaseWeights(h);
    timeWeights.dia = w.dia; timeWeights.dourado = w.dourado; timeWeights.noite = w.noite;

    const u = ceu.uniforms;
    mixColor(u.uZenite.value, 'zenite');
    mixColor(u.uMeio.value, 'meio');
    mixColor(u.uHorizonte.value, 'horizonte');
    mixColor(u.uChao.value, 'chaoCeu');
    mixColor(u.uNuvemLuz.value, 'nuvemLuz');
    mixColor(u.uNuvemSombra.value, 'nuvemSombra');
    u.uCobertura.value = mixNum('cobertura');
    u.uSolDisco.value = mixNum('solDisco');
    u.uSolHalo.value = mixNum('solHalo');
    u.uSolTam.value = mixNum('solTam');
    u.uLua.value = w.noite;
    u.uLuaDir.value.copy(luaDir);
    u.uEstrelas.value = w.noite;

    // o sol do céu e o sol que projeta sombra agora são o mesmo sol
    mixVec(u.uSolDir.value, 'solDir');
    u.uSolDir.value.normalize();
    luz.uSolDir.value.copy(u.uSolDir.value);
    sun.position.copy(u.uSolDir.value).multiplyScalar(90);
    mixColor(sun.color, 'sunColor');
    sun.intensity = mixNum('sunInt');
    u.uSolCor.value.copy(sun.color);
    luz.uSolCor.value.copy(sun.color).multiplyScalar(Math.min(1.2, sun.intensity/3));

    mixColor(scene.fog.color, 'horizonte');
    scene.environmentIntensity = mixNum('ambiente');
    // sem o céu como luz ambiente (perfil baixo), a hemisférica faz o trabalho das duas
    hemi.intensity = mixNum('hemiInt') + (perfil.nome === 'baixo' ? mixNum('ambiente')*1.15 : 0);

    mobilia.lampHeadMats.forEach(m => { m.emissiveIntensity = mixNum('lampEmissive'); });
    mobilia.lampGlows.forEach(s => { s.material.opacity = mixNum('lampGlow'); });
    mobilia.lampLuzes.forEach(l => { l.intensity = mixNum('lampLuz'); });
    ar.uPolen.value = mixNum('polen');
    ar.uNoite.value = w.noite;

    mixVec(quente, 'quente');
    pos.setHora({ exposicao: mixNum('exposicao'), quente, bloom: mixNum('bloom') });

    // regenerar a luz ambiente custa alguns ms: só quando a hora mudou de fato
    const chave = `${w.dia.toFixed(3)}|${w.dourado.toFixed(3)}|${w.noite.toFixed(3)}`;
    if(chave !== ultimaChave){
      ultimaChave = chave;
      ceu.atualizarAmbiente();
    }
  }
  applyTimeOfDay();
  setInterval(applyTimeOfDay, 60000);

  /* ============ FLORES: murchar e sumir ============ */
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
      g.userData.flame.scale.set(flicker, 0.9 + (flicker-0.85)*1.6, flicker);
      // à noite o halo da vela cresce — é a hora dela aparecer
      g.userData.glow.material.opacity = (0.4 + flicker*0.2) * (0.55 + timeWeights.noite*0.65);
    });
  }

  /* ============ PER-FRAME UPDATE ============ */
  const tamanhoTela = new THREE.Vector2();
  function update(dt, elapsed, camera, posCao){
    updateWither();
    updateCandles(elapsed);

    renderer.getDrawingBufferSize(tamanhoTela);
    const alturaTela = tamanhoTela.y;

    ceu.uniforms.uTempo.value = elapsed;
    if(camera) chao.atualizar(elapsed, camera, posCao);
    arvores.atualizar(elapsed);
    flores.atualizar(elapsed);
    tempoFlores.value = elapsed;
    fonte.atualizar(elapsed, alturaTela);
    borboletas.atualizar(elapsed, timeWeights.noite);
    passaros.atualizar(dt, elapsed);
    petalas.atualizar(elapsed);
    if(camera) ar.atualizar(elapsed, camera, alturaTela);

    // flores plantadas ondulam com fase derivada da posição: vizinhas juntas,
    // como uma onda de vento passando pelo gramado
    const gust = 0.6 + 0.4*Math.sin(elapsed*0.23) * Math.sin(elapsed*0.611);
    flowerGroup.children.forEach(f=>{
      f.rotation.z = Math.sin(elapsed*1.7 + f.position.x*0.7 + f.position.z*0.5) * 0.07 * gust;
    });
  }

  // onde a câmera não deve parar (dentro de uma copa): a chegada pelo link de uma
  // homenagem escolhe o ângulo final com isto. Raio aproximado de cada copa.
  const RAIO_COPA = { frondosa: 3.2, cerejeira: 3.4, cipreste: 1.5, moita: 1.0 };
  const copas = ARVORES.filter(a => RAIO_COPA[a.tipo]).map(a => ({ x: a.x, z: a.z, r: RAIO_COPA[a.tipo]*a.escala }));

  return {
    ground,
    PLAZA,
    AVENUES,
    copas,
    plantAndSaveFlor,
    plantAndSaveVela,
    scatterFlowers,
    isFreeSpot,
    gatherFireflies: (x, z) => borboletas.juntar(x, z),
    update,
    // força uma hora específica (0–24) ou volta ao relógio real com null —
    // usado nos testes visuais e reservado pro futuro botão "ver ao entardecer"
    setHora(h){ horaForcada = h; applyTimeOfDay(); },
    // o governador de qualidade puxa daqui quando o aparelho não dá conta
    reduzirGrama: (f) => chao.reduzirGrama(f),
  };
}
