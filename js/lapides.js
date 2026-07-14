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

import { supabase } from './supabaseClient.js';

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
  function makeGraveTexture(tint){
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = tint.base;
    ctx.fillRect(0,0,128,128);
    for(let i=0;i<260;i++){
      const shade = Math.random()*40-20;
      ctx.fillStyle = `rgba(${tint.speck[0]+shade},${tint.speck[1]+shade},${tint.speck[2]+shade},0.28)`;
      ctx.fillRect(Math.random()*128, Math.random()*128, 2.2,2.2);
    }
    if(tint.moss){
      ctx.fillStyle = 'rgba(94,124,72,0.16)';
      for(let i=0;i<7;i++){
        const x = Math.random()*128, y = 90+Math.random()*38, r = 8+Math.random()*14;
        ctx.beginPath(); ctx.ellipse(x,y,r,r*0.6,0,0,Math.PI*2); ctx.fill();
      }
    }
    return new THREE.CanvasTexture(c);
  }
  const STONE_TINTS = [
    {base:'#cbc0b0', speck:[150,140,120], moss:false},   // arenito quente
    {base:'#b7bcc2', speck:[120,126,132], moss:true},    // granito frio
    {base:'#c3c2a4', speck:[140,142,110], moss:true},     // pedra musgosa
  ];
  // só os mapas de textura (o "grão" da pedra); a cor de cada lápide vem da
  // paleta escolhida por quem cria a homenagem, então o material não pode
  // mais ser compartilhado — cada lápide clássica ganha o seu, tingido.
  const stoneMaps = STONE_TINTS.map(t => makeGraveTexture(t));
  const plinthMat = new THREE.MeshStandardMaterial({map:stoneMaps[0], color:0xffffff, roughness:0.9});
  const charmMat = new THREE.MeshStandardMaterial({color:0xd8b978, roughness:0.6});
  // mármore/calcário claro dos formatos ossinho/pata — mais liso e polido
  // (roughness baixo) que a pedra rústica da clássica, igual a referência
  // de design pedia. Compartilhado entre as duas peças: a cor escolhida
  // nunca tinge o corpo inteiro, só aparece como detalhe (ver PALETTE).
  const marbleMap = makeGraveTexture({base:'#f6efe1', speck:[205,193,170], moss:false});
  const marbleMat = new THREE.MeshStandardMaterial({map:marbleMap, color:0xffffff, roughness:0.5});

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
    c.width = 512; c.height = 110;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8a6a48';
    ctx.fillRect(0,0,512,110);
    // wood grain
    ctx.strokeStyle = 'rgba(70,50,32,0.35)';
    for(let i=0;i<9;i++){
      ctx.beginPath();
      ctx.moveTo(0, 8+i*12+Math.random()*4);
      ctx.bezierCurveTo(170, 4+i*12, 340, 14+i*12, 512, 8+i*12);
      ctx.stroke();
    }
    ctx.strokeStyle = '#5c4630';
    ctx.lineWidth = 8;
    ctx.strokeRect(4,4,504,102);
    ctx.fillStyle = '#f4ead8';
    ctx.textAlign = 'center';
    const maxWidth = 460; // deixa margem dentro da moldura de 504px
    let fontSize = 46;
    do {
      ctx.font = `italic ${fontSize}px Georgia, serif`;
      fontSize -= 2;
    } while (ctx.measureText(text).width > maxWidth && fontSize > 20);
    ctx.fillText(text, 256, 70);
    return new THREE.CanvasTexture(c);
  }
  const archWood = new THREE.MeshStandardMaterial({color:0x6b5236, roughness:0.9});
  SECTIONS.forEach(sec=>{
    const g = new THREE.Group();
    [-1.4, 1.4].forEach(off=>{
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.11,2.3,7), archWood);
      post.position.set(off, 1.15, 0);
      post.castShadow = true;
      g.add(post);
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3.3,0.14,0.14), archWood);
    beam.position.y = 2.3;
    g.add(beam);
    const plank = new THREE.Mesh(
      new THREE.PlaneGeometry(2.9, 0.62),
      new THREE.MeshStandardMaterial({map:makeSectionSign(sec.name), roughness:0.85, side:THREE.DoubleSide})
    );
    plank.position.y = 1.95;
    g.add(plank);
    // stand at the edge of the N-S avenue, marking the walk-in entrance to the quadrant
    g.position.set(sec.sx*4.7, 0, sec.sz*12);
    // face the readable (non-mirrored) side of the double-sided plank toward
    // whoever is walking in from the avenue, which is the opposite side from
    // the quadrant itself
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

  function engraveTexture(name, dates, msg, photoImg){
    const c = document.createElement('canvas');
    c.width = 300; c.height = 300;
    const ctx = c.getContext('2d');
    ctx.clearRect(0,0,300,300);
    ctx.textAlign = 'center';

    if(photoImg){
      // circular photo in a carved frame at the top
      const cx = 150, cy = 82, r = 56;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
      const ar = photoImg.width / photoImg.height;
      let dw = r*2, dh = r*2;
      if(ar > 1){ dw = r*2*ar; } else { dh = r*2/ar; }
      ctx.drawImage(photoImg, cx-dw/2, cy-dh/2, dw, dh);
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(90,78,64,0.9)';
      ctx.stroke();

      ctx.fillStyle = 'rgba(70,60,52,0.92)';
      ctx.font = 'italic 27px Georgia, serif';
      ctx.fillText(name, 150, 176);
      ctx.font = '14px Georgia, serif';
      ctx.fillStyle = 'rgba(70,60,52,0.65)';
      ctx.fillText(dates || '', 150, 198);
      ctx.font = '13px Georgia, serif';
      ctx.fillStyle = 'rgba(70,60,52,0.8)';
      wrapText(ctx, msg || '', 150, 232, 240, 17);
    } else {
      ctx.fillStyle = 'rgba(70,60,52,0.92)';
      ctx.font = 'italic 36px Georgia, serif';
      ctx.fillText(name, 150, 112);
      ctx.font = '17px Georgia, serif';
      ctx.fillStyle = 'rgba(70,60,52,0.65)';
      ctx.fillText(dates || '', 150, 144);
      ctx.font = '16px Georgia, serif';
      ctx.fillStyle = 'rgba(70,60,52,0.8)';
      wrapText(ctx, msg || '', 150, 190, 240, 21);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }
  function wrapText(ctx, text, x, y, maxWidth, lineHeight){
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
    lines.forEach((l,i)=> ctx.fillText(l.trim(), x, startY + i*lineHeight));
  }

  function makePlaque(data, geometry){
    const tex = engraveTexture(data.name, data.dates, data.msg, data.photo || null);
    const plaqueMat = new THREE.MeshStandardMaterial({map:tex, transparent:true, roughness:0.9});
    return new THREE.Mesh(geometry, plaqueMat);
  }

  function buildClassicStone(data, cor, r1, r2){
    const g = new THREE.Group();
    const variant = Math.floor(r1*3);       // silhueta: 0 arco, 1 lousa reta, 2 arco+charme
    const stoneMat = new THREE.MeshStandardMaterial({map:stoneMaps[Math.floor(r2*3)], color:cor, roughness:0.9});

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.15,0.18,0.5), stoneMat);
    base.position.y = 0.09;
    base.castShadow = true; base.receiveShadow = true;
    g.add(base);

    let bodyH = 1.1, plaqueY;
    if(variant === 1){
      // lousa reta e um pouco mais larga, sem topo arredondado
      bodyH = 0.86;
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.08, bodyH, 0.28), stoneMat);
      body.position.y = 0.18 + bodyH/2;
      body.castShadow = true; body.receiveShadow = true;
      g.add(body);
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.14,0.06,0.32), stoneMat);
      ridge.position.y = 0.18 + bodyH + 0.02;
      ridge.castShadow = true;
      g.add(ridge);
      plaqueY = 0.18 + bodyH*0.56;
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, bodyH, 0.28), stoneMat);
      body.position.y = 0.18 + 0.55;
      body.castShadow = true; body.receiveShadow = true;
      g.add(body);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5,8,4,0,Math.PI*2,0,Math.PI/2), stoneMat);
      cap.scale.set(1,0.42,0.56);
      cap.position.y = 0.18 + 1.1;
      cap.castShadow = true;
      g.add(cap);
      plaqueY = 0.18+0.58;

      if(variant === 2){
        // pequeno charme de pata no topo — um carinho a mais pra homenagem
        const charm = new THREE.Group();
        const pad = new THREE.Mesh(new THREE.SphereGeometry(0.075,7,6), charmMat);
        pad.scale.set(1,0.62,0.9);
        charm.add(pad);
        [[-0.055,0.048],[0.055,0.048],[-0.032,0.09],[0.032,0.09]].forEach(([x,z])=>{
          const toe = new THREE.Mesh(new THREE.SphereGeometry(0.028,6,5), charmMat);
          toe.position.set(x,0.01,z);
          charm.add(toe);
        });
        charm.position.y = 0.18 + 1.29;
        charm.rotation.x = -0.15;
        g.add(charm);
      }
    }

    const plaque = makePlaque(data, new THREE.PlaneGeometry(0.92,1.0));
    plaque.position.set(0, plaqueY, 0.145);
    g.add(plaque);
    return g;
  }

  // Ossinho: osso na vertical, dois pares de nós arredondados (topo e base)
  // unidos por uma barra central — como uma lápide tradicional, só que em
  // formato de osso. Referência: projeto de design "Lápides Jardim
  // Memorial" (Ossinho Clássico). O corpo inteiro é mármore claro; a cor
  // escolhida aparece só como uma faixa fina perto do topo, tipo uma
  // "coleira" gravada — nunca tingindo a peça toda.
  function buildBoneMarker(data, cor){
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.16,0.4), marbleMat);
    base.position.y = 0.08;
    base.castShadow = true; base.receiveShadow = true;
    g.add(base);

    const barW = 0.5, barH = 1.1, barD = 0.24;
    const barBottomY = 0.16;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(barW,barH,barD), marbleMat);
    bar.position.y = barBottomY + barH/2;
    bar.castShadow = true; bar.receiveShadow = true;
    g.add(bar);

    // icosaedro facetado em vez de esfera lisa: uma esfera com poucos
    // segmentos ainda lê como um globo de vidro brilhando; facetada igual
    // as pedrinhas/folhagens do resto do jogo, lê como nó de pedra de verdade
    const knobR = 0.21;
    const knobGeo = new THREE.IcosahedronGeometry(knobR,0);
    [-1,1].forEach(side=>{
      const top = new THREE.Mesh(knobGeo, marbleMat);
      top.position.set(side*0.27, barBottomY+barH-0.06, 0);
      top.castShadow = true;
      g.add(top);
      const bottom = new THREE.Mesh(knobGeo, marbleMat);
      bottom.position.set(side*0.27, barBottomY+0.06, 0);
      bottom.castShadow = true;
      g.add(bottom);
    });

    // faixa-detalhe: a única parte que usa a cor escolhida, como um colar
    // gravado perto do topo da barra
    const accentMat = new THREE.MeshStandardMaterial({color:cor, roughness:0.5});
    const band = new THREE.Mesh(new THREE.BoxGeometry(barW+0.04,0.09,barD+0.01), accentMat);
    band.position.y = barBottomY+barH-0.24;
    g.add(band);

    const plaque = makePlaque(data, new THREE.PlaneGeometry(0.42,0.46));
    plaque.position.set(0, barBottomY+barH*0.4, barD/2+0.01);
    g.add(plaque);
    return g;
  }

  // Pata: almofada oval com quatro dedos sobre um pequeno plinto — a foto e
  // o texto ficam no plinto (do mesmo tamanho da placa da clássica, pra
  // caber bem), a pata em cima é só o toque decorativo. Cada dedo ganha uma
  // "unha" pintada na cor escolhida — de novo, cor como detalhe, não tinta.
  function buildPawMarker(data, cor){
    // tudo montado num grupo interno maior (1.3x) e devolvido dentro de um
    // grupo vazio por fora — assim o ajuste de escala aleatória que
    // buildStone() aplica no grupo de fora não sobrescreve esse "maior"
    const inner = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.0,0.16,0.42), marbleMat);
    base.position.y = 0.08;
    base.castShadow = true; base.receiveShadow = true;
    inner.add(base);

    const plinthH = 0.62;
    const plinthBottomY = 0.16;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.92,plinthH,0.26), marbleMat);
    plinth.position.y = plinthBottomY + plinthH/2;
    plinth.castShadow = true; plinth.receiveShadow = true;
    inner.add(plinth);

    const plaque = makePlaque(data, new THREE.PlaneGeometry(0.78,0.5));
    plaque.position.set(0, plinthBottomY+plinthH*0.52, 0.14);
    inner.add(plaque);

    // almofada oval por cima do plinto, encaixada (sem deixar vão flutuando)
    // — icosaedro facetado em vez de esfera lisa, senão vira "globo de vidro"
    const padY = plinthBottomY + plinthH + 0.08;
    const pad = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36,1), marbleMat);
    pad.scale.set(1,0.6,0.66);
    pad.position.set(0, padY, -0.04);
    pad.castShadow = true;
    inner.add(pad);

    // quatro dedos em leque: os dois de fora mais baixos/menores, os dois
    // do meio mais altos/maiores — como uma pegada de cachorro de verdade
    const accentMat = new THREE.MeshStandardMaterial({color:cor, roughness:0.5});
    const toes = [
      { x:-0.33, y:padY+0.13, z:0.2, r:0.14 },
      { x:-0.13, y:padY+0.27, z:0.26, r:0.17 },
      { x: 0.13, y:padY+0.27, z:0.26, r:0.17 },
      { x: 0.33, y:padY+0.13, z:0.2, r:0.14 },
    ];
    toes.forEach(t=>{
      const toe = new THREE.Mesh(new THREE.IcosahedronGeometry(t.r,0), marbleMat);
      toe.position.set(t.x, t.y, t.z);
      toe.castShadow = true;
      inner.add(toe);
      const nail = new THREE.Mesh(new THREE.IcosahedronGeometry(t.r*0.3,0), accentMat);
      nail.position.set(t.x, t.y+t.r*0.55, t.z+t.r*0.85);
      inner.add(nail);
    });

    inner.scale.setScalar(1.3);
    const g = new THREE.Group();
    g.add(inner);
    return g;
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

  function markEmptyPlot(plot){
    // disco fino e quase invisível cobrindo toda a vaga — é o alvo real do
    // clique (a área precisa ficar igual à de antes, só o visual mudou)
    const hitDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.58,16),
      new THREE.MeshStandardMaterial({color:0xe8caa0, roughness:1, transparent:true, opacity:0.16})
    );
    hitDisc.rotation.x = -Math.PI/2;
    hitDisc.position.set(plot.x, 0.02, plot.z);
    hitDisc.userData = { isEmptyPlot:true, plotRef:plot };
    stoneGroup.add(hitDisc);
    plot.marker = hitDisc;

    // ringue decorativo por cima, com um leve brilho quente — convida a
    // clicar sem parecer uma mancha sólida na grama
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42,0.58,20),
      new THREE.MeshStandardMaterial({color:0xe8caa0, roughness:1, transparent:true, opacity:0.5, side:THREE.DoubleSide, emissive:0xffdca0, emissiveIntensity:0.15})
    );
    ring.rotation.x = -Math.PI/2;
    ring.position.set(plot.x, 0.023, plot.z);
    ring.userData = { plotRef:plot };
    stoneGroup.add(ring);

    // pequena estaca com um charme de patinha, no lugar do cone simples
    const stakeMat = new THREE.MeshStandardMaterial({color:0x8a6a48, roughness:0.9});
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.03,0.3,6), stakeMat);
    stake.position.set(plot.x, 0.15, plot.z);
    stake.userData = { plotRef:plot };
    stoneGroup.add(stake);
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.045,7,6), charmMat);
    pad.scale.set(1,0.6,0.85);
    pad.position.set(plot.x, 0.31, plot.z);
    pad.userData = { plotRef:plot };
    stoneGroup.add(pad);
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
