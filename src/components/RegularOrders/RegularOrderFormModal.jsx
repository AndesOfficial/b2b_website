import { useState, useCallback, useMemo, useEffect } from "react";
import { FiX, FiUser, FiPhone, FiCalendar, FiCheckCircle, FiPlus, FiTrash2 } from "react-icons/fi";
import { BiRupee } from "react-icons/bi";

import {
  createEmptyRegularOrderForm,
  createRegularServiceLine,
  getServiceLabel,
  REGULAR_CHANNELS,
  REGULAR_RATE_MAP,
  REGULAR_SERVICE_TYPES,
  REGULAR_STATUS_OPTIONS,
} from "../../hooks/useRegularOrders";
import { isNegativeNumberInput } from "../../utils/numberInputUtils";

const POSITIVE_NUMERIC_FIELDS = new Set(["amount"]);
const SERVICE_LINE_NUMERIC_FIELDS = ["weight", "quantity", "amount"];

export default function RegularOrderFormModal({ isOpen, onClose, initialOrder, onSubmit }) {
  const [form, setForm] = useState(createEmptyRegularOrderForm());

  useEffect(() => {
    if (isOpen) {
      if (initialOrder) {
        const breakdownFromOrder = (initialOrder.serviceBreakdown && initialOrder.serviceBreakdown.length > 0)
          ? initialOrder.serviceBreakdown.map((line) =>
              createRegularServiceLine({
                serviceType: line.name || line.serviceType || REGULAR_SERVICE_TYPES[0],
                weight: line.weight ? String(line.weight) : "",
                quantity: line.quantity ? String(line.quantity) : "",
                amount: line.amount ? String(line.amount) : "",
              })
            )
          : [
              createRegularServiceLine({
                serviceType: getServiceLabel(initialOrder.service),
                amount: initialOrder.amount ? String(initialOrder.amount) : "",
              }),
            ];

        setForm({
          id: initialOrder.id,
          customerName: initialOrder.customerName || "",
          phone: initialOrder.customerNumber || "",
          channel: initialOrder.channel || "App",
          amount: initialOrder.amount ? String(initialOrder.amount) : "",
          pickupDate: initialOrder.date || "",
          deliveryDate: initialOrder.deliveryDate || "",
          notes: initialOrder.notes || "",
          status: initialOrder.status || "Confirmed",
          serviceBreakdown: breakdownFromOrder,
          originalOrder: initialOrder,
        });
      } else {
        setForm(createEmptyRegularOrderForm());
      }
    }
  }, [isOpen, initialOrder]);

  const updateForm = useCallback((key, value) => {
    if (POSITIVE_NUMERIC_FIELDS.has(key) && isNegativeNumberInput(value)) return;
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const parseNumberValue = useCallback((value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }, []);

  const updateServiceLine = useCallback((lineId, field, value) => {
    if (SERVICE_LINE_NUMERIC_FIELDS.includes(field) && isNegativeNumberInput(value)) return;
    setForm((prev) => ({
      ...prev,
      serviceBreakdown: prev.serviceBreakdown.map((line) =>
        line.id === lineId ? { ...line, [field]: value } : line
      ),
    }));
  }, []);

  const addServiceLine = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      serviceBreakdown: [...prev.serviceBreakdown, createRegularServiceLine()],
    }));
  }, []);

  const removeServiceLine = useCallback((lineId) => {
    setForm((prev) => {
      if (prev.serviceBreakdown.length === 1) return prev;
      return {
        ...prev,
        serviceBreakdown: prev.serviceBreakdown.filter((line) => line.id !== lineId),
      };
    });
  }, []);

  const breakdownLines = form.serviceBreakdown && form.serviceBreakdown.length > 0
    ? form.serviceBreakdown
    : [createRegularServiceLine()];

  const breakdownAmountTotal = useMemo(
    () => breakdownLines.reduce((sum, line) => sum + parseNumberValue(line.amount), 0),
    [breakdownLines, parseNumberValue]
  );
  
  const displayedAmountValue = form.amount !== "" ? form.amount : breakdownAmountTotal;

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

    onSubmit(nextOrder, !!form.id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-end p-0 sm:p-4">
      <div className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full sm:h-auto sm:max-h-[90vh] bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-left">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <div>
            <h2 className="text-[18px] font-black text-[#0F172A] tracking-tight">{form.id ? "Modify Transaction" : "Record New Sale"}</h2>
            <p className="text-[12px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">Andes B2C Retail Management</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
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
          <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black text-[13px] rounded-xl hover:bg-slate-200 transition-all uppercase tracking-widest">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!form.customerName || (parseNumberValue(form.amount) <= 0 && breakdownAmountTotal <= 0)}
            className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-[13px] rounded-xl transition-all shadow-xl active:scale-95 uppercase tracking-widest"
          >
            {form.id ? "Validate & Update" : "Commit Transaction"}
          </button>
        </div>
      </div>
    </div>
  );
}
