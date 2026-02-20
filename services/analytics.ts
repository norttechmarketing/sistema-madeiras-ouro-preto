
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
    period: '7' | '30' | '90' | '12m' | 'custom' | 'day';
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
        case 'custom': start = filters.startDate || startOfDay(subDays(end, 29)); break;
        default: start = startOfDay(subDays(end, 29));
    }

    // 2. Fetch Data from Supabase
    // We fetch a bit more to handle monthly comparisons if needed, but primarily the selected range
    let query = supabase
        .from('orders')
        .select('*, items:order_items(*)');

    // RBAC: Non-admins only see their own data
    if (currentUser.role !== 'admin') {
        query = query.eq('seller_id', currentUser.id);
    }

    // Optimize: Filter by date at DB level if possible (date is ISO string)
    query = query.gte('date', start.toISOString()).lte('date', end.toISOString());

    const { data: rawOrders, error } = await query;
    if (error) {
        console.error("Analytics fetch error:", error);
        return null;
    }

    // Normalize Data
    const orders: Order[] = (rawOrders || []).map((row: any) => ({
        id: row.id,
        clientId: row.client_id,
        clientName: row.client_name,
        sellerId: row.seller_id,
        sellerName: row.seller_name,
        date: row.date,
        status: row.status,
        type: row.type,
        subtotal: Number(row.subtotal),
        totalDiscount: Number(row.total_discount),
        total: Number(row.total),
        items: (row.items || []).map((item: any) => ({
            id: item.id,
            productId: item.product_id,
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unit_price),
            total: Number(item.total)
        }))
    } as any));

    // 3. Apply Filters (Seller, Type)
    const filteredOrders = orders.filter(o => {
        const matchesSeller = filters.sellerId && filters.sellerId !== 'all' ? o.sellerId === filters.sellerId : true;
        const matchesType = filters.type && filters.type !== 'Todos' ? o.type === filters.type : true;
        return matchesSeller && matchesType;
    });

    // 4. Calculations for Dashboard

    // KPIs (Card Header)
    const orderList = filteredOrders.filter(o => o.type === 'Pedido');
    const quoteList = filteredOrders.filter(o => o.type === 'Orçamento');

    const totalSold = orderList.reduce((acc, curr) => acc + curr.total, 0);
    const averageTicket = orderList.length > 0 ? totalSold / orderList.length : 0;

    // A2.1: Vendas por dia (30 dias)
    const daysInInterval = eachDayOfInterval({ start, end });
    const salesByDay = daysInInterval.map((day: Date) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayTotal = orderList
            .filter(o => o.date.startsWith(dayStr))
            .reduce((acc, curr) => acc + curr.total, 0);
        return { date: format(day, 'dd/MM'), value: dayTotal };
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

    // A2.3: Pedidos vs Orçamentos (8 semanas)
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
            return o.type === 'Orçamento' && d >= weekStart && d <= weekEnd;
        }).length;

        return {
            week: format(weekStart, 'dd/MM'),
            pedidos: weekOrders,
            orcamentos: weekQuotes
        };
    });

    // A3.1: Top 5 produtos
    const productPerformance: Record<string, { quantity: number; total: number }> = {};
    orderList.forEach(o => {
        o.items?.forEach(item => {
            const name = item.description;
            if (!productPerformance[name]) productPerformance[name] = { quantity: 0, total: 0 };
            productPerformance[name].quantity += item.quantity;
            productPerformance[name].total += item.total;
        });
    });
    const topProducts = Object.entries(productPerformance)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    // A3.2: Status dos pedidos
    const statusCounts: Record<string, number> = {};
    orderList.forEach(o => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });
    const statusDistribution = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    // --- B. RELATÓRIOS ANALYTICS ---

    // B1: Visão Geral (12 meses)
    const monthlyInterval = eachMonthOfInterval({ start: startOfMonth(subMonths(end, 11)), end });
    const monthlyVendas = monthlyInterval.map((month: Date) => {
        const mStr = format(month, 'yyyy-MM');
        const monthOrders = orders.filter(o => o.type === 'Pedido' && o.date.startsWith(mStr));
        const monthQuotes = orders.filter(o => o.type === 'Orçamento' && o.date.startsWith(mStr));

        const total = monthOrders.reduce((acc, curr) => acc + curr.total, 0);
        const ticket = monthOrders.length > 0 ? total / monthOrders.length : 0;

        return {
            month: format(month, 'MMM/yy'),
            vendas: total,
            pedidos: monthOrders.length,
            orcamentos: monthQuotes.length,
            ticket: ticket
        };
    });

    // B2: Vendedores
    const sellerReport = sellersList.map(seller => {
        const userOrders = filteredOrders.filter(o => o.sellerId === seller.id && o.type === 'Pedido');
        const userQuotes = filteredOrders.filter(o => o.sellerId === seller.id && o.type === 'Orçamento');

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

    // Add "Não informado" if there are orders with null sellerId
    const unassignedOrders = filteredOrders.filter(o => !o.sellerId && o.type === 'Pedido');
    if (unassignedOrders.length > 0) {
        const total = unassignedOrders.reduce((acc, curr) => acc + curr.total, 0);
        sellerReport.push({
            name: 'Não informado',
            total,
            pedidos: unassignedOrders.length,
            orcamentos: filteredOrders.filter(o => !o.sellerId && o.type === 'Orçamento').length,
            ticket: total / unassignedOrders.length,
            conversion: 0
        });
    }

    // B4: Clientes
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
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    // Monthly Sales (current calendar month)
    const now = new Date();
    const currentMonthStr = format(now, 'yyyy-MM');
    const monthOrders = orders.filter(o => o.type === 'Pedido' && o.date.startsWith(currentMonthStr));
    const vendasMes = monthOrders.reduce((acc, curr) => acc + curr.total, 0);

    return {
        kpis: {
            totalSold,
            orderCount: orderList.length,
            quoteCount: quoteList.length,
            averageTicket,
            vendasMes
        },
        salesByDay,
        salesBySeller,
        ordersVsQuotesWeekly,
        topProducts,
        statusDistribution,
        // Extensions for Reports
        monthlyVendas,
        sellerReport,
        topClients,
        rawOrders: filteredOrders
    };
};
