
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { storage } from '../services/storage';
import { Order } from '../types';
import { Search, Plus, Eye, Calendar, User as UserIcon, Trash2, AlertTriangle, X, CheckCircle } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import PrimaryButton from '../components/ui/PrimaryButton';

const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'Todos' | 'Pedido' | 'Orçamento'>('Todos');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    const ordersData = await storage.getOrders();
    const sorted = ordersData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setOrders(sorted);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await storage.deleteOrder(deletingId);
      setOrders(prev => prev.filter(o => o.id !== deletingId));
      setDeletingId(null);
    } catch (error: any) {
      console.error("Delete failed:", error);
      alert(`Erro ao excluir: ${error.message}`);
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch =
      o.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.id.includes(searchTerm) ||
      (o.sellerName && o.sellerName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'Todos' || o.type === typeFilter;

    return matchesSearch && matchesType;
  });

  const StatusBadge = ({ status }: { status: string }) => {
    const colors: any = {
      'Rascunho': 'bg-slate-100 text-slate-500',
      'Enviado': 'bg-blue-50 text-blue-600 border-blue-100',
      'Aprovado': 'bg-green-50 text-green-600 border-green-100',
      'Recusado': 'bg-red-50 text-red-600 border-red-100',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${colors[status] || colors['Rascunho']}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Histórico de Pedidos / Orçamentos" subtitle="Gestão central de orçamentos e pedidos." />
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <Link to="/orders/new?type=Orçamento">
            <button className="bg-slate-100 text-slate-900 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2">
              <Plus size={18} /> Orçamento
            </button>
          </Link>
          <Link to="/orders/new?type=Pedido">
            <PrimaryButton className="px-5 py-2.5">
              <CheckCircle size={18} /> Novo Pedido
            </PrimaryButton>
          </Link>
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative group flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" size={20} />
              <input
                type="text"
                placeholder="Buscar por cliente, vendedor ou número..."
                className="w-full pl-12 pr-4 py-2.5 bg-white border border-[#d9d7d8] rounded-xl focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] outline-none font-semibold text-sm transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtro:</span>
              <select
                className="bg-white border border-[#d9d7d8] rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] transition-all"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
              >
                <option value="Todos">Todos</option>
                <option value="Pedido">Pedidos</option>
                <option value="Orçamento">Orçamentos</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">ID / Data</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Atendimento</th>
                <th className="px-6 py-4">Status / Tipo</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="font-bold text-sm text-slate-900 tracking-tight">#{order.id.slice(-6).toUpperCase()}</div>
                    <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-1 uppercase tracking-widest">
                      <Calendar size={12} /> {new Date(order.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="font-bold text-slate-900 text-sm max-w-[200px] truncate">{order.clientName}</div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-tight">
                      <UserIcon size={14} className="text-slate-300" />
                      {order.sellerName || '—'}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col items-start gap-1.5">
                      <StatusBadge status={order.status} />
                      <span className="text-[8px] text-slate-300 font-black uppercase tracking-widest ml-1">{order.type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 font-bold text-slate-900 text-sm">
                    R$ {order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-5 text-right font-black uppercase tracking-widest text-[10px]">
                    <div className="flex justify-end gap-2">
                      <Link to={`/orders/${order.id}`} className="text-slate-400 hover:text-slate-900 p-2 rounded-xl hover:bg-slate-100 transition-all">
                        <Eye size={18} />
                      </Link>
                      <button
                        onClick={() => setDeletingId(order.id)}
                        className="text-slate-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">Nenhum pedido / orçamento encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 !p-0">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Excluir Documento?</h3>
              <p className="text-sm text-slate-500 font-medium mt-2 leading-relaxed">
                Você está prestes a apagar o registro <span className="text-slate-900 font-black">#{deletingId.slice(-6).toUpperCase()}</span>. Esta ação não poderá ser revertida.
              </p>
            </div>
            <div className="flex border-t border-slate-100">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 border-r border-slate-100 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-6 py-5 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-all"
              >
                Sim, Excluir
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default OrderList;
