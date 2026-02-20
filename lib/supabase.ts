
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 1. Environment Variables (Safe Access)
const getEnv = (key: string) => {
  try {
    // @ts-ignore
    return import.meta.env?.[key];
  } catch {
    return undefined;
  }
};

const ENV_URL = getEnv('VITE_SUPABASE_URL');
const ENV_KEY = getEnv('VITE_SUPABASE_ANON_KEY');

// 2. Local Storage (Fallback for Preview/Runtime config)
const getLocal = (key: string) => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
};

const LOCAL_URL = getLocal('SUPABASE_URL');
const LOCAL_KEY = getLocal('SUPABASE_ANON_KEY');

// 3. Hardcoded Defaults (As requested for stability)
const DEFAULT_URL = "https://dsjqmccdejlvnqpaflff.supabase.co";
const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzanFtY2NkZWpsdm5xcGFmbGZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMjgyNDEsImV4cCI6MjA4NjkwNDI0MX0.AqO_2LWqrohPvgAH2qniO0oWJ59u5HqRppH-eW1qtFA";

// Priority: ENV > LOCAL STORAGE > DEFAULT
const supabaseUrl = ENV_URL || LOCAL_URL || DEFAULT_URL;
const supabaseAnonKey = ENV_KEY || LOCAL_KEY || DEFAULT_KEY;

export const isConfigured =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  supabaseUrl.startsWith('http');

export const setSupabaseLocalConfig = (url: string, key: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('SUPABASE_URL', url);
    localStorage.setItem('SUPABASE_ANON_KEY', key);
  }
};

export const clearSupabaseLocalConfig = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('SUPABASE_URL');
    localStorage.removeItem('SUPABASE_ANON_KEY');
  }
};

export const getSupabaseConfig = () => ({
  url: supabaseUrl || null,
  hasKey: !!supabaseAnonKey,
  isConfigured,
  source: ENV_URL 
    ? 'env' 
    : LOCAL_URL 
      ? 'localStorage' 
      : 'default'
});

// Configuração robusta do cliente para evitar problemas de persistência
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined
      }
    })
  : null;

// Função para validar conexão básica (Ping)
export const checkSupabaseHealth = async () => {
  if (!isConfigured || !supabaseUrl || !supabaseAnonKey) {
    return { ok: false, message: "Configuração ausente." };
  }
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      headers: { 'apikey': supabaseAnonKey }
    });
    return { ok: res.ok, message: res.ok ? "Online" : `Status: ${res.status}` };
  } catch (error: any) {
    return { ok: false, message: error.message || "Erro de conexão" };
  }
};

// Função para limpar tokens inválidos e evitar loop de login
export const checkSessionHealth = async () => {
  if (!supabase) return;

  // Verifica se existe algum token salvo antes de validar
  const hasToken = Object.keys(localStorage).some(k => k.includes('auth-token') || k.includes('sb-'));
  
  if (!hasToken) return; // Se não tem token, não precisa validar sessão (é guest)

  const { data, error } = await supabase.auth.getSession();
  
  // Se houver erro ou sessão nula (mas tinha token), limpa tudo
  if (error || !data.session) {
    console.warn("Token de sessão inválido ou expirado detectado. Limpando armazenamento...");
    
    const tokenKey = Object.keys(localStorage).find(k => k.includes('auth-token') || k.includes('sb-'));
    if (tokenKey) {
      localStorage.removeItem(tokenKey);
    }
    
    // Recarrega para limpar estado da memória do SDK
    window.location.reload();
  }
};
