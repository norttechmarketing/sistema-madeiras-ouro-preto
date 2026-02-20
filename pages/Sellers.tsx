
import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { Seller } from '../types';
import { User, Phone, Plus, Edit2, Trash2, X, CheckCircle, XCircle } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import PrimaryButton from '../components/ui/PrimaryButton';

const Sellers: React.FC = () => {
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSeller, setEditingSeller] = useState<Partial<Seller> | null>(null);

    const loadSellers = async () => {
        setIsLoading(true);
        const data = await storage.getSellers();
        setSellers(data);
        setIsLoading(false);
    };

    useEffect(() => {
        loadSellers();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSeller?.name) {
            alert("O nome é obrigatório.");
            return;
        }

        setIsSaving(true);
        try {
            await storage.saveSeller(editingSeller);
            setIsModalOpen(false);
            setEditingSeller(null);
            await loadSellers();
        } catch (error: any) {
            console.error("Save Error:", error);
            alert(error.message || "Erro ao salvar vendedor.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Deseja realmente excluir este vendedor?")) {
            try {
                await storage.deleteSeller(id);
                await loadSellers();
            } catch (error: any) {
                alert(error.message || "Erro ao excluir vendedor. Verifique se ele possui pedidos vinculados.");
            }
        }
    };

    const handleToggleStatus = async (seller: Seller) => {
        try {
            await storage.saveSeller({ ...seller, is_active: !seller.is_active });
            await loadSellers();
        } catch (error: any) {
            alert("Erro ao mudar status.");
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center text-center sm:text-left">
                <PageHeader title="Vendedores" subtitle="Gerencie sua equipe de vendas (vínculo simples)." />
                <PrimaryButton onClick={() => { setEditingSeller({ is_active: true }); setIsModalOpen(true); }}>
                    <Plus size={18} /> Novo Vendedor
                </PrimaryButton>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] p-8">Carregando...</p>
                ) : sellers.length === 0 ? (
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] p-8">Nenhum vendedor cadastrado.</p>
                ) : sellers.map(seller => (
                    <Card key={seller.id} className={`relative group hover:border-[#9b2b29] transition-all ${!seller.is_active ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl ${seller.is_active ? 'bg-[#9b2b29]/5 text-[#9b2b29]' : 'bg-slate-100 text-slate-400'}`}>
                                    <User size={24} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-slate-900 truncate">{seller.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${seller.is_active ? 'bg-green-50 text-green-600 border-green-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                                            }`}>
                                            {seller.is_active ? 'Ativo' : 'Inativo'}
                                        </span>
                                        {seller.whatsapp && (
                                            <p className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                                                <Phone size={10} /> {seller.whatsapp}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-50 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => handleToggleStatus(seller)}
                                title={seller.is_active ? "Desativar" : "Ativar"}
                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
                            >
                                {seller.is_active ? <XCircle size={16} /> : <CheckCircle size={16} />}
                            </button>
                            <button
                                onClick={() => { setEditingSeller(seller); setIsModalOpen(true); }}
                                className="p-2 text-slate-400 hover:text-[#9b2b29] hover:bg-slate-50 rounded-lg transition-all"
                            >
                                <Edit2 size={16} />
                            </button>
                            <button
                                onClick={() => handleDelete(seller.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </Card>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300 !p-0 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xl font-bold text-slate-900">{editingSeller?.id ? 'Editar Vendedor' : 'Novo Vendedor'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-8 space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo (Obrigatório)</label>
                                <input
                                    type="text" required
                                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] outline-none font-bold text-sm transition-all"
                                    value={editingSeller?.name || ''}
                                    onChange={e => setEditingSeller({ ...editingSeller, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone / WhatsApp (Opcional)</label>
                                <input
                                    type="text"
                                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] outline-none font-bold text-sm transition-all"
                                    value={editingSeller?.whatsapp || ''}
                                    onChange={e => setEditingSeller({ ...editingSeller, whatsapp: e.target.value })}
                                />
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-900">Vendedor Ativo</p>
                                    <p className="text-[10px] text-slate-400 font-medium">Pode ser selecionado em novos pedidos.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={editingSeller?.is_active || false}
                                        onChange={e => setEditingSeller({ ...editingSeller, is_active: e.target.checked })}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#9b2b29]"></div>
                                </label>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); setEditingSeller(null); }}
                                    className="flex-1 px-6 py-3 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancelar
                                </button>
                                <PrimaryButton type="submit" disabled={isSaving} className="flex-1">
                                    {isSaving ? 'Salvando...' : editingSeller?.id ? 'Atualizar' : 'Cadastrar'}
                                </PrimaryButton>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default Sellers;
