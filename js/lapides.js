"use strict";

/*
  LÁPIDES
  Cuida das quatro seções do jardim, dos "plots" (lugares onde uma lápide
  pode existir), da construção visual de cada lápide (com o texto e a foto
  gravados numa textura) e das funções de raycast que dizem se o mouse está
  sobre uma pedra vazia ou uma lápide já ocupada.

  createLapides(scene) monta as lápides iniciais dentro da scene e devolve
  as funções que main.js e menuUi.js precisam para criar novas homenagens.
*/

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { supabase } from './supabaseClient.js';
import { matPedra, matMadeira, torneado } from './gfx/materiais.js';
import { malhaSDF, esculpir, caixa, elipsoide } from './gfx/sdf.js';
import { normalDeAltura, sorteador } from './gfx/ruido.js';
import { escolherPerfil } from './gfx/qualidade.js';

// as vagas: quatro por jardim. Exportado porque o chão precisa saber onde elas
// ficam pra abrir uma clareira na grama em volta de cada uma.
export const POSICOES_VAGA = [];
[[1,-1],[-1,-1],[1,1],[-1,1]].forEach(([sx, sz])=>{
  [9,15].forEach(ax=> [9,15].forEach(az=> POSICOES_VAGA.push({ x: sx*ax, z: sz*az })));
});

export function createLapides(scene) {

  const stoneGroup = new THREE.Group();
  scene.add(stoneGroup);

  /* variedade das pedras: 3 tons de pedra + 3 silhuetas, escolhidos de
     forma determinística a partir da posição do plot (mesmo plot sempre
     rende a mesma pedra, mesmo depois de recarregar a página) */
  function hash01(x, z){
    const h = Math.sin(x*127.1 + z*311.7) * 43758.5453;
    return h - Math.floor(h);
  }
  const perfil = escolherPerfil();
  const STONE_TINTS = [
    { musgo: 0, manchas: 0.32, escala: 1.5 },   // arenito quente
    { musgo: 0.55, manchas: 0.26, escala: 1.9 }, // granito frio
    { musgo: 0.85, manchas: 0.36, escala: 1.6 }, // pedra musgosa
  ];
  const charmMat = new THREE.MeshStandardMaterial({ color: 0xd8b978, roughness: 0.42, metalness: 0.55 });
  // mármore claro dos formatos ossinho/pata. Fosco de propósito: polido demais a
  // forma redonda vira bola de vidro. A cor escolhida nunca tinge o corpo inteiro,
  // só aparece como detalhe (ver PALETTE).
  const marbleMat = matPedra({ cor: 0xe9e1d0, rugosidade: 0.64, escala: 1.1, relevo: 0.002, manchas: 0.16, veios: 0.05, pontos: 0.035, envMapIntensity: 1.1 });

  /* ============ PERSONALIZAÇÃO: formato + cor da lápide ============
     Um jardim menos "cemitério" e mais convidativo: em vez de só a pedra
     cinza tradicional, quem cria a homenagem escolhe um formato com mais
     carinho e uma cor alegre. A cor NUNCA tinge a peça inteira (isso
     deixava tudo "lavado") — ela aparece só como um detalhe pintado: a
     faixa do ossinho, a unha da pata. Exportado no retorno do módulo pra
     menuUi.js montar os seletores sem duplicar essas listas. */
  const PALETTE = [
    { id:'pedra', hex:'#c9beb0', label:'Pedra' },
    { id:'ceu',   hex:'#8ecae6', label:'Céu' },
    { id:'coral', hex:'#ff9a8a', label:'Coral' },
    { id:'sol',   hex:'#ffd166', label:'Sol' },
    { id:'lilas', hex:'#c9a8e8', label:'Lilás' },
    { id:'menta', hex:'#8fd9b6', label:'Menta' },
  ];
  const FORMATOS = [
    { id:'classica', label:'Clássica', icon:'🪨' },
    { id:'ossinho',  label:'Ossinho',  icon:'🦴' },
    { id:'pata',     label:'Pata',     icon:'🐾' },
  ];

  /* four named sections, one per quadrant */
  const SECTIONS = [
    {name:'Recanto do Sol',          sx: 1, sz: -1},
    {name:'Bosque da Saudade',       sx: -1, sz: -1},
    {name:'Campo das Estrelas',      sx: 1, sz: 1},
    {name:'Prado dos Companheiros',  sx: -1, sz: 1},
  ];

  const plots = [];
  SECTIONS.forEach(sec=>{
    [9,15].forEach(ax=>{
      [9,15].forEach(az=>{
        plots.push({x:sec.sx*ax, z:sec.sz*az, section:sec.name, occupied:false, mesh:null, data:null});
      });
    });
  });

  /* entrance archway with a name plank for each section */
  function makeSectionSign(text){
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 214;
    const ctx = c.getContext('2d');
    ctx.clearRect(0,0,1024,214);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let fontSize = 104;
    do {
      ctx.font = `italic ${fontSize}px Georgia, serif`;
      fontSize -= 2;
    } while (ctx.measureText(text).width > 900 && fontSize > 40);
    // entalhe: sombra por cima, luz por baixo, miolo claro de tinta gasta
    ctx.fillStyle = 'rgba(30,18,8,0.75)';
    ctx.fillText(text, 512, 104);
    ctx.fillStyle = 'rgba(255,240,210,0.3)';
    ctx.fillText(text, 512, 110);
    ctx.fillStyle = '#f2e6cf';
    ctx.fillText(text, 512, 107);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }
  const archWood = matMadeira(0x7a5e40);
  const geoPosteArco = torneado([
    [0, 0], [0.13, 0], [0.135, 0.06], [0.1, 0.14], [0.09, 2.2], [0.105, 2.24], [0.112, 2.3], [0.1, 2.36], [0.05, 2.4], [0, 2.41],
  ], 12);
  const geoVigaArco = new RoundedBoxGeometry(3.3, 0.12, 0.14, 2, 0.03);
  const geoTabua = new RoundedBoxGeometry(2.96, 0.66, 0.05, 2, 0.02);
  const geoFace = new THREE.PlaneGeometry(2.88, 0.6);
  SECTIONS.forEach(sec=>{
    const g = new THREE.Group();
    [-1.4, 1.4].forEach(off=>{
      const post = new THREE.Mesh(geoPosteArco, archWood);
      post.position.set(off, 0, 0);
      post.castShadow = true;
      post.receiveShadow = true;
      g.add(post);
    });
    const beam = new THREE.Mesh(geoVigaArco, archWood);
    beam.position.y = 2.3;
    beam.castShadow = true;
    g.add(beam);
    const plank = new THREE.Mesh(geoTabua, archWood);
    plank.position.y = 1.86;
    plank.castShadow = true;
    plank.receiveShadow = true;
    g.add(plank);
    // correntinhas que seguram a tábua
    [-1.1, 1.1].forEach(x => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 6), archWood);
      c.position.set(x, 2.22, 0);
      g.add(c);
    });
    // uma face de cada lado: o nome se lê de quem vem de qualquer direção
    const tex = makeSectionSign(sec.name);
    const matFace = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, transparent: true });
    [0, Math.PI].forEach(rot => {
      const face = new THREE.Mesh(geoFace, matFace);
      face.rotation.y = rot;
      face.position.set(0, 1.86, rot === 0 ? 0.027 : -0.027);
      g.add(face);
    });
    // stand at the edge of the N-S avenue, marking the walk-in entrance to the quadrant
    g.position.set(sec.sx*4.7, 0, sec.sz*12);
    g.rotation.y = -sec.sx * Math.PI/2;
    scene.add(g);
  });

  function loadImage(url){
    return new Promise(resolve=>{
      if(!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous'; // precisa pra não "sujar" o canvas com imagem de outra origem
      img.onload = ()=> resolve(img);
      img.onerror = ()=> resolve(null);
      img.src = url;
    });
  }

  /* Gravação na pedra: desenha em duas telas, a cor e a altura. A altura vira
     mapa de normais, e assim a letra fica de fato afundada, pegando luz na borda. */
  function engraveTexture(name, dates, msg, photoImg){
    const RES = 1024, K = RES/300;
    const c = document.createElement('canvas'); c.width = c.height = RES;
    const a = document.createElement('canvas'); a.width = a.height = RES;
    const ctx = c.getContext('2d'), alt = a.getContext('2d');
    alt.fillStyle = '#ffffff'; alt.fillRect(0,0,RES,RES);
    ctx.scale(K,K); alt.scale(K,K);
    [ctx, alt].forEach(x => { x.textAlign = 'center'; });

    const INK = 'rgba(52,44,38,0.94)';
    const gravar = (txt, x, y, font, alpha = 1) => {
      ctx.font = font; alt.font = font;
      // borda de luz logo abaixo da letra: é o que lê como entalhe
      ctx.fillStyle = `rgba(255,252,240,${0.5*alpha})`;
      ctx.fillText(txt, x+0.25, y+0.55);
      ctx.fillStyle = INK.replace('0.94', (0.94*alpha).toFixed(2));
      ctx.fillText(txt, x, y);
      alt.fillStyle = '#000000';
      alt.fillText(txt, x, y);
    };

    if(photoImg){
      // foto redonda em moldura gravada, no alto
      const cx = 150, cy = 82, r = 56;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
      const ar = photoImg.width / photoImg.height;
      let dw = r*2, dh = r*2;
      if(ar > 1){ dw = r*2*ar; } else { dh = r*2/ar; }
      ctx.drawImage(photoImg, cx-dw/2, cy-dh/2, dw, dh);
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(90,78,64,0.9)';
      ctx.stroke();
      alt.beginPath(); alt.arc(cx, cy, r, 0, Math.PI*2);
      alt.lineWidth = 6; alt.strokeStyle = '#000'; alt.stroke();

      gravar(name, 150, 176, 'italic 27px Georgia, serif');
      gravar(dates || '', 150, 198, '14px Georgia, serif', 0.72);
      ctx.font = alt.font = '13px Georgia, serif';
      wrapText(ctx, msg || '', 150, 232, 240, 17, (l, x, y) => gravar(l, x, y, '13px Georgia, serif', 0.85));
    } else {
      gravar(name, 150, 112, 'italic 36px Georgia, serif');
      gravar(dates || '', 150, 144, '17px Georgia, serif', 0.72);
      ctx.font = alt.font = '16px Georgia, serif';
      wrapText(ctx, msg || '', 150, 190, 240, 21, (l, x, y) => gravar(l, x, y, '16px Georgia, serif', 0.85));
    }
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    const normal = normalDeAltura(a, 1.6);
    return { map, normal };
  }
  function wrapText(ctx, text, x, y, maxWidth, lineHeight, desenhar){
    const words = text.split(' ');
    let line = '';
    let lines = [];
    for(let n=0;n<words.length;n++){
      const test = line + words[n] + ' ';
      if(ctx.measureText(test).width > maxWidth && n>0){
        lines.push(line); line = words[n] + ' ';
      } else { line = test; }
    }
    lines.push(line);
    lines = lines.slice(0,3);
    const startY = y - (lines.length-1)*lineHeight/2;
    lines.forEach((l,i)=> desenhar(l.trim(), x, startY + i*lineHeight));
  }

  function makePlaque(data, geometry){
    const { map, normal } = engraveTexture(data.name, data.dates, data.msg, data.photo || null);
    const plaqueMat = new THREE.MeshStandardMaterial({
      map, normalMap: normal, normalScale: new THREE.Vector2(0.9, 0.9),
      transparent: true, roughness: 0.82, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const m = new THREE.Mesh(geometry, plaqueMat);
    m.userData.semAO = true;
    return m;
  }

  /* geometrias de pedra: uma de cada, compartilhadas por todas as lápides */
  const geoCache = {};
  const celula = 0.012*perfil.celulaSDF;

  // perfil de lápide com topo em arco e chanfro de verdade nas arestas
  function geoLousa(variante){
    if(geoCache['lousa'+variante]) return geoCache['lousa'+variante];
    const s = new THREE.Shape();
    const L = variante === 1 ? 0.54 : 0.5, H = variante === 1 ? 0.88 : 1.12;
    s.moveTo(-L, 0);
    s.lineTo(L, 0);
    if(variante === 1){
      // lousa reta, com os cantos de cima bem arredondados
      s.lineTo(L, H-0.1);
      s.quadraticCurveTo(L, H, L-0.1, H);
      s.lineTo(-L+0.1, H);
      s.quadraticCurveTo(-L, H, -L, H-0.1);
    } else {
      s.lineTo(L, H-0.3);
      s.absellipse(0, H-0.3, L, 0.42, 0, Math.PI, false);
    }
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.2, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 3, curveSegments: 22,
    });
    g.translate(0, 0, -0.1);
    geoCache['lousa'+variante] = g;
    return g;
  }
  function geoBase(l, a, p){
    const k = `base${l}${a}${p}`;
    if(!geoCache[k]) geoCache[k] = new RoundedBoxGeometry(l, a, p, 3, 0.03);
    return geoCache[k];
  }

  // Ossinho: osso na vertical, sobre uma base — referência "Ossinho Clássico".
  // Esculpido inteiro de uma vez, com as duas pontas iguais e um entalhe fundo em
  // cada uma: é esse "V" que faz a forma ler como osso de desenho, sem dúvida.
  const OSSO = { baixo: 0.2, alto: 1.32, meia: 0.245 };
  function geoOsso(){
    if(geoCache.osso) return geoCache.osso;
    const { baixo, alto, meia } = OSSO;
    // lóbulos largos e achatados saindo pouco da haste: biscoito de cachorro, e não
    // duas bolas presas num cabo
    const nos = [[0.24, alto-0.1], [-0.24, alto-0.1], [0.24, baixo+0.1], [-0.24, baixo+0.1]];
    const lista = [[caixa(0, (baixo+alto)/2, 0, meia, (alto-baixo)/2-0.1, 0.115, 0.05), 0]];
    nos.forEach(([x, y]) => lista.push([elipsoide(x, y, 0, 0.168, 0.158, 0.13), 0.075]));
    const f = esculpir(lista);
    geoCache.osso = malhaSDF(f, [[-0.5, baixo-0.14, -0.18], [0.5, alto+0.14, 0.18]], celula*0.85);
    return geoCache.osso;
  }

  // Pata: pedra de caminho deitada na grama, almofada e dedos numa peça só, com o
  // topo plano (é onde o nome está gravado) e levemente inclinada para quem chega —
  // sem isso ela some no ângulo raso da câmera. Referência: foto de pedra-pata real.
  const INCLINA = 0.36;
  const senI = Math.sin(INCLINA), cosI = Math.cos(INCLINA);
  const PATA_Y = 0.2, PATA_Z = -0.05, PATA_TOPO = 0.1;
  const paraMundo = (ly, lz) => [PATA_Y + ly*cosI - lz*senI, PATA_Z + ly*senI + lz*cosI];
  const TOES = [
    { x:-0.37, z:0.33, r:0.14 },
    { x:-0.135, z:0.43, r:0.158 },
    { x: 0.135, z:0.43, r:0.158 },
    { x: 0.37, z:0.33, r:0.14 },
  ];
  function geoPata(){
    if(geoCache.pata) return geoCache.pata;
    const lista = [[elipsoide(0, -0.1, -0.02, 0.46, 0.34, 0.37), 0]];
    TOES.forEach(t => lista.push([elipsoide(t.x, -0.04, t.z, t.r, 0.17, t.r*1.05), 0.03]));
    const corpo = esculpir(lista);
    // topo plano com a quina arredondada; embaixo, corta o que afundaria no chão
    const emPe = (x, y, z) => {
      const py = y-PATA_Y, pz = z-PATA_Z;
      const ly = py*cosI + pz*senI, lz = -py*senI + pz*cosI;
      const d = corpo(x, ly, lz);
      const k = 0.035, tampa = ly-PATA_TOPO;
      const h = Math.max(k-Math.abs(d-tampa), 0)/k;
      return Math.max(d, tampa) + h*h*k*0.25;
    };
    const corte = (x, y, z) => Math.max(emPe(x, y, z), -(y+0.02));
    geoCache.pata = malhaSDF(corte, [[-0.62, -0.06, -0.62], [0.62, 0.5, 0.72]], celula*0.9);
    return geoCache.pata;
  }

  // só o que importa para o clique: uma caixa simples, invisível. Raycast em milhares
  // de triângulos a cada movimento do mouse pesaria à toa.
  function comAlvoDeClique(g, l, a, p, y = a/2, z = 0){
    g.traverse(o => { if(o.isMesh) o.raycast = () => {}; });
    const alvo = new THREE.Mesh(new THREE.BoxGeometry(l, a, p), new THREE.MeshBasicMaterial());
    alvo.position.set(0, y, z);
    alvo.visible = false;
    g.add(alvo);
    return g;
  }

  function sombra(m){ m.castShadow = true; m.receiveShadow = true; return m; }

  function buildClassicStone(data, cor, r1, r2){
    const g = new THREE.Group();
    const variant = Math.floor(r1*3);       // silhueta: 0 arco, 1 lousa reta, 2 arco+charme
    const tom = STONE_TINTS[Math.floor(r2*3)];
    const stoneMat = matPedra({ cor, rugosidade: 0.86, escala: tom.escala, relevo: 0.0045, musgo: tom.musgo, alturaMusgo: 0.5, manchas: tom.manchas });

    const base = sombra(new THREE.Mesh(geoBase(1.3, 0.2, 0.56), stoneMat));
    base.position.y = 0.1;
    g.add(base);

    const body = sombra(new THREE.Mesh(geoLousa(variant === 1 ? 1 : 0), stoneMat));
    body.position.y = 0.2;
    g.add(body);

    let plaqueY = 0.2 + 0.56;
    if(variant === 1){
      plaqueY = 0.2 + 0.46;
    }
    if(variant === 2){
      // pequeno charme de pata no topo — um carinho a mais pra homenagem
      const charm = new THREE.Group();
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), charmMat);
      pad.scale.set(1, 0.62, 0.9);
      charm.add(pad);
      [[-0.055,0.048],[0.055,0.048],[-0.024,0.09],[0.024,0.09]].forEach(([x,z])=>{
        const toe = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), charmMat);
        toe.position.set(x,0.01,z);
        charm.add(toe);
      });
      charm.position.y = 0.2 + 1.27;
      charm.rotation.x = -0.15;
      charm.traverse(o => { if(o.isMesh) o.castShadow = true; });
      g.add(charm);
    }

    const plaque = makePlaque(data, new THREE.PlaneGeometry(0.92, 0.92));
    plaque.position.set(0, plaqueY, 0.137);
    g.add(plaque);
    return comAlvoDeClique(g, 1.2, 1.5, 0.5, 0.75);
  }

  // A cor escolhida aparece só na faixa fina perto do topo, uma "coleira" gravada.
  function buildBoneMarker(data, cor){
    const g = new THREE.Group();
    const base = sombra(new THREE.Mesh(geoBase(1.0, 0.2, 0.5), marbleMat));
    base.position.y = 0.1;
    g.add(base);
    g.add(sombra(new THREE.Mesh(geoOsso(), marbleMat)));

    const { baixo, alto, meia } = OSSO;
    const accentMat = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.48 });
    const band = sombra(new THREE.Mesh(geoBase(meia*2+0.02, 0.074, 0.25), accentMat));
    band.position.y = alto-0.3;
    g.add(band);

    const plaque = makePlaque(data, new THREE.PlaneGeometry(0.48, 0.52));
    plaque.position.set(0, (baixo+alto)/2 - 0.06, 0.1165);
    g.add(plaque);
    return comAlvoDeClique(g, 0.9, 1.6, 0.5, 0.8);
  }

  function buildPawMarker(data, cor){
    const inner = new THREE.Group();
    inner.add(sombra(new THREE.Mesh(geoPata(), marbleMat)));

    // unha: detalhe na cor escolhida, na pontinha de cada dedo
    const accentMat = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.48 });
    const geoUnha = geoCache.unha || (geoCache.unha = new THREE.SphereGeometry(1, 14, 10));
    TOES.forEach(t => {
      const [y, z] = paraMundo(PATA_TOPO - 0.012, t.z + t.r*0.62);
      const nail = new THREE.Mesh(geoUnha, accentMat);
      nail.scale.set(t.r*0.36, t.r*0.15, t.r*0.3);
      nail.position.set(t.x, y, z);
      nail.rotation.x = INCLINA;
      nail.castShadow = true;
      inner.add(nail);
    });

    // a homenagem gravada no topo plano da almofada
    const plaque = makePlaque(data, new THREE.PlaneGeometry(0.58, 0.58));
    const [py, pz] = paraMundo(PATA_TOPO + 0.002, -0.04);
    plaque.rotation.x = -Math.PI/2 + INCLINA;
    plaque.position.set(0, py, pz);
    inner.add(plaque);

    inner.scale.setScalar(1.3);
    const g = new THREE.Group();
    g.add(inner);
    return comAlvoDeClique(g, 1.5, 0.7, 1.5, 0.3, 0.1);
  }

  function buildStone(plot, data){
    const formato = data.formato || 'classica';
    const cor = data.cor || PALETTE[0].hex;
    const r1 = hash01(plot.x, plot.z);
    const r2 = hash01(plot.z, plot.x);
    const jitterRot = (r1-0.5)*0.12;
    const jitterTilt = (r2-0.5)*0.035;
    const scaleVar = 0.94 + r2*0.14;

    let g;
    if(formato === 'ossinho') g = buildBoneMarker(data, cor);
    else if(formato === 'pata') g = buildPawMarker(data, cor);
    else g = buildClassicStone(data, cor, r1, r2);

    g.scale.setScalar(scaleVar);
    g.rotation.z = jitterTilt;
    g.position.set(plot.x, 0, plot.z);
    g.userData = { isStone:true, plotRef:plot, data, baseRotY: jitterRot };
    g.rotation.y = jitterRot;
    return g;
  }

  // vaga vazia: círculo de seixos com uma estaca de madeira e uma patinha.
  // Objeto de jardim de verdade, em vez de um anel desenhado no chão.
  const geoSeixo = new THREE.IcosahedronGeometry(1, 2);
  {
    const r = sorteador(44);
    const p = geoSeixo.attributes.position;
    for(let i=0;i<p.count;i++){
      const k = 0.9 + r()*0.1;
      p.setXYZ(i, p.getX(i)*k, p.getY(i)*k*0.68, p.getZ(i)*k);
    }
    geoSeixo.computeVertexNormals();
  }
  const matSeixo = matPedra({ cor: 0xe4dac6, escala: 3, relevo: 0.012, manchas: 0.28, rugosidade: 0.75 });
  const matEstaca = matMadeira(0x8a6a48);
  const geoEstaca = torneado([[0, 0], [0.032, 0], [0.028, 0.28], [0.038, 0.31], [0.03, 0.34], [0, 0.35]], 8);

  function markEmptyPlot(plot){
    // alvo real do clique: fino e invisível, do mesmo tamanho de sempre
    const hitDisc = new THREE.Mesh(new THREE.CircleGeometry(0.72, 16), new THREE.MeshBasicMaterial());
    hitDisc.rotation.x = -Math.PI/2;
    hitDisc.position.set(plot.x, 0.02, plot.z);
    hitDisc.visible = false;
    hitDisc.userData = { isEmptyPlot:true, plotRef:plot };
    stoneGroup.add(hitDisc);
    plot.marker = hitDisc;

    const visual = new THREE.Group();
    visual.position.set(plot.x, 0, plot.z);
    visual.userData = { plotRef:plot };
    const r = sorteador(Math.abs(Math.round(plot.x*31 + plot.z*17)) + 3);
    const N = 15;
    const seixos = new THREE.InstancedMesh(geoSeixo, matSeixo, N);
    const d = new THREE.Object3D();
    for(let i=0;i<N;i++){
      const a = i/N*Math.PI*2 + (r()-0.5)*0.12;
      const rd = 0.62 + (r()-0.5)*0.05;
      const e = 0.058 + r()*0.04;
      d.position.set(Math.cos(a)*rd, e*0.4, Math.sin(a)*rd);
      d.rotation.y = r()*6.28;
      d.scale.setScalar(e);
      d.updateMatrix();
      seixos.setMatrixAt(i, d.matrix);
    }
    seixos.castShadow = true;
    seixos.receiveShadow = true;
    seixos.computeBoundingSphere();
    visual.add(seixos);

    const estaca = new THREE.Mesh(geoEstaca, matEstaca);
    estaca.castShadow = true;
    visual.add(estaca);
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 8), charmMat);
    pad.scale.set(1, 0.6, 0.85);
    pad.position.y = 0.36;
    visual.add(pad);
    [[-0.04,0.04],[0.04,0.04],[-0.016,0.066],[0.016,0.066]].forEach(([x,z]) => {
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), charmMat);
      t.position.set(x, 0.372, z);
      visual.add(t);
    });
    visual.traverse(o => { o.raycast = () => {}; });
    stoneGroup.add(visual);
  }

  // todas as vagas começam vazias; quem preenche é loadMemoriais(), logo abaixo
  plots.forEach(plot=> markEmptyPlot(plot));

  function installStone(plot, data, animate){
    // remove empty marker visuals
    stoneGroup.children
      .filter(c=>c.userData && c.userData.plotRef===plot)
      .forEach(c=> stoneGroup.remove(c));

    const mesh = buildStone(plot, data);
    stoneGroup.add(mesh);
    plot.occupied = true; plot.mesh = mesh; plot.data = data;

    if(animate){
      mesh.scale.setScalar(0.01);
      const start = performance.now();
      function grow(){
        const t = Math.min(1, (performance.now()-start)/500);
        const s = 0.01 + t*0.99;
        mesh.scale.setScalar(s);
        if(t<1) requestAnimationFrame(grow);
      }
      grow();
    }

    return mesh;
  }

  function createTribute(plot, data){
    return installStone(plot, data, true);
  }

  /* ============ SUPABASE: carregar memoriais salvos ============ */
  // usada tanto pro carregamento inicial quanto pelos eventos em tempo real
  async function installFromRow(row, animate){
    const plot = plots.find(p=>
      Number(p.x) === Number(row.plot_x) && Number(p.z) === Number(row.plot_z)
    );
    if(!plot || plot.occupied) return;
    const photo = await loadImage(row.foto_url);
    installStone(plot, {
      id: row.id,
      criadoPor: row.criado_por,
      name: row.nome_pet,
      dates: row.datas,
      msg: row.mensagem,
      photo,
      photoUrl: row.foto_url,
      formato: row.formato,
      cor: row.cor,
    }, animate);
  }

  // tira a lápide da cena e devolve a vaga como vazia (usado tanto por quem
  // apaga quanto pelo evento em tempo real que avisa os outros navegadores)
  function removeStoneById(id){
    const mesh = stoneGroup.children.find(c=>
      c.userData && c.userData.isStone && c.userData.data && c.userData.data.id === id
    );
    if(!mesh) return;
    const plot = mesh.userData.plotRef;
    stoneGroup.remove(mesh);
    plot.occupied = false; plot.mesh = null; plot.data = null;
    markEmptyPlot(plot);
  }

  async function loadMemoriais(){
    const { data: rows, error } = await supabase.from('memoriais').select('*');
    if(error){
      console.error('Não foi possível carregar os memoriais:', error.message);
      return;
    }
    for(const row of rows) await installFromRow(row, false);
  }
  loadMemoriais();

  /* ============ SUPABASE: lápides novas em tempo real ============ */
  // se outra pessoa criar uma homenagem enquanto o jardim está aberto aqui,
  // a lápide nasce na hora, sem precisar recarregar a página.
  supabase
    .channel('memoriais-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'memoriais' },
      payload => installFromRow(payload.new, true))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'memoriais' },
      payload => removeStoneById(payload.old.id))
    .subscribe();

  /* ============ SUPABASE: salvar um novo memorial ============ */
  async function saveMemorial(plot, { name, dates, msg, photoFile, formato, cor }){
    let fotoUrl = null;
    if(photoFile){
      const ext = (photoFile.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${plot.x}_${plot.z}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('fotos-memoriais')
        .upload(path, photoFile);
      if(uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from('fotos-memoriais').getPublicUrl(path);
      fotoUrl = pub.publicUrl;
    }
    const { data: inserted, error } = await supabase.from('memoriais').insert({
      nome_pet: name,
      datas: dates,
      mensagem: msg,
      setor: plot.section,
      plot_x: plot.x,
      plot_z: plot.z,
      foto_url: fotoUrl,
      formato: formato || 'classica',
      cor: cor || PALETTE[0].hex,
    }).select('id, criado_por').single();
    if(error){
      if(error.code === '23505'){
        // alguém reservou essa vaga entre o momento em que o modal abriu e agora;
        // busca quem foi e instala a lápide, caso o evento em tempo real ainda não tenha chegado
        const { data: existing } = await supabase
          .from('memoriais')
          .select('*')
          .eq('plot_x', plot.x)
          .eq('plot_z', plot.z)
          .maybeSingle();
        if(existing) await installFromRow(existing, true);
        const conflictErr = new Error('Essa vaga acabou de ser reservada por outra pessoa.');
        conflictErr.code = 'VAGA_OCUPADA';
        throw conflictErr;
      }
      throw error;
    }
    return { id: inserted.id, criadoPor: inserted.criado_por, fotoUrl };
  }

  // só o autor consegue apagar (RLS de 003_auth_rls.sql); remove local na
  // hora, sem esperar o evento de Realtime voltar pra quem clicou.
  async function deleteMemorial(stone){
    const { id } = stone.userData.data;
    const { error } = await supabase.from('memoriais').delete().eq('id', id);
    if(error) throw error;
    removeStoneById(id);
  }

  /* ============ SUPABASE: mensagens (livro de visitas por homenagem) ============ */
  async function getMessages(memorialId){
    const { data, error } = await supabase
      .from('mensagens')
      .select('*')
      .eq('memorial_id', memorialId)
      .order('criado_em', { ascending: true });
    if(error){ console.error('Não foi possível carregar as mensagens:', error.message); return []; }
    return data;
  }

  async function saveMessage(memorialId, { texto, autorNome }){
    const { data, error } = await supabase.from('mensagens').insert({
      memorial_id: memorialId,
      texto,
      autor_nome: autorNome || null,
    }).select().single();
    if(error) throw error;
    return data;
  }

  async function deleteMessage(id){
    const { error } = await supabase.from('mensagens').delete().eq('id', id);
    if(error) throw error;
  }

  function pickEmptyPlot(raycaster){
    const hits = raycaster.intersectObjects(
      stoneGroup.children.filter(c=>c.userData && c.userData.isEmptyPlot)
    );
    return hits.length ? hits[0].object.userData.plotRef : null;
  }

  function pickStone(raycaster){
    const hits = raycaster.intersectObjects(
      stoneGroup.children.filter(c=>c.userData && c.userData.isStone), true
    );
    if(!hits.length) return null;
    let obj = hits[0].object;
    while(obj && !(obj.userData && obj.userData.isStone)) obj = obj.parent;
    return (obj && obj.userData.data) ? obj : null;
  }

  return {
    plots,
    stoneGroup,
    PALETTE,
    FORMATOS,
    createTribute,
    saveMemorial,
    deleteMemorial,
    getMessages,
    saveMessage,
    deleteMessage,
    pickEmptyPlot,
    pickStone,
  };
}
