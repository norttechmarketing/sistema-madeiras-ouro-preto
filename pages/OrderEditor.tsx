
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { storage, uuid } from '../services/storage';
import { Client, Product, Order, OrderItem, User, ProductUnit, Seller } from '../types';
import { COMPANY_INFO } from '../constants';
import { generateOrderPDF } from '../services/pdfGenerator';
import {
  Search, Plus, Trash2, Save, Send, Printer, FileText, ArrowLeft,
  CheckCircle, XCircle, Users, User as UserIcon, ChevronDown
} from 'lucide-react';
import Card from '../components/ui/Card';
import PrimaryButton from '../components/ui/PrimaryButton';

function ceilToHalf(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value * 2) / 2;
}

const OrderEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const typeParam = searchParams.get('type') as 'Orçamento' | 'Pedido' | null;

  // Data State
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [vendedores, setVendedores] = useState<Seller[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Editor State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<'Orçamento' | 'Pedido'>(typeParam === 'Pedido' ? 'Pedido' : 'Orçamento');
  const [orderStatus, setOrderStatus] = useState<'Rascunho' | 'Enviado' | 'Aprovado' | 'Recusado'>('Rascunho');
  const [internalNotes, setInternalNotes] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [createdAt, setCreatedAt] = useState(new Date().toISOString());

  // UI State
  const [clientSearch, setClientSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showClientList, setShowClientList] = useState(false);

  // New Item State
  const [newItem, setNewItem] = useState<{
    productId: string;
    description: string;
    quantity: number;
    price: number;
    unit: ProductUnit | string;
    comprimento: number;
    largura: number;
    isBeneficiado: boolean;
  }>({
    productId: '',
    description: '',
    quantity: 1,
    price: 0,
    unit: 'un',
    comprimento: 0,
    largura: 0,
    isBeneficiado: false
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientsData, productsData, ordersData, sellersData] = await Promise.all([
          storage.getClients(),
          storage.getProducts(),
          storage.getOrders(),
          storage.getSellers(true)
        ]);

        setClients(clientsData);
        setProducts(productsData);
        setVendedores(sellersData);
        setAllOrders(ordersData);

        if (id && id !== 'new') {
          const existing = ordersData.find(o => o.id === id);
          if (existing) {
            setOrderType(existing.type);
            setOrderStatus(existing.status);
            setOrderItems(existing.items || []);
            setInternalNotes(existing.internalNotes || '');
            setCustomerNotes(existing.customerNotes || '');
            setCreatedAt(existing.createdAt);
            setSelectedSellerId(existing.sellerId || '');

            const client = clientsData.find(c => c.id === existing.clientId);
            if (client) setSelectedClient(client);
          }
        } else {
          const currentUser = await storage.getCurrentUser();
          if (currentUser) setSelectedSellerId(currentUser.id);

          if (typeParam === 'Orçamento' || typeParam === 'Pedido') {
            setOrderType(typeParam);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
        alert("Erro ao carregar dados. Verifique sua conexão.");
      }
    };
    fetchData();
  }, [id]);

  const getItemBaseTotal = (item: Partial<OrderItem>) => {
    const qty = item.quantity || 0;
    const unitPrice = item.unitPrice || 0;
    const comp = item.comprimento || 0;
    const larg = item.largura || 0;
    const unit = item.unit;

    // Arredondar para cálculo (múltiplos de 0,50)
    const compCalc = ceilToHalf(comp);
    const largCalc = ceilToHalf(larg / 100);

    if (unit === 'ML') {
      return qty * compCalc * unitPrice;
    } else if (unit === 'm2') {
      if (larg > 0) {
        return qty * compCalc * largCalc * unitPrice;
      }
      return qty * unitPrice;
    } else {
      return qty * unitPrice;
    }
  };

  const subtotal = orderItems.reduce((acc, item) => acc + getItemBaseTotal(item), 0);
  const totalDiscount = orderItems.reduce((acc, item) => {
    const itemSub = getItemBaseTotal(item);
    const discount = item.discountType === 'percentage'
      ? itemSub * (item.discountValue / 100)
      : item.discountValue;
    return acc + discount;
  }, 0);
  const total = subtotal - totalDiscount;

  const addItem = () => {
    if (!newItem.description) return;

    if (newItem.unit === 'ML' && !newItem.comprimento) {
      alert('Comprimento é obrigatório para produtos em ML.');
      return;
    }

    const baseItem: Partial<OrderItem> = {
      productId: newItem.productId || undefined,
      description: newItem.description,
      quantity: newItem.quantity,
      unitPrice: newItem.price,
      unit: newItem.unit,
      comprimento: newItem.comprimento || undefined,
      largura: newItem.largura || undefined,
      isBeneficiado: newItem.isBeneficiado,
      discountType: 'fixed',
      discountValue: 0,
    };

    const item: OrderItem = {
      ...baseItem,
      id: uuid(),
      total: getItemBaseTotal(baseItem)
    } as OrderItem;

    setOrderItems([...orderItems, item]);
    setNewItem({
      productId: '',
      description: '',
      quantity: 1,
      price: 0,
      unit: 'un',
      comprimento: 0,
      largura: 0,
      isBeneficiado: false
    });
    setProductSearch('');
  };

  const updateItem = (id: string, field: keyof OrderItem, value: any) => {
    setOrderItems(items => items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };

      let discount = 0;
      const sub = getItemBaseTotal(updated);
      if (updated.discountType === 'percentage') {
        discount = sub * (updated.discountValue / 100);
      } else {
        discount = updated.discountValue;
      }
      updated.total = Math.max(0, sub - discount);

      return updated;
    }));
  };

  const removeItem = (id: string) => {
    setOrderItems(items => items.filter(i => i.id !== id));
  };

  const handleProductSelect = (prod: Product) => {
    setNewItem({
      ...newItem,
      productId: prod.id,
      description: prod.name,
      quantity: 1,
      price: newItem.isBeneficiado ? prod.price_benef : prod.price_bruto,
      unit: prod.unit || 'un'
    });
    setProductSearch(prod.name);
  };

  const saveOrder = async (silent = false) => {
    if (!selectedClient) {
      alert('Selecione um cliente primeiro.');
      return null;
    }

    if (isSaving) return null;
    setIsSaving(true);

    const seller = vendedores.find(v => v.id === selectedSellerId);

    const orderData: Order = {
      id: id === 'new' ? uuid() : id!,
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      sellerId: seller?.id,
      sellerName: seller?.name,
      date: createdAt,
      status: orderStatus,
      type: orderType,
      items: orderItems,
      subtotal,
      totalDiscount,
      total,
      internalNotes,
      customerNotes,
      createdAt
    };

    try {
      let newOrders = [...allOrders];
      if (id === 'new') {
        newOrders.push(orderData);
      } else {
        newOrders = newOrders.map(o => o.id === id ? orderData : o);
      }

      await storage.saveOrders(newOrders);
      setAllOrders(newOrders);

      if (!silent) {
        alert('Salvo com sucesso!');
        if (id === 'new') navigate(`/orders/${orderData.id}`);
      }
      return orderData;
    } catch (error: any) {
      console.error("Failed to save order:", error);
      alert(`Erro ao salvar: ${error.message || 'Falha de comunicação'}`);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleWhatsApp = async () => {
    const order = await saveOrder(true);
    if (!order) return;

    const itemsList = order.items.map(i =>
      `${i.quantity} ${i.unit} - ${i.description} (R$ ${i.total.toFixed(2)})`
    ).join('\n');

    const msg = `Olá! Segue seu orçamento da Madeiras Ouro Preto:
Cliente: ${order.clientName}
Itens:
${itemsList}

Total: R$ ${order.total.toFixed(2)}
Posso te ajudar em mais algo?`;

    window.open(`https://wa.me/${COMPANY_INFO.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleDeleteOrder = async () => {
    if (!id || id === 'new') return;
    if (window.confirm('Deseja realmente excluir este documento permanentemente?')) {
      try {
        setIsSaving(true);
        await storage.deleteOrder(id);
        alert('Documento excluído com sucesso.');
        navigate('/orders');
      } catch (error: any) {
        alert(`Erro ao excluir: ${error.message}`);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handlePrint = async () => {
    const order = await saveOrder(true);
    if (order) {
      let clientObj = selectedClient;
      if (!clientObj && order.clientId) {
        const allClients = await storage.getClients();
        clientObj = allClients.find(c => c.id === order.clientId) || null;
      }
      await generateOrderPDF(order, true, clientObj || undefined);
    }
  };

  const unitLabels: Record<string, string> = {
    'm2': 'm²', 'm3': 'm³', 'm': 'm', 'un': 'un', 'ML': 'ML', 'Pç': 'Pç', 'Kg': 'Kg', 'JG': 'JG'
  };

  return (
    <div className="pb-32 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/orders')} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900 shrink-0">
            <ArrowLeft size={24} />
          </button>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
              {id === 'new' ? `Novo ${orderType}` : `${orderType} #${id?.slice(-6).toUpperCase()}`}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${orderType === 'Pedido' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                }`}>
                {orderType}
              </span>
              <div className="relative inline-block">
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value as any)}
                  className="text-[9px] appearance-none bg-slate-50 border border-slate-100 rounded-full px-4 py-0.5 pr-8 font-black uppercase tracking-widest text-slate-400 focus:ring-4 focus:ring-slate-900/5 cursor-pointer outline-none transition-all"
                >
                  <option value="Rascunho">Rascunho</option>
                  <option value="Enviado">Enviado</option>
                  <option value="Aprovado">Aprovado</option>
                  <option value="Recusado">Recusado</option>
                </select>
                <ChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
          {id && id !== 'new' && (
            <button
              onClick={handleDeleteOrder}
              disabled={isSaving}
              className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
              title="Excluir Documento"
            >
              <Trash2 size={20} />
            </button>
          )}
          {orderType === 'Orçamento' && id !== 'new' && (
            <PrimaryButton
              onClick={() => { setOrderType('Pedido'); setOrderStatus('Rascunho'); }}
              className="!bg-[#9b2b29]"
            >
              <CheckCircle size={16} /> <span className="whitespace-nowrap">Converter em Pedido</span>
            </PrimaryButton>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Users size={16} className="text-slate-400" /> Dados do Cliente
            </h3>

            {selectedClient ? (
              <div className="bg-slate-50 p-4 rounded-xl relative group border border-slate-100">
                <button onClick={() => setSelectedClient(null)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 p-1 transition-colors">
                  <XCircle size={18} />
                </button>
                <p className="font-bold text-slate-900 text-sm">{selectedClient.name}</p>
                <p className="text-[10px] text-slate-500 font-medium mt-2 leading-relaxed">{selectedClient.address}</p>
              </div>
            ) : (
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-[#d9d7d8] rounded-xl focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] outline-none font-bold text-sm transition-all"
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setShowClientList(true);
                  }}
                  onFocus={() => setShowClientList(true)}
                />
                {showClientList && clientSearch && (
                  <div className="absolute z-20 w-full bg-white shadow-2xl rounded-2xl mt-2 border border-slate-100 max-h-60 overflow-y-auto p-1">
                    {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                      <div
                        key={c.id}
                        className="p-3 hover:bg-slate-50 cursor-pointer rounded-xl transition-colors"
                        onClick={() => {
                          setSelectedClient(c);
                          setShowClientList(false);
                          setClientSearch('');
                        }}
                      >
                        <p className="font-bold text-sm text-slate-900 break-words">{c.name}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">{c.document}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <UserIcon size={16} className="text-slate-400" /> Informações Adicionais
            </h3>
            <div className="space-y-5">
              <div className="space-y-1.5 text-center sm:text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vendedor Responsável</label>
                <div className="relative">
                  <select
                    className="w-full appearance-none p-2.5 bg-slate-50 border border-[#d9d7d8] rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] transition-all"
                    value={selectedSellerId}
                    onChange={(e) => setSelectedSellerId(e.target.value)}
                  >
                    <option value="">Selecionar</option>
                    {vendedores.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações no PDF</label>
                <textarea
                  className="w-full p-3.5 bg-slate-50 border border-[#d9d7d8] rounded-xl text-sm h-32 resize-none outline-none focus:ring-4 focus:ring-[#9b2b29]/5 focus:border-[#9b2b29] font-medium transition-all"
                  value={customerNotes}
                  onChange={e => setCustomerNotes(e.target.value)}
                  placeholder="Ex: Entrega inclusa, prazo de 5 dias úteis..."
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="!p-0 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">Itens do Documento</h3>
              <div className="bg-slate-50/50 p-4 rounded-2xl flex flex-wrap items-end gap-3 border border-slate-100">
                <div className="flex-1 min-w-[280px] relative group space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Produto</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full h-[48px] pl-4 pr-10 py-2.5 bg-white border border-[#d9d7d8] rounded-xl text-[17px] font-bold outline-none focus:ring-2 focus:ring-[#9b2b29] focus:border-[#9b2b29] focus:bg-white transition-all"
                      placeholder="Buscar catálogo..."
                      value={productSearch || newItem.description}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setNewItem({ ...newItem, description: e.target.value, productId: '' });
                      }}
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" size={16} />
                  </div>
                  {productSearch && !newItem.productId && products.some(p => p.name.toLowerCase().includes(productSearch.toLowerCase())) && (
                    <div className="absolute top-full left-0 w-full bg-white shadow-2xl rounded-2xl mt-2 z-30 max-h-48 overflow-y-auto border border-slate-200 p-1">
                      {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                        <div
                          key={p.id}
                          className="p-3 hover:bg-slate-50 cursor-pointer text-sm rounded-xl flex justify-between items-center transition-colors"
                          onClick={() => handleProductSelect(p)}
                        >
                          <span className="font-bold text-slate-800">{p.name} <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">({unitLabels[p.unit] || p.unit})</span></span>
                          <span className="text-slate-900 font-black text-xs">R$ {(newItem.isBeneficiado ? p.price_benef : p.price_bruto).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="w-[140px] space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Qtd</label>
                  <input
                    type="number"
                    className="w-full h-[48px] p-3 bg-white border border-[#d9d7d8] rounded-xl text-[17px] font-bold outline-none focus:ring-2 focus:ring-[#9b2b29] focus:border-[#9b2b29] focus:bg-white transition-all text-right"
                    placeholder="0,00"
                    step={newItem.unit === 'un' ? '1' : '0.01'}
                    min="0.01"
                    value={newItem.quantity}
                    onChange={e => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) })}
                  />
                </div>

                {(newItem.unit === 'ML' || newItem.unit === 'm2') && (
                  <div className="w-[140px] space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Comp.</label>
                    <input
                      type="number"
                      className="w-full h-[48px] p-3 bg-white border border-[#d9d7d8] rounded-xl text-[17px] font-bold outline-none focus:ring-2 focus:ring-[#9b2b29] focus:border-[#9b2b29] focus:bg-white transition-all text-right"
                      placeholder="0,00"
                      step="0.01"
                      min="0.01"
                      value={newItem.comprimento}
                      onChange={e => setNewItem({ ...newItem, comprimento: parseFloat(e.target.value) })}
                    />
                  </div>
                )}

                {newItem.unit === 'm2' && (
                  <div className="w-[140px] space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Larg.(cm)</label>
                    <input
                      type="number"
                      className="w-full h-[48px] p-3 bg-white border border-[#d9d7d8] rounded-xl text-[17px] font-bold outline-none focus:ring-2 focus:ring-[#9b2b29] focus:border-[#9b2b29] focus:bg-white transition-all text-right"
                      placeholder="0,00"
                      step="0.01"
                      min="0"
                      value={newItem.largura}
                      onChange={e => setNewItem({ ...newItem, largura: parseFloat(e.target.value) })}
                    />
                  </div>
                )}

                <div className="w-[90px] space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block text-center">Benef.</label>
                  <div className="flex justify-center items-center h-[48px] bg-white border border-[#d9d7d8] rounded-xl">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-gray-300 text-[#9b2b29] focus:ring-[#9b2b29] cursor-pointer"
                      checked={newItem.isBeneficiado}
                      onChange={e => {
                        const isChecked = e.target.checked;
                        const prod = products.find(p => p.id === newItem.productId);
                        setNewItem({
                          ...newItem,
                          isBeneficiado: isChecked,
                          price: prod ? (isChecked ? prod.price_benef : prod.price_bruto) : newItem.price
                        });
                      }}
                    />
                  </div>
                </div>

                <div className="w-[160px] space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Preço Unit.</label>
                  <div className="w-full h-[48px] p-3 bg-slate-100 border border-slate-200 rounded-xl text-[17px] font-black text-slate-600 flex items-center justify-end">
                    R$ {newItem.price.toFixed(2)}
                  </div>
                </div>

                <div className="w-[60px]">
                  <PrimaryButton
                    onClick={addItem}
                    className="w-full h-[48px] flex items-center justify-center"
                  >
                    <Plus size={20} />
                  </PrimaryButton>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[1100px]">
                <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Código</th>
                    <th className="px-6 py-4 min-w-[150px]">Descrição</th>
                    <th className="px-4 py-4 w-[140px] min-w-[140px]">QTD</th>
                    <th className="px-4 py-4 w-[140px] min-w-[140px]">Comp.</th>
                    <th className="px-4 py-4 w-[140px] min-w-[140px]">Larg.</th>
                    <th className="px-4 py-4 w-20">Benef.</th>
                    <th className="px-4 py-4 w-20">Unid.</th>
                    <th className="px-4 py-4 w-[140px] min-w-[140px]">VL. Unit</th>
                    <th className="px-4 py-4 w-[140px] min-w-[140px]">Desconto</th>
                    <th className="px-6 py-4 w-[140px] min-w-[140px] text-right">Subtotal</th>
                    <th className="px-6 py-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {orderItems.map((item) => {
                    const prod = products.find(p => p.id === item.productId);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-400">{prod?.code || '—'}</td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 text-sm break-words">{item.description}</p>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            className="w-full h-[48px] p-3 bg-slate-50 border border-slate-100 rounded-xl text-[17px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-[#9b2b29] transition-all text-right"
                            step={item.unit === 'un' ? '1' : '0.01'}
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value))}
                          />
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600">
                          {item.unit === 'ML' || item.unit === 'm2' ? (
                            <input
                              type="number"
                              className="w-full h-[48px] p-3 bg-slate-50 border border-slate-100 rounded-xl text-[17px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-[#9b2b29] transition-all text-right"
                              step="0.01"
                              value={item.comprimento || 0}
                              onChange={(e) => updateItem(item.id, 'comprimento', parseFloat(e.target.value))}
                            />
                          ) : '—'}
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600">
                          {item.unit === 'm2' ? (
                            <input
                              type="number"
                              className="w-full h-[48px] p-3 bg-slate-50 border border-slate-100 rounded-xl text-[17px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-[#9b2b29] transition-all text-right"
                              step="0.01"
                              value={item.largura || 0}
                              onChange={(e) => updateItem(item.id, 'largura', parseFloat(e.target.value))}
                            />
                          ) : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center items-center">
                            <input
                              type="checkbox"
                              className="w-6 h-6 rounded border-gray-300 text-[#9b2b29] focus:ring-[#9b2b29]"
                              checked={item.isBeneficiado}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                const currentProd = products.find(p => p.id === item.productId);
                                const newPrice = currentProd ? (isChecked ? currentProd.price_benef : currentProd.price_bruto) : item.unitPrice;

                                setOrderItems(items => items.map(it => {
                                  if (it.id !== item.id) return it;
                                  const updated = { ...it, isBeneficiado: isChecked, unitPrice: newPrice };
                                  const sub = getItemBaseTotal(updated);
                                  let discount = 0;
                                  if (updated.discountType === 'percentage') {
                                    discount = sub * (updated.discountValue / 100);
                                  } else {
                                    discount = updated.discountValue;
                                  }
                                  updated.total = Math.max(0, sub - discount);
                                  return updated;
                                }));
                              }}
                            />
                            {item.isBeneficiado && <span className="ml-1 text-[8px] font-black uppercase text-amber-600 tracking-tighter">Benef.</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[10px] font-black text-slate-400">{unitLabels[item.unit] || item.unit || '—'}</td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            className="w-full h-[48px] p-3 bg-slate-100 border border-slate-100 rounded-xl text-[17px] font-bold text-slate-500 outline-none text-right"
                            value={item.unitPrice}
                            readOnly
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              className="w-full h-[48px] p-3 bg-slate-50 border border-slate-100 rounded-xl text-[17px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-[#9b2b29] transition-all text-right"
                              value={item.discountValue}
                              onChange={(e) => updateItem(item.id, 'discountValue', parseFloat(e.target.value))}
                            />
                            <button
                              onClick={() => updateItem(item.id, 'discountType', item.discountType === 'percentage' ? 'fixed' : 'percentage')}
                              className="text-[10px] font-black text-slate-900 min-w-[20px] hover:scale-125 transition-transform"
                            >
                              {item.discountType === 'percentage' ? '%' : '$'}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900 text-sm tabular-nums">
                          R$ {item.total.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {orderItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">Aguardando itens...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-8 bg-slate-50/50 border-t border-slate-100">
              <div className="flex flex-col items-end gap-2">
                <div className="flex justify-between w-full max-w-[280px] text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <span>Subtotal:</span>
                  <span className="text-slate-600">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between w-full max-w-[280px] text-[10px] font-black text-red-500 uppercase tracking-widest">
                  <span>Descontos:</span>
                  <span>- R$ {totalDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between w-full max-w-[280px] text-3xl font-bold text-slate-900 mt-4 pt-4 border-t-2 border-dashed border-slate-200 tabular-nums">
                  <span className="text-[10px] font-black uppercase self-center tracking-widest text-slate-400">Total:</span>
                  <span>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 p-4 sm:p-6 shadow-[0_-10px_30px_rgba(15,23,42,0.06)] z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="hidden sm:block text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">
            OURO PRETO • SISTEMA DE GESTÃO
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => saveOrder()}
              disabled={isSaving}
              className="flex-1 sm:flex-none min-w-[110px] bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-600 rounded-full animate-spin"></div> : <Save size={18} />}
              <span>{isSaving ? 'Salvar...' : 'Salvar'}</span>
            </button>
            <button
              onClick={handleWhatsApp}
              disabled={isSaving}
              className="flex-1 sm:flex-none min-w-[130px] bg-green-500 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-green-600 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-green-100 disabled:opacity-50"
            >
              <Send size={18} /> <span>WhatsApp</span>
            </button>
            <PrimaryButton
              onClick={handlePrint}
              disabled={isSaving}
              className="flex-1 sm:flex-none min-w-[150px] shadow-lg shadow-slate-900/20"
            >
              <Printer size={18} /> <span>Exportar {orderType}</span>
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderEditor;
