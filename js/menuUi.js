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

export function createMenuUi({ camera, lapides, world, dogController, pausedState, auth }) {

  const menuScreen = document.getElementById('menuScreen');
  const menuHome = document.getElementById('menuHome');
  const menuHow = document.getElementById('menuHow');
  const menuAbout = document.getElementById('menuAbout');
  const menuDogs = document.getElementById('menuDogs');

  const toastEl = document.getElementById('toast');
  const hintEmpty = document.getElementById('hintEmpty');
  const epitaphCard = document.getElementById('epitaphCard');

  const modalBack = document.getElementById('modalBack');
  const btnCancel = document.getElementById('btnCancel');
  const btnConfirm = document.getElementById('btnConfirm');
  const inName = document.getElementById('inName');
  const inDates = document.getElementById('inDates');
  const inMsg = document.getElementById('inMsg');
  const inPhoto = document.getElementById('inPhoto');
  const photoPreview = document.getElementById('photoPreview');

  let pendingPlot = null;
  let pendingPhotoImg = null;
  let pendingPhotoUrl = null;

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
  function chime(freq, gain){
    try{
      if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
      // navegadores de desktop suspendem o áudio se o som não parecer vir
      // direto de um clique (comum aqui, já que tocamos depois de um await)
      if(audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.value = 0;
      osc.connect(g); g.connect(audioCtx.destination);
      const now = audioCtx.currentTime;
      g.gain.linearRampToValueAtTime(gain, now+0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now+0.9);
      osc.start(now);
      osc.stop(now+0.95);
    }catch(e){}
  }

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
      await lapides.saveMemorial(plot, { name, dates, msg, photoFile });

      const data = {name, dates, msg, photo: pendingPhotoImg, photoUrl: pendingPhotoUrl};
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

  /* ============ MAIN MENU / PAUSE ============ */
  function showMenuPanel(panel){
    [menuHome, menuHow, menuAbout, menuDogs].forEach(p=> p.classList.remove('active'));
    panel.classList.add('active');
  }
  function startGame(){
    menuScreen.classList.add('hidden');
    pausedState.value = false;
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
      if(pausedState.value){
        if(!dogController.getDog()){ showMenuPanel(menuDogs); return; } // can't enter without a companion
        startGame();
      } else {
        showMenuPanel(menuHome);
        menuScreen.classList.remove('hidden');
        pausedState.value = true;
      }
    }
  });

  return {
    updateHints,
    chime,
    openModalFor,
    requireAuth,
  };
}
