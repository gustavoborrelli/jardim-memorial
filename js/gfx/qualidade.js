/*
  QUALIDADE
  O jardim precisa rodar de um M5 a um celular de entrada, então nenhum efeito
  é fixo: cada perfil diz quanto de cada coisa cabe. O perfil inicial sai do
  aparelho (GPU + tela); depois, `Governador` mede os quadros de verdade e vai
  desligando o que for mais caro se o aparelho não estiver dando conta.

  Forçar um perfil (testes, ou quem quiser): ?qualidade=alto|medio|baixo
*/

export const PERFIS = {
  alto: {
    nome: 'alto', pixels: 2.3e6, msaa: 4, pos: true, ao: true, bloom: true,
    sombra: 3072, grama: { perto: { raio: 7, densidade: 190, segmentos: 4 }, longe: { raio: 17, densidade: 68, segmentos: 2 } },
    pelos: 14, luzesLampada: true, celulaSDF: 1, nuvens: 4,
    folhagem: 1, particulas: 1,
  },
  medio: {
    nome: 'medio', pixels: 1.6e6, msaa: 2, pos: true, ao: false, bloom: true,
    sombra: 2048, grama: { perto: { raio: 5.5, densidade: 120, segmentos: 3 }, longe: { raio: 13, densidade: 42, segmentos: 2 } },
    pelos: 8, luzesLampada: true, celulaSDF: 1.25, nuvens: 3,
    folhagem: 0.65, particulas: 0.6,
  },
  baixo: {
    nome: 'baixo', pixels: 0.9e6, msaa: 0, pos: false, ao: false, bloom: false,
    sombra: 1024, grama: { perto: null, longe: { raio: 10, densidade: 30, segmentos: 2 } },
    pelos: 0, luzesLampada: false, celulaSDF: 1.6, nuvens: 2,
    folhagem: 0.4, particulas: 0.3,
  },
};

/* Quantos pixels desenhar é o que mais pesa: um jardim estilizado com bom antialias
   não precisa de 8 milhões deles. O teto vale pra qualquer tela; em monitor pequeno
   ele nem chega a atuar. */
export function escalaDePixels(perfil, largura, altura){
  const teto = Math.sqrt(perfil.pixels/(largura*altura));
  return Math.min(window.devicePixelRatio || 1, 2, Math.max(0.5, teto));
}

function lerGPU(){
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if(!gl) return { semWebGL2: true, nome: '' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { nome: ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '' };
  } catch(e){
    return { nome: '' };
  }
}

export function escolherPerfil(){
  const pedido = new URLSearchParams(location.search).get('qualidade');
  if(pedido && PERFIS[pedido]) return PERFIS[pedido];

  const gpu = lerGPU();
  const nome = gpu.nome.toLowerCase();
  if(gpu.semWebGL2 || /swiftshader|llvmpipe|software|basic render/.test(nome)) return PERFIS.baixo;

  const toque = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
  if(toque){
    // celular: só os topo de linha aguentam o perfil médio
    const forte = /apple gpu|adreno.*(7[3-9]\d|8\d\d)|mali-g(7[1-9]|[89]\d|7\d\d)/.test(nome);
    const nucleos = navigator.hardwareConcurrency || 4;
    return (forte && nucleos >= 6) ? PERFIS.medio : PERFIS.baixo;
  }
  // desktop: gráfico integrado antigo fica no médio; o resto começa no alto e
  // o governador corrige se a suposição estiver errada
  if(/intel.*(hd|uhd)|mali|adreno|powervr/.test(nome)) return PERFIS.medio;
  return PERFIS.alto;
}

/*
  Governador: se a média de FPS fica abaixo do alvo por alguns segundos, puxa
  o próximo degrau da lista. Nunca sobe de volta durante a visita — oscilar de
  qualidade é mais feio do que ficar um degrau abaixo.
*/
export function criarGovernador(degraus, { alvo = 38, janela = 3.5, carencia = 5 } = {}){
  // ?governador=0: pra medir desempenho sem ele mexer na qualidade durante a medição
  if(new URLSearchParams(location.search).get('governador') === '0') return { quadro(){} };
  let acumulado = 0, quadros = 0, espera = carencia, proximo = 0;
  return {
    quadro(dtReal){
      if(proximo >= degraus.length) return;
      // aba em segundo plano não conta. O corte é alto de propósito: num aparelho
      // muito fraco todo quadro é lento, e é ele quem mais precisa do governador
      if(document.hidden || dtReal > 3) return;
      if(espera > 0){ espera -= dtReal; return; }
      acumulado += dtReal; quadros++;
      if(acumulado < janela || quadros < 3) return;
      const fps = quadros/acumulado;
      acumulado = 0; quadros = 0;
      if(fps < alvo){
        degraus[proximo++]();
        espera = 2; // deixa o aparelho estabilizar antes de julgar de novo
      }
    },
  };
}
