import React, { useState, useEffect, useMemo, useCallback } from "react";
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  TrendingUp, CalendarDays, Plus, X, Upload, Trash2, Eye,
  FileText, Loader2, ImageIcon, PieChart as PieChartIcon, BarChart3, Download,
  ChevronDown, ChevronRight, Split, ChevronUp, ArrowDownLeft, ArrowUpRight, Wallet, User, Lock
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { BiRupee } from "react-icons/bi";
import { isNegativeNumberInput } from "../../utils/numberInputUtils";
import { FaRupeeSign } from "react-icons/fa";
import { normalizeDate } from "../../utils/orderNormalization";
import { useHostelAuth } from "../../context/HostelAuthContext";
import AndesAccountTab from "./AndesAccountTab";

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
  const { orders } = useHostelAuth();
  const [activeSubTab, setActiveSubTab] = useState("personal");
  const [expenses, setExpenses] = useState([]);
  const [isAndesUnlocked, setIsAndesUnlocked] = useState(() => sessionStorage.getItem("andes_unlocked") === "true");
  const [andesPassword, setAndesPassword] = useState("");
  const [andesAuthError, setAndesAuthError] = useState("");
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
  const [expandedRows, setExpandedRows] = useState(new Set());

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

  /* ─── Filtering (Andes account data for analytics) ─── */
  const filtered = useMemo(() => {
    let list = andesExpenses;
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
  }, [andesExpenses, dateFrom, dateTo, catFilter]);

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

  /* ─── Chart data ─── */
  const areaData = useMemo(() => {
    const map = {};
    filtered.forEach((e) => {
      if (!e.date) return;
      if (e.transactionType === "credit") return;
      map[e.date] = (map[e.date] || 0) + (e.amount || 0);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount }));
  }, [filtered]);

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
      {/* Sub-Tab Navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm w-fit">
        <button
          onClick={() => setActiveSubTab("personal")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all ${
            activeSubTab === "personal"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
              : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          <User size={16} /> Expense Analytics
        </button>
        <button
          onClick={() => setActiveSubTab("andes")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all ${
            activeSubTab === "andes"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200"
              : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          <Wallet size={16} /> Andes Account
        </button>
      </div>

      {/* ─── Andes Account Tab ─── */}
      {activeSubTab === "andes" && (
        !isAndesUnlocked ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/50 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm mt-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-6 text-slate-400">
              <Lock size={32} />
            </div>
            <h2 className="text-[18px] font-black text-slate-800 mb-2">Restricted Access</h2>
            <p className="text-[13px] text-slate-500 mb-6 text-center max-w-sm">
              Please enter the master password to access the Andes Account Ledger.
            </p>
            <div className="w-full max-w-sm relative">
              <input 
                type="password" 
                value={andesPassword}
                onChange={(e) => { setAndesPassword(e.target.value); setAndesAuthError(""); }}
                placeholder="Enter password"
                className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-sm pr-24"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const expectedPwd = import.meta.env.VITE_ANDES_PASSWORD || "Financeandes@2505";
                    if (andesPassword === expectedPwd) {
                      setIsAndesUnlocked(true);
                      sessionStorage.setItem("andes_unlocked", "true");
                    } else {
                      setAndesAuthError("Incorrect password");
                    }
                  }
                }}
              />
              <button 
                onClick={() => {
                  const expectedPwd = import.meta.env.VITE_ANDES_PASSWORD || "Financeandes@2505";
                  if (andesPassword === expectedPwd) {
                    setIsAndesUnlocked(true);
                    sessionStorage.setItem("andes_unlocked", "true");
                  } else {
                    setAndesAuthError("Incorrect password");
                  }
                }}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-emerald-600 text-white text-[12px] font-black rounded-lg hover:bg-emerald-700 transition-all uppercase tracking-widest"
              >
                Unlock
              </button>
            </div>
            {andesAuthError && <p className="text-[12px] font-bold text-red-500 mt-3">{andesAuthError}</p>}
          </div>
        ) : (
          <AndesAccountTab entries={andesExpenses} loading={loading} />
        )
      )}

      {/* ─── Personal Account Tab ─── */}
      {activeSubTab === "personal" && (<>
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-[100] bg-[#0F172A] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-left border border-slate-700/50 backdrop-blur-md">
          <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center">
            <FileText size={14} />
          </div>
          <span className="text-[13px] font-black tracking-tight">{toast}</span>
        </div>
      )}

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex bg-white/70 backdrop-blur-sm p-1.5 rounded-xl border border-gray-100 shadow-sm gap-1 overflow-x-auto scrollbar-hide">
              <div className="flex items-center px-3 border-r border-gray-100 mr-1 flex-shrink-0">
                <CalendarDays size={16} className="text-slate-400" />
              </div>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent border-none text-[12px] font-black text-slate-700 focus:ring-0 cursor-pointer" />
              <div className="h-4 w-px bg-gray-200 mx-1 self-center flex-shrink-0" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent border-none text-[12px] font-black text-slate-700 focus:ring-0 cursor-pointer" />
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
        <button onClick={openNew}
          className="flex items-center justify-center gap-2.5 px-6 py-3.5 sm:py-3 bg-blue-600 text-white text-[12px] sm:text-[13px] font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg active:scale-95 uppercase tracking-widest">
          <Plus size={18} /> Record Expense
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard 
          icon={<ArrowDownLeft size={20} />} 
          label="Revenue" 
          value={`₹${kpis.totalReceived.toLocaleString()}`} 
          sub={
            <div className="flex flex-col gap-0.5 mt-1.5 text-[10px]">
              <div className="flex justify-between gap-6">
                <span className="text-slate-400">B2C (Regular):</span>
                <span className="font-extrabold text-slate-600">₹{(kpis.totalReceived - kpis.receivables).toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-6 border-t border-slate-100 pt-0.5 mt-0.5">
                <span className="text-slate-400">B2B (Linen/Hostel):</span>
                <span className="font-extrabold text-slate-600">₹{kpis.receivables.toLocaleString()}</span>
              </div>
            </div>
          } 
          color="blue" 
        />
        <KpiCard icon={<FaRupeeSign size={20} />} label="Total Paid" value={`₹${kpis.totalPaid.toLocaleString()}`} sub={`${kpis.count} entries`} color="indigo" />
        <KpiCard icon={<ArrowUpRight size={20} />} label="Receivables" value={`₹${kpis.receivables.toLocaleString()}`} sub="Non-Regular Sources" color="rose" />
        <KpiCard icon={<FaRupeeSign size={20} />} label="Account Balance" value={`₹${kpis.andesBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub="Net Account Balance" color="emerald" />
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100 shadow-sm p-6 min-w-0">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[15px] font-black text-[#0F172A] tracking-tight flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-500" /> Expense Velocity
            </h3>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Day-by-Day Analysis</div>
          </div>
          {areaData.length === 0 ? (
            <div className="h-[280px] flex flex-col items-center justify-center text-slate-300">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3"><BarChart3 size={24} /></div>
              <p className="text-[13px] font-bold">No historical data found</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280} debounce={100}>
              <AreaChart data={areaData}>
                <defs>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  labelStyle={{ fontWeight: 800, color: '#0F172A', marginBottom: '4px', fontSize: '12px' }}
                  itemStyle={{ fontWeight: 700, fontSize: '12px' }}
                  formatter={(v) => [`₹${v.toLocaleString()}`, "Payment Amount"]}
                />
                <Area type="monotone" dataKey="amount" stroke="#3B82F6" fill="url(#expGrad)" strokeWidth={3} animationDuration={1500} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6 min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <h3 className="text-[15px] font-black text-[#0F172A] tracking-tight flex items-center gap-2">
              <PieChartIcon size={18} className="text-amber-500" /> Sector Allocation
            </h3>
          </div>
          {pieData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-slate-300 font-bold">Waiting for input...</div>
          ) : (
            <div className="flex flex-col gap-5 h-[280px] overflow-y-auto pr-1 scrollbar-hide">
              {pieData.map((item) => (
                <div key={item.name} className="flex flex-col gap-1.5 group">
                  <div className="flex justify-between items-end">
                    <span className="text-[13px] font-bold text-slate-700 truncate pr-4 group-hover:text-slate-900 transition-colors" title={item.name}>
                      {item.name}
                    </span>
                    <span className="text-[13px] font-black text-[#0F172A] shrink-0">
                      ₹{item.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
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
      </>)}
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
