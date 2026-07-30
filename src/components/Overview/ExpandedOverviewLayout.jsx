import { useState, useMemo, useEffect } from "react";
import {
  FiBox,
  FiTruck,
  FiAlertCircle,
  FiRefreshCw,
  FiTag,
  FiClock,
  FiActivity,
  FiCheckCircle,
  FiDollarSign,
  FiUsers,
  FiPieChart,
  FiTrendingUp,
  FiInbox,
  FiCalendar,
} from "react-icons/fi";
import { BiRupee } from "react-icons/bi";
import { collection, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";

const MONTHLY_CAPACITY_KG = 5980;

function formatKg(value) {
  const rounded = Math.round(Number(value) || 0);
  return rounded.toLocaleString("en-IN");
}

function getServiceMixKey(order) {
  const serviceText = [
    order.service,
    order.serviceBreakdownSummary,
    ...(order.serviceBreakdown || []).map((line) => line.name || line.serviceType),
  ].filter(Boolean).join(" ").toLowerCase();

  if (serviceText.includes("dry clean") || serviceText.includes("dryclean")) return "dryClean";
  if (serviceText.includes("iron")) return "washIron";
  return "washFold";
}

// ═══════════════════════════════════════════════════════════════════
// MOCK DATA: Andes Mandatory Data Analysis
// ═══════════════════════════════════════════════════════════════════
const MOCK_DATA = {
  phase1: {
    b2c: {
      totalOrders: 142,
      totalPickupsCompleted: 138,
      totalKgCollected: 452.5,
      newCustomers: 18,
      assignedRMs: [
        { name: "Aryan", count: 80 },
        { name: "Param", count: 62 },
      ],
      pendingPickups: {
        count: 4,
        reasons: [
          { reason: "Customer not available", count: 2 },
          { reason: "Rider delay", count: 2 },
        ],
      },
      pendingDeliveries: {
        count: 6,
        reasons: [
          { reason: "Processing delay", count: 3 },
          { reason: "Customer issue", count: 3 },
        ],
      },
      issuesRaised: {
        total: 5,
        breakdown: [
          { type: "Delay complaints", count: 3 },
          { type: "Stain not removed", count: 2 },
        ],
      },
      rewashTracking: { kg: 12.5, cost: 450, topReason: "Stain not removed" },
      discountTracking: { amount: 1250, pct: 5.3, topReason: "Apology for delay" },
    },
    b2b: {
      totalActiveStudents: 850,
      hostelBreakdown: [
        { name: "Aakansha", students: 300, kg: 450, issues: 2 },
        { name: "Tulsi", students: 250, kg: 380, issues: 0 },
        { name: "Adarsha", students: 300, kg: 420, issues: 1 },
      ],
      totalKgReceived: 1250,
      todayPickups: { hostelsServiced: 3, names: ["Aakansha", "Tulsi", "Adarsha"] },
      todayDeliveries: { hostelsDelivered: 2, names: ["Aakansha", "Tulsi"] },
      b2bToB2c: [
        { customer: "Rahul (Tulsi)", shifted: true, details: "First order via app, RM: Aryan" },
      ],
      top3Contribution: [
        { name: "Aakansha", pct: 40 },
        { name: "Adarsha", pct: 35 },
        { name: "Tulsi", pct: 25 },
      ],
    },
  },
  phase2: {
    zones: [
      { id: "pickup", name: "Pickup & Delivery", subtitle: "Pickup to Store", color: "bg-emerald-500", lightColor: "bg-emerald-50", textCol: "text-emerald-700", duration: "45m", pct: 15 },
      { id: "intake", name: "Intake & Sorting", subtitle: "Tagging/Intake", color: "bg-orange-500", lightColor: "bg-orange-50", textCol: "text-orange-700", duration: "30m", pct: 10 },
      { id: "wash", name: "Washing Process", subtitle: "Wash, Stain, Dry", color: "bg-red-500", lightColor: "bg-red-50", textCol: "text-red-700", duration: "2h 15m", pct: 45, sub: "Stain: 15m | Wash: 45m | Dry: 1h 15m" },
      { id: "iron", name: "Ironing", subtitle: "Iron start to end", color: "bg-yellow-400", lightColor: "bg-yellow-50", textCol: "text-yellow-700", duration: "45m", pct: 15 },
      { id: "pack", name: "Packing", subtitle: "Sorting & Pack", color: "bg-orange-500", lightColor: "bg-orange-50", textCol: "text-orange-700", duration: "15m", pct: 5 },
      { id: "deliver", name: "Store to Customer", subtitle: "Dispatch to Delivery", color: "bg-emerald-500", lightColor: "bg-emerald-50", textCol: "text-emerald-700", duration: "30m", pct: 10 },
    ],
    tat: "5h 0m",
    bottleneck: "Washing Process (Dryer limit)",
    delayedZone: "Store to Customer (Rider shortage)",
  },
  phase3: {
    capacity: {
      processedKg: 1702.5,
      totalOrders: 156,
      utilizationPct: 85,
      idleKg: 300,
      fullCapacity: 2002.5,
      serviceMix: { washFold: 40, washIron: 50, dryClean: 10 },
      avgKgPerOrder: 10.9,
    },
    efficiency: {
      onTimePickup: 95.5,
      onTimeDelivery: 92.0,
      avgTatHours: 5.2,
    },
    quality: {
      issueRate: 2.1,
      missingItem: 0.1,
      damage: 0.2,
      stainIssue: 1.8,
      zeroComplaintOrders: 97.9,
      repeat7Days: 45,
      cancellationRate: 1.2,
    },
  },
  phase4: {
    business: {
      totalRevenue: 68500,
      b2bRevenue: 45000,
      b2cRevenue: 23500,
      totalExpenses: 18200,
      activeCustomers: 420,
      repeatPct: 68,
      newVsRepeat: { new: 32, repeat: 68 },
    },
    cashFlow: {
      collectedToday: 62000,
      pendingB2b: 4500,
      pendingB2c: 2000,
      collectionEfficiency: 90.5,
    },
  },
};

// ═══════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function SectionHeader({ title, subtitle, phase, color, badge }) {
  return (
    <div className="flex items-center justify-between mb-6 pb-5 border-b border-slate-100">
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-md"
          style={{ backgroundColor: color, boxShadow: `0 4px 14px ${color}40` }}
        >
          P{phase}
        </div>
        <div>
          <h2 className="text-[18px] font-black text-[#0F172A] tracking-tight">{title}</h2>
          <p className="text-[12px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {badge && (
        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[11px] font-black uppercase tracking-wider">
          ⚠ {badge}
        </span>
      )}
    </div>
  );
}

function StatCard({ label, value, subValue, icon: Icon, colorClass, highlight }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex justify-between items-start mb-3">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-snug w-2/3">{label}</span>
        {Icon && <Icon size={16} className={colorClass} />}
      </div>
      <div>
        <p className={`text-[22px] font-black leading-none ${highlight ? colorClass : "text-slate-800"}`}>{value}</p>
        {subValue && <p className="text-[11px] font-bold text-slate-500 mt-1.5">{subValue}</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN LAYOUT
// ═══════════════════════════════════════════════════════════════════

export default function ExpandedOverviewLayout({ orders = [] }) {
  const d = MOCK_DATA;
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (orders && orders.length > 0) {
      setIsLoading(false);
    } else {
      const timer = setTimeout(() => setIsLoading(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [orders]);

  // ── Real-time B2B Stats from live orders ─────────────────────────
  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString().split("T")[0];

  const liveB2b = useMemo(() => {
    const b2bOrders = orders.filter(o =>
      (o.type === "student" || o.type === "linen" || o.type === "airbnb" || o.source === "b2b") &&
      o.status !== "Cancelled" && o.status !== "Abandoned" && o.type !== "abandoned"
    );
    const totalActiveStudents = b2bOrders.reduce((s, o) => s + (o.studentCount || 0), 0);
    const totalKgReceived = b2bOrders.reduce((s, o) => s + (o.weight || 0), 0);
    const totalItemsReceived = b2bOrders.reduce((s, o) => s + (o.items || 0), 0);
    const totalOrders = b2bOrders.length;

    // Per-property breakdown
    const b2bMap = {};
    b2bOrders.forEach(o => {
      const name = o.property || o.tenant || o.partnerName || "Unknown";
      if (!b2bMap[name]) {
        b2bMap[name] = {
          name,
          students: 0,
          kg: 0,
          items: 0,
          issues: 0,
          orders: 0,
          revenue: 0,
          firstOrder: null,
          type: o.type,
        };
      }
      b2bMap[name].students += o.studentCount || 0;
      b2bMap[name].kg += o.weight || 0;
      b2bMap[name].items += o.items || 0;
      b2bMap[name].orders += 1;
      b2bMap[name].revenue += o.amount || 0;

      if (!b2bMap[name].firstOrder || o.date < b2bMap[name].firstOrder.date) {
        b2bMap[name].firstOrder = {
          date: o.date,
          customerName: o.customerName || o.property || name,
          riderId: o.riderId || "—",
        };
      }
    });

    // Count issues per property
    orders.filter(o => o.type === "issue" || o.category === "ISSUES").forEach(o => {
      const name = o.property || o.linkedHostel || "Unknown";
      if (b2bMap[name]) b2bMap[name].issues += 1;
    });

    const b2bBreakdown = Object.values(b2bMap)
      .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);

    const isLinenOrHotel = (type, name) => {
      const n = (name || "").toLowerCase();
      return type === "airbnb" || type === "linen" || n.includes("hostel99") || n.includes("hostel 99") || n.includes("treebo") || n.includes("hotel");
    };

    const hostelBulkBreakdown = b2bBreakdown.filter(h => !isLinenOrHotel(h.type, h.name));
    const hotelLinenBreakdown = b2bBreakdown.filter(h => isLinenOrHotel(h.type, h.name));

    // Top 3 contribution (by KG for bulk hostels only)
    const totalHostelKg = hostelBulkBreakdown.reduce((sum, h) => sum + (h.kg || 0), 0);
    const top3 = [...hostelBulkBreakdown]
      .sort((a, b) => b.kg - a.kg)
      .slice(0, 3)
      .map(h => ({
        name: h.name,
        kg: h.kg,
        pct: totalHostelKg > 0 ? ((h.kg / totalHostelKg) * 100).toFixed(1) : "0",
      }));

    // Today's activity
    const todayB2bOrders = b2bOrders.filter(o => o.date === todayStr);
    const todayB2bNames = [...new Set(todayB2bOrders.map(o => o.property || o.tenant || o.partnerName).filter(Boolean))];

    // Today's deliveries
    const todayDeliveryOrders = b2bOrders.filter(o => {
      const updatedDate = o.updatedAtRaw?.toDate
        ? o.updatedAtRaw.toDate().toISOString().split("T")[0]
        : typeof o.updatedAtRaw === "string" ? o.updatedAtRaw.split("T")[0] : null;
      return o.status === "Delivered" && (updatedDate === todayStr || o.date === todayStr);
    });
    const todayDeliveryNames = [...new Set(todayDeliveryOrders.map(o => o.property || o.tenant || o.partnerName).filter(Boolean))];

    return {
      totalActiveStudents,
      totalKgReceived,
      totalItemsReceived,
      totalOrders,
      b2bBreakdown,
      hostelBulkBreakdown,
      hotelLinenBreakdown,
      top3,
      todayPickups: { count: todayB2bNames.length, names: todayB2bNames },
      todayDeliveries: { count: todayDeliveryNames.length, names: todayDeliveryNames },
      hasData: b2bOrders.length > 0,
    };
  }, [orders, todayStr]);

  // ── Real-time B2C Stats from cartdetails + website orders ─────────
  const liveB2c = useMemo(() => {
    const b2cOrders = orders.filter(o =>
      (o.type === "regular" || o.source === "cartdetails" || o.source === "website") &&
      o.status !== "Cancelled" && o.status !== "Abandoned" && o.type !== "abandoned" && o.type !== "rider_tracking"
    );

    const totalOrders = b2cOrders.length;
    const completedPickups = b2cOrders.filter(o =>
      o.status === "Processing" || o.status === "Delivered" || o.status === "Picked Up"
    ).length;
    const totalKg = b2cOrders.reduce((s, o) => s + (o.weight || 0), 0);

    // New customers: unique customerNumber or customerName seen only once (first order)
    const customerCounts = {};
    b2cOrders.forEach(o => {
      const key = o.customerNumber || o.customerName || o.id;
      if (!customerCounts[key]) customerCounts[key] = { orders: 0, firstDate: o.date, name: o.customerName || "Unknown", channel: o.channel || "App" };
      customerCounts[key].orders += 1;
    });
    const newCustomers = Object.values(customerCounts).filter(c => c.orders === 1);

    // Pending Pickups (status = Pending)
    const pendingPickupOrders = b2cOrders.filter(o => o.status === "Pending");
    const pendingPickupReasons = {};
    pendingPickupOrders.forEach(o => {
      const reason = o.cancelReason || o.cancellationReason || "Pending";
      const key = reason.toLowerCase().includes("not attend") || reason.toLowerCase().includes("not available")
        ? "Customer not available"
        : reason.toLowerCase().includes("rider")
          ? "Rider delay"
          : reason.toLowerCase().includes("tech")
            ? "Tech issue"
            : "Other";
      pendingPickupReasons[key] = (pendingPickupReasons[key] || 0) + 1;
    });

    // Pending Deliveries (status = Processing)
    const pendingDeliveryOrders = b2cOrders.filter(o => o.status === "Processing");
    const pendingDeliveryReasons = {};
    pendingDeliveryOrders.forEach(o => {
      const reason = o.cancelReason || "Processing delay";
      const key = reason.toLowerCase().includes("rider")
        ? "Rider delay"
        : reason.toLowerCase().includes("customer")
          ? "Customer issue"
          : "Processing delay";
      pendingDeliveryReasons[key] = (pendingDeliveryReasons[key] || 0) + 1;
    });

    // Issues breakdown — all issues from b2b_admin_edits (source="admin", category="ISSUES")
    const issueOrders = orders.filter(o => o.type === "issue" || o.category === "ISSUES");
    const issueCounts = {
      "Missing items": 0,
      "Damaged clothes": 0,
      "Stain not removed": 0,
      "Delay complaints": 0,
      "Other": 0,
    };
    issueOrders.forEach(o => {
      // Prefer the structured issueType field (direct from Firestore), then fall back to text scan
      const issueType = (o.issueType || "").toLowerCase();
      const t = (o.service || o.details || "").toString().toLowerCase();
      if (issueType.includes("missing") || t.includes("missing")) issueCounts["Missing items"]++;
      else if (issueType.includes("damage") || issueType.includes("torn") || t.includes("damage") || t.includes("torn")) issueCounts["Damaged clothes"]++;
      else if (issueType.includes("stain") || t.includes("stain")) issueCounts["Stain not removed"]++;
      else if (issueType.includes("delay") || t.includes("delay")) issueCounts["Delay complaints"]++;
      else issueCounts["Other"]++;
    });
    const issueBreakdown = Object.entries(issueCounts)
      .filter(([, v]) => v > 0)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    // Recent new customers (for display)
    const recentNew = newCustomers
      .sort((a, b) => (b.firstDate > a.firstDate ? 1 : -1))
      .slice(0, 4);

    return {
      totalOrders,
      completedPickups,
      totalKg,
      newCustomerCount: newCustomers.length,
      recentNew,
      pendingPickups: {
        count: pendingPickupOrders.length,
        reasons: Object.entries(pendingPickupReasons).map(([reason, count]) => ({ reason, count })),
      },
      pendingDeliveries: {
        count: pendingDeliveryOrders.length,
        reasons: Object.entries(pendingDeliveryReasons).map(([reason, count]) => ({ reason, count })),
      },
      issueBreakdown,
      totalIssues: issueOrders.length,
      hasData: b2cOrders.length > 0,
    };
  }, [orders]);

  const livePhase3 = useMemo(() => {
    const monthStart = `${todayStr.slice(0, 7)}-01`;
    const capacityOrders = orders.filter((order) =>
      order.category !== "ISSUES"
      && order.type !== "issue"
      && order.status !== "Cancelled"
      && order.status !== "Abandoned"
      && order.type !== "abandoned"
      && order.date >= monthStart
      && order.date <= todayStr
    );

    const processedKg = capacityOrders.reduce((sum, order) => sum + (Number(order.weight) || 0), 0);
    const totalOrders = capacityOrders.length;
    const remainingKg = Math.max(0, MONTHLY_CAPACITY_KG - processedKg);
    const utilizationPct = Math.round((processedKg / MONTHLY_CAPACITY_KG) * 1000) / 10;
    const avgKgPerOrder = totalOrders > 0 ? processedKg / totalOrders : 0;
    const mixTotals = { washFold: 0, washIron: 0, dryClean: 0 };
    capacityOrders.forEach((order) => {
      if (order.serviceBreakdown && Array.isArray(order.serviceBreakdown) && order.serviceBreakdown.length > 0) {
        order.serviceBreakdown.forEach((line) => {
          const wt = Number(line.weight) || 0;
          const text = (line.name || line.serviceType || "").toLowerCase();
          if (text.includes("dry clean") || text.includes("dryclean")) mixTotals.dryClean += wt;
          else if (text.includes("iron")) mixTotals.washIron += wt;
          else mixTotals.washFold += wt;
        });
      } else {
        const wt = Number(order.weight) || 0;
        const key = getServiceMixKey(order);
        mixTotals[key] += wt;
      }
    });
    const mixKg = Object.values(mixTotals).reduce((sum, value) => sum + value, 0);
    const serviceMix = Object.fromEntries(
      Object.entries(mixTotals).map(([key, value]) => [key, mixKg > 0 ? Math.round((value / mixKg) * 100) : 0])
    );

    return {
      avgKgPerOrder,
      fullCapacity: MONTHLY_CAPACITY_KG,
      processedKg,
      remainingKg,
      serviceMix,
      totalOrders,
      utilizationPct,
    };
  }, [orders, todayStr]);

  // ── Expenses listener (b2b_expenses) ──────────────────────────
  const [totalExpenses, setTotalExpenses] = useState(0);
  useEffect(() => {
    let unsubSnap = () => { };
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubSnap();
      if (!user) return;
      unsubSnap = onSnapshot(
        collection(db, "b2b_expenses"),
        (snap) => {
          const total = snap.docs.reduce((s, d) => {
            const data = d.data();
            if (data.transactionType === "credit") return s;
            return s + (data.amount || 0);
          }, 0);
          setTotalExpenses(total);
        },
        (err) => {
          console.error("b2b_expenses sync error in overview:", err);
          setTotalExpenses(0);
        }
      );
    });
    return () => { unsubAuth(); unsubSnap(); };
  }, []);

  // ── Phase 4: Live Revenue + Retention ────────────────────────
  const liveP4 = useMemo(() => {
    const nonIssueOrders = orders.filter(
      o => o.type !== "issue" && o.category !== "ISSUES" && o.status !== "Cancelled" && o.status !== "Abandoned" && o.type !== "abandoned"
    );

    // Revenue split
    const b2bOrders = nonIssueOrders.filter(o => o.type === "student" || o.source === "b2b");
    const b2cOrders = nonIssueOrders.filter(o => o.type === "regular" || o.source === "cartdetails" || o.source === "website");
    const totalRevenue = nonIssueOrders.reduce((s, o) => s + (o.amount || 0), 0);
    const b2bRevenue = b2bOrders.reduce((s, o) => s + (o.amount || 0), 0);
    const b2cRevenue = b2cOrders.reduce((s, o) => s + (o.amount || 0), 0);

    // Customers & Retention
    const customerMap = {};
    nonIssueOrders.forEach(o => {
      const key = o.customerNumber || o.customerName || o.id;
      if (!key) return;
      customerMap[key] = (customerMap[key] || 0) + 1;
    });
    const totalCustomers = Object.keys(customerMap).length;
    const repeatCount = Object.values(customerMap).filter(c => c >= 2).length;
    const repeatPct = totalCustomers > 0 ? Math.round((repeatCount / totalCustomers) * 100) : 0;
    const newPct = 100 - repeatPct;

    return {
      totalRevenue,
      b2bRevenue,
      b2cRevenue,
      totalCustomers,
      repeatCount,
      repeatPct,
      newPct,
    };
  }, [orders]);

  if (isLoading) {
    return (
      <div className="space-y-12 pb-12 tabular-nums animate-pulse" style={{ fontFamily: "DM Sans, sans-serif" }}>
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-100/80 border border-slate-200"></div>
            <div>
              <div className="h-4 w-32 bg-slate-100/80 rounded mb-2"></div>
              <div className="h-3 w-48 bg-slate-50 rounded"></div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-100 h-96 shadow-sm"></div>
            <div className="bg-white rounded-2xl border border-slate-100 h-96 shadow-sm"></div>
          </div>
        </section>
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-100/80 border border-slate-200"></div>
            <div>
              <div className="h-4 w-32 bg-slate-100/80 rounded mb-2"></div>
              <div className="h-3 w-48 bg-slate-50 rounded"></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 h-48 shadow-sm"></div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-12 tabular-nums" style={{ fontFamily: "DM Sans, sans-serif" }}>
      {/* ─────────────────────────────────────────────────────────────
          PHASE 1: DEMAND / INPUT
          ───────────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader phase="1" title="Demand & Input" subtitle="What work is coming in" color="#3B82F6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* B2C PANEL — LIVE DATA */}
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-100 px-5 py-4 flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 to-cyan-400"></div>
              <div>
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                  B2C (App / Direct Customers)
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{liveB2c.totalOrders} orders · All time</p>
              </div>
              <span className="text-[11px] font-bold text-cyan-600 bg-cyan-50 border border-cyan-100 px-2 py-0.5 rounded-md">Live</span>
            </div>

            <div className="p-5 space-y-5">
              {/* KPI Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 text-center">
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Orders</p>
                  <p className="text-[22px] font-black text-blue-700 leading-none">{liveB2c.totalOrders}</p>
                </div>
                <div className="bg-cyan-50 rounded-xl p-3 border border-cyan-100 text-center">
                  <p className="text-[9px] font-black text-cyan-500 uppercase tracking-widest mb-1">Pickups Done</p>
                  <p className="text-[22px] font-black text-cyan-700 leading-none">{liveB2c.completedPickups}</p>
                </div>
                <div className="bg-sky-50 rounded-xl p-3 border border-sky-100 text-center">
                  <p className="text-[9px] font-black text-sky-500 uppercase tracking-widest mb-1">KG Collected</p>
                  <p className="text-[22px] font-black text-sky-700 leading-none">{liveB2c.totalKg > 0 ? liveB2c.totalKg.toFixed(1) : "—"}</p>
                </div>
                <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100 text-center">
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">New Cust.</p>
                  <p className="text-[22px] font-black text-indigo-700 leading-none">{liveB2c.newCustomerCount}</p>
                </div>
              </div>



              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pending Pickups */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Pending Pickups</span>
                    <span className="text-[16px] font-black text-red-500">{liveB2c.pendingPickups.count}</span>
                  </div>
                  {liveB2c.pendingPickups.reasons.length > 0 ? (
                    <ul className="space-y-1.5">
                      {liveB2c.pendingPickups.reasons.map((r, i) => (
                        <li key={i} className="flex justify-between text-[11px] font-bold text-slate-500">
                          <span>{r.reason}</span>
                          <span className="bg-white border border-slate-200 px-1.5 rounded font-black text-slate-700">{r.count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="py-4 flex flex-col items-center justify-center text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 mt-2">
                      <FiCheckCircle size={18} className="text-emerald-400 mb-1.5" />
                      <p className="text-[11px] text-slate-500 font-bold">No pending pickups</p>
                    </div>
                  )}
                </div>

                {/* Pending Deliveries */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Pending Deliveries</span>
                    <span className="text-[16px] font-black text-orange-500">{liveB2c.pendingDeliveries.count}</span>
                  </div>
                  {liveB2c.pendingDeliveries.reasons.length > 0 ? (
                    <ul className="space-y-1.5">
                      {liveB2c.pendingDeliveries.reasons.map((r, i) => (
                        <li key={i} className="flex justify-between text-[11px] font-bold text-slate-500">
                          <span>{r.reason}</span>
                          <span className="bg-white border border-slate-200 px-1.5 rounded font-black text-slate-700">{r.count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="py-4 flex flex-col items-center justify-center text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 mt-2">
                      <FiCheckCircle size={18} className="text-emerald-400 mb-1.5" />
                      <p className="text-[11px] text-slate-500 font-bold">No pending deliveries</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Issues Raised */}
              <div className={liveB2c.totalIssues > 0 ? "bg-red-50/60 rounded-xl border border-red-100 p-4" : "bg-emerald-50/60 rounded-xl border border-emerald-100 p-4"}>
                <div className="flex justify-between items-center mb-3">
                  <span className={liveB2c.totalIssues > 0 ? "text-[11px] font-black text-red-800 uppercase tracking-widest" : "text-[11px] font-black text-emerald-800 uppercase tracking-widest"}>Issues Raised</span>
                  <span className={liveB2c.totalIssues > 0 ? "text-[16px] font-black text-red-600" : "text-[16px] font-black text-emerald-600"}>{liveB2c.totalIssues}</span>
                </div>
                {liveB2c.issueBreakdown.length > 0 ? (
                  <ul className="space-y-1.5">
                    {liveB2c.issueBreakdown.map((r, i) => {
                      const dotColors = ["bg-red-500", "bg-orange-400", "bg-amber-400", "bg-yellow-400"];
                      return (
                        <li key={i} className="flex justify-between text-[11px] font-bold text-red-700/80 items-center">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${dotColors[i] || "bg-red-300"}`} />
                            {r.type}
                          </span>
                          <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black">{r.count}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="py-4 flex flex-col items-center justify-center text-center bg-emerald-50/50 rounded-xl border border-dashed border-emerald-200 mt-2">
                    <FiCheckCircle size={18} className="text-emerald-500 mb-1.5" />
                    <p className="text-[11px] text-emerald-600 font-bold">All clear. No issues raised.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* B2B PANEL — LIVE DATA */}
          <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-slate-100 px-5 py-4 flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-purple-500 to-indigo-500"></div>
              <div>
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  B2B (Hostels / Hotels )
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{liveB2b.totalOrders} pickups · All time</p>
              </div>
              <span className="text-[11px] font-bold text-purple-600 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md">Live</span>
            </div>

            <div className="p-5 flex-1 flex flex-col gap-5">

              {/* KPI Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-purple-50 rounded-xl p-3 border border-purple-100 text-center">
                  <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1">Total Students</p>
                  <p className="text-[22px] font-black text-purple-700 leading-none">{liveB2b.totalActiveStudents || "—"}</p>
                </div>
                <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100 text-center">
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Total KG / Items</p>
                  <p className="text-[22px] font-black text-indigo-700 leading-none">
                    {liveB2b.totalKgReceived > 0 ? liveB2b.totalKgReceived.toFixed(1) : liveB2b.totalItemsReceived > 0 ? liveB2b.totalItemsReceived : "—"}
                  </p>
                </div>
                <div className="bg-violet-50 rounded-xl p-3 border border-violet-100 text-center">
                  <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest mb-1">Properties</p>
                  <p className="text-[22px] font-black text-violet-700 leading-none">{liveB2b.b2bBreakdown.length}</p>
                </div>
              </div>

              {/* Top 3 Contribution */}
              {liveB2b.top3.length > 0 && liveB2b.totalKgReceived > 0 && (
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Top 3 Hostel Contribution (by KG)</p>
                  <div className="space-y-2.5">
                    {liveB2b.top3.map((h, i) => {
                      const colors = ["bg-purple-500", "bg-indigo-500", "bg-violet-400"];
                      const textColors = ["text-purple-700", "text-indigo-700", "text-violet-600"];
                      return (
                        <div key={h.name}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${colors[i]}`} />
                              {h.name}
                            </span>
                            <span className={`text-[11px] font-black ${textColors[i]}`}>{h.pct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${colors[i]}`} style={{ width: `${h.pct}%`, transition: "width 0.8s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Today's Pickups & Deliveries */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Today's Pickups</p>
                  <p className="text-[20px] font-black text-emerald-700 leading-none">{liveB2b.todayPickups.count}</p>
                  <p className="text-[10px] font-bold text-emerald-500 mt-0.5">Hostels</p>
                  <p className="text-[9px] font-bold text-emerald-600/70 mt-1 leading-snug">
                    {liveB2b.todayPickups.names.join(", ") || "None today"}
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Today's Deliveries</p>
                  <p className="text-[20px] font-black text-blue-700 leading-none">{liveB2b.todayDeliveries.count}</p>
                  <p className="text-[10px] font-bold text-blue-500 mt-0.5">Hostels</p>
                  <p className="text-[9px] font-bold text-blue-600/70 mt-1 leading-snug">
                    {liveB2b.todayDeliveries.names.join(", ") || "None today"}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          PHASE 2: PROCESS / ZONE TIME TRACKING
          ───────────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader phase="2" title="Process & Zone Tracking" subtitle="How each order moves inside system" color="#8B5CF6" badge="Sample Data" />
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-8">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Turnaround Time (TAT)</p>
              <p className="text-[32px] font-black text-slate-800 leading-none">{d.phase2.tat}</p>
            </div>
            <div className="flex gap-4">
              <div className="bg-red-50 border border-red-100 px-4 py-2 rounded-xl flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <div>
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-0.5">Bottleneck</p>
                  <p className="text-[12px] font-bold text-red-900">{d.phase2.bottleneck}</p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-0.5">Delayed Zone</p>
                <p className="text-[12px] font-bold text-amber-900">{d.phase2.delayedZone}</p>
              </div>
            </div>
          </div>

          {/* Timeline Bar */}
          <div className="h-8 flex gap-1 mb-4">
            {d.phase2.zones.map((z, i) => (
              <div key={i} className={`h-full ${z.color} rounded-md flex items-center justify-center relative overflow-hidden shadow-sm`} style={{ width: `${z.pct}%` }}>
                {z.pct > 10 && <span className="text-[10px] font-black text-white/90">{z.pct}%</span>}
              </div>
            ))}
          </div>

          {/* Zone Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {d.phase2.zones.map((z, i) => (
              <div key={i} className={`${z.lightColor} border border-slate-100/80 border-t-4 border-t-${z.color.replace('bg-', '')} rounded-xl p-3 shadow-xs transition-all hover:-translate-y-0.5`}>
                <div className={`w-3 h-3 rounded-full ${z.color} mb-2 shadow-sm`} />
                <p className={`text-[10px] font-black uppercase tracking-wider mb-0.5 ${z.textCol}`}>{z.name}</p>
                <p className="text-[9px] font-bold text-slate-500 mb-2 truncate">{z.subtitle}</p>
                <p className={`text-[16px] font-black leading-none ${z.textCol}`}>{z.duration}</p>
                {z.sub && <p className="text-[8px] font-bold text-slate-400 mt-2 leading-tight">{z.sub}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          PHASE 3: OPERATIONS / CONTROL
          ───────────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader phase="3" title="Operations & Control" subtitle="How well operations are running" color="#F59E0B" badge="Sample Data" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Capacity */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2"><FiActivity /> Processing & Capacity</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                  <span>Current Occupied</span>
                  <span className="text-slate-800">{formatKg(livePhase3.processedKg)} / {formatKg(livePhase3.fullCapacity)} kg</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, livePhase3.utilizationPct)}%`,
                      background: livePhase3.utilizationPct >= 90
                        ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                        : livePhase3.utilizationPct >= 70
                        ? "linear-gradient(90deg, #10b981, #f59e0b)"
                        : "linear-gradient(90deg, #3b82f6, #10b981)",
                      transition: "width 0.9s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  />
                </div>
                <p className={`text-[10px] font-black mt-1.5 text-right ${
                  livePhase3.utilizationPct >= 90 ? "text-red-500" :
                  livePhase3.utilizationPct >= 70 ? "text-amber-600" : "text-emerald-600"
                }`}>{livePhase3.utilizationPct.toFixed(1)}% Utilized · {formatKg(livePhase3.remainingKg)} kg Remaining</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <StatCard label="Total Orders" value={livePhase3.totalOrders} />
                <StatCard label="Avg Kg/Order" value={livePhase3.avgKgPerOrder.toFixed(1)} />
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Service Mix</p>
                <div className="flex h-3 rounded-full overflow-hidden mb-2">
                  <div className="bg-blue-500" style={{ width: `${livePhase3.serviceMix.washFold}%` }} />
                  <div className="bg-purple-500" style={{ width: `${livePhase3.serviceMix.washIron}%` }} />
                  <div className="bg-emerald-500" style={{ width: `${livePhase3.serviceMix.dryClean}%` }} />
                </div>
                <div className="flex justify-between text-[9px] font-bold text-slate-500">
                  <span className="text-blue-600">W&F {livePhase3.serviceMix.washFold}%</span>
                  <span className="text-purple-600">W&I {livePhase3.serviceMix.washIron}%</span>
                  <span className="text-emerald-600">DC {livePhase3.serviceMix.dryClean}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Time & Efficiency */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2"><FiClock /> Time & Efficiency</h3>
              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9px] font-black uppercase tracking-wider">Sample</span>
            </div>
            <div className="space-y-4">
              <StatCard label="On-time Pickup" value={`${d.phase3.efficiency.onTimePickup}%`} colorClass="text-emerald-500" highlight />
              <StatCard label="On-time Delivery" value={`${d.phase3.efficiency.onTimeDelivery}%`} colorClass="text-emerald-500" highlight />
              <StatCard label="Average TAT" value={`${d.phase3.efficiency.avgTatHours} hours`} colorClass="text-blue-500" highlight />
            </div>
          </div>

          {/* Quality Control */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2"><FiCheckCircle /> Quality Control</h3>
              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9px] font-black uppercase tracking-wider">Sample</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatCard label="Issue Rate" value={`${d.phase3.quality.issueRate}%`} colorClass="text-red-500" highlight />
              <StatCard label="Zero Complaints" value={`${d.phase3.quality.zeroComplaintOrders}%`} colorClass="text-emerald-500" highlight />
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <ul className="space-y-2.5">
                <li className="flex justify-between text-[11px] font-bold text-slate-600">
                  <span>Missing Item</span>
                  <span className="text-slate-800">{d.phase3.quality.missingItem}%</span>
                </li>
                <li className="flex justify-between text-[11px] font-bold text-slate-600">
                  <span>Damage</span>
                  <span className="text-slate-800">{d.phase3.quality.damage}%</span>
                </li>
                <li className="flex justify-between text-[11px] font-bold text-slate-600">
                  <span>Stain Issue</span>
                  <span className="text-slate-800">{d.phase3.quality.stainIssue}%</span>
                </li>
                <li className="flex justify-between text-[11px] font-bold text-slate-600 pt-2 border-t border-slate-200">
                  <span>Repeat within 7 days</span>
                  <span className="text-slate-800">{d.phase3.quality.repeat7Days}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* PHASE 4: BUSINESS / OUTPUT - LIVE */}
      <section>
        <SectionHeader phase="4" title="Business &amp; Output" subtitle="What you earned and collected" color="#10B981" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Revenue + Expenses - LIVE */}
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
            <div className="bg-white border-b border-slate-100 px-5 py-4 flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 to-teal-400"></div>
              <div>
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Revenue &amp; Costs
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">All time · from live orders</p>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">Live</span>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Revenue</p>
                <p className="text-[34px] font-black text-[#0F172A] leading-none">
                  ₹{liveP4.totalRevenue > 0 ? liveP4.totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "0"}
                </p>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 bg-purple-50 border border-purple-100 rounded-xl p-3">
                  <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1">B2B Revenue</p>
                  <p className="text-[18px] font-black text-purple-700">₹{liveP4.b2bRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
                  {liveP4.totalRevenue > 0 && (
                    <p className="text-[9px] font-bold text-purple-400 mt-0.5">{((liveP4.b2bRevenue / liveP4.totalRevenue) * 100).toFixed(1)}% of total</p>
                  )}
                </div>
                <div className="flex-1 bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">B2C Revenue</p>
                  <p className="text-[18px] font-black text-blue-700">₹{liveP4.b2cRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
                  {liveP4.totalRevenue > 0 && (
                    <p className="text-[9px] font-bold text-blue-400 mt-0.5">{((liveP4.b2cRevenue / liveP4.totalRevenue) * 100).toFixed(1)}% of total</p>
                  )}
                </div>
              </div>
              {liveP4.totalRevenue > 0 && (
                <div className="h-2 rounded-full overflow-hidden bg-slate-100 flex">
                  <div className="bg-purple-500 h-full" style={{ width: `${(liveP4.b2bRevenue / liveP4.totalRevenue) * 100}%`, transition: "width 0.8s ease" }} />
                  <div className="bg-blue-400 h-full" style={{ width: `${(liveP4.b2cRevenue / liveP4.totalRevenue) * 100}%`, transition: "width 0.8s ease" }} />
                </div>
              )}
              <div className="bg-red-50/70 border border-red-100 rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-red-500 text-sm font-black">↓</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Dark Store Expenses</p>
                  <p className="text-[22px] font-black text-red-600 leading-none">
                    ₹{totalExpenses > 0 ? totalExpenses.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "0"}
                  </p>
                  {totalExpenses > 0 && liveP4.totalRevenue > 0 && (
                    <p className="text-[9px] font-bold text-red-400 mt-1">
                      {((totalExpenses / liveP4.totalRevenue) * 100) > 1000
                        ? "—"
                        : `${((totalExpenses / liveP4.totalRevenue) * 100).toFixed(1)}% of revenue consumed`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Customers and Retention - LIVE */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-white border-b border-slate-100 px-5 py-4 flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 to-violet-500"></div>
              <div>
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Customers &amp; Retention
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{liveP4.totalCustomers} unique customers tracked</p>
              </div>
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">Live</span>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100 text-center">
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Active Customers</p>
                  <p className="text-[28px] font-black text-indigo-700 leading-none">{liveP4.totalCustomers || "—"}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 text-center">
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Repeat %</p>
                  <p className="text-[28px] font-black text-emerald-600 leading-none">{liveP4.repeatPct}%</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Repeat Formula</p>
                <p className="text-[11px] font-bold text-slate-600">
                  {liveP4.repeatCount} repeat ÷ {liveP4.totalCustomers} total
                  <span className="font-black text-emerald-600 ml-1.5">= {liveP4.repeatPct}%</span>
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">New vs Repeat Split</p>
                <div className="flex h-3 rounded-full overflow-hidden mb-2.5 bg-slate-200">
                  <div className="bg-blue-500 h-full" style={{ width: `${liveP4.newPct}%`, transition: "width 0.8s ease" }} />
                  <div className="bg-emerald-500 h-full" style={{ width: `${liveP4.repeatPct}%`, transition: "width 0.8s ease" }} />
                </div>
                <div className="flex justify-between text-[10px] font-black">
                  <span className="text-blue-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    New {liveP4.newPct}%
                  </span>
                  <span className="text-emerald-600 flex items-center gap-1.5">
                    Repeat {liveP4.repeatPct}%
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
