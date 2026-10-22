import { useState, useMemo, useEffect, useRef } from 'react';
import {
  FiShoppingCart,
  FiUsers,
  FiUserPlus,
  FiRepeat,
  FiCalendar,
  FiChevronDown,
  FiSmartphone,
  FiGlobe,
  FiMapPin,
  FiX,
  FiHelpCircle,
  FiCheck,
  FiTrendingUp,
  FiArrowRight,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { BiRupee } from 'react-icons/bi';
import {
  FaWhatsapp,
  FaGoogle,
  FaInstagram,
  FaBullhorn,
  FaStore,
} from 'react-icons/fa6';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  ACQUISITION_SOURCES,
  ACQUISITION_SOURCE_LIST,
  SOURCE_COLORS,
  computeAcquisitionAnalytics,
  subscribeCustomerSources,
  saveCustomerAcquisitionSource,
  subscribeMetaAdsDailyReports,
} from '../../api/customerAcquisitionApi';

/**
 * Brand-specific icons matching the design screenshot
 */
function SourceIcon({ source, size = 16 }) {
  switch (source) {
    case ACQUISITION_SOURCES.WHATSAPP:
      return <FaWhatsapp size={size} className="text-[#25D366]" />;
    case ACQUISITION_SOURCES.APP:
      return <FiSmartphone size={size} className="text-[#3B82F6]" />;
    case ACQUISITION_SOURCES.WORD_OF_MOUTH:
      return <FiUsers size={size} className="text-[#A855F7]" />;
    case ACQUISITION_SOURCES.GOOGLE_SEARCH:
      return <FaGoogle size={size} className="text-[#EA4335]" />;
    case ACQUISITION_SOURCES.GOOGLE_MAPS:
      return <FiMapPin size={size} className="text-[#10B981]" />;
    case ACQUISITION_SOURCES.INSTAGRAM:
      return <FaInstagram size={size} className="text-[#E1306C]" />;
    case ACQUISITION_SOURCES.WEBSITE:
      return <FiGlobe size={size} className="text-[#06B6D4]" />;
    case ACQUISITION_SOURCES.WALK_IN:
      return <FaStore size={size} className="text-[#F59E0B]" />;
    case ACQUISITION_SOURCES.PAID_ADS:
      return <FaBullhorn size={size} className="text-[#EC4899]" />;
    default:
      return <FiHelpCircle size={size} className="text-[#94A3B8]" />;
  }
}

/**
 * Customer Type icon
 */
function CustomerTypeIcon({ type, size = 15 }) {
  if (type.includes('New')) {
    return <FiUserPlus size={size} className="text-[#22C55E]" />;
  }
  if (type.includes('Existing')) {
    return <FiUsers size={size} className="text-[#F59E0B]" />;
  }
  return <FiRepeat size={size} className="text-[#8B5CF6]" />;
}

export default function CustomerAcquisitionDashboard({ orders = [] }) {
  const navigate = useNavigate();

  // Date filter state: Default to month view through current date
  const [dateFilterPreset, setDateFilterPreset] = useState('month'); // 'today' | 'week' | 'month' | 'custom'
  const [dateFrom, setDateFrom] = useState('2026-10-01');
  const [dateTo, setDateTo] = useState('2026-10-21');
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [tempFrom, setTempFrom] = useState('2026-10-01');
  const [tempTo, setTempTo] = useState('2026-10-21');

  // Customer acquisition source overrides from Firestore
  const [customerSourcesMap, setCustomerSourcesMap] = useState(new Map());

  // Meta Ads daily lead reports from Firestore
  const [metaAdsReports, setMetaAdsReports] = useState([]);

  // Customer drilldown modal state
  const [drilldownModal, setDrilldownModal] = useState(null); // { title, subtitle, customers: [], metaDetails }

  useEffect(() => {
    const unsub = subscribeCustomerSources(setCustomerSourcesMap);
    return () => unsub?.();
  }, []);

  useEffect(() => {
    const unsubMeta = subscribeMetaAdsDailyReports(
      (reports) => setMetaAdsReports(reports),
      (err) => console.error('Meta Ads sync error:', err)
    );
    return () => unsubMeta?.();
  }, []);

  // Preset filter handler
  const handlePresetChange = (preset) => {
    setDateFilterPreset(preset);
    const today = '2026-10-21'; // current benchmark date
    const todayDate = new Date(`${today}T00:00:00`);

    if (preset === 'today') {
      setDateFrom(today);
      setDateTo(today);
    } else if (preset === 'week') {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - 6);
      setDateFrom(d.toISOString().slice(0, 10));
      setDateTo(today);
    } else if (preset === 'month') {
      setDateFrom('2026-10-01');
      setDateTo('2026-10-21');
    } else if (preset === 'custom') {
      setTempFrom(dateFrom);
      setTempTo(dateTo);
      setShowDatePickerModal(true);
    }
  };

  const handleApplyCustomDates = () => {
    if (tempFrom && tempTo && tempFrom <= tempTo) {
      setDateFrom(tempFrom);
      setDateTo(tempTo);
      setDateFilterPreset('custom');
      setShowDatePickerModal(false);
    }
  };

  // Formatted date label for header dropdown
  const formattedRangeLabel = useMemo(() => {
    const f = (dStr) => {
      if (!dStr) return '';
      const d = new Date(`${dStr}T00:00:00`);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    return `${f(dateFrom)} – ${f(dateTo)}`;
  }, [dateFrom, dateTo]);

  // Compute analytics dynamically
  const analytics = useMemo(() => {
    return computeAcquisitionAnalytics({
      orders,
      customerSourcesMap,
      metaAdsReports,
      dateFrom,
      dateTo,
    });
  }, [orders, customerSourcesMap, metaAdsReports, dateFrom, dateTo]);

  const {
    kpis,
    sourceTableRows,
    sourceTableTotal,
    customerTypeRows,
    customerTypeTotal,
    customerDonutData,
    orderDonutData,
    trendDays,
    activeCustomersInPeriod,
    metaAdsSummary,
  } = analytics;

  // Handle drilldown click on source or customer type
  const handleSourceDrilldown = (sourceName) => {
    const matched = [];
    activeCustomersInPeriod.forEach((c) => {
      if (c.customerType === 'New' && c.acquisitionSource === sourceName) {
        matched.push(c);
      }
    });

    if (sourceName === ACQUISITION_SOURCES.PAID_ADS && matched.length === 0 && (metaAdsSummary?.conversions || 0) > 0) {
      setDrilldownModal({
        title: `Meta Ads / Paid Advertising Campaign`,
        subtitle: `${metaAdsSummary.conversions} converted customers out of ${metaAdsSummary.totalLeads} total leads`,
        metaDetails: metaAdsSummary,
        customers: [],
      });
      return;
    }

    setDrilldownModal({
      title: `New Customers from ${sourceName}`,
      subtitle: `${matched.length} customer(s) acquired`,
      customers: matched,
    });
  };

  const handleTypeDrilldown = (typeName) => {
    const matched = [];
    const targetType = typeName.includes('New') ? 'New' : typeName.includes('Reactivated') ? 'Reactivated' : 'Existing';
    activeCustomersInPeriod.forEach((c) => {
      if (c.customerType === targetType) {
        matched.push(c);
      }
    });
    setDrilldownModal({
      title: typeName,
      subtitle: `${matched.length} customer(s)`,
      customers: matched,
    });
  };

  return (
    <div className="space-y-6 pb-12" style={{ fontFamily: 'DM Sans, system-ui, sans-serif' }}>
      
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER WITH TITLE, SUBTITLE & DATE RANGE FILTERS
      ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-[26px] font-black tracking-tight text-[#0F172A]">
            Customer Acquisition & Orders
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
            Track where your customers come from and how they order
          </p>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Dropdown Pill */}
          <button
            type="button"
            onClick={() => {
              setTempFrom(dateFrom);
              setTempTo(dateTo);
              setShowDatePickerModal(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-[12.5px] font-bold text-slate-700 bg-white border border-slate-200/90 rounded-xl shadow-xs hover:bg-slate-50 transition-all cursor-pointer"
          >
            <FiCalendar size={14} className="text-slate-400" />
            <span>{formattedRangeLabel}</span>
            <FiChevronDown size={14} className="text-slate-400 ml-0.5" />
          </button>

          {/* Quick Preset Buttons */}
          <div className="inline-flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => handlePresetChange('today')}
              className={`px-3 py-1.5 text-[12px] font-bold rounded-lg transition-all cursor-pointer ${
                dateFilterPreset === 'today'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('week')}
              className={`px-3 py-1.5 text-[12px] font-bold rounded-lg transition-all cursor-pointer ${
                dateFilterPreset === 'week'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('month')}
              className={`px-3 py-1.5 text-[12px] font-bold rounded-lg transition-all cursor-pointer ${
                dateFilterPreset === 'month'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('custom')}
              className={`px-3 py-1.5 text-[12px] font-bold rounded-lg transition-all cursor-pointer ${
                dateFilterPreset === 'custom'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. OVERVIEW SECTION (6 TOP KPI CARDS)
      ────────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-extrabold text-[#0F172A] tracking-tight mb-3">
          Overview
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-3.5">
          
          {/* Card 1: Total Orders */}
          <div className="bg-[#EFF6FF] border border-blue-100/70 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 shadow-2xs hover:shadow-xs transition-all">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center shrink-0">
              <FiShoppingCart size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-500 truncate">Total Orders</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg sm:text-xl xl:text-[20px] 2xl:text-2xl font-black text-[#0F172A] tracking-tight">
                  {kpis.totalOrders.value.toLocaleString()}
                </span>
                <span className="text-[11px] font-bold text-emerald-600 inline-flex items-center shrink-0">
                  ↑ {kpis.totalOrders.changePct}%
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5 truncate">{kpis.totalOrders.subtext}</p>
            </div>
          </div>

          {/* Card 2: Total Customers */}
          <div className="bg-[#F5F3FF] border border-purple-100/70 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 shadow-2xs hover:shadow-xs transition-all">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center shrink-0">
              <FiUsers size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-500 truncate">Total Customers</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg sm:text-xl xl:text-[20px] 2xl:text-2xl font-black text-[#0F172A] tracking-tight">
                  {kpis.totalCustomers.value.toLocaleString()}
                </span>
                <span className="text-[11px] font-bold text-emerald-600 inline-flex items-center shrink-0">
                  ↑ {kpis.totalCustomers.changePct}%
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5 truncate">{kpis.totalCustomers.subtext}</p>
            </div>
          </div>

          {/* Card 3: New Customers */}
          <div className="bg-[#F0FDF4] border border-emerald-100/70 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 shadow-2xs hover:shadow-xs transition-all">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center shrink-0">
              <FiUserPlus size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-500 truncate">New Customers</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg sm:text-xl xl:text-[20px] 2xl:text-2xl font-black text-[#0F172A] tracking-tight">
                  {kpis.newCustomers.value.toLocaleString()}
                </span>
                <span className="text-[11px] font-bold text-emerald-600 inline-flex items-center shrink-0">
                  ↑ {kpis.newCustomers.changePct}%
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5 truncate">{kpis.newCustomers.subtext}</p>
            </div>
          </div>

          {/* Card 4: Existing Customers */}
          <div className="bg-[#FEFCE8] border border-amber-100/70 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 shadow-2xs hover:shadow-xs transition-all">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#FEF9C3] text-[#CA8A04] flex items-center justify-center shrink-0">
              <FiUsers size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-500 truncate">Existing Customers</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg sm:text-xl xl:text-[20px] 2xl:text-2xl font-black text-[#0F172A] tracking-tight">
                  {kpis.existingCustomers.value.toLocaleString()}
                </span>
                <span className="text-[11px] font-bold text-emerald-600 inline-flex items-center shrink-0">
                  ↑ {kpis.existingCustomers.changePct}%
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5 truncate">{kpis.existingCustomers.subtext}</p>
            </div>
          </div>

          {/* Card 5: Repeat Orders */}
          <div className="bg-[#FFF1F2] border border-rose-100/70 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 shadow-2xs hover:shadow-xs transition-all">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#FFE4E6] text-[#E11D48] flex items-center justify-center shrink-0">
              <FiRepeat size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-500 truncate">Repeat Orders</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg sm:text-xl xl:text-[20px] 2xl:text-2xl font-black text-[#0F172A] tracking-tight">
                  {kpis.repeatOrders.value.toLocaleString()}
                </span>
                <span className="text-[11px] font-bold text-emerald-600 inline-flex items-center shrink-0">
                  ↑ {kpis.repeatOrders.changePct}%
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5 truncate">{kpis.repeatOrders.subtext}</p>
            </div>
          </div>

          {/* Card 6: Total Revenue */}
          <div className="bg-[#ECFEFF] border border-cyan-100/70 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 shadow-2xs hover:shadow-xs transition-all">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#CFFAFE] text-[#0891B2] flex items-center justify-center shrink-0">
              <BiRupee size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-500 truncate">Total Revenue</p>
              <div className="mt-0.5">
                <span className="text-lg sm:text-xl xl:text-[20px] 2xl:text-2xl font-black text-[#0F172A] tracking-tight truncate block">
                  ₹{Math.round(kpis.totalRevenue.value).toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5 truncate flex items-center gap-1">
                <span className="font-bold text-emerald-600 shrink-0">↑ {kpis.totalRevenue.changePct}%</span>
                <span className="truncate">{kpis.totalRevenue.subtext}</span>
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. UPPER ROW: NEW CUSTOMERS TABLE (LEFT) + 2 DONUT CHARTS (RIGHT)
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* ─── LEFT: Table 1 (New Customers by Source) ─── */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-[15px] font-black text-[#0F172A] tracking-tight">
                New Customers by Source
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Where your new customers are coming from
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/70 text-slate-500 uppercase tracking-wider text-[10.5px] font-bold border-b border-slate-100">
                    <th className="py-2.5 px-5">Source</th>
                    <th className="py-2.5 px-4 text-center">New Customers</th>
                    <th className="py-2.5 px-4 text-center">Orders (New Customers)</th>
                    <th className="py-2.5 px-4 text-right">Total Revenue</th>
                    <th className="py-2.5 px-5 text-right">% of New Customers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {sourceTableRows.map((row) => (
                    <tr
                      key={row.source}
                      onClick={() => row.newCustomers > 0 && handleSourceDrilldown(row.source)}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        row.newCustomers > 0 ? 'cursor-pointer group' : ''
                      }`}
                    >
                      <td className="py-2 px-5 flex items-center gap-2.5 text-slate-800 font-bold">
                        <SourceIcon source={row.source} size={15} />
                        <span className="group-hover:text-blue-600 transition-colors">{row.source}</span>
                      </td>
                      <td className="py-2 px-4 text-center font-bold text-slate-700">
                        {row.newCustomers}
                      </td>
                      <td className="py-2 px-4 text-center font-semibold text-slate-600">
                        {row.orders}
                      </td>
                      <td className="py-2 px-4 text-right font-bold text-slate-800">
                        ₹{Math.round(row.revenue).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-5 text-right font-semibold text-slate-600">
                        {row.pctOfNew.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/90 border-t-2 border-slate-200 text-slate-900 font-black text-xs">
                    <td className="py-3 px-5">Total</td>
                    <td className="py-3 px-4 text-center">{sourceTableTotal.newCustomers}</td>
                    <td className="py-3 px-4 text-center">{sourceTableTotal.orders}</td>
                    <td className="py-3 px-4 text-right">₹{Math.round(sourceTableTotal.revenue).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-5 text-right">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Two Donut Cards stacked ─── */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-5">
          
          {/* Donut Chart 1: New Customers Source Distribution */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex-1 flex flex-col justify-between">
            <h3 className="text-[14px] font-black text-[#0F172A] tracking-tight mb-2">
              New Customers Source Distribution
            </h3>

            <div className="flex items-center justify-between gap-4 flex-1">
              {/* Donut Ring with Center Number */}
              <div className="relative w-[150px] h-[150px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={customerDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={68}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {customerDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-[#0F172A] leading-tight">
                    {sourceTableTotal.newCustomers}
                  </span>
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                    New Customers
                  </span>
                </div>
              </div>

              {/* Legend List on Right */}
              <div className="flex-1 space-y-2 text-xs">
                {customerDonutData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                      <span className="font-bold text-slate-700 truncate">{item.name}</span>
                    </div>
                    <span className="font-semibold text-slate-500 tabular-nums shrink-0">
                      {item.pct.toFixed(1)}% ({item.value})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Donut Chart 2: Orders by Source (New Customers) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex-1 flex flex-col justify-between">
            <h3 className="text-[14px] font-black text-[#0F172A] tracking-tight mb-2">
              Orders by Source (New Customers)
            </h3>

            <div className="flex items-center justify-between gap-4 flex-1">
              {/* Donut Ring with Center Number */}
              <div className="relative w-[150px] h-[150px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={68}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {orderDonutData.map((entry, index) => (
                        <Cell key={`cell-order-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-[#0F172A] leading-tight">
                    {sourceTableTotal.orders}
                  </span>
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                    Orders
                  </span>
                </div>
              </div>

              {/* Legend List on Right */}
              <div className="flex-1 space-y-2 text-xs">
                {orderDonutData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                      <span className="font-bold text-slate-700 truncate">{item.name}</span>
                    </div>
                    <span className="font-semibold text-slate-500 tabular-nums shrink-0">
                      {item.pct.toFixed(1)}% ({item.value})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          META ADS CAMPAIGN & LEADS PERFORMANCE WIDGET
      ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-50 text-[#EC4899] flex items-center justify-center shrink-0 border border-pink-100">
              <FaBullhorn size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-black text-[#0F172A] tracking-tight">
                  Meta Ads Campaign & Leads Overview
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 text-[#EC4899] uppercase tracking-wider">
                  Paid Advertising
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Inbound lead pipeline, serviceability, and conversions for {formattedRangeLabel}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/admin/meta-leads')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100/70 rounded-xl transition-all cursor-pointer self-start sm:self-auto"
          >
            Manage Meta Leads <FiArrowRight size={13} />
          </button>
        </div>

        {/* 5 KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-4">
          {/* Card 1: Total Leads */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Leads</p>
            <p className="text-2xl font-black text-[#0F172A] mt-1">{metaAdsSummary?.totalLeads || 0}</p>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Meta Ads Inbound</p>
          </div>

          {/* Card 2: Conversions */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/60">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Conversions</p>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                {metaAdsSummary?.conversionRate || 0}%
              </span>
            </div>
            <p className="text-2xl font-black text-emerald-800 mt-1">{metaAdsSummary?.conversions || 0}</p>
            <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">Converted Customers</p>
          </div>

          {/* Card 3: Potential */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/60">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Potential</p>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                {metaAdsSummary?.potentialRate || 0}%
              </span>
            </div>
            <p className="text-2xl font-black text-blue-800 mt-1">{metaAdsSummary?.potential || 0}</p>
            <p className="text-[10px] font-semibold text-blue-600 mt-0.5">Interested Pipeline</p>
          </div>

          {/* Card 4: OSA (Out of Service Area) */}
          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/60">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">OSA (Unserviceable)</p>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                {metaAdsSummary?.osaRate || 0}%
              </span>
            </div>
            <p className="text-2xl font-black text-amber-800 mt-1">{metaAdsSummary?.osa || 0}</p>
            <p className="text-[10px] font-semibold text-amber-600 mt-0.5">Outside Service Area</p>
          </div>

          {/* Card 5: No Response */}
          <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/60">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">No Response</p>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                {metaAdsSummary?.noResponseRate || 0}%
              </span>
            </div>
            <p className="text-2xl font-black text-rose-800 mt-1">{metaAdsSummary?.noResponse || 0}</p>
            <p className="text-[10px] font-semibold text-rose-600 mt-0.5">Unresponsive Leads</p>
          </div>
        </div>

        {/* Funnel Distribution Bar */}
        {(metaAdsSummary?.totalLeads || 0) > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1.5">
              <span>Lead Distribution Pipeline</span>
              <span>{metaAdsSummary.totalLeads} Total Leads Tracked</span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
              <div style={{ width: `${metaAdsSummary.conversionRate}%` }} className="bg-emerald-500" title={`Conversions: ${metaAdsSummary.conversions} (${metaAdsSummary.conversionRate}%)`} />
              <div style={{ width: `${metaAdsSummary.potentialRate}%` }} className="bg-blue-500" title={`Potential: ${metaAdsSummary.potential} (${metaAdsSummary.potentialRate}%)`} />
              <div style={{ width: `${metaAdsSummary.osaRate}%` }} className="bg-amber-400" title={`OSA: ${metaAdsSummary.osa} (${metaAdsSummary.osaRate}%)`} />
              <div style={{ width: `${metaAdsSummary.noResponseRate}%` }} className="bg-rose-400" title={`No Response: ${metaAdsSummary.noResponse} (${metaAdsSummary.noResponseRate}%)`} />
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-[10.5px] font-semibold text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Conversions ({metaAdsSummary.conversions})</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Potential ({metaAdsSummary.potential})</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> OSA / Unserviceable ({metaAdsSummary.osa})</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400" /> No Response ({metaAdsSummary.noResponse})</span>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. LOWER ROW: ALL CUSTOMERS BY TYPE (LEFT) + ORDERS TREND CHART (RIGHT)
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* ─── LEFT: Table 2 (All Customers by Type) ─── */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-[15px] font-black text-[#0F172A] tracking-tight">
                All Customers by Type
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Breakdown of total customers and orders
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/70 text-slate-500 uppercase tracking-wider text-[10.5px] font-bold border-b border-slate-100">
                    <th className="py-2.5 px-5">Customer Type</th>
                    <th className="py-2.5 px-4 text-center">Customers</th>
                    <th className="py-2.5 px-4 text-center">Orders</th>
                    <th className="py-2.5 px-4 text-right">Revenue</th>
                    <th className="py-2.5 px-4 text-right">% of Customers</th>
                    <th className="py-2.5 px-5 text-right">% of Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {customerTypeRows.map((row) => (
                    <tr
                      key={row.type}
                      onClick={() => handleTypeDrilldown(row.type)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-5 flex items-center gap-2.5 text-slate-800 font-bold">
                        <CustomerTypeIcon type={row.type} size={15} />
                        <span className="group-hover:text-blue-600 transition-colors">{row.type}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-700">
                        {row.customers}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-600">
                        {row.orders}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800">
                        ₹{Math.round(row.revenue).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-600">
                        {row.pctCustomers.toFixed(1)}%
                      </td>
                      <td className="py-3 px-5 text-right font-semibold text-slate-600">
                        {row.pctOrders.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/90 border-t-2 border-slate-200 text-slate-900 font-black text-xs">
                    <td className="py-3 px-5">Total</td>
                    <td className="py-3 px-4 text-center">{customerTypeTotal.customers}</td>
                    <td className="py-3 px-4 text-center">{customerTypeTotal.orders}</td>
                    <td className="py-3 px-4 text-right">₹{Math.round(customerTypeTotal.revenue).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-right">100%</td>
                    <td className="py-3 px-5 text-right">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Chart 3 (Orders Trend Area Chart) ─── */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h3 className="text-[14px] font-black text-[#0F172A] tracking-tight">
              Orders Trend
            </h3>
            <div className="flex items-center gap-3 text-[11px] font-bold">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
                <span className="text-slate-600">New Customers</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                <span className="text-slate-600">Existing Customers</span>
              </div>
            </div>
          </div>

          <div className="h-[175px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trendDays}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorExisting" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs shadow-xl border border-slate-800">
                        <p className="font-bold text-slate-300 mb-1">{label}</p>
                        <p className="text-[#60A5FA]">New Customers: <span className="font-extrabold text-white">{payload[0]?.value}</span></p>
                        <p className="text-[#34D399]">Existing Customers: <span className="font-extrabold text-white">{payload[1]?.value}</span></p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="New Customers"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorNew)"
                />
                <Area
                  type="monotone"
                  dataKey="Existing Customers"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorExisting)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. CUSTOM DATE PICKER MODAL
      ────────────────────────────────────────────────────────────── */}
      {showDatePickerModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">Select Custom Date Range</h3>
              <button
                type="button"
                onClick={() => setShowDatePickerModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <FiX size={18} />
              </button>
            </div>
            <div className="py-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={tempFrom}
                  onChange={(e) => setTempFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={tempTo}
                  onChange={(e) => setTempTo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDatePickerModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCustomDates}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. CUSTOMER DRILLDOWN MODAL
      ────────────────────────────────────────────────────────────── */}
      {drilldownModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 animate-scale-up">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900 text-base">{drilldownModal.title}</h3>
                <p className="text-xs text-slate-500 font-medium">{drilldownModal.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setDrilldownModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              {drilldownModal.metaDetails ? (
                <div className="space-y-4 py-1">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Total Leads</p>
                      <p className="text-xl font-black text-slate-900 mt-1">{drilldownModal.metaDetails.totalLeads}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <p className="text-[10px] font-bold uppercase text-emerald-700">Conversions</p>
                      <p className="text-xl font-black text-emerald-800 mt-1">{drilldownModal.metaDetails.conversions} ({drilldownModal.metaDetails.conversionRate}%)</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                      <p className="text-[10px] font-bold uppercase text-blue-700">Potential</p>
                      <p className="text-xl font-black text-blue-800 mt-1">{drilldownModal.metaDetails.potential} ({drilldownModal.metaDetails.potentialRate}%)</p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <p className="text-[10px] font-bold uppercase text-amber-700">OSA (Unserviceable)</p>
                      <p className="text-xl font-black text-amber-800 mt-1">{drilldownModal.metaDetails.osa} ({drilldownModal.metaDetails.osaRate}%)</p>
                    </div>
                  </div>

                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mt-3">Recorded Daily Meta Campaigns</p>
                  {drilldownModal.metaDetails.reports?.map((rep) => (
                    <div key={rep.date} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between">
                      <div>
                        <p className="font-black text-slate-900 text-sm">Date: {rep.date}</p>
                        <p className="text-xs text-slate-500 font-semibold">{rep.remarks || 'Daily Meta Ads intake'}</p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] font-semibold text-slate-500">
                          <span>Potential: <strong className="text-blue-600">{rep.potential}</strong></span>
                          <span>•</span>
                          <span>OSA: <strong className="text-amber-600">{rep.osa}</strong></span>
                          <span>•</span>
                          <span>No Response: <strong className="text-rose-600">{rep.noResponse}</strong></span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {rep.conversions} Converted / {rep.totalLeads} Leads
                        </span>
                        <p className="text-[11px] font-bold text-emerald-600 mt-1">{rep.conversionRate}% rate</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : drilldownModal.customers.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">No customer records in this segment.</p>
              ) : (
                drilldownModal.customers.map((c) => (
                  <div key={c.customerKey} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between">
                    <div>
                      <p className="font-black text-slate-900 text-sm">{c.name}</p>
                      <p className="text-xs text-slate-500 font-bold">{c.phone || 'No phone'}</p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] font-semibold text-slate-500">
                        <span>First Order: <strong className="text-slate-700">{c.firstOrderDay}</strong></span>
                        <span>•</span>
                        <span>Source: <strong className="text-blue-600">{c.acquisitionSource}</strong></span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-600">₹{c.periodRevenue.toLocaleString()}</p>
                      <p className="text-[11px] font-bold text-slate-400">{c.periodOrders.length} order(s)</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 text-right bg-slate-50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setDrilldownModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
