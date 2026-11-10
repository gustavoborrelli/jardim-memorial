"use strict";

/*
  QUAL JARDIM
  O site ainda é um jardim só, o Jardim Memorial. O Jardim do Lago (etapa 37) é um
  protótipo visual, aberto só por ?jardim=lago, sem banco de dados: a coluna
  `jardim` nas tabelas e a Ponte do Arco-Íris vêm nas próximas etapas.
*/
const pedido = new URLSearchParams(location.search).get('jardim');
export const JARDIM = pedido === 'lago' ? 'lago' : 'memorial';
