
import { ReportData, Order, User, SellerMetric } from '../types';
import { storage } from './storage';

// Fix: Made getMockReportData async to correctly await storage calls
export const getMockReportData = async (days: number = 30): Promise<ReportData> => {
  const allOrders = await storage.getOrders();
  const users = await storage.getUsers();
  const now = new Date();
  
  // Define o range de data real
  const startDate = new Date();
  startDate.setDate(now.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Filtra pedidos dentro do período
  const filteredOrders = allOrders.filter(o => {
    const orderDate = new Date(o.date);
    return orderDate >= startDate && orderDate <= now;
  });

  // 1. Tendência de Vendas (Agregado por dia)
  const salesTrend = Array.from({ length: days }).map((_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i + 1);
    const dateStr = d.toISOString().split('T')[0];
    
    const dayTotal = filteredOrders
      .filter(o => o.type === 'Pedido' && o.status === 'Aprovado' && o.date.startsWith(dateStr))
      .reduce((acc, curr) => acc + curr.total, 0);
      
    return { date: dateStr, value: dayTotal || 0 };
  });

  // 2. Distribuição por Status
  const statusCounts: Record<string, number> = {
    'Rascunho': 0,
    'Enviado': 0,
    'Aprovado': 0,
    'Recusado': 0
  };
  filteredOrders.forEach(o => {
    if (statusCounts[o.status] !== undefined) {
      statusCounts[o.status]++;
    }
  });
  
  const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count
  }));

  // 3. Top Produtos (Ranking Real)
  const productMap: Record<string, { quantity: number; total: number; unit: string }> = {};
  filteredOrders.filter(o => o.status === 'Aprovado').forEach(o => {
    o.items.forEach(item => {
      const key = item.description;
      if (!productMap[key]) {
        productMap[key] = { quantity: 0, total: 0, unit: String(item.unit || 'un') };
      }
      productMap[key].quantity += item.quantity;
      productMap[key].total += item.total;
    });
  });

  const topProducts = Object.entries(productMap)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // 4. Métricas por Vendedor (Real)
  const sellerMetrics: SellerMetric[] = users.map(user => {
    const userOrders = filteredOrders.filter(o => o.sellerId === user.id);
    const approvedOrders = userOrders.filter(o => o.status === 'Aprovado' && o.type === 'Pedido');
    const allQuotes = userOrders.filter(o => o.type === 'Orçamento');

    const totalValue = approvedOrders.reduce((acc, curr) => acc + curr.total, 0);
    const conversionRate = allQuotes.length > 0 ? (approvedOrders.length / allQuotes.length) * 100 : 0;

    return {
      sellerId: user.id,
      sellerName: user.name,
      totalValue,
      orderCount: approvedOrders.length,
      quoteCount: allQuotes.length,
      conversionRate
    };
  }).sort((a, b) => b.totalValue - a.totalValue);

  // 5. KPIs Globais
  const approvedOrdersGlobal = filteredOrders.filter(o => o.status === 'Aprovado' && o.type === 'Pedido');
  const allQuotesGlobal = filteredOrders.filter(o => o.type === 'Orçamento');
  
  const averageTicket = approvedOrdersGlobal.length > 0 
    ? approvedOrdersGlobal.reduce((acc, curr) => acc + curr.total, 0) / approvedOrdersGlobal.length 
    : 0;
    
  const conversionRateGlobal = allQuotesGlobal.length > 0 
    ? (approvedOrdersGlobal.length / allQuotesGlobal.length) * 100 
    : 0;

  return {
    salesTrend,
    statusDistribution,
    topProducts,
    sellerMetrics,
    kpis: {
      averageTicket,
      conversionRate: conversionRateGlobal,
      avgNegotiationTime: 2 // Mock de tempo médio pois não há track de mudança de status
    }
  };
};
