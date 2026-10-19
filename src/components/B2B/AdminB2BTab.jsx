import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, limit, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import {
  FiBriefcase, FiCalendar, FiCheckCircle, FiClock, FiDownload,
  FiEye, FiFilter, FiImage, FiLayers, FiRefreshCw, FiSearch, FiTag, FiUsers, FiX
} from "react-icons/fi";
import { FaIndianRupeeSign, FaWeightHanging } from "react-icons/fa6";
import LoadingSpinner from "../Shared/LoadingSpinner";
import EmptyState from "../Shared/EmptyState";
import { ONE8_RATE_MAP, ITEM_RATE_MAP } from "../../config/orderRateCard";

const ONE8_PRICES = {
  "wiping cloth": 9,
  "chef coat": 13,
  "t-shirt": 13,
  "tshirt": 13,
  "t shirt": 13,
  "pant": 13,
  "pants": 13,
  "trouser": 13,
  "apron": 9,
  "napkin": 6,
  "blazer": 200,
  "cap": 5,
};

export function calculateBatchRevenue(entry) {
  const clientLower = String(entry.client || "").toLowerCase();
  const isOne8 = clientLower.includes("one 8") || clientLower.includes("one8");
  
  let total = 0;
  let hasItemRevenue = false;

  if (Array.isArray(entry.items) && entry.items.length > 0) {
    entry.items.forEach(it => {
      const qty = Number(it.qty) || 0;
      if (qty <= 0) return;
      const nameLower = String(it.name || "").trim().toLowerCase();
      let rate = 0;
      if (isOne8) {
        rate = ONE8_PRICES[nameLower] ?? (ONE8_RATE_MAP[it.name] || 0);
      } else {
        rate = ITEM_RATE_MAP[it.name] || 
          (nameLower.includes("bedsheet") ? 30 : 
           nameLower.includes("towel") ? 20 : 
           nameLower.includes("blanket") ? 110 : 
           nameLower.includes("cover") ? 25 : 15);
      }

      if (rate > 0) {
        total += qty * rate;
        hasItemRevenue = true;
      }
    });
  }

  // Fallback to bulk kg calculation if no itemized rate matched
  if (!hasItemRevenue && Number(entry.kg) > 0) {
    const kgRate = 35; // Standard B2B / hostel rate per kg
    total = Number(entry.kg) * kgRate;
  }

  return Math.round(total);
}

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

  // Filters
  const [datePreset, setDatePreset] = useState("month");
  const [dateFrom, setDateFrom] = useState(() => `${getTodayStr().slice(0, 8)}01`);
  const [dateTo, setDateTo] = useState(getTodayStr());
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
        const list = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            calculatedRevenue: calculateBatchRevenue(data),
          };
        }).sort((a, b) => (b.date || "").localeCompare(a.date || "") || (a.client || "").localeCompare(b.client || ""));
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
      setDateFrom(`${today.slice(0, 8)}01`);
      setDateTo(today);
    } else if (preset === "all") {
      setDateFrom("");
      setDateTo("");
    }
  };

  // Unique clients list for filter dropdown
  const uniqueClients = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => {
      if (e.client && e.client.trim()) set.add(e.client.trim());
    });
    return Array.from(set).sort();
  }, [entries]);

  // Filtered dataset
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      // Date filter
      if (dateFrom && e.date && e.date < dateFrom) return false;
      if (dateTo && e.date && e.date > dateTo) return false;

      // Client filter
      if (selectedClient !== "All" && e.client !== selectedClient) return false;

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
    let totalRevenue = 0;
    let totalKg = 0;
    let totalClothes = 0;
    let totalStudents = 0;
    let verifiedBatches = 0;

    filteredEntries.forEach((e) => {
      totalRevenue += Number(e.calculatedRevenue) || 0;
      totalKg += Number(e.kg) || 0;
      totalClothes += Number(e.clothes) || 0;
      totalStudents += Number(e.students) || 0;
      if (e.status === "verified") verifiedBatches++;
    });

    return {
      totalBatches: filteredEntries.length,
      totalRevenue,
      totalKg: Math.round(totalKg * 10) / 10,
      totalClothes,
      totalStudents,
      verifiedBatches,
    };
  }, [filteredEntries]);

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
              ₹{kpis.totalRevenue.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-1">
              One8 & client catalogue rates
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredEntries.map((e) => {
                  const isOne8 = (e.client || "").toLowerCase().includes("one8") || (e.client || "").toLowerCase().includes("one 8");
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
                          <span className={`inline-block w-2 h-2 rounded-full ${isOne8 ? "bg-amber-500" : "bg-blue-500"}`} />
                          <span className="font-extrabold text-slate-900">{e.client}</span>
                        </div>
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
                          ₹{(e.calculatedRevenue || 0).toLocaleString("en-IN")}
                        </div>
                        {isOne8 && (
                          <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                            One8 Rates
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
    </div>
  );
}
