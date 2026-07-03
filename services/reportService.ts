
import { ReportData, Order, SellerMetric } from '../types';
import { storage } from './storage';

export const getRealReportData = async (days: number = 30): Promise<ReportData> => {
  try {
    const currentUser = await storage.getCurrentUser();
    if (!currentUser) throw new Error("User not found");

    // Determine which orders to fetch based on role
    let orders: Order[] = [];
    if (currentUser.role === 'admin') {
      orders = await storage.getAllOrdersForAdmin();
    } else {
      orders = await storage.getOrders(); // Already filtered by storage.getOrders logic
    }

    const users = await storage.getUsers();
    
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Filter by date range
    const filteredOrders = orders.filter(o => {
      const orderDate = new Date(o.date);
      return orderDate >= startDate && orderDate <= now;
    });

    // 1. Sales Trend
    const salesTrend = Array.from({ length: days }).map((_, i) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i + 1);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayTotal = filteredOrders
        .filter(o => o.type === 'Pedido' && o.status === 'Aprovado' && o.date.startsWith(dateStr))
        .reduce((acc, curr) => acc + curr.total, 0);
        
      return { date: dateStr, value: dayTotal || 0 };
    });

    // 2. Status Distribution
    const statusCounts: Record<string, number> = {
      'Rascunho': 0, 'Enviado': 0, 'Aprovado': 0, 'Recusado': 0
    };
    filteredOrders.forEach(o => {
      if (statusCounts[o.status] !== undefined) statusCounts[o.status]++;
    });
    const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    // 3. Top Products
    const productMap: Record<string, { quantity: number; total: number; unit: string }> = {};
    filteredOrders.filter(o => o.status === 'Aprovado').forEach(o => {
      o.items?.forEach(item => {
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

    // 4. Seller Metrics
    const sellerMetrics: SellerMetric[] = users.map(user => {
      // We look at ALL orders (filteredOrders) to find this user's contributions
      // Note: If current user is Sales, they only see their own orders in 'filteredOrders', 
      // so other sellers will have 0 stats, which is correct for RBAC visibility.
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

    // 5. KPIs
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
        avgNegotiationTime: 2 // Mock constant
      }
    };
  } catch (error) {
    console.error("Error generating reports:", error);
    // Return empty structure to prevent crashes
    return {
      salesTrend: [],
      statusDistribution: [],
      topProducts: [],
      sellerMetrics: [],
      kpis: { averageTicket: 0, conversionRate: 0, avgNegotiationTime: 0 }
    };
  }
};
