"use strict";

/*
  O QUE OS JARDINS NATURAIS TÊM EM COMUM (etapa 40)
  O Jardim do Lago e o Bosque dos Vaga-lumes têm desenhos próprios, mas as mesmas
  regras: contornos que ondulam, trilhas desenhadas por pontos e suavizadas, a
  distância até uma linha (trilha, riacho) consultada um milhão de vezes ao assar
  o chão, e a rede de trilhas por onde o cachorro caminha sozinho. Só contas, sem 3D.
*/

/* contorno natural: um raio que ondula com o ângulo */
export const raioEm = (ondas, a) => {
  let k = 1;
  for(const [f, amp, fase] of ondas) k += amp*Math.sin(f*a + fase);
  return k;
};
export const suave = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a)/(b - a)));
  return t*t*(3 - 2*t);
};

/* curva suave (Catmull-Rom) pelos pontos de um esboço, como polilinha fina */
export function catmull(pts, fechada, passos = 6){
  const n = pts.length, P = (i) => fechada ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  const out = [];
  const ate = fechada ? n : n - 1;
  for(let i = 0; i < ate; i++){
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for(let k = 0; k < passos; k++){
      const t = k/passos, t2 = t*t, t3 = t2*t;
      const f = (a, b, c, d) => 0.5*((2*b) + (-a + c)*t + (2*a - 5*b + 4*c - d)*t2 + (-a + 3*b - 3*c + d)*t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(fechada ? out[0] : pts[n - 1]);
  return out;
}

/* Distância até um conjunto de polilinhas. Os segmentos ficam numa grade: longe de
   todos, a resposta é só "longe" (99) — quem pergunta só usa o valor exato perto. */
export function medidorDeLinhas(linhas, { min = -40, lado = 2, n = 40, perto = 4 } = {}){
  const segmentos = [];
  linhas.forEach(l => { for(let i = 0; i < l.length - 1; i++) segmentos.push([l[i][0], l[i][1], l[i + 1][0], l[i + 1][1]]); });
  const celulas = Array.from({ length: n*n }, () => []);
  segmentos.forEach((s, k) => {
    const x0 = Math.min(s[0], s[2]) - perto, x1 = Math.max(s[0], s[2]) + perto;
    const z0 = Math.min(s[1], s[3]) - perto, z1 = Math.max(s[1], s[3]) + perto;
    for(let j = Math.max(0, Math.floor((z0 - min)/lado)); j <= Math.min(n - 1, Math.floor((z1 - min)/lado)); j++)
      for(let i = Math.max(0, Math.floor((x0 - min)/lado)); i <= Math.min(n - 1, Math.floor((x1 - min)/lado)); i++)
        celulas[j*n + i].push(k);
  });
  const ate = (x, z, s) => {
    const vx = s[2] - s[0], vz = s[3] - s[1];
    const t = Math.max(0, Math.min(1, ((x - s[0])*vx + (z - s[1])*vz)/(vx*vx + vz*vz)));
    return Math.hypot(x - s[0] - vx*t, z - s[1] - vz*t);
  };
  return {
    distancia(x, z){
      const i = Math.floor((x - min)/lado), j = Math.floor((z - min)/lado);
      let d = 99;
      if(i >= 0 && j >= 0 && i < n && j < n) for(const k of celulas[j*n + i]) d = Math.min(d, ate(x, z, segmentos[k]));
      return d;
    },
    // o ponto das linhas mais perto, sem limite de distância
    pontoMaisPerto(x, z){
      let melhor = null, dm = Infinity;
      for(const s of segmentos){
        const vx = s[2] - s[0], vz = s[3] - s[1];
        const t = Math.max(0, Math.min(1, ((x - s[0])*vx + (z - s[1])*vz)/(vx*vx + vz*vz)));
        const px = s[0] + vx*t, pz = s[1] + vz*t, d = Math.hypot(x - px, z - pz);
        if(d < dm){ dm = d; melhor = [px, pz]; }
      }
      return melhor;
    },
  };
}

/* A rede de trilhas para a caminhada automática: os pontos de cada trilha viram um
   grafo (cada ponto ligado ao seguinte; a primeira, se `fechada`, volta ao começo) e
   a ponta de cada trilha encosta no ponto mais perto das outras, se estiver a menos
   de 2 m (os ramais saem de uma trilha). rotaAte(de, para): o caminho mais curto do
   ponto da trilha mais perto de `de` ao mais perto de `para`, e dali reto até `para`. */
export function redeDeTrilhas(trilhas, { primeiraFechada = false } = {}){
  const nos = [], arestas = [], deQual = [];
  const novo = (p, t) => { nos.push(p); arestas.push([]); deQual.push(t); return nos.length - 1; };
  const ligar = (a, b) => { const d = Math.hypot(nos[a][0] - nos[b][0], nos[a][1] - nos[b][1]); arestas[a].push([b, d]); arestas[b].push([a, d]); };
  const pontas = [];
  trilhas.forEach((linha, t) => {
    const fechada = primeiraFechada && t === 0;
    const pts = fechada ? linha.slice(0, -1) : linha;
    const ids = pts.map(p => novo(p, t));
    for(let k = 1; k < ids.length; k++) ligar(ids[k - 1], ids[k]);
    if(fechada) ligar(ids[ids.length - 1], ids[0]);
    else pontas.push(ids[0], ids[ids.length - 1]);
  });
  pontas.forEach(n => {
    let melhor = -1, dm = 2;
    nos.forEach((p, i) => {
      if(deQual[i] === deQual[n]) return;
      const d = Math.hypot(p[0] - nos[n][0], p[1] - nos[n][1]);
      if(d < dm){ dm = d; melhor = i; }
    });
    if(melhor >= 0) ligar(n, melhor);
  });
  const maisPerto = (x, z) => {
    let melhor = 0, dm = Infinity;
    nos.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - z); if(d < dm){ dm = d; melhor = i; } });
    return melhor;
  };
  return function rotaAte(de, para){
    const a = maisPerto(de[0], de[1]), b = maisPerto(para[0], para[1]);
    const dist = new Array(nos.length).fill(Infinity), veio = new Array(nos.length).fill(-1), feito = new Array(nos.length).fill(false);
    dist[a] = 0;
    for(;;){
      let u = -1;
      for(let i = 0; i < nos.length; i++) if(!feito[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if(u < 0 || u === b) break;
      feito[u] = true;
      for(const [v, d] of arestas[u]) if(dist[u] + d < dist[v]){ dist[v] = dist[u] + d; veio[v] = u; }
    }
    const caminho = [];
    for(let n = b; n >= 0; n = veio[n]){ caminho.push(nos[n]); if(n === a) break; }
    caminho.reverse();
    // um ponto a cada ~1,5 m basta para o cachorro seguir a curva
    const pontos = [];
    caminho.forEach(p => { const u = pontos[pontos.length - 1]; if(!u || Math.hypot(p[0] - u[0], p[1] - u[1]) > 1.5) pontos.push(p); });
    pontos.push(para);
    return pontos;
  };
}

/* um ponto de uma polilinha (t de 0 a 1) e o giro para atravessar a linha ali */
export function aoLongo(linha, t){
  const i = Math.min(linha.length - 2, Math.floor(t*(linha.length - 1)));
  const [x0, z0] = linha[i], [x1, z1] = linha[i + 1];
  return { x: x0, z: z0, rot: Math.atan2(x1 - x0, z1 - z0) };
}
/* um ponto ao lado de uma polilinha (lado > 0: à esquerda de quem anda nela) */
export function ladoDa(linha, t, lado){
  const i = Math.min(linha.length - 2, Math.floor(t*(linha.length - 1)));
  const [x0, z0] = linha[i], [x1, z1] = linha[i + 1];
  const l = Math.hypot(x1 - x0, z1 - z0) || 1;
  return { x: x0 - (z1 - z0)/l*lado, z: z0 + (x1 - x0)/l*lado };
}
