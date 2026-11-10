"use strict";

/*
  PRESENÇA
  Mostra os cachorros de outras pessoas que estão com o jardim aberto ao
  mesmo tempo, andando ao vivo. Não grava nada em tabela — é troca de
  mensagens efêmera via um canal Realtime do Supabase (Presence, pra saber
  quem está conectado agora, + Broadcast, pra posição em alta frequência),
  igual o Realtime que js/lapides.js já usa pra lápides novas, só que sem
  passar por Postgres.

  createPresence(deps) devolve update(dt, elapsed) pra main.js chamar a
  cada frame, junto dos outros updates do jogo.
*/

import { supabase } from './supabaseClient.js';
import { buildDog } from './cachorros.js';
import { animarCao } from './gfx/caes.js';

/* canal: cada jardim tem o seu (etapa 38); o do Memorial guarda o nome de sempre,
   para quem ainda está com a versão antiga aberta continuar se vendo.
   chao(x, z): a altura onde o companheiro de outra pessoa pisa (jardim com relevo) */
export function createPresence({ scene, dogController, pausedState, canal = 'jardim-presenca', chao = null }) {
  const myId = Math.random().toString(36).slice(2);
  const peers = new Map(); // id -> { group, parts, target:{x,z,yaw}, lastSeen }
  let subscribed = false;

  const channel = supabase.channel(canal, {
    config: { presence: { key: myId } },
  });

  function removePeer(id){
    const p = peers.get(id);
    if(!p) return;
    scene.remove(p.group);
    peers.delete(id);
  }

  function ensurePeer(id, breed){
    let p = peers.get(id);
    if(p) return p;
    const parts = buildDog(breed || 'golden');
    scene.add(parts.group);
    p = {
      parts,
      group: parts.group,
      target: { x: parts.group.position.x, z: parts.group.position.z, yaw: 0 },
      lastSeen: Date.now(),
    };
    peers.set(id, p);
    return p;
  }

  channel
    .on('presence', { event: 'sync' }, () => {
      // fonte da verdade de quem ainda está conectado — remove fantasmas
      // de quem já saiu, mesmo que o evento 'leave' individual não chegue.
      const stillHere = new Set(Object.keys(channel.presenceState()));
      for(const id of [...peers.keys()]) if(!stillHere.has(id)) removePeer(id);
    })
    .on('presence', { event: 'leave' }, ({ key }) => removePeer(key))
    .on('broadcast', { event: 'move' }, ({ payload }) => {
      if(!payload || payload.id === myId) return;
      const p = ensurePeer(payload.id, payload.breed);
      p.target.x = payload.x;
      p.target.z = payload.z;
      p.target.yaw = payload.yaw;
      p.lastSeen = Date.now();
    })
    .subscribe(status => {
      if(status === 'SUBSCRIBED'){
        subscribed = true;
        channel.track({ joined: Date.now() });
      }
    });

  window.addEventListener('beforeunload', ()=> channel.unsubscribe());

  /* ============ ENVIO: minha posição pros outros ============ */
  let sendAcc = 0;
  let lastSentX = null, lastSentZ = null;
  const SEND_INTERVAL = 0.15;

  function sendMyPosition(dt){
    if(!subscribed || pausedState.value) return;
    const dog = dogController.getDog();
    if(!dog) return;

    sendAcc += dt;
    if(sendAcc < SEND_INTERVAL) return;
    sendAcc = 0;

    const moved = lastSentX == null || Math.hypot(dog.position.x-lastSentX, dog.position.z-lastSentZ) > 0.02;
    if(!moved) return;
    lastSentX = dog.position.x;
    lastSentZ = dog.position.z;

    channel.send({
      type: 'broadcast',
      event: 'move',
      payload: { id: myId, x: dog.position.x, z: dog.position.z, yaw: dog.rotation.y, breed: dogController.getBreed() },
    });
  }

  /* ============ RECEPÇÃO: interpolar e animar os fantasmas ============ */
  const STALE_MS = 15000; // rede de segurança se o 'leave' do Presence não chegar
  const MOVING_MS = 400;  // só anima perna/rabo se recebeu novidade recente

  function updatePeers(dt, elapsed){
    const now = Date.now();
    for(const [id, p] of peers){
      if(now - p.lastSeen > STALE_MS){ removePeer(id); continue; }

      const ease = Math.min(1, dt*8);
      p.group.position.x += (p.target.x - p.group.position.x) * ease;
      p.group.position.z += (p.target.z - p.group.position.z) * ease;
      if(chao){ const y = chao(p.group.position.x, p.group.position.z); if(y !== null) p.group.position.y = y; }
      let diff = p.target.yaw - p.group.rotation.y;
      while(diff > Math.PI) diff -= Math.PI*2;
      while(diff < -Math.PI) diff += Math.PI*2;
      p.group.rotation.y += diff * ease;

      const moving = now - p.lastSeen < MOVING_MS;
      animarCao(p.parts, dt, elapsed, moving);
    }
  }

  function update(dt, elapsed){
    sendMyPosition(dt);
    updatePeers(dt, elapsed);
  }

  return { update };
}
