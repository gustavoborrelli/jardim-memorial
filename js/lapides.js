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

  const stoneMat = new THREE.MeshStandardMaterial({color:0xcbc0b0, roughness:0.85});
  const stoneGroup = new THREE.Group();
  scene.add(stoneGroup);

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
    ctx.font = 'italic 46px Georgia, serif';
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
    g.rotation.y = Math.PI/2; // walk through it along the x direction
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

  function buildStone(plot, data){
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.15,0.18,0.5), stoneMat);
    base.position.y = 0.09;
    base.castShadow = true; base.receiveShadow = true;
    g.add(base);

    const bodyGeo = new THREE.BoxGeometry(1.0, 1.1, 0.28);
    const body = new THREE.Mesh(bodyGeo, stoneMat);
    body.position.y = 0.18 + 0.55;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5,8,4,0,Math.PI*2,0,Math.PI/2), stoneMat);
    cap.scale.set(1,0.42,0.56);
    cap.position.y = 0.18 + 1.1;
    cap.castShadow = true;
    g.add(cap);

    const tex = engraveTexture(data.name, data.dates, data.msg, data.photo || null);
    const plaqueMat = new THREE.MeshStandardMaterial({map:tex, transparent:true, roughness:0.9});
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.92,1.0), plaqueMat);
    plaque.position.set(0, 0.18+0.58, 0.145);
    g.add(plaque);

    g.position.set(plot.x, 0, plot.z);
    g.userData = { isStone:true, plotRef:plot, data };
    return g;
  }

  function markEmptyPlot(plot){
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55,0.6,0.04,8),
      new THREE.MeshStandardMaterial({color:0x94a67f, roughness:1, transparent:true, opacity:0.55})
    );
    marker.position.set(plot.x, 0.021, plot.z);
    marker.userData = { isEmptyPlot:true, plotRef:plot };
    stoneGroup.add(marker);
    plot.marker = marker;
    const stake = new THREE.Mesh(new THREE.ConeGeometry(0.05,0.35,6), new THREE.MeshStandardMaterial({color:0x6b5744}));
    stake.position.set(plot.x, 0.17, plot.z);
    stoneGroup.add(stake);
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
  async function saveMemorial(plot, { name, dates, msg, photoFile }){
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
    createTribute,
    saveMemorial,
    deleteMemorial,
    pickEmptyPlot,
    pickStone,
  };
}
