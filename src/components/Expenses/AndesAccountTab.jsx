import React, { useState, useMemo, useCallback } from "react";
import { collection, addDoc, deleteDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../../firebase";
import {
  Plus, X, Trash2, FileText, Loader2, ChevronDown, ChevronUp, Wallet, TrendingUp, Edit2, Paperclip, Upload, Link as LinkIcon, ExternalLink
} from "lucide-react";
import { BiRupee } from "react-icons/bi";
import { isNegativeNumberInput } from "../../utils/numberInputUtils";
import { useHostelAuth } from "../../context/HostelAuthContext";

/* ─── constants ─── */
const CATEGORIES = [
  "Purchase things for dark store",
  "Setup cost",
  "Workers payment",
  "Out of the box",
  "Vendor payment",
  "Other",
  "Dark Store OPEX",
  "COMPANY OPEX",
  "Marketing Expense",
  "Packaging",
  "Team Member Salary",
  "Remaining Amount ",
];

const CAT_COLORS = {
  "Purchase things for dark store": "#6366F1",
  "Setup cost": "#F59E0B",
  "Workers payment": "#10B981",
  "Out of the box": "#F43F5E",
  "Vendor payment": "#3B82F6",
  Other: "#64748B",
  "Dark Store OPEX": "#8B5CF6",
  "COMPANY OPEX": "#06B6D4",
  "Marketing Expense": "#EC4899",
  Packaging: "#A855F7",
  "Team Member Salary": "#F97316",
  "Remaining Amount ": "#FACC15",
};

const emptyAndesForm = {
  amount: "",
  payee: "",
  category: "Other",
  transactionType: "debit",
  date: "",
  note: "",
  invoiceUrl: "",
  invoiceFile: null,
  removedInvoices: [],
  debitBreakdown: [],
  unspentNote: "",
};

const ANDES_INITIAL_BALANCE = 2002969.22;

/* ─── Component ─── */
export default function AndesAccountTab({ entries: propEntries = [], loading = false }) {
  const { isViewer } = useHostelAuth();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyAndesForm });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [notePrompt, setNotePrompt] = useState(null);

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const toggleRow = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ─── Closing balance computation (over ALL entries) ─── */

  const computedEntries = useMemo(() => {
    // 1. Sort all entries chronologically (oldest first)
    const sorted = [...propEntries].sort((a, b) => {
      const dateA = a.date || "";
      const dateB = b.date || "";
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      
      // If dates are identical, fallback to exact creation time so order is preserved
      const timeA = a.createdAt?.toMillis?.() || a.updatedAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || b.updatedAt?.toMillis?.() || 0;
      return timeA - timeB;
    });
    
    // 2. Compute running balance over the entire history
    let balance = ANDES_INITIAL_BALANCE;
    const withBalance = sorted.map((entry) => {
      if (entry.transactionType === "credit") {
        balance += Number(entry.amount) || 0;
      } else {
        balance -= Number(entry.amount) || 0;
      }
      return { ...entry, closingBalance: balance };
    });

    // 3. Filter by date for display
    let displayList = withBalance;
    if (dateFrom && dateTo) {
      displayList = displayList.filter((e) => {
        if (!e.date) return false;
        return e.date >= dateFrom && e.date <= dateTo;
      });
    }

    // 4. Reverse for display (newest first)
    displayList.reverse();
    return displayList;
  }, [propEntries, dateFrom, dateTo]);



  /* ─── Form helpers ─── */
  const openNew = () => {
    setEditingId(null);
    setForm({
      ...emptyAndesForm,
      date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .split("T")[0],
    });
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (entry) => {
    setEditingId(entry.id);
    setForm({
      amount: entry.amount || "",
      payee: entry.payee || "",
      category: entry.category || "Other",
      transactionType: entry.transactionType || "debit",
      date: entry.date || "",
      note: entry.note || "",
      invoiceUrl: entry.invoiceUrl || "",
      invoiceFile: null,
      removedInvoices: [],
      debitBreakdown: entry.debitBreakdown || [],
      unspentNote: entry.unspentNote || "",
    });
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const e = {};
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      e.amount = "Enter a valid amount";
    if (!form.payee.trim()) e.payee = "Beneficiary is required";
    if (!form.category) e.category = "Classification is required";
    if (!form.date) e.date = "Date is required";

    if (form.transactionType === "debit" && form.debitBreakdown?.length > 0) {
      let sum = 0;
      let hasErrors = false;
      form.debitBreakdown.forEach((item) => {
        if (!item.amount || isNaN(Number(item.amount)) || Number(item.amount) <= 0) hasErrors = true;
        if (!item.itemName?.trim()) hasErrors = true;
        if (!item.category) hasErrors = true;
        sum += Number(item.amount) || 0;
      });
      if (hasErrors) e.breakdown = "All breakdown fields (category, item, amount) are required";
      else if (sum > Number(form.amount) + 0.01)
        e.breakdown = `Breakdown total (₹${sum.toFixed(2)}) cannot exceed debit amount (₹${Number(form.amount).toFixed(2)})`;
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const safeDeleteByUrl = async (url) => {
    if (!url) return;
    try {
      const encodedPath = url.split('/o/')[1]?.split('?')[0];
      if (encodedPath) {
        const filePath = decodeURIComponent(encodedPath);
        await deleteObject(ref(storage, filePath));
      }
    } catch (e) {
      console.warn("Failed to delete file:", e);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const uploadPromises = [];

      let mainInvoiceUrl = form.invoiceUrl || "";
      if (form.invoiceFile) {
        const p = (async () => {
          const storageRef = ref(storage, `andes_invoices/${Date.now()}_${form.invoiceFile.name}`);
          await uploadBytes(storageRef, form.invoiceFile);
          mainInvoiceUrl = await getDownloadURL(storageRef);
          if (form.invoiceUrl) await safeDeleteByUrl(form.invoiceUrl);
        })();
        uploadPromises.push(p);
      }

      const finalBreakdown = [];
      if (form.transactionType === "debit") {
        for (const b of form.debitBreakdown || []) {
          const bObj = {
            category: b.category,
            itemName: (b.itemName || "").trim(),
            amount: parseFloat(b.amount) || 0,
            invoiceUrl: b.invoiceUrl || "",
          };
          if (b.invoiceFile) {
            const p = (async () => {
              const bStorageRef = ref(storage, `andes_invoices/breakdown/${Date.now()}_${b.invoiceFile.name}`);
              await uploadBytes(bStorageRef, b.invoiceFile);
              bObj.invoiceUrl = await getDownloadURL(bStorageRef);
              if (b.invoiceUrl) await safeDeleteByUrl(b.invoiceUrl);
            })();
            uploadPromises.push(p);
          }
          finalBreakdown.push(bObj);
        }
      }

      if (uploadPromises.length > 0) {
        await Promise.all(uploadPromises);
      }

      // Cleanup any explicitly removed invoices
      if (form.removedInvoices && form.removedInvoices.length > 0) {
        form.removedInvoices.forEach(url => safeDeleteByUrl(url));
      }

      const payload = {
        accountType: "andes",
        amount: parseFloat(form.amount),
        payee: form.payee.trim(),
        category: form.category,
        transactionType: form.transactionType,
        date: form.date,
        note: form.note || "",
        invoiceUrl: mainInvoiceUrl,
        unspentNote: form.unspentNote || "",
        debitBreakdown: finalBreakdown,
        updatedAt: Timestamp.now(),
      };

      if (editingId) {
        await updateDoc(doc(db, "b2b_expenses", editingId), payload);
        showToastMsg("Entry updated!");
      } else {
        payload.createdAt = Timestamp.now();
        await addDoc(collection(db, "b2b_expenses"), payload);
        showToastMsg("Entry recorded!");
      }

      setShowModal(false);
      setForm({ ...emptyAndesForm });
      setEditingId(null);
    } catch (err) {
      console.error("Submit error:", err);
      alert("Failed to save entry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [form, editingId]);

  const handleDelete = async (entry) => {
    if (!window.confirm(`Delete ₹${entry.amount?.toLocaleString()} entry for "${entry.payee}"?`)) return;
    try {
      await deleteDoc(doc(db, "b2b_expenses", entry.id));
      if (entry.invoiceUrl) safeDeleteByUrl(entry.invoiceUrl);
      if (entry.debitBreakdown) {
        entry.debitBreakdown.forEach(b => {
          if (b.invoiceUrl) safeDeleteByUrl(b.invoiceUrl);
        });
      }
      showToastMsg("Entry deleted");
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleEditUnspentNote = (entry) => {
    setNotePrompt({
      entry,
      note: entry.unspentNote || ""
    });
  };

  const handleSubmitNotePrompt = async () => {
    if (!notePrompt) return;
    try {
      await updateDoc(doc(db, "b2b_expenses", notePrompt.entry.id), { unspentNote: notePrompt.note });
      showToastMsg("Note updated");
      setNotePrompt(null);
    } catch (err) {
      console.error("Update note error:", err);
      alert("Failed to update note.");
    }
  };

  const showToastMsg = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  /* ─── Breakdown helpers ─── */
  const addBreakdownItem = () =>
    setForm((prev) => ({
      ...prev,
      debitBreakdown: [...prev.debitBreakdown, { category: "", itemName: "", amount: "" }],
    }));

  const updateBreakdownItem = (index, field, value) => {
    if (field === "amount" && isNegativeNumberInput(value)) return;
    setForm((prev) => {
      const updated = [...prev.debitBreakdown];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, debitBreakdown: updated };
    });
  };

  const removeBreakdownItem = (index) => {
    setForm((prev) => {
      const updated = [...prev.debitBreakdown];
      updated.splice(index, 1);
      return { ...prev, debitBreakdown: updated };
    });
  };

  /* ─── Render ─── */
  return (
    <div className="space-y-8" style={{ fontFamily: "DM Sans, sans-serif" }}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-[100] bg-[#0F172A] text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-left border border-slate-700/50 backdrop-blur-md">
          <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center">
            <FileText size={14} />
          </div>
          <span className="text-[13px] font-black tracking-tight">{toast}</span>
        </div>
      )}

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex bg-white/70 backdrop-blur-sm p-1.5 rounded-xl border border-gray-100 shadow-sm gap-1 overflow-x-auto scrollbar-hide">
          <div className="flex items-center px-3 border-r border-gray-100 mr-1 flex-shrink-0">
            <FileText size={16} className="text-slate-400" />
          </div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="bg-transparent border-none text-[12px] font-black text-slate-700 focus:ring-0 cursor-pointer" />
          <div className="h-4 w-px bg-gray-200 mx-1 self-center flex-shrink-0" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="bg-transparent border-none text-[12px] font-black text-slate-700 focus:ring-0 cursor-pointer" />
        </div>
        {!isViewer && (
          <button onClick={openNew}
            className="flex items-center justify-center gap-2.5 px-6 py-3.5 sm:py-3 bg-emerald-600 text-white text-[12px] sm:text-[13px] font-black rounded-xl hover:bg-emerald-700 transition-all shadow-lg active:scale-95 uppercase tracking-widest">
            <Plus size={18} /> Record Entry
          </button>
        )}
      </div>


      {/* Andes Account Ledger */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-slate-50/20">
          <div>
            <h2 className="text-[15px] font-black text-[#0F172A] tracking-tight mb-0.5">Andes Account Ledger</h2>
            <p className="text-[12px] font-medium text-slate-400 uppercase tracking-widest">{computedEntries.length} total entries</p>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead className="bg-[#F8FAFC]">
              <tr>
                <th className="text-left text-[11px] font-black text-[#64748B] px-4 py-3 uppercase tracking-[0.1em]">Date</th>
                <th className="text-left text-[11px] font-black text-[#64748B] px-4 py-3 uppercase tracking-[0.1em]">Beneficiary</th>
                <th className="text-left text-[11px] font-black text-[#64748B] px-4 py-3 uppercase tracking-[0.1em]">Note</th>
                <th className="text-center text-[11px] font-black text-[#64748B] px-4 py-3 uppercase tracking-[0.1em]">Invoice</th>
                <th className="text-right text-[11px] font-black text-[#64748B] px-4 py-3 uppercase tracking-[0.1em]">Amount</th>
                <th className="text-right text-[11px] font-black text-[#64748B] px-4 py-3 uppercase tracking-[0.1em]">Closing Balance</th>
                <th className="text-left text-[11px] font-black text-[#64748B] px-4 py-3 uppercase tracking-[0.1em]">Debit Breakdown</th>
                {!isViewer && <th className="text-right text-[11px] font-black text-[#64748B] px-4 py-3 uppercase tracking-[0.1em]">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-20 text-center text-slate-300">
                    <Loader2 size={32} className="animate-spin mx-auto mb-4" />
                    <p className="text-[13px] font-bold">Synchronizing with Cloud...</p>
                  </td>
                </tr>
              ) : computedEntries.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 text-slate-200"><Wallet size={32} /></div>
                      <p className="text-[15px] font-black text-slate-400">No entries for this period</p>
                      <p className="text-[12px] font-medium text-slate-300 mt-1 uppercase tracking-widest">Record a credit or debit to begin</p>
                    </div>
                  </td>
                </tr>
              ) : (
                computedEntries.map((e) => (
                  <React.Fragment key={e.id}>
                    <tr className="border-b border-gray-50 hover:bg-[#F8FAFC] transition-colors group">
                      {/* Date */}
                      <td className="px-4 py-3 text-[13px] font-bold text-slate-500">{e.date}</td>
                      {/* Beneficiary & Classification */}
                      <td className="px-4 py-3">
                        <p className="text-[14px] font-black text-[#0F172A] tracking-tight">{e.payee}</p>
                        {e.category && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mt-1 rounded text-[9px] font-black uppercase tracking-wider"
                            style={{ backgroundColor: (CAT_COLORS[e.category] || "#94a3b8") + "15", color: CAT_COLORS[e.category] || "#94a3b8" }}>
                            {e.category}
                          </span>
                        )}
                      </td>
                      {/* Note */}
                      <td className="px-4 py-3 text-[13px] font-bold text-slate-500 max-w-[200px] truncate" title={e.note || ""}>
                        {e.note || "—"}
                      </td>
                      {/* Invoice */}
                      <td className="px-4 py-3 text-center">
                        {e.invoiceUrl ? (
                          <a href={e.invoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md hover:bg-emerald-100 transition-colors w-fit mx-auto">
                            <ExternalLink size={10} /> Invoice
                          </a>
                        ) : (
                          <span className="text-[13px] font-bold text-slate-300">—</span>
                        )}
                      </td>
                      {/* Amount */}
                      <td className="px-4 py-3 text-right">
                        {e.transactionType === "debit" ? (
                          <span className="text-[15px] font-black text-red-600 tracking-tight">−₹{Number(e.amount).toLocaleString("en-IN")}</span>
                        ) : (
                          <span className="text-[15px] font-black text-emerald-600 tracking-tight">+₹{Number(e.amount).toLocaleString("en-IN")}</span>
                        )}
                      </td>
                      {/* Closing Balance */}
                      <td className="px-4 py-3 text-right">
                        <span className={`text-[15px] font-black tracking-tight ${e.closingBalance >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                          ₹{e.closingBalance.toLocaleString("en-IN")}
                        </span>
                      </td>
                      {/* Debit Breakdown */}
                      <td className="px-4 py-3">
                        {e.transactionType === "debit" ? (() => {
                          const splitSum = (e.debitBreakdown || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
                          const remaining = Number(e.amount) - splitSum;
                          const hasBreakdown = e.debitBreakdown?.length > 0;
                          const showRemaining = hasBreakdown && remaining > 0.01;

                          if (!hasBreakdown) return <span className="text-[11px] font-bold text-slate-300">—</span>;

                          return (
                            <div className="flex items-center gap-2">
                              <div className="flex flex-wrap gap-1 max-w-[250px]">
                                {(e.debitBreakdown || []).slice(0, 2).map((b, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                                    style={{ backgroundColor: (CAT_COLORS[b.category] || "#94a3b8") + "15", color: CAT_COLORS[b.category] || "#94a3b8" }}>
                                    ₹{Number(b.amount).toLocaleString("en-IN")} {b.itemName}
                                  </span>
                                ))}
                                {e.debitBreakdown?.length > 2 && (
                                  <span className="text-[10px] font-bold text-slate-400">+{e.debitBreakdown.length - 2} more</span>
                                )}
                                {showRemaining && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500">
                                    ₹{remaining.toLocaleString("en-IN")} Unspent
                                  </span>
                                )}
                              </div>
                              {(hasBreakdown || showRemaining) && (
                                <button onClick={() => toggleRow(e.id)} className="p-1 rounded bg-indigo-50 text-indigo-400 hover:bg-indigo-100 transition-colors">
                                  {expandedRows.has(e.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                              )}
                            </div>
                          );
                        })() : (
                          <span className="text-[11px] font-bold text-slate-300">—</span>
                        )}
                      </td>
                      {/* Actions */}
                      {!isViewer && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(e)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                              <FileText size={16} />
                            </button>
                            <button onClick={() => handleDelete(e)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {/* Expanded Breakdown */}
                    {e.transactionType === "debit" && e.debitBreakdown?.length > 0 && expandedRows.has(e.id) && (
                      <tr className="bg-slate-50/50">
                        <td colSpan="8" className="px-4 py-3">
                          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                            <table className="w-full">
                              <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                  <th className="p-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                                  <th className="p-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                                  <th className="p-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {(e.debitBreakdown || []).map((b, i) => (
                                  <tr key={i}>
                                    <td className="p-4">
                                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider"
                                        style={{ backgroundColor: (CAT_COLORS[b.category] || "#94a3b8") + "15", color: CAT_COLORS[b.category] || "#94a3b8" }}>
                                        {b.category}
                                      </span>
                                    </td>
                                    <td className="p-4 text-[13px] font-bold text-[#0F172A]">
                                      <div className="flex items-center gap-1.5">
                                        {b.itemName}
                                        {b.invoiceUrl && (
                                          <a href={b.invoiceUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-emerald-600 transition-colors" title="View attached invoice">
                                            <LinkIcon size={12} />
                                          </a>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-4 text-[13px] font-black text-slate-800 text-right">₹{Number(b.amount).toLocaleString("en-IN")}</td>
                                  </tr>
                                ))}
                                {(() => {
                                  const splitSum = (e.debitBreakdown || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
                                  const remaining = Number(e.amount) - splitSum;
                                  if (remaining > 0.01) {
                                    return (
                                      <tr>
                                        <td className="p-4">
                                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider bg-slate-100 text-slate-500">
                                            Unspent
                                          </span>
                                        </td>
                                        <td className="p-4 text-[13px] font-bold text-slate-500">
                                          <div className="flex items-center gap-2">
                                            <span>Remaining Amount</span>
                                            <button onClick={() => handleEditUnspentNote(e)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all" title="Add/Edit Note">
                                              <Edit2 size={12} />
                                            </button>
                                          </div>
                                          {e.unspentNote && <span className="block text-[11px] font-black text-emerald-500 mt-0.5">{e.unspentNote}</span>}
                                        </td>
                                        <td className="p-4 text-[13px] font-black text-slate-500 text-right">₹{remaining.toLocaleString("en-IN")}</td>
                                      </tr>
                                    );
                                  }
                                  return null;
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-50 bg-white">
          {loading ? (
            <div className="py-20 text-center text-slate-300">
              <Loader2 size={32} className="animate-spin mx-auto mb-4" />
              <p className="text-[13px] font-bold">Synchronizing...</p>
            </div>
          ) : computedEntries.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <Wallet size={32} className="text-slate-200 mb-4" />
              <p className="text-[15px] font-black text-slate-400 text-center px-6">No entries for this period</p>
            </div>
          ) : (
            computedEntries.map((e) => (
              <div key={e.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[14px] font-black text-[#0F172A] tracking-tight mb-1">{e.payee}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[11px] font-bold text-slate-400">{e.date}</p>
                      {e.category && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                          style={{ backgroundColor: (CAT_COLORS[e.category] || "#94a3b8") + "15", color: CAT_COLORS[e.category] || "#94a3b8" }}>
                          {e.category}
                        </span>
                      )}
                      {e.invoiceUrl && (
                        <a href={e.invoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                          <ExternalLink size={8} /> Inv
                        </a>
                      )}
                    </div>
                    {e.note && <p className="text-[12px] font-bold text-slate-500 mt-1">{e.note}</p>}
                  </div>
                  <div className="text-right">
                    {e.transactionType === "debit" ? (
                      <p className="text-[16px] font-black text-red-600">−₹{Number(e.amount).toLocaleString("en-IN")}</p>
                    ) : (
                      <p className="text-[16px] font-black text-emerald-600">+₹{Number(e.amount).toLocaleString("en-IN")}</p>
                    )}
                    <p className={`text-[11px] font-black mt-0.5 ${e.closingBalance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      Bal: ₹{e.closingBalance.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
                {/* Mobile breakdown */}
                {e.transactionType === "debit" && e.debitBreakdown?.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Debit Breakdown</p>
                    {(e.debitBreakdown || []).map((b, i) => (
                      <div key={i} className="flex justify-between items-center text-[11px] border-b border-slate-100/70 pb-1 last:border-0 last:pb-0">
                        <div className="flex items-center gap-1.5 flex-wrap flex-1 pr-2">
                          <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black flex-shrink-0"
                            style={{ backgroundColor: (CAT_COLORS[b.category] || "#94a3b8") + "20", color: CAT_COLORS[b.category] || "#94a3b8" }}>
                            {i + 1}
                          </span>
                          <span className="font-bold text-slate-700">{b.itemName}</span>
                          <span className="text-slate-400 text-[9px]">({b.category})</span>
                          {b.invoiceUrl && (
                            <a href={b.invoiceUrl} target="_blank" rel="noreferrer" className="text-emerald-500 hover:text-emerald-600 ml-0.5">
                              <LinkIcon size={10} />
                            </a>
                          )}
                        </div>
                        <span className="font-black text-red-600">₹{Number(b.amount).toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                    {(() => {
                      const splitSum = (e.debitBreakdown || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
                      const remaining = Number(e.amount) - splitSum;
                      if (remaining > 0.01) {
                        return (
                          <div className={`flex justify-between items-center text-[11px] ${(e.debitBreakdown && e.debitBreakdown.length > 0) ? 'border-t border-slate-100/70 pt-1' : ''}`}>
                            <div className="flex items-center gap-1.5">
                              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black bg-slate-200 text-slate-500">
                                ?
                              </span>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-500">Remaining Amount</span>
                                  <button onClick={() => handleEditUnspentNote(e)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all" title="Add/Edit Note">
                                    <Edit2 size={12} />
                                  </button>
                                </div>
                                {e.unspentNote && <span className="text-[10px] font-black text-emerald-500 mt-0.5">{e.unspentNote}</span>}
                              </div>
                            </div>
                            <span className="font-black text-slate-500">₹{remaining.toLocaleString("en-IN")}</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
                {!isViewer && (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button onClick={() => openEdit(e)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <FileText size={16} />
                    </button>
                    <button onClick={() => handleDelete(e)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── Side Panel Form ─── */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center sm:justify-end p-0 sm:p-4">
          <div className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg h-full sm:h-auto sm:max-h-[90vh] bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-slide-left">
            {/* Header */}
            <div className="p-6 sm:p-8 border-b border-slate-50 flex items-center justify-between bg-emerald-50/30 flex-shrink-0">
              <div>
                <h2 className="text-[18px] font-black text-[#0F172A] tracking-tight">
                  {editingId ? "Edit Andes Entry" : "New Andes Entry"}
                </h2>
                <p className="text-[12px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">Andes Account Management</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                <X size={28} />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
              <div className="space-y-6">
                {/* Amount */}
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Amount (INR) *</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold"><BiRupee size={22} /></div>
                    <input type="number" min="0" step="0.01" value={form.amount}
                      onChange={(e) => { if (!isNegativeNumberInput(e.target.value)) setForm((prev) => ({ ...prev, amount: e.target.value })); }}
                      className={`w-full pl-12 pr-4 py-4 rounded-xl text-[24px] font-black focus:outline-none border transition-all ${form.amount ? "bg-emerald-50/50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-700"}`}
                      placeholder="0.00" />
                  </div>
                  {errors.amount && <p className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-wider">{errors.amount}</p>}
                </div>

                {/* Beneficiary & Classification */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Beneficiary *</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"><FileText size={18} /></div>
                      <input type="text" value={form.payee} onChange={(e) => setForm({ ...form, payee: e.target.value })}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-700 focus:bg-white focus:border-emerald-500 focus:outline-none transition-all uppercase placeholder:normal-case"
                        placeholder="e.g. Sai Enterprises, Alliance" />
                    </div>
                    {errors.payee && <p className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-wider">{errors.payee}</p>}
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Classification *</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-emerald-500 focus:outline-none appearance-none"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    {errors.category && <p className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-wider">{errors.category}</p>}
                  </div>
                </div>

                {/* Date + Transaction Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Date *</label>
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none" />
                    {errors.date && <p className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-wider">{errors.date}</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Transaction Type *</label>
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => setForm({ ...form, transactionType: "debit" })}
                        className={`flex-1 py-3.5 rounded-xl text-[13px] font-black uppercase tracking-wider transition-all border ${form.transactionType === "debit"
                          ? "bg-red-50 border-red-200 text-red-700 shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100"
                        }`}>
                        Debit
                      </button>
                      <button type="button"
                        onClick={() => setForm({ ...form, transactionType: "credit" })}
                        className={`flex-1 py-3.5 rounded-xl text-[13px] font-black uppercase tracking-wider transition-all border ${form.transactionType === "credit"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100"
                        }`}>
                        Credit
                      </button>
                    </div>
                  </div>
                </div>

                {/* Transaction Note & Invoice */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Note (Optional)</label>
                    <textarea
                      value={form.note || ""}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                      placeholder="Add a note about this transaction..."
                      rows={2}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-emerald-500 focus:outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Attach Invoice (Optional)</label>
                    {form.invoiceFile || form.invoiceUrl ? (
                      <div className="flex items-center justify-between w-full h-[76px] px-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                            <FileText size={20} />
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-[13px] font-black text-emerald-800 truncate">
                              {form.invoiceFile ? form.invoiceFile.name : "Existing Invoice Attached"}
                            </span>
                            <span className="text-[11px] font-bold text-emerald-600">Ready to save</span>
                          </div>
                        </div>
                        <button type="button" onClick={() => {
                          setForm(prev => {
                            const rem = [...(prev.removedInvoices || [])];
                            if (prev.invoiceUrl) rem.push(prev.invoiceUrl);
                            return { ...prev, invoiceFile: null, invoiceUrl: "", removedInvoices: rem };
                          });
                        }} className="p-2 text-emerald-600 hover:bg-emerald-200 rounded-lg transition-colors flex-shrink-0" title="Remove Invoice">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-[76px] px-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl hover:bg-slate-100 hover:border-emerald-400 transition-all cursor-pointer group relative overflow-hidden">
                        <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) setForm({ ...form, invoiceFile: file });
                        }} />
                        <div className="flex items-center gap-2 text-slate-500 group-hover:text-emerald-600 text-center">
                          <Upload size={18} className="flex-shrink-0" />
                          <span className="text-[12px] font-bold truncate max-w-[150px] sm:max-w-[200px]">
                            Upload Image or PDF
                          </span>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                {/* Debit Breakdown (only shown for debit) */}
                {form.transactionType === "debit" && (
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <TrendingUp size={14} className="text-red-400" /> Debit Breakdown (Optional)
                        </label>
                        {form.amount && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Total debit: <span className="font-black text-red-600">₹{Number(form.amount).toLocaleString("en-IN")}</span>
                          </p>
                        )}
                      </div>
                      <button onClick={(e) => { e.preventDefault(); addBreakdownItem(); }}
                        className="flex items-center gap-1 text-[10px] font-black text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg uppercase tracking-widest hover:bg-red-100 transition-colors">
                        <Plus size={12} /> Add Item
                      </button>
                    </div>

                    {form.debitBreakdown?.length > 0 && (
                      <div className="space-y-2 mb-2">
                        {/* Running total */}
                        {(() => {
                          const splitSum = form.debitBreakdown.reduce((s, i) => s + (Number(i.amount) || 0), 0);
                          const total = Number(form.amount) || 0;
                          const remaining = total - splitSum;
                          const isExact = Math.abs(remaining) < 0.01;
                          return (
                            <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-black ${isExact
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : remaining < 0
                              ? "bg-red-50 text-red-600 border border-red-200"
                              : "bg-blue-50 text-blue-600 border border-blue-200"
                            }`}>
                              <span>
                                {isExact
                                  ? "✓ Fully allocated"
                                  : remaining > 0
                                  ? `₹${remaining.toFixed(2)} remaining`
                                  : `₹${Math.abs(remaining).toFixed(2)} over budget`}
                              </span>
                              <span>₹{splitSum.toFixed(2)} / ₹{total.toFixed(2)}</span>
                            </div>
                          );
                        })()}

                        {(() => {
                          const splitSum = form.debitBreakdown.reduce((s, i) => s + (Number(i.amount) || 0), 0);
                          const total = Number(form.amount) || 0;
                          const remaining = total - splitSum;
                          if (remaining > 0.01) {
                            return (
                              <div className="mt-2 mb-2">
                                <input
                                  type="text"
                                  value={form.unspentNote || ""}
                                  onChange={(e) => setForm({ ...form, unspentNote: e.target.value })}
                                  placeholder="Note for remaining amount (optional)"
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-700 focus:border-red-400 focus:bg-white focus:outline-none transition-all"
                                />
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {form.debitBreakdown.map((item, index) => (
                          <div key={index} className="bg-white border border-slate-200 p-3 rounded-xl space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0">{index + 1}</span>
                              <select
                                value={item.category}
                                onChange={(e) => updateBreakdownItem(index, "category", e.target.value)}
                                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-700 focus:border-red-400 focus:outline-none appearance-none">
                                <option value="">Select Category</option>
                                {CATEGORIES.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                              <button onClick={(e) => { e.preventDefault(); removeBreakdownItem(index); }}
                                className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className="flex items-center gap-2 pl-7">
                              <input type="text" value={item.itemName}
                                onChange={(e) => updateBreakdownItem(index, "itemName", e.target.value)}
                                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-700 focus:border-red-400 focus:outline-none focus:bg-white transition-all"
                                placeholder="Item name (e.g. Aplus Detergent)" />
                                
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {item.invoiceFile || item.invoiceUrl ? (
                                  <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 max-w-[140px]">
                                    <Paperclip size={12} className="flex-shrink-0" />
                                    <span className="text-[10px] font-bold truncate">
                                      {item.invoiceFile ? item.invoiceFile.name : "Attached"}
                                    </span>
                                    <button onClick={(e) => {
                                      e.preventDefault();
                                      setForm(prev => {
                                        const newBd = [...prev.debitBreakdown];
                                        const newRem = [...(prev.removedInvoices || [])];
                                        if (newBd[index].invoiceUrl) newRem.push(newBd[index].invoiceUrl);
                                        newBd[index] = { ...newBd[index], invoiceFile: null, invoiceUrl: "" };
                                        return { ...prev, debitBreakdown: newBd, removedInvoices: newRem };
                                      });
                                    }} className="p-0.5 hover:bg-emerald-200 rounded-full transition-colors flex-shrink-0 text-emerald-600">
                                      <X size={10} />
                                    </button>
                                  </div>
                                ) : (
                                  <label className="p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors" title="Attach Invoice">
                                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => {
                                      const file = e.target.files[0];
                                      if (file) updateBreakdownItem(index, "invoiceFile", file);
                                    }} />
                                    <Paperclip size={14} className="text-slate-400" />
                                  </label>
                                )}
                              </div>

                              <div className="relative flex-shrink-0 w-28">
                                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold"><BiRupee size={13} /></div>
                                <input type="number" min="0" step="0.01" value={item.amount}
                                  onChange={(e) => updateBreakdownItem(index, "amount", e.target.value)}
                                  className="w-full pl-5 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-700 focus:border-red-400 focus:outline-none focus:bg-white transition-all"
                                  placeholder="0" />
                              </div>
                            </div>
                          </div>
                        ))}
                        {errors.breakdown && <p className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-wider">{errors.breakdown}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 sm:p-8 border-t border-slate-50 bg-slate-50/20 flex flex-col sm:flex-row gap-3 sm:gap-4 flex-shrink-0">
              <button onClick={() => setShowModal(false)}
                className="order-2 sm:order-1 flex-1 py-4 bg-slate-100 text-slate-500 font-black text-[13px] rounded-xl hover:bg-slate-200 transition-all uppercase tracking-widest">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="order-1 sm:order-2 flex-[2] py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-[13px] rounded-xl transition-all shadow-xl active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : editingId ? "Update Entry" : "Commit Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── Note Prompt Modal ─── */}
      {notePrompt && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-sm" onClick={() => setNotePrompt(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 animate-slide-up">
            <h3 className="text-[16px] font-black text-[#0F172A] mb-4">Note for Remaining Amount</h3>
            <input
              autoFocus
              type="text"
              value={notePrompt.note}
              onChange={(e) => setNotePrompt({ ...notePrompt, note: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitNotePrompt(); }}
              placeholder="E.g. Kept as cash in store"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-emerald-500 focus:outline-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setNotePrompt(null)} className="flex-1 py-3 text-[13px] font-black text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors uppercase">Cancel</button>
              <button onClick={handleSubmitNotePrompt} className="flex-1 py-3 text-[13px] font-black text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors uppercase">Save Note</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
