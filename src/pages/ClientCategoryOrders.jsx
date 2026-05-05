// src/pages/ClientCategoryOrders.jsx
import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useHostelAuth } from "../context/HostelAuthContext";
import { CATEGORIES } from "../data/hostelOrders";
import ExpandableOrderRow from "../components/ExpandableOrderRow";
import { FiArrowLeft, FiCalendar, FiFilter, FiX, FiDownload, FiPackage, FiShoppingBag, FiTruck, FiUsers } from "react-icons/fi";
import { MdScale } from "react-icons/md";

// CSV export helper
function exportCSV(rows, filename) {
  if (!rows.length) return;
  const headers = ["Order ID", "Date", "Property", "Category", "Clothes", "Weight", "Students", "Status", "Customer", "Phone"];
  const csvRows = [
    headers.join(","),
    ...rows.map((o) =>
      [o.id, o.date, `"${o.property}"`, o.category, o.items ?? "", o.weight ?? "", o.studentCount ?? "", o.status, `"${o.customerName || ""}"`, o.customerNumber || ""].join(",")
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

const CAT_ICONS = {
  LINEN: <FiShoppingBag />, STUDENT_LAUNDRY: <FiPackage />, B2C_RETAIL: <FiShoppingBag />,
  AIRBNB: <FiTruck />, BULK_LAUNDRY: <FiTruck />, ISSUES: <FiFilter />,
};

export default function ClientCategoryOrders() {
  const { categoryKey } = useParams();
  const { client, orders } = useHostelAuth();
  const navigate = useNavigate();

  const isTreeboClient =
    String(client?.name || "").toLowerCase().includes("treebo")
    || (client?.partnernames || client?.properties || []).some((p) => String(p || "").toLowerCase().includes("treebo"));
  const displayClientName = isTreeboClient ? "Treebo Classic Grande Hotel Camp" : client?.name;

  const pageLabelOverride = categoryKey === "AIRBNB" ? "Hotel Service" : null;
  const cat = CATEGORIES[categoryKey] || { label: categoryKey, icon: "📁", color: "#6B7280" };
  const clientProperties = useMemo(() => client?.properties || client?.partnernames || [], [client]);
  const isGroup = client?.isGroup && clientProperties.length > 1;

  const categoryOrders = useMemo(() => orders.filter((o) => o.category === categoryKey), [orders, categoryKey]);

  const [propertyFilter, setPropertyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let list = categoryOrders;
    if (propertyFilter !== "all") list = list.filter((o) => o.property === propertyFilter);
    if (statusFilter !== "all") list = list.filter((o) => o.status === statusFilter);
    if (dateFrom) list = list.filter((o) => o.date >= dateFrom);
    if (dateTo) list = list.filter((o) => o.date <= dateTo);
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [categoryOrders, propertyFilter, statusFilter, dateFrom, dateTo]);

  const totalItems = filtered.reduce((s, o) => s + (o.items || 0), 0);
  const totalWeight = filtered.reduce((s, o) => s + (o.weight || 0), 0);
  const uniqueStatuses = [...new Set(categoryOrders.map((o) => o.status))];
  const uniqueProperties = [...new Set(categoryOrders.map((o) => o.property))];
  const hasActiveFilters = propertyFilter !== "all" || statusFilter !== "all" || dateFrom || dateTo;

  const handleExport = useCallback(() => {
    exportCSV(filtered, `${(cat.label || categoryKey).replace(/\s+/g, "_")}_orders.csv`);
  }, [filtered, cat.label, categoryKey]);

  return (
    <div className="min-h-screen bg-[#F0F7FF]" style={{ fontFamily: "Poppins, sans-serif" }}>
      <nav className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/client/dashboard")} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600">
              <FiArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: cat.color }}>
                {CAT_ICONS[categoryKey] || <FiPackage />}
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{pageLabelOverride || cat.label}</h1>
                <p className="text-xs text-gray-500">{displayClientName} · {filtered.length} orders</p>
              </div>
            </div>
          </div>
          <button onClick={handleExport} className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-dark border border-brand-200 bg-blue-50 px-4 py-2 rounded-xl transition-all hover:bg-blue-100">
            <FiDownload size={15} /> Export CSV
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard label="Orders" value={filtered.length} color={cat.color} Icon={FiPackage} />
          <SummaryCard label={isTreeboClient ? "Pieces" : "Items"} value={totalItems} color="#7C3AED" Icon={FiShoppingBag} />
          <SummaryCard label="Weight" value={`${totalWeight.toFixed(1)} KG`} color="#D97706" Icon={MdScale} />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setShowFilters(!showFilters)} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-brand transition-colors">
              <FiFilter size={16} /> Filters
              {hasActiveFilters && <span className="bg-brand text-white text-xs px-2 py-0.5 rounded-full">Active</span>}
            </button>
            {hasActiveFilters && (
              <button onClick={() => { setPropertyFilter("all"); setStatusFilter("all"); setDateFrom(""); setDateTo(""); }} className="text-xs text-red-500 hover:text-red-700 font-medium inline-flex items-center gap-1">
                <FiX size={12} /> Clear
              </button>
            )}
          </div>

          {showFilters && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {isGroup && uniqueProperties.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Property</label>
                  <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} className="w-full rounded-lg border border-gray-200 text-sm px-3 py-2 focus:outline-none focus:border-brand">
                    <option value="all">All</option>
                    {uniqueProperties.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-lg border border-gray-200 text-sm px-3 py-2 focus:outline-none focus:border-brand">
                  <option value="all">All</option>
                  {uniqueStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">From</label>
                <div className="relative">
                  <FiCalendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-lg border border-gray-200 text-sm pl-9 pr-3 py-2 focus:outline-none focus:border-brand" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
                <div className="relative">
                  <FiCalendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-lg border border-gray-200 text-sm pl-9 pr-3 py-2 focus:outline-none focus:border-brand" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  {isGroup && <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Property</th>}
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
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={isGroup ? 9 : 8} className="text-center py-16 text-gray-400 text-sm">No orders found.</td></tr>
                ) : (
                  filtered.map((o) => <ExpandableOrderRow key={o.id} order={o} showProperty={isGroup} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, color, Icon }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center relative overflow-hidden">
      <div className="absolute top-2 right-2 w-8 h-8 rounded-lg flex items-center justify-center opacity-15" style={{ backgroundColor: color }}>
        <Icon size={18} />
      </div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  );
}

