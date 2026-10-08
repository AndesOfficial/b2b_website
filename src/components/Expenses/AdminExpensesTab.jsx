import React, { useState, useEffect, useMemo, useCallback } from "react";
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  TrendingUp, CalendarDays, Plus, X, Upload, Trash2, Eye,
  FileText, Loader2, ImageIcon, PieChart as PieChartIcon, Download,
  ChevronDown, ChevronRight, Split, ChevronUp, ArrowDownLeft, ArrowUpRight
} from "lucide-react";
import { BiRupee } from "react-icons/bi";
import { isNegativeNumberInput } from "../../utils/numberInputUtils";
import { FaRupeeSign } from "react-icons/fa";
import { normalizeDate } from "../../utils/orderNormalization";
import { useHostelOrders } from "../../context/HostelAuthContext";

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
};



const emptyForm = {
  amount: "", payee: "", payer: "", description: "", category: "", date: "", file: null, breakdown: [], type: "Paid"
};

/* ─── Component ─── */
export default function AdminExpensesTab() {
  const { orders, isViewer } = useHostelOrders();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [activePreset, setActivePreset] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  /* ─── Date helpers ─── */
  const getDateStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const applyPreset = (key) => {
    const now = new Date();
    const today = getDateStr(now);
    if (key === "today") {
      setDateFrom(today); setDateTo(today);
    } else if (key === "yesterday") {
      const y = new Date(now); y.setDate(now.getDate() - 1);
      const yStr = getDateStr(y);
      setDateFrom(yStr); setDateTo(yStr);
    } else if (key === "thisWeek") {
      const day = now.getDay(); // 0=Sun
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      setDateFrom(getDateStr(mon)); setDateTo(today);
    } else if (key === "lastWeek") {
      const day = now.getDay();
      const thisMonday = new Date(now); thisMonday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      const lastMon = new Date(thisMonday); lastMon.setDate(thisMonday.getDate() - 7);
      const lastSun = new Date(thisMonday); lastSun.setDate(thisMonday.getDate() - 1);
      setDateFrom(getDateStr(lastMon)); setDateTo(getDateStr(lastSun));
    } else if (key === "thisMonth") {
      setDateFrom(getDateStr(new Date(now.getFullYear(), now.getMonth(), 1))); setDateTo(today);
    } else if (key === "all") {
      setDateFrom(""); setDateTo("");
    }
    setActivePreset(key);
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAmountChange = (value) => {
    if (isNegativeNumberInput(value)) return;
    setForm((prev) => ({ ...prev, amount: value }));
  };

  /* ─── Firestore listener (loads ALL b2b_expenses, splits in memory) ─── */
  useEffect(() => {
    let unsubExpenses = () => { };
    
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubExpenses();
      if (user) {
        unsubExpenses = onSnapshot(
          collection(db, "b2b_expenses"),
          (snap) => {
            const data = snap.docs.map((d) => {
              const raw = d.data();
              let dateStr = "";
              if (raw.date) {
                dateStr = typeof raw.date === "string"
                  ? raw.date
                  : raw.date.toDate
                    ? new Date(raw.date.toDate().getTime() - raw.date.toDate().getTimezoneOffset() * 60000).toISOString().split("T")[0]
                    : "";
              }
              return { id: d.id, ...raw, date: dateStr };
            });
            data.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
            setExpenses(data);
            setLoading(false);
          },
          (err) => {
            console.error("Expenses listener error", err);
            setLoading(false);
          }
        );
      } else {
        setExpenses([]);
        setLoading(false);
      }
    });

    return () => {
      unsubExpenses();
      unsubAuth();
    };
  }, []);

  /* ─── Split expenses by account type ─── */
  const personalExpenses = useMemo(() => expenses.filter(e => e.accountType !== "andes"), [expenses]);
  const andesExpenses = useMemo(() => expenses.filter(e => e.accountType === "andes"), [expenses]);

  /* ─── Filtering (Personal expense data for analytics) ─── */
  const filtered = useMemo(() => {
    let list = personalExpenses;
    if (dateFrom && dateTo) {
      list = list.filter((e) => {
        if (!e.date) return false;
        return e.date >= dateFrom && e.date <= dateTo;
      });
    } else if (dateFrom) {
      list = list.filter((e) => e.date && e.date >= dateFrom);
    } else if (dateTo) {
      list = list.filter((e) => e.date && e.date <= dateTo);
    }
    if (catFilter !== "All") {
      list = list.filter((e) => e.category === catFilter);
    }
    return list;
  }, [personalExpenses, dateFrom, dateTo, catFilter]);

  /* ─── KPIs ─── */
  const kpis = useMemo(() => {
    let totalPaid = 0;
    let totalPayable = 0;

    filtered.forEach((e) => {
      const amt = e.amount || 0;
      const t = e.transactionType || e.type || "debit";
      if (t === "debit" || t === "Paid") totalPaid += amt;
      else if (t === "credit" || t === "Payable") totalPayable += amt;
    });

    let totalReceived = 0;
    let receivables = 0;
    orders.forEach((o) => {
      if (o.status === "CANCELLED" || o.status === "Cancelled" || o.category === "ISSUES") return;
      const oDate = normalizeDate(o.date || o.createdAt);
      if (dateFrom && oDate < dateFrom) return;
      if (dateTo && oDate > dateTo) return;
      
      const amt = Number(o.amount) || 0;
      totalReceived += amt;
      if (o.type !== "regular") {
        receivables += amt;
      }
    });

    const now = new Date();
    const thisMonth = expenses.filter((e) => {
      if (!e.date) return false;
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const monthTotal = thisMonth.reduce((s, e) => s + (e.amount || 0), 0);
    const catMap = {};
    filtered.forEach((e) => {
      if (e.transactionType === "credit") return;
      catMap[e.category] = (catMap[e.category] || 0) + (e.amount || 0);
    });
    let topCat = "—";
    let topVal = 0;
    Object.entries(catMap).forEach(([c, v]) => { if (v > topVal) { topCat = c; topVal = v; } });

    let andesBalance = 2002969.22;
    andesExpenses.forEach((e) => {
      if (e.transactionType === "credit") {
        andesBalance += Number(e.amount) || 0;
      } else {
        andesBalance -= Number(e.amount) || 0;
      }
    });

    return { total: totalPaid, totalPaid, totalPayable, totalReceived, receivables, monthTotal, topCat, count: filtered.length, andesBalance };
  }, [filtered, expenses, orders, dateFrom, dateTo, andesExpenses]);

  /* ─── Category Breakdown Data ─── */

  const pieData = useMemo(() => {
    const map = {};
    let total = 0;
    filtered.forEach((e) => {
      if (e.transactionType === "credit") return;
      const amt = e.amount || 0;
      map[e.category] = (map[e.category] || 0) + amt;
      total += amt;
    });
    
    let sorted = Object.entries(map)
      .map(([name, value]) => ({ name, value, percentage: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);

    // Limit to Top 5 + "All Others" to handle drastic category increases
    const MAX_VISIBLE = 6;
    if (sorted.length > MAX_VISIBLE) {
      const topItems = sorted.slice(0, MAX_VISIBLE - 1);
      const remainingItems = sorted.slice(MAX_VISIBLE - 1);
      
      const otherValue = remainingItems.reduce((sum, item) => sum + item.value, 0);
      const otherPercentage = remainingItems.reduce((sum, item) => sum + item.percentage, 0);
      
      topItems.push({
        name: "All Others",
        value: otherValue,
        percentage: otherPercentage
      });
      
      sorted = topItems;
    }
    
    return sorted;
  }, [filtered]);

  /* ─── Form helpers ─── */
  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0] });
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (exp) => {
    setEditingId(exp.id);
    setForm({
      amount: exp.amount || "",
      payee: exp.payee || "",
      payer: exp.payer || "",
      description: exp.description || "",
      category: exp.category || "",
      date: exp.date || "",
      breakdown: exp.breakdown || [],
      type: exp.type || "Paid",
      file: null,
    });
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const e = {};
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) e.amount = "Enter a valid amount";
    if (!form.payee.trim()) e.payee = "Payee is required";
    if (!form.payer.trim()) e.payer = "Payer is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.category) e.category = "Select a category";
    if (!form.date) e.date = "Date is required";

    if (form.breakdown && form.breakdown.length > 0) {
      let sum = 0;
      let breakdownErrors = false;
      form.breakdown.forEach((item) => {
        if (!item.amount || isNaN(Number(item.amount)) || Number(item.amount) <= 0) breakdownErrors = true;
        if (!item.to?.trim()) breakdownErrors = true;
        sum += Number(item.amount) || 0;
      });
      if (breakdownErrors) e.breakdown = "All recipient fields are required and amount must be > 0";
      else if (Math.abs(sum - Number(form.amount)) > 0.01) e.breakdown = `Split total (₹${sum.toFixed(2)}) must equal total paid (₹${Number(form.amount).toFixed(2)})`;
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      let receiptUrl = "";
      if (form.file) {
        const fileRef = ref(storage, `expense_receipts/${Date.now()}_${form.file.name}`);
        await uploadBytes(fileRef, form.file);
        receiptUrl = await getDownloadURL(fileRef);
      }

      const payload = {
        amount: parseFloat(form.amount),
        payee: form.payee.trim(),
        payer: form.payer.trim(),
        description: form.description.trim(),
        category: form.category,
        date: form.date,
        type: form.type,
        breakdown: form.breakdown || [],
        ...(receiptUrl ? { receiptUrl } : {}),
        updatedAt: Timestamp.now(),
      };

      if (editingId) {
        await updateDoc(doc(db, "b2b_expenses", editingId), payload);
        showToast("Expense updated!");
      } else {
        payload.createdAt = Timestamp.now();
        await addDoc(collection(db, "b2b_expenses"), payload);
        showToast("Expense recorded!");
      }

      setShowModal(false);
      setForm({ ...emptyForm });
      setEditingId(null);
    } catch (err) {
      console.error("Submit error:", err);
      alert("Failed to save expense. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [form, editingId]);

  const handleDelete = async (exp) => {
    if (!window.confirm(`Delete payment of ₹${exp.amount?.toLocaleString()} to "${exp.payee}" paid by "${exp.payer || '—'}"?`)) return;
    try {
      await deleteDoc(doc(db, "b2b_expenses", exp.id));
      showToast("Expense deleted");
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const addBreakdownItem = () => setForm(prev => ({ ...prev, breakdown: [...prev.breakdown, { amount: "", to: "", purpose: "" }] }));

  const updateBreakdownItem = (index, field, value) => {
    if (field === "amount" && isNegativeNumberInput(value)) return;
    setForm(prev => {
      const newBreakdown = [...prev.breakdown];
      newBreakdown[index] = { ...newBreakdown[index], [field]: value };
      return { ...prev, breakdown: newBreakdown };
    });
  };

  const removeBreakdownItem = (index) => {
    setForm(prev => {
      const newBreakdown = [...prev.breakdown];
      newBreakdown.splice(index, 1);
      return { ...prev, breakdown: newBreakdown };
    });
  };

  /* ─── Render ─── */
  return (
    <div className="space-y-8 pb-12" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-[100] bg-[#0F172A] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-left border border-slate-700/50 backdrop-blur-md">
          <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center">
            <FileText size={14} />
          </div>
          <span className="text-[13px] font-black tracking-tight">{toast}</span>
        </div>
      )}

      {/* Quick Date Presets */}
      <div className="flex items-center flex-wrap gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1">Quick Filter:</span>
        {[
          { key: "today",     label: "Today" },
          { key: "yesterday", label: "Yesterday" },
          { key: "thisWeek",  label: "This Week" },
          { key: "lastWeek",  label: "Last Week" },
          { key: "thisMonth", label: "This Month" },
          { key: "all",       label: "All Time" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => applyPreset(key)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all duration-150 border ${
              activePreset === key
                ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200"
                : "bg-white text-slate-500 border-slate-200 hover:border-blue-400 hover:text-blue-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex bg-white/70 backdrop-blur-sm p-1.5 rounded-xl border border-gray-100 shadow-sm gap-1 overflow-x-auto scrollbar-hide">
              <div className="flex items-center px-3 border-r border-gray-100 mr-1 flex-shrink-0">
                <CalendarDays size={16} className="text-slate-400" />
              </div>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setActivePreset(null); }} className="bg-transparent border-none text-[12px] font-black text-slate-700 focus:ring-0 cursor-pointer" />
              <div className="h-4 w-px bg-gray-200 mx-1 self-center flex-shrink-0" />
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setActivePreset(null); }} className="bg-transparent border-none text-[12px] font-black text-slate-700 focus:ring-0 cursor-pointer" />
              <div className="h-4 w-px bg-gray-200 mx-1 self-center flex-shrink-0" />
              <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
                className="bg-transparent border-none text-[12px] font-black text-slate-700 focus:ring-0 cursor-pointer pr-8 whitespace-nowrap">
                <option value="All">All Categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button 
                onClick={() => {
                  const headers = ["Date", "Beneficiary (Payee)", "Paid By (Payer)", "Description", "Category", "Amount"];
                  const rows = filtered.map(e => [e.date, e.payee, e.payer || "", e.description, e.category, e.amount]);
                  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(",")).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const localDateObj = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
                  const a = document.createElement("a"); a.href = url; a.download = `corporate_expenses_${localDateObj.toISOString().split("T")[0]}.csv`; a.click();
                  URL.revokeObjectURL(url);
                }} 
                disabled={filtered.length === 0}
                className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-[#E3F2FD] text-[12px] font-black text-[#1976D2] border border-brand-200 rounded-xl hover:bg-[#1976D2] hover:text-white transition shadow-sm active:scale-95 uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#E3F2FD] disabled:hover:text-[#1976D2]"
              >
                <Download size={14} /> Export 
            </button>
        </div>
        {!isViewer && (
          <button onClick={openNew}
            className="flex items-center justify-center gap-2.5 px-6 py-3.5 sm:py-3 bg-blue-600 text-white text-[12px] sm:text-[13px] font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg active:scale-95 uppercase tracking-widest">
            <Plus size={18} /> Record Expense
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard 
          icon={<ArrowDownLeft size={20} />} 
          label="Revenue" 
          value={`₹${kpis.totalReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          sub={
            <div className="flex flex-col gap-0.5 mt-1.5 text-[10px]">
              <div className="flex justify-between gap-6">
                <span className="text-slate-400">B2C (Regular):</span>
                <span className="font-extrabold text-slate-600">₹{(kpis.totalReceived - kpis.receivables).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between gap-6 border-t border-slate-100 pt-0.5 mt-0.5">
                <span className="text-slate-400">B2B (Linen/Hostel):</span>
                <span className="font-extrabold text-slate-600">₹{kpis.receivables.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          } 
          color="blue" 
        />
        <KpiCard icon={<FaRupeeSign size={20} />} label="Total Paid" value={`₹${kpis.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub={`${kpis.count} entries`} color="indigo" />
        <KpiCard icon={<ArrowUpRight size={20} />} label="Receivables" value={`₹${kpis.receivables.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub="Non-Regular Sources" color="rose" />
        <KpiCard icon={<FaRupeeSign size={20} />} label="Account Balance" value={`₹${kpis.andesBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub="Net Account Balance" color="emerald" />
      </div>

      {/* Sector Allocation */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 min-w-0 flex flex-col">
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <h3 className="text-[15px] font-black text-[#0F172A] tracking-tight flex items-center gap-2">
            <PieChartIcon size={18} className="text-amber-500" /> Sector Allocation
          </h3>
        </div>
        {pieData.length === 0 ? (
          <div className="py-10 flex items-center justify-center text-slate-300 font-bold">Waiting for input...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {pieData.map((item) => (
              <div key={item.name} className="flex flex-col gap-1.5 group bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                <div className="flex justify-between items-end">
                  <span className="text-[13px] font-bold text-slate-700 truncate pr-4 group-hover:text-slate-900 transition-colors" title={item.name}>
                    {item.name}
                  </span>
                  <span className="text-[13px] font-black text-[#0F172A] shrink-0">
                    ₹{item.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-200/80 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: CAT_COLORS[item.name] || "#94a3b8"
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 w-8 text-right shrink-0">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction Log Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-[16px] font-black text-[#0F172A] tracking-tight">Expense Transactions</h3>
            <p className="text-[12px] font-medium text-slate-400">
              Showing {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#F8FAFC] border-b border-gray-100">
              <tr>
                <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Payee / Payer</th>
                <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Category</th>
                <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Description</th>
                <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Type</th>
                <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Amount</th>
                <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Receipt</th>
                {!isViewer && <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={!isViewer ? 8 : 7} className="text-center py-12 text-slate-400">
                    <FileText size={28} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-[14px] font-bold text-slate-600">No expense transactions found</p>
                    <p className="text-[12px] text-slate-400 mt-0.5">Click "Record Expense" to add a transaction.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((e) => {
                  const hasBreakdown = e.breakdown && e.breakdown.length > 0;
                  const isExpanded = expandedRows.has(e.id);
                  return (
                    <React.Fragment key={e.id}>
                      <tr className="hover:bg-slate-50/70 transition-colors group">
                        <td className="px-5 py-4 text-[13px] font-bold text-slate-600 whitespace-nowrap">
                          {e.date || "—"}
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-[13.5px] font-black text-[#0F172A]">{e.payee || "—"}</p>
                          {e.payer && (
                            <p className="text-[11px] font-bold text-slate-400">Paid by: {e.payer}</p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider inline-block"
                            style={{
                              backgroundColor: (CAT_COLORS[e.category] || "#64748B") + "18",
                              color: CAT_COLORS[e.category] || "#64748B",
                            }}
                          >
                            {e.category || "Other"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[13px] font-medium text-slate-600 max-w-xs truncate" title={e.description}>
                          {e.description || "—"}
                          {hasBreakdown && (
                            <button
                              onClick={() => toggleRow(e.id)}
                              className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800"
                            >
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              {e.breakdown.length} splits
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              e.type === "Payable"
                                ? "bg-amber-50 text-amber-600 border border-amber-200"
                                : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            }`}
                          >
                            {e.type || "Paid"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-[14px] font-black text-slate-900">
                            ₹{Number(e.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          {e.receiptUrl ? (
                            <button
                              onClick={() => setLightboxUrl(e.receiptUrl)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center"
                              title="View Receipt"
                            >
                              <Eye size={16} />
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        {!isViewer && (
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEdit(e)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit Expense"
                              >
                                <FileText size={15} />
                              </button>
                              <button
                                onClick={() => handleDelete(e)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Expense"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>

                      {/* Expandable Breakdown Row */}
                      {hasBreakdown && isExpanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={!isViewer ? 8 : 7} className="px-6 py-3">
                            <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Expense Breakdown</p>
                              <div className="divide-y divide-slate-100">
                                {e.breakdown.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between py-1.5 text-[12px]">
                                    <span className="font-bold text-slate-700">{item.to || "Recipient"}</span>
                                    {item.purpose && <span className="text-slate-400">{item.purpose}</span>}
                                    <span className="font-black text-slate-800">₹{Number(item.amount || 0).toLocaleString("en-IN")}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-0 sm:p-4" onClick={() => setLightboxUrl(null)}>
          <div className="relative max-w-2xl w-full h-full sm:h-auto bg-white sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 z-10 p-2.5 bg-white/80 rounded-xl hover:bg-white transition-all shadow-lg text-slate-800"><X size={24} /></button>
            <img src={lightboxUrl} alt="Receipt" className="w-full h-full sm:h-auto max-h-[90vh] object-contain" />
          </div>
        </div>
      )}

      {/* Side Panel Redesign */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center sm:justify-end p-0 sm:p-4">
          <div className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg h-full sm:h-auto sm:max-h-[90vh] bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-slide-left">
            <div className="p-6 sm:p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30 flex-shrink-0">
              <div>
                <h2 className="text-[18px] font-black text-[#0F172A] tracking-tight">{editingId ? 'Modify Ledger Entry' : 'New Capital Outflow'}</h2>
                <p className="text-[12px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">Personal Account Management</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                <X size={28} />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
              <div className="space-y-6">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Final Expenditure (INR) *</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      <BiRupee size={22} />
                    </div>
                    <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => handleAmountChange(e.target.value)}
                      className={`w-full pl-12 pr-4 py-4 rounded-xl text-[24px] font-black focus:outline-none border transition-all ${form.amount ? 'bg-blue-50/50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`} placeholder="0.00" />
                  </div>
                  {errors.amount && <p className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-wider">{errors.amount}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Paid To (Payee) *</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"><FileText size={18} /></div>
                    <input type="text" value={form.payee} onChange={(e) => setForm({ ...form, payee: e.target.value })}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:outline-none transition-all uppercase placeholder:normal-case" placeholder="e.g. Sai Enterprises, Rohit Chavan, Alliance" />
                  </div>
                  {errors.payee && <p className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-wider">{errors.payee}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Paid By (Payer) *</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"><FileText size={18} /></div>
                    <input type="text" value={form.payer} onChange={(e) => setForm({ ...form, payer: e.target.value })}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:outline-none transition-all uppercase placeholder:normal-case" placeholder="e.g. Rahul, Petty Cash, Owner" />
                  </div>
                  {errors.payer && <p className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-wider">{errors.payer}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Transaction Type *</label>
                  <select value={form.type || "Paid"} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-black text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none appearance-none">
                    <option value="Paid">Paid (Outflow)</option>
                    <option value="Payable">Payable (Pending Due)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Effective Date</label>
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none" />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Expense Category</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-black text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none appearance-none">
                      <option value="">Select Class</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Purpose / Justification</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:outline-none resize-none transition-all" placeholder="Explain the business need for this payment..." />
                  {errors.description && <p className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-wider">{errors.description}</p>}
                </div>

                {/* Breakdown Section */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Split size={14} className="text-indigo-400" /> Payment Breakdown (Optional)
                      </label>
                      {form.payer && form.amount && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          <span className="font-black text-indigo-600">{form.payer}</span> pays <span className="font-black text-slate-700">₹{Number(form.amount).toLocaleString()}</span> → split below
                        </p>
                      )}
                    </div>
                    <button onClick={(e) => { e.preventDefault(); addBreakdownItem(); }} className="flex items-center gap-1 text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg uppercase tracking-widest hover:bg-indigo-100 transition-colors">
                      <Plus size={12} /> Add Recipient
                    </button>
                  </div>

                  {form.breakdown && form.breakdown.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {/* Running total indicator */}
                      {(() => {
                        const splitSum = form.breakdown.reduce((s, i) => s + (Number(i.amount) || 0), 0);
                        const total = Number(form.amount) || 0;
                        const remaining = total - splitSum;
                        const isExact = Math.abs(remaining) < 0.01;
                        return (
                          <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-black ${isExact ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            remaining < 0 ? 'bg-red-50 text-red-600 border border-red-200' :
                              'bg-blue-50 text-blue-600 border border-blue-200'
                            }`}>
                            <span>{isExact ? '✓ Fully allocated' : remaining > 0 ? `₹${remaining.toFixed(2)} remaining` : `₹${Math.abs(remaining).toFixed(2)} over budget`}</span>
                            <span>₹{splitSum.toFixed(2)} / ₹{total.toFixed(2)}</span>
                          </div>
                        );
                      })()}

                      {form.breakdown.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 bg-white border border-slate-200 p-2.5 rounded-xl">
                          <div className="flex items-center gap-1.5 text-slate-400 flex-shrink-0 text-[11px] font-black uppercase tracking-wider">
                            <span className="w-5 h-5 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center text-[9px] font-black">{index + 1}</span>
                            To
                          </div>
                          <input
                            type="text"
                            value={item.to}
                            onChange={(e) => updateBreakdownItem(index, 'to', e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-bold text-slate-700 focus:border-indigo-400 focus:outline-none focus:bg-white transition-all"
                            placeholder="Recipient name (B, C…)"
                          />
                          <div className="relative flex-shrink-0 w-28">
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold"><BiRupee size={13} /></div>
                            <input
                              type="number" min="0" step="0.01"
                              value={item.amount}
                              onChange={(e) => updateBreakdownItem(index, 'amount', e.target.value)}
                              className="w-full pl-5 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-bold text-slate-700 focus:border-indigo-400 focus:outline-none focus:bg-white transition-all"
                              placeholder="0"
                            />
                          </div>
                          <input
                            type="text"
                            value={item.purpose}
                            onChange={(e) => updateBreakdownItem(index, 'purpose', e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-medium text-slate-500 focus:border-indigo-400 focus:outline-none focus:bg-white transition-all hidden sm:block"
                            placeholder="For… (optional)"
                          />
                          <button
                            onClick={(e) => { e.preventDefault(); removeBreakdownItem(index); }}
                            className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      {errors.breakdown && <p className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-wider">{errors.breakdown}</p>}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-50">
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Evidential Documentation</label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition-all group">
                    {form.file ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><ImageIcon size={24} /></div>
                        <span className="text-[13px] font-black text-slate-700">{form.file.name}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Click to swap file</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-slate-400 group-hover:text-blue-500">
                        <Upload size={28} className="mb-2" />
                        <span className="text-[12px] font-black uppercase tracking-widest">Link digital receipt</span>
                        <span className="text-[10px] font-medium text-slate-300 mt-0.5">JPG, PNG or PDF formats supported</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} />
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 border-t border-slate-50 bg-slate-50/20 flex flex-col sm:flex-row gap-3 sm:gap-4 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="order-2 sm:order-1 flex-1 py-4 bg-slate-100 text-slate-500 font-black text-[13px] rounded-xl hover:bg-slate-200 transition-all uppercase tracking-widest">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="order-1 sm:order-2 flex-[2] py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-[13px] rounded-xl transition-all shadow-xl active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : editingId ? 'Update Record' : 'Commit to Ledger'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── KPI Card sub-component ─── */
function KpiCard({ icon, label, value, sub, color }) {
  const colorMap = {
    indigo: { bg: "bg-indigo-50", ring: "ring-indigo-100", icon: "text-indigo-500" },
    blue: { bg: "bg-blue-50", ring: "ring-blue-100", icon: "text-blue-500" },
    rose: { bg: "bg-rose-50", ring: "ring-rose-100", icon: "text-rose-500" },
    amber: { bg: "bg-amber-50", ring: "ring-amber-100", icon: "text-amber-500" },
    emerald: { bg: "bg-emerald-50", ring: "ring-emerald-100", icon: "text-emerald-500" },
  };
  const c = colorMap[color] || colorMap.indigo;
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-4 ring-1 ${c.ring}`}>
      <div className={`${c.bg} p-2.5 rounded-xl`}>
        <span className={c.icon}>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-lg font-bold text-slate-800 truncate">{value}</p>
        <div className="text-[10px] text-slate-400">{sub}</div>
      </div>
    </div>
  );
}
