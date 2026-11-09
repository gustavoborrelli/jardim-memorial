"use strict";

/*
  CHEGADA POR LINK
  Cada homenagem tem um link próprio: jardim-memorial.vercel.app/thor (ou
  /?homenagem=thor). Quem chega por ele já vê o cartão da homenagem enquanto o
  jardim 3D carrega, e depois o cachorro caminha sozinho até a pedra.

  Este módulo é carregado pelo main.js, antes do jogo: busca a homenagem com um
  fetch simples (sem o cliente do Supabase, que mora no pedaço pesado) para que
  o cartão apareça nos primeiros instantes. O jogo depois lê o mesmo resultado.
*/

const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL;
const CHAVE = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function slugDoLink(){
  const porParametro = new URLSearchParams(location.search).get('homenagem');
  const porCaminho = (location.pathname.match(/^\/([a-z0-9-]{1,60})\/?$/i) || [])[1];
  const s = (porParametro || porCaminho || '').toLowerCase();
  return /^[a-z0-9-]{1,60}$/.test(s) ? s : null;
}

export const slugPedido = slugDoLink();

// voltando do login com Google: o Supabase devolve a sessão no endereço
// (#access_token=…, ou #error=… se a pessoa desistiu) e logo a apaga dali.
// Este módulo roda antes do cliente do Supabase existir, então ainda vê.
export const voltouDoLogin = /access_token=|error_description=|[?&]code=/.test(location.hash + location.search);

/* a homenagem do link (linha da tabela memoriais), ou null se não houver link,
   se não existir ou se a rede falhar */
export const homenagemDoLink = slugPedido
  ? fetch(`${URL_SUPABASE}/rest/v1/memoriais?slug=eq.${encodeURIComponent(slugPedido)}&select=*`, {
      headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` },
    })
      .then(r => (r.ok ? r.json() : []))
      .then(linhas => (Array.isArray(linhas) && linhas[0]) || null)
      .catch(() => null)
  : Promise.resolve(null);

// leitura simples de uma tabela do banco, sem o cliente do Supabase (que mora no
// pedaço pesado): é o que deixa o mapa da primeira tela aparecer antes do 3D
export function buscarRest(caminho){
  return fetch(`${URL_SUPABASE}/rest/v1/${caminho}`, {
    headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` },
  }).then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status))));
}

const escapar = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/* o miolo do cartão (foto, nome, datas, mensagem), usado na tela de carregamento
   e no painel de chegada do menu */
export function htmlCartao(h){
  const foto = h.foto_url ? `<img class="chegada-foto" src="${escapar(h.foto_url)}" alt="">` : '';
  return `${foto}
    <p class="chegada-rotulo">Uma homenagem para</p>
    <h2 class="chegada-nome">${escapar(h.nome_pet)}</h2>
    ${h.datas ? `<p class="chegada-datas">${escapar(h.datas)}</p>` : ''}
    ${h.mensagem ? `<p class="chegada-msg">${escapar(h.mensagem)}</p>` : ''}`;
}

export function linkDaHomenagem(slug){
  return `${location.origin}/${slug}`;
}
