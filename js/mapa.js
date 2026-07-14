"use strict";

/*
  MAPA
  Visão de cima em SVG do jardim inteiro: as 4 seções, a praça central e uma
  bolinha por vaga (colorida se tem homenagem, vazada se está livre), com
  busca por nome.

  Desenhado a partir dos dados reais (lapides.plots, world.PLAZA) em vez de
  um desenho fixo — nada de posição fica "chumbada" aqui. Se o jardim ganhar
  mais seções/vagas depois, a próxima vez que o mapa abrir ele já desenha
  tudo, sem precisar mexer neste arquivo.

  createMapaUi(deps) devolve openMap()/closeMap() pro menuUi.js ligar ao
  botão e à tecla de atalho.
*/

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs){
  const e = document.createElementNS(SVG_NS, tag);
  for(const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

function normalize(s){
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function createMapaUi({ lapides, world, dogController, bounds }){

  const modalBack = document.getElementById('mapModalBack');
  const svg = document.getElementById('mapSvg');
  const searchInput = document.getElementById('mapSearchInput');
  const resultsEl = document.getElementById('mapResults');
  const btnClose = document.getElementById('btnMapClose');

  let markers = []; // [{plot, circle}]

  function selectPlot(plot){
    markers.forEach(m => m.circle.classList.toggle('selected', m.plot === plot));
  }

  function buildStatic(){
    const plots = lapides.plots;
    // moldura sempre cobre pelo menos o terreno cercado; se algum plot no
    // futuro cair fora disso, ele ainda entra na conta em vez de ser cortado
    let half = bounds;
    plots.forEach(p => { half = Math.max(half, Math.abs(p.x) + 3, Math.abs(p.z) + 3); });

    svg.setAttribute('viewBox', `${-half} ${-half} ${half*2} ${half*2}`);
    svg.innerHTML = '';

    svg.appendChild(svgEl('rect', {
      class: 'map-ground',
      x: -bounds, y: -bounds, width: bounds*2, height: bounds*2, rx: 1.5,
    }));

    // avenidas de areia, no mesmo lugar/tamanho das do jardim 3D de
    // verdade (world.AVENUES), pra o mapa servir de referência real e não
    // só um esquema abstrato
    world.AVENUES.forEach(av => {
      svg.appendChild(svgEl('rect', {
        class: 'map-avenue',
        x: av.x - av.w/2, y: av.z - av.l/2, width: av.w, height: av.l,
      }));
    });

    svg.appendChild(svgEl('circle', {
      class: 'map-plaza',
      cx: world.PLAZA.x, cy: world.PLAZA.z, r: world.PLAZA.r,
    }));
    svg.appendChild(svgEl('circle', {
      class: 'map-fountain',
      cx: world.PLAZA.x, cy: world.PLAZA.z, r: world.PLAZA.r*0.32,
    }));

    // rótulo de cada seção, na média de posição dos plots que pertencem a ela
    const bySection = new Map();
    plots.forEach(p => {
      if(!bySection.has(p.section)) bySection.set(p.section, []);
      bySection.get(p.section).push(p);
    });
    bySection.forEach((pts, name) => {
      const cx = pts.reduce((s,p)=>s+p.x, 0) / pts.length;
      const cz = pts.reduce((s,p)=>s+p.z, 0) / pts.length;
      const label = svgEl('text', { class:'map-section-label', x:cx, y:cz, 'text-anchor':'middle' });
      label.textContent = name;
      svg.appendChild(label);
    });

    markers = plots.map(plot => {
      const occupied = plot.occupied && plot.data;
      const circle = svgEl('circle', {
        class: 'map-marker ' + (occupied ? 'occupied' : 'empty'),
        cx: plot.x, cy: plot.z,
        r: occupied ? 0.85 : 0.55,
      });
      if(occupied) circle.style.fill = plot.data.cor || '#c9beb0';
      const title = svgEl('title', {});
      title.textContent = occupied ? plot.data.name : 'Vaga livre';
      circle.appendChild(title);
      circle.addEventListener('click', () => selectPlot(plot));
      svg.appendChild(circle);
      return { plot, circle };
    });

    // onde o cachorro está e pra onde está olhando, só como referência de
    // orientação — foto do momento em que o mapa abriu, não acompanha o
    // passeio ao vivo. Seta em vez de bolinha: rotation.y do cachorro em
    // graus dá a direção certa porque, na projeção de cima, x/z do mundo
    // viram x/y do svg direto (sem inverter eixo nenhum), e a "frente" do
    // cachorro em yaw=0 (sin=0,cos=1) já aponta pro +z == +y na tela — ou
    // seja, a seta "de fábrica" só precisa apontar pra baixo.
    const dog = dogController.getDog();
    if(dog){
      const yawDeg = dog.rotation.y * 180/Math.PI;
      const arrow = svgEl('g', {
        class: 'map-dog-marker',
        transform: `translate(${dog.position.x} ${dog.position.z}) rotate(${yawDeg})`,
      });
      arrow.appendChild(svgEl('polygon', { points: '0,0.85 0.6,-0.55 -0.6,-0.55' }));
      svg.appendChild(arrow);
    }
  }

  function renderResults(query){
    const q = normalize(query);
    resultsEl.innerHTML = '';

    if(!q){
      markers.forEach(m => m.circle.classList.remove('dim'));
      return;
    }

    const matches = lapides.plots.filter(p => p.occupied && p.data && normalize(p.data.name).includes(q));
    const matchSet = new Set(matches);
    markers.forEach(m => m.circle.classList.toggle('dim', !matchSet.has(m.plot)));

    if(!matches.length){
      resultsEl.innerHTML = '<p class="map-results-empty">Nenhuma lápide encontrada.</p>';
      return;
    }
    matches.forEach(plot => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'map-result-item';
      const nameEl = document.createElement('span');
      nameEl.textContent = plot.data.name;
      const sectionEl = document.createElement('span');
      sectionEl.className = 'map-result-section';
      sectionEl.textContent = plot.section;
      item.append(nameEl, sectionEl);
      item.addEventListener('click', () => selectPlot(plot));
      resultsEl.appendChild(item);
    });
  }

  searchInput.addEventListener('input', () => renderResults(searchInput.value));

  function openMap(){
    buildStatic();
    searchInput.value = '';
    renderResults('');
    modalBack.classList.add('open');
    dogController.resetKeys(); // já para o cachorro na hora, senão ele some pelo jardim atrás do mapa
  }
  function closeMap(){
    modalBack.classList.remove('open');
  }
  function isOpen(){
    return modalBack.classList.contains('open');
  }

  btnClose.addEventListener('click', closeMap);
  modalBack.addEventListener('click', e => { if(e.target === modalBack) closeMap(); });

  return { openMap, closeMap, isOpen };
}
