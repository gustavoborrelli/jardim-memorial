"use strict";

/*
  MENU / UI
  Cuida de tudo que é interface: o menu principal (jogar, escolher cachorro,
  como jogar, sobre), o modal de "deixar uma homenagem", o toast de aviso,
  o som (efeitos sonoros simples via Web Audio) e as dicas que aparecem na
  tela ao passar o mouse sobre uma lápide ou pedra vazia.

  createMenuUi(deps) liga todos os botões do HTML aos outros módulos
  (lapides, mundo, cachorros) e devolve o que main.js precisa chamar a
  cada frame (updateHints) ou a cada clique (openModalFor, chime).
*/

export function createMenuUi({ camera, lapides, world, dogController, pausedState, auth, mapaUi }) {

  const menuScreen = document.getElementById('menuScreen');
  const menuHome = document.getElementById('menuHome');
  const menuHow = document.getElementById('menuHow');
  const menuAbout = document.getElementById('menuAbout');
  const menuDogs = document.getElementById('menuDogs');

  const toastEl = document.getElementById('toast');
  const hintEmpty = document.getElementById('hintEmpty');
  const epitaphCard = document.getElementById('epitaphCard');

  const modalBack = document.getElementById('modalBack');
  const mapModalBack = document.getElementById('mapModalBack');
  const btnCancel = document.getElementById('btnCancel');
  const btnConfirm = document.getElementById('btnConfirm');
  const inName = document.getElementById('inName');
  const inDates = document.getElementById('inDates');
  const inMsg = document.getElementById('inMsg');
  const inPhoto = document.getElementById('inPhoto');
  const photoPreview = document.getElementById('photoPreview');
  const formatoPicker = document.getElementById('formatoPicker');
  const corPicker = document.getElementById('corPicker');

  let pendingPlot = null;
  let pendingPhotoImg = null;
  let pendingPhotoUrl = null;
  let pendingFormato = lapides.FORMATOS[0].id;
  let pendingCor = lapides.PALETTE[0].hex;

  /* ============ FORMATO + COR (seletores dentro do modal de homenagem) ============ */
  lapides.FORMATOS.forEach(f=>{
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'formato-opt';
    opt.dataset.id = f.id;
    opt.innerHTML = `<span class="ico">${f.icon}</span><span class="lbl">${f.label}</span>`;
    opt.addEventListener('click', ()=>{
      pendingFormato = f.id;
      formatoPicker.querySelectorAll('.formato-opt').forEach(el=> el.classList.toggle('active', el.dataset.id===f.id));
    });
    formatoPicker.appendChild(opt);
  });
  lapides.PALETTE.forEach(c=>{
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'cor-opt';
    opt.dataset.id = c.id;
    opt.title = c.label;
    opt.style.background = c.hex;
    opt.addEventListener('click', ()=>{
      pendingCor = c.hex;
      corPicker.querySelectorAll('.cor-opt').forEach(el=> el.classList.toggle('active', el.dataset.id===c.id));
    });
    corPicker.appendChild(opt);
  });
  function resetFormatoCorPicker(){
    pendingFormato = lapides.FORMATOS[0].id;
    pendingCor = lapides.PALETTE[0].hex;
    formatoPicker.querySelectorAll('.formato-opt').forEach(el=> el.classList.toggle('active', el.dataset.id===pendingFormato));
    corPicker.querySelectorAll('.cor-opt').forEach(el=> el.classList.toggle('active', el.dataset.id===lapides.PALETTE[0].id));
  }

  /* ============ MENSAGENS (livro de visitas por lápide) ============ */
  const messagesModalBack = document.getElementById('messagesModalBack');
  const msgStoneName = document.getElementById('msgStoneName');
  const msgStoneMeta = document.getElementById('msgStoneMeta');
  const messagesList = document.getElementById('messagesList');
  const inMsgAuthor = document.getElementById('inMsgAuthor');
  const inMsgText = document.getElementById('inMsgText');
  const btnMsgCancel = document.getElementById('btnMsgCancel');
  const btnMsgConfirm = document.getElementById('btnMsgConfirm');
  const btnAdminDeleteStone = document.getElementById('btnAdminDeleteStone');

  let pendingStone = null;

  /* ============ AUTH (entrar / criar conta) ============ */
  const authChip = document.getElementById('authChip');
  const authEmailLabel = document.getElementById('authEmail');
  const btnLogout = document.getElementById('btnLogout');
  const btnLoginOpen = document.getElementById('btnLoginOpen');
  const authModalBack = document.getElementById('authModalBack');
  const authTitle = document.getElementById('authTitle');
  const authSub = document.getElementById('authSub');
  const authEmailInput = document.getElementById('authEmailInput');
  const authPasswordInput = document.getElementById('authPasswordInput');
  const authError = document.getElementById('authError');
  const btnAuthCancel = document.getElementById('btnAuthCancel');
  const btnAuthConfirm = document.getElementById('btnAuthConfirm');
  const authToggleText = document.getElementById('authToggleText');
  const btnAuthToggleMode = document.getElementById('btnAuthToggleMode');
  const btnGoogleLogin = document.getElementById('btnGoogleLogin');

  let authMode = 'signin'; // ou 'signup'
  let pendingAuthAction = null; // função a rodar assim que o login for concluído

  // Se já está logado, roda a ação na hora; senão guarda pra depois e abre o login.
  // Usado tanto por "deixar homenagem" quanto por "plantar flor".
  function requireAuth(action){
    if(auth.getUser()){ action(); return; }
    pendingAuthAction = action;
    openAuthModal();
  }

  function refreshAuthChip(user){
    if(user){
      authChip.classList.add('show');
      authEmailLabel.textContent = user.email;
      btnLoginOpen.style.display = 'none';
    } else {
      authChip.classList.remove('show');
      btnLoginOpen.style.display = '';
    }
  }
  auth.onChange(refreshAuthChip);

  btnLogout.addEventListener('click', async ()=>{
    await auth.signOut();
    showToast('Você saiu da conta.');
  });

  function setAuthMode(mode){
    authMode = mode;
    authError.textContent = '';
    if(mode === 'signup'){
      authTitle.textContent = 'Criar conta';
      authSub.textContent = 'Crie sua conta para deixar homenagens no jardim.';
      btnAuthConfirm.textContent = 'Criar conta';
      authToggleText.textContent = 'Já tem conta?';
      btnAuthToggleMode.textContent = 'Entrar';
    } else {
      authTitle.textContent = 'Entrar';
      authSub.textContent = 'Entre para deixar uma homenagem no jardim.';
      btnAuthConfirm.textContent = 'Entrar';
      authToggleText.textContent = 'Ainda não tem conta?';
      btnAuthToggleMode.textContent = 'Criar conta';
    }
  }
  btnAuthToggleMode.addEventListener('click', ()=> setAuthMode(authMode === 'signin' ? 'signup' : 'signin'));

  function openAuthModal(){
    dogController.resetKeys();
    setAuthMode('signin');
    authEmailInput.value = '';
    authPasswordInput.value = '';
    authModalBack.classList.add('open');
    setTimeout(()=> authEmailInput.focus(), 50);
  }
  function closeAuthModal(){
    authModalBack.classList.remove('open');
    pendingAuthAction = null;
  }
  btnAuthCancel.addEventListener('click', closeAuthModal);
  authModalBack.addEventListener('click', e=>{ if(e.target===authModalBack) closeAuthModal(); });

  btnAuthConfirm.addEventListener('click', async ()=>{
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;
    if(!email || !password){ authError.textContent = 'Preencha e-mail e senha.'; return; }

    btnAuthConfirm.disabled = true;
    authError.textContent = '';
    try{
      if(authMode === 'signup'){
        const data = await auth.signUp(email, password);
        if(!data.session){
          authError.textContent = '';
          showToast('Conta criada! Se pedirmos confirmação por e-mail, confirme e depois entre.');
          setAuthMode('signin');
          return;
        }
      } else {
        await auth.signIn(email, password);
      }
      authModalBack.classList.remove('open');
      chime(660, 0.1);
      if(pendingAuthAction){
        const action = pendingAuthAction;
        pendingAuthAction = null;
        action();
      }
    } catch(err){
      authError.textContent = err.message || 'Não foi possível completar. Tente de novo.';
    } finally {
      btnAuthConfirm.disabled = false;
    }
  });

  btnLoginOpen.addEventListener('click', ()=>{
    pendingAuthAction = null;
    openAuthModal();
  });

  btnGoogleLogin.addEventListener('click', async ()=>{
    btnGoogleLogin.disabled = true;
    authError.textContent = '';
    try{
      await auth.signInWithGoogle();
      // a página vai redirecionar pro Google agora; nada mais a fazer aqui.
    } catch(err){
      authError.textContent = err.message || 'Não foi possível continuar com o Google.';
      btnGoogleLogin.disabled = false;
    }
  });

  /* ============ SOUND (tiny synth, no external files) ============ */
  let audioCtx = null;
  function ensureAudioCtx(){
    if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    // navegadores de desktop suspendem o áudio se o som não parecer vir
    // direto de um clique (comum aqui, já que tocamos depois de um await)
    if(audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function chime(freq, gain){
    try{
      const ctx = ensureAudioCtx();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.value = 0;
      osc.connect(g); g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.linearRampToValueAtTime(gain, now+0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now+0.9);
      osc.start(now);
      osc.stop(now+0.95);
    }catch(e){}
  }

  /* ============ SOM AMBIENTE (vento + pássaros, sintetizado em loop) ============ */
  const btnAmbientToggle = document.getElementById('btnAmbientToggle');
  let ambientMuted = localStorage.getItem('jardimAmbientMuted') === '1';
  let ambientStarted = false;
  let ambientMasterGain = null;

  function startWind(ctx, destination){
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0; i<bufferSize; i++) data[i] = Math.random()*2-1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500;
    filter.Q.value = 0.6;

    const gain = ctx.createGain();
    gain.gain.value = 0.02;

    noise.connect(filter); filter.connect(gain); gain.connect(destination);
    noise.start();

    // vento "respira": o volume sobe e desce devagar, como rajadas
    (function swell(){
      const target = 0.012 + Math.random()*0.022;
      const dur = 3 + Math.random()*4;
      gain.gain.linearRampToValueAtTime(target, ctx.currentTime+dur);
      setTimeout(swell, dur*1000);
    })();
  }

  function startBirds(ctx, destination){
    function chirpOnce(){
      const now = ctx.currentTime;
      const baseFreq = 1800 + Math.random()*1400;
      const notes = 2 + Math.floor(Math.random()*3);
      for(let i=0; i<notes; i++){
        const t = now + i*0.12;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq*(0.9+Math.random()*0.3), t);
        osc.frequency.exponentialRampToValueAtTime(baseFreq*(1.2+Math.random()*0.4), t+0.08);
        g.gain.value = 0;
        osc.connect(g); g.connect(destination);
        g.gain.linearRampToValueAtTime(0.045, t+0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t+0.1);
        osc.start(t);
        osc.stop(t+0.12);
      }
    }
    (function scheduleNext(){
      const delay = 2500 + Math.random()*6000;
      setTimeout(()=>{ chirpOnce(); scheduleNext(); }, delay);
    })();
  }

  function startAmbient(){
    if(ambientStarted) return;
    ambientStarted = true;
    const ctx = ensureAudioCtx();
    ambientMasterGain = ctx.createGain();
    ambientMasterGain.gain.value = ambientMuted ? 0 : 1;
    ambientMasterGain.connect(ctx.destination);
    startWind(ctx, ambientMasterGain);
    startBirds(ctx, ambientMasterGain);
  }

  function refreshAmbientButton(){
    btnAmbientToggle.textContent = ambientMuted ? '🔇 Som ambiente' : '🔊 Som ambiente';
    btnAmbientToggle.setAttribute('aria-pressed', String(!ambientMuted));
  }
  function setAmbientMuted(muted){
    ambientMuted = muted;
    localStorage.setItem('jardimAmbientMuted', muted ? '1' : '0');
    if(ambientMasterGain){
      ambientMasterGain.gain.linearRampToValueAtTime(muted ? 0 : 1, audioCtx.currentTime+0.3);
    }
    refreshAmbientButton();
  }
  btnAmbientToggle.addEventListener('click', ()=> setAmbientMuted(!ambientMuted));
  refreshAmbientButton();

  /* ============ TOAST ============ */
  let toastTimer = null;
  function showToast(text){
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> toastEl.classList.remove('show'), 3200);
  }

  /* ============ MODAL ============ */
  inPhoto.addEventListener('change', ()=>{
    pendingPhotoImg = null; pendingPhotoUrl = null;
    photoPreview.classList.remove('show');
    photoPreview.innerHTML = '';
    const file = inPhoto.files && inPhoto.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        pendingPhotoImg = img;
        pendingPhotoUrl = reader.result;
        photoPreview.innerHTML = `<img src="${reader.result}" alt=""><span>Foto pronta para a lápide</span>`;
        photoPreview.classList.add('show');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  function openModal(){
    dogController.resetKeys();
    modalBack.classList.add('open');
    inName.value=''; inDates.value=''; inMsg.value='';
    inPhoto.value = '';
    pendingPhotoImg = null; pendingPhotoUrl = null;
    photoPreview.classList.remove('show');
    photoPreview.innerHTML = '';
    resetFormatoCorPicker();
    setTimeout(()=>inName.focus(), 50);
  }
  function closeModal(){
    modalBack.classList.remove('open');
    pendingPlot = null;
  }
  function openModalFor(plot){
    requireAuth(()=>{
      pendingPlot = plot;
      openModal();
    });
  }
  btnCancel.addEventListener('click', closeModal);
  modalBack.addEventListener('click', e=>{ if(e.target===modalBack) closeModal(); });

  btnConfirm.addEventListener('click', async ()=>{
    const name = inName.value.trim() || 'Sem nome';
    const dates = inDates.value.trim();
    const msg = inMsg.value.trim() || 'Para sempre lembrado com carinho.';
    const plot = pendingPlot;
    const photoFile = inPhoto.files && inPhoto.files[0] || null;

    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Salvando...';
    try {
      const saved = await lapides.saveMemorial(plot, { name, dates, msg, photoFile, formato: pendingFormato, cor: pendingCor });

      const data = {
        name, dates, msg,
        photo: pendingPhotoImg, photoUrl: pendingPhotoUrl,
        id: saved.id, criadoPor: saved.criadoPor,
        formato: pendingFormato, cor: pendingCor,
      };
      lapides.createTribute(plot, data);

      // gather fireflies briefly
      world.gatherFireflies(plot.x, plot.z);
      chime(660, 0.14);
      showToast(`"${name}" agora descansa no ${plot.section}.`);
      closeModal();
    } catch(err){
      console.error('Erro ao salvar memorial:', err);
      if(err.code === 'VAGA_OCUPADA'){
        showToast('Essa vaga acabou de ser reservada por outra pessoa. Escolha outra vaga vazia.');
        closeModal();
      } else {
        showToast('Não foi possível salvar. Tente novamente.');
      }
    } finally {
      btnConfirm.disabled = false;
      btnConfirm.textContent = 'Gravar na pedra';
    }
  });

  /* ============ HOVER HINTS (dicas na tela) ============ */
  function screenPosFor(worldPos){
    const v = worldPos.clone().project(camera);
    return {
      x: (v.x*0.5+0.5)*window.innerWidth,
      y: (-v.y*0.5+0.5)*window.innerHeight
    };
  }

  function updateHints(hoveredEmptyPlot, hoveredStone){
    if(hoveredEmptyPlot){
      const pos = screenPosFor(new THREE.Vector3(hoveredEmptyPlot.x, 0.4, hoveredEmptyPlot.z));
      hintEmpty.style.left = pos.x+'px';
      hintEmpty.style.top = pos.y+'px';
      hintEmpty.style.display = 'block';
    } else {
      hintEmpty.style.display = 'none';
    }

    if(hoveredStone && hoveredStone.userData && hoveredStone.userData.data){
      const d = hoveredStone.userData.data;
      const pos = screenPosFor(new THREE.Vector3(hoveredStone.position.x, 1.6, hoveredStone.position.z));
      document.getElementById('epName').textContent = d.name;
      document.getElementById('epDates').textContent = d.dates || '';
      document.getElementById('epMsg').textContent = d.msg;
      const epPhoto = document.getElementById('epPhoto');
      if(d.photoUrl){ epPhoto.src = d.photoUrl; epPhoto.style.display = 'block'; }
      else { epPhoto.style.display = 'none'; }
      const plotRef = hoveredStone.userData.plotRef;
      document.getElementById('epSection').textContent = plotRef && plotRef.section ? '🌿 ' + plotRef.section : '';
      epitaphCard.style.left = pos.x+'px';
      epitaphCard.style.top = pos.y+'px';
      epitaphCard.style.display = 'block';
    } else {
      epitaphCard.style.display = 'none';
    }
  }

  /* ============ ADMIN (conta única, apaga qualquer coisa) ============
     A policy que libera o delete de qualquer memorial/mensagem (não só a
     própria) está em supabase/008_admin_apaga_memorial.sql e
     supabase/009_mensagens.sql. */
  const ADMIN_EMAIL = 'gustavolimaborrelli@gmail.com';
  function isAdmin(){
    const user = auth.getUser();
    return !!user && user.email === ADMIN_EMAIL;
  }

  /* ============ MENSAGENS: modal de "ler e deixar mensagens" ============
     Clicar numa lápide sempre abre este modal, pra qualquer um. A conta
     admin ganha um botão extra aqui dentro pra apagar a homenagem inteira
     (antes isso acontecia direto no clique — virou parte do mesmo modal
     pra não competir com a nova interação de mensagens). */
  function formatRelative(isoString){
    const diffMs = Date.now() - new Date(isoString).getTime();
    const min = Math.floor(diffMs/60000);
    if(min < 1) return 'agora';
    if(min < 60) return `há ${min} min`;
    const h = Math.floor(min/60);
    if(h < 24) return `há ${h} h`;
    const d = Math.floor(h/24);
    if(d < 30) return `há ${d} dia${d>1?'s':''}`;
    return new Date(isoString).toLocaleDateString('pt-BR');
  }

  function renderMessages(list){
    messagesList.innerHTML = '';
    if(!list.length){
      messagesList.innerHTML = '<p class="message-empty">Nenhuma mensagem ainda. Seja o primeiro a deixar uma.</p>';
      return;
    }
    list.forEach(m=>{
      const item = document.createElement('div');
      item.className = 'message-item';
      const author = (m.autor_nome || 'Anônimo').replace(/</g,'&lt;');
      const text = m.texto.replace(/</g,'&lt;');
      item.innerHTML = `
        <div class="message-meta">
          <span class="message-author">${author}</span>
          <span class="message-date">${formatRelative(m.criado_em)}</span>
        </div>
        <p class="message-text">${text}</p>
      `;
      if(isAdmin()){
        const del = document.createElement('button');
        del.className = 'message-delete';
        del.textContent = '🗑';
        del.title = 'Apagar mensagem';
        del.addEventListener('click', async ()=>{
          if(!window.confirm('[admin] Apagar essa mensagem?')) return;
          try{
            await lapides.deleteMessage(m.id);
            item.remove();
            if(!messagesList.children.length) renderMessages([]);
          } catch(err){
            showToast('Não foi possível apagar a mensagem.');
          }
        });
        item.appendChild(del);
      }
      messagesList.appendChild(item);
    });
  }

  async function openMessagesFor(stone){
    pendingStone = stone;
    const d = stone.userData.data;
    const plotRef = stone.userData.plotRef;
    msgStoneName.textContent = d.name;
    msgStoneMeta.textContent = [d.dates, plotRef && plotRef.section].filter(Boolean).join(' · ');
    inMsgAuthor.value = '';
    inMsgText.value = '';
    btnAdminDeleteStone.style.display = isAdmin() ? '' : 'none';
    messagesList.innerHTML = '<p class="message-empty">Carregando…</p>';
    messagesModalBack.classList.add('open');
    dogController.resetKeys();
    const list = await lapides.getMessages(d.id);
    if(pendingStone === stone) renderMessages(list);
  }
  function closeMessagesModal(){
    messagesModalBack.classList.remove('open');
    pendingStone = null;
  }
  btnMsgCancel.addEventListener('click', closeMessagesModal);
  messagesModalBack.addEventListener('click', e=>{ if(e.target===messagesModalBack) closeMessagesModal(); });

  btnMsgConfirm.addEventListener('click', ()=>{
    const texto = inMsgText.value.trim();
    if(!texto) return;
    const autorNome = inMsgAuthor.value.trim();
    const stone = pendingStone;
    if(!stone) return;
    requireAuth(async ()=>{
      btnMsgConfirm.disabled = true;
      try{
        await lapides.saveMessage(stone.userData.data.id, { texto, autorNome });
        if(pendingStone === stone){
          const list = await lapides.getMessages(stone.userData.data.id);
          renderMessages(list);
        }
        inMsgAuthor.value = '';
        inMsgText.value = '';
        chime(660, 0.1);
        showToast('Mensagem deixada.');
      } catch(err){
        showToast('Não foi possível salvar a mensagem. Tente de novo.');
      } finally {
        btnMsgConfirm.disabled = false;
      }
    });
  });

  btnAdminDeleteStone.addEventListener('click', async ()=>{
    if(!pendingStone) return;
    const name = pendingStone.userData.data.name;
    if(!window.confirm(`[admin] Apagar a homenagem de "${name}"? Essa ação não pode ser desfeita.`)) return;
    try{
      await lapides.deleteMemorial(pendingStone);
      epitaphCard.style.display = 'none';
      closeMessagesModal();
      showToast('Homenagem apagada.');
    } catch(err){
      showToast('Não foi possível apagar. Tente de novo.');
    }
  });

  /* ============ MAIN MENU / PAUSE ============ */
  function showMenuPanel(panel){
    [menuHome, menuHow, menuAbout, menuDogs].forEach(p=> p.classList.remove('active'));
    panel.classList.add('active');
  }
  function startGame(){
    menuScreen.classList.add('hidden');
    pausedState.value = false;
    startAmbient();
  }
  document.getElementById('btnPlay').addEventListener('click', ()=>{
    if(!dogController.getDog()){ showMenuPanel(menuDogs); return; } // must pick a companion first
    startGame();
  });
  document.getElementById('btnDogs').addEventListener('click', ()=> showMenuPanel(menuDogs));
  document.getElementById('btnHow').addEventListener('click', ()=> showMenuPanel(menuHow));
  document.getElementById('btnAbout').addEventListener('click', ()=> showMenuPanel(menuAbout));
  document.querySelectorAll('[data-back]').forEach(b=> b.addEventListener('click', ()=> showMenuPanel(menuHome)));

  document.querySelectorAll('.dog-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      dogController.selectDog(card.dataset.breed);
      startGame();
    });
  });

  window.addEventListener('keydown', e=>{
    if(e.key === 'Escape'){
      // if a modal is open, ESC closes it instead of opening the pause menu
      if(authModalBack.classList.contains('open')){ closeAuthModal(); return; }
      if(modalBack.classList.contains('open')){ closeModal(); return; }
      if(messagesModalBack.classList.contains('open')){ closeMessagesModal(); return; }
      if(mapModalBack.classList.contains('open')){ mapaUi.closeMap(); return; }
      if(pausedState.value){
        if(!dogController.getDog()){ showMenuPanel(menuDogs); return; } // can't enter without a companion
        startGame();
      } else {
        showMenuPanel(menuHome);
        menuScreen.classList.remove('hidden');
        pausedState.value = true;
      }
      return;
    }
    if(e.key.toLowerCase() === 'v'){
      const tag = e.target && e.target.tagName;
      if(tag === 'INPUT' || tag === 'TEXTAREA') return; // não intercepta enquanto digita
      if(pausedState.value || !dogController.getDog()) return;
      toggleView();
    }
    if(e.key.toLowerCase() === 'm'){
      const tag = e.target && e.target.tagName;
      if(tag === 'INPUT' || tag === 'TEXTAREA') return; // não intercepta enquanto digita
      if(pausedState.value || !dogController.getDog()) return;
      mapaUi.openMap();
    }
  });

  const btnMapToggle = document.getElementById('btnMapToggle');
  btnMapToggle.addEventListener('click', ()=>{
    if(pausedState.value || !dogController.getDog()) return;
    mapaUi.openMap();
  });

  const btnViewToggle = document.getElementById('btnViewToggle');
  function toggleView(){
    const on = dogController.toggleFirstPerson();
    btnViewToggle.classList.toggle('active', on);
    btnViewToggle.textContent = on ? '👁️' : '🐾';
  }
  btnViewToggle.addEventListener('click', ()=>{
    if(pausedState.value || !dogController.getDog()) return;
    toggleView();
  });

  /* ============ FLOR OU VELA (o que o clique no gramado planta) ============ */
  const btnPlantToggle = document.getElementById('btnPlantToggle');
  let plantMode = 'flor';
  function getPlantMode(){ return plantMode; }
  btnPlantToggle.addEventListener('click', ()=>{
    plantMode = plantMode === 'flor' ? 'vela' : 'flor';
    btnPlantToggle.classList.toggle('vela', plantMode === 'vela');
    btnPlantToggle.textContent = plantMode === 'flor' ? '🌼' : '🕯️';
    btnPlantToggle.title = plantMode === 'flor' ? 'Plantando flor — clique pra trocar pra vela' : 'Acendendo vela — clique pra trocar pra flor';
  });

  return {
    updateHints,
    chime,
    openModalFor,
    requireAuth,
    openMessagesFor,
    getPlantMode,
  };
}
