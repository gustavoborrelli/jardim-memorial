"use strict";

/*
  CARTÃO DA PRÉVIA
  A imagem que aparece no WhatsApp quando alguém manda o link de uma homenagem.
  Gerada aqui, no navegador de quem cria (a foto já está carregada e o canvas é
  de graça), e enviada junto com a homenagem. Sem servidor de imagem.

  Tudo centralizado de propósito: em conversa, o WhatsApp às vezes mostra a
  prévia inteira (1200x630) e às vezes só um quadrado do meio. Foto e nome
  cabem nesse quadrado.

  Tem de ficar abaixo de 600 KB (limite da Meta; acima disso a prévia sai sem
  imagem e ninguém avisa). Em JPEG, um cartão destes fica em ~100–200 KB.
*/

const L = 1200, A = 630;
const LIMITE = 450*1024; // folga em relação aos 600 KB

let fundo = null;
function carregarFundo(){
  if(!fundo){
    fundo = new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/og-jardim.jpg';
    });
  }
  return fundo;
}

function cobrir(ctx, img, x, y, w, h){
  const r = Math.max(w/img.width, h/img.height);
  const dw = img.width*r, dh = img.height*r;
  ctx.drawImage(img, x + (w-dw)/2, y + (h-dh)/2, dw, dh);
}

function caber(ctx, texto, fonte, tamanho, maximo){
  let t = tamanho;
  do { ctx.font = fonte(t); t -= 2; } while(ctx.measureText(texto).width > maximo && t > 24);
}

/* devolve um Blob JPEG, ou null se algo falhar (a homenagem sai sem cartão) */
export async function gerarCartao({ nome, datas, foto }){
  try {
    const c = document.createElement('canvas');
    c.width = L; c.height = A;
    const ctx = c.getContext('2d');

    const img = await carregarFundo();
    if(img){
      ctx.filter = 'blur(6px) saturate(1.05)';
      cobrir(ctx, img, -20, -20, L+40, A+40);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = '#3b4a2f';
      ctx.fillRect(0, 0, L, A);
    }
    // véu escuro e quente: o texto creme precisa de contraste em qualquer céu
    const veu = ctx.createRadialGradient(L/2, A*0.46, 60, L/2, A/2, L*0.62);
    veu.addColorStop(0, 'rgba(28,20,30,0.38)');
    veu.addColorStop(1, 'rgba(20,14,22,0.78)');
    ctx.fillStyle = veu;
    ctx.fillRect(0, 0, L, A);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const creme = '#f4ece0';

    ctx.fillStyle = 'rgba(244,236,224,0.78)';
    ctx.font = '600 22px Georgia, "Times New Roman", serif';
    if('letterSpacing' in ctx) ctx.letterSpacing = '6px';
    ctx.fillText('JARDIM MEMORIAL', L/2, 58);
    if('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    const nomeY = foto ? 508 : 350;
    if(foto){
      const cx = L/2, cy = 262, r = 168;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 30;
      ctx.beginPath(); ctx.arc(cx, cy, r + 9, 0, Math.PI*2);
      ctx.fillStyle = creme;
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
      cobrir(ctx, foto, cx - r, cy - r, r*2, r*2);
      ctx.restore();
    }

    ctx.fillStyle = creme;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 12;
    caber(ctx, nome, (t) => `italic ${t}px Georgia, "Times New Roman", serif`, foto ? 70 : 104, 560);
    ctx.fillText(nome, L/2, nomeY);
    if(datas){
      ctx.font = `${foto ? 28 : 34}px Georgia, "Times New Roman", serif`;
      ctx.fillStyle = 'rgba(244,236,224,0.82)';
      ctx.fillText(datas, L/2, nomeY + (foto ? 46 : 58));
    }
    ctx.shadowBlur = 0;

    for(const q of [0.86, 0.74, 0.6]){
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
      if(blob && blob.size <= LIMITE) return blob;
    }
    return null;
  } catch(err){
    console.warn('Não foi possível gerar o cartão da prévia:', err);
    return null;
  }
}
