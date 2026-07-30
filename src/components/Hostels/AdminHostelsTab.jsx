import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

import { FiChevronDown, FiChevronRight, FiXCircle, FiEdit2, FiTrash2 } from "react-icons/fi";

import { BiRupee } from "react-icons/bi";
import AdminOrderModal from "../Shared/AdminOrderModal";
import { normalizePropertyName } from "../../utils/orderNormalization";
import { useWindowWidth } from "../../hooks/windowHooks";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";


const DEFAULT_HOSTEL_COLORS = {
  "Aakansha": "#0891B2", 
  "Aaradhana": "#D97706", 
  "Adarsha": "#7C3AED", 
  "Curie": "#4F46E5", 
  "Gurukul": "#06B6D4", 
  "Keerti": "#BE185D", 
  "Meera": "#059669", 
  "Plato": "#F59E0B", 
  "Samriddhi": "#10B981", 
  "Samshrushti": "#4338CA", 
  "Tara": "#DC2626", 
  "Tulsi": "#1976D2",
  "Hostel 99": "#7C3AED", 
  "Hostel 99 no-88": "#059669", 
  "Hostel 99 no-3": "#D97706"
};
const FALLBACK_COLORS = ["#1976D2", "#7C3AED", "#059669", "#D97706", "#0891B2", "#BE185D", "#DC2626", "#4338CA"];
const HIDDEN_HOSTEL_PROPERTIES = new Set(["Unknown Property"]);

function getPropertyColor(name, index) {
  return DEFAULT_HOSTEL_COLORS[name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

const BarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-md shadow-xl rounded-xl p-4 border border-gray-100" style={{ fontFamily: 'DM Sans, sans-serif' }}>
        <p className="text-[#0F172A] font-black text-[11px] uppercase tracking-wider mb-2 border-b border-gray-50 pb-1">{label}</p>
        <div className="space-y-1.5">
          {payload.map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-[12px] font-bold text-slate-500">{p.name}</span>
              </div>
              <span className="text-[12px] font-black text-[#0F172A]">{p.value.toFixed(1)} KG</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

function SummaryCard({ name, color, orders, kg, clothes, students, avgKgPerStudent, revenue }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all group overflow-hidden relative flex flex-col h-full">
      <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: color }} />
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <h3 className="text-[14px] font-black text-[#0F172A] tracking-tight">{name}</h3>
      </div>
      <div className="grid grid-cols-2 gap-y-3 gap-x-1 mt-auto">
        {revenue !== undefined && (
          <div className="col-span-2 pb-3 border-b border-slate-50 mb-1 flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Revenue</p>
            <div className="flex items-center gap-0.5 text-[14px] font-black text-green-600">
              <BiRupee size={14} />
              <span>{revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Orders</p>
          <p className="text-[13.5px] font-black text-slate-700">{orders}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total KG</p>
          <p className="text-[13.5px] font-black text-slate-700">{kg.toFixed(1)}</p>
        </div>
        {clothes !== undefined && (
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Clothes</p>
            <p className="text-[13.5px] font-black text-slate-700">{clothes}</p>
          </div>
        )}
        {students !== undefined && students > 0 && (
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Students</p>
            <p className="text-[13.5px] font-black text-slate-700">{students}</p>
          </div>
        )}
        {avgKgPerStudent !== undefined && avgKgPerStudent > 0 && (
          <div className="col-span-2 pt-2 border-t border-slate-50 mt-1 flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Avg KG/Student</p>
            <p className="text-[13px] font-black text-blue-600">{avgKgPerStudent.toFixed(2)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LinenSummaryCard({ name, color, orders, revenue }) {
  const totals = {};
  orders.forEach(o => {
    if (o.details) {
      Object.entries(o.details).forEach(([k, v]) => {
        const normalizedKey = k === "Bedsheet" ? "Single Bedsheet" : k;
        totals[normalizedKey] = (totals[normalizedKey] || 0) + (v || 0);
      });
    }
  });
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all group overflow-hidden relative flex flex-col h-full">
      <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: color }} />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <h3 className="text-[14px] font-black text-[#0F172A] tracking-tight">{name}</h3>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full uppercase tracking-wider block mb-1">
            {orders.length} {orders.length === 1 ? "pickup" : "pickups"} • {Object.values(totals).reduce((a, b) => a + b, 0)} {Object.values(totals).reduce((a, b) => a + b, 0) === 1 ? "item" : "items"}
          </span>
          {revenue !== undefined && (
            <div className="flex items-center justify-end gap-0.5 text-[13px] font-black text-green-600">
              <BiRupee size={13} />
              <span>{revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-y-3 gap-x-2 mt-auto">
        {Object.entries(totals).filter(([, v]) => v > 0).map(([k, v]) => (
          <div key={k}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 truncate">{k}</p>
            <p className="text-[13px] font-black text-slate-700">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- NEW COMBINED CARD COMPONENT ---
function UnifiedSummaryCard({ name, color, studentOrderCount, linenOrderCount, kg, students, totalLinenItems, revenue }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all group overflow-hidden relative flex flex-col h-full">
      <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: color }} />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <h3 className="text-[14px] font-black text-[#0F172A] tracking-tight truncate">{name}</h3>
        </div>
        <div className="flex items-center gap-0.5 text-[14px] font-black text-green-700 bg-green-50 px-2.5 py-1 rounded-lg border border-green-100">
          <BiRupee size={14} />
          <span>{(revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 flex flex-col justify-end mt-2">
        {studentOrderCount > 0 && (
          <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-100/60">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Student Laundry</span>
              <span className="text-[10px] font-bold text-blue-500 bg-blue-100/50 px-1.5 py-0.5 rounded">{studentOrderCount} {studentOrderCount === 1 ? 'Order' : 'Orders'}</span>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] font-bold text-slate-500 leading-none mb-1">Total Weight</p>
                <p className="text-[13px] font-black text-slate-800 leading-none">{kg.toFixed(1)} KG</p>
              </div>
              {students > 0 && (
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-500 leading-none mb-1">Total Students</p>
                  <p className="text-[13px] font-black text-slate-800 leading-none">{students}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {linenOrderCount > 0 && (
          <div className="bg-purple-50/60 p-3 rounded-lg border border-purple-100/60">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Linen Wash</span>
              <span className="text-[10px] font-bold text-purple-500 bg-purple-100/50 px-1.5 py-0.5 rounded">{linenOrderCount} {linenOrderCount === 1 ? 'Order' : 'Orders'}</span>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] font-bold text-slate-500 leading-none mb-1">Total Items</p>
                <p className="text-[13px] font-black text-slate-800 leading-none">{totalLinenItems} Pcs</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// daysInRange is now an array of full "YYYY-MM-DD" strings
export default function AdminHostelsTab({ orders, daysInRange }) {
  const [view, setView] = useState("student");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [propertyFilter, setPropertyFilter] = useState("All");
  const [chartDateFilter, setChartDateFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const windowWidth = useWindowWidth();

  // Helper to remove undefined fields which Firestore doesn't support
  const cleanObject = (obj) => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach((key) => {
      if (newObj[key] === undefined) delete newObj[key];
    });
    return newObj;
  };

  const handleDeleteOrder = async (order) => {
    if (!order?.id) return;
    if (window.confirm("Are you sure you want to permanently remove this record from Firebase? This action cannot be undone.")) {
      try {
        // 1. Identify Target Collection
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

        // 2. Execute Hard Delete
        await deleteDoc(doc(db, targetCollection, String(order.id)));

        alert("Record physically deleted from Firebase.");
      } catch (error) {
        console.error("Error hard-deleting order:", error);
        alert("Failed to remove record. Please check Firestore permissions.");
      }
    }
  };

  const handleViewChange = (newView) => {
    setView(newView);
    setPropertyFilter("All");
  };

  const visibleOrders = useMemo(
    () => orders
      .map((order) => ({ ...order, property: normalizePropertyName(order.property) }))
      .filter((order) => !HIDDEN_HOSTEL_PROPERTIES.has(order.property)),
    [orders]
  );

  const unknownOrdersCount = useMemo(
    () => orders.filter((order) => normalizePropertyName(order.property) === "Unknown Property").length,
    [orders]
  );

  const studentOrders = useMemo(() => visibleOrders.filter(o => o.type === "student"), [visibleOrders]);
  const linenOrders = useMemo(() => visibleOrders.filter(o => o.type === "linen"), [visibleOrders]);

  const studentProperties = useMemo(() =>
    [...new Set(studentOrders.map(o => o.property).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [studentOrders]
  );
  const linenProperties = useMemo(() =>
    [...new Set(linenOrders.map(o => o.property).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [linenOrders]
  );

  const studentSummaries = useMemo(() =>
    studentProperties.map((name, index) => {
      const ho = studentOrders.filter(o => o.property === name);
      const kg = ho.reduce((s, o) => s + (o.weight || 0), 0);
      const clothes = ho.reduce((s, o) => s + (o.items || 0), 0);
      const students = ho.reduce((s, o) => s + (o.studentCount || 0), 0);
      const revenue = ho.reduce((s, o) => s + (o.amount || 0), 0);
      return {
        name, orders: ho.length, kg, clothes, students, revenue,
        avgKgPerStudent: students > 0 ? kg / students : 0,
        color: getPropertyColor(name, index)
      };
    }).filter(h => h.orders > 0),
    [studentOrders, studentProperties]
  );

  const studentChartData = useMemo(() =>
    daysInRange.map((fullDate, idx) => {
      const dayNum = parseInt(fullDate.split("-")[2], 10);
      const prevDate = daysInRange[idx - 1];
      const isNewMonth = !prevDate || prevDate.slice(0, 7) !== fullDate.slice(0, 7);
      const label = isNewMonth
        ? `${fullDate.slice(5, 7)}/${fullDate.slice(8, 10)}`
        : String(dayNum);

      const row = { day: label, fullDate };
      studentProperties.forEach(h => {
        row[h] = studentOrders
          .filter(o => o.property === h && o.date === fullDate)
          .reduce((s, o) => s + (o.weight || 0), 0);
      });
      return row;
    }),
    [studentOrders, daysInRange, studentProperties]
  );

  const linenSummaries = useMemo(() =>
    linenProperties.map((name, index) => {
      const ho = linenOrders.filter(o => o.property === name);
      const revenue = ho.reduce((s, o) => s + (o.amount || 0), 0);
      return { name, orders: ho, revenue, color: getPropertyColor(name, index) };
    }).filter(h => h.orders.length > 0),
    [linenOrders, linenProperties]
  );

  const unifiedOrders = useMemo(() =>
    [...studentOrders, ...linenOrders].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [studentOrders, linenOrders]
  );

  // --- NEW COMBINED DATA LOGIC FOR 'ALL SECTORS' ---
  const allProperties = useMemo(() =>
    [...new Set([...studentProperties, ...linenProperties])].sort((a, b) => a.localeCompare(b)),
    [studentProperties, linenProperties]
  );

  const unifiedSummaries = useMemo(() =>
    allProperties.map((name, index) => {
      const studentO = studentOrders.filter(o => o.property === name);
      const linenO = linenOrders.filter(o => o.property === name);

      const studentOrderCount = studentO.length;
      const kg = studentO.reduce((s, o) => s + (o.weight || 0), 0);
      const students = studentO.reduce((s, o) => s + (o.studentCount || 0), 0);

      const linenOrderCount = linenO.length;
      let totalLinenItems = 0;
      linenO.forEach(o => {
        if (o.details) {
          Object.values(o.details).forEach(v => totalLinenItems += (v || 0));
        }
      });

      const revenue = [...studentO, ...linenO].reduce((s, o) => s + (o.amount || 0), 0);

      return {
        name,
        studentOrderCount,
        linenOrderCount,
        kg,
        students,
        totalLinenItems,
        revenue,
        color: getPropertyColor(name, index)
      };
    }).filter(h => h.studentOrderCount > 0 || h.linenOrderCount > 0),
    [allProperties, studentOrders, linenOrders]
  );
  // -----------------------------------------------

  return (
    <div className="space-y-6" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {unknownOrdersCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between shadow-sm flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-xs rounded-lg font-black uppercase tracking-wider">Warning</span>
            <span>{unknownOrdersCount} {unknownOrdersCount === 1 ? "order has an" : "orders have an"} "Unknown Property" and {unknownOrdersCount === 1 ? "is" : "are"} currently excluded from hostel metrics.</span>
          </div>
          <button
            onClick={() => setPropertyFilter("Unknown Property")}
            className="px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-black rounded-lg transition-colors cursor-pointer"
          >
            View Unknown Order{unknownOrdersCount > 1 ? "s" : ""}
          </button>
        </div>
      )}
      {/* Toggle */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-xl border border-gray-100 shadow-sm w-fit gap-1 text-[12px] font-bold">
          {[
            { key: "student", label: "Student Laundry" },
            { key: "linen", label: "Linen Hostels" },
            { key: "all", label: "All Sectors" },
          ].map(t => (
            <button key={t.key} onClick={() => handleViewChange(t.key)}
              className={`px-4 py-2 rounded-lg transition-all duration-300 ${view === t.key ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-slate-500 hover:text-slate-900 hover:bg-white/40'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="space-y-4">
        {view === "all" ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-black text-[#0F172A] tracking-tight uppercase tracking-widest">Unified Property Summary</h2>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">Combining {unifiedSummaries.length} {unifiedSummaries.length === 1 ? "Property" : "Properties"}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-stretch">
              {/* NOW MAPPING OVER OUR NEW UNIFIED LIST */}
              {unifiedSummaries.map(s => <UnifiedSummaryCard key={s.name} {...s} />)}
            </div>
          </div>
        ) : view === "student" ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-stretch">
            {studentSummaries.map(s => <SummaryCard key={s.name} {...s} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-stretch">
            {linenSummaries.map(s => <LinenSummaryCard key={s.name} name={s.name} color={s.color} orders={s.orders} revenue={s.revenue} />)}
          </div>
        )}
      </div>

      {/* KG Bar Chart */}
      {(view === "student" || view === "all") && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 overflow-hidden min-w-0">
          <div className="mb-6">
            <h2 className="text-[15px] font-black text-[#0F172A] tracking-tight">Daily KG Distribution</h2>
            <p className="text-[12px] font-medium text-slate-400">Linen weight trends across student properties</p>
          </div>
          <ResponsiveContainer width="100%" height={windowWidth < 640 ? 240 : 300} debounce={100} minWidth={1} minHeight={1}>
            <BarChart
              data={studentChartData}
              margin={{ top: 10, right: 10, left: windowWidth < 640 ? -25 : -10, bottom: 0 }}
              barGap={0}
              onClick={(data, index) => {
                if (data && index !== undefined && studentChartData[index]) {
                  const clicked = studentChartData[index].fullDate;
                  setChartDateFilter(prev => prev === clicked ? null : clicked);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                dy={10}
                interval={windowWidth < 640 ? 2 : 0}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                width={windowWidth < 640 ? 30 : 45}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: '#F8FAFC' }} />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }} />
              {studentSummaries.map(s => (
                <Bar key={s.name} dataKey={s.name} stackId="a" fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={40} animationDuration={1500} className="cursor-pointer" />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Transaction Log */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-black text-[#0F172A] tracking-tight mb-0.5">
              {view === "all" ? "Unified Hostel Transaction Log" : view === "student" ? "Student Laundry Pick-up Log" : "Linen Management Log"}
            </h2>
            <p className="text-[12px] font-medium text-slate-400">
              {view === "all" ? "Combined records for student and linen sectors" : "Individual property transactions"}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search Box */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search student, room, phone, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-bold rounded-lg pl-8 pr-3 py-1.5 outline-none focus:border-blue-500 w-[180px] sm:w-[220px]"
              />
              <span className="absolute left-2.5 top-2 text-slate-400">🔍</span>
            </div>

            {chartDateFilter && (
              <button
                onClick={() => setChartDateFilter(null)}
                className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-[12px] font-bold hover:bg-indigo-100 transition-colors"
              >
                {`${chartDateFilter.slice(5, 7)}/${chartDateFilter.slice(8, 10)}`} <FiXCircle size={14} />
              </button>
            )}
            {view === "all" && (
              <div className="hidden sm:flex gap-2">
                <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded uppercase">Students</span>
                <span className="px-2 py-1 bg-purple-50 text-purple-600 text-[10px] font-black rounded uppercase">Linen</span>
              </div>
            )}
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-bold rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All {view === "all" ? "Properties" : view === "student" ? "Student Hostels" : "Linen Hostels"}</option>
              {unknownOrdersCount > 0 && (
                <option value="Unknown Property">⚠️ Unknown Property ({unknownOrdersCount})</option>
              )}
              {(view === "all" ? [...studentProperties, ...linenProperties] : view === "student" ? studentProperties : linenProperties).map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full min-w-[800px]">
            <thead className="bg-[#F8FAFC] sticky top-0 z-10">
              <tr>
                <th className="text-left text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Date</th>
                <th className="text-left text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Property / Type</th>
                <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Metric / Qty</th>
                <th className="text-center text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Details</th>
                <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Billed Amount</th>
                <th className="text-center text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Action</th>
              </tr>
            </thead>
            <tbody>
              {(propertyFilter === "Unknown Property"
                ? orders.map(o => ({ ...o, property: normalizePropertyName(o.property) })).filter(o => o.property === "Unknown Property")
                : (view === "all" ? unifiedOrders : view === "student" ? studentOrders : linenOrders).filter(o => propertyFilter === "All" || o.property === propertyFilter)
              )
                .filter(o => !chartDateFilter || o.date === chartDateFilter)
                .filter(o => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase().trim();
                  return (
                    (o.customerName && o.customerName.toLowerCase().includes(q)) ||
                    (o.customerNumber && o.customerNumber.toLowerCase().includes(q)) ||
                    (o.property && o.property.toLowerCase().includes(q)) ||
                    (o.service && o.service.toLowerCase().includes(q)) ||
                    (o.id && String(o.id).toLowerCase().includes(q))
                  );
                })
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map(o => (
                  <tr
                    key={o.id}
                    onClick={() => { setSelectedOrder(o); setIsModalOpen(true); }}
                    className="border-b border-gray-50 hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 text-[13px] font-bold text-slate-500">{o.date}</td>
                    <td className="px-6 py-4">
                      <p className="text-[13.5px] font-black text-[#0F172A]">{o.property}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${o.type === 'student' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                          {o.type === 'student' ? 'Student' : 'Linen'}
                        </span>
                        <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">
                          {o.source === "hostels" ? "hostels_orders" : o.source === "b2b" ? "b2b_orders" : o.source === "cartdetails" ? "cartdetails" : o.source === "website" ? "orders" : "b2b_admin_edits"} • ID: {o.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {o.type === 'student' ? (
                        <div>
                          {o.weight > 0 ? (
                            <p className="text-[13.5px] font-black text-slate-800">{o.weight.toFixed(1)} <span className="text-[10px] text-slate-400">kg</span></p>
                          ) : (
                            <p className="text-[13.5px] font-black text-slate-800">{(o.items || o.clothes) || 0} <span className="text-[10px] text-slate-400">pcs</span></p>
                          )}
                          <p className="text-[11px] font-bold text-slate-400">{o.studentCount || 1} {o.studentCount === 1 ? 'student' : 'students'}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[13.5px] font-black text-slate-800">
                            {Object.values(o.details || {}).reduce((s, v) => s + v, 0)} <span className="text-[10px] text-slate-400">pcs</span>
                          </p>
                          <p className="text-[11px] font-bold text-slate-400">Linen pickup</p>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-wrap justify-center gap-2">
                        {o.type === 'student' ? (
                          <span className="text-[11px] font-bold text-slate-500 italic">Wash & Fold/Iron</span>
                        ) : (
                          Object.entries(o.details || {}).filter(([, v]) => v > 0).map(([k, v]) => (
                            <span key={k} className="text-[10px] font-bold bg-[#F1F5F9] text-slate-600 px-2 py-0.5 rounded whitespace-nowrap">
                              {k}: {v}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[13.5px] font-black text-blue-600 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="flex items-center gap-0.5">
                          <BiRupee size={12} className="mb-0.5" />
                          <span>{o.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <FiChevronRight size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors ml-1" />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(o);
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex"
                          title="Edit Order"
                        >
                          <FiEdit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOrder(o);
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                          title="Delete Order"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-50 bg-white border border-gray-100 rounded-xl overflow-hidden mt-4">
          {(propertyFilter === "Unknown Property"
            ? orders.map(o => ({ ...o, property: normalizePropertyName(o.property) })).filter(o => o.property === "Unknown Property")
            : (view === "all" ? unifiedOrders : view === "student" ? studentOrders : linenOrders).filter(o => propertyFilter === "All" || o.property === propertyFilter)
          )
            .filter(o => !chartDateFilter || o.date === chartDateFilter)
            .filter(o => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase().trim();
              return (
                (o.customerName && o.customerName.toLowerCase().includes(q)) ||
                (o.customerNumber && o.customerNumber.toLowerCase().includes(q)) ||
                (o.property && o.property.toLowerCase().includes(q)) ||
                (o.service && o.service.toLowerCase().includes(q)) ||
                (o.id && String(o.id).toLowerCase().includes(q))
              );
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(o => (
              <div
                key={o.id}
                onClick={() => { setSelectedOrder(o); setIsModalOpen(true); }}
                className="p-4 active:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">{o.date}</span>
                    <h4 className="text-[14px] font-black text-[#0F172A]">{o.property}</h4>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${o.type === 'student' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                      {o.type === 'student' ? 'Student' : 'Linen'}
                    </span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                      {o.source === "hostels" ? "hostels_orders" : o.source === "b2b" ? "b2b_orders" : o.source === "cartdetails" ? "cartdetails" : o.source === "website" ? "orders" : "b2b_admin_edits"}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50/50 rounded-lg p-3 border border-slate-100/50 mb-3">
                  {o.type === 'student' ? (
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-500">{o.weight > 0 ? "Pickup Weight" : "Clothes Count"}</span>
                      {o.weight > 0 ? (
                        <p className="text-[13px] font-black text-slate-800">{o.weight.toFixed(1)} <span className="text-[10px] text-slate-400">KG</span></p>
                      ) : (
                        <p className="text-[13px] font-black text-slate-800">{(o.items || o.clothes) || 0} <span className="text-[10px] text-slate-400">Pcs</span></p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-bold text-slate-500">Pick Details</span>
                        <span className="text-[11px] font-black text-slate-800">{Object.values(o.details || {}).reduce((s, v) => s + v, 0)} Items</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(o.details || {}).filter(([, v]) => v > 0).map(([k, v]) => (
                          <span key={k} className="text-[9px] font-bold bg-white text-slate-600 px-2 py-0.5 rounded border border-slate-100">{k}: {v}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-1">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Billed Amount</span>
                    <div className="flex items-center gap-1 text-[14px] font-black text-blue-600">
                      <BiRupee size={12} className="text-blue-400" />
                      <span>{o.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400">
                    <span className="text-[10px] font-bold">View</span>
                    <FiChevronRight size={14} />
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      <AdminOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        order={selectedOrder}
      />
    </div>
  );
}
