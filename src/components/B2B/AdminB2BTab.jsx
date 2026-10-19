import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, limit, orderBy, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import {
  FiBriefcase, FiCalendar, FiCheckCircle, FiClock, FiDownload,
  FiEye, FiFilter, FiImage, FiLayers, FiRefreshCw, FiSearch, FiTag, FiUsers, FiX,
  FiEdit2, FiPlus, FiTrash2, FiCheck,
} from "react-icons/fi";
import { FaIndianRupeeSign, FaWeightHanging } from "react-icons/fa6";
import LoadingSpinner from "../Shared/LoadingSpinner";
import EmptyState from "../Shared/EmptyState";
import {
  ONE8_RATE_MAP,
  ZOLO_RATE_MAP,
  ITEM_RATE_MAP,
  HOSTEL_99_MONTHLY_REVENUE,
  isHostel99Client,
  getDaysInMonth,
  calculateBatchRevenue,
  calculateLinenWeight,
  getItemsForPartner,
} from "../../config/orderRateCard";

const getTodayStr = () => new Date().toISOString().split("T")[0];
const getDaysAgoStr = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
};

export default function AdminB2BTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  // Filters
  const [datePreset, setDatePreset] = useState("month");
  const [dateFrom, setDateFrom] = useState(() => `${getTodayStr().slice(0, 8)}01`);
  const [dateTo, setDateTo] = useState(() => {
    const today = getTodayStr();
    const year = parseInt(today.slice(0, 4), 10);
    const month = parseInt(today.slice(5, 7), 10);
    const lastDay = new Date(year, month, 0).getDate();
    return `${today.slice(0, 8)}${String(lastDay).padStart(2, "0")}`;
  });
  const [selectedClient, setSelectedClient] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  // Live Subscription to managerB2bEntries
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "managerB2bEntries"), limit(2000));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rawList = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
          };
        });

        // Count active Hostel 99 batches per date to evenly divide daily ₹28k share
        const hostel99CountByDate = {};
        rawList.forEach((e) => {
          if (isHostel99Client(e.client) && e.status !== "cancelled") {
            const d = e.date || "unknown";
            hostel99CountByDate[d] = (hostel99CountByDate[d] || 0) + 1;
          }
        });

        const list = rawList.map((data) => {
          const isH99 = isHostel99Client(data.client);
          const d = data.date || "unknown";
          const countOnDate = isH99 ? (hostel99CountByDate[d] || 1) : 1;
          return {
            ...data,
            canonicalClient: isH99 ? "Hostel 99" : (data.client || "").trim(),
            h99BatchesOnDate: countOnDate,
            calculatedRevenue: calculateBatchRevenue(data, countOnDate),
          };
        }).sort((a, b) => (b.date || "").localeCompare(a.date || "") || (a.canonicalClient || a.client || "").localeCompare(b.canonicalClient || b.client || ""));

        setEntries(list);
        setLoading(false);
      },
      (error) => {
        console.error("managerB2bEntries sync error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Quick date presets
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const today = getTodayStr();
    if (preset === "today") {
      setDateFrom(today);
      setDateTo(today);
    } else if (preset === "yesterday") {
      const yest = getDaysAgoStr(1);
      setDateFrom(yest);
      setDateTo(yest);
    } else if (preset === "week") {
      setDateFrom(getDaysAgoStr(6));
      setDateTo(today);
    } else if (preset === "month") {
      const year = parseInt(today.slice(0, 4), 10);
      const month = parseInt(today.slice(5, 7), 10);
      const lastDay = new Date(year, month, 0).getDate();
      setDateFrom(`${today.slice(0, 8)}01`);
      setDateTo(`${today.slice(0, 8)}${String(lastDay).padStart(2, "0")}`);
    } else if (preset === "all") {
      setDateFrom("");
      setDateTo("");
    }
  };

  // Unique clients list for filter dropdown (all Hostel 99 properties combined)
  const uniqueClients = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => {
      const canonical = isHostel99Client(e.client) ? "Hostel 99" : (e.client && e.client.trim());
      if (canonical) set.add(canonical);
    });
    return Array.from(set).sort();
  }, [entries]);

  // Filtered dataset
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      // Date filter
      if (dateFrom && e.date && e.date < dateFrom) return false;
      if (dateTo && e.date && e.date > dateTo) return false;

      // Client filter (handles combined Hostel 99)
      if (selectedClient !== "All") {
        if (selectedClient === "Hostel 99") {
          if (!isHostel99Client(e.client)) return false;
        } else if ((e.client || "").trim() !== selectedClient) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "All" && e.status !== statusFilter.toLowerCase()) return false;

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const clientMatch = (e.client || "").toLowerCase().includes(query);
        const batchMatch = String(e.batchNo || "").toLowerCase().includes(query);
        const noteMatch = (e.note || "").toLowerCase().includes(query);
        const itemsMatch = Array.isArray(e.items) && e.items.some((it) => (it.name || "").toLowerCase().includes(query));
        if (!clientMatch && !batchMatch && !noteMatch && !itemsMatch) return false;
      }

      return true;
    });
  }, [entries, dateFrom, dateTo, selectedClient, statusFilter, searchTerm]);

  // Aggregate KPI metrics
  const kpis = useMemo(() => {
    let nonH99Revenue = 0;
    let totalKg = 0;
    let totalClothes = 0;
    let totalStudents = 0;
    let verifiedBatches = 0;
    const h99Entries = [];

    filteredEntries.forEach((e) => {
      totalKg += Number(e.kg) || 0;
      totalClothes += Number(e.clothes) || 0;
      totalStudents += Number(e.students) || 0;
      if (e.status === "verified") verifiedBatches++;

      if (isHostel99Client(e.client)) {
        h99Entries.push(e);
      } else {
        nonH99Revenue += Number(e.calculatedRevenue) || 0;
      }
    });

    const h99Dates = new Set();
    h99Entries.forEach((e) => {
      if (e.date) h99Dates.add(e.date);
    });

    const isFullMonth = dateFrom && dateTo && dateFrom.slice(8, 10) === "01" &&
      dateTo === `${dateTo.slice(0, 8)}${new Date(parseInt(dateTo.slice(0, 4), 10), parseInt(dateTo.slice(5, 7), 10), 0).getDate()}`;

    const hostel99Revenue = isFullMonth
      ? HOSTEL_99_MONTHLY_REVENUE
      : Array.from(h99Dates).reduce((sum, d) => sum + (HOSTEL_99_MONTHLY_REVENUE / getDaysInMonth(d)), 0);

    const totalRevenue = nonH99Revenue + (h99Dates.size > 0 ? hostel99Revenue : 0);

    return {
      totalBatches: filteredEntries.length,
      totalRevenue: Math.round(totalRevenue),
      hostel99Revenue: Math.round(h99Dates.size > 0 ? hostel99Revenue : 0),
      totalKg: Math.round(totalKg * 10) / 10,
      totalClothes,
      totalStudents,
      verifiedBatches,
    };
  }, [filteredEntries, dateFrom, dateTo]);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      alert("No entries to export for the selected filter.");
      return;
    }

    const headers = [
      "Date",
      "Client",
      "Batch No",
      "Weight (kg)",
      "Clothes Count",
      "Students",
      "Calculated Revenue (INR)",
      "Status",
      "Items Breakdown",
      "Proof Photo URL",
      "Note",
      "Created By",
    ];

    const rows = filteredEntries.map((e) => [
      e.date || "",
      `"${(e.client || "").replace(/"/g, '""')}"`,
      e.batchNo || "1",
      e.kg || 0,
      e.clothes || 0,
      e.students || 0,
      e.calculatedRevenue || 0,
      e.status || "pending",
      `"${(e.items || []).map((it) => `${it.name}: ${it.qty}`).join("; ").replace(/"/g, '""')}"`,
      `"${e.photoUrl || ""}"`,
      `"${(e.note || "").replace(/"/g, '""')}"`,
      e.createdBy || "",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Andes_B2B_Orders_${dateFrom || "all"}_to_${dateTo || "today"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <LoadingSpinner fullscreen />;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. TOP METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">B2B Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FaIndianRupeeSign size={15} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              ₹{Math.round(kpis.totalRevenue).toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-1">
              {kpis.hostel99Revenue > 0 ? `Includes ₹${kpis.hostel99Revenue.toLocaleString("en-IN")} Hostel 99 share` : "One8, Hostel 99 & catalogue rates"}
            </div>
          </div>
        </div>

        {/* Total Batches */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Batches</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <FiBriefcase size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {kpis.totalBatches}
            </div>
            <div className="text-[11px] font-semibold text-emerald-600 mt-1">
              {kpis.verifiedBatches} verified
            </div>
          </div>
        </div>

        {/* Total Weight */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Weight</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <FaWeightHanging size={15} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {kpis.totalKg} <span className="text-sm font-semibold text-slate-500">kg</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-1">
              Processed in period
            </div>
          </div>
        </div>

        {/* Total Clothes */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Clothes</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <FiLayers size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {kpis.totalClothes.toLocaleString("en-IN")} <span className="text-sm font-semibold text-slate-500">pcs</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-1">
              Pieces cleaned
            </div>
          </div>
        </div>

        {/* Total Students */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Students Handled</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <FiUsers size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {kpis.totalStudents ? kpis.totalStudents.toLocaleString("en-IN") : "—"}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-1">
              Hostels & colleges
            </div>
          </div>
        </div>
      </div>

      {/* 2. FILTER & CONTROLS TOOLBAR */}
      <div className="bg-white p-4 lg:p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        {/* Date presets & Export */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "week", label: "Last 7 Days" },
              { id: "month", label: "This Month" },
              { id: "all", label: "All Time" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  datePreset === p.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
          >
            <FiDownload size={14} /> Export CSV
          </button>
        </div>

        {/* Date pickers, Client filter, Status, Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-gray-50">
          {/* Custom Date Range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setDatePreset("custom"); }}
              className="w-full text-xs font-semibold px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-slate-400 text-xs font-bold">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setDatePreset("custom"); }}
              className="w-full text-xs font-semibold px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Client Filter */}
          <div>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All B2B Clients ({uniqueClients.length})</option>
              {uniqueClients.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Verified">Verified</option>
              <option value="Pending">Pending</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search client, batch, item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs font-semibold pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <FiX size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. B2B BATCHES TABLE & CARDS */}
      {filteredEntries.length === 0 ? (
        <EmptyState
          title="No B2B batches found"
          sub="No manager B2B entries match the current date and filter selection."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Table Header Summary */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="text-sm font-bold text-slate-800">
              Showing <span className="text-blue-600">{filteredEntries.length}</span> B2B batches
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Live synced from Manager Portal
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Date & Batch</th>
                  <th className="py-3 px-4">Client / Property</th>
                  <th className="py-3 px-4">Weight & Clothes</th>
                  <th className="py-3 px-4">Item Breakdown</th>
                  <th className="py-3 px-4 text-center">Students</th>
                  <th className="py-3 px-4 text-right">Revenue</th>
                  <th className="py-3 px-4 text-center">Proof Photo</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredEntries.map((e) => {
                  const isOne8 = (e.client || "").toLowerCase().includes("one8") || (e.client || "").toLowerCase().includes("one 8");
                  const isZolo = (e.client || "").toLowerCase().includes("zolo");
                  const isHostel99 = isHostel99Client(e.client);
                  const daysInMonth = getDaysInMonth(e.date);
                  const isVerified = e.status === "verified";
                  const isCancelled = e.status === "cancelled";

                  return (
                    <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Date & Batch */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{e.date || "—"}</div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          Batch #{e.batchNo || "1"}
                        </div>
                      </td>

                      {/* Client Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-2 h-2 rounded-full ${isOne8 ? "bg-amber-500" : isHostel99 ? "bg-purple-600" : "bg-blue-500"}`} />
                          <span className="font-extrabold text-slate-900">
                            {isHostel99 ? "Hostel 99" : e.client}
                          </span>
                          {isHostel99 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-black bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-tight">
                              Fixed ₹28k/mo
                            </span>
                          )}
                        </div>
                        {isHostel99 && e.client && e.client.trim().toLowerCase() !== "hostel 99" && (
                          <div className="text-[10.5px] text-slate-500 font-semibold mt-0.5">
                            Property: {e.client}
                          </div>
                        )}
                        {e.note && (
                          <p className="text-[11px] text-slate-400 italic mt-0.5 max-w-xs truncate" title={e.note}>
                            "{e.note}"
                          </p>
                        )}
                      </td>

                      {/* Weight & Clothes */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          {e.kg ? `${e.kg} kg` : "—"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {e.clothes ? `${e.clothes} pcs` : "—"}
                        </div>
                      </td>

                      {/* Item Breakdown */}
                      <td className="py-3.5 px-4 max-w-xs">
                        {Array.isArray(e.items) && e.items.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {e.items.map((it, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold"
                              >
                                {it.name}: <strong className="ml-1 text-slate-900">{it.qty}</strong>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Bulk laundry</span>
                        )}
                      </td>

                      {/* Students */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {e.students ? (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full text-[11px]">
                            <FiUsers size={11} /> {e.students}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Calculated Revenue */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="font-black text-slate-900 text-sm">
                          ₹{(e.calculatedRevenue || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: Number.isInteger(e.calculatedRevenue) ? 0 : 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        {isOne8 && (
                          <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                            One8 Rates
                          </div>
                        )}
                        {isZolo && (
                          <div className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">
                            Zolo Rates
                          </div>
                        )}
                        {isHostel99 && (
                          <div className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">
                            {e.h99BatchesOnDate > 1
                              ? `₹28k ÷ ${daysInMonth}d ÷ ${e.h99BatchesOnDate} batches`
                              : `₹28,000 ÷ ${daysInMonth} days`}
                          </div>
                        )}
                      </td>

                      {/* Proof Photo Thumbnail */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {e.photoUrl ? (
                          <button
                            type="button"
                            onClick={() => setSelectedPhoto(e.photoUrl)}
                            className="group relative inline-block rounded-lg overflow-hidden border border-slate-200 hover:border-blue-500 shadow-sm transition-all focus:outline-none"
                            title="Click to view full photo"
                          >
                            <img
                              src={e.photoUrl}
                              alt="Challan"
                              className="w-10 h-10 object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                              <FiEye size={14} />
                            </div>
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[11px] italic">None</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                            isVerified
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : isCancelled
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {e.status || "pending"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setEditingEntry(e)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 shadow-sm"
                        >
                          <FiEdit2 size={12} /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. FULL PHOTO LIGHTBOX MODAL */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-sm font-bold flex items-center gap-2">
                <FiImage size={16} /> Challan / Batch Photo Proof
              </span>
              <div className="flex items-center gap-3">
                <a
                  href={selectedPhoto}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-300 hover:text-white underline font-medium"
                >
                  Open Original
                </a>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <FiX size={18} />
                </button>
              </div>
            </div>

            {/* Modal Image Body */}
            <div className="p-2 bg-slate-950 flex items-center justify-center max-h-[80vh] overflow-auto">
              <img
                src={selectedPhoto}
                alt="B2B Proof"
                className="max-h-[75vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[100] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700/60 animate-slide-left">
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
            <FiCheck size={14} />
          </div>
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* 5. EDIT B2B ENTRY MODAL */}
      {editingEntry && (
        <B2BEditModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSuccess={(msg) => {
            setToastMessage(msg);
            setTimeout(() => setToastMessage(""), 3500);
          }}
        />
      )}
    </div>
  );
}

function B2BEditModal({ entry, onClose, onSuccess }) {
  const [form, setForm] = useState(() => ({
    date: entry.date || "",
    client: entry.client || "",
    batchNo: entry.batchNo || "1",
    kg: entry.kg ?? "",
    clothes: entry.clothes ?? "",
    students: entry.students ?? "",
    note: entry.note || "",
    status: entry.status || "pending",
    photoUrl: entry.photoUrl || "",
    items: Array.isArray(entry.items) ? entry.items.map((it) => ({ name: it.name || "", qty: it.qty ?? "" })) : [],
  }));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete this ${form.client} batch #${form.batchNo}? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "managerB2bEntries", entry.id));
      onSuccess?.("B2B batch deleted successfully!");
      onClose();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
      setDeleting(false);
    }
  };

  const isH99 = isHostel99Client(form.client);
  const isLinen = isH99 || String(form.client || "").toLowerCase().includes("zolo");
  const partnerItems = useMemo(() => getItemsForPartner(form.client), [form.client]);

  const updateItems = (newItems) => {
    const autoW = calculateLinenWeight(newItems);
    const totalPcs = newItems.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    setForm((f) => ({
      ...f,
      items: newItems,
      kg: isLinen && autoW > 0 ? autoW : autoW > 0 && (!f.kg || f.kg === "0" || f.kg === "") ? autoW : f.kg,
      clothes: totalPcs > 0 ? totalPcs : f.clothes,
    }));
  };

  const handleItemChange = (index, field, value) => {
    const updated = form.items.map((it, idx) => (idx === index ? { ...it, [field]: value } : it));
    updateItems(updated);
  };

  const addItem = (name = "", qty = 1) => {
    const updated = [...form.items, { name, qty }];
    updateItems(updated);
  };

  const removeItem = (index) => {
    const updated = form.items.filter((_, idx) => idx !== index);
    updateItems(updated);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const cleanItems = form.items
        .filter((it) => it.name.trim() && Number(it.qty) > 0)
        .map((it) => ({ name: it.name.trim(), qty: Number(it.qty) }));

      const cleanKg = Number(form.kg) || 0;
      const cleanClothes = cleanItems.length > 0
        ? cleanItems.reduce((s, it) => s + it.qty, 0)
        : Number(form.clothes) || 0;

      const payload = {
        date: form.date,
        client: form.client.trim(),
        batchNo: String(form.batchNo || "1").trim(),
        kg: cleanKg,
        clothes: cleanClothes,
        students: Number(form.students) || 0,
        status: form.status,
        note: form.note.trim(),
        photoUrl: form.photoUrl.trim(),
        items: cleanItems,
        updatedAt: serverTimestamp(),
        updatedBy: "admin",
      };

      const newRev = calculateBatchRevenue(payload, entry.h99BatchesOnDate || 1);
      payload.calculatedRevenue = newRev;
      payload.amount = newRev;

      const docRef = doc(db, "managerB2bEntries", entry.id);
      await updateDoc(docRef, payload);

      onSuccess("B2B entry updated successfully!");
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update entry.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in" onClick={onClose}>
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] my-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Edit B2B Entry</h2>
            <p className="text-xs text-slate-500 font-semibold">{entry.client} · Batch #{entry.batchNo} · {entry.date}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors">
            <FiX size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-bold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Client</label>
              <input
                type="text"
                value={form.client}
                onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Batch No.</label>
              <input
                type="text"
                value={form.batchNo}
                onChange={(e) => setForm((f) => ({ ...f, batchNo: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Weight (KG)</label>
                {isH99 && <span className="text-[10px] text-blue-600 font-bold">Auto-calculated</span>}
              </div>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.kg}
                onChange={(e) => setForm((f) => ({ ...f, kg: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Clothes (Pcs)</label>
              <input
                type="number"
                min="0"
                value={form.items.length ? form.items.reduce((s, it) => s + (Number(it.qty) || 0), 0) : form.clothes}
                onChange={(e) => setForm((f) => ({ ...f, clothes: e.target.value }))}
                disabled={form.items.length > 0}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500 disabled:opacity-70"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Students</label>
              <input
                type="number"
                min="0"
                value={form.students}
                onChange={(e) => setForm((f) => ({ ...f, students: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Items breakdown */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                Item Breakdown {isH99 ? "(Hostel 99 Linen - Weights Auto-Calculated)" : ""}
              </label>
              <button
                type="button"
                onClick={() => {
                  const existing = new Set(form.items.map((it) => it.name.toLowerCase()));
                  const toAdd = partnerItems.filter((name) => !existing.has(name.toLowerCase())).map((name) => ({ name, qty: 1 }));
                  updateItems([...form.items, ...toAdd]);
                }}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg"
              >
                + Pre-fill Catalogue
              </button>
            </div>

            {/* Quick add chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2">
              {partnerItems.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    const idx = form.items.findIndex((it) => it.name.toLowerCase() === name.toLowerCase());
                    if (idx >= 0) {
                      handleItemChange(idx, "qty", (Number(form.items[idx].qty) || 0) + 1);
                    } else {
                      addItem(name, 1);
                    }
                  }}
                  className="shrink-0 px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-md text-[10px] font-semibold transition-colors"
                >
                  + {name}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {form.items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={it.name}
                    onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                    placeholder="Item name"
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500"
                  />
                  <input
                    type="number"
                    min="0"
                    value={it.qty}
                    onChange={(e) => handleItemChange(idx, "qty", e.target.value)}
                    placeholder="Qty"
                    className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500 text-center"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => addItem("", 1)}
              className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <FiPlus size={13} /> Add item
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Note</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="e.g. Sent for deep wash, special handling"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Proof Photo URL</label>
            <input
              type="text"
              value={form.photoUrl}
              onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 outline-none focus:border-blue-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="px-4 py-2 font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <FiTrash2 size={15} /> {deleting ? "Deleting..." : "Delete Batch"}
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || deleting}
                className="px-4 py-2 font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || deleting}
                className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors flex items-center gap-2"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
