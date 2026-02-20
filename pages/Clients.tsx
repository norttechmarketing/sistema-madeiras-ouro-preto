
import React, { useState, useEffect } from 'react';
import { storage, uuid } from '../services/storage';
import { Client } from '../types';
import { Plus, Edit, Trash2, Search, MapPin, Phone, X } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import PrimaryButton from '../components/ui/PrimaryButton';

const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [cep, setCep] = useState('');

  // Form State
  const [formData, setFormData] = useState<Partial<Client>>({
    type: 'PF',
    name: '',
    document: '',
    phone: '',
    email: '',
    address: '',
    internalNotes: ''
  });

  const fetchClients = async () => {
    try {
      const data = await storage.getClients();
      setClients(data);
    } catch (error) {
      console.error("Failed to load clients:", error);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let updatedClients;

      if (editingClient) {
        updatedClients = clients.map(c =>
          c.id === editingClient.id ? { ...c, ...formData } as Client : c
        );
      } else {
        const newClient: Client = {
          ...(formData as Client),
          id: uuid()
        };
        updatedClients = [...clients, newClient];
      }

      setClients(updatedClients);
      await storage.saveClients(updatedClients);
      await fetchClients();
      closeModal();
    } catch (err: any) {
      console.error("Erro no salvamento:", err);
      alert(`Erro ao salvar cliente: ${err.message || 'Falha de comunicação'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
      try {
        await storage.deleteClient(id);
        setClients(prev => prev.filter(c => c.id !== id));
      } catch (err: any) {
        alert("Erro ao excluir. Verifique permissões ou se o cliente possui pedidos.");
      }
    }
  };

  const handleCepLookup = async () => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        alert("CEP não encontrado.");
        return;
      }

      setFormData(prev => ({
        ...prev,
        address: `${data.logradouro}${data.bairro ? `, ${data.bairro}` : ''}, ${data.localidade} - ${data.uf}`
      }));
    } catch (error) {
      console.error("CEP lookup failed:", error);
      alert("Erro ao buscar CEP.");
    }
  };

  const openModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData(client);
      setCep('');
    } else {
      setEditingClient(null);
      setFormData({ type: 'PF', name: '', document: '', phone: '', email: '', address: '', internalNotes: '' });
      setCep('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.document.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <PageHeader title="Clientes" subtitle="Gerencie sua base de clientes." />
        <PrimaryButton onClick={() => openModal()}>
          <Plus size={20} /> Novo Cliente
        </PrimaryButton>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou CNPJ..."
              className="w-full pl-10 pr-4 py-2.5 border border-[#d9d7d8] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] transition-all font-medium text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-black tracking-widest">
              <tr>
                <th className="px-6 py-4">Nome / Razão Social</th>
                <th className="px-6 py-4">CPF / CNPJ</th>
                <th className="px-6 py-4">WhatsApp</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredClients.map(client => (
                <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{client.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-1 font-medium">
                      <MapPin size={12} /> {client.address}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium text-sm">{client.document}</td>
                  <td className="px-6 py-4 text-slate-600">
                    <div className="flex flex-col text-sm">
                      <div className="flex items-center gap-2 group">
                        <span className="flex items-center gap-1 font-semibold"><Phone size={12} /> {client.phone}</span>
                        {client.phone && (
                          <button
                            onClick={() => {
                              const cleanNumber = client.phone.replace(/\D/g, '');
                              const finalNumber = cleanNumber.length <= 11 && !cleanNumber.startsWith('55') ? `55${cleanNumber}` : cleanNumber;
                              const message = encodeURIComponent("Olá! Tudo bem?");
                              window.open(`https://wa.me/${finalNumber}?text=${message}`, '_blank');
                            }}
                            className="bg-green-500 text-white p-1 rounded-lg hover:bg-green-600 transition-colors shadow-sm"
                            title="Conversar no WhatsApp"
                          >
                            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .004 5.411.001 12.045c0 2.121.554 4.191 1.606 6.035L0 24l6.105-1.602a11.832 11.832 0 005.937 1.598h.005c6.637 0 12.048-5.411 12.051-12.046a11.824 11.824 0 00-3.417-8.461z" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 font-medium">{client.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openModal(client)} className="text-slate-400 hover:text-slate-900 p-2 rounded-xl hover:bg-slate-100 transition-all">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDelete(client.id)} className="text-slate-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-all">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400 font-medium">Nenhum cliente encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto !p-0 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</h3>
                {!editingClient && <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Preencha as informações do cliente.</p>}
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-900 p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 ml-1">Tipo</label>
                  <select
                    className="w-full p-2.5 border border-[#d9d7d8] rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] outline-none"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'PF' | 'PJ' })}
                  >
                    <option value="PF">Pessoa Física</option>
                    <option value="PJ">Pessoa Jurídica</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 ml-1">CPF / CNPJ</label>
                  <input
                    type="text"
                    required
                    className="w-full p-2.5 border border-[#d9d7d8] rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] outline-none"
                    value={formData.document}
                    onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 ml-1">Nome Completo / Razão Social</label>
                <input
                  type="text"
                  required
                  className="w-full p-2.5 border border-[#d9d7d8] rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] outline-none"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 ml-1">WhatsApp</label>
                  <input
                    type="text"
                    required
                    className="w-full p-2.5 border border-[#d9d7d8] rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] outline-none"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 ml-1">CEP</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="00000-000"
                      className="flex-1 p-2.5 border border-[#d9d7d8] rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] outline-none"
                      value={cep}
                      onChange={(e) => setCep(e.target.value)}
                      onBlur={handleCepLookup}
                    />
                    <button
                      type="button"
                      onClick={handleCepLookup}
                      className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors uppercase tracking-widest"
                    >
                      Buscar
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 ml-1">Endereço Completo</label>
                <input
                  type="text"
                  placeholder="Rua, número, bairro, cidade - UF"
                  className="w-full p-2.5 border border-[#d9d7d8] rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] outline-none"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 ml-1">Observações</label>
                <textarea
                  className="w-full p-3 border border-[#d9d7d8] rounded-xl h-24 text-sm font-medium focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] outline-none resize-none"
                  value={formData.internalNotes}
                  onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                  placeholder="Informações adicionais sobre o cliente..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-6 py-2.5 text-slate-500 hover:bg-slate-50 rounded-xl font-bold text-sm transition-all uppercase tracking-widest">Cancelar</button>
                <PrimaryButton
                  type="submit"
                  disabled={isSaving}
                  className="px-8"
                >
                  {isSaving ? 'Salvando...' : 'Confirmar Cadastro'}
                </PrimaryButton>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Clients;
