/*
  PRÉVIA DO LINK DE UMA HOMENAGEM (jardim-memorial.vercel.app/thor)
  O robô do WhatsApp (e o do Telegram, do iMessage, do Facebook…) não roda
  JavaScript: só lê as etiquetas og:* da página que chega pronta. Este arquivo
  monta essa página para cada homenagem: título, mensagem e o cartão com a foto.

  Só robôs chegam aqui (vercel.json separa pelo user-agent); gente de verdade
  recebe o jogo, que lê o mesmo link em js/chegada.js.

  CommonJS de propósito: o package.json não declara "type": "module".
*/
const SITE = 'https://jardim-memorial.vercel.app';
const PADRAO = `${SITE}/og-jardim.jpg`;

const escapar = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

async function buscar(slug){
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const chave = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if(!url || !chave || !/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  const campos = 'nome_pet,datas,mensagem,setor,cartao_url,slug';
  const r = await fetch(`${url}/rest/v1/memoriais?slug=eq.${encodeURIComponent(slug)}&select=${campos}`, {
    headers: { apikey: chave, Authorization: `Bearer ${chave}` },
  });
  if(!r.ok) return null;
  const linhas = await r.json();
  return (Array.isArray(linhas) && linhas[0]) || null;
}

function pagina({ titulo, descricao, imagem, url, corpo }){
  const t = escapar(titulo), d = escapar(descricao), i = escapar(imagem), u = escapar(url);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:site_name" content="Jardim Memorial">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${i}">
<meta property="og:image:secure_url" content="${i}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${u}">
</head>
<body>
${corpo}
<p><a href="${u}">Visitar no Jardim Memorial</a></p>
</body>
</html>`;
}

module.exports = async (req, res) => {
  const slug = String((req.query && req.query.slug) || '').toLowerCase();
  let h = null;
  try { h = await buscar(slug); } catch(e){ h = null; }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if(!h){
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.statusCode = 404;
    res.end(pagina({
      titulo: 'Jardim Memorial',
      descricao: 'Um jardim para passear, plantar flores e guardar a memória dos nossos cachorros.',
      imagem: PADRAO, url: SITE, corpo: '<h1>Jardim Memorial</h1>',
    }));
    return;
  }
  const nome = h.nome_pet;
  const descricao = [h.datas, h.mensagem].filter(Boolean).join(' · ') || `Uma homenagem no ${h.setor}.`;
  // o WhatsApp guarda a prévia por um tempo; aqui o cache é curto para uma
  // homenagem recém-criada já sair certa
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  res.statusCode = 200;
  res.end(pagina({
    titulo: `${nome} · Jardim Memorial`,
    descricao,
    imagem: h.cartao_url || PADRAO,
    url: `${SITE}/${h.slug}`,
    corpo: `<h1>${escapar(nome)}</h1><p>${escapar(descricao)}</p>`,
  }));
};
