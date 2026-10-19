import { useState, useEffect, useMemo } from "react";
import { FiX, FiEdit2, FiCheck, FiLoader, FiDownload } from "react-icons/fi";
import { BiRupee } from "react-icons/bi";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { isNegativeNumberInput } from "../../utils/numberInputUtils";
import { useHostelAuth } from "../../context/HostelAuthContext";
import { getOrAssignInvoiceNumber } from "../../utils/invoiceCounter";
import { generateSingleInvoicePDF } from "../../utils/pdfGenerator";
import { formatTimeSlot, humanizeServiceLabel } from "../../utils/formatUtils";
import { recalculateB2COrderTotal } from "../../utils/orderPricing";
import { cleanFirestoreData } from "../../utils/cleanFirestoreData";

export default function AdminOrderModal({ isOpen, onClose, order }) {
  const { client } = useHostelAuth();
  const isViewer = client?.role === "admin_viewer";
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [editForm, setEditForm] = useState({
    status: "Pending",
    amount: 0,
    weight: 0,
    studentCount: 0,
    items: 0
  });

  const isB2COrder = order
    ? order.type === "regular" ||
      order.category === "B2C_RETAIL" ||
      order.source === "cartdetails" ||
      order.source === "website"
    : false;

  // Load the current order data into the edit form whenever the modal opens
  useEffect(() => {
    if (order) {
      setEditForm({
        status: order.status || "Pending",
        amount: order.amount ?? order.totalCost ?? 0,
        weight: order.weight ?? order.clothesWeightKg ?? 0,
        studentCount: order.studentCount || 0,
        items: order.items ?? order.clothesCount ?? 0
      });
      setIsEditing(false); // Always start in "View" mode
    }
  }, [order, isOpen]);

  // Dynamic pricing preview recalculated whenever weight changes in edit mode
  const pricingPreview = useMemo(() => {
    if (!order) return null;
    return recalculateB2COrderTotal(order, editForm.weight);
  }, [order, editForm.weight]);

  if (!isOpen || !order) return null;

  // Helper to remove undefined fields recursively which Firestore doesn't support
  const cleanObject = (obj) => cleanFirestoreData(obj);

  const updatePositiveField = (field, rawValue) => {
    if (isNegativeNumberInput(rawValue)) return;
    setEditForm((prev) => ({ ...prev, [field]: rawValue }));
  };

  const handleWeightChange = (newWeightVal) => {
    if (isNegativeNumberInput(newWeightVal)) return;

    if (isB2COrder) {
      const recomputed = recalculateB2COrderTotal(order, newWeightVal);
      setEditForm((prev) => ({
        ...prev,
        weight: newWeightVal,
        amount: recomputed.amount,
      }));
    } else {
      setEditForm((prev) => ({
        ...prev,
        weight: newWeightVal,
      }));
    }
  };

  // The function that securely updates the exact document in the correct collection
  const handleUpdate = async () => {
    setIsSubmitting(true);
    try {
      // Branch collection based on category roles
      let targetCollection;
      if (order.source === "hostels") {
        targetCollection = "hostels_orders";
      } else if (order.source === "website") {
        targetCollection = "orders";
      } else if (order.source === "cartdetails") {
        targetCollection = "cartdetails";
      } else if (order.source === "b2b") {
        targetCollection = "b2b_orders";
      } else if (order.source === "admin") {
        targetCollection = "b2b_admin_edits";
      } else {
        const isB2B = 
          order.category === "STUDENT_LAUNDRY" || 
          order.category === "LINEN" || 
          order.category === "AIRBNB";
        targetCollection = isB2B ? "b2b_orders" : "b2b_admin_edits";
      }
      
      const docRef = doc(db, targetCollection, String(order.id));

      let pricingUpdates = {};
      if (isB2COrder || targetCollection === "cartdetails") {
        pricingUpdates = recalculateB2COrderTotal(order, editForm.weight, editForm.amount);
      }

      const updatedPayload = {
        ...order,
        status: editForm.status,
        amount: Number(editForm.amount),
        weight: Number(editForm.weight),
        studentCount: Number(editForm.studentCount),
        items: Number(editForm.items),
        updatedAt: new Date().toISOString(),
        ...pricingUpdates,
      };

      if (targetCollection === "hostels_orders" || order.source === "hostels") {
        updatedPayload.clothesWeightKg = Number(editForm.weight);
      }

      if (targetCollection === "cartdetails" || order.source === "cartdetails" || isB2COrder) {
        updatedPayload.clothesWeightKg = Number(editForm.weight);
        updatedPayload.clothesCount = Number(editForm.items);
        updatedPayload.totalCost = Number(editForm.amount);
        updatedPayload.calculatedAmount = Number(editForm.amount);
        if (!updatedPayload.originalTotalCost) {
          updatedPayload.originalTotalCost = Number(editForm.amount);
        }
      }

      await setDoc(docRef, cleanObject(updatedPayload), { merge: true });

      setIsEditing(false);
      onClose();
    } catch (error) {
      console.error("Error updating order:", error);
      alert("Failed to update order. Please check Firestore permissions.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadInvoice = async () => {
    setIsGeneratingInvoice(true);
    try {
      const invoiceNo = await getOrAssignInvoiceNumber(order);
      await generateSingleInvoicePDF(order, invoiceNo);
    } catch (error) {
      console.error("Failed to generate invoice:", error);
      alert("Failed to generate invoice. Please try again.");
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || "Pending").toLowerCase();
    if (s.includes("delivered") || s.includes("completed")) {
      return <span className="px-2.5 py-1 bg-green-100 text-green-700 text-[10px] font-black rounded-full uppercase tracking-wider">Delivered</span>;
    }
    if (s.includes("process") || s.includes("active")) {
      return <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-[10px] font-black rounded-full uppercase tracking-wider">Processing</span>;
    }
    return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-black rounded-full uppercase tracking-wider">{status || "Pending"}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => { setIsEditing(false); onClose(); }} />

      <div className="relative bg-white sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-w-md overflow-hidden animate-slide-up sm:animate-fade-in flex flex-col sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-100 bg-[#F8FAFC]">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-[18px] font-black text-[#0F172A] tracking-tight">{order.customerName || order.property || order.tenant || 'Unknown Property'}</h2>
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                Collection: {order.source === "hostels" ? "hostels_orders" : order.source === "b2b" ? "b2b_orders" : order.source === "cartdetails" ? "cartdetails" : order.source === "website" ? "orders" : "b2b_admin_edits"} • ID: {order.id}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <p className="text-[12px] font-bold text-slate-500">
                Placed: {order.date} {(() => {
                  const raw = order.createdAtRaw || order.orderTimestamp || order.createdAt;
                  if (!raw) return "";
                  let d = typeof raw === "object" && typeof raw.toDate === "function" ? raw.toDate() : new Date(typeof raw === "number" && raw < 100000000000 ? raw * 1000 : raw);
                  return !isNaN(d.getTime()) ? `(${formatTimeSlot(d)})` : "";
                })()}
              </p>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              {isEditing ? (
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="text-[10px] font-black rounded-full uppercase tracking-wider px-2 py-1 border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              ) : (
                getStatusBadge(order.status)
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && !isViewer && (
              <button onClick={() => setIsEditing(true)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="Edit Order">
                <FiEdit2 size={18} />
              </button>
            )}
            <button onClick={() => { setIsEditing(false); onClose(); }} className="p-2 text-slate-400 hover:text-[#DC2626] hover:bg-red-50 rounded-xl transition-colors">
              <FiX size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {order.type === 'student' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Weight (kg)</p>
                  {isEditing ? (
                    <input type="number" step="0.1" min="0" value={editForm.weight} onChange={(e) => updatePositiveField("weight", e.target.value)} className="w-full text-[16px] font-black text-[#0F172A] bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500" />
                  ) : (
                    <p className="text-[18px] font-black text-[#0F172A]">{Number(order.weight || 0).toFixed(1)} <span className="text-[12px] text-slate-500">kg</span></p>
                  )}
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Students</p>
                  {isEditing ? (
                    <input type="number" min="0" value={editForm.studentCount} onChange={(e) => updatePositiveField("studentCount", e.target.value)} className="w-full text-[16px] font-black text-[#0F172A] bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500" />
                  ) : (
                    <p className="text-[18px] font-black text-[#0F172A]">{order.studentCount || '—'}</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Service Details</h3>
                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-[14px] font-bold text-slate-600">Total Clothes (pcs)</span>
                  {isEditing ? (
                    <input type="number" min="0" value={editForm.items} onChange={(e) => updatePositiveField("items", e.target.value)} className="w-24 text-right text-[14px] font-black text-[#0F172A] bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500" />
                  ) : (
                    <span className="text-[14px] font-black text-[#0F172A]">{order.items || 0} pcs</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* B2C Weight & Pieces */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Weight</p>
                    {pricingPreview?.ratePerKg > 0 && (
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                        ₹{pricingPreview.ratePerKg}/kg
                      </span>
                    )}
                  </div>
                  {isEditing ? (
                    <div>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={editForm.weight}
                          onChange={(e) => handleWeightChange(e.target.value)}
                          className="w-full text-[16px] font-black text-[#0F172A] bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500 pr-7"
                          placeholder="0.0"
                        />
                        <span className="absolute right-2 top-1.5 text-[11px] font-bold text-slate-400">kg</span>
                      </div>
                      <p className="text-[10px] text-blue-600 font-semibold mt-1">
                        Auto-recalculates total bill
                      </p>
                    </div>
                  ) : (
                    <p className="text-[18px] font-black text-[#0F172A]">
                      {Number(order.weight ?? order.clothesWeightKg ?? 0).toFixed(1)}{" "}
                      <span className="text-[12px] text-slate-500">kg</span>
                    </p>
                  )}
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Clothes</p>
                  {isEditing ? (
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={editForm.items}
                        onChange={(e) => updatePositiveField("items", e.target.value)}
                        className="w-full text-[16px] font-black text-[#0F172A] bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500 pr-8"
                        placeholder="0"
                      />
                      <span className="absolute right-2 top-1.5 text-[11px] font-bold text-slate-400">pcs</span>
                    </div>
                  ) : (
                    <p className="text-[18px] font-black text-[#0F172A]">
                      {order.items ?? order.clothesCount ?? Object.values(order.details || {}).reduce((s, v) => s + v, 0) ?? 0}{" "}
                      <span className="text-[12px] text-slate-500">pcs</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Item Breakdown from details object */}
              {order.details && Object.keys(order.details).length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                    <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Itemized Pieces</h3>
                    <span className="text-[12px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      {Object.values(order.details).reduce((s, v) => s + v, 0)} pcs
                    </span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(order.details).filter(([, v]) => v > 0).map(([item, qty]) => (
                      <div key={item} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg opacity-80">
                        <span className="text-[14px] font-bold text-slate-600">{item}</span>
                        <span className="text-[14px] font-black text-[#0F172A]">{qty}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Service Breakdown */}
        {((isEditing ? pricingPreview?.serviceBreakdown : order.serviceBreakdown)?.length > 0 || (isB2COrder && Number(editForm.weight) > 0)) && (
          <div className="p-6 space-y-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Service Breakdown</span>
              {isEditing && (
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  Live Recalculation
                </span>
              )}
            </div>
            <div className="space-y-2">
              {(isEditing && pricingPreview?.serviceBreakdown?.length > 0
                ? pricingPreview.serviceBreakdown
                : (order.serviceBreakdown || [])
              ).map((item, idx) => (
                <div key={`${item.name}-${item.quantity}-${item.amount}-${idx}`} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-[13px] font-bold text-slate-700">{humanizeServiceLabel(item.name)}</p>
                    <p className="text-[11px] text-slate-500">
                      {item.quantity ? `${item.quantity} pcs` : "—"}
                      {item.weight !== undefined && Number(item.weight) > 0 ? ` • ${Number(item.weight).toFixed(1)} kg` : ""}
                      {item.rate ? ` (@ ₹${item.rate}/kg)` : ""}
                    </p>
                  </div>
                  {item.amount !== undefined ? (
                    <div className="text-[13px] font-black text-[#0F172A]">
                      <BiRupee size={14} className="inline-block" /> {Number(item.amount).toLocaleString()}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment Details */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Payment Information</span>
            {order.isPaid ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                ● Paid
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
                ○ Pending
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Payment Mode</span>
              <span className="font-black text-slate-800 flex items-center gap-1.5">
                {order.isCashPayment ? "💵 Cash" : order.isOnlinePayment ? "💳 Online" : "—"}
                {order.isRiderPayment && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100 uppercase">
                    Rider
                  </span>
                )}
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Method / Recorded</span>
              <span className="font-bold text-slate-800 text-[12px] truncate block" title={order.paymentMethodOnDelivery || order.paymentMethod}>
                {order.paymentMethodOnDelivery || order.paymentMethod || order.paymentMethodLabel || "Not specified"}
              </span>
            </div>
            {order.paymentRecordedAt && (
              <div className="col-span-2 text-[11px] text-slate-500 font-medium">
                ⏱️ Payment recorded on delivery:{" "}
                <span className="font-bold text-slate-700">
                  {new Date(order.paymentRecordedAt?.toDate ? order.paymentRecordedAt.toDate() : order.paymentRecordedAt).toLocaleString("en-IN")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-[#F8FAFC]">
          <div className="flex items-center justify-between pt-2">
            <span className="text-[12px] font-black text-slate-500 uppercase tracking-widest">Total Billed</span>
              <div className="flex items-center gap-1 text-[24px] font-black text-[#1976D2]">
                <BiRupee size={24} className="mb-0.5" />
                {isEditing ? (
                  <input type="number" min="0" value={editForm.amount} onChange={(e) => updatePositiveField("amount", e.target.value)} className="w-28 text-right bg-white border border-slate-300 rounded-lg px-2 py-1 text-[20px] outline-none focus:border-blue-500" />
                ) : (
                  <span>{order.amount?.toLocaleString() || '0'}</span>
                )}
              </div>
          </div>

          {isEditing && (
            <div className="mt-6 flex gap-3">
              <button onClick={() => setIsEditing(false)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 text-[14px] font-bold rounded-xl hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleUpdate} disabled={isSubmitting} className="flex-1 py-3 bg-blue-600 text-white text-[14px] font-bold rounded-xl hover:bg-blue-700 transition-colors flex justify-center items-center gap-2">
                {isSubmitting ? <FiLoader className="animate-spin" /> : <FiCheck />}
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}

          {!isEditing && (
            <div className="mt-6">
              <button 
                onClick={handleDownloadInvoice} 
                disabled={isGeneratingInvoice}
                className="w-full py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 text-[14px] font-bold rounded-xl hover:bg-indigo-100 transition-colors flex justify-center items-center gap-2"
              >
                {isGeneratingInvoice ? <FiLoader className="animate-spin" /> : <FiDownload />}
                {isGeneratingInvoice ? "Generating..." : "Download Invoice"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
