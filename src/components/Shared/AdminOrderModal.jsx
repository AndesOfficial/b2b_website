import { useState, useEffect } from "react";
import { FiX, FiEdit2, FiCheck, FiLoader, FiDownload } from "react-icons/fi";
import { BiRupee } from "react-icons/bi";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { isNegativeNumberInput } from "../../utils/numberInputUtils";
import { useHostelAuth } from "../../context/HostelAuthContext";
import { getOrAssignInvoiceNumber } from "../../utils/invoiceCounter";
import { generateSingleInvoicePDF } from "../../utils/pdfGenerator";
import { formatTimeSlot, humanizeServiceLabel } from "../../utils/formatUtils";

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

  // Load the current order data into the edit form whenever the modal opens
  useEffect(() => {
    if (order) {
      setEditForm({
        status: order.status || "Pending",
        amount: order.amount || 0,
        weight: order.weight || 0,
        studentCount: order.studentCount || 0,
        items: order.items || 0
      });
      setIsEditing(false); // Always start in "View" mode
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  // Helper to remove undefined fields which Firestore doesn't support
  const cleanObject = (obj) => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach((key) => {
      if (newObj[key] === undefined) delete newObj[key];
    });
    return newObj;
  };

  const updatePositiveField = (field, rawValue) => {
    if (isNegativeNumberInput(rawValue)) return;
    setEditForm((prev) => ({ ...prev, [field]: rawValue }));
  };

  // The function that securely updates the exact document in the correct collection
  const handleUpdate = async () => {
    setIsSubmitting(true);
    try {
      // Branch collection based on category roles
      const isB2B = 
        order.category === "STUDENT_LAUNDRY" || 
        order.category === "LINEN" || 
        order.category === "AIRBNB";
      
      const targetCollection = isB2B ? "b2b_orders" : "b2b_admin_edits";
      const docRef = doc(db, targetCollection, String(order.id));

      await setDoc(docRef, cleanObject({
        ...order,
        status: editForm.status,
        amount: Number(editForm.amount),
        weight: Number(editForm.weight),
        studentCount: Number(editForm.studentCount),
        items: Number(editForm.items),
        updatedAt: new Date().toISOString()
      }), { merge: true });

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
            <h2 className="text-[18px] font-black text-[#0F172A] tracking-tight">{order.customerName || order.property || order.tenant || 'Unknown Property'}</h2>
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
                    <input type="number" step="0.1" min="0" value={editForm.weight} onChange={(e) => updatePositiveField("weight", e.target.value)} className="w-full text-[16px] font-black text-[#0F172A] bg-white border border-slate-200 rounded px-2 py-1 outline-none" />
                  ) : (
                    <p className="text-[18px] font-black text-[#0F172A]">{order.weight?.toFixed(1) || '0.0'} <span className="text-[12px] text-slate-500">kg</span></p>
                  )}
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Students</p>
                  {isEditing ? (
                    <input type="number" min="0" value={editForm.studentCount} onChange={(e) => updatePositiveField("studentCount", e.target.value)} className="w-full text-[16px] font-black text-[#0F172A] bg-white border border-slate-200 rounded px-2 py-1 outline-none" />
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
                    <input type="number" min="0" value={editForm.items} onChange={(e) => updatePositiveField("items", e.target.value)} className="w-24 text-right text-[14px] font-black text-[#0F172A] bg-white border border-slate-200 rounded px-2 py-1 outline-none" />
                  ) : (
                    <span className="text-[14px] font-black text-[#0F172A]">{order.items || 0} pcs</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                  <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Item Breakdown</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Total Pcs:</span>
                    {isEditing ? (
                    <input type="number" min="0" value={editForm.items} onChange={(e) => updatePositiveField("items", e.target.value)} className="w-16 text-center text-[12px] font-black text-blue-600 bg-white border border-slate-200 rounded px-1 outline-none" />
                    ) : (
                      <span className="text-[12px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{order.items || Object.values(order.details || {}).reduce((s, v) => s + v, 0) || 0}</span>
                    )}
                  </div>
                </div>
                {order.details && Object.keys(order.details).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(order.details).filter(([, v]) => v > 0).map(([item, qty]) => (
                      <div key={item} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg opacity-80">
                        <span className="text-[14px] font-bold text-slate-600">{item}</span>
                        <span className="text-[14px] font-black text-[#0F172A]">{qty}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] font-medium text-slate-500 italic py-4 text-center">No detailed item breakdown available.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {order.serviceBreakdown?.length > 0 && (
          <div className="p-6 space-y-3 border-t border-slate-100">
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Service Breakdown</div>
            <div className="space-y-2">
              {order.serviceBreakdown.map((item) => (
                <div key={`${item.name}-${item.quantity}-${item.amount}`} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-[13px] font-bold text-slate-700">{humanizeServiceLabel(item.name)}</p>
                    <p className="text-[11px] text-slate-500">
                      {item.quantity ? `${item.quantity} pcs` : "—"}
                      {item.weight ? ` • ${item.weight} kg` : ""}
                    </p>
                  </div>
                  {item.amount ? (
                    <div className="text-[13px] font-black text-[#0F172A]">
                      <BiRupee size={14} className="inline-block" /> {item.amount.toLocaleString()}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

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
