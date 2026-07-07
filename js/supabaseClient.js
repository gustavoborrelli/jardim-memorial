"use strict";

/*
  CLIENTE SUPABASE
  Um único ponto de conexão com o banco/storage do Supabase, reaproveitado
  por qualquer módulo que precise ler ou salvar dados (por enquanto, lapides.js
  e menuUi.js).

  As duas variáveis abaixo vêm do arquivo .env (nunca commitado — veja
  .env.example para o formato). O Vite injeta qualquer variável que comece
  com VITE_ em import.meta.env durante o build/dev.
*/
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase não configurado: crie um arquivo .env na raiz do projeto ' +
    'com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja .env.example).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
