
import { supabase, isConfigured, withTimeout } from '../lib/supabase';
import { Client, Product, Order, OrderItem, User, Seller, AuditLog } from '../types';

// --- HELPER: UUID GENERATOR & VALIDATOR ---
const isUuid = (v: string | undefined): boolean =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export const uuid = () => {
  if (typeof crypto !== 'undefined') {
    if (crypto.randomUUID) return crypto.randomUUID();
    if (crypto.getRandomValues) {
      return (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
      );
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const normalizeId = (id?: string) => {
  if (id && isUuid(id)) return id;
  return uuid();
};

const toIso = (v: any) => {
  if (!v) return new Date().toISOString();

  // se for Date
  if (v instanceof Date) return v.toISOString();

  // se for número (ms)
  if (typeof v === 'number') return new Date(v).toISOString();

  // se for string numérica (ex: "1771425029557")
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (/^\d+$/.test(trimmed)) {
      const ms = Number(trimmed);
      return new Date(ms).toISOString();
    }
    // se for string ISO ou data normal
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Fallback
  return new Date().toISOString();
};

const generateId = () => normalizeId();

let cachedUser: User | null = null;

export const storage = {
  // --- AUTH / USER ---
  getCurrentUser: async (): Promise<User | null> => {
    if (!isConfigured || !supabase) return null;

    // 1. Usar cache se disponível para performance e evitar chamadas repetidas
    if (cachedUser) return cachedUser;

    const client = supabase; // Local reference to help TS narrow nullability

    try {
      // 2. Timeout maior e retry para sessões (crítico)
      const sessionResult: any = await withTimeout(() => client.auth.getSession(), 20000, { retry: true });
      if (!sessionResult) return null;

      const { data: { session }, error: sessionError } = sessionResult;
      if (sessionError || !session?.user) return null;

      // 3. Fetch de profile (não crítico): retry e silent=true para não travar app
      const query = () => client
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      // 3. Fetch de profile (não crítico): SEM RETRY para ser instantâneo, e silent=true para não travar app
      const result: any = await withTimeout(query, 8000, { silent: true });
      const { data: profile, error: profileError } = result || { data: null, error: null };

      if (profileError || !profile) {
        // Fallback: usar dados iniciais do meta do auth
        cachedUser = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário',
          role: profile?.role || 'sales'
        };
        return cachedUser;
      }

      cachedUser = {
        id: session.user.id,
        email: session.user.email || '',
        name: profile.name,
        role: profile.role || 'sales'
      };

      return cachedUser;
    } catch (err) {
      console.error("Storage getCurrentUser fatal error:", err);
      return null;
    }
  },



  // --- CLIENTS ---
  getClients: async (): Promise<Client[]> => {
    if (!isConfigured || !supabase) return [];

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching clients:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        document: row.document,
        phone: row.phone,
        email: row.email,
        address: row.address,
        type: row.type,
        internalNotes: row.internal_notes,
      }));
    } catch (e) {
      console.error("Unexpected error in getClients:", e);
      return [];
    }
  },

  saveClients: async (clients: Client[]) => {
    if (!isConfigured || !supabase) return;

    try {
      for (const c of clients) {
        const clientId = normalizeId(c.id);
        
        // Fetch before data for audit
        const { data: beforeData } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
        const mappedBefore = beforeData ? {
          id: beforeData.id,
          name: beforeData.name,
          document: beforeData.document,
          phone: beforeData.phone,
          email: beforeData.email,
          address: beforeData.address,
          type: beforeData.type,
          internalNotes: beforeData.internal_notes
        } : null;

        const payload = {
          id: clientId,
          name: c.name,
          document: c.document,
          phone: c.phone,
          email: c.email,
          address: c.address,
          type: c.type,
          internal_notes: c.internalNotes,
          created_at: new Date().toISOString()
        };

        const { error } = await supabase.from('clients').upsert(payload);
        if (error) throw error;

        await storage.logAction(mappedBefore ? 'UPDATE' : 'INSERT', 'clients', clientId, mappedBefore, c);
      }
    } catch (err) {
      console.error("Safe catch in saveClients:", err);
    }
  },

  deleteClient: async (id: string) => {
    if (!isConfigured || !supabase) return;
    
    // Fetch before data
    const { data: beforeData } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
    const mappedBefore = beforeData ? {
      id: beforeData.id,
      name: beforeData.name,
      document: beforeData.document,
      phone: beforeData.phone,
      email: beforeData.email,
      address: beforeData.address,
      type: beforeData.type,
      internalNotes: beforeData.internal_notes
    } : null;

    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) {
      console.error('Error deleting client:', error);
      throw new Error(`Erro ao excluir cliente: ${error.message}`);
    }
    await storage.logAction('DELETE', 'clients', id, mappedBefore, null);
  },

  // --- PRODUCTS ---
  getProducts: async (): Promise<Product[]> => {
    if (!isConfigured || !supabase) return [];
    try {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error) {
        console.error('Error fetching products:', error);
        return [];
      }
      // Products table matches types mostly, just ensuring safety
      return (data || []).map((row: any) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        category: row.category,
        price: Number(row.price),
        price_bruto: Number(row.price_bruto || row.price || 0),
        price_benef: Number(row.price_benef || row.price || 0),
        cost: Number(row.cost),
        unit: row.unit
      }));
    } catch (e) {
      console.error("Unexpected error in getProducts:", e);
      return [];
    }
  },

  saveProducts: async (products: Product[]) => {
    if (!isConfigured || !supabase) return;

    try {
      for (const p of products) {
        const productId = normalizeId(p.id);
        
        // Fetch before data for audit
        const { data: beforeData } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();

        const payload = {
          id: productId,
          code: p.code,
          name: p.name,
          category: p.category,
          price: p.price,
          price_bruto: p.price_bruto,
          price_benef: p.price_benef,
          cost: p.cost,
          unit: p.unit,
          created_at: new Date().toISOString()
        };

        const { error } = await supabase.from('products').upsert(payload);
        if (error) {
          console.error('Error saving product:', error);
          throw error;
        }

        // Action: if beforeData exists, it's an UPDATE, else it's an INSERT
        await storage.logAction(beforeData ? 'UPDATE' : 'INSERT', 'products', productId, beforeData || null, p);
      }
    } catch (err) {
      console.error("Unexpected error in saveProducts:", err);
      throw err;
    }
  },

  deleteProduct: async (id: string) => {
    if (!isConfigured || !supabase) return;
    
    try {
      // 1. Limpar referências em itens de pedidos e orçamentos para evitar erro de FK
      // Como o item já tem o snapshot (descrição, categoria, preço), ele continuará aparecendo corretamente.
      await supabase.from('order_items').update({ product_id: null }).eq('product_id', id);
      await supabase.from('quote_items').update({ product_id: null }).eq('product_id', id);

      // 2. Fetch data para log de auditoria
      const { data: beforeData } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
      
      // 3. Excluir o produto
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) {
        console.error('Error deleting product:', error);
        throw new Error(`Erro ao excluir produto: ${error.message}`);
      }
      await storage.logAction('DELETE', 'products', id, beforeData || null, null);
    } catch (err) {
      console.error("Error in deleteProduct:", err);
      throw err;
    }
  },

  // --- ORDERS ---
  getOrders: async (includeItems = true): Promise<Order[]> => {
    if (!isConfigured || !supabase) return [];

    try {
      const user = await storage.getCurrentUser();
      if (!user) return [];

      const [ordersResult, quotesResult] = await Promise.all([
        supabase.from('orders').select(includeItems ? '*, items:order_items(*)' : '*').order('date', { ascending: false }),
        supabase.from('quotes').select(includeItems ? '*, items:quote_items(*)' : '*').order('date', { ascending: false })
      ]);

      if (ordersResult.error) console.error('Error fetching orders:', ordersResult.error);
      if (quotesResult.error) console.error('Error fetching quotes:', quotesResult.error);

      const allRows = [...(ordersResult.data || []), ...(quotesResult.data || [])];
      
      const filteredRows = user.role === 'admin' 
        ? allRows 
        : allRows.filter(r => r.seller_id === user.id);

      return filteredRows.map((row: any) => {
        const dbItems = row.items || [];
        
        return {
          id: row.id,
          clientId: row.client_id || row.clientId,
          clientName: row.client_name || row.clientName,
          sellerId: row.seller_id || row.sellerId,
          sellerName: row.seller_name || row.sellerName,
          date: row.date,
          status: row.status,
          type: row.type || (row.items ? (row.items[0]?.order_id ? 'Pedido' : 'Orçamento') : 'Pedido'),
          subtotal: Number(row.subtotal || 0),
          totalDiscount: Number(row.total_discount || row.totalDiscount || 0),
          globalDiscountType: row.discount_type || row.globalDiscountType,
          globalDiscountValue: Number(row.discount_value || row.globalDiscountValue || 0),
          globalDiscountAmount: Number(row.discount_amount || row.globalDiscountAmount || 0),
          total: Number(row.total || 0),
          internalNotes: row.internal_notes || row.internalNotes,
          customerNotes: row.customer_notes || row.customerNotes,
          paymentMethod: row.payment_method || row.paymentMethod,
          shippingValue: Number(row.shipping_value || row.shippingValue || 0),
          deliveryDate: row.delivery_date || row.deliveryDate,
          createdAt: row.created_at || row.createdAt || new Date().toISOString(),
          items: includeItems ? dbItems.map((item: any) => ({
            id: item.id,
            productId: item.product_id || item.productId,
            description: item.description,
            quantity: Number(item.quantity || 0),
            unitPrice: Number(item.unit_price || item.unitPrice || 0),
            unit: item.unit,
            discountType: item.discount_type || item.discountType,
            discountValue: Number(item.discount_value || item.discountValue || 0),
            total: Number(item.total || 0),
            category: item.category,
            comprimento: item.comprimento,
            largura: item.largura,
            isBeneficiado: item.is_beneficiado !== undefined ? item.is_beneficiado : item.isBeneficiado
          })) : []
        };
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (e) {
      console.error("Unexpected error in getOrders:", e);
      return [];
    }
  },

  saveOrders: async (orders: Order[]) => {
    if (!isConfigured || !supabase) return;

    const client = supabase;
    try {
      const user = await storage.getCurrentUser();
      if (!user) throw new Error("Usuário não autenticado.");

      for (const order of orders) {
        const orderId = normalizeId(order.id);
        const isQuote = order.type === 'Orçamento';
        const headerTable = isQuote ? 'quotes' : 'orders';
        const itemsTable = isQuote ? 'quote_items' : 'order_items';
        
        // Fetch before data for audit
        const { data: beforeData } = await client.from(headerTable).select(`*, items:${itemsTable}(*)`).eq('id', orderId).maybeSingle();
        
        const sellerId = order.sellerId || null;
        const sellerName = order.sellerName || '';

        const headerPayload = {
          id: orderId,
          client_id: order.clientId,
          client_name: order.clientName,
          seller_id: sellerId,
          seller_name: sellerName,
          date: toIso(order.date),
          status: order.status,
          type: order.type,
          subtotal: order.subtotal,
          total_discount: order.totalDiscount,
          discount_type: order.globalDiscountType || 'fixed',
          discount_value: order.globalDiscountValue,
          discount_amount: order.globalDiscountAmount,
          total: order.total,
          internal_notes: order.internalNotes,
          ...(headerTable === 'orders' ? { customer_notes: order.customerNotes } : {}),
          payment_method: order.paymentMethod,
          shipping_value: order.shippingValue,
          delivery_date: order.deliveryDate,
          created_at: order.createdAt || new Date().toISOString()
        };

        const headerResult: any = await withTimeout(() => 
          client.from(headerTable).upsert(headerPayload).select().single(), 
          20000, { retry: true }
        );
        
        if (headerResult?.error) throw new Error(`Erro no cabeçalho: ${headerResult.error.message}`);
        
        const savedHeader = headerResult.data;
        if (!savedHeader?.id) throw new Error("Erro crítico: ID do documento não foi retornado pelo banco.");

        const fkField = isQuote ? 'quote_id' : 'order_id';

        // Remove itens antigos usando o ID retornado e campo correto
        await client.from(itemsTable).delete().eq(fkField, savedHeader.id);

        if (order.items && order.items.length > 0) {
          const itemsPayload = order.items.map(item => ({
            [fkField]: savedHeader.id,
            product_id: item.productId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            unit: item.unit,
            discount_type: item.discountType || 'fixed',
            discount_value: item.discountValue,
            total: item.total,
            category: item.category,
            comprimento: item.comprimento,
            largura: item.largura,
            is_beneficiado: item.isBeneficiado
          }));

          const itemsResult: any = await withTimeout(() => client.from(itemsTable).insert(itemsPayload), 20000, { retry: true });
          if (itemsResult?.error) throw new Error(`Erro nos itens: ${itemsResult.error.message}`);
        }

        await storage.logAction(beforeData ? 'UPDATE' : 'INSERT', headerTable, savedHeader.id, beforeData, order);
      }
    } catch (err) {
      console.error("Unexpected error in saveOrders:", err);
      throw err;
    }
  },

  deleteOrder: async (id: string) => {
    if (!isConfigured || !supabase) return;

    try {
      const user = await storage.getCurrentUser();
      if (!user) throw new Error("Não autenticado");

      // Try orders first
      let table: 'orders' | 'quotes' = 'orders';
      let itemsTable: 'order_items' | 'quote_items' = 'order_items';
      
      let { data: beforeData } = await supabase.from('orders').select('*, items:order_items(*)').eq('id', id).maybeSingle();
      
      if (!beforeData) {
        // Try quotes
        const quoteResult = await supabase.from('quotes').select('*, items:quote_items(*)').eq('id', id).maybeSingle();
        if (quoteResult.data) {
          beforeData = quoteResult.data;
          table = 'quotes';
          itemsTable = 'quote_items';
        }
      }

      if (!beforeData) throw new Error("Documento não encontrado.");

      if (user.role !== 'admin') {
        if (beforeData.seller_id !== user.id) {
          throw new Error("Permissão negada: Você só pode excluir seus próprios documentos.");
        }
      }

      const fkField = table === 'quotes' ? 'quote_id' : 'order_id';
      await supabase.from(itemsTable).delete().eq(fkField, id);
      const { error } = await supabase.from(table).delete().eq('id', id);
      
      if (error) {
        console.error(`Error deleting ${table}:`, error);
        throw error;
      }
      
      await storage.logAction('DELETE', table, id, beforeData, null);
    } catch (err) {
      console.error("Unexpected error in deleteOrder:", err);
      throw err;
    }
  },

  // --- ADMIN USERS / PROFILES ---
  getUsers: async (): Promise<User[]> => {
    if (!isConfigured || !supabase) return [];

    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) {
        console.error('Error fetching users:', error);
        return [];
      }
      return (data || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role
      }));
    } catch (e) {
      console.error("Unexpected error in getUsers:", e);
      return [];
    }
  },

  updateUserRole: async (id: string, role: 'admin' | 'sales') => {
    if (!isConfigured || !supabase) return;

    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);

    if (error) {
      console.error("Error updating user role:", error);
      throw new Error(`Erro ao atualizar permissão: ${error.message}`);
    }
  },

  getAllOrdersForAdmin: async (): Promise<Order[]> => {
    if (!isConfigured || !supabase) return [];
    return storage.getOrders();
  },

  // --- SELLERS (using dedicated table) ---
  getSellers: async (onlyActive = false): Promise<Seller[]> => {
    if (!isConfigured || !supabase) return [];

    const client = supabase;
    try {
      let query = client
        .from('sellers')
        .select('*');

      if (onlyActive) {
        query = query.eq('is_active', true);
      }

      // Use timeout (não crítico): sem retry para não segurar a UI no carregamento
      const result: any = await withTimeout(() => query.order('name'), 8000, { silent: true });
      const { data, error } = result || { data: null, error: null };

      if (error) {
        console.warn('Error fetching sellers (using empty list):', error);
        return [];
      }
      return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        whatsapp: row.whatsapp,
        is_active: row.is_active,
        created_at: row.created_at
      }));
    } catch (e) {
      console.error("Unexpected error in getSellers:", e);
      return [];
    }
  },


  saveSeller: async (seller: any) => {
    if (!isConfigured || !supabase) return;
    try {
      const sellerId = normalizeId(seller.id);
      
      // Fetch before data for audit
      const { data: beforeData } = await supabase.from('sellers').select('*').eq('id', sellerId).maybeSingle();

      const payload = {
        id: sellerId,
        name: seller.name,
        whatsapp: seller.whatsapp,
        is_active: seller.is_active !== undefined ? seller.is_active : true,
        created_at: seller.created_at || new Date().toISOString()
      };

      const { error } = await supabase.from('sellers').upsert(payload);
      if (error) throw error;
      
      await storage.logAction(beforeData ? 'UPDATE' : 'INSERT', 'sellers', sellerId, beforeData || null, seller);
    } catch (err) {
      console.error("Error saving seller:", err);
      throw err;
    }
  },

  deleteSeller: async (id: string) => {
    if (!isConfigured || !supabase) return;
    
    try {
      // Fetch before data
      const { data: beforeData } = await supabase.from('sellers').select('*').eq('id', id).maybeSingle();

      const { error } = await supabase.from('sellers').delete().eq('id', id);
      if (error) {
        console.error('Error deleting seller:', error);
        throw new Error(`Erro ao excluir vendedor: ${error.message}`);
      }
      await storage.logAction('DELETE', 'sellers', id, beforeData || null, null);
    } catch (err) {
      console.error("Error in deleteSeller:", err);
      throw err;
    }
  },

  // --- AUDIT LOGS ---
  logAction: async (action: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT', table: string, recordId: string, before: any, after: any) => {
    if (!isConfigured || !supabase) return;
    try {
      const user = await storage.getCurrentUser();
      const { error } = await supabase.from('audit_log').insert({
        table_name: table,
        action: action,
        record_id: recordId,
        old_data: before,
        new_data: after,
        user_id: user?.id,
        user_email: user?.email,
        created_at: new Date().toISOString()
      });
      if (error) console.warn("Audit Log Error:", error);
    } catch (e) {
      console.warn("Audit Log Unexpected Error:", e);
    }
  }
};
