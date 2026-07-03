
import { supabase, isConfigured } from '../lib/supabase';
import { storage } from './storage';
import { Order, OrderItem, Product, Client, User } from '../types';
import {
    startOfDay,
    endOfDay,
    subDays,
    subMonths,
    subWeeks,
    format,
    isWithinInterval,
    parseISO,
    startOfWeek,
    startOfMonth,
    eachDayOfInterval,
    eachWeekOfInterval,
    eachMonthOfInterval,
    isSameDay,
    isSameWeek,
    isSameMonth
} from 'date-fns';

export interface AnalyticsFilters {
    period: '7' | '30' | '90' | '12m' | 'custom' | 'day' | 'month';
    startDate?: Date;
    endDate?: Date;
    specificDate?: Date;
    sellerId?: string;
    type?: 'Todos' | 'Pedido' | 'Orçamento';
}

export const getAnalyticsData = async (filters: AnalyticsFilters) => {
    if (!isConfigured || !supabase) return null;

    const currentUser = await storage.getCurrentUser();
    if (!currentUser) return null;

    const sellersList = await storage.getSellers();

    // 1. Determine Date Range
    let start: Date;
    let end: Date = filters.endDate || endOfDay(new Date());

    switch (filters.period) {
        case '7': start = startOfDay(subDays(end, 6)); break;
        case '30': start = startOfDay(subDays(end, 29)); break;
        case '90': start = startOfDay(subDays(end, 89)); break;
        case '12m': start = startOfDay(startOfMonth(subMonths(end, 11))); break;
        case 'day':
            start = startOfDay(filters.specificDate || new Date());
            end = endOfDay(filters.specificDate || new Date());
            break;
        case 'month':
            start = startOfMonth(filters.specificDate || new Date());
            end = endOfDay(new Date(start.getFullYear(), start.getMonth() + 1, 0));
            break;
        case 'custom': start = filters.startDate || startOfDay(subDays(end, 29)); break;
        default: start = startOfDay(subDays(end, 29));
    }

    // 2. Fetch Data from Supabase
    // To ensure "Ticket Médio Mensal" always shows 12 months, we fetch a wider range if necessary
    const trendStart = startOfDay(startOfMonth(subMonths(new Date(), 11)));
    const queryStart = start < trendStart ? start : trendStart;

    let ordersQuery = supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .gte('date', queryStart.toISOString())
        .lte('date', end.toISOString());

    let quotesQuery = supabase
        .from('quotes')
        .select('*, items:quote_items(*)')
        .gte('date', queryStart.toISOString())
        .lte('date', end.toISOString());

    if (currentUser.role !== 'admin') {
        ordersQuery = ordersQuery.eq('seller_id', currentUser.id);
        quotesQuery = quotesQuery.eq('seller_id', currentUser.id);
    }

    const [ordersResult, quotesResult] = await Promise.all([
        ordersQuery,
        quotesQuery
    ]);

    if (ordersResult.error) console.error("Orders fetch error:", ordersResult.error);
    if (quotesResult.error) console.error("Quotes fetch error:", quotesResult.error);

    const rawOrders = [...(ordersResult.data || []), ...(quotesResult.data || [])];

    // Normalize Data
    const allOrders: Order[] = (rawOrders || [])
        .map((row: any) => ({
            id: row.id,
            clientId: row.client_id || row.clientId,
            clientName: row.client_name || row.clientName,
            sellerId: row.seller_id || row.sellerId,
            sellerName: row.seller_name || row.sellerName,
            date: row.date,
            status: row.status,
            type: row.type,
            subtotal: Number(row.subtotal || 0),
            totalDiscount: Number(row.total_discount || row.totalDiscount || 0),
            total: Number(row.total || 0),
            items: (row.items || []).map((item: any) => ({
                id: item.id,
                productId: item.product_id || item.productId,
                description: item.description,
                quantity: Number(item.quantity || 0),
                unitPrice: Number(item.unit_price || item.unitPrice || 0),
                total: Number(item.total || 0)
            }))
        } as any));

    // Filtered data for KPIs and charts based on date range and seller
    const filteredOrders = allOrders.filter(o => {
        const d = parseISO(o.date);
        const matchesDate = d >= start && d <= end;
        const matchesSeller = filters.sellerId && filters.sellerId !== 'all' ? o.sellerId === filters.sellerId : true;
        const matchesType = filters.type && filters.type !== 'Todos' ? o.type === filters.type : true;
        return matchesDate && matchesSeller && matchesType;
    });

    // 4. Calculations for Dashboard

    // KPIs (Card Header)
    // KPI Calculations
    // RULE (Item 20): Every Order must also count as a Budget.
    const orderList = filteredOrders.filter(o => o.type === 'Pedido');
    // For quoteCount, we count Orçamentos + Pedidos (representing the budget that led to the order)
    const quoteCount = filteredOrders.filter(o => o.type === 'Orçamento' || o.type === 'Pedido').length;

    const totalSold = orderList.reduce((acc, curr) => acc + curr.total, 0);
    const averageTicket = orderList.length > 0 ? totalSold / orderList.length : 0;

    // A2.1: Vendas por dia (Selected Interval)
    const daysInInterval = eachDayOfInterval({ start, end });
    const salesByDay = daysInInterval.map((day: Date) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayTotal = orderList
            .filter(o => o.date.startsWith(dayStr))
            .reduce((acc, curr) => acc + curr.total, 0);
        return { 
            date: format(day, 'dd/MM'), 
            fullDate: dayStr,
            value: dayTotal 
        };
    }).filter(d => {
        // Ensure strictly within interval
        const dObj = parseISO(d.fullDate);
        return dObj >= start && dObj <= end;
    });

    // A2.2: Vendas por vendedor
    const sellersMap = new Map(sellersList.map(s => [s.id, s.name]));
    const sellerTotals: Record<string, number> = {};

    orderList.forEach(o => {
        const name = o.sellerId ? (sellersMap.get(o.sellerId) || o.sellerName || 'Antigo/Inativo') : 'Não informado';
        sellerTotals[name] = (sellerTotals[name] || 0) + o.total;
    });

    const salesBySeller = Object.entries(sellerTotals)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // A2.3: Pedidos vs Orçamentos (Weekly Trend - last 8 weeks from 'end')
    const weeksInterval = eachWeekOfInterval({
        start: startOfWeek(subWeeks(end, 7)),
        end
    });
    const ordersVsQuotesWeekly = weeksInterval.map((week: Date) => {
        const weekStart = startOfWeek(week);
        const weekEnd = endOfDay(subDays(startOfWeek(subWeeks(week, -1)), 1));

        const weekOrders = filteredOrders.filter(o => {
            const d = parseISO(o.date);
            return o.type === 'Pedido' && d >= weekStart && d <= weekEnd;
        }).length;

        const weekQuotes = filteredOrders.filter(o => {
            const d = parseISO(o.date);
            // Count Orçamentos + Pedidos for this week too
            return (o.type === 'Orçamento' || o.type === 'Pedido') && d >= weekStart && d <= weekEnd;
        }).length;

        return {
            week: format(weekStart, 'dd/MM'),
            pedidos: weekOrders,
            orcamentos: weekQuotes
        };
    });

    // A3.1: Top products
    const productPerformance: Record<string, { quantity: number; total: number; price_bruto: number; price_benef: number }> = {};
    orderList.forEach(o => {
        o.items?.forEach(item => {
            const name = item.description;
            if (!productPerformance[name]) {
                productPerformance[name] = { 
                    quantity: 0, 
                    total: 0, 
                    price_bruto: item.unitPrice, 
                    price_benef: item.unitPrice 
                };
            }
            productPerformance[name].quantity += item.quantity;
            productPerformance[name].total += item.total;
        });
    });
    const topProducts = Object.entries(productPerformance)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.total - a.total);

    // --- B. REPORTS ANALYTICS ---

    // B1: General View (Trends)
    // If period is '12m', we use monthly interval. Otherwise we might want to show daily sales for the period.
    const monthlyInterval = eachMonthOfInterval({ start: startOfMonth(subMonths(end, 11)), end });
    const monthlyVendas = monthlyInterval.map((month: Date) => {
        const mStr = format(month, 'yyyy-MM');
        const monthOrders = allOrders.filter(o => o.type === 'Pedido' && o.date.startsWith(mStr));
        // Rule: Pedido counts as Orçamento
        const monthQuotesCount = allOrders.filter(o => (o.type === 'Orçamento' || o.type === 'Pedido') && o.date.startsWith(mStr)).length;

        const total = monthOrders.reduce((acc, curr) => acc + curr.total, 0);
        const ticket = monthOrders.length > 0 ? total / monthOrders.length : 0;

        return {
            month: format(month, 'MMM/yy'),
            vendas: total,
            pedidos: monthOrders.length,
            orcamentos: monthQuotesCount,
            ticket: ticket
        };
    });

    // B2: Sellers Report
    const sellerReport = sellersList.map(seller => {
        // Use filteredOrders but ensure we only count this seller's specific data within the period
        const userOrders = filteredOrders.filter(o => o.sellerId === seller.id && o.type === 'Pedido');
        const userQuotes = filteredOrders.filter(o => o.sellerId === seller.id && (o.type === 'Orçamento' || o.type === 'Pedido'));

        const total = userOrders.reduce((acc, curr) => acc + curr.total, 0);
        const ticket = userOrders.length > 0 ? total / userOrders.length : 0;
        const conversion = userQuotes.length > 0 ? (userOrders.length / userQuotes.length) * 100 : 0;

        return {
            name: seller.name,
            total,
            pedidos: userOrders.length,
            orcamentos: userQuotes.length,
            ticket,
            conversion
        };
    }).sort((a, b) => b.total - a.total);

    // B4: Clients Report
    const clientPerformance: Record<string, { total: number; count: number }> = {};
    orderList.forEach(o => {
        if (!clientPerformance[o.clientName]) clientPerformance[o.clientName] = { total: 0, count: 0 };
        clientPerformance[o.clientName].total += o.total;
        clientPerformance[o.clientName].count += 1;
    });
    const topClients = Object.entries(clientPerformance)
        .map(([name, stats]) => ({
            name,
            total: stats.total,
            pedidos: stats.count,
            ticket: stats.total / stats.count
        }))
        .sort((a, b) => b.pedidos - a.pedidos); // Sort by number of orders (Item 6)

    // Current Month KPIs
    const now = new Date();
    const currentMonthStr = format(now, 'yyyy-MM');
    const monthOrders = allOrders.filter(o => o.type === 'Pedido' && o.date.startsWith(currentMonthStr));
    const vendasMes = monthOrders.reduce((acc, curr) => acc + curr.total, 0);

    return {
        kpis: {
            totalSold,
            orderCount: orderList.length,
            quoteCount: quoteCount, // Using updated count
            averageTicket,
            vendasMes
        },
        salesByDay,
        salesBySeller,
        ordersVsQuotesWeekly,
        topProducts,
        monthlyVendas,
        sellerReport,
        topClients,
        rawOrders: filteredOrders
    };
};
