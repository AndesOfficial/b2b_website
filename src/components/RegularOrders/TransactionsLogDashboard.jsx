import { useState, useEffect, useMemo, useDeferredValue, useCallback, Fragment } from "react";
import { FiPlus, FiSmartphone, FiMessageSquare, FiShoppingBag, FiPhone, FiUser, FiEdit2, FiTrash2, FiInbox, FiCalendar, FiChevronRight, FiChevronLeft, FiMapPin, FiSearch, FiX } from "react-icons/fi";
import { BiRupee } from "react-icons/bi";
import EmptyState from "../Shared/EmptyState";
import AdminOrderModal from "../Shared/AdminOrderModal";
import FilterPills from "../Shared/FilterPills";
import TabSectionCard from "../Shared/TabSectionCard";
import { REGULAR_CHANNELS, getServiceLabel, useRegularOrders } from "../../hooks/useRegularOrders";
import { formatTimeSlot, humanizeServiceLabel } from "../../utils/formatUtils";
import { calculateTAT } from "../../utils/dateUtils";
import { useHostelAuth } from "../../context/HostelAuthContext";

const CHANNEL_ICONS = { App: FiSmartphone, Auto: FiMapPin, Website: FiShoppingBag, WhatsApp: FiMessageSquare, Outlet: FiShoppingBag, Call: FiPhone, Student: FiUser };
const CHANNEL_COLORS = { App: "#1976D2", Auto: "#0EA5E9", Website: "#6366F1", WhatsApp: "#25D366", Outlet: "#D97706", Call: "#7C3AED", Student: "#059669" };
const STATUS_BADGE = {
  Delivered:      "bg-emerald-50 text-emerald-700 border-emerald-100",
  Confirmed:      "bg-blue-50 text-blue-700 border-blue-100",
  Pending:        "bg-amber-50 text-amber-700 border-amber-100",
  Processing:     "bg-indigo-50 text-indigo-700 border-indigo-100",
  "Pickup Done":  "bg-cyan-50 text-cyan-700 border-cyan-100",
  "In Progress":  "bg-violet-50 text-violet-700 border-violet-100",
  Cancelled:      "bg-red-50 text-red-600 border-red-100",
  Resolved:       "bg-teal-50 text-teal-700 border-teal-100",
  Abandoned:      "bg-gray-50 text-gray-400 border-gray-100",
};
const ITEMS_PER_PAGE = 15;

function getFormattedCreatedDate(order) {
  const raw = order.createdAtRaw || order.orderTimestamp || order.createdAt || order.date;
  if (!raw) return { dateStr: "—", timeStr: "" };

  let d = null;
  if (typeof raw === "object" && typeof raw.toDate === "function") {
    d = raw.toDate();
  } else if (typeof raw === "number") {
    d = new Date(raw < 100000000000 ? raw * 1000 : raw);
  } else if (typeof raw === "string") {
    d = new Date(raw);
  } else if (raw instanceof Date) {
    d = raw;
  }

  if (!d || isNaN(d.getTime())) {
    return { dateStr: order.date || "—", timeStr: "" };
  }

  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();
  const hasTime = hours !== 0 || minutes !== 0 || seconds !== 0;
  
  const timeStr = hasTime ? formatTimeSlot(d) : "";

  return { dateStr, timeStr };
}

export default function TransactionsLogDashboard({ currentOrders, onAddOrder, onEditOrder, onDeleteOrder }) {
  const { isViewer } = useHostelAuth();
  const [channelFilter, setChannelFilter] = useState("All");
  const [selectedDrilldownOrder, setSelectedDrilldownOrder] = useState(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const clearSearch = useCallback(() => setSearchQuery(""), []);
  const [currentPage, setCurrentPage] = useState(1);
  const [showZeroChannels, setShowZeroChannels] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const { channelStats, searchedOrders } = useRegularOrders(currentOrders, channelFilter, deferredSearch);
  const isSearchStale = searchQuery !== deferredSearch;

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [channelFilter, deferredSearch]);

  // ─── Pagination ───
  const totalPages = Math.max(1, Math.ceil(searchedOrders.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedOrders = useMemo(
    () => searchedOrders.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE),
    [searchedOrders, safePage]
  );
  const startItem = searchedOrders.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(safePage * ITEMS_PER_PAGE, searchedOrders.length);

  // ─── Optimization #2: Single-pass partition & sort for channels ───
  const { activeChannels, zeroChannels } = useMemo(() => {
    const active = [], zero = [];
    for (const c of REGULAR_CHANNELS) {
      if (c === "All") continue;
      ((channelStats[c]?.count || 0) > 0 ? active : zero).push(c);
    }
    const sortByCount = (a, b) => (channelStats[b]?.count || 0) - (channelStats[a]?.count || 0);
    return { activeChannels: active.sort(sortByCount), zeroChannels: zero.sort(sortByCount) };
  }, [channelStats]);

  const handleChannelChipClick = useCallback((channel) => {
    setChannelFilter(prev => prev === channel ? "All" : channel);
  }, []);

  const handleFilterPillChange = useCallback((value) => {
    setChannelFilter(value);
    setCurrentPage(1);
  }, []);

  const toggleExpandOrder = useCallback((orderId, e) => {
    e.stopPropagation();
    setExpandedOrderId(prev => prev === orderId ? null : orderId);
  }, []);

  // ─── Optimization #4: Single-pass pagination page numbers ───
  const pageNumbers = useMemo(() => {
    const result = [];
    let last = 0;
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - safePage) <= 1) {
        if (last && p - last > 1) result.push("...");
        result.push(p);
        last = p;
      }
    }
    return result;
  }, [totalPages, safePage]);

  return (
    <div className="animate-fade-in space-y-4">
      {/* ═══════════ Optimization #1: Consolidated Channel Chip Rendering ═══════════ */}
      <div className="flex flex-wrap items-center gap-2">
        {(showZeroChannels ? [...activeChannels, ...zeroChannels] : activeChannels).map(channel => {
          const Icon = CHANNEL_ICONS[channel];
          const stats = channelStats[channel] || { count: 0, revenue: 0 };
          const isActive = channelFilter === channel;
          const isZero = stats.count === 0;

          return (
            <button
              key={channel}
              onClick={() => handleChannelChipClick(channel)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                isActive ? "bg-blue-600 text-white shadow-sm" : isZero ? "bg-slate-50 border border-gray-100 text-slate-400 hover:border-gray-200" : "bg-white border border-gray-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50/50"
              }`}
            >
              {Icon && <Icon size={13} style={!isActive && !isZero ? { color: CHANNEL_COLORS[channel] } : {}} />}
              <span>{channel}</span>
              <span className={`font-black ${isActive ? "text-white/90" : isZero ? "text-slate-400" : "text-slate-900"}`}>{stats.count}</span>
              {!isZero && <span className={`text-[10px] ${isActive ? "text-white/70" : "text-slate-400"}`}>₹{stats.revenue.toLocaleString()}</span>}
            </button>
          );
        })}

        {zeroChannels.length > 0 && (
          <button
            onClick={() => setShowZeroChannels(prev => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 bg-slate-50 border border-dashed border-slate-200 hover:border-slate-300 hover:text-slate-500 transition-all"
          >
            {showZeroChannels ? (
              "Show less"
            ) : (
              <>+{zeroChannels.length} more <span className="text-[10px] text-slate-300">(0 orders)</span></>
            )}
          </button>
        )}
      </div>

      {/* ═══════════ Filters + Search + Action Button ═══════════ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
          <FilterPills options={REGULAR_CHANNELS} activeValue={channelFilter} onChange={handleFilterPillChange} />
          <div className="relative w-full sm:w-64 shrink-0">
            <FiSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={isSearchStale ? { opacity: 0.8 } : undefined}
              placeholder="Search name, phone, address…"
              className="w-full pl-10 pr-9 py-2 bg-white border border-gray-200 rounded-xl text-[13px] font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all shadow-sm"
            />
            {searchQuery && (
              <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                <FiX size={15} />
              </button>
            )}
          </div>
        </div>
        {!isViewer && onAddOrder && (
          <button
            onClick={onAddOrder}
            className="flex items-center justify-center gap-2.5 px-5 py-2.5 bg-blue-600 text-white text-[13px] font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg active:scale-95 uppercase tracking-widest whitespace-nowrap"
          >
            <FiPlus size={16} /> Log New Order
          </button>
        )}
      </div>

      {/* ═══════════ Table Card ═══════════ */}
      <TabSectionCard
        title="Placed Orders"
        subtitle={
          deferredSearch
            ? `${searchedOrders.length} results for "${deferredSearch}"`
            : searchedOrders.length > 0
              ? `Showing ${startItem}–${endItem} of ${searchedOrders.length} orders`
              : "0 orders found"
        }
      >
        {/* ── Desktop Table ── */}
        <div className="hidden md:block overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full min-w-full">
            <thead className="bg-[#F8FAFC] sticky top-0 z-10">
              <tr>
                <th className="text-left text-[11px] font-black text-[#64748B] px-4 py-3.5 uppercase tracking-[0.08em]">Customer</th>
                <th className="text-left text-[11px] font-black text-[#64748B] px-4 py-3.5 uppercase tracking-[0.08em]">Service</th>
                <th className="text-right text-[11px] font-black text-[#64748B] px-3 py-3.5 uppercase tracking-[0.08em] whitespace-nowrap">KG / PCS</th>
                <th className="text-right text-[11px] font-black text-[#64748B] px-3 py-3.5 uppercase tracking-[0.08em]">Amount</th>
                <th className="text-left text-[11px] font-black text-[#64748B] px-3 py-3.5 uppercase tracking-[0.08em]">Placed On</th>
                <th className="text-left text-[11px] font-black text-[#64748B] px-3 py-3.5 uppercase tracking-[0.08em]">Pickup</th>
                <th className="text-left text-[11px] font-black text-[#64748B] px-3 py-3.5 uppercase tracking-[0.08em]">Delivery</th>
                <th className="text-center text-[11px] font-black text-[#64748B] px-3 py-3.5 uppercase tracking-[0.08em]">Status</th>
                <th className="text-center text-[11px] font-black text-[#64748B] px-3 py-3.5 uppercase tracking-[0.08em]">TAT</th>
                {!isViewer && (
                  <th className="text-right text-[11px] font-black text-[#64748B] px-4 py-3.5 uppercase tracking-[0.08em] sticky right-0 bg-[#F8FAFC] z-20 shadow-[-4px_0_8px_rgba(0,0,0,0.04)]">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={!isViewer ? 10 : 9} className="px-4 py-12">
                    <EmptyState
                      icon={deferredSearch ? FiSearch : FiInbox}
                      title={deferredSearch ? "No results found" : "No matching transactions"}
                      message={deferredSearch ? `No orders match "${deferredSearch}". Try a different name, phone, or address.` : "Adjust your filters or start by logging a new customer order."}
                    />
                  </td>
                </tr>
              ) : paginatedOrders.map((order) => (
                <Fragment key={order.id}>
                  <tr
                    onClick={() => { setSelectedDrilldownOrder(order); setIsDrilldownOpen(true); }}
                    className={`border-b border-gray-50 hover:bg-[#F8FAFC] transition-colors group cursor-pointer ${
                      (order.status === "Cancelled" || order.type === "abandoned") ? "opacity-50" : ""
                    }`}
                  >
                    {/* Customer */}
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-black text-[#0F172A] tracking-tight">{order.customerName || "Anonymous"}</p>
                      <p className="text-[11px] font-medium text-slate-400">{order.customerNumber || "no contact"}</p>
                      {order.address && (
                        <p className="text-[10px] font-medium text-slate-400 mt-0.5 truncate max-w-[160px]">{order.address}</p>
                      )}
                    </td>
                    {/* Service — compact: title + "+N more" badge + channel badge */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-bold text-slate-700 whitespace-nowrap">{getServiceLabel(order.service)}</p>
                        {order.serviceBreakdown?.length > 1 && (
                          <button
                            onClick={(e) => toggleExpandOrder(order.id, e)}
                            className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors whitespace-nowrap"
                          >
                            +{order.serviceBreakdown.length - 1} more
                          </button>
                        )}
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-tighter whitespace-nowrap">
                          {order.channel || "direct"}
                        </span>
                      </div>
                    </td>
                    {/* Stats */}
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <p className="text-[13px] font-black text-slate-800">{order.weight?.toFixed(1) || "0.0"} <span className="text-[10px] text-slate-400">kg</span></p>
                      <p className="text-[11px] font-bold text-slate-400">{order.items || "—"} pcs</p>
                    </td>
                    {/* Amount */}
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-0.5 text-[14px] font-black text-blue-600 tracking-tight">
                        <BiRupee size={13} className="mb-0.5" />
                        <span>{order.amount?.toLocaleString()}</span>
                      </div>
                      {(order.walletAmountUsed > 0) && (
                        <div className="text-[9px] font-bold text-violet-500 mt-0.5 text-right whitespace-nowrap">💳 ₹{order.walletAmountUsed?.toLocaleString()}</div>
                      )}
                      {order.couponDiscount > 0 && (
                        <div className="text-[9px] font-bold text-emerald-500 mt-0.5 text-right whitespace-nowrap">🏷️ -₹{order.couponDiscount?.toLocaleString()}</div>
                      )}
                    </td>
                    {/* Dates */}
                    {(() => {
                      const placed = getFormattedCreatedDate(order);
                      return (
                        <td className="px-3 py-3 whitespace-nowrap">
                          <p className="text-[12px] font-black text-slate-700">{placed.dateStr}</p>
                          {placed.timeStr && <p className="text-[10px] font-medium text-slate-400">{placed.timeStr}</p>}
                        </td>
                      );
                    })()}
                    <td className="px-3 py-3 text-[12px] font-bold text-slate-500 whitespace-nowrap">{formatTimeSlot(order.pickupDate || order.date) || "—"}</td>
                    <td className="px-3 py-3 text-[12px] font-bold text-slate-500 whitespace-nowrap">{formatTimeSlot(order.deliveryDate) || "Pending"}</td>
                    {/* Status */}
                    <td className="px-3 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border whitespace-nowrap ${STATUS_BADGE[order.status] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
                        {order.status}
                      </span>
                    </td>
                    {/* TAT */}
                    <td className="px-3 py-3 text-center">
                      <span className="text-[12px] font-bold text-slate-500 whitespace-nowrap">
                        {calculateTAT(order.createdAtRaw, order.updatedAtRaw)}
                      </span>
                    </td>
                    {/* Actions — sticky right with Tailwind arbitrary shadow */}
                    {!isViewer && (
                      <td className="px-4 py-3 text-right sticky right-0 bg-white z-20 group-hover:bg-[#F8FAFC] transition-colors shadow-[-4px_0_8px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-end gap-1">
                          {onEditOrder && (
                            <button onClick={(e) => { e.stopPropagation(); onEditOrder(order); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                              <FiEdit2 size={14} />
                            </button>
                          )}
                          {onDeleteOrder && (
                            <button onClick={(e) => { e.stopPropagation(); onDeleteOrder(order); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                              <FiTrash2 size={14} />
                            </button>
                          )}
                          <FiChevronRight size={14} className="text-slate-300 ml-0.5" />
                        </div>
                      </td>
                    )}
                  </tr>
                  {/* ── Expandable Service Breakdown Row ── */}
                  {expandedOrderId === order.id && order.serviceBreakdown?.length > 1 && (
                    <tr className="bg-slate-50/50 border-b border-gray-50">
                      <td colSpan="10" className="px-4 py-3">
                        <div className="flex flex-wrap gap-2 pl-4 border-l-2 border-blue-200">
                          {order.serviceBreakdown.map((line, index) => {
                            const qty = Number(line.quantity);
                            const wt = Number(line.weight);
                            return (
                              <span key={`${line.name}-${index}`} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white text-slate-600 border border-slate-100 shadow-sm">
                                {humanizeServiceLabel(line.name)}
                                {(qty > 0 || wt > 0) && " • "}
                                {qty > 0 && `${qty} pcs`}
                                {qty > 0 && wt > 0 && " / "}
                                {wt > 0 && `${wt.toFixed(1)} kg`}
                              </span>
                            );
                          })}
                          {order.notes && (
                            <span className="text-[11px] font-medium text-slate-400 italic self-center ml-2">
                              {order.notes}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Desktop Pagination ── */}
        {searchedOrders.length > ITEMS_PER_PAGE && (
          <div className="hidden md:flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-[#FAFBFC]">
            <p className="text-[12px] font-bold text-slate-400">
              Showing {startItem}–{endItem} of {searchedOrders.length} orders
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1.5 rounded-lg border border-gray-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <FiChevronLeft size={16} />
              </button>
              {pageNumbers.map((p, i) =>
                p === "..." ? (
                  <span key={`dots-${i}`} className="px-1.5 text-slate-300 text-[12px] select-none">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`min-w-[32px] h-8 rounded-lg text-[12px] font-bold transition-all ${
                      p === safePage
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <FiChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Mobile View ── */}
        <div className="md:hidden divide-y divide-gray-50">
          {paginatedOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic uppercase">
              {deferredSearch ? `No results for "${deferredSearch}"` : "No matching transactions"}
            </div>
          ) : paginatedOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => { setSelectedDrilldownOrder(order); setIsDrilldownOpen(true); }}
              className={`p-4 active:bg-slate-50 transition-colors cursor-pointer ${
                (order.status === "Cancelled" || order.type === "abandoned") ? "opacity-50" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="text-sm font-black text-[#0F172A]">{order.customerName || "Anonymous"}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{order.customerNumber || "NO CONTACT"}</p>
                  {order.address && (
                    <p className="text-[9px] text-slate-500 mt-1 truncate max-w-[180px]">{order.address}</p>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border mb-1.5 ${STATUS_BADGE[order.status] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
                    {order.status}
                  </span>
                  <div className="text-[9px] font-bold text-slate-400 mb-1 uppercase">
                    TAT: {calculateTAT(order.createdAtRaw, order.updatedAtRaw)}
                  </div>
                  <div className="flex items-center gap-0.5 text-sm font-black text-blue-600">
                    <BiRupee size={12} className="text-blue-400" />
                    <span>{order.amount?.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100/50 flex items-center justify-between mb-3">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Service</span>
                  <span className="text-[11px] font-bold text-slate-700">{getServiceLabel(order.service)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Metric</span>
                  <span className="text-[11px] font-black text-slate-700">{order.weight?.toFixed(1)} KG / {order.items} PCS</span>
                </div>
              </div>

              {(() => {
                const placed = getFormattedCreatedDate(order);
                return (
                  <div className="flex flex-col gap-1.5 text-[10px] font-bold text-slate-500 mt-3 pt-2 border-t border-slate-100/60">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <FiCalendar size={12} className="text-blue-600" />
                        <span>Placed: <strong className="text-slate-900 font-black">{placed.dateStr}</strong> {placed.timeStr && <span className="text-[9px] font-medium text-slate-400">({placed.timeStr})</span>}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] uppercase tracking-widest text-slate-400">Pickup:</span>
                        <span className="text-slate-700 font-bold">{formatTimeSlot(order.pickupDate || order.date) || "—"}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] uppercase tracking-widest text-slate-400">Delivery:</span>
                      <span className={order.deliveryDate ? "text-slate-700 font-bold" : "text-amber-500 font-bold"}>{formatTimeSlot(order.deliveryDate) || "TBD"}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}

          {/* Mobile Pagination */}
          {searchedOrders.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between px-4 py-3 bg-[#FAFBFC]">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-[12px] font-bold text-slate-500 disabled:opacity-30 transition-all"
              >
                ← Prev
              </button>
              <span className="text-[11px] font-bold text-slate-400">
                {safePage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-[12px] font-bold text-slate-500 disabled:opacity-30 transition-all"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </TabSectionCard>

      <AdminOrderModal
        isOpen={isDrilldownOpen}
        onClose={() => setIsDrilldownOpen(false)}
        order={selectedDrilldownOrder}
      />
    </div>
  );
}
