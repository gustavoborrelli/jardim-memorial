"use strict";

/*
  A PLANTA DO JARDIM
  As medidas que o jardim 3D e o mapa de tesouro precisam ter iguais: a praça,
  as quatro avenidas, a cerca e as vagas de cada campo. Moram aqui, sem nada de
  3D, para o mapa poder desenhar o jardim antes de o jogo carregar (etapa 35).
*/

export const PLAZA = { x:0, z:0, r:5.5 };

// quatro avenidas partindo da praça; x,z = centro, w,l = extensão nos eixos
export const AVENUES = [
  { x:0, z:-16.5, w:4.2, l:22 },
  { x:0, z:16.5, w:4.2, l:22 },
  { x:-16.5, z:0, w:22, l:4.2 },
  { x:16.5, z:0, w:22, l:4.2 },
];

// até onde o cachorro anda (a cerca)
export const BOUNDS = 25.5;

// os quatro campos, um por quadrante
export const SECTIONS = [
  {name:'Recanto do Sol',          sx: 1, sz: -1},
  {name:'Bosque da Saudade',       sx: -1, sz: -1},
  {name:'Campo das Estrelas',      sx: 1, sz: 1},
  {name:'Prado dos Companheiros',  sx: -1, sz: 1},
];

// as vagas: quatro por campo, em duas fileiras e duas colunas
export const VAGAS = [];
SECTIONS.forEach(sec=>{
  [9,15].forEach(ax=>{
    [9,15].forEach(az=>{
      VAGAS.push({ x: sec.sx*ax, z: sec.sz*az, section: sec.name });
    });
  });
});

// "no Recanto do Sol", "na Prainha": o artigo certo antes do nome de um lugar
const LUGARES_FEMININOS = new Set(['Margem do Lago', 'Prainha', 'Clareira do Alto']);
export const noLugar = (lugar) => `${LUGARES_FEMININOS.has(lugar) ? 'na' : 'no'} ${lugar}`;

// a linha da tabela memoriais no formato que o jardim usa (lapides.js e o mapa)
export function dadosDaLinha(row, photo = null){
  return {
    id: row.id,
    criadoPor: row.criado_por,
    name: row.nome_pet,
    dates: row.datas,
    msg: row.mensagem,
    photo,
    photoUrl: row.foto_url,
    formato: row.formato,
    cor: row.cor,
    slug: row.slug,
  };
}
