import { useState } from "react";
import { FiPlus, FiSmartphone, FiMessageSquare, FiShoppingBag, FiPhone, FiUser, FiEdit2, FiTrash2, FiInbox, FiCalendar, FiChevronRight, FiMapPin } from "react-icons/fi";
import { BiRupee } from "react-icons/bi";
import EmptyState from "../Shared/EmptyState";
import AdminOrderModal from "../Shared/AdminOrderModal";
import FilterPills from "../Shared/FilterPills";
import TabSectionCard from "../Shared/TabSectionCard";
import { REGULAR_CHANNELS, getServiceLabel, useRegularOrders } from "../../hooks/useRegularOrders";
import { calculateTAT } from "../../utils/dateUtils";

const CHANNEL_ICONS = { App: FiSmartphone, Auto: FiMapPin, Website: FiShoppingBag, WhatsApp: FiMessageSquare, Outlet: FiShoppingBag, Call: FiPhone, Student: FiUser };
const CHANNEL_COLORS = { App: "#1976D2", Auto: "#0EA5E9", Website: "#6366F1", WhatsApp: "#25D366", Outlet: "#D97706", Call: "#7C3AED", Student: "#059669" };
const STATUS_BADGE = {
  Delivered: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Confirmed: "bg-blue-50 text-blue-700 border-blue-100",
  Pending: "bg-amber-50 text-amber-700 border-amber-100",
  Processing: "bg-indigo-50 text-indigo-700 border-indigo-100",
};

export default function TransactionsLogDashboard({ currentOrders, onAddOrder, onEditOrder, onDeleteOrder }) {
  const [channelFilter, setChannelFilter] = useState("All");
  const [selectedDrilldownOrder, setSelectedDrilldownOrder] = useState(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);

  const { channelStats, filteredOrders } = useRegularOrders(currentOrders, channelFilter);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {REGULAR_CHANNELS.filter((channel) => channel !== "All").map((channel) => {
          const Icon = CHANNEL_ICONS[channel];
          const stats = channelStats[channel];
          const isActive = channelFilter === channel;

          return (
            <button
              key={channel}
              onClick={() => setChannelFilter(channel === channelFilter ? "All" : channel)}
              className={`group bg-white rounded-xl border p-3.5 sm:p-5 text-left transition-all duration-300 relative overflow-hidden ${
                isActive
                  ? "border-blue-500 shadow-md ring-1 ring-blue-500/20"
                  : "border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-colors ${
                    isActive ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100"
                  }`}
                  style={!isActive ? { color: CHANNEL_COLORS[channel], backgroundColor: `${CHANNEL_COLORS[channel]}10` } : {}}
                >
                  {Icon && <Icon size={16} />}
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
              </div>
              <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{channel}</p>
              <div className="flex items-baseline gap-1.5 sm:gap-2">
                <p className="text-lg sm:text-[20px] font-black text-[#0F172A] tracking-tight">{stats?.count || 0}</p>
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-400">orders</p>
              </div>
              <div className="flex items-center gap-0.5 text-[11px] sm:text-[12px] font-black text-blue-600 mt-1">
                <BiRupee size={10} className="mb-0.5" />
                <span>{stats?.revenue?.toLocaleString() || 0}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <FilterPills options={REGULAR_CHANNELS} activeValue={channelFilter} onChange={setChannelFilter} />
        {onAddOrder && (
          <button
            onClick={onAddOrder}
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3 bg-blue-600 text-white text-[13px] font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg active:scale-95 uppercase tracking-widest"
          >
            <FiPlus size={18} /> Log New Order
          </button>
        )}
      </div>

      <TabSectionCard title="Retail Transaction Log" subtitle={`${filteredOrders.length} total orders found`}>
        <div className="hidden md:block overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-[#F8FAFC] sticky top-0 z-10">
              <tr>
                <th className="text-left text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Customer Identity</th>
                <th className="text-left text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Service Detail</th>
                <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Stats (KG/PCS)</th>
                <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Amount (₹)</th>
                <th className="text-left text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Pickup Date</th>
                <th className="text-left text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Delivery Date</th>
                <th className="text-center text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Status</th>
                <th className="text-center text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">TAT</th>
                <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12">
                    <EmptyState
                      icon={FiInbox}
                      title="No matching transactions"
                      message="Adjust your filters or start by logging a new customer order."
                    />
                  </td>
                </tr>
              ) : filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => { setSelectedDrilldownOrder(order); setIsDrilldownOpen(true); }}
                  className="border-b border-gray-50 hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <p className="text-[14px] font-black text-[#0F172A] tracking-tight">{order.customerName || "Anonymous"}</p>
                    <p className="text-[11px] font-medium text-slate-400">{order.customerNumber || "no contact"}</p>
                    {order.address && (
                      <p className="text-[10px] font-medium text-slate-400 mt-1 truncate max-w-[200px]">{order.address}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[13px] font-bold text-slate-700">{getServiceLabel(order.service)}</p>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-tighter">
                        {order.channel || "direct"}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-400 italic truncate max-w-[150px]">{order.notes || order.serviceBreakdownSummary || "No special notes"}</p>
                    {order.serviceBreakdown?.length > 1 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {order.serviceBreakdown.map((line, index) => {
                          const qty = Number(line.quantity);
                          const wt = Number(line.weight);
                          return (
                            <span key={`${line.name}-${index}`} className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-100">
                              {line.name}
                              {(qty > 0 || wt > 0) && " • "}
                              {qty > 0 && `${qty} pcs`}
                              {qty > 0 && wt > 0 && " / "}
                              {wt > 0 && `${wt.toFixed(1)} kg`}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-[13px] font-black text-slate-800">{order.weight?.toFixed(1) || "0.0"} <span className="text-[10px] text-slate-400">kg</span></p>
                    <p className="text-[11px] font-bold text-slate-400">{order.items || "—"} pcs</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-0.5 text-[14px] font-black text-blue-600 tracking-tight">
                      <BiRupee size={13} className="mb-0.5" />
                      <span>{order.amount?.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[13px] font-bold text-slate-500 whitespace-nowrap">{order.date}</td>
                  <td className="px-6 py-4 text-[13px] font-bold text-slate-500 whitespace-nowrap">{order.deliveryDate || "Pending"}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${STATUS_BADGE[order.status] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[12px] font-bold text-slate-500 whitespace-nowrap">
                      {calculateTAT(order.createdAtRaw, order.updatedAtRaw)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      {onEditOrder && (
                        <button onClick={(event) => { event.stopPropagation(); onEditOrder(order); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                          <FiEdit2 size={15} />
                        </button>
                      )}
                      {onDeleteOrder && (
                        <button onClick={(event) => { event.stopPropagation(); onDeleteOrder(order); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                          <FiTrash2 size={15} />
                        </button>
                      )}
                      <FiChevronRight size={16} className="text-slate-400 ml-1" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-gray-50 uppercase tracking-tight">
          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic uppercase">No matching transactions</div>
          ) : filteredOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => { setSelectedDrilldownOrder(order); setIsDrilldownOpen(true); }}
              className="p-4 active:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="text-sm font-black text-[#0F172A]">{order.customerName || "Anonymous"}</h4>
                  <p className="text-[10px] font-bold text-slate-400">{order.customerNumber || "NO CONTACT"}</p>
                  {order.address && (
                    <p className="text-[9px] text-slate-500 mt-1 truncate max-w-[180px]">{order.address}</p>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border mb-1.5 ${STATUS_BADGE[order.status] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
                    {order.status}
                  </span>
                  <div className="text-[9px] font-bold text-slate-400 mb-1">
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
              <p className="text-[10px] font-medium text-slate-400 italic">{order.notes || order.serviceBreakdownSummary || "No special notes"}</p>
              
              {order.serviceBreakdown?.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                  {order.serviceBreakdown.map((line, index) => {
                    const qty = Number(line.quantity);
                    const wt = Number(line.weight);
                    return (
                      <span key={`${line.name}-${index}`} className="px-2 py-1 rounded-full border border-slate-100 bg-white text-slate-500 shadow-sm">
                        {line.name}
                        {(qty > 0 || wt > 0) && " • "}
                        {qty > 0 && `${qty} pcs`}
                        {qty > 0 && wt > 0 && " / "}
                        {wt > 0 && `${wt.toFixed(1)} kg`}
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mt-3">
                <div className="flex items-center gap-1.5">
                  <FiCalendar size={12} />
                  <span>{order.date}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="uppercase text-[8px] tracking-widest">To:</span>
                  <span className={order.deliveryDate ? "text-slate-600" : "text-amber-500"}>{order.deliveryDate || "TBD"}</span>
                </div>
              </div>
            </div>
          ))}
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
