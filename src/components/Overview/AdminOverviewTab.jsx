import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  FiArrowRight, FiArrowUpRight, FiArrowDownRight, FiChevronDown,
  FiFilter, FiX, FiTrendingUp, FiCalendar, FiMinus, FiChevronRight,
  FiCheckCircle,
} from "react-icons/fi";
import { normalizeOrder } from "../../utils/orderNormalization";
import { useWindowWidth } from "../../hooks/windowHooks";
import { BiRupee } from "react-icons/bi";
import OrderTable from "../Shared/OrderTable";
import AdminOrderModal from "../Shared/AdminOrderModal";
import { ORDER_STATUSES } from "../../constants/orders";
import { useOverviewMetrics } from "../../hooks/useOverviewMetrics";
import ExpandedOverviewLayout from "./ExpandedOverviewLayout";
import { getTodayString, formatDateString } from "../../utils/dateUtils";

// ── Constants ────────────────────────────────────────────────────
const AVATAR_COLORS = ["#1976D2", "#7C3AED", "#059669", "#DC2626", "#D97706", "#0891B2", "#BE185D"];
const PROPERTY_COLORS = ["#1976D2", "#7C3AED", "#059669", "#DC2626", "#D97706", "#0891B2", "#BE185D", "#4338CA"];
const STATUS_FILTERS = ["All", ORDER_STATUSES.PENDING, ORDER_STATUSES.PROCESSING, ORDER_STATUSES.DELIVERED];
const TYPE_FILTERS = ["All", "Linen", "Student", "Retail", "Hotel"];

const PERIOD_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "month", label: "This Month" },
];

const PERIOD_PREV_LABEL = { today: "yesterday", month: "last month" };

// ── Toast Component ──────────────────────────────────────────────
function Toast({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 bg-[#0F172A] text-white px-4 py-3 rounded-xl shadow-2xl animate-slide-up"
      style={{ fontFamily: "DM Sans, sans-serif" }}>
      <FiCheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
      <span className="text-[13px] font-bold">{message}</span>
      <button onClick={onDismiss} className="ml-1 text-slate-400 hover:text-white transition-colors">
        <FiX size={14} />
      </button>
    </div>
  );
}

// ── Tiny Sparkline ───────────────────────────────────────────────
function MiniSparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 64, h = 24;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
    </svg>
  );
}

// ── Chart Tooltip ────────────────────────────────────────────────
function RevenueChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/90 backdrop-blur-sm border border-gray-100 shadow-xl rounded-xl p-3" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <p className="text-gray-400 font-bold text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-center gap-0.5 text-gray-900 font-black text-base">
        <BiRupee size={16} />
        <span>{payload[0].value.toLocaleString()}</span>
      </div>
    </div>
  );
}

function getStatusBadgeClass(type) {
  if (type === "Linen") return "bg-purple-100 text-purple-700";
  if (type === "Student") return "bg-blue-100 text-blue-700";
  if (type === "Retail") return "bg-emerald-100 text-emerald-700";
  if (type === "Hotel") return "bg-orange-100 text-orange-700";
  return "bg-slate-100 text-slate-700";
}

function filterOrdersForRow({ modalFilterProperty, modalFilterStatus, row, orders }) {
  return orders.filter((order) => {
    const matchesProperty = row.properties.includes(order.property || order.tenant);
    if (!matchesProperty) return false;
    if (modalFilterProperty !== "All" && (order.property || order.tenant) !== modalFilterProperty) return false;
    if (modalFilterStatus === "All") return true;
    if (modalFilterStatus === ORDER_STATUSES.DELIVERED) return order.status === ORDER_STATUSES.DELIVERED;
    if (modalFilterStatus === ORDER_STATUSES.PROCESSING) return order.status === ORDER_STATUSES.PROCESSING;
    if (modalFilterStatus === ORDER_STATUSES.PENDING) return order.status === ORDER_STATUSES.PENDING;
    return true;
  });
}

// ── Trend Badge ──────────────────────────────────────────────────
function TrendBadge({ diff, pct, prevLabel, color }) {
  if (diff === 0 || pct === null) return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
      <FiMinus size={10} /> No change vs {prevLabel}
    </span>
  );
  const isUp = diff > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-bold ${isUp ? "text-emerald-600" : "text-red-500"}`}>
      {isUp ? <FiArrowUpRight size={11} /> : <FiArrowDownRight size={11} />}
      {isUp ? "+" : ""}₹{Math.abs(diff).toLocaleString("en-IN")}
      {pct !== null && <span className="opacity-70">({isUp ? "+" : ""}{pct}%)</span>}
      <span className="text-slate-400 font-medium">vs {prevLabel}</span>
    </span>
  );
}

// ── Hero: Revenue Source Cards with Drill-Down ──────────────────
function RevenueSources({ buildPeriodData, categorySparklines, todayString }) {
  const [period, setPeriod] = useState("today");
  const [expandedCategory, setExpandedCategory] = useState(null);
  const drillRef = useRef(null);

  const periodData = useMemo(() => buildPeriodData(period), [buildPeriodData, period]);
  const prevLabel = PERIOD_PREV_LABEL[period];
  const hasData = periodData.breakdown.length > 0;

  const handleCardClick = (catKey) => {
    const next = expandedCategory === catKey ? null : catKey;
    setExpandedCategory(next);
    if (next) {
      setTimeout(() => drillRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    }
  };

  const expandedCat = periodData.breakdown.find((c) => c.key === expandedCategory);
  const expandedProperties = expandedCategory ? (periodData.propertyBreakdown[expandedCategory] || []) : [];

  const formattedDate = new Date(todayString + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full bg-blue-500" />
            <h2 className="text-[16px] font-black text-[#0F172A] tracking-tight">Revenue Sources</h2>
          </div>
          <div className="flex items-center gap-1.5 ml-3.5">
            <FiCalendar size={11} className="text-[#94A3B8]" />
            <p className="text-[12px] font-semibold text-[#94A3B8]">{formattedDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Period toggle */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg gap-0.5">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => { setPeriod(opt.key); setExpandedCategory(null); }}
                className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-wider transition-all ${
                  period === opt.key
                    ? "bg-white text-[#0F172A] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Total revenue */}
          {hasData && (
            <div className="text-right pl-3 border-l border-gray-100">
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Total</p>
              <div className="flex items-center gap-0.5 text-[18px] font-black text-[#0F172A]">
                <BiRupee size={16} />
                <span>{periodData.periodTotal.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
              </div>
              {periodData.overallTrendPct !== null && (
                <TrendBadge
                  diff={periodData.overallTrendDiff}
                  pct={periodData.overallTrendPct}
                  prevLabel={prevLabel}
                  color="#1976D2"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cards Grid */}
      {hasData ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {periodData.breakdown.map((cat) => {
              const isExpanded = expandedCategory === cat.key;
              const sparkData = categorySparklines[cat.key] || [];
              return (
                <button
                  key={cat.key}
                  onClick={() => handleCardClick(cat.key)}
                  className={`group relative rounded-xl border-2 p-5 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] overflow-hidden ${isExpanded ? "shadow-lg -translate-y-0.5" : ""}`}
                  style={{
                    borderColor: isExpanded ? cat.color : `${cat.color}30`,
                    background: `linear-gradient(135deg, ${cat.color}${isExpanded ? "12" : "08"} 0%, white 100%)`,
                  }}
                >
                  {/* Accent bar */}
                  <div className="absolute top-0 left-0 right-0 rounded-t-xl transition-all duration-200"
                    style={{ backgroundColor: cat.color, height: isExpanded ? 3 : 2 }} />

                  {/* Header row: label + sparkline */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: cat.color }}>
                      {cat.label}
                    </div>
                    <MiniSparkline data={sparkData} color={cat.color} />
                  </div>

                  {/* Revenue */}
                  <div className="mb-2">
                    <div className="flex items-end gap-0.5 text-[26px] font-black leading-none" style={{ color: cat.color }}>
                      <span className="text-[15px] mb-0.5">₹</span>
                      <span>{cat.revenue.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                    <p className="text-[11px] font-semibold text-[#94A3B8] mt-0.5">
                      {cat.orders} {cat.orders === 1 ? "order" : "orders"}
                    </p>
                  </div>

                  {/* Trend vs previous period */}
                  <div className="mb-3">
                    <TrendBadge diff={cat.trendDiff} pct={cat.trendPct} prevLabel={prevLabel} color={cat.color} />
                  </div>

                  {/* Share bar */}
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                    <div className="h-full rounded-full transition-all duration-700" style={{ backgroundColor: cat.color, width: `${cat.share}%` }} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-[#94A3B8]">{cat.share.toFixed(1)}% of total</span>
                    <span className={`text-[10px] font-black flex items-center gap-0.5 transition-opacity ${isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} style={{ color: cat.color }}>
                      {isExpanded ? "Collapse" : "Drill down"} <FiArrowUpRight size={10} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── IN-PLACE DRILL-DOWN ── */}
          {expandedCategory && expandedCat && (
            <div ref={drillRef} className="mt-5 rounded-xl border-2 overflow-hidden" style={{ borderColor: `${expandedCat.color}30` }}>
              {/* Drill header */}
              <div className="px-5 py-4 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${expandedCat.color}10 0%, ${expandedCat.color}05 100%)` }}>
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 rounded-full" style={{ backgroundColor: expandedCat.color }} />
                  <div>
                    <h3 className="text-[14px] font-black text-[#0F172A]">{expandedCat.label} — Property Breakdown</h3>
                    <p className="text-[11px] font-medium text-[#94A3B8]">
                      {expandedProperties.length} {expandedProperties.length === 1 ? "property" : "properties"} ·{" "}
                      {period === "today" ? "today" : period === "week" ? "this week" : "this month"}
                    </p>
                  </div>
                </div>
                <button onClick={() => setExpandedCategory(null)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <FiX size={16} />
                </button>
              </div>

              {expandedProperties.length > 0 ? (
                <div className="space-y-4 p-4 md:p-6 bg-slate-50/50">
                  {expandedProperties.map((row, i) => {
                    const totalPropsRev = expandedProperties.reduce((s, r) => s + r.revenue, 0) || 1;
                    const share = ((row.revenue / totalPropsRev) * 100).toFixed(1);
                    const hasEntryModes = row.entryModes && (row.entryModes.bulk.orders > 0 || row.entryModes.student.orders > 0);

                    return (
                      <div key={row.property} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-5">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[13px] font-black shadow-inner" style={{ backgroundColor: PROPERTY_COLORS[i % PROPERTY_COLORS.length] }}>
                              {row.property.charAt(0)}
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Property</p>
                              <h4 className="text-[16px] font-bold text-[#0F172A] leading-none mb-1.5">{row.property}</h4>
                              <p className="text-[11px] font-bold text-slate-500">
                                {row.orders} orders · {row.kg > 0 ? `${row.kg.toFixed(1)} kg · ` : ''}{share}% share
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Revenue</p>
                            <div className="text-[20px] font-black text-[#0F172A] leading-none">
                              <span className="text-[14px] mr-0.5">₹</span>
                              {row.revenue.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                          </div>
                        </div>

                        {hasEntryModes && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t border-dashed border-slate-100">
                            {/* Bulk */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-center mb-3">
                                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hostel Bulk</p>
                                  <p className="text-[10px] font-bold text-slate-400">{row.entryModes.bulk.orders} orders</p>
                                </div>
                                <p className="text-[16px] font-black text-[#0F172A] mb-2">
                                  <span className="text-[12px] mr-0.5">₹</span>
                                  {row.entryModes.bulk.revenue.toLocaleString("en-IN")}
                                </p>
                                <p className="text-[11px] font-bold text-slate-500 mb-4">
                                  {row.entryModes.bulk.kg > 0 ? `${row.entryModes.bulk.kg.toFixed(1)} kg` : '0 kg'}
                                  {' — '}
                                  {row.entryModes.bulk.clothes > 0 ? `${row.entryModes.bulk.clothes} pcs` : '- pcs'}
                                </p>
                              </div>
                              <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-[#94A3B8] pt-3 border-t border-slate-200/50 mt-auto">
                                <span>Path</span>
                                <span className="text-blue-600 cursor-pointer hover:text-blue-700 transition-colors">Drill In</span>
                              </div>
                            </div>
                            
                            {/* Student */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-center mb-3">
                                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Student Orders</p>
                                  <p className="text-[10px] font-bold text-slate-400">{row.entryModes.student.orders} orders</p>
                                </div>
                                <p className="text-[16px] font-black text-[#0F172A] mb-2">
                                  <span className="text-[12px] mr-0.5">₹</span>
                                  {row.entryModes.student.revenue.toLocaleString("en-IN")}
                                </p>
                                <p className="text-[11px] font-bold text-slate-500 mb-4">
                                  {row.entryModes.student.kg > 0 ? `${row.entryModes.student.kg.toFixed(1)} kg` : '0 kg'}
                                  {' — '}
                                  {row.entryModes.student.clothes > 0 ? `${row.entryModes.student.clothes} pcs` : '- pcs'}
                                  {' — '}
                                  {row.entryModes.student.students > 0 ? `${row.entryModes.student.students} students` : '- students'}
                                </p>

                                {row.entryModes.student.details && row.entryModes.student.details.length > 0 && (
                                  <div className="mt-2 mb-4 space-y-2 max-h-[140px] overflow-y-auto pr-1">
                                    {row.entryModes.student.details.map((detail, idx) => (
                                      <div key={detail.id || idx} className="bg-white rounded-lg p-2.5 flex justify-between items-center border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                                        <div className="overflow-hidden pr-2">
                                          <p className="text-[11px] font-bold text-[#0F172A] truncate" title={detail.name || "Student"}>
                                            {detail.name || "Student"}
                                          </p>
                                          <p className="text-[9px] font-black text-slate-400 mt-0.5 truncate tracking-wide">
                                            {detail.room ? `Room ${detail.room}` : null}
                                            {detail.room && detail.service ? ' · ' : null}
                                            {detail.service || "Laundry"}
                                          </p>
                                        </div>
                                        <div className="text-[11px] font-black text-emerald-600 shrink-0">
                                          ₹{detail.amount?.toLocaleString("en-IN") || 0}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-[#94A3B8] pt-3 border-t border-slate-200/50 mt-auto">
                                <span>Path</span>
                                <span className="text-blue-600 cursor-pointer hover:text-blue-700 transition-colors">Drill In</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-[12px] text-[#94A3B8] font-medium">
                  No property-level data for this category in this period.
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
            <FiTrendingUp size={24} className="text-gray-300" />
          </div>
          <p className="text-[14px] font-bold text-[#0F172A] mb-1">No revenue in this period</p>
          <p className="text-[12px] text-[#94A3B8]">Orders will appear here as they are logged.</p>
        </div>
      )}
    </div>
  );
}

// ── Property Performance Table ───────────────────────────────────
function PropertyPerformanceTable({ visibleRows, showFilterMenu, setShowFilterMenu, showSortMenu, setShowSortMenu, filterType, setFilterType, sortConfig, setSortConfig, onRowClick }) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-gray-50 flex flex-wrap items-center justify-between gap-4 bg-white">
        <div>
          <h2 className="text-[15px] font-bold text-[#0F172A] mb-0.5">Property Performance</h2>
          <p className="text-[12px] font-medium text-[#94A3B8]">All-time metrics · Click a row to view orders</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="relative">
            <button onClick={() => { setShowFilterMenu((c) => !c); setShowSortMenu(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[12px] font-bold transition-colors ${filterType !== "All" ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-white border-gray-200 text-[#475569] hover:bg-gray-50"}`}>
              <FiFilter size={14} /> {filterType === "All" ? "Filter" : filterType}
            </button>
            {showFilterMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-100 rounded-xl shadow-xl z-20 overflow-hidden py-1">
                {TYPE_FILTERS.map((f) => (
                  <button key={f} onClick={() => { setFilterType(f); setShowFilterMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-[12px] font-bold transition-colors ${filterType === f ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50"}`}>
                    {f} {f === "All" ? "Types" : "Properties"}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Sort */}
          <div className="relative">
            <button onClick={() => { setShowSortMenu((c) => !c); setShowFilterMenu(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[12px] font-bold transition-colors ${sortConfig.key !== "rev" || sortConfig.direction !== "desc" ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-white border-gray-200 text-[#475569] hover:bg-gray-50"}`}>
              Sort <FiChevronDown size={14} className={`transition-transform ${showSortMenu ? "rotate-180" : ""}`} />
            </button>
            {showSortMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-20 overflow-hidden py-1">
                {[
                  { key: "rev", label: "Revenue (High-Low)", dir: "desc" },
                  { key: "rev", label: "Revenue (Low-High)", dir: "asc" },
                  { key: "orders", label: "Order Velocity", dir: "desc" },
                  { key: "kg", label: "KG Processed", dir: "desc" },
                ].map((sort) => (
                  <button key={`${sort.key}-${sort.dir}`}
                    onClick={() => { setSortConfig({ key: sort.key, direction: sort.dir }); setShowSortMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-[12px] font-bold transition-colors ${sortConfig.key === sort.key && sortConfig.direction === sort.dir ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50"}`}>
                    {sort.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Collapse toggle */}
          <button onClick={() => setIsCollapsed((c) => !c)}
            className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-[12px] font-bold text-[#475569] hover:bg-gray-50 transition-colors">
            <FiChevronRight size={14} className={`transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`} />
            {isCollapsed ? "Show" : "Hide"}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  <th className="text-left text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Property</th>
                  <th className="text-left text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Type</th>
                  <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Orders</th>
                  <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">KG Processed</th>
                  <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Total Revenue</th>
                  <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Avg Order</th>
                  <th className="text-center text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Last Activity</th>
                  <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Details</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr key={row.id} className="border-b border-gray-50 hover:bg-[#F8FAFC] transition-colors cursor-pointer" onClick={() => onRowClick(row)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[13px] font-extrabold flex-shrink-0 shadow-sm" style={{ backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }}>
                          {row.name?.charAt(0)}
                        </div>
                        <span className="text-[13.5px] font-bold text-[#0F172A]">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-[0.05em] ${getStatusBadgeClass(row.hostelType)}`}>{row.hostelType}</span>
                    </td>
                    <td className="px-6 py-4 text-[13.5px] font-extrabold text-[#475569] text-right">{row.orders}</td>
                    <td className="px-6 py-4 text-[13px] font-bold text-[#64748B] text-right">{row.kg > 0 ? row.kg.toFixed(1) : "—"}</td>
                    <td className="px-6 py-4 text-[13.5px] font-black text-[#0F172A] text-right">
                      <div className="flex items-center justify-end gap-0.5"><BiRupee size={14} /><span>{row.rev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                    </td>
                    <td className="px-6 py-4 text-[13px] font-bold text-[#64748B] text-right">
                      {row.orders > 0 ? <div className="flex items-center justify-end gap-0.5"><BiRupee size={12} /><span>{(row.rev / row.orders).toFixed(0)}</span></div> : "—"}
                    </td>
                    <td className="px-6 py-4 text-[13px] font-medium text-[#94A3B8] text-center">
                      {row.last ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(row.last) : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-[#475569] text-[12px] font-bold hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all">
                        View <FiArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
          <div className="md:hidden divide-y divide-gray-50">
            {visibleRows.map((row, index) => (
              <div key={row.id} onClick={() => onRowClick(row)} className="p-4 active:bg-gray-50 transition-colors cursor-pointer">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-sm" style={{ backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }}>
                      {row.name?.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#0F172A]">{row.name}</h4>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${getStatusBadgeClass(row.hostelType)}`}>{row.hostelType}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-0.5 text-sm font-black text-[#0F172A]">
                      <BiRupee size={12} className="text-slate-400" /><span>{row.rev.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{row.orders} Orders</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OverviewDateFilter({ dateFrom, setDateFrom, dateTo, setDateTo }) {
  const [activePreset, setActivePreset] = useState("Custom");

  const handlePresetClick = (preset) => {
    setActivePreset(preset);
    let newFrom = dateFrom;
    let newTo = getTodayString();

    switch(preset) {
      case 'Daily':
        newFrom = getTodayString();
        break;
      case 'Weekly':
        newFrom = formatDateString(-7);
        break;
      case 'Monthly':
        newFrom = formatDateString(-30);
        break;
      default:
        return;
    }

    setDateFrom(newFrom);
    setDateTo(newTo);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">Quick Date Filter</span>
        {['Daily', 'Weekly', 'Monthly'].map(preset => (
          <button
            key={preset}
            onClick={() => handlePresetClick(preset)}
            className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all ${
              activePreset === preset
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "bg-slate-50 text-slate-500 hover:bg-slate-100"
            }`}
          >
            {preset}
          </button>
        ))}
      </div>
      <div className="text-[12px] font-bold text-slate-400">
        Active Period: <span className="text-slate-700 font-extrabold">{dateFrom} — {dateTo}</span>
      </div>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────
export default function AdminOverviewTab({ orders, daysInRange, dateFrom, setDateFrom, dateTo, setDateTo }) {
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [filterType, setFilterType] = useState("All");
  const [sortConfig, setSortConfig] = useState({ key: "rev", direction: "desc" });
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [modalFilterStatus, setModalFilterStatus] = useState("All");
  const [modalFilterProperty, setModalFilterProperty] = useState("All");
  const [selectedModalOrder, setSelectedModalOrder] = useState(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const windowWidth = useWindowWidth();

  const {
    buildPeriodData, categoryBreakdown, categorySparklines,
    dailyRevenue, propertyRows, todayString, totalRevenue,
  } = useOverviewMetrics({ orders, daysInRange });

  const visibleRows = useMemo(() => {
    let rows = [...propertyRows];
    if (filterType !== "All") rows = rows.filter((row) => row.hostelType === filterType);
    rows.sort((left, right) => {
      const leftValue = left[sortConfig.key] || 0;
      const rightValue = right[sortConfig.key] || 0;
      return sortConfig.direction === "desc" ? rightValue - leftValue : leftValue - rightValue;
    });
    return rows;
  }, [filterType, propertyRows, sortConfig]);

  const selectedOrders = useMemo(() => {
    if (!selectedProperty) return [];
    return filterOrdersForRow({ modalFilterProperty, modalFilterStatus, row: selectedProperty, orders });
  }, [modalFilterProperty, modalFilterStatus, orders, selectedProperty]);

  const handleOpenPropertyModal = (row) => {
    setSelectedProperty(row);
    setModalFilterStatus("All");
    setModalFilterProperty("All");
  };

  return (
    <div className="space-y-6" style={{ fontFamily: "DM Sans, sans-serif" }}>
      {dateFrom && setDateFrom && dateTo && setDateTo && (
        <OverviewDateFilter 
          dateFrom={dateFrom} 
          setDateFrom={setDateFrom} 
          dateTo={dateTo} 
          setDateTo={setDateTo} 
        />
      )}
      <ExpandedOverviewLayout orders={orders} />

      {/* P0 HERO: Revenue Sources with Period Toggle + Sparklines + Trends + Drill-Down */}
      <RevenueSources
        buildPeriodData={buildPeriodData}
        categorySparklines={categorySparklines}
        todayString={todayString}
      />

      {/* Revenue Trend + All-time Category */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6 pb-2 min-w-0">
          <div className="mb-6">
            <h2 className="text-[15px] font-bold text-[#0F172A]">Revenue Trend</h2>
            <p className="text-[12px] font-medium text-[#94A3B8]">Daily revenue for the selected period</p>
          </div>
          <ResponsiveContainer width="100%" height={windowWidth < 640 ? 200 : 260} debounce={100} minWidth={1} minHeight={1}>
            <AreaChart data={dailyRevenue} margin={{ top: 10, right: 10, left: windowWidth < 640 ? -25 : -10, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94A3B8", fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} interval={windowWidth < 640 ? 2 : 0} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8", fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} width={windowWidth < 640 ? 35 : 50} />
              <Tooltip content={<RevenueChartTooltip />} cursor={{ stroke: "#3B82F6", strokeWidth: 1.5, strokeDasharray: "4 4" }} />
              <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} fill="url(#revGrad)" dot={{ r: 4, fill: "#3B82F6", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={2000} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* All-time Category */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 overflow-y-auto">
          <h2 className="text-[15px] font-bold text-[#0F172A] mb-1">Revenue by Category</h2>
          <p className="text-[12px] font-medium text-[#94A3B8] mb-5">All-time share</p>
          <div className="space-y-5">
            {categoryBreakdown.map((category) => (
              <div key={category.label} className="group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
                    <span className="text-[13px] font-bold text-[#475569]">{category.label}</span>
                  </div>
                  <div className="flex items-center justify-end gap-0.5 text-[13px] font-extrabold text-[#0F172A]">
                    <BiRupee size={12} /><span>{category.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ backgroundColor: category.color, width: `${category.share}%` }} />
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">{category.orders} Orders</span>
                  <span className="text-[10px] font-bold" style={{ color: category.color }}>{category.share.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* P2: Property Performance - Collapsed by default */}
      <PropertyPerformanceTable
        visibleRows={visibleRows}
        showFilterMenu={showFilterMenu}
        setShowFilterMenu={setShowFilterMenu}
        showSortMenu={showSortMenu}
        setShowSortMenu={setShowSortMenu}
        filterType={filterType}
        setFilterType={setFilterType}
        sortConfig={sortConfig}
        setSortConfig={setSortConfig}
        onRowClick={handleOpenPropertyModal}
      />

      {/* Property Drill-Down Modal */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedProperty(null)} />
          <div className="relative bg-white sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-w-5xl sm:max-h-[90vh] flex flex-col overflow-hidden" style={{ fontFamily: "DM Sans, sans-serif" }}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedProperty.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getStatusBadgeClass(selectedProperty.hostelType)}`}>{selectedProperty.hostelType}</span>
                  <p className="text-sm text-gray-500">Detailed Order History</p>
                </div>
              </div>
              <button onClick={() => setSelectedProperty(null)} className="p-2 text-gray-400 hover:text-[#DC2626] hover:bg-red-50 rounded-xl transition-colors">
                <FiX size={24} />
              </button>
            </div>

            <div className="bg-gray-50 p-4 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 flex-shrink-0">
              {[
                { label: "Total Orders", value: selectedProperty.orders },
                { label: "KG Processed", value: selectedProperty.kg.toFixed(1) },
                { label: "Total Clothes", value: selectedProperty.clothes || 0 },
              ].map((stat) => (
                <div key={stat.label} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center">
                  <p className="text-xs text-gray-400 font-medium">{stat.label}</p>
                  <p className="text-lg font-bold text-gray-800">{stat.value}</p>
                </div>
              ))}
              <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center">
                <p className="text-xs text-gray-400 font-medium">Total Revenue</p>
                <div className="flex items-center justify-center gap-0.5 text-lg font-bold text-[#1976D2]">
                  <BiRupee size={18} /><span>{selectedProperty.rev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center">
                <p className="text-xs text-gray-400 font-medium">Avg per Order</p>
                <div className="flex items-center justify-center gap-0.5 text-lg font-bold text-gray-800">
                  <BiRupee size={16} /><span>{selectedProperty.orders > 0 ? (selectedProperty.rev / selectedProperty.orders).toFixed(0) : "—"}</span>
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1 sm:mr-2">Status</span>
                <div className="flex gap-2">
                  {STATUS_FILTERS.map((status) => (
                    <button key={status} onClick={() => setModalFilterStatus(status)}
                      className={`px-3 py-1.5 rounded-full text-[10px] sm:text-[11px] font-bold whitespace-nowrap transition-all ${modalFilterStatus === status ? "bg-slate-800 text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                      {status}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-3 sm:pt-0">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Filter Property</span>
                <select value={modalFilterProperty} onChange={(e) => setModalFilterProperty(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-[11px] sm:text-[12px] font-bold rounded-lg px-3 py-2 sm:py-1.5 outline-none focus:border-blue-500 min-w-[140px]">
                  <option value="All">All Properties</option>
                  {selectedProperty.properties.map((property) => (
                    <option key={property} value={property}>{property}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <OrderTable orders={selectedOrders} showTenant={false} onRowClick={(order) => { setSelectedModalOrder(order); setIsOrderModalOpen(true); }} />
            </div>
          </div>
        </div>
      )}

      <AdminOrderModal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} order={selectedModalOrder} />

      {/* P2: Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
