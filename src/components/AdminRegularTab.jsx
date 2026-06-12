import { useState } from "react";
import { FiPlus, FiX, FiCheck, FiSmartphone, FiMessageSquare, FiShoppingBag, FiPhone, FiUser, FiEdit2, FiTrash2, FiInbox, FiCheckCircle, FiCalendar, FiChevronRight, FiMapPin } from "react-icons/fi";
import { BiRupee } from "react-icons/bi";
import EmptyState from "./EmptyState";
import AdminOrderModal from "./AdminOrderModal";
import FilterPills from "./FilterPills";
import TabSectionCard from "./TabSectionCard";
import {
  createEmptyRegularOrderForm,
  createRegularServiceLine,
  getServiceLabel,
  REGULAR_CHANNELS,
  REGULAR_RATE_MAP,
  REGULAR_SERVICE_TYPES,
  REGULAR_STATUS_OPTIONS,
  useRegularOrders,
} from "../hooks/useRegularOrders";
import { isNegativeNumberInput } from "../utils/numberInputUtils";
import { calculateTAT } from "../utils/dateUtils";

const CHANNEL_ICONS = { App: FiSmartphone, Auto: FiMapPin, Website: FiShoppingBag, WhatsApp: FiMessageSquare, Outlet: FiShoppingBag, Call: FiPhone, Student: FiUser };
const CHANNEL_COLORS = { App: "#1976D2", Auto: "#0EA5E9", Website: "#6366F1", WhatsApp: "#25D366", Outlet: "#D97706", Call: "#7C3AED", Student: "#059669" };
const STATUS_BADGE = {
  Delivered: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Confirmed: "bg-blue-50 text-blue-700 border-blue-100",
  Pending: "bg-amber-50 text-amber-700 border-amber-100",
  Processing: "bg-indigo-50 text-indigo-700 border-indigo-100",
};

const POSITIVE_NUMERIC_FIELDS = new Set(["amount"]);

export default function AdminRegularTab({ orders, onAddOrder, onEditOrder, onDeleteOrder }) {
  const [channelFilter, setChannelFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState("");
  const [selectedDrilldownOrder, setSelectedDrilldownOrder] = useState(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const [form, setForm] = useState(createEmptyRegularOrderForm());
  const { channelStats, filteredOrders } = useRegularOrders(orders, channelFilter);

  const openEditModal = (order) => {
    const breakdownFromOrder = (order.serviceBreakdown && order.serviceBreakdown.length > 0)
      ? order.serviceBreakdown.map((line) =>
          createRegularServiceLine({
            serviceType: line.name || line.serviceType || REGULAR_SERVICE_TYPES[0],
            weight: line.weight ? String(line.weight) : "",
            quantity: line.quantity ? String(line.quantity) : "",
            amount: line.amount ? String(line.amount) : "",
          })
        )
      : [
          createRegularServiceLine({
            serviceType: getServiceLabel(order.service),
            amount: order.amount ? String(order.amount) : "",
          }),
        ];

    setForm({
      id: order.id,
      customerName: order.customerName || "",
      phone: order.customerNumber || "",
      channel: order.channel || "App",
      amount: order.amount ? String(order.amount) : "",
      pickupDate: order.date || "",
      deliveryDate: order.deliveryDate || "",
      notes: order.notes || "",
      status: order.status || "Confirmed",
      serviceBreakdown: breakdownFromOrder,
      originalOrder: order,
    });
    setShowModal(true);
  };

  const updateForm = (key, value) => {
    if (POSITIVE_NUMERIC_FIELDS.has(key) && isNegativeNumberInput(value)) return;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const parseNumberValue = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const updateServiceLine = (lineId, field, value) => {
    if (["weight", "quantity", "amount"].includes(field) && isNegativeNumberInput(value)) return;
    setForm((prev) => ({
      ...prev,
      serviceBreakdown: prev.serviceBreakdown.map((line) =>
        line.id === lineId ? { ...line, [field]: value } : line
      ),
    }));
  };

  const addServiceLine = () => {
    setForm((prev) => ({
      ...prev,
      serviceBreakdown: [...prev.serviceBreakdown, createRegularServiceLine()],
    }));
  };

  const removeServiceLine = (lineId) => {
    setForm((prev) => {
      if (prev.serviceBreakdown.length === 1) return prev;
      return {
        ...prev,
        serviceBreakdown: prev.serviceBreakdown.filter((line) => line.id !== lineId),
      };
    });
  };

  const resetForm = () => {
    setForm(createEmptyRegularOrderForm());
  };

  const breakdownLines = form.serviceBreakdown && form.serviceBreakdown.length > 0
    ? form.serviceBreakdown
    : [createRegularServiceLine()];

  const handleSubmit = () => {
    const parsedBreakdown = breakdownLines.map((line) => ({
      name: line.serviceType || REGULAR_SERVICE_TYPES[0],
      weight: parseNumberValue(line.weight),
      quantity: parseNumberValue(line.quantity),
      amount: parseNumberValue(line.amount),
    }));

    const totalWeight = parsedBreakdown.reduce((sum, item) => sum + item.weight, 0);
    const totalQuantity = parsedBreakdown.reduce((sum, item) => sum + item.quantity, 0);
    const breakdownAmount = parsedBreakdown.reduce((sum, item) => sum + item.amount, 0);
    const manualAmount = parseNumberValue(form.amount);
    const finalAmount = manualAmount > 0 ? manualAmount : breakdownAmount;

    if (!form.customerName || finalAmount <= 0) return;

    const summaryParts = parsedBreakdown.map((item) => {
      const metrics = [];
      if (item.quantity > 0) metrics.push(`${Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(1)} pcs`);
      if (item.weight > 0) metrics.push(`${item.weight.toFixed(1)} kg`);
      return `${item.name}${metrics.length ? ` (${metrics.join(" • ")})` : ""}`;
    }).filter(Boolean);

    const primaryService = parsedBreakdown[0]?.name || "Regular Service";
    const serviceLabel = parsedBreakdown.length <= 1
      ? primaryService
      : `${primaryService} + ${parsedBreakdown.length - 1} more`;

    const baseOrder = form.originalOrder || {};
    const nextOrder = {
      ...baseOrder,
      id: form.id || `reg-new-${Date.now()}`,
      property: "Regular Customers",
      category: "B2C_RETAIL",
      type: "regular",
      channel: form.channel,
      date: form.pickupDate || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0],
      deliveryDate: form.deliveryDate || baseOrder.deliveryDate || "",
      amount: finalAmount,
      status: form.status,
      items: Math.max(1, Math.round(totalQuantity)),
      weight: totalWeight,
      customerName: form.customerName,
      customerNumber: form.phone,
      service: serviceLabel,
      notes: form.notes,
      serviceBreakdown: parsedBreakdown,
      serviceBreakdownSummary: summaryParts.join(", "),
    };

    if (form.id) {
      onEditOrder(nextOrder);
      setToast("Order updated successfully!");
    } else {
      onAddOrder(nextOrder);
      setToast("Order added successfully!");
    }

    setShowModal(false);
    resetForm();
    setTimeout(() => setToast(""), 3000);
  };

  const breakdownAmountTotal = breakdownLines.reduce((sum, line) => sum + parseNumberValue(line.amount), 0);
  const displayedAmountValue = form.amount !== "" ? form.amount : breakdownAmountTotal;

  return (
    <div className="space-y-8" style={{ fontFamily: "DM Sans, sans-serif" }}>
      {toast && (
        <div className="fixed top-6 right-6 z-[100] bg-[#0F172A] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-left border border-slate-700/50 backdrop-blur-md">
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
            <FiCheck size={14} />
          </div>
          <span className="text-[13px] font-bold tracking-tight">{toast}</span>
        </div>
      )}

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
                  <Icon size={16} />
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
              </div>
              <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{channel}</p>
              <div className="flex items-baseline gap-1.5 sm:gap-2">
                <p className="text-lg sm:text-[20px] font-black text-[#0F172A] tracking-tight">{stats.count}</p>
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-400">orders</p>
              </div>
              <div className="flex items-center gap-0.5 text-[11px] sm:text-[12px] font-black text-blue-600 mt-1">
                <BiRupee size={10} className="mb-0.5" />
                <span>{stats.revenue.toLocaleString()}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <FilterPills options={REGULAR_CHANNELS} activeValue={channelFilter} onChange={setChannelFilter} />
        {onAddOrder && (
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3 bg-blue-600 text-white text-[13px] font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg active:scale-95 uppercase tracking-widest"
          >
            <FiPlus size={18} /> Log New Order
          </button>
        )}
      </div>

      <TabSectionCard title="Retail Transaction Log" subtitle={`${filteredOrders.length} total orders found`}>
        <div className="hidden md:block overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-[#F8FAFC]">
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
                        <button onClick={(event) => { event.stopPropagation(); openEditModal(order); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
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

              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
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

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end p-0 sm:p-4">
          <div className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg h-full sm:h-auto sm:max-h-[90vh] bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-left">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <div>
                <h2 className="text-[18px] font-black text-[#0F172A] tracking-tight">{form.id ? "Modify Transaction" : "Record New Sale"}</h2>
                <p className="text-[12px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">Andes B2C Retail Management</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                <FiX size={26} />
              </button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Customer Identity *</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"><FiUser size={18} /></div>
                    <input
                      type="text"
                      value={form.customerName}
                      onChange={(event) => updateForm("customerName", event.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                      placeholder="Legal name or Alias"
                    />
                  </div>
                </div>

                <div className="col-span-1">
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Contact Link</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"><FiPhone size={16} /></div>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(event) => updateForm("phone", event.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                      placeholder="Mobile info"
                    />
                  </div>
                </div>

                <div className="col-span-1">
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Acquisition Channel</label>
                  <select
                    value={form.channel}
                    onChange={(event) => updateForm("channel", event.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-black text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none appearance-none"
                  >
                    {REGULAR_CHANNELS.filter((channel) => channel !== "All").map((channel) => (
                      <option key={channel} value={channel}>{channel}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-4 border-t border-slate-50">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Pickup</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"><FiCalendar size={14} /></div>
                    <input
                      type="date"
                      value={form.pickupDate}
                      onChange={(event) => updateForm("pickupDate", event.target.value)}
                      className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Delivery</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"><FiCalendar size={14} /></div>
                    <input
                      type="date"
                      value={form.deliveryDate}
                      onChange={(event) => updateForm("deliveryDate", event.target.value)}
                      className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Status</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"><FiCheckCircle size={14} /></div>
                    <select
                      value={form.status}
                      onChange={(event) => updateForm("status", event.target.value)}
                      className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:outline-none appearance-none transition-all"
                    >
                      {REGULAR_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-50">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Service Breakdown</label>
                  <button
                    type="button"
                    onClick={addServiceLine}
                    className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg border border-blue-100 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all"
                  >
                    <FiPlus size={12} /> Add service
                  </button>
                </div>
                <div className="space-y-3">
                  {form.serviceBreakdown.map((line, index) => (
                    <div key={line.id} className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Service {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeServiceLine(line.id)}
                          disabled={form.serviceBreakdown.length === 1}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <select
                          value={line.serviceType}
                          onChange={(event) => updateServiceLine(line.id, "serviceType", event.target.value)}
                          className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
                        >
                          {REGULAR_SERVICE_TYPES.map((serviceType) => (
                            <option key={serviceType} value={serviceType}>{serviceType}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={line.weight}
                          onChange={(event) => updateServiceLine(line.id, "weight", event.target.value)}
                          className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
                          placeholder="Weight (KG)"
                        />
                      </div>
                      <div className="grid md:grid-cols-3 gap-3">
                        <input
                          type="number"
                          min="0"
                          value={line.quantity}
                          onChange={(event) => updateServiceLine(line.id, "quantity", event.target.value)}
                          className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
                          placeholder="Item Count"
                        />
                        <input
                          type="number"
                          min="0"
                          value={line.amount}
                          onChange={(event) => updateServiceLine(line.id, "amount", event.target.value)}
                          className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
                          placeholder="Amount"
                        />
                        <div className="flex items-center justify-end text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                          <span>
                            Std rate:{" "}
                            {REGULAR_RATE_MAP[line.serviceType] > 0 ? `₹${REGULAR_RATE_MAP[line.serviceType]}/kg` : "custom"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-widest">
                        <span>Line total</span>
                        <span className="font-black text-slate-700">₹{parseNumberValue(line.amount).toFixed(0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Final Bill Amount</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      <BiRupee size={16} />
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={displayedAmountValue}
                      onChange={(event) => updateForm("amount", event.target.value)}
                      className={`w-full pl-10 pr-4 py-4 rounded-xl text-[18px] font-black focus:outline-none border transition-all ${
                        form.amount ? "bg-blue-50/50 border-blue-200 text-blue-700" : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Instructional Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:outline-none resize-none transition-all"
                  placeholder="Any special care instructions?"
                />
              </div>
            </div>

            <div className="p-8 border-t border-slate-50 bg-slate-50/20 flex gap-4 mt-auto">
              <button onClick={() => setShowModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black text-[13px] rounded-xl hover:bg-slate-200 transition-all uppercase tracking-widest">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={!form.customerName || !form.amount}
                className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-[13px] rounded-xl transition-all shadow-xl active:scale-95 uppercase tracking-widest"
              >
                {form.id ? "Validate & Update" : "Commit Transaction"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminOrderModal
        isOpen={isDrilldownOpen}
        onClose={() => setIsDrilldownOpen(false)}
        order={selectedDrilldownOrder}
      />
    </div>
  );
}
