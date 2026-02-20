
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, Users, Package, FileText, Menu, X, BarChart3, User as UserIcon, Clock } from 'lucide-react';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSidebarOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  if (!user) return <>{children}</>;

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
    const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
    return (
      <Link
        to={to}
        onClick={() => setIsSidebarOpen(false)}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 mb-1 active:scale-[0.98] ${isActive
          ? 'bg-[#9b2b29] text-white shadow-lg shadow-[#9b2b29]/10'
          : 'text-slate-500 hover:bg-slate-50 hover:text-[#9b2b29] font-medium'
          }`}
      >
        <Icon size={18} className="shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest truncate">{label}</span>
      </Link>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 overflow-x-hidden selection:bg-[#9b2b29]/10 selection:text-[#9b2b29]">
      {/* Mobile Topbar */}
      <div className="lg:hidden bg-white/80 backdrop-blur-md px-6 py-4 shadow-sm flex justify-between items-center sticky top-0 z-50 border-b border-[#d9d7d8]">
        <img src="https://nyltechsite.com.br/wp-content/uploads/2026/01/Logo.png" alt="Logo" style={{ height: '32px' }} />
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 -mr-1 text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div className="flex flex-1 relative min-h-0">
        {/* Sidebar Drawer */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-[60] w-64 bg-white flex flex-col
            transform transition-all duration-300 ease-in-out border-r border-[#d9d7d8]
            ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          <div className="p-8 hidden lg:block text-center">
            <img src="https://nyltechsite.com.br/wp-content/uploads/2026/01/Logo.png" alt="Logo" style={{ height: '80px', margin: 'auto' }} />
          </div>

          <div className="lg:hidden flex justify-between items-center p-8 border-b border-slate-50">
            <span className="font-black text-slate-900 text-[10px] uppercase tracking-widest">Menu Principal</span>
            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 p-2 hover:bg-slate-50 rounded-xl"><X size={18} /></button>
          </div>

          <nav className="p-6 flex-1 overflow-y-auto no-scrollbar space-y-1">
            <p className="px-4 text-[10px] font-black text-[#d9d7d8] uppercase tracking-widest mb-4 mt-2">Visão Geral</p>
            <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/orders" icon={FileText} label="Pedidos / Orç." />
            <NavItem to="/relatorios" icon={BarChart3} label="Relatórios" />

            <p className="px-4 text-[10px] font-black text-[#d9d7d8] uppercase tracking-widest mb-4 mt-8">Cadastros</p>
            <NavItem to="/clients" icon={Users} label="Clientes" />
            <NavItem to="/products" icon={Package} label="Produtos" />
            <NavItem to="/sellers" icon={UserIcon} label="Vendedores" />
            <NavItem to="/audit" icon={Clock} label="Histórico" />
          </nav>

          <div className="p-6">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-[#d9d7d8] group">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-[#9b2b29] text-white flex items-center justify-center font-bold text-sm">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-slate-900 truncate uppercase tracking-tight">{user.name}</p>
                <p className="text-[9px] text-[#9b2b29] uppercase font-black tracking-widest leading-none mt-1">{user.role}</p>
              </div>
              <button
                onClick={onLogout}
                className="text-slate-300 hover:text-[#9b2b29] p-2 hover:bg-white rounded-lg transition-all"
                title="Sair"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>

        {/* Backdrop for mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 lg:hidden transition-all duration-300"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 w-full min-w-0 flex flex-col max-w-full overflow-x-hidden">
          <div className="flex-1 p-6 sm:p-10 lg:p-12 max-w-[1440px] mx-auto w-full pb-32">
            {children}
          </div>

          <footer className="w-full bg-white border-t border-[#d9d7d8] py-10 px-8 text-center mt-auto">
            <div className="max-w-7xl mx-auto space-y-3">
              <p className="text-[#d9d7d8] text-[10px] font-black uppercase tracking-widest">
                Madeiras Ouro Preto &copy; 2026 – Todos os direitos reservados
              </p>
              <div className="text-slate-400 text-[9px] font-bold flex flex-wrap items-center justify-center gap-2 uppercase tracking-widest justify-center">
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
          </footer>
        </main>
      </div>
    </div>
  );
};

export default Layout;
