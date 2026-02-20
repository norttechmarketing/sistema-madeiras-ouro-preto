
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FilePlus, Users, Package, TrendingUp, Clock,
  BarChart3, ArrowRight, CheckCircle, Filter,
  DollarSign, ShoppingCart, FileText, ChevronDown
} from 'lucide-react';
import { storage } from '../services/storage';
import { getAnalyticsData, AnalyticsFilters } from '../services/analytics';
import { User } from '../types';
import PageHeader from '../components/ui/PageHeader';
import CardUI from '../components/ui/Card';
import PrimaryButton from '../components/ui/PrimaryButton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';

const COLORS = ['#9b2b29', '#d9d7d8', '#000000', '#475569', '#94a3b8'];

const Dashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [vendedores, setVendedores] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<AnalyticsFilters>({
    period: '30',
    sellerId: 'all',
    type: 'Todos'
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [analytics, sellersData] = await Promise.all([
        getAnalyticsData(filters),
        storage.getSellers()
      ]);
      setData(analytics);
      setVendedores(sellersData as any);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const KPICard = ({ title, value, icon: Icon, colorClass, subtitle }: any) => (
    <CardUI className="flex flex-col justify-between hover:translate-y-[-2px] transition-all duration-200 min-w-0">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${colorClass} shrink-0`}>
          <Icon size={22} />
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 truncate">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 truncate leading-none mb-1 tabular-nums">{value}</h3>
        {subtitle && <p className="text-[10px] text-slate-400 font-medium truncate">{subtitle}</p>}
      </div>
    </CardUI>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-full overflow-x-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <PageHeader title="Dashboard" subtitle="Sistema de Gestão de Pedidos." />

        {/* Quick Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 no-print">
          <div className="flex items-center gap-2 px-3 py-1.5 text-slate-400 text-[10px] font-black uppercase tracking-widest border-r border-slate-100">
            <Filter size={14} /> Filtros
          </div>

          <select
            className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer px-2"
            value={filters.period}
            onChange={e => setFilters({ ...filters, period: e.target.value as any })}
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="day">Dia Específico</option>
          </select>

          {filters.period === 'day' && (
            <input
              type="date"
              className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer px-2 border-l border-slate-100"
              value={filters.specificDate ? filters.specificDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
              onChange={e => setFilters({ ...filters, specificDate: new Date(e.target.value) })}
            />
          )}

          <select
            className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer px-2 border-l border-slate-100"
            value={filters.sellerId}
            onChange={e => setFilters({ ...filters, sellerId: e.target.value })}
          >
            <option value="all">Todos Vendedores</option>
            {vendedores.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </div>

      {/* Quick Actions - Novo Orçamento e Novo Pedido */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 no-print">
        <Link to="/orders/new?type=Orçamento" className="bg-[#9b2b29] hover:bg-[#852523] transition-all rounded-2xl p-8 shadow-md text-white flex flex-col items-center justify-center group cursor-pointer active:scale-[0.98] border border-transparent overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-150 transition-transform duration-500">
            <FilePlus size={120} />
          </div>

          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10">
            <FilePlus size={32} />
          </div>
          <h3 className="text-xl font-bold whitespace-nowrap relative z-10">Novo Orçamento</h3>
          <p className="text-xs opacity-70 mt-1 flex items-center gap-1 font-medium italic relative z-10">Orçamento Rápido. <ArrowRight size={12} /></p>
        </Link>

        <Link to="/orders/new?type=Pedido" className="bg-[#9b2b29] hover:bg-[#852523] transition-all rounded-2xl p-8 shadow-md text-white flex flex-col items-center justify-center group cursor-pointer active:scale-[0.98] border border-transparent overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-150 transition-transform duration-500">
            <CheckCircle size={120} />
          </div>

          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10">
            <CheckCircle size={32} />
          </div>
          <h3 className="text-xl font-bold whitespace-nowrap relative z-10">Novo Pedido</h3>
          <p className="text-xs opacity-70 mt-1 flex items-center gap-1 font-medium italic relative z-10">Pedido Rápido. <ArrowRight size={12} /></p>
        </Link>
      </div>

      {/* Shortcuts grid - Base de Clientes e Curva de Produtos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 no-print">
        <Link to="/clients" className="group">
          <CardUI className="hover:border-[#9b2b29] transition-all group overflow-hidden relative active:scale-[0.98]">
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-4 bg-slate-50 rounded-xl group-hover:bg-[#9b2b29] group-hover:text-white transition-all">
                <Users size={32} />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#9b2b29] transition-colors truncate">Gestão de Clientes</h3>
                <p className="text-sm text-slate-500 truncate">Gerencie sua base de clientes.</p>
              </div>
            </div>
          </CardUI>
        </Link>

        <Link to="/products" className="group">
          <CardUI className="hover:border-[#9b2b29] transition-all group overflow-hidden relative active:scale-[0.98]">
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-4 bg-slate-50 rounded-xl group-hover:bg-[#9b2b29] group-hover:text-white transition-all">
                <Package size={32} />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#9b2b29] transition-colors truncate">Gestão de Produtos</h3>
                <p className="text-sm text-slate-500 truncate">Gestão completa dos produtos.</p>
              </div>
            </div>
          </CardUI>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Vendido:"
          value={isLoading ? "..." : `R$ ${data?.kpis.totalSold.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
          icon={DollarSign}
          colorClass="bg-green-50 text-green-600"
          subtitle="Somente pedidos."
        />
        <KPICard
          title="Pedidos:"
          value={isLoading ? "..." : data?.kpis.orderCount}
          icon={CheckCircle}
          colorClass="bg-[#9b2b29]/5 text-[#9b2b29]"
          subtitle="Quantidade no período."
        />
        <KPICard
          title="Orçamentos:"
          value={isLoading ? "..." : data?.kpis.quoteCount}
          icon={FileText}
          colorClass="bg-blue-50 text-blue-600"
          subtitle="Orçamentos gerados."
        />
        <KPICard
          title="Vendas do mês:"
          value={isLoading ? "..." : `R$ ${data?.kpis.vendasMes.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
          icon={ShoppingCart}
          colorClass="bg-orange-50 text-orange-600"
          subtitle="Mês atual."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CardUI className="min-h-[400px]">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Vendas:</h4>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.salesByDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" fontSize={10} fontWeight="bold" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis fontSize={10} fontWeight="bold" stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={(v: number) => `R$ ${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(v: any) => [`R$ ${v.toLocaleString('pt-BR')}`, 'Vendas']}
                />
                <Line type="monotone" dataKey="value" stroke="#9b2b29" strokeWidth={3} dot={{ r: 4, fill: '#9b2b29' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardUI>

        <CardUI className="min-h-[400px]">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Vendas por Vendedor:</h4>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.salesBySeller} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" fontSize={10} fontWeight="bold" stroke="#94a3b8" tickLine={false} axisLine={false} width={100} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(v: any) => [`R$ ${v.toLocaleString('pt-BR')}`, 'Faturamento']}
                />
                <Bar dataKey="value" fill="#9b2b29" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardUI>
      </div>
    </div>
  );
};

export default Dashboard;
