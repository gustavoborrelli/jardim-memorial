"use strict";

/*
  O SOM DOS JARDINS (etapa 43)
  Gravações de verdade, de domínio público (CC0, do Freesound), no lugar do vento
  e dos pios sintetizados: pássaros de dia e grilos à noite nos três jardins; a
  fonte no Jardim Memorial; a água batendo na margem e um coro de sapos ao
  entardecer no Jardim do Lago; o riacho no Bosque dos Vaga-lumes. Escolhidas pelo
  Gustavo em 2026-11-10; onde ele deixou mais de uma, cada visita sorteia uma.

  Cada arquivo em public/sons/ é um laço de até 60 s que repete sem emenda, com
  ~0,3 s de folga em cada ponta (a própria continuação do laço): o laço toca de FOLGA
  até FOLGA + duração, e o atraso que o codificador AAC põe no começo do arquivo não
  quebra a volta.

  Os sons de um lugar (a fonte, a água, o riacho) saem de um ponto no mundo e o
  navegador os mistura pela distância e pelo lado em relação à câmera: a fonte
  na praça; a água e o riacho no ponto da margem mais perto do cachorro. Os de
  fundo (pássaros, grilos) tocam iguais em todo lugar, conforme a hora do dia.
  Só carrega depois que o passeio começa: não atrasa a primeira tela.
*/
// em blocos inteiros do AAC (1024 amostras a 44,1 kHz): as duas pontas do laço caem na
// mesma fase do bloco e saem do codificador quase iguais, sem estalo na volta
const FOLGA = 13312/44100;
const LACO_PADRAO = 2644992/44100; // ~59,98 s
// a duração do laço de cada arquivo (sem as folgas)
const LACO = {
  'passaros-426276': LACO_PADRAO, 'passaros-516295': LACO_PADRAO, 'passaros-856018': LACO_PADRAO, 'passaros-459488': LACO_PADRAO,
  'fonte-460559': LACO_PADRAO, 'fonte-169252': 2143232/44100,
  'lago-614299': LACO_PADRAO, 'lago-568819': LACO_PADRAO, 'sapos-645706': LACO_PADRAO,
  'riacho-578068': LACO_PADRAO, 'riacho-197023': LACO_PADRAO,
  'grilos-522299': LACO_PADRAO,
};
const OPCOES = {
  passaros: ['passaros-426276', 'passaros-516295', 'passaros-856018', 'passaros-459488'],
  grilos: ['grilos-522299'],
  fonte: ['fonte-460559', 'fonte-169252'],
  lago: ['lago-614299', 'lago-568819'],
  sapos: ['sapos-645706'],
  riacho: ['riacho-578068', 'riacho-197023'],
};
// o que toca em cada jardim
const DO_JARDIM = {
  memorial: ['passaros', 'grilos', 'fonte'],
  lago: ['passaros', 'grilos', 'lago', 'sapos'],
  bosque: ['passaros', 'grilos', 'riacho'],
};
// de onde vem cada som de lugar: distância de referência e queda (PannerNode)
const LUGAR = {
  fonte: { ref: 2.5, queda: 1.3 },
  lago: { ref: 3.5, queda: 1.15 },
  sapos: { ref: 4, queda: 1.0 },
  riacho: { ref: 2.8, queda: 1.25 },
};
const sortear = (lista) => lista[Math.floor(Math.random()*lista.length)];

/* jardim: 'memorial' | 'lago' | 'bosque'; planta: a planta do jardim natural (para a
   margem e o riacho); destino: o nó de volume geral (o botão de som do menu) */
export function criarSom(ctx, destino, { jardim, planta = null }){
  const faixas = {}; // categoria -> { volume (GainNode), panner?, pronto }
  // pontos da margem do lago / do leito do riacho, para achar o mais perto do cachorro
  let beira = null;
  if(jardim === 'lago' && planta) beira = Array.from({ length: 96 }, (_, i) => planta.naMargem(i/96*Math.PI*2, -0.2));
  if(jardim === 'bosque' && planta) beira = planta.RIACHO;

  async function carregar(categoria){
    const nome = sortear(OPCOES[categoria]);
    const volume = ctx.createGain();
    volume.gain.value = 0;
    let saida = volume;
    let panner = null;
    if(LUGAR[categoria]){
      panner = ctx.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'inverse';
      panner.refDistance = LUGAR[categoria].ref;
      panner.rolloffFactor = LUGAR[categoria].queda;
      panner.maxDistance = 80;
      volume.connect(panner);
      saida = panner;
      if(categoria === 'fonte') pos(panner, 0, 1.2, 0);
    }
    saida.connect(destino);
    faixas[categoria] = { volume, panner, pronto: false, alvo: 0 };
    try {
      const resp = await fetch(`/sons/${nome}.m4a`);
      const buffer = await ctx.decodeAudioData(await resp.arrayBuffer());
      const fonte = ctx.createBufferSource();
      fonte.buffer = buffer;
      fonte.loop = true;
      fonte.loopStart = FOLGA;
      fonte.loopEnd = Math.min(buffer.duration, FOLGA + LACO[nome]);
      fonte.connect(volume);
      // cada visita começa num ponto diferente do laço
      fonte.start(0, FOLGA + Math.random()*LACO[nome]);
      faixas[categoria].pronto = true;
    } catch(e){
      console.warn('Som não carregou:', nome, e && e.message);
    }
  }
  DO_JARDIM[jardim].forEach(carregar);

  function pos(p, x, y, z){
    if(p.positionX){ p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; }
    else p.setPosition(x, y, z);
  }
  // o ponto da beira (margem ou riacho) mais perto do cachorro
  function maisPerto(x, z){
    let melhor = beira[0], dm = Infinity;
    for(const p of beira){ const d = (p[0] - x)**2 + (p[1] - z)**2; if(d < dm){ dm = d; melhor = p; } }
    return melhor;
  }
  const frente = { x: 0, y: 0, z: -1 };
  let beiraAtual = null;

  /* a cada quadro: onde está a câmera (quem ouve), onde está o cachorro, que hora é */
  function atualizar(camera, cao, momento){
    const L = ctx.listener, t = ctx.currentTime;
    if(camera){
      const e = camera.matrixWorld.elements;
      frente.x = -e[8]; frente.y = -e[9]; frente.z = -e[10];
      if(L.positionX){
        L.positionX.value = camera.position.x; L.positionY.value = camera.position.y; L.positionZ.value = camera.position.z;
        L.forwardX.value = frente.x; L.forwardY.value = frente.y; L.forwardZ.value = frente.z;
        L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
      } else {
        L.setPosition(camera.position.x, camera.position.y, camera.position.z);
        L.setOrientation(frente.x, frente.y, frente.z, 0, 1, 0);
      }
    }
    // a água e o riacho saem do ponto da beira mais perto do cachorro (anda macio)
    if(beira && cao){
      const [bx, bz] = maisPerto(cao.x, cao.z);
      if(!beiraAtual) beiraAtual = [bx, bz];
      beiraAtual[0] += (bx - beiraAtual[0])*0.08;
      beiraAtual[1] += (bz - beiraAtual[1])*0.08;
      ['lago', 'sapos', 'riacho'].forEach(c => { if(faixas[c] && faixas[c].panner) pos(faixas[c].panner, beiraAtual[0], 0.3, beiraAtual[1]); });
    }
    // volumes pela hora: pássaros de dia, grilos e sapos quando escurece
    const { dia = 1, dourado = 0, noite = 0 } = momento || {};
    const alvo = {
      passaros: 0.42*(dia + dourado*0.75),
      grilos: 0.5*noite + 0.08*dourado,
      fonte: 0.85,
      lago: 0.8,
      sapos: 0.6*(dourado*0.7 + noite),
      riacho: 0.85,
    };
    for(const c in faixas){
      const f = faixas[c];
      const v = f.pronto ? alvo[c] : 0;
      if(Math.abs(v - f.alvo) > 0.005){
        f.alvo = v;
        f.volume.gain.cancelScheduledValues(t);
        f.volume.gain.setTargetAtTime(v, t, 1.2); // entra e muda devagar
      }
    }
  }
  return { atualizar };
}
