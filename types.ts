
export interface Client {
  id: string;
  name: string; // Nome ou Razão Social
  document: string; // CPF ou CNPJ
  phone: string;
  email: string;
  address: string;
  type: 'PF' | 'PJ';
  internalNotes?: string;
}

export type ProductUnit = 'm2' | 'm3' | 'm' | 'un' | 'ML' | 'Pç' | 'Kg' | 'JG';

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number; // For backward compatibility / default
  price_bruto: number;
  price_benef: number;
  cost: number;
  unit: ProductUnit;
}

export interface OrderItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unit: ProductUnit | string; // Unidade no momento da venda
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  total: number;
  // New fields for Madeiras Ouro Preto
  comprimento?: number;
  largura?: number;
  isBeneficiado?: boolean;
}

export interface Order {
  id: string;
  clientId: string;
  clientName: string;
  sellerId?: string;
  sellerName?: string;
  date: string; // ISO String
  status: 'Rascunho' | 'Enviado' | 'Aprovado' | 'Recusado';
  type: 'Orçamento' | 'Pedido';
  items: OrderItem[];
  subtotal: number;
  totalDiscount: number;
  total: number;
  internalNotes?: string;
  customerNotes?: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'sales';
}

export interface Seller {
  id: string;
  name: string;
  whatsapp?: string;
  is_active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  record_id: string;
  user_id?: string;
  user_email?: string;
  old_data: any;
  new_data: any;
  created_at: string;
}

export interface SellerMetric {
  sellerId: string;
  sellerName: string;
  totalValue: number;
  orderCount: number;
  quoteCount: number;
  conversionRate: number;
}

export interface ReportData {
  salesTrend: { date: string; value: number }[];
  statusDistribution: { status: string; count: number }[];
  topProducts: { name: string; quantity: number; total: number; unit: string }[];
  sellerMetrics: SellerMetric[];
  kpis: {
    averageTicket: number;
    conversionRate: number;
    avgNegotiationTime: number;
  };
}
