
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AuditLog } from '../types';
import { Clock, Search, Filter, Eye, X, Calendar, Database, User as UserIcon } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';

const AuditHistory: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [filters, setFilters] = useState({
        period: '7',
        table: 'all',
        action: 'all'
    });

    const loadLogs = async () => {
        setIsLoading(true);
        if (!supabase) return;
        try {
            let query = supabase
                .from('audit_log')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (filters.period !== 'all') {
                const days = parseInt(filters.period);
                const date = new Date();
                date.setDate(date.getDate() - days);
                query = query.gte('created_at', date.toISOString());
            }

            if (filters.table !== 'all') {
                query = query.eq('table_name', filters.table);
            }

            if (filters.action !== 'all') {
                query = query.eq('action', filters.action);
            }

            const { data, error } = await query;
            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error("Erro ao carregar histórico:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();
    }, [filters]);

    const formatDate = (iso: string) => {
        return new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(new Date(iso));
    };

    const getActionBadge = (action: string) => {
        const colors: any = {
            'INSERT': 'bg-green-50 text-green-600 border-green-100',
            'UPDATE': 'bg-blue-50 text-blue-600 border-blue-100',
            'DELETE': 'bg-red-50 text-red-600 border-red-100'
        };
        return (
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${colors[action] || 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                {action}
            </span>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <PageHeader title="Histórico de Alterações" subtitle="Acompanhe todas as modificações no sistema." />

            <Card className="!p-0 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Período:</span>
                        <select
                            className="bg-white border border-[#d9d7d8] rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] transition-all"
                            value={filters.period}
                            onChange={(e) => setFilters({ ...filters, period: e.target.value })}
                        >
                            <option value="1">Hoje</option>
                            <option value="7">Últimos 7 dias</option>
                            <option value="30">Últimos 30 dias</option>
                            <option value="all">Todo histórico</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tabela:</span>
                        <select
                            className="bg-white border border-[#d9d7d8] rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] transition-all"
                            value={filters.table}
                            onChange={(e) => setFilters({ ...filters, table: e.target.value })}
                        >
                            <option value="all">Todas</option>
                            <option value="clients">Clientes</option>
                            <option value="products">Produtos</option>
                            <option value="orders">Pedidos/Orçamentos</option>
                            <option value="profiles">Vendedores (Perfis)</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ação:</span>
                        <select
                            className="bg-white border border-[#d9d7d8] rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] transition-all"
                            value={filters.action}
                            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                        >
                            <option value="all">Todas</option>
                            <option value="INSERT">Inserção</option>
                            <option value="UPDATE">Alteração</option>
                            <option value="DELETE">Exclusão</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Data / Hora</th>
                                <th className="px-6 py-4">Tabela</th>
                                <th className="px-6 py-4">Ação</th>
                                <th className="px-6 py-4">Usuário</th>
                                <th className="px-6 py-4">Registro</th>
                                <th className="px-6 py-4 text-right">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr><td colSpan={6} className="p-10 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Carregando...</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={6} className="p-10 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhuma alteração encontrada.</td></tr>
                            ) : logs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 text-xs font-bold text-slate-600">{formatDate(log.created_at)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-tight text-slate-500">
                                            <Database size={12} className="text-slate-300" />
                                            {log.table_name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{getActionBadge(log.action)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                            <UserIcon size={12} className="text-slate-300" />
                                            {log.user_email || 'Sistema / Anon'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <code className="text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 uppercase">
                                            #{log.record_id?.slice(-6) || '---'}
                                        </code>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => setSelectedLog(log)}
                                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Details Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <Card className="w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-300 !p-0 max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Detalhes da Alteração</h3>
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">
                                    {selectedLog.table_name} • {selectedLog.action} • {formatDate(selectedLog.created_at)}
                                </p>
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-slate-200 rounded-xl transition-all text-slate-400 hover:text-slate-900"><X size={24} /></button>
                        </div>

                        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/30">
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dados Anteriores (OLD)</h4>
                                <pre className="bg-white border border-slate-200 p-4 rounded-2xl text-[10px] font-mono text-slate-600 overflow-x-auto whitespace-pre-wrap">
                                    {selectedLog.old_data ? JSON.stringify(selectedLog.old_data, null, 2) : 'Nenhum dado (INSERT)'}
                                </pre>
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Novos Dados (NEW)</h4>
                                <pre className="bg-white border border-slate-200 p-4 rounded-2xl text-[10px] font-mono text-slate-600 overflow-x-auto whitespace-pre-wrap">
                                    {selectedLog.new_data ? JSON.stringify(selectedLog.new_data, null, 2) : 'Excluído (DELETE)'}
                                </pre>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
                            >
                                Fechar Detalhes
                            </button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default AuditHistory;
