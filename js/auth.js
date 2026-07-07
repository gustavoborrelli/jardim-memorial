"use strict";

/*
  AUTENTICAÇÃO
  Fina camada sobre o supabase.auth: guarda o usuário logado (se houver),
  avisa quem se inscreveu (onChange) quando o estado muda, e expõe
  signUp/signIn/signOut. menuUi.js usa isso para decidir quando pedir
  login e para atualizar o "chip" de usuário no HUD.
*/
import { supabase } from './supabaseClient.js';

export function createAuth() {
  let currentUser = null;
  const listeners = [];

  function notify() {
    listeners.forEach(fn => fn(currentUser));
  }

  supabase.auth.getSession().then(({ data }) => {
    currentUser = data.session ? data.session.user : null;
    notify();
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session ? session.user : null;
    notify();
  });

  function onChange(fn) {
    listeners.push(fn);
  }

  function getUser() {
    return currentUser;
  }

  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  return { onChange, getUser, signUp, signIn, signOut };
}
