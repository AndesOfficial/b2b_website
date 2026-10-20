import React, { useMemo, useState } from 'react';
import {
  FiCalendar,
  FiTrendingUp,
  FiShoppingBag,
  FiUsers,
  FiDollarSign,
  FiPieChart,
  FiLayers,
  FiDownload,
  FiSmartphone,
  FiSearch,
  FiActivity,
  FiCheckCircle,
  FiClock,
  FiPackage,
  FiArrowUpRight,
  FiArrowDownRight,
  FiRefreshCw,
} from 'react-icons/fi';
import { BiRupee } from 'react-icons/bi';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import EmptyState from './Shared/EmptyState';
import { ACQUISITION_SOURCES, SOURCE_COLORS } from '../api/customerAcquisitionApi';
import { getCustomerKey } from '../api/customerAcquisitionApi';

// Standard Category Colors
const SEGMENT_COLORS = {
  'B2C Retail': '#3B82F6',
  'Student Laundry': '#10B981',
  'Commercial Linen': '#8B5CF6',
  'Hotel / Airbnb': '#F59E0B',
};

// Date helper functions
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDaysAgoStr(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return dateStr;
}

// ── Accurate Service Classifier ──────────────────────────────────────────────
function classifyServiceItem(itemStr, fallback = 'Other') {
  const s = String(itemStr || '').toLowerCase().trim();
  if (!s) return fallback;

  if (s.includes('wash') && (s.includes('iron') || s.includes('press') || s.includes('steam'))) return 'Wash & Steam Iron';
  if (s.includes('wash') && s.includes('fold')) return 'Wash & Fold';
  if (s.includes('iron') || s.includes('press') || s.includes('steam')) return 'Steam Press Only';
  if (s.includes('dry') || s.includes('suit') || s.includes('blazer') || s.includes('coat')) return 'Dry Cleaning & Suits';
  if (s.includes('bed') || s.includes('blanket') || s.includes('duvet') || s.includes('quilt') || s.includes('curtain') || s.includes('towel') || s.includes('linen')) {
    return 'Bedding & Heavy Linens';
  }
  if (s.includes('shoe') || s.includes('sneaker') || s.includes('sports') || s.includes('loafer') || s.includes('boot')) {
    return 'Shoe & Sneaker Care';
  }
  if (s.includes('saree') || s.includes('kurta') || s.includes('lehenga') || s.includes('sherwani') || s.includes('silk')) {
    return 'Ethnic & Delicates';
  }
  if (s.includes('shirt') || s.includes('pant') || s.includes('jeans') || s.includes('top') || s.includes('t-shirt') || s.includes('trouser')) {
    return 'Individual Garments';
  }
  return 'General Laundry';
}

// ── Custom Tooltip for Recharts ──────────────────────────────────────────────
const CustomChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0F172A] text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs">
        <p className="font-bold text-slate-300 mb-1.5">{label}</p>
        {payload.map((entry, idx) => (
          <div key={`item-${idx}`} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}:
            </span>
            <span className="font-extrabold text-white">
              {entry.name.includes('Revenue') ? `₹${Math.round(entry.value).toLocaleString('en-IN')}` : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function AdminAnalyticsTab({
  orders = [],
  allOrders = [],
  screens = [],
  searches = [],
  totalUsers = 0,
  currentDateFrom,
  currentDateTo,
  onDateRangeChange,
}) {
  // Navigation tabs within Analytics
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'channels' | 'services' | 'retention' | 'app'
  
  // Date Preset Filter State
  const [datePreset, setDatePreset] = useState('month'); // 'today' | 'week' | 'month' | 'quarter' | 'all' | 'custom'
  const [localFrom, setLocalFrom] = useState(() => currentDateFrom || getMonthStartStr());
  const [localTo, setLocalTo] = useState(() => currentDateTo || getTodayStr());
  const [showCustomModal, setShowCustomModal] = useState(false);

  // Sync date changes upstream if provided
  const handlePresetSelect = (preset) => {
    setDatePreset(preset);
    const today = getTodayStr();
    let from = today;
    let to = today;

    if (preset === 'today') {
      from = today;
      to = today;
    } else if (preset === 'week') {
      from = getDaysAgoStr(6);
      to = today;
    } else if (preset === 'month') {
      from = getMonthStartStr();
      to = today;
    } else if (preset === 'quarter') {
      from = getDaysAgoStr(89);
      to = today;
    } else if (preset === 'all') {
      from = '2025-01-01';
      to = today;
    } else if (preset === 'custom') {
      setShowCustomModal(true);
      return;
    }

    setLocalFrom(from);
    setLocalTo(to);
    if (onDateRangeChange) onDateRangeChange(from, to);
  };

  const handleCustomApply = () => {
    setShowCustomModal(false);
    setDatePreset('custom');
    if (onDateRangeChange) onDateRangeChange(localFrom, localTo);
  };

  // Base pool of orders to use
  const ordersPool = allOrders && allOrders.length > 0 ? allOrders : orders;

  // ── 1. Strict Sanitization to Eliminate Anomalies ──────────────────────────
  const { currentPeriodOrders, previousPeriodOrders, allTimeValidOrders } = useMemo(() => {
    const EXCLUDED_STATUSES = new Set(['cancelled', 'canceled', 'abandoned']);

    const isValidOrder = (o) => {
      if (!o || o.isDeleted) return false;
      if (o.type === 'rider_tracking' || o.category === 'RIDER_TRACKING') return false;
      if (o.type === 'issue' || o.category === 'ISSUES') return false;
      if (o.isB2bRoomSync) return false;

      const st = String(o.status || '').toLowerCase().trim();
      if (EXCLUDED_STATUSES.has(st) || o.type === 'abandoned') return false;
      return true;
    };

    const validAll = ordersPool.filter(isValidOrder);

    // Compute previous period dates for period-over-period comparison
    const fromDate = new Date(localFrom);
    const toDate = new Date(localTo);
    const durationMs = Math.max(86400000, toDate.getTime() - fromDate.getTime());
    const prevFromDate = new Date(fromDate.getTime() - durationMs);
    const prevToDate = new Date(fromDate.getTime() - 86400000);
    const prevFromStr = prevFromDate.toISOString().split('T')[0];
    const prevToStr = prevToDate.toISOString().split('T')[0];

    const current = validAll.filter((o) => {
      const d = o.date || o.pickupDate || (o.createdAtRaw ? String(o.createdAtRaw).slice(0, 10) : '');
      if (!d) return true;
      if (localFrom && d < localFrom) return false;
      if (localTo && d > localTo) return false;
      return true;
    });

    const previous = validAll.filter((o) => {
      const d = o.date || o.pickupDate || (o.createdAtRaw ? String(o.createdAtRaw).slice(0, 10) : '');
      if (!d) return false;
      return d >= prevFromStr && d <= prevToStr;
    });

    return {
      currentPeriodOrders: current,
      previousPeriodOrders: previous,
      allTimeValidOrders: validAll,
    };
  }, [ordersPool, localFrom, localTo]);

  // ── 2. Executive KPIs Calculation ──────────────────────────────────────────
  const kpis = useMemo(() => {
    let grossRevenue = 0;
    let b2cRevenue = 0;
    let b2bRevenue = 0;
    let totalKg = 0;
    let completedOrders = 0;
    const customerMap = new Map();

    currentPeriodOrders.forEach((o) => {
      const amt = Number(o.amount) || 0;
      const wt = Number(o.weight || o.kg) || 0;
      grossRevenue += amt;
      totalKg += wt;

      const isB2C = o.type === 'regular' || o.category === 'B2C_RETAIL' || o.source === 'cartdetails' || o.source === 'website';
      if (isB2C) b2cRevenue += amt;
      else b2bRevenue += amt;

      const st = String(o.status || '').toLowerCase();
      if (st === 'delivered' || st === 'completed' || st === 'pickup done') {
        completedOrders += 1;
      }

      const key = getCustomerKey(o);
      if (key && key !== 'unknown') {
        if (!customerMap.has(key)) customerMap.set(key, 0);
        customerMap.set(key, customerMap.get(key) + 1);
      }
    });

    // Previous period revenue for growth
    const prevRevenue = previousPeriodOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const revenueGrowth = prevRevenue > 0
      ? ((grossRevenue - prevRevenue) / prevRevenue) * 100
      : (grossRevenue > 0 ? 100 : 0);

    const totalOrders = currentPeriodOrders.length;
    const aov = totalOrders > 0 ? grossRevenue / totalOrders : 0;
    const uniqueCustomers = customerMap.size;
    const arpu = uniqueCustomers > 0 ? grossRevenue / uniqueCustomers : 0;
    const revPerKg = totalKg > 0 ? grossRevenue / totalKg : 0;
    const deliveryRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    // Customer Repeat vs New in this period
    let repeatCustomersCount = 0;
    customerMap.forEach((orderCount) => {
      if (orderCount > 1) repeatCustomersCount += 1;
    });
    const repeatRate = uniqueCustomers > 0 ? (repeatCustomersCount / uniqueCustomers) * 100 : 0;

    return {
      grossRevenue: Math.round(grossRevenue),
      b2cRevenue: Math.round(b2cRevenue),
      b2bRevenue: Math.round(b2bRevenue),
      revenueGrowth,
      prevRevenue: Math.round(prevRevenue),
      totalOrders,
      completedOrders,
      deliveryRate: Math.round(deliveryRate),
      uniqueCustomers,
      repeatRate: Math.round(repeatRate),
      aov: Math.round(aov),
      arpu: Math.round(arpu),
      totalKg: Math.round(totalKg * 100) / 100,
      revPerKg: Math.round(revPerKg),
      avgKgPerOrder: totalOrders > 0 ? Math.round((totalKg / totalOrders) * 10) / 10 : 0,
    };
  }, [currentPeriodOrders, previousPeriodOrders]);

  // ── 3. Time Series Chart Data (Daily Trend) ────────────────────────────────
  const timeSeriesData = useMemo(() => {
    const dailyMap = new Map();

    currentPeriodOrders.forEach((o) => {
      const d = o.date || o.pickupDate || (o.createdAtRaw ? String(o.createdAtRaw).slice(0, 10) : 'Other');
      if (!dailyMap.has(d)) {
        dailyMap.set(d, { date: d, revenue: 0, orders: 0, b2c: 0, b2b: 0 });
      }
      const entry = dailyMap.get(d);
      const amt = Number(o.amount) || 0;
      entry.revenue += amt;
      entry.orders += 1;

      const isB2C = o.type === 'regular' || o.category === 'B2C_RETAIL' || o.source === 'cartdetails' || o.source === 'website';
      if (isB2C) entry.b2c += amt;
      else entry.b2b += amt;
    });

    return Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        ...item,
        formattedDate: item.date === 'Other' ? 'Other' : formatDisplayDate(item.date).replace(/, \d{4}/, ''),
        revenue: Math.round(item.revenue),
      }));
  }, [currentPeriodOrders]);

  // ── 4. Business Segment Revenue Distribution ───────────────────────────────
  const segmentData = useMemo(() => {
    let b2c = 0;
    let student = 0;
    let linen = 0;
    let hotel = 0;

    currentPeriodOrders.forEach((o) => {
      const amt = Number(o.amount) || 0;
      const cat = String(o.category || '').toUpperCase();
      const tp = String(o.type || '').toLowerCase();
      const prop = String(o.property || o.client || '').toLowerCase();

      if (cat === 'B2C_RETAIL' || tp === 'regular' || o.source === 'cartdetails' || o.source === 'website') {
        b2c += amt;
      } else if (cat === 'STUDENT_LAUNDRY' || tp === 'student' || prop.includes('hostel')) {
        student += amt;
      } else if (cat === 'LINEN' || tp === 'linen' || prop.includes('one 8') || prop.includes('zolo')) {
        linen += amt;
      } else if (cat === 'AIRBNB' || tp === 'airbnb' || prop.includes('airbnb') || prop.includes('hotel')) {
        hotel += amt;
      } else {
        b2c += amt; // Default retail fallback
      }
    });

    const total = b2c + student + linen + hotel || 1;
    return [
      { name: 'B2C Retail', value: Math.round(b2c), percentage: Math.round((b2c / total) * 100), color: SEGMENT_COLORS['B2C Retail'] },
      { name: 'Student Laundry', value: Math.round(student), percentage: Math.round((student / total) * 100), color: SEGMENT_COLORS['Student Laundry'] },
      { name: 'Commercial Linen', value: Math.round(linen), percentage: Math.round((linen / total) * 100), color: SEGMENT_COLORS['Commercial Linen'] },
      { name: 'Hotel / Airbnb', value: Math.round(hotel), percentage: Math.round((hotel / total) * 100), color: SEGMENT_COLORS['Hotel / Airbnb'] },
    ].filter((s) => s.value > 0);
  }, [currentPeriodOrders]);

  // ── 5. Channel Performance Breakdown ───────────────────────────────────────
  const channelPerformance = useMemo(() => {
    const channelMap = new Map();

    currentPeriodOrders.forEach((o) => {
      const channel = o.orderChannel || o.channel || (o.source === 'website' ? 'Website' : (o.source === 'cartdetails' ? 'App' : 'Direct / Walk-in'));
      if (!channelMap.has(channel)) {
        channelMap.set(channel, {
          channel,
          orders: 0,
          revenue: 0,
          weight: 0,
          customers: new Set(),
        });
      }
      const c = channelMap.get(channel);
      c.orders += 1;
      c.revenue += Number(o.amount) || 0;
      c.weight += Number(o.weight || o.kg) || 0;

      const custKey = getCustomerKey(o);
      if (custKey) c.customers.add(custKey);
    });

    const totalRev = kpis.grossRevenue || 1;
    return Array.from(channelMap.values())
      .map((c) => ({
        channel: c.channel,
        orders: c.orders,
        revenue: Math.round(c.revenue),
        revenueShare: Math.round((c.revenue / totalRev) * 100),
        weight: Math.round(c.weight * 10) / 10,
        uniqueCustomers: c.customers.size,
        aov: c.orders > 0 ? Math.round(c.revenue / c.orders) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [currentPeriodOrders, kpis.grossRevenue]);

  // ── 6. Service Category Distribution ───────────────────────────────────────
  const serviceBreakdown = useMemo(() => {
    const catStats = {
      'Wash & Steam Iron': { count: 0, revenue: 0, kg: 0 },
      'Wash & Fold': { count: 0, revenue: 0, kg: 0 },
      'Steam Press Only': { count: 0, revenue: 0, kg: 0 },
      'Dry Cleaning & Suits': { count: 0, revenue: 0, kg: 0 },
      'Bedding & Heavy Linens': { count: 0, revenue: 0, kg: 0 },
      'Shoe & Sneaker Care': { count: 0, revenue: 0, kg: 0 },
      'Ethnic & Delicates': { count: 0, revenue: 0, kg: 0 },
      'General Laundry': { count: 0, revenue: 0, kg: 0 },
    };

    currentPeriodOrders.forEach((o) => {
      let categorizedInOrder = false;

      // 1. Inspect breakdown arrays if available
      if (Array.isArray(o.serviceBreakdown) && o.serviceBreakdown.length > 0) {
        o.serviceBreakdown.forEach((item) => {
          const category = classifyServiceItem(item.name || item.service || o.service);
          const qty = Number(item.quantity) || 1;
          const subtotal = Number(item.subtotal || item.amount) || 0;
          if (catStats[category]) {
            catStats[category].count += qty;
            catStats[category].revenue += subtotal;
            categorizedInOrder = true;
          }
        });
      }

      // 2. Inspect breakdown.perKg or perPiece
      if (o.breakdown?.perKg?.items && Array.isArray(o.breakdown.perKg.items)) {
        o.breakdown.perKg.items.forEach((it) => {
          const category = classifyServiceItem(it.name);
          const wt = Number(it.weight) || 0;
          const amt = Number(it.amount) || 0;
          if (catStats[category]) {
            catStats[category].count += 1;
            catStats[category].kg += wt;
            catStats[category].revenue += amt;
            categorizedInOrder = true;
          }
        });
      }

      if (o.breakdown?.perPiece?.items && Array.isArray(o.breakdown.perPiece.items)) {
        o.breakdown.perPiece.items.forEach((it) => {
          const category = classifyServiceItem(it.name);
          const qty = Number(it.quantity) || 1;
          const amt = Number(it.subtotal) || 0;
          if (catStats[category]) {
            catStats[category].count += qty;
            catStats[category].revenue += amt;
            categorizedInOrder = true;
          }
        });
      }

      // 3. Fallback to order-level service string
      if (!categorizedInOrder) {
        const category = classifyServiceItem(o.service || o.serviceBreakdownSummary || 'General Laundry');
        if (catStats[category]) {
          catStats[category].count += 1;
          catStats[category].revenue += Number(o.amount) || 0;
          catStats[category].kg += Number(o.weight || o.kg) || 0;
        }
      }
    });

    const totalOrders = currentPeriodOrders.length || 1;
    return Object.entries(catStats)
      .map(([name, data]) => ({
        name,
        orders: data.count,
        revenue: Math.round(data.revenue),
        kg: Math.round(data.kg * 10) / 10,
        volumeShare: Math.round((data.count / totalOrders) * 100),
      }))
      .filter((s) => s.orders > 0 || s.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [currentPeriodOrders]);

  // ── 7. Customer Retention & Unit Economics Cohorts ──────────────────────────
  const retentionMetrics = useMemo(() => {
    const customerOrderCounts = new Map();
    const customerLifetimeRevenue = new Map();

    allTimeValidOrders.forEach((o) => {
      const key = getCustomerKey(o);
      if (key && key !== 'unknown') {
        customerOrderCounts.set(key, (customerOrderCounts.get(key) || 0) + 1);
        customerLifetimeRevenue.set(key, (customerLifetimeRevenue.get(key) || 0) + (Number(o.amount) || 0));
      }
    });

    const totalKnownCustomers = customerOrderCounts.size || 1;
    let singleOrderCustomers = 0;
    let twoToThreeOrders = 0;
    let loyalCustomers = 0; // 4+ orders
    let totalLtvRevenue = 0;

    customerOrderCounts.forEach((count, key) => {
      if (count === 1) singleOrderCustomers += 1;
      else if (count <= 3) twoToThreeOrders += 1;
      else loyalCustomers += 1;

      totalLtvRevenue += (customerLifetimeRevenue.get(key) || 0);
    });

    const averageLtv = totalLtvRevenue / totalKnownCustomers;
    const overallRepeatRate = ((twoToThreeOrders + loyalCustomers) / totalKnownCustomers) * 100;

    return {
      totalCustomers: totalKnownCustomers,
      singleOrderCustomers,
      singleOrderPercent: Math.round((singleOrderCustomers / totalKnownCustomers) * 100),
      twoToThreeOrders,
      twoToThreePercent: Math.round((twoToThreeOrders / totalKnownCustomers) * 100),
      loyalCustomers,
      loyalPercent: Math.round((loyalCustomers / totalKnownCustomers) * 100),
      averageLtv: Math.round(averageLtv),
      overallRepeatRate: Math.round(overallRepeatRate),
    };
  }, [allTimeValidOrders]);

  // ── 8. Cleansed Mobile App Screens & Popular Searches ───────────────────────
  const cleanedScreens = useMemo(() => {
    return screens
      .map((s) => ({
        id: s.id,
        name: String(s.screenName || s.id).replace(/^\//, '').replace(/Screen$/, '').replace(/([A-Z])/g, ' $1').trim(),
        visits: Number(s.visitCount) || 0,
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 8);
  }, [screens]);

  const cleanedSearches = useMemo(() => {
    const total = searches.reduce((s, q) => s + (Number(q.count) || 1), 0) || 1;
    return searches
      .filter((s) => {
        const q = String(s.query || '').trim();
        return q.length >= 3 && !/^w{2,}/i.test(q); // filter keystroke typos
      })
      .map((s) => ({
        id: s.id,
        query: String(s.query || s.id).trim(),
        count: Number(s.count) || 1,
        share: Math.round(((Number(s.count) || 1) / total) * 100),
      }))
      .slice(0, 10);
  }, [searches]);

  // ── CSV Export Function ────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const headers = ['Category / Channel', 'Type', 'Orders', 'Revenue (INR)', 'Weight (KG)', 'AOV (INR)'];
    const rows = [];

    // Summary KPIs
    rows.push(['Period Summary', `${localFrom} to ${localTo}`, kpis.totalOrders, kpis.grossRevenue, kpis.totalKg, kpis.aov]);

    // Channel Performance
    channelPerformance.forEach((c) => {
      rows.push([c.channel, 'Channel', c.orders, c.revenue, c.weight, c.aov]);
    });

    // Service Breakdown
    serviceBreakdown.forEach((s) => {
      rows.push([s.name, 'Service', s.orders, s.revenue, s.kg, Math.round(s.orders > 0 ? s.revenue / s.orders : 0)]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Andes_Analytics_${localFrom}_to_${localTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      
      {/* ── TOP BAR: Title, Live Status, Date Filter Presets & Export ───────── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">Business Analytics & KPIs</h2>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Synced
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Dynamic revenue, unit economics, channel acquisition, and retention cohorts.
          </p>
        </div>

        {/* Date Filter & Export Strip */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            {[
              { id: 'today', label: 'Today' },
              { id: 'week', label: '7D' },
              { id: 'month', label: 'This Month' },
              { id: 'quarter', label: '90D' },
              { id: 'all', label: 'All' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetSelect(p.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  datePreset === p.id
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCustomModal(true)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                datePreset === 'custom'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FiCalendar size={13} />
              Custom
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-colors"
          >
            <FiDownload size={14} className="text-slate-500" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Active Date Banner */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-xs text-slate-600 font-semibold">
        <div className="flex items-center gap-2">
          <FiCalendar className="text-blue-500" size={14} />
          <span>Active Period:</span>
          <span className="font-extrabold text-slate-900">{formatDisplayDate(localFrom)} – {formatDisplayDate(localTo)}</span>
        </div>
        <span className="text-[11px] text-slate-500">{kpis.totalOrders} total orders processed</span>
      </div>

      {/* ── 5 EXECUTIVE KPI CARDS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Gross Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Revenue</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <BiRupee size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            ₹{kpis.grossRevenue.toLocaleString('en-IN')}
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">B2C: ₹{kpis.b2cRevenue.toLocaleString('en-IN')}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500">B2B: ₹{kpis.b2bRevenue.toLocaleString('en-IN')}</span>
          </div>
          {kpis.revenueGrowth !== 0 && (
            <div className={`mt-1.5 flex items-center gap-1 text-[11px] font-bold ${kpis.revenueGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {kpis.revenueGrowth >= 0 ? <FiArrowUpRight size={13} /> : <FiArrowDownRight size={13} />}
              <span>{Math.abs(Math.round(kpis.revenueGrowth))}% vs prev period</span>
            </div>
          )}
        </div>

        {/* Net Orders */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Orders</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <FiShoppingBag size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {kpis.totalOrders}
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">{kpis.completedOrders} Delivered</span>
            <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              {kpis.deliveryRate}% fulfilled
            </span>
          </div>
        </div>

        {/* Unique Customers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Customers</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <FiUsers size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {kpis.uniqueCustomers}
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Repeat Orders</span>
            <span className="font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
              {kpis.repeatRate}% repeat
            </span>
          </div>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Order Value</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <FiActivity size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            ₹{kpis.aov}
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">ARPU: ₹{kpis.arpu}</span>
            <span className="text-slate-500">₹{kpis.revPerKg}/kg</span>
          </div>
        </div>

        {/* Total Weight Processed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Processed Volume</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <FiPackage size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {kpis.totalKg} <span className="text-sm font-bold text-slate-400">kg</span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Avg per Order</span>
            <span className="font-extrabold text-slate-700">{kpis.avgKgPerOrder} kg</span>
          </div>
        </div>
      </div>

      {/* ── SUB-TABS NAVIGATION ──────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 flex items-center gap-6 overflow-x-auto scrollbar-hide">
        {[
          { id: 'overview', label: 'Overview & Growth', icon: FiTrendingUp },
          { id: 'channels', label: 'Channel Performance', icon: FiActivity },
          { id: 'services', label: 'Service Mix', icon: FiLayers },
          { id: 'retention', label: 'Customer Retention & LTV', icon: FiUsers },
          { id: 'app', label: 'Digital App Analytics', icon: FiSmartphone },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3.5 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {isActive && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW & GROWTH ───────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily Revenue & Volume Area Chart */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Revenue Trend</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Daily gross collections across all streams</p>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Revenue (₹)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Orders</span>
                </div>
              </div>

              {timeSeriesData.length > 0 ? (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="formattedDate" stroke="#94A3B8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Area type="monotone" dataKey="revenue" name="Daily Revenue" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] flex items-center justify-center">
                  <EmptyState title="No orders in this timeframe" message="Try expanding your date filter above." />
                </div>
              )}
            </div>

            {/* Segment Breakdown Donut */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">Revenue by Segment</h3>
                <p className="text-xs text-slate-400 mb-4">Retail vs Hostels vs Linen vs Hotels</p>

                <div className="h-[180px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={segmentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {segmentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-lg font-black text-slate-900">₹{kpis.grossRevenue.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</span>
                  </div>
                </div>
              </div>

              {/* Segment Legend */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                {segmentData.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="font-bold text-slate-700">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2 font-black">
                      <span className="text-slate-900">₹{s.value.toLocaleString('en-IN')}</span>
                      <span className="text-slate-400 font-semibold w-8 text-right">{s.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Unit Economics Highlights */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4">Unit Economics & Efficiency</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Average Order Value</span>
                <span className="text-xl font-black text-slate-900">₹{kpis.aov}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Per paid customer invoice</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Average Revenue Per User</span>
                <span className="text-xl font-black text-slate-900">₹{kpis.arpu}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Across active customer cohort</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Yield Per KG</span>
                <span className="text-xl font-black text-slate-900">₹{kpis.revPerKg}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Operational washing margin</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fulfillment Velocity</span>
                <span className="text-xl font-black text-emerald-600">{kpis.deliveryRate}%</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Orders delivered successfully</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: CHANNEL PERFORMANCE ─────────────────────────────────────── */}
      {activeTab === 'channels' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden animate-fade-in">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Channel & Acquisition Performance</h3>
              <p className="text-xs text-slate-400 mt-0.5">Volume, revenue share, and average ticket size by customer channel</p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              {channelPerformance.length} Channels Tracked
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Order Channel</th>
                  <th className="py-3.5 px-6 text-right">Orders</th>
                  <th className="py-3.5 px-6 text-right">Revenue (₹)</th>
                  <th className="py-3.5 px-6 text-right">Revenue Share</th>
                  <th className="py-3.5 px-6 text-right">Weight (KG)</th>
                  <th className="py-3.5 px-6 text-right">Unique Users</th>
                  <th className="py-3.5 px-6 text-right">Avg Ticket (AOV)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                {channelPerformance.length > 0 ? (
                  channelPerformance.map((c) => (
                    <tr key={c.channel} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <span className="font-extrabold text-slate-900">{c.channel}</span>
                      </td>
                      <td className="py-4 px-6 text-right font-black text-slate-800">{c.orders}</td>
                      <td className="py-4 px-6 text-right font-black text-emerald-600">₹{c.revenue.toLocaleString('en-IN')}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${c.revenueShare}%` }} />
                          </div>
                          <span className="text-[11px] text-slate-500 w-8">{c.revenueShare}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right text-slate-600">{c.weight} kg</td>
                      <td className="py-4 px-6 text-right text-slate-600">{c.uniqueCustomers}</td>
                      <td className="py-4 px-6 text-right font-extrabold text-slate-800">₹{c.aov}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-slate-400">
                      No channel metrics recorded for the selected period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: SERVICE MIX ──────────────────────────────────────────────── */}
      {activeTab === 'services' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {serviceBreakdown.map((s) => (
              <div key={s.name} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <span className="text-xs font-black text-slate-900 block mb-1">{s.name}</span>
                <div className="text-xl font-black text-blue-600 mb-2">₹{s.revenue.toLocaleString('en-IN')}</div>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 font-medium">
                  <span>{s.orders} items/orders</span>
                  {s.kg > 0 ? <span>{s.kg} kg</span> : <span>{s.volumeShare}% volume</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Service Category Breakdown</h3>
              <p className="text-xs text-slate-400 mt-0.5">Comprehensive sales and item share per laundry service offering</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Service Category</th>
                    <th className="py-3.5 px-6 text-right">Orders / Pieces</th>
                    <th className="py-3.5 px-6 text-right">Total Weight (KG)</th>
                    <th className="py-3.5 px-6 text-right">Revenue Generated</th>
                    <th className="py-3.5 px-6 text-right">Revenue Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                  {serviceBreakdown.map((s) => {
                    const share = kpis.grossRevenue > 0 ? Math.round((s.revenue / kpis.grossRevenue) * 100) : 0;
                    return (
                      <tr key={s.name} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-6 font-extrabold text-slate-900">{s.name}</td>
                        <td className="py-4 px-6 text-right font-black text-slate-800">{s.orders}</td>
                        <td className="py-4 px-6 text-right text-slate-600">{s.kg > 0 ? `${s.kg} kg` : '—'}</td>
                        <td className="py-4 px-6 text-right font-black text-emerald-600">₹{s.revenue.toLocaleString('en-IN')}</td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${share}%` }} />
                            </div>
                            <span className="text-[11px] text-slate-500 w-8">{share}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: CUSTOMER RETENTION & LTV ─────────────────────────────────── */}
      {activeTab === 'retention' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Repeat Customer Rate</span>
              <div className="text-2xl font-black text-purple-600">{retentionMetrics.overallRepeatRate}%</div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">Customers placing &gt; 1 order</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Customer LTV (CLV)</span>
              <div className="text-2xl font-black text-blue-600">₹{retentionMetrics.averageLtv}</div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">Average lifetime customer spend</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Total Customer Base</span>
              <div className="text-2xl font-black text-slate-900">{retentionMetrics.totalCustomers}</div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">Distinct verified buyers in records</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Registered App Users</span>
              <div className="text-2xl font-black text-slate-900">{totalUsers}</div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">Firebase authenticated accounts</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-2">Order Frequency Cohorts</h3>
            <p className="text-xs text-slate-400 mb-6">Distribution of customers by purchase frequency</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-xs font-extrabold text-slate-700 block mb-1">1st Time Customers</span>
                <div className="text-3xl font-black text-slate-900">{retentionMetrics.singleOrderCustomers}</div>
                <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-slate-200">
                  <span>Share of Base:</span>
                  <span className="font-black text-slate-800">{retentionMetrics.singleOrderPercent}%</span>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-blue-50/60 border border-blue-100">
                <span className="text-xs font-extrabold text-blue-900 block mb-1">Repeat Buyers (2–3 orders)</span>
                <div className="text-3xl font-black text-blue-700">{retentionMetrics.twoToThreeOrders}</div>
                <div className="flex items-center justify-between text-xs text-blue-700 mt-3 pt-3 border-t border-blue-200/60">
                  <span>Share of Base:</span>
                  <span className="font-black">{retentionMetrics.twoToThreePercent}%</span>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-purple-50/60 border border-purple-100">
                <span className="text-xs font-extrabold text-purple-900 block mb-1">Loyal Champions (4+ orders)</span>
                <div className="text-3xl font-black text-purple-700">{retentionMetrics.loyalCustomers}</div>
                <div className="flex items-center justify-between text-xs text-purple-700 mt-3 pt-3 border-t border-purple-200/60">
                  <span>Share of Base:</span>
                  <span className="font-black">{retentionMetrics.loyalPercent}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: DIGITAL APP ANALYTICS ────────────────────────────────────── */}
      {activeTab === 'app' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          {/* Top Screens */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Most Visited App Screens</h3>
                <p className="text-xs text-slate-400 mt-0.5">Customer navigation behavior in Andes Mobile App</p>
              </div>
              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Live Sync</span>
            </div>

            {cleanedScreens.length > 0 ? (
              <div className="space-y-3">
                {cleanedScreens.map((s) => (
                  <div key={s.id} className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-xl transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white text-blue-600 shadow-2xs border border-slate-200/50">
                        <FiSmartphone size={16} />
                      </div>
                      <span className="text-xs font-extrabold text-slate-800">{s.name}</span>
                    </div>
                    <span className="text-xs font-black text-slate-900">{s.visits.toLocaleString()} views</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No screen analytics found" message="Mobile screen data will appear as users browse the app." />
            )}
          </div>

          {/* Popular Searches */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Top Customer Searches</h3>
                <p className="text-xs text-slate-400 mt-0.5">High-intent search keywords queried by mobile app users</p>
              </div>
              <span className="text-[11px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">Queries</span>
            </div>

            {cleanedSearches.length > 0 ? (
              <div className="space-y-2.5">
                {cleanedSearches.map((s, idx) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-black flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{s.query}</span>
                    </div>
                    <span className="text-xs font-black text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-100">
                      {s.count} searches
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No search queries recorded" message="Search logs will appear as customers query items in the app." />
            )}
          </div>
        </div>
      )}

      {/* ── CUSTOM DATE RANGE MODAL ────────────────────────────────────────── */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-black text-slate-900 mb-1">Select Custom Date Range</h3>
            <p className="text-xs text-slate-500 mb-4">Filter analytics data within specific start and end dates.</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">From Date</label>
                <input
                  type="date"
                  value={localFrom}
                  max={localTo}
                  onChange={(e) => setLocalFrom(e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 p-2.5 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">To Date</label>
                <input
                  type="date"
                  value={localTo}
                  min={localFrom}
                  max={getTodayStr()}
                  onChange={(e) => setLocalTo(e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 p-2.5 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCustomApply}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
