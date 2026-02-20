
import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { User } from '../types';
import { Plus, Trash2, UserPlus, Shield, Mail, X, Check, Lock, User as UserIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import PrimaryButton from '../components/ui/PrimaryButton';

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'sales' as 'admin' | 'sales'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await storage.getUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (user: User, newRole: 'admin' | 'sales') => {
    if (user.role === newRole) return;
    if (!window.confirm(`Deseja alterar o perfil de ${user.name} para ${newRole}?`)) return;

    try {
      await storage.updateUserRole(user.id, newRole);
      setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    } catch (err: any) {
      alert(`Erro ao atualizar: ${err.message}`);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      alert('Usuário criado com sucesso! Ele já pode acesser com o e-mail e senha definidos.');
      setIsModalOpen(false);
      setFormData({ name: '', email: '', password: '', role: 'sales' });
      loadUsers();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Equipe de Vendas" subtitle="Gerenciamento de acessos e permissões para consultores." />
        <PrimaryButton
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto"
        >
          <UserPlus size={18} /> Adicionar Usuário
        </PrimaryButton>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-8 py-4">Colaborador</th>
                <th className="px-8 py-4">E-mail</th>
                <th className="px-8 py-4">Perfil de Acesso</th>
                <th className="px-8 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <p className="font-bold text-slate-900 text-sm tracking-tight">{u.name || 'Sem nome'}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">ID: {u.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                      <Mail size={14} className="text-slate-400" /> {u.email}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRoleChange(u, 'sales')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${u.role === 'sales' ? 'bg-[#9b2b29] text-white border-[#9b2b29] shadow-sm' : 'bg-white text-slate-400 border-[#d9d7d8] hover:border-slate-300'}`}
                      >
                        Vendedor
                      </button>
                      <button
                        onClick={() => handleRoleChange(u, 'admin')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${u.role === 'admin' ? 'bg-[#9b2b29] text-white border-[#9b2b29] shadow-sm' : 'bg-white text-slate-400 border-[#d9d7d8] hover:border-slate-300'}`}
                      >
                        Admin
                      </button>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest border border-green-100">
                      <Check size={12} /> Ativo
                    </span>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400 font-medium">Nenhum usuário encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Criar Usuário */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 !p-0">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Novo Colaborador</h3>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Cadastro de acesso</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 p-2 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-8 space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" size={18} />
                  <input
                    type="text"
                    required
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-slate-900/5 outline-none font-semibold text-sm transition-all"
                    placeholder="Ex: João da Silva"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail de Acesso</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" size={18} />
                  <input
                    type="email"
                    required
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-slate-900/5 outline-none font-semibold text-sm transition-all"
                    placeholder="vendedor@ouro-preto.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha Temporária</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" size={18} />
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-slate-900/5 outline-none font-semibold text-sm transition-all"
                    placeholder="No mínimo 6 caracteres"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Perfil de Acesso</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'sales' })}
                    className={`py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${formData.role === 'sales' ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-300'}`}
                  >
                    Vendedor
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'admin' })}
                    className={`py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${formData.role === 'admin' ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-300'}`}
                  >
                    Admin
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
                >
                  Cancelar
                </button>
                <PrimaryButton
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] py-3"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>Confirmar Criação</>
                  )}
                </PrimaryButton>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
