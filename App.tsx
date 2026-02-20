
import React, { useState, useEffect, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Products from './pages/Products';
import OrderEditor from './pages/OrderEditor';
import OrderList from './pages/OrderList';
import Reports from './pages/Reports';
import AdminUsers from './pages/AdminUsers';
import Sellers from './pages/Sellers';
import AuditHistory from './pages/AuditHistory';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { User } from './types';
import {
  supabase,
  isConfigured,
  getSupabaseConfig,
  setSupabaseLocalConfig,
  clearSupabaseLocalConfig,
  checkSessionHealth
} from './lib/supabase';
import { AlertCircle, Save, Trash2, Database } from 'lucide-react';

const clearSupabaseAuthToken = () => {
  try {
    const keys = Object.keys(localStorage || {});
    const tokenKey = keys.find(k => k.includes('-auth-token'));
    if (tokenKey) localStorage.removeItem(tokenKey);
  } catch { }
};

const withTimeout = async <T,>(promise: Promise<T>, ms = 6000): Promise<T> => {
  let t: any;
  const timeout = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(t);
  }
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // States for Manual Config Form
  const [manualUrl, setManualUrl] = useState('');
  const [manualKey, setManualKey] = useState('');

  // Helper for safe environment access
  const isDev = (() => {
    try {
      // @ts-ignore
      return import.meta.env?.DEV;
    } catch { return false; }
  })();

  // Auth Listener Effect
  useEffect(() => {
    let mounted = true;

    // Safety check: If supabase is not configured/null, stop loading immediately
    if (!isConfigured || !supabase) {
      if (mounted) setIsAuthLoading(false);
      return;
    }

    // 1. Check active session immediately
    const checkSession = async () => {
      if (mounted) setIsAuthLoading(true);

      try {
        if (!supabase) throw new Error("Supabase not initialized");

        // CLEANUP: Check for stale/invalid tokens before trying to use them
        try {
          await withTimeout(checkSessionHealth(), 4000);
        } catch (e) {
          console.warn("Pre-check health timeout or error:", e);
        }

        const { data: { session }, error } = await withTimeout(supabase.auth.getSession(), 6000);

        if (isDev) {
          console.log("[AUTH] getSession done", { hasSession: !!session, error });
        }

        if (error) {
          console.error("Session error:", error);
          // Don't throw here, just treat as not logged in to prevent white screen
        }

        if (session?.user) {
          await withTimeout(fetchProfile(session.user), 6000);
        } else {
          // FALLBACK: Check for Mock User in LocalStorage (Prototype Mode)
          const mockUserJson = localStorage.getItem('mop_mock_user');
          if (mockUserJson) {
            if (mounted) setUser(JSON.parse(mockUserJson));
          } else {
            if (mounted) setUser(null);
          }
        }
      } catch (error) {
        console.error("Unexpected session check error (Resetting):", error);
        clearSupabaseAuthToken();
        try { await supabase.auth.signOut(); } catch { }
        if (mounted) setUser(null);
      } finally {
        // ALWAYS finish loading to prevent infinite spinner
        if (mounted) setIsAuthLoading(false);
      }
    };

    checkSession();

    // 2. Listen for changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (isDev) {
        console.log(`[AUTH] Event: ${event}`, { hasSession: !!session });
      }

      if (session?.user) {
        if (!user || user.id !== session.user.id) {
          await withTimeout(fetchProfile(session.user), 6000).catch(console.error);
        }
      } else {
        const mockUser = localStorage.getItem('mop_mock_user');
        if (!mockUser) {
          setUser(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (sessionUser: any) => {
    if (!supabase) return;

    try {
      const query = supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .single();

      const { data: profile, error } = await withTimeout(query, 6000);

      if (error || !profile) {
        console.log("Profile not found or error, creating new profile for:", sessionUser.email);

        const newProfile = {
          id: sessionUser.id,
          name: sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'Novo Usuário',
          email: sessionUser.email || '',
          role: 'sales'
        };

        const { error: insertError } = await supabase
          .from('profiles')
          .insert([newProfile]);

        if (insertError) {
          console.error("Failed to create profile:", insertError);
          setUser({
            id: sessionUser.id,
            name: newProfile.name,
            email: newProfile.email,
            role: 'sales'
          });
        } else {
          setUser({
            id: sessionUser.id,
            name: newProfile.name,
            email: newProfile.email,
            role: 'sales'
          });
        }
        return;
      }

      setUser({
        id: sessionUser.id,
        name: profile.name,
        email: profile.email || sessionUser.email || '',
        role: profile.role
      });

    } catch (err) {
      console.error("Unexpected error fetching profile:", err);
      setUser({
        id: sessionUser.id,
        name: sessionUser.email?.split('@')[0] || 'Usuário',
        email: sessionUser.email || '',
        role: 'sales'
      });
    }
  };

  const handleLogout = async () => {
    try {
      if (supabase) await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      localStorage.removeItem('mop_mock_user');
      setUser(null);
    }
  };

  const handleManualConfigSave = () => {
    if (manualUrl && manualKey) {
      setSupabaseLocalConfig(manualUrl, manualKey);
      window.location.reload();
    } else {
      alert("Preencha a URL e a Chave.");
    }
  };

  const handleClearConfig = () => {
    clearSupabaseLocalConfig();
    window.location.reload();
  };

  // --- CONFIGURAÇÃO AUSENTE / SETUP ---
  if (!isConfigured) {
    const config = getSupabaseConfig();
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-500">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Database size={32} />
          </div>
          <h1 className="text-xl font-black text-gray-900 mb-2 tracking-tight">Setup de Conexão</h1>
          <p className="text-gray-500 text-xs mb-6 font-medium">
            Insira as credenciais do Supabase manualmente.
          </p>

          <div className="space-y-4 mb-6 text-left">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Project URL</label>
              <input
                type="text"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="https://xyz.supabase.co"
                value={manualUrl}
                onChange={e => setManualUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Anon Key</label>
              <input
                type="password"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="eyJhbGciOiJIUzI1Ni..."
                value={manualKey}
                onChange={e => setManualKey(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-gray-100 p-4 rounded-xl text-left text-[10px] font-mono text-gray-600 mb-6 overflow-hidden border border-gray-200">
            <p className="mb-1"><strong>Status:</strong> <span className="text-red-500">Desconectado</span></p>
            <p className="mb-1"><strong>Fonte:</strong> {config.source}</p>
            <p className="truncate"><strong>URL Atual:</strong> {config.url || '(vazio)'}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleManualConfigSave}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
            >
              <Save size={14} /> Salvar
            </button>
            <button
              onClick={handleClearConfig}
              className="px-4 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold hover:bg-red-50 hover:text-red-500 transition-all"
              title="Limpar Configuração"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-red/20 border-t-brand-red rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">Carregando Sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-brand-red/20 border-t-brand-red rounded-full animate-spin"></div>
      </div>}>
        <HashRouter>
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
            <Route path="/cadastro" element={<Register />} />

            <Route path="/*" element={
              <ProtectedRoute user={user}>
                <Layout user={user} onLogout={handleLogout}>
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/sellers" element={<Sellers />} />
                    <Route path="/relatorios" element={<Reports />} />
                    <Route path="/audit" element={
                      <ProtectedRoute user={user} allowedRoles={['admin']}>
                        <AuditHistory />
                      </ProtectedRoute>
                    } />
                    <Route path="/orders" element={<OrderList />} />
                    <Route path="/orders/:id" element={<OrderEditor />} />

                    {/* Admin Only Route - Restricted */}
                    <Route path="/admin/usuarios" element={
                      <ProtectedRoute user={user} allowedRoles={['admin']}>
                        <AdminUsers />
                      </ProtectedRoute>
                    } />

                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </HashRouter>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
