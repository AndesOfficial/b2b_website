// src/pages/ClientDashboard.jsx
import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useHostelAuth } from "../context/HostelAuthContext";
import { CATEGORIES } from "../data/hostelOrders";
import ExpandableOrderRow from "../components/ExpandableOrderRow";
import {
  FiLogOut, FiFilter, FiCalendar, FiX, FiDownload,
  FiPackage, FiShoppingBag, FiTruck, FiUsers, FiAlertTriangle, FiPlus
} from "react-icons/fi";
import { BiRupee } from "react-icons/bi";
import { MdScale } from "react-icons/md";
import BrandLogo from "../components/BrandLogo";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import AirbnbOrderForm from "../components/AirbnbOrderForm";

// ── CSV export helper ──
function exportCSV(rows, filename) {
  if (!rows.length) return;
  const headers = ["Order ID", "Date", "Property", "Category", "Clothes", "Weight", "Students", "Status", "Customer", "Phone"];
  const csvRows = [
    headers.join(","),
    ...rows.map((o) =>
      [
        o.id,
        o.date,
        `"${o.property}"`,
        o.category,
        o.items ?? "",
        o.weight ?? "",
        o.studentCount ?? "",
        o.status,
        `"${o.customerName || ""}"`,
        o.customerNumber || "",
      ].join(",")
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Category icon map (react-icons) ──
const CAT_ICONS = {
  LINEN: <FiShoppingBag />,
  STUDENT_LAUNDRY: <FiPackage />,
  B2C_RETAIL: <FiShoppingBag />,
  AIRBNB: <FiTruck />,
  BULK_LAUNDRY: <FiTruck />,
  ISSUES: <FiAlertTriangle />,
};

export default function ClientDashboard() {
  const { client, orders, logout, addIssue, profileNeedsSetup } = useHostelAuth();
  const navigate = useNavigate();
  // Helper to handle schema migration (properties -> partnernames)
  const clientProperties = useMemo(() => client?.properties || client?.partnernames || [], [client]);
  const isGroup = client?.isGroup && clientProperties.length > 1;

  // STRICT check: Only true if the full name is exactly "airbnb viman nagar" (case-insensitive)
  const isSpecificAirbnb =
    (client?.name || "").toLowerCase() === "airbnb viman nagar" ||
    clientProperties.some(p => p.toLowerCase() === "airbnb viman nagar");

  // Filters
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Modals State
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false); // New state for Order Modal

  const [issueForm, setIssueForm] = useState({
    property: clientProperties[0] || "",
    issueType: "Missing Items",
    description: ""
  });

  // Keep issue form in sync if client properties load late
  useMemo(() => {
    if (!issueForm.property && clientProperties.length > 0) {
      setIssueForm(prev => ({ ...prev, property: clientProperties[0] }));
    }
  }, [clientProperties]);

  // Filtered orders
  const filtered = useMemo(() => {
    let list = orders;
    if (propertyFilter !== "all") list = list.filter((o) => o.property === propertyFilter);
    if (statusFilter !== "all") list = list.filter((o) => o.status === statusFilter);
    if (dateFrom) list = list.filter((o) => o.date >= dateFrom);
    if (dateTo) list = list.filter((o) => o.date <= dateTo);
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [orders, propertyFilter, statusFilter, dateFrom, dateTo]);

  // KPIs
  const totalOrders = filtered.length;
  const totalItems = filtered.reduce((s, o) => s + (o.items || 0), 0);
  const totalWeight = filtered.reduce((s, o) => s + (o.weight || 0), 0);
  const uniqueStatuses = [...new Set(orders.map((o) => o.status))];
  const isTreeboClient =
    String(client?.name || "").toLowerCase().includes("treebo")
    || (clientProperties || []).some((p) => String(p || "").toLowerCase().includes("treebo"));
  const displayClientName = isTreeboClient ? "Treebo Classic Grande Hotel Camp" : client?.name;

  const monthlyBilling = isTreeboClient
    ? 32000
    : (Number.isFinite(Number(client?.monthlyBilling)) ? Number(client.monthlyBilling) : null);

  const [showPiecesModal, setShowPiecesModal] = useState(false);

  const getOrderItemsMap = useCallback((order) => {
    if (order?.partnerItems && typeof order.partnerItems === "object") return order.partnerItems;
    if (order?.details && typeof order.details === "object") return order.details;

    if (typeof order?.details === "string") {
      // Supports strings like: "Hand towel=9 | Single Bedsheet: 2, Duvet Cover: 6"
      const normalized = order.details.replace(/\|/g, ",").replace(/=/g, ":");
      const map = {};
      normalized.split(",").forEach((chunk) => {
        const part = String(chunk || "").trim();
        if (!part) return;
        const [rawName, rawQty] = part.split(":");
        const name = String(rawName || "").trim();
        const qty = Number(String(rawQty || "").trim());
        if (!name) return;
        if (!Number.isFinite(qty)) return;
        map[name] = (map[name] || 0) + qty;
      });
      return map;
    }

    return {};
  }, []);

  const piecesBreakdown = useMemo(() => {
    const totals = {
      singleBedsheet: 0,
      doubleBedsheet: 0,
      pillowCover: 0,
      singleDuvetCover: 0,
      doubleDuvetCover: 0,
      towel: 0,
      handTowel: 0,
      curtains: 0,
      doorMats: 0,
      other: 0,
    };

    const add = (key, qty) => {
      if (!Number.isFinite(qty)) return;
      totals[key] += qty;
    };

    filtered.forEach((order) => {
      const itemsMap = getOrderItemsMap(order);
      Object.entries(itemsMap || {}).forEach(([rawName, rawQty]) => {
        const name = String(rawName || "").toLowerCase().trim();
        const qty = Number(rawQty);
        if (!Number.isFinite(qty) || qty <= 0) return;

        if (name.includes("single") && name.includes("bedsheet")) return add("singleBedsheet", qty);
        if ((name.includes("double") || name.includes("dbl")) && name.includes("bedsheet")) return add("doubleBedsheet", qty);
        if (name.includes("pillow")) return add("pillowCover", qty);
        if (name.includes("single") && name.includes("duvet")) return add("singleDuvetCover", qty);
        if ((name.includes("double") || name.includes("dbl")) && name.includes("duvet")) return add("doubleDuvetCover", qty);
        if (name.includes("hand towel")) return add("handTowel", qty);
        if (name.includes("bath towel") || (name.includes("towel") && !name.includes("hand"))) return add("towel", qty);
        if (name.includes("curtain")) return add("curtains", qty);
        if (name.includes("door mat") || name.includes("doormat")) return add("doorMats", qty);

        add("other", qty);
      });
    });

    const totalPieces =
      totals.singleBedsheet
      + totals.doubleBedsheet
      + totals.pillowCover
      + totals.singleDuvetCover
      + totals.doubleDuvetCover
      + totals.towel
      + totals.handTowel
      + totals.curtains
      + totals.doorMats
      + totals.other;

    return { totals, totalPieces };
  }, [filtered, getOrderItemsMap]);

  // Category breakdown
  const categoryStats = useMemo(() => {
    const map = {};
    filtered.forEach((o) => {
      if (!map[o.category]) map[o.category] = { count: 0, items: 0, airbnbCount: 0 };
      map[o.category].count++;
      map[o.category].items += o.items || 0;
      if (String(o.property || "").toLowerCase().includes("airbnb")) {
        map[o.category].airbnbCount++;
      }
    });

    return Object.entries(map).map(([key, val]) => {
      const base = CATEGORIES[key] || { label: key, color: "#6B7280" };
      let label = base.label || key;

      if (key === "AIRBNB") {
        if (val.airbnbCount === 0) label = "Hotel Service";
        else if (val.airbnbCount === val.count) label = "Airbnb Services";
        else label = "Hotel/Airbnb Services";
      }

      return {
        key,
        ...base,
        label,
        ...val,
      };
    });
  }, [filtered]);

  const hasActiveFilters = propertyFilter !== "all" || statusFilter !== "all" || dateFrom || dateTo;

  const clearFilters = () => {
    setPropertyFilter("all");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const handleExport = useCallback(() => {
    exportCSV(filtered, `${(displayClientName || "orders").replace(/\s+/g, "_")}_orders.csv`);
  }, [filtered, displayClientName]);

  // Issue Submission Handler
  const handleSubmitIssue = async () => {
    if (!issueForm.description.trim()) return;

    const selectedProperty = isGroup ? issueForm.property : clientProperties[0];
    const newIssue = {
      id: `issue-client-${Date.now()}`,
      date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0],
      property: selectedProperty,
      linkedHostel: selectedProperty, // For Admin parsing
      category: "ISSUES",
      type: "issue",
      issueType: issueForm.issueType,
      service: issueForm.description,
      severity: "pending",
      resolveStatus: "Unresolved",
      status: "Pending",
      reportedBy: client.name,
      customerName: client.name,
      items: 0,
      weight: 0,
      amount: 0
    };

    await addIssue(newIssue);
    setShowIssueModal(false);
    setIssueForm({ ...issueForm, description: "" });
  };

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "Poppins, sans-serif" }}>
      {/* Top nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center">
              <BrandLogo className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">{displayClientName}</h1>
              <p className="text-xs text-gray-500">Order History Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* NEW: Place Order Button (Only visible for Airbnb Viman Nagar) */}
            {isSpecificAirbnb && (
              <button
                onClick={() => setShowOrderModal(true)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition-all shadow-sm"
              >
                <FiPlus size={16} /> Place Order
              </button>
            )}

            <button
              onClick={() => setShowIssueModal(true)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              <FiAlertTriangle size={15} /> Raise Issue
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-dark border border-brand-200 bg-blue-50 px-4 py-2 rounded-xl transition-all hover:bg-blue-100"
            >
              <FiDownload size={15} /> Export CSV
            </button>
            <button
              onClick={() => { logout(); navigate("/login"); }}
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-colors font-medium"
            >
              <FiLogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {profileNeedsSetup && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
            <p className="text-[12px] font-black uppercase tracking-widest text-amber-700">Account setup pending</p>
            <p className="mt-1 text-[13px] font-semibold text-amber-900">
              Your account is missing <span className="font-black">partnernames</span> in Firestore. Ask admin to update your profile in <span className="font-black">b2b_managers</span> so you can see Treebo orders.
            </p>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Orders", value: totalOrders, color: "#1976D2", bgColor: "bg-blue-50", Icon: FiPackage },
            { label: "Total Pieces", value: piecesBreakdown.totalPieces.toLocaleString(), color: "#7C3AED", bgColor: "bg-purple-50", Icon: FiShoppingBag, onClick: () => setShowPiecesModal(true) },
            { label: "Total Weight", value: `${totalWeight.toFixed(1)} KG`, color: "#D97706", bgColor: "bg-orange-50", Icon: MdScale },
            { label: "Monthly Billing", value: monthlyBilling !== null ? `₹${monthlyBilling.toLocaleString()}` : "—", color: "#059669", bgColor: "bg-emerald-50", Icon: BiRupee },
          ].map((kpi) => (
            <div
              key={kpi.label}
              role={kpi.onClick ? "button" : undefined}
              tabIndex={kpi.onClick ? 0 : undefined}
              onClick={kpi.onClick}
              onKeyDown={(e) => {
                if (!kpi.onClick) return;
                if (e.key === "Enter" || e.key === " ") kpi.onClick();
              }}
              className={`bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-start gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${kpi.onClick ? "cursor-pointer" : ""}`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 p-3 ${kpi.bgColor}`}
              >
                <kpi.Icon size={22} style={{ color: kpi.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-3xl font-bold text-gray-900 leading-tight tracking-tight">{kpi.value}</p>
                <p className="text-sm font-medium text-gray-400 mt-1 uppercase tracking-wider">{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>

        {showPiecesModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowPiecesModal(false)} />
            <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl animate-slide-up">
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 p-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Laundry Item Breakdown</h2>
                  <p className="text-xs text-gray-500">Total pieces: {piecesBreakdown.totalPieces.toLocaleString()}</p>
                </div>
                <button onClick={() => setShowPiecesModal(false)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                  <FiX size={18} />
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                {[
                  {
                    title: "Bedsheets",
                    rows: [
                      ["Single Bed Bedsheets", piecesBreakdown.totals.singleBedsheet],
                      ["Double Bed Bedsheets", piecesBreakdown.totals.doubleBedsheet],
                    ],
                  },
                  {
                    title: "Pillow Covers",
                    rows: [["Pillow Covers", piecesBreakdown.totals.pillowCover]],
                  },
                  {
                    title: "Duvet Covers",
                    rows: [
                      ["Single Bed Duvet Covers", piecesBreakdown.totals.singleDuvetCover],
                      ["Double Bed Duvet Covers", piecesBreakdown.totals.doubleDuvetCover],
                    ],
                  },
                  {
                    title: "Towels",
                    rows: [
                      ["Towels", piecesBreakdown.totals.towel],
                      ["Hand Towels", piecesBreakdown.totals.handTowel],
                    ],
                  },
                  {
                    title: "Others",
                    rows: [
                      ["Curtains", piecesBreakdown.totals.curtains],
                      ["Door Mats", piecesBreakdown.totals.doorMats],
                      ["Other / Unmapped", piecesBreakdown.totals.other],
                    ],
                  },
                ].map((section) => (
                  <div key={section.title} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{section.title}</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {section.rows.map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between px-5 py-3">
                          <p className="text-sm font-semibold text-gray-700">{label}</p>
                          <p className="text-sm font-bold text-gray-900">{Number(value || 0).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-brand transition-colors"
            >
              <FiFilter size={16} />
              Filters
              {hasActiveFilters && (
                <span className="bg-brand text-white text-xs px-2 py-0.5 rounded-full">Active</span>
              )}
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 font-medium inline-flex items-center gap-1">
                <FiX size={12} /> Clear All
              </button>
            )}
          </div>

          {showFilters && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {isGroup && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Property</label>
                  <select
                    value={propertyFilter}
                    onChange={(e) => setPropertyFilter(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 text-sm px-3 py-2 focus:outline-none focus:border-brand"
                  >
                    <option value="all">All Properties</option>
                    {clientProperties.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 text-sm px-3 py-2 focus:outline-none focus:border-brand"
                >
                  <option value="all">All Status</option>
                  {uniqueStatuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">From Date</label>
                <div className="relative">
                  <FiCalendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 text-sm pl-9 pr-3 py-2 focus:outline-none focus:border-brand" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">To Date</label>
                <div className="relative">
                  <FiCalendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 text-sm pl-9 pr-3 py-2 focus:outline-none focus:border-brand" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        {!isTreeboClient && categoryStats.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-gray-800 mb-3">Category Breakdown</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryStats.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => navigate(`/client/category/${cat.key}`)}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-left hover:shadow-md hover:border-brand-200 transition-all group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                      style={{ backgroundColor: cat.color }}
                    >
                      {CAT_ICONS[cat.key] || <FiPackage />}
                    </div>
                    <span className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">
                      {cat.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="text-xs text-gray-400 font-medium">{cat.key === 'ISSUES' ? 'Issues' : 'Orders'}</p>
                      <p className="text-lg font-bold" style={{ color: cat.color }}>{cat.count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">Items</p>
                      <p className="text-sm font-bold text-gray-700">{cat.items}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Orders Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-800">All Orders ({filtered.length})</h2>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-dark transition-colors"
            >
              <FiDownload size={13} /> Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  {isGroup && (
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Property</th>
                  )}
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-1.5"><FiShoppingBag size={13} className="text-gray-400" /> {isTreeboClient ? "Pieces" : "Clothes"}</div>
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-1.5"><MdScale size={13} className="text-gray-400" /> Weight (KG)</div>
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-1.5"><FiUsers size={14} className="text-gray-400" /> Students</div>
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={isGroup ? 9 : 8} className="text-center py-16 text-gray-400 text-sm">
                      No orders found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => (
                    <ExpandableOrderRow key={o.id} order={o} showProperty={isGroup} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- MODALS --- */}

        {/* Raise Issue Modal */}
        {showIssueModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowIssueModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slide-up">
              <div className="flex items-center justify-between mb-6 cursor-default">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Raise an Issue</h2>
                  <p className="text-xs text-gray-500">Report a problem with your order or service</p>
                </div>
                <button onClick={() => setShowIssueModal(false)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                  <FiX size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {isGroup && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Select Property</label>
                    <select
                      value={issueForm.property}
                      onChange={(e) => setIssueForm({ ...issueForm, property: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 text-sm px-4 py-2.5 focus:outline-none focus:border-red-500"
                    >
                      {clientProperties.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Issue Category</label>
                  <select
                    value={issueForm.issueType}
                    onChange={(e) => setIssueForm({ ...issueForm, issueType: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 text-sm px-4 py-2.5 focus:outline-none focus:border-red-500 bg-no-repeat bg-right"
                  >
                    <option value="Missing Items">Missing Items</option>
                    <option value="Damage">Damage</option>
                    <option value="Quality Issue">Quality Issue</option>
                    <option value="Return Pending">Return Pending</option>
                    <option value="Weight Dispute">Weight Dispute</option>
                    <option value="Bags Pending">Bags Pending</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Description of Issue</label>
                  <textarea
                    value={issueForm.description}
                    onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                    rows={4}
                    placeholder="Provide full details here..."
                    className="w-full rounded-xl border border-gray-200 text-sm px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowIssueModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitIssue}
                  disabled={!issueForm.description.trim()}
                  className="flex-[1.5] py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-md active:scale-95"
                >
                  Submit Issue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NEW: Place Order Modal (Airbnb Only) */}
        {showOrderModal && isSpecificAirbnb && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowOrderModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-up">

              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">New Pickup Order</h2>
                  <p className="text-xs text-gray-500">Assign a new order directly to your rider</p>
                </div>
                <button onClick={() => setShowOrderModal(false)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                  <FiX size={20} />
                </button>
              </div>

              <div className="p-6 max-h-[80vh] overflow-y-auto">
                <AirbnbOrderForm
                  clientName={displayClientName}
                  onSuccess={() => {
                    alert("Order successfully assigned to rider!");
                    setShowOrderModal(false);
                  }}
                />
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
