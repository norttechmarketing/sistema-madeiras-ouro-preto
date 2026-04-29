
import React, { useState, useEffect, useCallback } from 'react';
import {
  Download, Printer, Filter, TrendingUp, Target,
  Zap, ChevronDown, CheckCircle2, AlertCircle,
  FileText, Users, Package, ShoppingCart, Search
} from 'lucide-react';
import { storage } from '../services/storage';
import { getAnalyticsData, AnalyticsFilters } from '../services/analytics';
import { User, Seller } from '../types';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import PrimaryButton from '../components/ui/PrimaryButton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { format } from 'date-fns';

const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'geral' | 'vendedores' | 'produtos' | 'clientes'>('geral');
  const [data, setData] = useState<any>(null);
  const [vendedores, setVendedores] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<AnalyticsFilters>({
    period: '30',
    sellerId: 'all',
    type: 'Todos'
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // For general tab, we always look at 12 months for trends, unless specifically filtered
      const analyticsFilters = filters;
      const [analytics, users] = await Promise.all([
        getAnalyticsData(analyticsFilters),
        storage.getSellers()
      ]);
      setData(analytics);
      setVendedores(users);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filters, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === id
        ? 'border-[#02904b] text-[#02904b] bg-[#02904b]/5'
        : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
        }`}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <PageHeader title="Relatórios" subtitle="Informações estratégicas para tomada de decisão." />
        <div className="flex items-center gap-3 no-print">
          <PrimaryButton onClick={() => window.print()}>
            <Printer size={16} /> Exportar PDF
          </PrimaryButton>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-wrap no-print">
        <TabButton id="geral" label="Visão Geral" icon={TrendingUp} />
        <TabButton id="vendedores" label="Vendedores" icon={Users} />
        <TabButton id="produtos" label="Produtos" icon={Package} />
        <TabButton id="clientes" label="Clientes" icon={Target} />
      </div>

      {/* Filters Area */}
      <Card className="flex flex-wrap items-center gap-6 shadow-sm border-slate-100 no-print">
        <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest shrink-0">
          <Filter size={14} /> Filtros:
        </div>
        <div className="relative">
          <select
            className="appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 pr-8 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-slate-900/5 transition-all cursor-pointer"
            value={filters.period}
            onChange={e => setFilters({ ...filters, period: e.target.value as any })}
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="month">Selecionar mês</option>
            <option value="day">Dia Específico</option>
            <option value="custom">Período Personalizado</option>
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {filters.period === 'month' && (
          <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-300">
            <input
              type="month"
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
              value={filters.specificDate ? format(filters.specificDate, 'yyyy-MM') : format(new Date(), 'yyyy-MM')}
              onChange={e => {
                const [year, month] = e.target.value.split('-');
                const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                setFilters({ ...filters, specificDate: date });
              }}
            />
          </div>
        )}

        {filters.period === 'day' && (
          <input
            type="date"
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
            value={filters.specificDate ? filters.specificDate.toISOString().split('T')[0] : ''}
            onChange={e => {
              const [y, m, d] = e.target.value.split('-').map(Number);
              setFilters({ ...filters, specificDate: new Date(y, m - 1, d) });
            }}
          />
        )}

        {filters.period === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
              value={filters.startDate ? filters.startDate.toISOString().split('T')[0] : ''}
              onChange={e => {
                const [y, m, d] = e.target.value.split('-').map(Number);
                setFilters({ ...filters, startDate: new Date(y, m - 1, d) });
              }}
            />
            <span className="text-slate-400 text-[10px] font-black uppercase">até</span>
            <input
              type="date"
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
              value={filters.endDate ? filters.endDate.toISOString().split('T')[0] : ''}
              onChange={e => {
                const [y, m, d] = e.target.value.split('-').map(Number);
                setFilters({ ...filters, endDate: new Date(y, m - 1, d) });
              }}
            />
          </div>
        )}

        {activeTab !== 'vendedores' && (
          <div className="relative">
            <select
              className="appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 pr-8 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-slate-900/5 transition-all cursor-pointer"
              value={filters.sellerId}
              onChange={e => setFilters({ ...filters, sellerId: e.target.value })}
            >
              <option value="all">Todos os Vendedores</option>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}
      </Card>

      {/* Content Area */}
      {isLoading ? (
        <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Carregando dados estratégicos...</div>
      ) : (
        <div className="space-y-8">

          {/* TAB: VISÃO GERAL */}
          {activeTab === 'geral' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {/* ITEM 5: VENDAS POR DIA - AGORA NO TOPO */}
              <Card>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Vendas por Dia:</h4>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.salesByDay}>
                      <defs>
                        <linearGradient id="colorDay" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#02904b" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#02904b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" fontSize={10} fontWeight="bold" stroke="#94a3b8" axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} fontWeight="bold" stroke="#94a3b8" axisLine={false} tickLine={false} tickFormatter={(v: number) => `R$ ${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(v: any) => [`R$ ${v.toLocaleString('pt-BR')}`, 'Vendas']}
                      />
                      <Area type="monotone" dataKey="value" stroke="#02904b" fillOpacity={1} fill="url(#colorDay)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Faturamento Mensal (Últimos 12 Meses):</h4>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data?.monthlyVendas}>
                        <defs>
                          <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#02904b" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#02904b" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="month" fontSize={10} fontWeight="bold" stroke="#94a3b8" axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} fontWeight="bold" stroke="#94a3b8" axisLine={false} tickLine={false} tickFormatter={(v: number) => `R$ ${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          formatter={(v: any) => [`R$ ${v.toLocaleString('pt-BR')}`, 'Faturamento']}
                        />
                        <Area type="monotone" dataKey="vendas" stroke="#02904b" fillOpacity={1} fill="url(#colorVendas)" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Volume Mensal: Pedidos vs Orçamentos:</h4>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.monthlyVendas}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="month" fontSize={10} fontWeight="bold" stroke="#94a3b8" axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} fontWeight="bold" stroke="#94a3b8" axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Legend iconType="circle" />
                        <Bar dataKey="pedidos" fill="#02904b" radius={[4, 4, 0, 0]} name="Pedidos" />
                        <Bar dataKey="orcamentos" fill="#d9d7d8" radius={[4, 4, 0, 0]} name="Orçamentos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* ITEM 4: TICKET MÉDIO (NUMERIC) */}
                <Card className="lg:col-span-2">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Ticket Médio Mensal (Pedidos):</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {data?.monthlyVendas.slice(-6).map((m: any, i: number) => (
                      <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.month}</p>
                        <p className="text-sm font-bold text-slate-900 truncate">R$ {m.ticket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB: VENDEDORES */}
          {activeTab === 'vendedores' && (
            <Card className="animate-in fade-in duration-300 !p-0 overflow-hidden">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left min-w-[800px]">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-5">Vendedor:</th>
                      <th className="px-8 py-5">Faturamento (Pedidos):</th>
                      <th className="px-8 py-5 text-center">Nº Pedidos:</th>
                      <th className="px-8 py-5 text-center">Nº Orçamentos:</th>
                      <th className="px-8 py-5 text-center">Taxa de Conversão:</th>
                      <th className="px-8 py-5 text-right">Ticket Médio:</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data?.sellerReport.map((s: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">{s.name.charAt(0)}</div>
                            <span className="font-bold text-slate-900 text-sm">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 font-black text-slate-900 text-sm">R$ {s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-8 py-6 text-center font-bold text-slate-500">{s.pedidos}</td>
                        <td className="px-8 py-6 text-center font-bold text-slate-500">{s.orcamentos}</td>
                        <td className="px-8 py-6 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${s.conversion > 30 ? 'bg-green-50 text-green-600 border-green-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                            {s.conversion.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right font-bold text-slate-600 text-sm">R$ {s.ticket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* TAB: PRODUTOS */}
          {activeTab === 'produtos' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 !p-0 overflow-hidden">
                  <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Desempenho por Produto:</h4>
                  </div>
                  <div className="max-h-[600px] overflow-y-auto no-scrollbar">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10">
                        <tr>
                          <th className="px-8 py-4">Nome do Produto:</th>
                          <th className="px-8 py-4 text-center">Qtd. Vendida:</th>
                          <th className="px-8 py-4 text-right">Faturamento Total:</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {data?.topProducts.map((p: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-4 font-bold text-slate-700 text-xs">{p.name}</td>
                            <td className="px-8 py-4 text-center text-xs font-medium text-slate-500">{p.quantity}</td>
                            <td className="px-8 py-4 text-right font-black text-slate-900 text-xs text-sm">R$ {p.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
                <Card>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Curva de Relevância (Top 10):</h4>
                  <div className="space-y-6">
                    {data?.topProducts.slice(0, 10).map((p: any, i: number) => (
                      <div key={i}>
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-tight text-slate-500 mb-1.5">
                          <span className="truncate max-w-[150px]">{p.name}</span>
                          <span>{((p.total / (data.kpis.totalSold || 1)) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden p-[1px] border border-slate-50">
                          <div
                            className="h-full bg-[#02904b] rounded-full transition-all duration-1000"
                            style={{ width: `${(p.total / (data.topProducts[0]?.total || 1)) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB: CLIENTES */}
          {activeTab === 'clientes' && (
            <Card className="animate-in fade-in duration-300 !p-0 overflow-hidden">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-5">Cliente:</th>
                      <th className="px-8 py-5 text-center">Nº Pedidos:</th>
                      <th className="px-8 py-5 text-center">Ticket Médio:</th>
                      <th className="px-8 py-5 text-right">Volume Total Vendido:</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data?.topClients.map((c: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6 font-bold text-slate-900 text-sm">{c.name}</td>
                        <td className="px-8 py-6 text-center text-slate-500 font-bold">{c.pedidos}</td>
                        <td className="px-8 py-6 text-center text-slate-500 font-bold text-sm">R$ {c.ticket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-8 py-6 text-right font-black text-[#02904b] text-sm">R$ {c.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}



        </div>
      )}
    </div>
  );
};

export default Reports;
