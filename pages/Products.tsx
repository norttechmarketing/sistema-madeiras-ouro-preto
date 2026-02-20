
import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { Product, ProductUnit } from '../types';
import { Plus, Edit, Trash2, Search, Tag, X } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import PrimaryButton from '../components/ui/PrimaryButton';

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    code: '',
    category: '',
    price: 0,
    price_bruto: 0,
    price_benef: 0,
    unit: 'un',
    cost: 0
  });

  const fetchProducts = async () => {
    try {
      const data = await storage.getProducts();
      setProducts(data);
    } catch (error) {
      console.error("Failed to load products:", error);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let updatedProducts;

      const payload = {
        ...formData,
        price: Number(formData.price),
        price_bruto: Number(formData.price_bruto),
        price_benef: Number(formData.price_benef),
        cost: Number(formData.cost || 0)
      };

      if (editingProduct) {
        updatedProducts = products.map(p =>
          p.id === editingProduct.id ? { ...p, ...payload } as Product : p
        );
      } else {
        const newProduct: Product = {
          ...(payload as Product),
          id: crypto.randomUUID()
        };
        updatedProducts = [...products, newProduct];
      }

      setProducts(updatedProducts);
      await storage.saveProducts(updatedProducts);
      await fetchProducts();

      closeModal();
    } catch (err: any) {
      alert(`Erro ao salvar produto: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      try {
        await storage.deleteProduct(id);
        setProducts(prev => prev.filter(p => p.id !== id));
      } catch (err: any) {
        alert("Erro ao excluir. Verifique se o produto está em algum pedido.");
      }
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({ name: '', code: '', category: '', price: 0, price_bruto: 0, price_benef: 0, unit: 'un', cost: 0 });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const unitLabels: Record<string, string> = {
    'm2': 'm²',
    'm3': 'm³',
    'm': 'm',
    'un': 'un',
    'ML': 'ML',
    'Pç': 'Pç',
    'Kg': 'Kg',
    'JG': 'JG'
  };

  const categories = ['Todas', ...new Set(products.map(p => p.category))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Produtos" subtitle="Gestão completa dos produtos." />
        <PrimaryButton onClick={() => openModal()} className="w-full sm:w-auto">
          <Plus size={18} /> Novo Produto
        </PrimaryButton>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4">
          <div className="relative group flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Buscar por nome ou código..."
              className="w-full pl-12 pr-4 py-2.5 bg-white border border-[#d9d7d8] rounded-xl focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] outline-none font-medium transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-64">
            <select
              className="w-full p-2.5 bg-white border border-[#d9d7d8] rounded-xl font-bold text-[10px] uppercase tracking-widest outline-none focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] transition-all"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Código</th>
                <th className="px-6 py-4">Produto</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4">Preço</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProducts.map(prod => (
                <tr key={prod.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5 text-sm text-slate-400 font-bold tracking-wider uppercase">{prod.code}</td>
                  <td className="px-6 py-5 font-semibold text-slate-900 text-sm">{prod.name}</td>
                  <td className="px-6 py-5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-100">
                      <Tag size={10} /> {prod.category}
                    </span>
                  </td>
                  <td className="px-6 py-5 font-bold text-slate-900 text-sm">
                    {formatCurrency(prod.price)} <span className="text-[10px] font-bold text-slate-400">/ {unitLabels[prod.unit] || prod.unit}</span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openModal(prod)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDelete(prod.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-16 text-center text-slate-400 font-medium">Nenhum produto encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 !p-0">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Dados do Catálogo</p>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-slate-200 rounded-xl transition-all text-slate-400 hover:text-slate-900 transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código</label>
                  <input
                    type="text" required
                    className="w-full p-3 border border-[#d9d7d8] rounded-xl text-sm font-semibold focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] outline-none uppercase transition-all"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                  <input
                    type="text" list="categories"
                    className="w-full p-3 border border-[#d9d7d8] rounded-xl text-sm font-semibold focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] outline-none transition-all"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                  <datalist id="categories">
                    <option value="Madeira Bruta" /><option value="Madeira Nobre" /><option value="Chapas" /><option value="Serviços" />
                  </datalist>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Produto</label>
                <input
                  type="text" required
                  className="w-full p-3 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-4 focus:ring-slate-900/5 outline-none transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preço Bruto</label>
                  <input
                    type="number" step="0.01" min="0" required
                    className="w-full p-3 border border-[#d9d7d8] rounded-xl text-sm font-semibold focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] outline-none transition-all"
                    value={formData.price_bruto}
                    onChange={(e) => setFormData({ ...formData, price_bruto: parseFloat(e.target.value), price: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preço Beneficiado</label>
                  <input
                    type="number" step="0.01" min="0" required
                    className="w-full p-3 border border-[#d9d7d8] rounded-xl text-sm font-semibold focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] outline-none transition-all"
                    value={formData.price_benef}
                    onChange={(e) => setFormData({ ...formData, price_benef: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unidade</label>
                  <select
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-4 focus:ring-slate-900/5 outline-none transition-all appearance-none bg-white"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value as ProductUnit })}
                  >
                    <option value="un">unidade (un)</option>
                    <option value="m">metro (m)</option>
                    <option value="m2">m²</option>
                    <option value="m3">m³</option>
                    <option value="ML">metro linear (ML)</option>
                    <option value="Pç">peça (Pç)</option>
                    <option value="Kg">quilograma (Kg)</option>
                    <option value="JG">jogo (JG)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Custo (Opcional)</label>
                  <input
                    type="number" step="0.01" min="0"
                    className="w-full p-3 border border-[#d9d7d8] rounded-xl text-sm font-semibold focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] outline-none transition-all"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all">Cancelar</button>
                <PrimaryButton
                  type="submit"
                  disabled={isSaving}
                  className="px-8"
                >
                  {isSaving ? 'Salvando...' : 'Confirmar e Salvar'}
                </PrimaryButton>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Products;
