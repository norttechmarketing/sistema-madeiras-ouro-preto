import React, { useState, useEffect } from 'react';
import { Client, Product, Order, OrderItem, User, Seller, AuditLog } from '../types';
import { useNavigate } from 'react-router-dom';
import { supabase, checkSupabaseHealth, isConfigured, getSupabaseConfig } from '../lib/supabase';
import { LogIn, AlertCircle, WifiOff, Database } from 'lucide-react';
import PrimaryButton from '../components/ui/PrimaryButton';
import Card from '../components/ui/Card';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [detailedError, setDetailedError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Dev Diagnostics State
  const [devStatus, setDevStatus] = useState<{ status: string; url: string; key: boolean } | null>(null);

  // Safe access to DEV
  const isDev = (() => {
    try {
      // @ts-ignore
      return import.meta.env?.DEV;
    } catch { return false; }
  })();

  useEffect(() => {
    if (isDev) {
      const runDiagnostics = async () => {
        const config = getSupabaseConfig();
        const health = await checkSupabaseHealth();

        setDevStatus({
          status: health.ok ? 'Online' : `Falha: ${health.message}`,
          url: config.url ? new URL(config.url).host : 'N/A',
          key: config.hasKey
        });
      };
      runDiagnostics();
    }
  }, [isDev]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setDetailedError('');

    if (!isConfigured) {
      setError('Erro de Configuração');
      setDetailedError('As variáveis de ambiente do Supabase não foram carregadas.');
      setIsLoading(false);
      return;
    }

    try {
      if (!supabase) throw new Error("Serviço de autenticação não disponível.");
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          throw new Error('E-mail ou senha incorretos.');
        } else if (authError.message.includes('Email not confirmed')) {
          throw new Error('E-mail não confirmado. Verifique sua caixa de entrada.');
        }

        throw authError;
      }

      if (data.user) {
        if (!data.session) {
          throw new Error("Login realizado, mas a sessão não foi estabelecida.");
        }
        navigate('/dashboard');
      } else {
        throw new Error("Usuário não encontrado.");
      }

    } catch (err: any) {
      console.error("Login Error:", err);
      let userMessage = err.message || 'Erro ao realizar login.';
      let techMessage = '';

      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        userMessage = 'Falha de Conexão com o Servidor.';
        techMessage = 'Verifique sua conexão ou se o serviço está temporariamente indisponível.';
      }

      setError(userMessage);
      setDetailedError(techMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 selection:bg-[#9b2b29]/10 selection:text-[#9b2b29]">
      <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-500 relative">
        <Card className="!p-0 shadow-2xl overflow-hidden border-[#d9d7d8]">
          <div className="bg-[#9b2b29] p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
            <div className="relative">
              <img src="https://nyltechsite.com.br/wp-content/uploads/2026/01/Logo.png" alt="Logo" style={{ height: '130px', margin: 'auto', display: 'block', marginBottom: '20px' }} />
              <p className="text-white/60 text-[9px] font-black uppercase tracking-[0.2em]">Sistema de Gestão de Pedidos</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-10 space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-semibold border border-red-100 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 mb-1 uppercase tracking-widest text-[10px] font-black">
                  {error.includes('Conexão') ? <WifiOff size={14} /> : <AlertCircle size={14} />}
                  {error}
                </div>
                {detailedError && (
                  <p className="text-[10px] text-red-500 opacity-80 mt-1 pl-5 font-medium leading-relaxed uppercase tracking-wider">
                    {detailedError}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                <input
                  type="email" required
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-slate-900/5 focus:bg-white outline-none transition-all font-bold text-sm"
                  placeholder="contato@madeirasouropreto.com.br"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha</label>
                <input
                  type="password" required
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-slate-900/5 focus:bg-white outline-none transition-all font-bold text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            <PrimaryButton
              type="submit"
              disabled={isLoading}
              className="w-full py-4 text-xs font-black uppercase tracking-widest"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Entrar no Sistema <LogIn size={18} />
                </>
              )}
            </PrimaryButton>
          </form>

          <div className="bg-slate-50/50 p-6 border-t border-slate-100 text-center">
            <p className="text-slate-400 text-[9px] uppercase font-black tracking-[0.2em] leading-relaxed">
              Uso restrito e monitorado.
            </p>
          </div>
        </Card>

        {/* Footer for Login Page */}
        <div className="mt-8 text-center space-y-3">
          <p className="text-[#d9d7d8] text-[10px] font-black uppercase tracking-widest">
            Madeiras Ouro Preto &copy; 2026 – Todos os direitos reservados
          </p>
          <div className="text-slate-400 text-[9px] font-bold flex flex-wrap items-center justify-center gap-2 uppercase tracking-widest">
            <span>Desenvolvido com</span>
            <span className="heart-pulse text-blue-500 text-sm">💙</span>
            <span>por:</span>
            <a
              href="https://www.norttech.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 font-bold hover:text-[#9b2b29] transition-colors"
            >
              NortTech Marketing
            </a>
          </div>
        </div>

        {/* Box de Diagnóstico DEV */}
        {isDev && devStatus && (
          <div className="absolute -bottom-48 sm:fixed sm:bottom-6 sm:right-6 bg-slate-900/95 backdrop-blur-md text-slate-400 p-5 rounded-2xl text-[10px] font-mono shadow-2xl border border-white/10 z-50 w-full sm:w-72 animate-in slide-in-from-bottom-8 duration-500">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/10">
              <Database size={14} className="text-slate-300" />
              <span className="font-bold text-white uppercase tracking-widest text-[9px]">Sinal do Banco (Supabase)</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="uppercase tracking-widest opacity-60">Servidor:</span>
                <span className="text-white font-bold truncate max-w-[140px] px-2 py-0.5 bg-white/5 rounded-lg border border-white/5">{devStatus.url}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="uppercase tracking-widest opacity-60">Status:</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${devStatus.status === 'Online' ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]'}`}></div>
                  <span className={devStatus.status === 'Online' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{devStatus.status}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="uppercase tracking-widest opacity-60">ApiKey:</span>
                <span className={devStatus.key ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{devStatus.key ? 'Ativa' : 'Ausente'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
