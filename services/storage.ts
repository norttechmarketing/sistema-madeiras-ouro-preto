
import { supabase, isConfigured } from '../lib/supabase';
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

export const storage = {
  // --- AUTH / USER ---
  getCurrentUser: async (): Promise<User | null> => {
    if (!isConfigured || !supabase) return null;

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) return null;

      // Fetch profile to get role and name
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        // Fallback if profile doesn't exist yet
        return {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário',
          role: 'sales'
        };
      }

      return {
        id: session.user.id,
        email: session.user.email || '',
        name: profile.name,
        role: profile.role
      };
    } catch (err) {
      console.error("Storage getCurrentUser error:", err);
      return null;
    }
  },

  // --- CLIENTS ---
  getClients: async (): Promise<Client[]> => {
    if (!isConfigured || !supabase) return [];

    try {
      // DB: internal_notes | Front: internalNotes
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
        internalNotes: row.internal_notes, // Map snake_case to camelCase
      }));
    } catch (e) {
      console.error("Unexpected error in getClients:", e);
      return [];
    }
  },

  saveClients: async (clients: Client[]) => {
    if (!isConfigured || !supabase) return;

    try {
      const user = await storage.getCurrentUser();
      if (!user) return;

      const clientsPayload = clients.map(c => ({
        id: normalizeId(c.id), // Ensure UUID valid
        name: c.name,
        document: c.document,
        phone: c.phone,
        email: c.email,
        address: c.address,
        type: c.type,
        internal_notes: c.internalNotes, // Map camelCase to snake_case
        created_at: new Date().toISOString()
        // user_id REMOVIDO: a tabela clients não possui essa coluna no Supabase
      }));

      const { error } = await supabase.from('clients').upsert(clientsPayload);

      if (error) {
        console.error('Supabase Save Error:', error);
        throw new Error(`Erro ao sincronizar com Supabase: ${error.message}`);
      }
    } catch (err) {
      console.error("Safe catch in saveClients:", err);
    }
  },

  deleteClient: async (id: string) => {
    if (!isConfigured || !supabase) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) {
      console.error('Error deleting client:', error);
      throw new Error(`Erro ao excluir cliente: ${error.message}`);
    }
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
      const payload = products.map(p => {
        return {
          id: normalizeId(p.id),
          code: p.code,
          name: p.name,
          category: p.category,
          price: p.price,
          cost: p.cost,
          unit: p.unit,
          created_at: new Date().toISOString()
        };
      });

      // Upsert lida bem com mix se o ID for PK, mas para garantir inserção correta de novos:
      const { error } = await supabase.from('products').upsert(payload);

      if (error) {
        console.error('Error saving products:', error);
        throw new Error(`Erro ao salvar produtos: ${error.message}`);
      }
    } catch (err) {
      console.error("Unexpected error in saveProducts:", err);
      // Não trava a UI
    }
  },

  deleteProduct: async (id: string) => {
    if (!isConfigured || !supabase) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      console.error('Error deleting product:', error);
      throw new Error(`Erro ao excluir produto: ${error.message}`);
    }
  },

  // --- ORDERS ---
  getOrders: async (): Promise<Order[]> => {
    if (!isConfigured || !supabase) return [];

    try {
      const user = await storage.getCurrentUser();
      if (!user) return [];

      let query = supabase
        .from('orders')
        .select('*, items:order_items(*)'); // Join items

      // Role Based Access Control for fetching
      if (user.role !== 'admin') {
        query = query.eq('seller_id', user.id);
      }

      query = query.order('date', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching orders:', error);
        return [];
      }

      // MAP DB (snake_case) -> APP (camelCase)
      return (data || []).map((row: any) => ({
        id: row.id,
        clientId: row.client_id,
        clientName: row.client_name,
        sellerId: row.seller_id,
        sellerName: row.seller_name,
        date: row.date, // ISO String
        status: row.status,
        type: row.type,
        subtotal: Number(row.subtotal),
        totalDiscount: Number(row.total_discount),
        total: Number(row.total),
        internalNotes: row.internal_notes,
        customerNotes: row.customer_notes,
        createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at || Date.now()).toISOString(),
        items: (row.items || []).map((item: any) => ({
          id: item.id,
          productId: item.product_id,
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          unit: item.unit,
          discountType: item.discount_type,
          discountValue: Number(item.discount_value),
          total: Number(item.total)
        }))
      }));
    } catch (e) {
      console.error("Unexpected error in getOrders:", e);
      return [];
    }
  },

  saveOrders: async (orders: Order[]) => {
    if (!isConfigured || !supabase) return;

    try {
      const user = await storage.getCurrentUser();
      if (!user) throw new Error("Usuário não autenticado.");

      for (const order of orders) {
        // --- 1. PREPARE HEADER DATA ---
        const orderId = normalizeId(order.id);
        const sellerId = order.sellerId || user.id;
        const sellerName = order.sellerName || user.name;

        // Enforce Seller ID integrity if not admin
        if (user.role !== 'admin') {
          // Allow creating new or editing own, check ownership later if needed
          // But here we rely on the object data.
        }

        const headerPayload = {
          id: orderId,
          client_id: order.clientId,
          client_name: order.clientName,
          seller_id: sellerId,
          seller_name: sellerName,
          date: toIso(order.date), // Normalizado para ISO String
          status: order.status,
          type: order.type,
          subtotal: order.subtotal,
          total_discount: order.totalDiscount,
          total: order.total,
          internal_notes: order.internalNotes,
          customer_notes: order.customerNotes,
          created_at: new Date().toISOString()
        };

        // --- 2. UPSERT HEADER ---
        const { error: headerError } = await supabase
          .from('orders')
          .upsert(headerPayload);

        if (headerError) {
          console.error("Error saving order header:", headerError);
          throw new Error(`Erro ao salvar cabeçalho do pedido: ${headerError.message}`);
        }

        // --- 3. HANDLE ITEMS (Delete Old -> Insert New) ---
        // First, delete existing items for this order to avoid duplicates/orphans
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', orderId);

        if (deleteError) {
          console.error("Error clearing old items:", deleteError);
          throw new Error(`Erro ao atualizar itens: ${deleteError.message}`);
        }

        // If there are items, insert them
        if (order.items && order.items.length > 0) {
          const itemsPayload = order.items.map(item => ({
            id: normalizeId(item.id),
            order_id: orderId,
            product_id: item.productId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            unit: item.unit,
            discount_type: item.discountType,
            discount_value: item.discountValue,
            total: item.total
          }));

          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(itemsPayload);

          if (itemsError) {
            console.error("Error saving order items:", itemsError);
            throw new Error(`Erro ao salvar itens: ${itemsError.message}`);
          }
        }
      }
    } catch (err) {
      console.error("Unexpected error in saveOrders:", err);
      // Rethrow para a UI tratar o estado de loading corretamente (parar spinner e mostrar erro)
      throw err;
    }
  },

  deleteOrder: async (id: string) => {
    if (!isConfigured || !supabase) return;

    try {
      const user = await storage.getCurrentUser();
      if (!user) throw new Error("Não autenticado");

      // Permission Check
      if (user.role !== 'admin') {
        const { data: existing, error } = await supabase
          .from('orders')
          .select('seller_id') // Check snake_case column
          .eq('id', id)
          .single();

        if (error) {
          console.error("Error fetching order for deletion check:", error);
          throw new Error("Erro ao verificar permissão.");
        }

        if (existing && existing.seller_id !== user.id) {
          throw new Error("Permissão negada: Você só pode excluir seus próprios pedidos.");
        }
      }

      // --- DELETE ORDER ITEMS FIRST (Fixing critical deletion bug) ---
      const { error: itemsError } = await supabase.from('order_items').delete().eq('order_id', id);
      if (itemsError) {
        console.error('Error deleting order items:', itemsError);
        throw new Error(`Erro ao excluir itens do pedido: ${itemsError.message}`);
      }

      // --- DELETE HEADER ---
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) {
        console.error('Error deleting order:', error);
        throw error;
      }
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
    try {
      let query = supabase
        .from('sellers')
        .select('*');

      if (onlyActive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query.order('name');

      if (error) {
        console.error('Error fetching sellers:', error);
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
      const payload = {
        id: normalizeId(seller.id),
        name: seller.name,
        whatsapp: seller.whatsapp,
        is_active: seller.is_active !== undefined ? seller.is_active : true,
        created_at: seller.created_at || new Date().toISOString()
      };

      const { error } = await supabase.from('sellers').upsert(payload);
      if (error) throw error;
    } catch (err) {
      console.error("Error saving seller:", err);
      throw err;
    }
  },

  deleteSeller: async (id: string) => {
    if (!isConfigured || !supabase) return;
    const { error } = await supabase.from('sellers').delete().eq('id', id);
    if (error) {
      console.error('Error deleting seller:', error);
      throw new Error(`Erro ao excluir vendedor: ${error.message}`);
    }
  },

  // --- AUDIT LOGS ---
  logAction: async (action: 'INSERT' | 'UPDATE' | 'DELETE', table: string, recordId: string, before: any, after: any) => {
    if (!isConfigured || !supabase) return;
    try {
      const user = await storage.getCurrentUser();
      const { error } = await supabase.from('audit_logs').insert({
        table_name: table,
        action: action,
        record_id: recordId,
        before: before,
        after: after,
        user_id: user?.id,
        created_at: new Date().toISOString()
      });
      if (error) console.warn("Audit Log Error:", error);
    } catch (e) {
      console.warn("Audit Log Unexpected Error:", e);
    }
  }
};
