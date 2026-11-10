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
import * as THREE from 'three';
import { homenagemDoLink, slugPedido, htmlCartao, linkDaHomenagem, voltouDoLogin } from './chegada.js';
import { GATOS } from './gfx/gatos.js';
import { gerarCartao } from './cartao.js';

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
  const btnShareStone = document.getElementById('btnShareStone');

  let pendingStone = null;

  /* ============ AUTH (entrar / criar conta) ============ */
  // Login com e-mail e senha desligado até o jardim ter um e-mail de verdade
  // (domínio próprio ou um Gmail do jardim no SMTP do Supabase): sem ele não há
  // como recuperar a senha nem confirmar o e-mail de quem cria a conta. Decisão do
  // Gustavo em 2026-11-09: por enquanto só Google. Para religar: true aqui, ligar a
  // confirmação de e-mail no Supabase e trazer o "Esqueci minha senha" da app-ios.
  const LOGIN_COM_EMAIL = false;
  if(!LOGIN_COM_EMAIL) document.querySelectorAll('#authModalBack .login-email').forEach(el=> el.classList.add('desligado'));
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
  // o que pediu login, para retomar na volta do Google: { tipo: 'homenagem' | 'vela', plot }
  let vagaParaLogin = null;
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
      btnAuthToggleMode.textContent = 'Fazer login';
    } else {
      // "Fazer login", e não "Entrar": o menu já tem o "Entrar no jardim"
      authTitle.textContent = 'Fazer login';
      authSub.textContent = LOGIN_COM_EMAIL ? 'Entre para deixar uma homenagem no jardim.' : 'Entre com sua conta Google para deixar uma homenagem no jardim.';
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
    if(LOGIN_COM_EMAIL) setTimeout(()=> authEmailInput.focus(), 50);
  }
  function closeAuthModal(){
    authModalBack.classList.remove('open');
    pendingAuthAction = null;
    vagaParaLogin = null;
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
    vagaParaLogin = null;
    openAuthModal();
  });

  btnGoogleLogin.addEventListener('click', async ()=>{
    btnGoogleLogin.disabled = true;
    authError.textContent = '';
    try{
      guardarVagaPendente();
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

  // o mesmo formulário cria e edita; `editando` é a vaga da homenagem sendo editada
  let editando = null;
  const tituloForm = modalBack.querySelector('h2'), subForm = modalBack.querySelector('.sub');
  function openModal(){
    editando = null;
    tituloForm.textContent = 'Uma homenagem';
    subForm.textContent = 'Essas palavras ficarão gravadas na pedra escolhida.';
    btnConfirm.textContent = 'Gravar na pedra';
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
    editando = null;
  }

  /* ============ EDITAR A PRÓPRIA HOMENAGEM (etapa 36) ============
     Só quem criou vê o "Editar" (no livro de mensagens e na ficha do mapa); o banco
     confere de novo (003). Abre o formulário de sempre já preenchido. */
  const podeEditar = (plot) => {
    const user = auth.getUser();
    return !!(user && plot && plot.data && plot.data.criadoPor && plot.data.criadoPor === user.id);
  };
  function abrirEdicao(plot){
    if(!podeEditar(plot)) return;
    openModal();
    editando = plot;
    const d = plot.data;
    tituloForm.textContent = 'Editar homenagem';
    subForm.textContent = 'O link da homenagem continua o mesmo.';
    btnConfirm.textContent = 'Salvar alterações';
    inName.value = d.name || '';
    inDates.value = d.dates || '';
    inMsg.value = d.msg || '';
    pendingFormato = lapides.FORMATOS.some(f => f.id === d.formato) ? d.formato : lapides.FORMATOS[0].id;
    pendingCor = d.cor || lapides.PALETTE[0].hex;
    formatoPicker.querySelectorAll('.formato-opt').forEach(el=> el.classList.toggle('active', el.dataset.id===pendingFormato));
    corPicker.querySelectorAll('.cor-opt').forEach(el=> {
      const c = lapides.PALETTE.find(p => p.id === el.dataset.id);
      el.classList.toggle('active', !!c && c.hex.toLowerCase() === String(pendingCor).toLowerCase());
    });
    if(d.photoUrl){
      photoPreview.innerHTML = `<img src="${d.photoUrl.replace(/"/g, '&quot;')}" alt=""><span>Foto atual. Escolha outra para trocar.</span>`;
      photoPreview.classList.add('show');
    }
  }
  async function salvarEdicao(){
    const plot = editando;
    const d = plot.data;
    const name = inName.value.trim() || 'Sem nome';
    const dates = inDates.value.trim();
    const msg = inMsg.value.trim() || 'Para sempre lembrado com carinho.';
    const photoFile = inPhoto.files && inPhoto.files[0] || null;
    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Salvando...';
    try {
      const foto = pendingPhotoImg || d.photo || null;
      const mudouCartao = photoFile || name !== d.name || dates !== (d.dates || '');
      const cartao = mudouCartao ? await gerarCartao({ nome: name, datas: dates, foto }).catch(() => null) : null;
      const row = await lapides.updateMemorial(plot, { name, dates, msg, photoFile, formato: pendingFormato, cor: pendingCor, cartao });
      lapides.trocarPedra(plot, { ...d, ...{ name: row.nome_pet, dates: row.datas, msg: row.mensagem, photoUrl: row.foto_url, formato: row.formato, cor: row.cor }, photo: foto });
      chime(660, 0.1);
      showToast(`A homenagem de "${name}" foi atualizada.`);
      closeModal();
      mapaUi.atualizar();
    } catch(err){
      console.error('Erro ao editar memorial:', err);
      showToast('Não foi possível salvar as alterações. Tente novamente.');
    } finally {
      btnConfirm.disabled = false;
      btnConfirm.textContent = editando ? 'Salvar alterações' : 'Gravar na pedra';
    }
  }
  function openModalFor(plot){
    if(!auth.getUser()) vagaParaLogin = { tipo: 'homenagem', plot };
    requireAuth(()=>{
      pendingPlot = plot;
      openModal();
    });
  }
  btnCancel.addEventListener('click', closeModal);
  modalBack.addEventListener('click', e=>{ if(e.target===modalBack) closeModal(); });

  btnConfirm.addEventListener('click', async ()=>{
    if(editando) return salvarEdicao();
    const name = inName.value.trim() || 'Sem nome';
    const dates = inDates.value.trim();
    const msg = inMsg.value.trim() || 'Para sempre lembrado com carinho.';
    const plot = pendingPlot;
    const photoFile = inPhoto.files && inPhoto.files[0] || null;

    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Salvando...';
    try {
      const cartao = await gerarCartao({ nome: name, datas: dates, foto: pendingPhotoImg });
      const saved = await lapides.saveMemorial(plot, { name, dates, msg, photoFile, formato: pendingFormato, cor: pendingCor, cartao });

      const data = {
        name, dates, msg,
        photo: pendingPhotoImg, photoUrl: pendingPhotoUrl,
        id: saved.id, criadoPor: saved.criadoPor, slug: saved.slug,
        formato: pendingFormato, cor: pendingCor,
      };
      lapides.createTribute(plot, data);
      mapaUi.atualizar(); // criada pelo mapa: o medalhão novo aparece nele

      // gather fireflies briefly
      world.gatherFireflies(plot.x, plot.z);
      chime(660, 0.14);
      showToast(`"${name}" agora descansa no ${plot.section}.`);
      closeModal();
      // o link é o que leva a homenagem para a família: oferece na hora
      if(saved.slug) abrirCompartilhar({ nome: name, slug: saved.slug, titulo: 'Homenagem gravada' });
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

  let livroVoltaAoMapa = false;
  function atualizarVelasDoLivro(){
    const linha = document.getElementById('msgVelasTexto');
    if(!pendingStone || !linha) return;
    const n = world.velasAcesas(pendingStone.userData.data.id);
    linha.textContent = n === 0 ? 'Nenhuma vela acesa' : n === 1 ? '🕯️ 1 vela acesa' : `🕯️ ${n} velas acesas`;
  }
  document.getElementById('btnMsgVela').addEventListener('click', (e)=>{
    if(!pendingStone) return;
    pedirVela(pendingStone.userData.plotRef, e.currentTarget);
  });
  async function openMessagesFor(stone, { voltarAoMapa = false } = {}){
    livroVoltaAoMapa = voltarAoMapa;
    pendingStone = stone;
    const botaoVela = document.getElementById('btnMsgVela');
    botaoVela.disabled = false; botaoVela.textContent = 'Acender uma vela';
    const d = stone.userData.data;
    const plotRef = stone.userData.plotRef;
    msgStoneName.textContent = d.name;
    msgStoneMeta.textContent = [d.dates, plotRef && plotRef.section].filter(Boolean).join(' · ');
    inMsgAuthor.value = '';
    inMsgText.value = '';
    btnAdminDeleteStone.style.display = isAdmin() ? '' : 'none';
    btnShareStone.style.display = d.slug ? '' : 'none';
    document.getElementById('btnEditStone').style.display = podeEditar(stone.userData.plotRef) ? '' : 'none';
    messagesList.innerHTML = '<p class="message-empty">Carregando…</p>';
    atualizarVelasDoLivro();
    messagesModalBack.classList.add('open');
    dogController.resetKeys();
    const list = await lapides.getMessages(d.id);
    if(pendingStone === stone) renderMessages(list);
  }
  function closeMessagesModal(){
    messagesModalBack.classList.remove('open');
    const plot = pendingStone && pendingStone.userData.plotRef;
    pendingStone = null;
    // aberto pela ficha do mapa: fechar volta para o mapa, na mesma ficha
    if(livroVoltaAoMapa && plot){ livroVoltaAoMapa = false; mapaUi.abrirFichaDe(plot); }
  }
  btnMsgCancel.addEventListener('click', closeMessagesModal);
  document.getElementById('btnEditStone').addEventListener('click', ()=>{
    const plot = pendingStone && pendingStone.userData.plotRef;
    closeMessagesModal();
    if(plot) abrirEdicao(plot);
  });
  btnShareStone.addEventListener('click', ()=>{
    if(!pendingStone) return;
    const d = pendingStone.userData.data;
    abrirCompartilhar({ nome: d.name, slug: d.slug });
  });

  /* ============ COMPARTILHAR (o link de cada homenagem) ============
     No celular, "Enviar pelo WhatsApp" abre o app direto na escolha do contato;
     no computador, o WhatsApp Web. O link vai no fim da mensagem: é dele que o
     WhatsApp monta a prévia (api/homenagem.js). */
  const shareModalBack = document.getElementById('shareModalBack');
  const shareTitle = document.getElementById('shareTitle');
  const shareSub = document.getElementById('shareSub');
  const shareLinkInput = document.getElementById('shareLinkInput');
  const btnShareWhats = document.getElementById('btnShareWhats');
  const btnShareMore = document.getElementById('btnShareMore');
  const btnShareCopy = document.getElementById('btnShareCopy');
  let compartilhando = null;
  function abrirCompartilhar({ nome, slug, titulo }){
    const url = linkDaHomenagem(slug);
    compartilhando = { nome, url };
    shareTitle.textContent = titulo || 'Compartilhar a homenagem';
    shareSub.textContent = `Mande este link para a família e os amigos: quem abrir chega direto na pedra de ${nome}.`;
    shareLinkInput.value = url;
    btnShareWhats.href = `https://wa.me/?text=${encodeURIComponent(`Uma homenagem para ${nome} no Jardim Memorial 🐾 ${url}`)}`;
    btnShareMore.style.display = navigator.share ? '' : 'none';
    dogController.resetKeys();
    shareModalBack.classList.add('open');
  }
  function fecharCompartilhar(){ shareModalBack.classList.remove('open'); compartilhando = null; }
  document.getElementById('btnShareClose').addEventListener('click', fecharCompartilhar);
  shareModalBack.addEventListener('click', e=>{ if(e.target===shareModalBack) fecharCompartilhar(); });
  btnShareCopy.addEventListener('click', async ()=>{
    try{
      await navigator.clipboard.writeText(shareLinkInput.value);
      showToast('Link copiado.');
    } catch(err){
      shareLinkInput.select();
      showToast('Selecione o link e copie.');
    }
  });
  btnShareMore.addEventListener('click', ()=>{
    if(!compartilhando || !navigator.share) return;
    const { nome, url } = compartilhando;
    navigator.share({ title: `${nome} · Jardim Memorial`, text: `Uma homenagem para ${nome} no Jardim Memorial`, url }).catch(()=>{});
  });
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
  const menuChegada = document.getElementById('menuChegada');
  function showMenuPanel(panel){
    [menuHome, menuHow, menuAbout, menuDogs, menuChegada].forEach(p=> p.classList.remove('active'));
    panel.classList.add('active');
  }
  function startGame(){
    dogController.alinharCamera();
    mapaUi.closeMap(); // a primeira tela é o mapa: passear o fecha
    document.body.classList.add('passeando');
    menuScreen.classList.add('hidden');
    pausedState.value = false;
    startAmbient();
    mostrarDicasToque();
  }

  /* ============ DICAS DA PRIMEIRA ENTRADA PELO TOQUE ============
     No celular os botões redondos são só ícones (☰ 🗺️ 🌼 🐾). Na primeira vez que
     a pessoa entra no jardim por toque, cada um ganha um nome por alguns segundos.
     As dicas somem no primeiro toque depois de um instante (o toque segue valendo
     para o jogo) ou sozinhas, e não voltam mais neste aparelho. */
  const DICAS_VISTAS = 'jardimDicasToque';
  const dicasToque = document.getElementById('dicasToque');
  let dicasNaTela = false;
  function mostrarDicasToque(){
    if(dicasNaTela || !window.matchMedia('(pointer:coarse)').matches) return;
    try { if(localStorage.getItem(DICAS_VISTAS)) return; } catch(e){}
    dicasNaTela = true;
    dicasToque.classList.add('visivel');
    let sozinhas = null;
    const esconder = ()=>{
      clearTimeout(sozinhas);
      window.removeEventListener('pointerdown', esconder, true);
      dicasToque.classList.remove('visivel');
      try { localStorage.setItem(DICAS_VISTAS, '1'); } catch(e){}
    };
    sozinhas = setTimeout(esconder, 9000);
    // o toque que acabou de entrar no jardim (ou um logo depois) não apaga as
    // dicas antes de dar tempo de ler
    setTimeout(()=>{ if(dicasToque.classList.contains('visivel')) window.addEventListener('pointerdown', esconder, true); }, 1500);
  }
  document.getElementById('btnPlay').addEventListener('click', ()=>{
    if(!dogController.getDog()){ showMenuPanel(menuDogs); return; } // must pick a companion first
    startGame();
  });
  document.getElementById('btnDogs').addEventListener('click', ()=> showMenuPanel(menuDogs));
  document.getElementById('btnHow').addEventListener('click', ()=> showMenuPanel(menuHow));
  document.getElementById('btnAbout').addEventListener('click', ()=> showMenuPanel(menuAbout));
  document.querySelectorAll('[data-back]').forEach(b=> b.addEventListener('click', ()=> showMenuPanel(menuHome)));

  // a raça escolhida fica guardada: quem volta pelo link de uma homenagem
  // passeia com o mesmo companheiro
  const RACA_GUARDADA = 'jardimRaca';
  const racaGuardada = () => { try { return localStorage.getItem(RACA_GUARDADA); } catch(e){ return null; } };
  document.querySelectorAll('.dog-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      dogController.selectDog(card.dataset.breed);
      try { localStorage.setItem(RACA_GUARDADA, card.dataset.breed); } catch(e){}
      startGame();
    });
  });

  /* ============ CHEGADA PELO LINK DE UMA HOMENAGEM ============
     Em vez do menu de sempre, o cartão da homenagem e "Visitar". O cachorro
     começa na beira da praça, do lado do jardim dela, e caminha sozinho pela
     avenida, passa pelo arco e para de frente para a pedra; aí abre o livro de
     mensagens. Nada de teletransporte (etapa 18): o caminho é o de verdade. */
  homenagemDoLink.then(h=>{
    if(!slugPedido) return;
    if(!h){
      history.replaceState(null, '', '/');
      showToast('Não encontramos essa homenagem. O jardim está aberto para um passeio.');
      return;
    }
    document.getElementById('chegadaCartao').innerHTML = htmlCartao(h);
    const btnVisitar = document.getElementById('btnVisitar');
    btnVisitar.dataset.pronto = '1';
    btnVisitar.disabled = false;
    btnVisitar.textContent = `Visitar ${h.nome_pet}`;
    btnVisitar.onclick = ()=> visitar(h);
    if(pausedState.value) showMenuPanel(menuChegada);
  });
  document.getElementById('btnVerJardim').addEventListener('click', ()=> irParaCasa());

  /* ============ O MAPA COMO PRIMEIRA TELA (etapa 35) ============
     O site abre no mapa de tesouro (main.js o desenha antes do 3D). "Passear no
     jardim" entra com o companheiro de sempre, ou pede para escolher um; "Menu" abre
     o cartão de sempre (escolher companheiro, como jogar, sobre, som) por cima do
     mapa. O ☰ e o ESC do passeio voltam para cá. */
  function irParaCasa(){
    pausedState.value = true;
    dogController.resetKeys();
    if(world.prototipo){
      // protótipo do Lago: o mapa ainda é o do Jardim Memorial, então a casa é o menu
      document.body.classList.remove('passeando');
      showMenuPanel(menuHome);
      menuScreen.classList.remove('hidden');
      return;
    }
    menuScreen.classList.add('hidden');
    mapaUi.openInicio();
  }
  function passear(){
    if(!dogController.getDog()){
      const raca = racaGuardada();
      if(raca && document.querySelector(`.dog-card[data-breed="${raca}"]`)) dogController.selectDog(raca);
      else { showMenuPanel(menuDogs); menuScreen.classList.remove('hidden'); return; }
    }
    startGame();
  }
  const btnPassear = document.getElementById('btnPassear');
  const btnMapaMenu = document.getElementById('btnMapaMenu');
  btnPassear.addEventListener('click', passear);
  btnMapaMenu.addEventListener('click', ()=>{ showMenuPanel(menuHome); menuScreen.classList.remove('hidden'); });
  document.getElementById('btnMenuMapa').addEventListener('click', ()=> irParaCasa());
  // os dois botões da primeira tela funcionam quando o jogo está pronto (agora)
  btnPassear.disabled = false; btnPassear.textContent = 'Passear no jardim';
  btnMapaMenu.disabled = false;
  // sem resposta rápida do banco, main.js não abriu o mapa: abre agora
  if(!slugPedido && !mapaUi.isOpen() && menuScreen.classList.contains('hidden')) irParaCasa();

  /* Na frente da pedra o cachorro olha para ela, e a câmera ficaria atrás dele. Na
     fileira de fora, "atrás" é a cerca e as árvores grandes de sombra: a câmera
     parava dentro de uma copa; na de dentro, um cipreste da avenida tapava a vista.
     Testa atrás e alguns ângulos de lado, olhando o ponto da câmera e a linha até
     o cachorro, e fica com o de mais folga, preferindo o mais perto de "atrás". */
  function cameraDaChegada(x, z, yawFinal){
    const base = yawFinal + Math.PI;
    const distancia = dogController.distanciaChegada()*Math.cos(0.42);
    let melhor = base, nota = -Infinity;
    for(const desvio of [0, 0.4, -0.4, 0.8, -0.8, 1.15, -1.15]){
      const az = base + desvio;
      const cx = x + Math.sin(az)*distancia, cz = z + Math.cos(az)*distancia;
      let folga = 26 - Math.max(Math.abs(cx), Math.abs(cz)); // cerca e arbustos
      for(const t of [1, 0.75, 0.5, 0.3]){
        const px = x + (cx - x)*t, pz = z + (cz - z)*t;
        for(const c of world.copas) folga = Math.min(folga, Math.hypot(px - c.x, pz - c.z) - c.r);
      }
      const n = Math.min(folga, 1.2) - Math.abs(desvio)*0.25;
      if(n > nota){ nota = n; melhor = az; }
    }
    return melhor;
  }

  function visitar(h){
    // estátua de raça: a visita é com um cachorro da mesma raça
    const estatua = lapides.FORMATOS.find(f => f.id === h.formato && f.raca);
    // estátua de gato (um tipo só): a visita é com o gato que a pessoa escolheu, se for gato
    const gatoGuardado = GATOS.includes(racaGuardada()) ? racaGuardada() : null;
    const racaDaEstatua = estatua && (estatua.especie === 'gato' ? (gatoGuardado || estatua.raca) : estatua.raca);
    const raca = racaDaEstatua || racaGuardada() || dogController.getBreed() || 'golden';
    if(dogController.getBreed() !== raca) dogController.selectDog(raca);
    const alvo = { x: Number(h.plot_x), z: Number(h.plot_z) };
    const sx = Math.sign(alvo.x) || 1, sz = Math.sign(alvo.z) || 1;
    dogController.posicionar(0, sz*3.4, sz > 0 ? 0 : Math.PI);
    startGame();
    // as pedras olham para +z: para na frente dela. O corredor do meio do jardim
    // (|x| = 12, entre as duas colunas de vagas) leva até lá sem passar por cima de outra.
    const frente = alvo.z + 2.3;
    dogController.caminharPor([[sx*1.2, sz*12], [sx*12, sz*12], [sx*12, frente], [alvo.x, frente]], {
      olharPara: alvo,
      // a câmera mira o meio entre o cachorro e a pedra
      camera: cameraDaChegada(alvo.x, (frente + alvo.z)/2, Math.PI),
      aoChegar: async ()=>{
        await lapides.carregadas;
        const pedra = lapides.acharLapide(h.id);
        if(pedra && !pausedState.value) openMessagesFor(pedra);
      },
    });
  }

  /* ============ BOTÕES DA FICHA DO MAPA DE TESOURO (js/mapa.js) ============
     "Visitar no jardim": o cachorro sai de onde está, sem teletransporte (etapa 18).
     De outro campo, vai até a avenida mais perto, contorna a praça e entra pela
     avenida norte-sul do campo; dali, o corredor do meio (|x| = 12) leva à frente
     da pedra sem passar por cima de outra, como na chegada pelo link. */
  function visitarDoMapa(plot){
    if(!plot.data) return;
    // da primeira tela, ainda sem companheiro: entra com o de sempre (ou um golden)
    if(!dogController.getDog()){
      const raca = racaGuardada();
      dogController.selectDog(raca && document.querySelector(`.dog-card[data-breed="${raca}"]`) ? raca : 'golden');
    }
    if(pausedState.value) startGame();
    const dog = dogController.getDog();
    const alvo = { x: plot.x, z: plot.z };
    const sx = Math.sign(alvo.x) || 1, sz = Math.sign(alvo.z) || 1;
    const frente = alvo.z + 2.3;
    const { x, z } = dog.position;
    const dentroDeUmCampo = Math.abs(x) > 2.5 && Math.abs(z) > 2.5;
    const mesmoCampo = dentroDeUmCampo && Math.sign(x) === sx && Math.sign(z) === sz;
    const pontos = [];
    if(!mesmoCampo){
      let aqui = [x, z];
      if(dentroDeUmCampo){
        aqui = Math.abs(x) < Math.abs(z) ? [Math.sign(x)*1.2, z] : [x, Math.sign(z)*1.2];
        pontos.push(aqui);
      }
      // do outro lado da praça: contorna a fonte pela beira, em vez de empurrar nela
      if(Math.sign(aqui[1]) !== sz || Math.abs(aqui[1]) < 2.5) pontos.push([sx*3.3, sz*3.3]);
      pontos.push([sx*1.2, sz*12]);
    }
    pontos.push([sx*12, mesmoCampo ? z : sz*12], [sx*12, frente], [alvo.x, frente]);
    dogController.caminharPor(pontos, {
      olharPara: alvo,
      camera: cameraDaChegada(alvo.x, (frente + alvo.z)/2, Math.PI),
      aoChegar: ()=>{
        const pedra = lapides.acharLapide(plot.data.id);
        if(pedra && !pausedState.value) openMessagesFor(pedra);
      },
    });
  }
  /* ============ VAGA GUARDADA NO LOGIN COM GOOGLE ============
     O login com Google sai do site e volta recarregando a página: o que a pessoa
     estava fazendo se perdia, e ela caía no menu e tinha de achar a vaga de novo.
     Antes de sair, a vaga escolhida (e o companheiro) fica guardada no navegador;
     na volta, já logada, ela entra no jardim na frente da vaga, com o formulário
     aberto. Se a vaga foi ocupada nesse meio-tempo, abre o mapa para escolher
     outra. Quem desistiu do Google (ou abriu o site de outro jeito) não é levado
     a lugar nenhum: a vaga guardada é esquecida. */
  const VAGA_PENDENTE = 'jardimVagaPendente';
  function guardarVagaPendente(){
    if(!vagaParaLogin) return;
    try {
      localStorage.setItem(VAGA_PENDENTE, JSON.stringify({
        tipo: vagaParaLogin.tipo, x: vagaParaLogin.plot.x, z: vagaParaLogin.plot.z,
        raca: dogController.getBreed() || racaGuardada(), quando: Date.now(),
      }));
    } catch(e){}
  }
  function lerVagaPendente(){
    try { return JSON.parse(localStorage.getItem(VAGA_PENDENTE) || 'null'); } catch(e){ return null; }
  }
  function esquecerVagaPendente(){ try { localStorage.removeItem(VAGA_PENDENTE); } catch(e){} }

  async function retomarVagaPendente(p){
    esquecerVagaPendente();
    if(!p || Date.now() - p.quando > 20*60*1000) return;
    await lapides.carregadas;
    const plot = lapides.plots.find(pl => Number(pl.x) === Number(p.x) && Number(pl.z) === Number(p.z));
    if(!plot) return;
    const raca = p.raca || racaGuardada() || 'golden';
    if(dogController.getBreed() !== raca) dogController.selectDog(raca);
    if(p.tipo === 'vela'){
      // pediu para acender uma vela: acende e mostra a ficha com a contagem nova
      if(!plot.occupied || !plot.data) return;
      startGame();
      await world.velasCarregadas;
      mapaUi.abrirFichaDe(plot);
      acenderVela(plot);
      return;
    }
    if(plot.occupied){
      startGame();
      showToast('Essa vaga foi ocupada enquanto você entrava. Escolha outra no mapa.');
      mapaUi.openMap();
      return;
    }
    // na frente da vaga e virado para ela (as pedras olham para +z)
    dogController.posicionar(plot.x, plot.z + 2.3, Math.PI);
    startGame();
    openModalFor(plot);
  }
  // (no protótipo do Lago a vaga guardada é do Jardim Memorial: fica para lá)
  if(!world.prototipo){
    const pendente = lerVagaPendente();
    if(pendente && !voltouDoLogin) esquecerVagaPendente();
    else if(pendente){
      let feito = false;
      const retomar = (user)=>{ if(user && !feito){ feito = true; retomarVagaPendente(pendente); } };
      auth.onChange(retomar);
      retomar(auth.getUser());
      // voltou do Google sem login (desistiu ou deu erro): esquece a vaga
      setTimeout(()=>{ if(!feito) esquecerVagaPendente(); }, 12000);
    }
  }

  /* ============ VELA NUMA HOMENAGEM ============
     Pela ficha do mapa ou pelo livro de mensagens: a vela nasce na frente da pedra
     no jardim 3D e conta nas "velas acesas" da homenagem (etapa 34). Pede login,
     como a vela no chão; se o login for pelo Google, a vela é acesa na volta. */
  async function acenderVela(plot){
    if(!plot || !plot.data) return false;
    const ok = await world.acenderVelaNaHomenagem(plot.data.id, plot);
    if(ok){
      chime(440, 0.06);
      showToast(`Sua vela ficou acesa ao lado de ${plot.data.name}.`);
    } else {
      showToast('Não foi possível acender a vela. Tente de novo.');
    }
    mapaUi.velaAcesa(plot);
    atualizarVelasDoLivro();
    return ok;
  }
  function pedirVela(plot, botao){
    if(!auth.getUser()) vagaParaLogin = { tipo: 'vela', plot };
    requireAuth(async ()=>{
      vagaParaLogin = null;
      if(botao){ botao.disabled = true; botao.textContent = 'Acendendo…'; }
      const ok = await acenderVela(plot);
      if(botao && botao.isConnected){ botao.textContent = ok ? 'Vela acesa' : 'Acender uma vela'; botao.disabled = ok; }
    });
  }

  mapaUi.ligarAcoes({
    visitar: visitarDoMapa,
    vela: pedirVela,
    mensagens: (plot)=>{
      const pedra = plot.data && lapides.acharLapide(plot.data.id);
      if(pedra) openMessagesFor(pedra, { voltarAoMapa: true });
    },
    criar: (plot)=> openModalFor(plot),
    editar: (plot)=> abrirEdicao(plot),
    podeEditar,
  });

  // no celular não existe ESC: é o botão ☰ que pausa e volta para o menu
  document.getElementById('btnMenuToggle').addEventListener('click', ()=>{
    if(pausedState.value) return;
    irParaCasa();
  });

  window.addEventListener('keydown', e=>{
    if(e.key === 'Escape'){
      // if a modal is open, ESC closes it instead of opening the pause menu
      if(authModalBack.classList.contains('open')){ closeAuthModal(); return; }
      if(shareModalBack.classList.contains('open')){ fecharCompartilhar(); return; }
      if(modalBack.classList.contains('open')){ closeModal(); return; }
      if(messagesModalBack.classList.contains('open')){ closeMessagesModal(); return; }
      // o cartão do menu aberto por cima do mapa da primeira tela: volta ao mapa
      if(!menuScreen.classList.contains('hidden') && mapaUi.isInicio()){ menuScreen.classList.add('hidden'); return; }
      if(mapModalBack.classList.contains('open')){ mapaUi.fecharUmPasso(); return; }
      // passeando: ESC volta para o mapa da primeira tela
      if(!pausedState.value) irParaCasa();
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
      if(pausedState.value || !dogController.getDog() || world.prototipo) return;
      mapaUi.openMap();
    }
  });

  const btnMapToggle = document.getElementById('btnMapToggle');
  btnMapToggle.addEventListener('click', ()=>{
    if(pausedState.value || !dogController.getDog() || world.prototipo) return;
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
    avisar: showToast,
    openModalFor,
    requireAuth,
    openMessagesFor,
    getPlantMode,
  };
}
