
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { storage, uuid } from '../services/storage';
import { Client, Product, Order, OrderItem, User, ProductUnit, Seller } from '../types';
import { COMPANY_INFO } from '../constants';
import { generateOrderPDF } from '../services/pdfGenerator';
import {
  Search, Plus, Trash2, Save, Send, Printer, FileText, ArrowLeft,
  CheckCircle, XCircle, Users, User as UserIcon, ChevronDown, X
} from 'lucide-react';
import Card from '../components/ui/Card';
import PrimaryButton from '../components/ui/PrimaryButton';

function ceilToHalf(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value * 2) / 2;
}

function normalizeWidthForArea(unit: string | undefined, width: number): number {
  if (!Number.isFinite(width)) return 0;
  // Se unit for m2 e largura >= 3, assumir que é cm, arredondar para múltiplo de 5 e fazer /100
  if (unit === 'm2' || unit === 'm²') {
    if (width >= 3) {
      const roundedCm = Math.ceil(width / 5) * 5;
      return roundedCm / 100;
    }
    return width;
  }
  return width;
}

const formatProductDisplayName = (name: string, category?: string) => {
  if (!category) return name;
  const nameLower = name.toLowerCase();
  const catLower = category.toLowerCase();
  if (nameLower.includes(catLower)) return name;
  return `${name} - ${category}`;
};

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
  const [isExporting, setIsExporting] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isClientsModalOpen, setIsClientsModalOpen] = useState(false);

  // Editor State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<'Orçamento' | 'Pedido'>(typeParam === 'Pedido' ? 'Pedido' : 'Orçamento');
  const [orderStatus, setOrderStatus] = useState<'Rascunho' | 'Enviado' | 'Aprovado' | 'Recusado'>('Rascunho');
  const [internalNotes, setInternalNotes] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [otherPaymentMethod, setOtherPaymentMethod] = useState('');
  const [createdAt, setCreatedAt] = useState(new Date().toISOString());

  // UI State
  const [clientSearch, setClientSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showClientList, setShowClientList] = useState(false);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientData, setNewClientData] = useState<Partial<Client>>({ type: 'PF', name: '', document: '', phone: '', address: '' });

  // New Item State
  const [newItem, setNewItem] = useState<{
    productId: string;
    description: string;
    quantity: number | string;
    price: number | string;
    unit: ProductUnit | string;
    comprimento: number | string;
    largura: number | string;
    isBeneficiado: boolean;
    category: string;
  }>({
    productId: '',
    description: '',
    quantity: '',
    price: '',
    unit: 'un',
    comprimento: '',
    largura: '',
    isBeneficiado: false,
    category: ''
  });

  const [globalDiscountType, setGlobalDiscountType] = useState<'percent' | 'fixed'>('fixed');
  const [globalDiscountValue, setGlobalDiscountValue] = useState<number | string>('');
  const [shippingValue, setShippingValue] = useState<number | string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>('');


  // Funções de Carga de Dados
  const loadBaseData = async () => {
    if (clients.length > 0 && products.length > 0 && vendedores.length > 0) return;
    try {
      const [c, p, s] = await Promise.all([
        storage.getClients(),
        storage.getProducts(),
        storage.getSellers(true)
      ]);
      setClients(c);
      setProducts(p);
      setVendedores(s);
      return s; // Retorna os vendedores para uso imediato no init
    } catch (err) {
      console.error("Erro ao carregar dados base:", err);
      return [];
    }
  };

  const loadOrderData = async (orderId: string) => {
    try {
      const ordersData = await storage.getOrders();
      setAllOrders(ordersData);
      
      const existing = ordersData.find(o => o.id === orderId);
      if (existing) {
        setOrderType(existing.type);
        setOrderStatus(existing.status);
        setOrderItems(existing.items || []);
        setInternalNotes(existing.internalNotes || '');
        setCustomerNotes(existing.customerNotes || '');
        setPaymentMethod(existing.paymentMethod || '');
        setCreatedAt(existing.createdAt);
        setSelectedSellerId(existing.sellerId || '');
        setGlobalDiscountType(existing.globalDiscountType || 'fixed');
        setGlobalDiscountValue(existing.globalDiscountValue || '');
        setShippingValue(existing.shippingValue || '');
        setDeliveryDate(existing.deliveryDate || '');

        // Use o state local de clients se já tiver, senão busque
        let clientsList = clients;
        if (clientsList.length === 0) clientsList = await storage.getClients();
        
        const client = clientsList.find(c => c.id === existing.clientId);
        if (client) setSelectedClient(client);
      }
    } catch (err) {
      console.error("Erro ao carregar pedido:", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      const activeSellers = await loadBaseData();
      if (id && id !== 'new') {
        await loadOrderData(id);
      } else {
        const currentUser = await storage.getCurrentUser();
        if (currentUser && !selectedSellerId) {
          // Só auto-seleciona se o usuário for um vendedor válido
          const isSeller = (activeSellers || []).find((v: any) => v.id === currentUser.id);
          if (isSeller) {
            setSelectedSellerId(currentUser.id);
          }
        }
        if (typeParam === 'Orçamento' || typeParam === 'Pedido') setOrderType(typeParam);
      }
    };
    init();
  }, [id]);

  const getItemBaseTotal = (item: Partial<OrderItem>) => {
    const qty = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const comp = Number(item.comprimento || 0);
    const larg = Number(item.largura || 0);
    const unit = item.unit;

    // Arredondar comprimento para cálculo (múltiplos de 0,50)
    const compCalc = ceilToHalf(comp);
    // Normalizar largura: se >= 3 em m², converter cm para m
    const wCalc = normalizeWidthForArea(unit, larg);

    if (unit === 'ML') {
      return qty * compCalc * unitPrice;
    } else if (unit === 'm2') {
      if (larg > 0) {
        return qty * compCalc * wCalc * unitPrice;
      }
      return qty * unitPrice;
    } else {
      return qty * unitPrice;
    }
  };

  const subtotalItems = orderItems.reduce((acc, item) => acc + item.total, 0);
  const globalDiscountAmount = globalDiscountType === 'percent'
    ? subtotalItems * (Number(globalDiscountValue || 0) / 100)
    : Number(globalDiscountValue || 0);
  const total = Math.max(0, subtotalItems - globalDiscountAmount + Number(shippingValue || 0));

  const addItem = () => {
    if (!newItem.description) return;

    if (newItem.unit === 'ML' && !newItem.comprimento) {
      alert('Comprimento é obrigatório para produtos em ML.');
      return;
    }

    const baseItem: Partial<OrderItem> = {
      productId: newItem.productId || undefined,
      description: newItem.description,
      quantity: Number(newItem.quantity || 0),
      unitPrice: Number(newItem.price || 0),
      unit: newItem.unit,
      comprimento: newItem.comprimento ? Number(newItem.comprimento) : undefined,
      largura: newItem.largura ? Number(newItem.largura) : undefined,
      isBeneficiado: newItem.isBeneficiado,
      category: newItem.category,
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
      quantity: '',
      price: '',
      unit: 'un',
      comprimento: '',
      largura: '',
      isBeneficiado: false,
      category: ''
    });
    setProductSearch('');
  };

  const updateItem = (id: string, field: keyof OrderItem, value: any) => {
    setOrderItems(items => items.map(item => {
      if (item.id !== id) return item;
      
      const isNumeric = ['quantity', 'unitPrice', 'discountValue', 'comprimento', 'largura', 'total'].includes(field);
      const val = isNumeric ? (value === '' ? 0 : Number(value)) : value;
      const updated = { ...item, [field]: val };

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
    const fullDescription = formatProductDisplayName(prod.name, prod.category);
    
    setNewItem({
      ...newItem,
      productId: prod.id,
      description: fullDescription,
      quantity: '',
      price: newItem.isBeneficiado ? prod.price_benef : prod.price_bruto,
      unit: prod.unit || 'un',
      category: prod.category || ''
    });
    setProductSearch(fullDescription);
  };

  const saveOrder = async (silent = false, typeOverride?: 'Orçamento' | 'Pedido') => {
    if (!selectedClient) {
      alert('Selecione um cliente primeiro.');
      return null;
    }

    if (isSaving) return null;

    // Validar Vendedor (seller_id)
    const seller = vendedores.find(v => v.id === selectedSellerId);
    if (!selectedSellerId || !seller) {
      alert('Selecione um vendedor válido antes de salvar/exportar.');
      return null;
    }

    setIsSaving(true);

    const orderData: Order = {
      id: id === 'new' ? uuid() : id!,
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      sellerId: selectedSellerId || undefined,
      sellerName: seller?.name,
      date: new Date().toISOString(),
      status: orderStatus,
      type: typeOverride || orderType,
      items: orderItems,
      subtotal: subtotalItems,
      totalDiscount: 0, // Not used primarily in this version but kept for type compatibility
      globalDiscountType: globalDiscountType,
      globalDiscountValue: Number(globalDiscountValue || 0),
      globalDiscountAmount: globalDiscountAmount,
      shippingValue: Number(shippingValue || 0),
      deliveryDate: deliveryDate || null,
      total: total,
      internalNotes,
      customerNotes,
      paymentMethod: paymentMethod === 'Outros' ? otherPaymentMethod : paymentMethod,
      createdAt: createdAt || new Date().toISOString()
    };

    try {
      // Salva no banco
      await storage.saveOrders([orderData]);
      
      if (!silent) {
        alert('Salvo com sucesso!');
        if (id === 'new') {
          navigate(`/orders/${orderData.id}`);
        }
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

  const handleConvertToOrder = async () => {
    if (!window.confirm("Deseja converter este orçamento em pedido?")) return;
    
    try {
      const saved = await saveOrder(true, 'Pedido');
      if (saved) {
        setOrderType('Pedido');
        alert('Orçamento convertido em Pedido com sucesso!');
      }
    } catch (err) {
      console.error("Error converting quote:", err);
      alert("Erro ao converter orçamento.");
    }
  };
  const handleWhatsApp = async () => {
    if (isSendingWhatsApp || isSaving || isExporting) return;

    // Validar Vendedor (seller_id)
    const seller = vendedores.find(v => v.id === selectedSellerId);
    if (!selectedSellerId || !seller) {
      alert('Selecione um vendedor válido antes de enviar pelo WhatsApp.');
      return;
    }

    setIsSendingWhatsApp(true);

    try {
      // Se for novo, precisa salvar para gerar ID. Se já existe, usa o state.
      let currentOrder: any = null;
      if (id === 'new') {
        currentOrder = await saveOrder(true);
      } else {
        const seller = vendedores.find(v => v.id === selectedSellerId);
        currentOrder = {
          id: id!,
          clientName: selectedClient?.name || 'Cliente',
          items: orderItems,
          total: total,
          sellerName: seller?.name || 'Vendedor',
          type: orderType
        };
      }

      if (!currentOrder) return;

      const itemsList = currentOrder.items.map((i: any) =>
        `${i.quantity} ${i.unit} - ${i.description} (R$ ${i.total.toFixed(2)})`
      ).join('\n');

      const msg = `Olá! Segue seu ${currentOrder.type} da Madeiras Ouro Preto:\nCliente: ${currentOrder.clientName}\nItens:\n${itemsList}\n\nTotal: R$ ${currentOrder.total.toFixed(2)}\nPosso te ajudar em mais algo?`;

      window.open(`https://wa.me/${COMPANY_INFO.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
    } catch (error) {
      console.error("WhatsApp error:", error);
      alert("Erro ao preparar WhatsApp.");
    } finally {
      setIsSendingWhatsApp(false);
    }
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
    if (isExporting) return;

    // Validar Vendedor (seller_id)
    const seller = vendedores.find(v => v.id === selectedSellerId);
    if (!selectedSellerId || !seller) {
      alert('Selecione um vendedor válido antes de exportar.');
      return;
    }

    setIsExporting(true);

    try {
      // Se for novo, salva antes para garantir ID e persistência, mas sem bloquear com alert
      let currentOrder: any = null;
      if (id === 'new') {
        currentOrder = await saveOrder(true);
      } else {
        const seller = vendedores.find(v => v.id === selectedSellerId);
        currentOrder = {
          id: id!,
          clientId: selectedClient?.id || '',
          clientName: selectedClient?.name || 'Cliente',
          sellerId: selectedSellerId,
          sellerName: seller?.name || 'Vendedor',
          date: new Date().toISOString(),
          status: orderStatus,
          type: orderType,
          items: orderItems,
          subtotal: subtotalItems,
          shippingValue: Number(shippingValue || 0),
          deliveryDate: deliveryDate || null,
          total: total,
          paymentMethod: paymentMethod === 'Outros' ? otherPaymentMethod : paymentMethod,
          customerNotes: customerNotes,
          globalDiscountAmount: Number(globalDiscountAmount || 0),
          globalDiscountType: globalDiscountType,
          globalDiscountValue: Number(globalDiscountValue || 0),
          createdAt: createdAt || new Date().toISOString()
        };
      }

      if (!currentOrder && id === 'new') {
        throw new Error("Não foi possível salvar o pedido antes de exportar.");
      }

      await generateOrderPDF(currentOrder, true, selectedClient || undefined);
    } catch (error: any) {
      console.error("Export error:", error);
      alert(`Erro ao exportar PDF: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };



  const unitLabels: Record<string, string> = {
    'm2': 'm²', 'm3': 'm³', 'm': 'm', 'un': 'un', 'ML': 'ML', 'Pç': 'Pç', 'Kg': 'Kg', 'JG': 'JG'
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') return;
      e.preventDefault();

      // Especial para checkboxes (como o Benef.): alterna antes de avançar
      if (target instanceof HTMLInputElement && target.type === 'checkbox') {
        target.click();
      }

      const focusable = Array.from(document.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')) as HTMLElement[];
      const index = focusable.indexOf(target);
      if (index > -1 && index < focusable.length - 1) {
        focusable[index + 1].focus();
      }
    }
  };

  return (
    <div className="pb-48 space-y-6 animate-in fade-in duration-500" onKeyDown={handleKeyDown}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/orders')} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900 shrink-0">
            <ArrowLeft size={24} />
          </button>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
              {id === 'new' ? `Novo ${orderType}:` : `${orderType} #${id?.slice(-6).toUpperCase()}:`}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${orderType === 'Pedido' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                }`}>
                {orderType}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
          {id && id !== 'new' && (
            <button
              onClick={handleDeleteOrder}
              disabled={isSaving || isExporting || isSendingWhatsApp}
              className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
              title="Excluir Documento"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Users size={16} className="text-slate-400" /> Dados do Cliente:
              </h3>
              {!selectedClient && (
                <button 
                  onClick={() => setIsNewClientModalOpen(true)}
                  className="text-[10px] font-black text-[#02904b] uppercase tracking-widest hover:underline"
                >
                  + Novo Cliente
                </button>
              )}
            </div>

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
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-[#d9d7d8] rounded-xl focus:ring-4 focus:ring-[#02904b]/5 focus:border-[#02904b] outline-none font-bold text-sm transition-all"
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
              <UserIcon size={16} className="text-slate-400" /> Informações Adicionais:
            </h3>
            <div className="space-y-5">
              <div className="space-y-1.5 text-center sm:text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vendedor:</label>
                <div className="relative">
                  <select
                    className="w-full appearance-none p-2.5 bg-slate-50 border border-[#d9d7d8] rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-[#02904b]/5 focus:border-[#02904b] transition-all"
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações:</label>
                <textarea
                  className="w-full p-3.5 bg-slate-50 border border-[#d9d7d8] rounded-xl text-sm h-32 resize-none outline-none focus:ring-4 focus:ring-[#02904b]/5 focus:border-[#02904b] font-medium transition-all"
                  value={customerNotes}
                  onChange={e => setCustomerNotes(e.target.value)}
                  placeholder="Ex: Entrega inclusa, prazo de 5 dias úteis..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Forma de Pagamento:</label>
                <div className="relative">
                  <select
                    className="w-full appearance-none p-2.5 bg-slate-50 border border-[#d9d7d8] rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-[#02904b]/5 focus:border-[#02904b] transition-all"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="">Selecionar...</option>
                    <option value="Pix">Pix</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão (Débito)">Cartão (Débito)</option>
                    <option value="Cartão (Crédito)">Cartão (Crédito)</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Transferência">Transferência</option>
                    <option value="Outros">Outros</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                {paymentMethod === 'Outros' && (
                  <input
                    type="text"
                    className="w-full mt-2 p-2.5 bg-slate-50 border border-[#d9d7d8] rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-[#02904b]/5 focus:border-[#02904b] transition-all"
                    placeholder="Especifique..."
                    value={otherPaymentMethod}
                    onChange={(e) => setOtherPaymentMethod(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de Entrega:</label>
                <input
                  type="date"
                  className="w-full p-2.5 bg-slate-50 border border-[#d9d7d8] rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-[#02904b]/5 focus:border-[#02904b] transition-all"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="!p-0 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">Itens do Pedido:</h3>
              <div className="bg-slate-50/50 p-4 rounded-2xl flex flex-wrap items-end gap-3 border border-slate-100">
                <div className="flex-1 min-w-[280px] relative group space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Produto:</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full h-[48px] pl-4 pr-10 py-2.5 bg-white border border-[#d9d7d8] rounded-xl text-[17px] font-bold outline-none focus:ring-2 focus:ring-[#02904b] focus:border-[#02904b] focus:bg-white transition-all"
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
                      {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.category?.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                        <div
                          key={p.id}
                          className="p-3 hover:bg-slate-50 cursor-pointer text-sm rounded-xl flex justify-between items-center transition-colors"
                          onClick={() => handleProductSelect(p)}
                        >
                          <span className="font-bold text-slate-800">
                            {p.name}{p.category ? ` - ${p.category}` : ''} <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">({unitLabels[p.unit] || p.unit})</span>
                          </span>
                          <span className="text-slate-900 font-black text-xs">R$ {(newItem.isBeneficiado ? p.price_benef : p.price_bruto).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="w-[140px] space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Qtd:</label>
                  <input
                    type="number"
                    className="w-full h-[48px] p-3 bg-white border border-[#d9d7d8] rounded-xl text-[17px] font-bold outline-none focus:ring-2 focus:ring-[#02904b] focus:border-[#02904b] focus:bg-white transition-all text-right"
                    placeholder="0,00"
                    step={newItem.unit === 'un' ? '1' : '0.01'}
                    min="0.01"
                    value={newItem.quantity}
                    onChange={e => setNewItem({ ...newItem, quantity: e.target.value })}
                  />
                </div>

                {(newItem.unit === 'ML' || newItem.unit === 'm2') && (
                  <div className="w-[140px] space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Comp.:</label>
                    <input
                      type="number"
                      className="w-full h-[48px] p-3 bg-white border border-[#d9d7d8] rounded-xl text-[17px] font-bold outline-none focus:ring-2 focus:ring-[#02904b] focus:border-[#02904b] focus:bg-white transition-all text-right"
                      placeholder="0,00"
                      step="0.01"
                      min="0.01"
                      value={newItem.comprimento}
                      onChange={e => setNewItem({ ...newItem, comprimento: e.target.value })}
                    />
                  </div>
                )}

                {newItem.unit === 'm2' && (
                  <div className="w-[140px] space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">LARG. (cm):</label>
                    <input
                      type="number"
                      className="w-full h-[48px] p-3 bg-white border border-[#d9d7d8] rounded-xl text-[17px] font-bold outline-none focus:ring-2 focus:ring-[#02904b] focus:border-[#02904b] focus:bg-white transition-all text-right"
                      placeholder="ex: 20 = 20cm"
                      step="0.01"
                      min="0"
                      value={newItem.largura}
                      onChange={e => setNewItem({ ...newItem, largura: e.target.value })}
                    />
                  </div>
                )}

                <div className="w-[90px] space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block text-center">Benef.:</label>
                  <div className="flex justify-center items-center h-[48px] bg-white border border-[#d9d7d8] rounded-xl">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-gray-300 text-[#02904b] focus:ring-[#02904b] cursor-pointer"
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
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Preço Unit.:</label>
                  <div className="w-full h-[48px] p-3 bg-slate-100 border border-slate-200 rounded-xl text-[17px] font-black text-slate-600 flex items-center justify-end">
                    R$ {Number(newItem.price || 0).toFixed(2)}
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
                    <th className="px-6 py-4">Código:</th>
                    <th className="px-6 py-4 min-w-[150px]">Descrição:</th>
                    <th className="px-4 py-4 w-[140px] min-w-[140px]">QTD:</th>
                    <th className="px-4 py-4 w-[140px] min-w-[140px]">Comp.:</th>
                    <th className="px-4 py-4 w-[140px] min-w-[140px]">Larg.:</th>
                    <th className="px-4 py-4 w-20">Benef.:</th>
                    <th className="px-4 py-4 w-20">Unid.:</th>
                    <th className="px-4 py-4 w-[140px] min-w-[140px]">VL. Unit:</th>
                    <th className="px-4 py-4 w-[180px] min-w-[180px]">Desconto:</th>
                    <th className="px-6 py-4 w-[140px] min-w-[140px] text-right">Subtotal:</th>
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
                          <p className="font-bold text-slate-900 text-sm break-words">
                            {formatProductDisplayName(item.description, item.category)}
                          </p>
                        </td>

                        <td className="px-6 py-4">
                          <input
                            type="number"
                            className="w-full h-[48px] p-3 bg-slate-50 border border-slate-100 rounded-xl text-[17px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-[#02904b] transition-all text-right"
                            step={item.unit === 'un' ? '1' : '0.01'}
                            value={item.quantity || ''}
                            onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                          />
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600">
                          {item.unit === 'ML' || item.unit === 'm2' ? (
                            <input
                              type="number"
                              className="w-full h-[48px] p-3 bg-slate-50 border border-slate-100 rounded-xl text-[17px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-[#02904b] transition-all text-right"
                              step="0.01"
                              value={item.comprimento || ''}
                              onChange={(e) => updateItem(item.id, 'comprimento', e.target.value)}
                            />
                          ) : '—'}
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600">
                          {item.unit === 'm2' ? (
                            <input
                              type="number"
                              className="w-full h-[48px] p-3 bg-slate-50 border border-slate-100 rounded-xl text-[17px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-[#02904b] transition-all text-right"
                              step="0.01"
                              value={item.largura || ''}
                              onChange={(e) => updateItem(item.id, 'largura', e.target.value)}
                            />
                          ) : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center items-center">
                            <input
                              type="checkbox"
                              className="w-6 h-6 rounded border-gray-300 text-[#02904b] focus:ring-[#02904b]"
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
                               <button
                                  onClick={() => updateItem(item.id, 'discountType', item.discountType === 'percentage' ? 'fixed' : 'percentage')}
                                  className={`text-[10px] font-black min-w-[28px] h-[48px] rounded-xl transition-all border flex items-center justify-center ${
                                    item.discountType === 'percentage' 
                                    ? 'bg-amber-50 text-amber-600 border-amber-100' 
                                    : 'bg-blue-50 text-blue-600 border-blue-100'
                                  }`}
                                  title="Clique para alternar entre R$ e %"
                                >
                                  {item.discountType === 'percentage' ? '%' : 'R$'}
                                </button>
                                <div className="flex-1">
                                  <input
                                    type="number"
                                    className="w-full h-[48px] px-3 bg-slate-50 border border-slate-100 rounded-xl text-[17px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-[#02904b] transition-all text-right"
                                    value={item.discountValue || ''}
                                    onChange={(e) => updateItem(item.id, 'discountValue', e.target.value)}
                                  />
                                </div>
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
              <div className="flex flex-col items-end gap-3">
                <div className="flex justify-between w-full max-w-[320px] items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtotal dos Itens:</span>
                  <span className="text-sm font-bold text-slate-600">R$ {subtotalItems.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex flex-col w-full max-w-[320px] p-4 bg-white rounded-2xl border border-slate-100 shadow-sm gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Desconto do Pedido:</span>
                    <button
                      onClick={() => setGlobalDiscountType(prev => prev === 'percent' ? 'fixed' : 'percent')}
                      className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                      Alternar p/ {globalDiscountType === 'percent' ? 'R$' : '%'}
                    </button>
                  </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">{globalDiscountType === 'percent' ? '' : 'R$'}</span>
                      <input
                        type="number"
                        placeholder="0,00"
                        className={`w-full h-[40px] ${globalDiscountType === 'percent' ? 'px-3' : 'pl-9 pr-3'} bg-slate-50 border border-slate-100 rounded-xl text-right font-bold text-red-500 outline-none focus:ring-2 focus:ring-[#02904b] transition-all`}
                        value={globalDiscountValue}
                        onChange={(e) => setGlobalDiscountValue(e.target.value)}
                      />
                    </div>
                  {globalDiscountType === 'percent' && Number(globalDiscountValue) > 0 && (
                    <div className="text-right text-[10px] font-bold text-red-400">
                      - R$ {globalDiscountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </div>

                <div className="flex flex-col w-full max-w-[320px] p-4 bg-white rounded-2xl border border-slate-100 shadow-sm gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Frete:</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span>
                    <input
                      type="number"
                      placeholder="0,00"
                      className="w-full h-[40px] pl-9 pr-3 bg-slate-50 border border-slate-100 rounded-xl text-right font-bold text-green-600 outline-none focus:ring-2 focus:ring-[#02904b] transition-all"
                      value={shippingValue}
                      onChange={(e) => setShippingValue(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-between w-full max-w-[320px] text-3xl font-bold text-slate-900 mt-4 pt-4 border-t-2 border-dashed border-slate-200 tabular-nums">
                  <span className="text-[10px] font-black uppercase self-center tracking-widest text-slate-400">Total Final:</span>
                  <span>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card className="sticky bottom-0 z-40 no-print mt-12 !p-6 shadow-lg flex flex-col sm:flex-row items-center justify-end gap-4">
          <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => saveOrder()}
              disabled={isSaving || isSendingWhatsApp || isExporting}
              className="flex-1 sm:flex-none min-w-[110px] bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-600 rounded-full animate-spin"></div> : <Save size={18} />}
              <span>{isSaving ? 'Salvar...' : 'Salvar'}</span>
            </button>
            
            {orderType === 'Orçamento' && (
               <button
                onClick={handleConvertToOrder}
                disabled={isSaving || isSendingWhatsApp || isExporting}
                className="flex-1 sm:flex-none min-w-[150px] bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
              >
                <CheckCircle size={18} />
                <span>Converter em Pedido</span>
               </button>
            )}
            <button
              onClick={handleWhatsApp}
              disabled={isSaving || isSendingWhatsApp || isExporting}
              className="flex-1 sm:flex-none min-w-[130px] bg-green-500 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-green-600 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-green-100 disabled:opacity-50"
            >
              {isSendingWhatsApp ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Send size={18} />}
              <span>{isSendingWhatsApp ? 'Enviando...' : 'WhatsApp'}</span>
            </button>
            <PrimaryButton
              onClick={handlePrint}
              disabled={isSaving || isSendingWhatsApp || isExporting}
              className="flex-1 sm:flex-none min-w-[150px] shadow-lg shadow-slate-900/20"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Exportando...</span>
                </>
              ) : (
                <>
                  <Printer size={18} /> <span>Exportar {orderType}</span>
                </>
              )}
            </PrimaryButton>
          </div>
      </Card>
      {/* Modal de Novo Cliente */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto !p-0 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Novo Cliente:</h3>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Preencha as informações do cliente.</p>
              </div>
              <button onClick={() => setIsNewClientModalOpen(false)} className="text-slate-400 hover:text-slate-900 p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={24} />
              </button>
            </div>

            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const client: Client = { ...newClientData as Client, id: uuid() };
                await storage.saveClients([client]);
                setClients(prev => [...prev, client]);
                setSelectedClient(client);
                setIsNewClientModalOpen(false);
                setNewClientData({ type: 'PF', name: '', document: '', phone: '', address: '', email: '', internalNotes: '' });
              }} 
              className="p-8 space-y-6"
            >
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 ml-1">Tipo:</label>
                  <select
                    className="w-full p-2.5 border border-[#d9d7d8] rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#02904b]/5 focus:border-[#02904b] outline-none"
                    value={newClientData.type}
                    onChange={(e) => setNewClientData({ ...newClientData, type: e.target.value as 'PF' | 'PJ' })}
                  >
                    <option value="PF">Pessoa Física</option>
                    <option value="PJ">Pessoa Jurídica</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 ml-1">CPF / CNPJ:</label>
                  <input
                    type="text"
                    required
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    className="w-full p-2.5 border border-[#d9d7d8] rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#02904b]/5 focus:border-[#02904b] outline-none"
                    value={newClientData.document}
                    onChange={(e) => setNewClientData({ ...newClientData, document: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 ml-1">Nome Completo / Razão Social:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João Silva ou Empresa LTDA"
                  className="w-full p-2.5 border border-[#d9d7d8] rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#02904b]/5 focus:border-[#02904b] outline-none"
                  value={newClientData.name}
                  onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 ml-1">WhatsApp:</label>
                  <input
                    type="text"
                    required
                    placeholder="(00) 00000-0000"
                    className="w-full p-2.5 border border-[#d9d7d8] rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#02904b]/5 focus:border-[#02904b] outline-none"
                    value={newClientData.phone}
                    onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 ml-1">CEP:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="00000-000"
                      className="flex-1 p-2.5 border border-[#d9d7d8] rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#02904b]/5 focus:border-[#02904b] outline-none"
                      value={newClientData.cep || ''}
                      onChange={(e) => setNewClientData({ ...newClientData, cep: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const cleanCep = (newClientData.cep || '').replace(/\D/g, '');
                        if (cleanCep.length === 8) {
                          try {
                            const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
                            const d = await res.json();
                            if (!d.erro) {
                              setNewClientData(prev => ({
                                ...prev,
                                address: `${d.logradouro}${d.bairro ? `, ${d.bairro}` : ''}, ${d.localidade} - ${d.uf}`
                              }));
                            } else {
                              alert("CEP não encontrado.");
                            }
                          } catch {
                            alert("Erro ao buscar CEP.");
                          }
                        } else {
                          alert("CEP inválido.");
                        }
                      }}
                      className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors uppercase tracking-widest"
                    >
                      Buscar
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 ml-1">Endereço Completo:</label>
                <input
                  type="text"
                  placeholder="Rua, número, bairro, cidade - UF"
                  className="w-full p-2.5 border border-[#d9d7d8] rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#02904b]/5 focus:border-[#02904b] outline-none"
                  value={newClientData.address}
                  onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 ml-1">Observações:</label>
                <textarea
                  className="w-full p-3 border border-[#d9d7d8] rounded-xl h-24 text-sm font-medium focus:ring-4 focus:ring-[#02904b]/5 focus:border-[#02904b] outline-none resize-none"
                  value={newClientData.internalNotes || ''}
                  onChange={(e) => setNewClientData({ ...newClientData, internalNotes: e.target.value })}
                  placeholder="Informações adicionais sobre o cliente..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsNewClientModalOpen(false)} className="px-6 py-2.5 text-slate-500 hover:bg-slate-50 rounded-xl font-bold text-sm transition-all uppercase tracking-widest">Cancelar</button>
                <PrimaryButton
                  type="submit"
                  disabled={isSaving}
                  className="px-8"
                >
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </PrimaryButton>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default OrderEditor;
