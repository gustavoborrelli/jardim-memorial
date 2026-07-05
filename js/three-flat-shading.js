"use strict";

/*
  LOW-POLY STYLE: todo THREE.MeshStandardMaterial passa a ter flatShading
  (facetas visíveis, sem suavização). Este é um "monkey patch": substituímos
  a função original por uma versão que sempre injeta flatShading:true.

  IMPORTANTE: este arquivo precisa ser importado ANTES de qualquer outro
  módulo que crie materiais (mundo.js, lapides.js, cachorros.js), porque a
  troca só vale para materiais criados depois dela. Em js/main.js, o import
  deste arquivo é sempre o primeiro.
*/
const _MSM = THREE.MeshStandardMaterial;
THREE.MeshStandardMaterial = function (params) {
  return new _MSM(Object.assign({ flatShading: true }, params));
};
