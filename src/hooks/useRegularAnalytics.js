import { useMemo } from 'react';

// Module-level constant — avoids array recreation inside every useMemo invocation
const ANALYTICS_CHANNELS = ["App", "Auto", "Website", "WhatsApp", "Outlet", "Call", "Student", "Referral"];

export function useRegularAnalytics(orders, dateFrom, dateTo) {
  return useMemo(() => {
    // 1. Filter to only regular orders
    // All cartdetails orders are regular customer orders (app, website, whatsapp etc.)
    // + orders manually logged by admin from this portal (b2b_admin_edits, type: "regular")
    const regularOrders = orders.filter(
      (o) =>
        o.source === 'cartdetails' ||
        (o.source === 'admin' && o.type === 'regular')
    );

    // 2. Parse dates for periods
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    
    const periodDurationMs = to.getTime() - from.getTime();
    
    // Previous period
    const prevFrom = new Date(from.getTime() - periodDurationMs);
    const prevTo = new Date(to.getTime() - periodDurationMs);

    const getOrderDate = (o) => {
      if (o.date) {
          let dateStr = o.date;
          const dmyMatch = dateStr.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
          if (dmyMatch) {
              const [, day, month, year] = dmyMatch;
              dateStr = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          }
          const d = new Date(dateStr);
          if (!isNaN(d)) return d;
      }
      if (o.createdAtRaw) {
          const d = typeof o.createdAtRaw.toDate === 'function' ? o.createdAtRaw.toDate() : new Date(o.createdAtRaw);
          if (!isNaN(d)) return d;
      }
      return new Date(0); // Treat missing/invalid date as epoch (historical) so it doesn't pollute current stats
    };

    // 3. Segment orders by timeframe
    const currentOrders = [];
    const previousOrders = [];
    const historicalOrders = []; // Orders before `dateFrom`

    regularOrders.forEach((order) => {
      const orderDate = getOrderDate(order);
      if (orderDate >= from && orderDate <= to) {
        currentOrders.push(order);
      }
      if (orderDate >= prevFrom && orderDate <= prevTo) {
        previousOrders.push(order);
      }
      if (orderDate < from) {
        historicalOrders.push(order);
      }
    });

    // Helper to get unique user identifier (prefer phone, fallback to name)
    const getUserId = (order) => order.customerNumber || order.customerName || 'unknown';

    // 4. Calculate User Metrics
    const allTimeUserMap = new Map();
    regularOrders.forEach(o => {
        const uid = getUserId(o);
        if (!allTimeUserMap.has(uid)) {
            allTimeUserMap.set(uid, { firstOrderDate: getOrderDate(o), orders: [], totalRevenue: 0 });
        }
        const user = allTimeUserMap.get(uid);
        const oDate = getOrderDate(o);
        if (oDate < user.firstOrderDate) user.firstOrderDate = oDate;
        user.orders.push(o);
        user.totalRevenue += (o.amount || 0);
    });

    const totalUsersCount = allTimeUserMap.size;

    const currentUsersMap = new Map();
    currentOrders.forEach(o => currentUsersMap.set(getUserId(o), o));
    const activeUsersCount = currentUsersMap.size;
    const uniqueUsersCount = activeUsersCount;

    const previousUsersMap = new Map();
    previousOrders.forEach(o => previousUsersMap.set(getUserId(o), o));

    const historicalUsersMap = new Map();
    historicalOrders.forEach(o => historicalUsersMap.set(getUserId(o), o));

    // New Users: First order was during current period
    const newUsers = [];
    // Returning Users: Active in current, and active in historical
    const returningUsers = [];
    // Retention Users: Active in previous, and active in current
    const retentionUsers = [];
    // Lost Users: Active in historical, but NOT in current
    const lostUsers = [];
    // Dormant Users: No orders in the last 30 days from `to` date
    const dormantUsers = [];

    const thirtyDaysBeforeTo = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const [uid, userMeta] of allTimeUserMap.entries()) {
        const inCurrent = currentUsersMap.has(uid);
        const inHistorical = historicalUsersMap.has(uid);
        const inPrevious = previousUsersMap.has(uid);

        // Safe reduce instead of Math.max(...spread) — spread on large arrays risks a stack overflow
        const lastOrderDate = new Date(
          userMeta.orders.reduce((max, o) => {
            const t = getOrderDate(o).getTime();
            return t > max ? t : max;
          }, 0)
        );

        const userObj = {
            id: uid,
            name: userMeta.orders[0]?.customerName || 'Unknown',
            phone: userMeta.orders[0]?.customerNumber || 'No Contact',
            address: userMeta.orders[0]?.address || '',
            firstOrderDate: (!isNaN(userMeta.firstOrderDate) ? userMeta.firstOrderDate : new Date(0)).toISOString().split('T')[0],
            lastOrderDate: (!isNaN(lastOrderDate) ? lastOrderDate : new Date(0)).toISOString().split('T')[0],
            totalOrders: userMeta.orders.length,
            totalRevenue: userMeta.totalRevenue,
            daysSinceLastOrder: !isNaN(lastOrderDate) ? Math.floor((to.getTime() - lastOrderDate.getTime()) / (1000 * 3600 * 24)) : 0
        };

        if (inCurrent && !inHistorical) {
            newUsers.push(userObj);
        }
        if (inCurrent && inHistorical) {
            returningUsers.push(userObj);
        }
        if (inCurrent && inPrevious) {
            retentionUsers.push(userObj);
        }
        if (inHistorical && !inCurrent) {
            lostUsers.push(userObj);
        }
        if (lastOrderDate < thirtyDaysBeforeTo) {
            dormantUsers.push(userObj);
        }
    }

    // 5. Calculate Revenue & Order Metrics
    const currentRevenue = currentOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const previousRevenue = previousOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const currentKg = currentOrders.reduce((sum, o) => sum + (o.weight || 0), 0);
    
    const aov = currentOrders.length > 0 ? currentRevenue / currentOrders.length : 0;
    const arpu = activeUsersCount > 0 ? currentRevenue / activeUsersCount : 0;
    const revenueGrowth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : (currentRevenue > 0 ? 100 : 0);
    const revenuePerKg = currentKg > 0 ? currentRevenue / currentKg : 0;

    // CLV: Historical revenue / Total Users
    const clv = totalUsersCount > 0 ? Array.from(allTimeUserMap.values()).reduce((s, u) => s + u.totalRevenue, 0) / totalUsersCount : 0;

    // Churn Rate: Lost Users / Historical Users
    const churnRate = historicalUsersMap.size > 0 ? (lostUsers.length / historicalUsersMap.size) * 100 : 0;
    const retentionRate = previousUsersMap.size > 0 ? (retentionUsers.length / previousUsersMap.size) * 100 : 0;
    const repeatPurchaseRate = activeUsersCount > 0 ? (returningUsers.length / activeUsersCount) * 100 : 0;
    const avgOrdersPerUser = activeUsersCount > 0 ? currentOrders.length / activeUsersCount : 0;

    // Order Stats
    const totalOrdersCount = currentOrders.length;
    const completedOrdersCount = currentOrders.filter(o => o.status === 'Delivered' || o.status === 'Pickup Done').length;
    const cancelledOrdersCount = currentOrders.filter(o => o.status === 'Cancelled').length;
    const failedOrdersCount = currentOrders.filter(o => o.status === 'Failed').length; // Assuming these status might exist
    
    // Average processing time (TAT) -> approximate
    const ordersWithTat = currentOrders.filter(o => o.createdAtRaw && o.updatedAtRaw);
    let totalTatMs = 0;
    ordersWithTat.forEach(o => {
        const start = typeof o.createdAtRaw.toDate === 'function' ? o.createdAtRaw.toDate() : new Date(o.createdAtRaw);
        const end = typeof o.updatedAtRaw.toDate === 'function' ? o.updatedAtRaw.toDate() : new Date(o.updatedAtRaw);
        totalTatMs += (end - start);
    });
    const avgTatMs = ordersWithTat.length > 0 ? totalTatMs / ordersWithTat.length : 0;
    const avgTatHours = avgTatMs / (1000 * 60 * 60);

    // 6. Channel Analytics
    const channelStats = Object.fromEntries(
      ANALYTICS_CHANNELS.map(c => [c, { orders: 0, revenue: 0, uniqueUsers: new Set(), newUsers: 0, returningUsers: 0 }])
    );

    // Build a Set of new user IDs for O(1) lookup instead of Array.some() per order
    const newUserIdSet = new Set(newUsers.map(u => u.id));

    currentOrders.forEach(o => {
        const channel = o.channel || 'App';
        if (channelStats[channel]) {
            channelStats[channel].orders += 1;
            channelStats[channel].revenue += (o.amount || 0);
            const uid = getUserId(o);
            channelStats[channel].uniqueUsers.add(uid);
            // O(1) Set lookup instead of O(n) Array.some()
            if (newUserIdSet.has(uid)) {
                channelStats[channel].newUsers += 1;
            } else {
                channelStats[channel].returningUsers += 1;
            }
        }
    });

    const channelData = ANALYTICS_CHANNELS.map(c => ({
        channel: c,
        orders: channelStats[c].orders,
        revenue: channelStats[c].revenue,
        uniqueUsers: channelStats[c].uniqueUsers.size,
        newUsers: channelStats[c].newUsers,
        returningUsers: channelStats[c].returningUsers,
        aov: channelStats[c].orders > 0 ? channelStats[c].revenue / channelStats[c].orders : 0
    }));

    // 7. Graph Trends
    const dailyRevenueMap = new Map();
    const dailyOrdersMap = new Map();
    currentOrders.forEach(o => {
        const dateStr = o.date;
        dailyRevenueMap.set(dateStr, (dailyRevenueMap.get(dateStr) || 0) + (o.amount || 0));
        dailyOrdersMap.set(dateStr, (dailyOrdersMap.get(dateStr) || 0) + 1);
    });
    
    // Sort dates for graphs
    const graphDates = Array.from(new Set([...dailyRevenueMap.keys(), ...dailyOrdersMap.keys()])).sort();
    
    const dailyTrends = graphDates.map(d => ({
        date: d,
        revenue: dailyRevenueMap.get(d) || 0,
        orders: dailyOrdersMap.get(d) || 0,
    }));

    return {
        // Users
        totalUsersCount,
        activeUsersCount,
        uniqueUsersCount,
        newUsersCount: newUsers.length,
        returningUsersCount: returningUsers.length,
        retentionUsersCount: retentionUsers.length,
        dormantUsersCount: dormantUsers.length,
        lostUsersCount: lostUsers.length,
        
        // Lists
        newUsers,
        returningUsers,
        retentionUsers,
        dormantUsers,
        lostUsers,
        activeUsersList: Array.from(currentUsersMap.values()).map(o => ({
            id: getUserId(o),
            name: o.customerName,
            phone: o.customerNumber,
            totalOrders: allTimeUserMap.get(getUserId(o))?.orders.length || 1,
            totalRevenue: allTimeUserMap.get(getUserId(o))?.totalRevenue || (o.amount || 0),
            lastOrderDate: getOrderDate(o).toISOString().split('T')[0]
        })).filter((v, i, a) => a.findIndex(t => t.id === v.id) === i), // Distinct

        // Metrics
        currentRevenue,
        previousRevenue,
        currentKg,
        aov,
        arpu,
        revenueGrowth,
        revenuePerKg,
        clv,
        churnRate,
        retentionRate,
        repeatPurchaseRate,
        avgOrdersPerUser,

        // Order Stats
        totalOrdersCount,
        completedOrdersCount,
        cancelledOrdersCount,
        failedOrdersCount,
        avgTatHours,

        // Channel
        channelData,
        
        // Trends
        dailyTrends,
        
        // Raw Data mapping
        currentOrders,
        previousOrders
    };
  }, [orders, dateFrom, dateTo]);
}
