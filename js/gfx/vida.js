/*
  VIDA AMBIENTE
  Borboletas, sabiás, pétalas das cerejeiras, pólen na luz e vaga-lumes à noite.
  O que dá pra fazer em shader fica em shader (pétalas, pólen, vaga-lumes): custo
  fixo e nenhum objeto por partícula.
*/
import * as THREE from 'three';
import { sorteador } from './ruido.js';

/* --------------------------- borboletas --------------------------- */
function geoAsa(){
  // duas lóbulos arredondados, sem nenhuma ponta
  const s = new THREE.Shape();
  s.moveTo(0, -0.02);
  s.bezierCurveTo(0.07, -0.1, 0.12, -0.09, 0.1, -0.03);
  s.bezierCurveTo(0.14, -0.02, 0.15, 0.08, 0.1, 0.11);
  s.bezierCurveTo(0.06, 0.13, 0.015, 0.08, 0, 0.03);
  s.closePath();
  const g = new THREE.ShapeGeometry(s, 8);
  g.rotateX(-Math.PI/2);
  return g;
}

function texturaAsa(cor){
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const base = new THREE.Color(cor);
  x.fillStyle = '#' + base.getHexString();
  x.fillRect(0, 0, 64, 64);
  x.strokeStyle = 'rgba(40,24,18,0.75)';
  x.lineWidth = 5;
  x.strokeRect(0, 0, 64, 64);
  x.fillStyle = 'rgba(255,255,255,0.7)';
  [[18, 20, 5], [44, 42, 7], [46, 18, 3]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function criarBorboletas(scene, { perfil }){
  const grupo = new THREE.Group();
  scene.add(grupo);
  const r = sorteador(19);
  const cores = [0xff6fa5, 0xffc93c, 0x6fc8ff, 0xff8a3d, 0xb14fd8, 0x6fe3a1];
  const asa = geoAsa();
  // mapeia UV pela posição para o desenho da asa funcionar na Shape
  {
    const p = asa.attributes.position;
    const uv = new Float32Array(p.count*2);
    for(let i=0;i<p.count;i++){
      uv[i*2] = p.getX(i)/0.15;
      uv[i*2+1] = (p.getZ(i)+0.1)/0.23;
    }
    asa.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  const corpoGeo = new THREE.CapsuleGeometry(0.012, 0.09, 3, 6);
  corpoGeo.rotateX(Math.PI/2);
  const corpoMat = new THREE.MeshStandardMaterial({ color: 0x2c1f18, roughness: 0.8 });
  const mats = cores.map(c => new THREE.MeshStandardMaterial({ map: texturaAsa(c), roughness: 0.55, side: THREE.DoubleSide }));
  const qtd = Math.round(22*Math.max(0.5, perfil.particulas));
  const lista = [];
  for(let i=0;i<qtd;i++){
    const m = new THREE.Group();
    const mat = mats[i % mats.length];
    const dir = new THREE.Mesh(asa, mat);
    const esq = new THREE.Mesh(asa, mat);
    esq.scale.x = -1;
    m.add(dir, esq, new THREE.Mesh(corpoGeo, corpoMat));
    m.scale.setScalar(0.85 + r()*0.45);
    const bx = (r()-0.5)*40, bz = (r()-0.5)*40;
    m.position.set(bx, 1, bz);
    grupo.add(m);
    lista.push({ mesh: m, wingL: esq, wingR: dir, baseX: bx, baseZ: bz, phase: r()*6.283, speed: 0.4 + r()*0.4 });
  }

  let alvo = null, ate = 0;
  return {
    grupo,
    juntar(x, z){ alvo = { x, z }; ate = performance.now() + 3200; },
    atualizar(elapsed, noite){
      // de noite as borboletas dormem (os vaga-lumes assumem)
      grupo.visible = noite < 0.6;
      if(!grupo.visible) return;
      lista.forEach((f, i) => {
        let tx = f.baseX, tz = f.baseZ;
        if(alvo && performance.now() < ate && i%2 === 0){
          tx = alvo.x + Math.sin(elapsed*2+i)*0.6;
          tz = alvo.z + Math.cos(elapsed*2+i)*0.6;
        }
        const px = f.mesh.position.x, pz = f.mesh.position.z;
        const nx = tx + Math.sin(elapsed*f.speed+f.phase)*1.4;
        const nz = tz + Math.cos(elapsed*f.speed*0.8+f.phase)*1.4;
        f.mesh.position.x = nx;
        f.mesh.position.z = nz;
        f.mesh.position.y = 0.55 + Math.sin(elapsed*1.3+f.phase)*0.32 + (0.5+0.5*Math.sin(elapsed*0.6+i));
        // voa pra onde vai, não de lado
        if(Math.abs(nx-px)+Math.abs(nz-pz) > 1e-5) f.mesh.rotation.y = Math.atan2(nx-px, nz-pz);
        f.mesh.rotation.z = Math.sin(elapsed*1.7+f.phase)*0.2;
        const flap = Math.sin(elapsed*13+f.phase)*0.95;
        f.wingR.rotation.z = flap;
        f.wingL.rotation.z = -flap;
      });
    },
  };
}

/* --------------------------- sabiás --------------------------- */
export function criarPassaros(scene, perches){
  const costas = new THREE.MeshStandardMaterial({ color: 0x75695c, roughness: 0.85 });
  const peito = new THREE.MeshStandardMaterial({ color: 0xdb7f2e, roughness: 0.8 });
  const bico = new THREE.MeshStandardMaterial({ color: 0xd9a93b, roughness: 0.55 });
  const olho = new THREE.MeshStandardMaterial({ color: 0x151110, roughness: 0.2 });
  const S = (r, w = 12, h = 10) => new THREE.SphereGeometry(r, w, h);
  function novo(){
    const g = new THREE.Group();
    const c = new THREE.Mesh(S(0.055), costas); c.scale.set(1, 0.9, 1.35); c.position.y = 0.05; g.add(c);
    const p = new THREE.Mesh(S(0.045), peito); p.scale.set(0.9, 0.85, 1.05); p.position.set(0, 0.034, 0.03); g.add(p);
    const h = new THREE.Mesh(S(0.037), costas); h.position.set(0, 0.105, 0.05); g.add(h);
    const b = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.038, 8), bico);
    b.rotation.x = Math.PI/2; b.position.set(0, 0.103, 0.092); g.add(b);
    [-1, 1].forEach(s => {
      const o = new THREE.Mesh(S(0.0075, 8, 6), olho);
      o.position.set(s*0.026, 0.115, 0.07);
      g.add(o);
    });
    const t = new THREE.Mesh(S(0.028), costas); t.scale.set(0.7, 0.32, 2.1); t.position.set(0, 0.055, -0.095); t.rotation.x = 0.35; g.add(t);
    const wings = [-1, 1].map(s => {
      const w = new THREE.Mesh(S(0.042), costas);
      w.scale.set(0.3, 0.8, 1.5);
      w.position.set(s*0.05, 0.062, -0.005);
      g.add(w);
      return w;
    });
    [c, p, h].forEach(m => { m.castShadow = true; });
    g.visible = false;
    scene.add(g);
    return { g, wings };
  }
  const r = sorteador(61);
  const birds = [0, 1].map(i => ({
    ...novo(),
    state: 'away', timer: 4 + i*9 + r()*6,
    from: new THREE.Vector3(), to: new THREE.Vector3(),
    t: 0, dur: 1, phase: r()*6.283,
  }));
  return {
    atualizar(dt, elapsed){
      birds.forEach(b => {
        if(b.state === 'away'){
          b.timer -= dt;
          if(b.timer <= 0 && perches.length){
            const perch = perches[Math.floor(Math.random()*perches.length)];
            b.to.set(perch.x, perch.y, perch.z);
            const out = Math.hypot(perch.x, perch.z) || 1;
            b.from.set(perch.x/out*40, perch.y+7, perch.z/out*40);
            b.t = 0; b.dur = 2.6; b.state = 'flyin'; b.g.visible = true;
          }
          return;
        }
        if(b.state === 'flyin' || b.state === 'flyout'){
          b.t = Math.min(1, b.t + dt/b.dur);
          const e = b.t*b.t*(3-2*b.t);
          b.g.position.lerpVectors(b.from, b.to, e);
          b.g.position.y += Math.sin(b.t*Math.PI)*0.8;
          b.g.rotation.y = Math.atan2(b.to.x-b.from.x, b.to.z-b.from.z);
          const flap = Math.sin(elapsed*16+b.phase)*0.7;
          b.wings[0].rotation.z = flap;
          b.wings[1].rotation.z = -flap;
          if(b.t >= 1){
            if(b.state === 'flyin'){
              b.state = 'perched';
              b.timer = 6 + Math.random()*9;
              b.wings[0].rotation.z = 0.12;
              b.wings[1].rotation.z = -0.12;
              b.baseY = b.g.position.y;
            } else {
              b.state = 'away'; b.g.visible = false; b.timer = 10 + Math.random()*18;
            }
          }
          return;
        }
        b.timer -= dt;
        b.g.position.y = b.baseY + Math.abs(Math.sin(elapsed*2.4+b.phase))*0.012;
        b.g.rotation.y += Math.sin(elapsed*0.7+b.phase)*dt*0.6;
        if(b.timer <= 0){
          b.from.copy(b.g.position);
          const a = Math.random()*6.283;
          b.to.set(b.g.position.x+Math.cos(a)*35, b.g.position.y+9, b.g.position.z+Math.sin(a)*35);
          b.t = 0; b.dur = 2.6; b.state = 'flyout';
        }
      });
    },
  };
}

/* --------------------------- pétalas das cerejeiras --------------------------- */
export function criarPetalas(scene, cerejeiras, { perfil, luz }){
  const porArvore = Math.round(46*perfil.particulas);
  const total = porArvore*cerejeiras.length;
  const geo = new THREE.InstancedBufferGeometry();
  // pétala oval, levemente curva
  const pos = [], idx = [];
  const NS = 6;
  pos.push(0, 0, 0);
  for(let i=0;i<=NS;i++){
    const a = i/NS*Math.PI*2;
    pos.push(Math.cos(a)*0.045, Math.sin(a)*0.058, Math.cos(a)*Math.cos(a)*0.012);
    if(i < NS) idx.push(0, i+1, i+2);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  geo.setIndex(idx);
  const inst = new Float32Array(total*4);
  const var2 = new Float32Array(total*4);
  const r = sorteador(101);
  cerejeiras.forEach((c, ci) => {
    for(let i=0;i<porArvore;i++){
      const k = ci*porArvore+i;
      const a = r()*6.283, rd = Math.sqrt(r())*2.2*c.escala;
      inst[k*4] = c.x + Math.cos(a)*rd;
      inst[k*4+1] = (2.0 + r()*1.8)*c.escala;
      inst[k*4+2] = c.z + Math.sin(a)*rd;
      inst[k*4+3] = r(); // fase
      var2[k*4] = 0.038 + r()*0.03;    // velocidade do ciclo
      var2[k*4+1] = r()*6.283;
      var2[k*4+2] = 1.5 + r()*2.5;     // giro
      var2[k*4+3] = r();
    }
  });
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(inst, 4));
  geo.setAttribute('iVar', new THREE.InstancedBufferAttribute(var2, 4));
  geo.instanceCount = total;
  const uTempo = { value: 0 };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide, transparent: true });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTempo = uTempo;
    s.uniforms.uSolCor = luz.uSolCor;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', /* glsl */`#include <common>
        attribute vec4 iPos, iVar;
        uniform float uTempo;
        varying vec2 vPet;
        mat3 rotXY(float a, float b){
          float ca=cos(a), sa=sin(a), cb=cos(b), sb=sin(b);
          return mat3(cb, sa*sb, -ca*sb, 0.0, ca, sa, sb, -sa*cb, ca*cb);
        }
        vec3 petPos;
        vec3 petNor;
      `)
      .replace('#include <beginnormal_vertex>', /* glsl */`
        float tc = fract(uTempo*iVar.x + iPos.w);
        float queda = min(tc/0.86, 1.0);   // 86% do ciclo caindo, o resto deitada no chão
        float y = mix(iPos.y, 0.03, queda);
        float descanso = step(0.86, tc);
        vec3 b = vec3(iPos.x, y, iPos.z);
        b.x += sin(uTempo*1.3 + iVar.y)*0.45*queda + queda*1.1;
        b.z += cos(uTempo*1.1 + iVar.y)*0.32*queda + queda*0.5;
        mat3 giro = rotXY(uTempo*iVar.z + iVar.y, uTempo*iVar.z*0.6 + iVar.w*6.0);
        if(descanso > 0.5) giro = rotXY(1.5708, iVar.y);
        petPos = b + giro*position;
        petNor = giro*vec3(0.0, 0.0, 1.0);
        vPet = vec2(smoothstep(1.0, 0.92, tc), smoothstep(0.0, 0.05, tc));
        vec3 objectNormal = petNor;
      `)
      .replace('#include <begin_vertex>', 'vec3 transformed = petPos;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vPet;`)
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
        diffuseColor.rgb = vec3(1.0, 0.68, 0.76);
        diffuseColor.a *= vPet.x*vPet.y;
        if(diffuseColor.a < 0.02) discard;
      `);
  };
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.userData.semAO = true;
  scene.add(m);
  return { atualizar(elapsed){ uTempo.value = elapsed; } };
}

/* --------------------------- pólen e vaga-lumes --------------------------- */
export function criarAr(scene, { perfil, luz }){
  const uTempo = { value: 0 }, uAltura = { value: 900 }, uCam = { value: new THREE.Vector3() };
  const uPolen = { value: 0 }, uNoite = { value: 0 };

  /* pólen: caixa que acompanha a câmera (mod no shader) */
  const R = 11;
  const n = Math.round(420*perfil.particulas);
  const r = sorteador(202);
  const pts = new Float32Array(n*4);
  for(let i=0;i<n;i++){ pts[i*4] = r()*2*R; pts[i*4+1] = r()*5; pts[i*4+2] = r()*2*R; pts[i*4+3] = r(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n*3), 3));
  g.setAttribute('aP', new THREE.BufferAttribute(pts, 4));
  const polen = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: { uTempo, uAltura, uCam, uPolen, uSolCor: luz.uSolCor },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec4 aP;
      uniform float uTempo, uAltura;
      uniform vec3 uCam;
      varying float vA;
      void main(){
        vec3 p = aP.xyz;
        p.x += uTempo*0.13 + sin(uTempo*0.5 + aP.w*20.0)*0.5;
        p.z += uTempo*0.07 + cos(uTempo*0.37 + aP.w*14.0)*0.5;
        p.y += sin(uTempo*0.3 + aP.w*9.0)*0.35;
        vec2 q = mod(p.xz - uCam.xz + ${R.toFixed(1)}, ${(2*R).toFixed(1)}) - ${R.toFixed(1)};
        vec3 w = vec3(q.x + uCam.x, p.y + 0.2, q.y + uCam.z);
        float d = length(q);
        vA = (1.0 - smoothstep(${(R*0.6).toFixed(2)}, ${R.toFixed(1)}, d))*(0.55 + 0.45*sin(uTempo*1.4 + aP.w*40.0));
        vec4 mv = viewMatrix*vec4(w, 1.0);
        gl_PointSize = clamp(uAltura*(0.012 + aP.w*0.012)/(-mv.z), 1.0, 9.0);
        gl_Position = projectionMatrix*mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uPolen;
      uniform vec3 uSolCor;
      varying float vA;
      void main(){
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(uSolCor*1.2, a*a*vA*uPolen);
      }
    `,
  }));
  polen.frustumCulled = false;
  polen.userData.semAO = true;
  scene.add(polen);

  /* vaga-lumes: cada um com sua órbita, pulsando devagar. Noite acolhedora. */
  const nV = Math.round(90*perfil.particulas);
  const v = new Float32Array(nV*4);
  for(let i=0;i<nV;i++){
    let x, z;
    do { x = (r()-0.5)*54; z = (r()-0.5)*54; } while(Math.abs(x) < 3 || Math.abs(z) < 3 || Math.hypot(x, z) < 7);
    v[i*4] = x; v[i*4+1] = 0.35 + r()*1.5; v[i*4+2] = z; v[i*4+3] = r();
  }
  const gv = new THREE.BufferGeometry();
  gv.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nV*3), 3));
  gv.setAttribute('aP', new THREE.BufferAttribute(v, 4));
  const vaga = new THREE.Points(gv, new THREE.ShaderMaterial({
    uniforms: { uTempo, uAltura, uNoite },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec4 aP;
      uniform float uTempo, uAltura;
      varying float vP;
      void main(){
        float f = aP.w*6.283;
        vec3 p = aP.xyz;
        p.x += sin(uTempo*0.33 + f)*1.3 + sin(uTempo*0.91 + f*2.0)*0.3;
        p.z += cos(uTempo*0.27 + f*1.7)*1.3 + cos(uTempo*0.77 + f)*0.3;
        p.y += sin(uTempo*0.61 + f*3.0)*0.32;
        // acende e apaga, cada um no seu tempo
        vP = pow(0.5 + 0.5*sin(uTempo*(0.7 + aP.w*0.8) + f*5.0), 3.0);
        vec4 mv = modelViewMatrix*vec4(p, 1.0);
        gl_PointSize = clamp(uAltura*0.085/(-mv.z), 2.0, 34.0);
        gl_Position = projectionMatrix*mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uNoite;
      varying float vP;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float nucleo = smoothstep(0.1, 0.0, d);
        float halo = smoothstep(0.5, 0.0, d);
        vec3 cor = vec3(0.85, 1.0, 0.35);
        gl_FragColor = vec4(cor*(nucleo*4.0 + halo*0.5), (nucleo + halo*halo*0.65)*vP*uNoite);
      }
    `,
  }));
  vaga.frustumCulled = false;
  vaga.userData.semAO = true;
  scene.add(vaga);

  return {
    uPolen, uNoite,
    atualizar(elapsed, camera, alturaTela){
      uTempo.value = elapsed;
      uCam.value.copy(camera.position);
      uAltura.value = alturaTela;
    },
  };
}
