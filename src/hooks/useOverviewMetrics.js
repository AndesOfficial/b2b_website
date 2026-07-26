import { useMemo } from "react";
import { getCategoryForProperty } from "../data/hostelOrders";
import { getOrderTypeLabel, ORDER_CATEGORIES, ORDER_TYPES } from "../constants/orders";

// Map category key → the admin tab to navigate to when clicked
export const CATEGORY_TAB_MAP = {
  linen: "hostels",
  student: "hostels",
  bulk: "hostels",
  airbnb: "hotels",
  hotel: "hotels",
  regular: "regular",
  website: "regular",
};

// ── Date Helpers ──────────────────────────────────────────────────
function getDateString(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthStartString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function buildPeriodRange(period) {
  const today = getDateString(0);
  if (period === "today") return { start: today, end: today };
  if (period === "month") return { start: getMonthStartString(), end: today };
  return { start: today, end: today };
}

function getPrevPeriodRange(period) {
  const today = getDateString(0);
  if (period === "today") {
    const yesterday = getDateString(-1);
    return { start: yesterday, end: yesterday };
  }
  if (period === "month") {
    const d = new Date();
    const prevMonth = d.getMonth() === 0 ? 12 : d.getMonth();
    const prevYear = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
    const start = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(prevYear, prevMonth, 0).getDate();
    const end = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { start, end };
  }
  return { start: today, end: today };
}

// ── Category helper ───────────────────────────────────────────────
function getCatForOrder(order) {
  return order.channel === "Website"
    ? { key: "website", label: "Website Store", color: "#6366F1" }
    : getCategoryForProperty(order.property || order.tenant);
}

// ── Build category breakdown from a filtered order set ───────────
function buildCategoryBreakdown(filteredOrders, totalRevenue) {
  const catMap = {};
  filteredOrders.forEach((order) => {
    const cat = getCatForOrder(order);
    if (!catMap[cat.key]) catMap[cat.key] = { key: cat.key, label: cat.label, color: cat.color, orders: 0, revenue: 0 };
    catMap[cat.key].orders += 1;
    catMap[cat.key].revenue += order.amount || 0;
  });
  return Object.values(catMap)
    .map((c) => ({ ...c, share: totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ── Build per-property drill-down within each category ───────────
const ENTRY_MODES = ["bulk", "student"];
const ENTRY_MODE_ENABLED_CATEGORIES = new Set([ORDER_CATEGORIES.STUDENT_LAUNDRY, ORDER_CATEGORIES.LINEN, "BULK_LAUNDRY"]);

function createEmptyEntryStats() {
  return { revenue: 0, kg: 0, clothes: 0, students: 0, orders: 0, details: [] };
}

function determineEntryMode(order) {
  if (order?.details?.entryMode) {
    return order.details.entryMode === "student" ? "student" : "bulk";
  }
  if (order.studentName || (order.details?.studentServices?.length)) {
    return "student";
  }
  return "bulk";
}

function shouldTrackEntryModes(catKey) {
  return ENTRY_MODE_ENABLED_CATEGORIES.has(catKey);
}

function buildPropertyBreakdown(filteredOrders) {
  const result = {};
  filteredOrders.forEach((order) => {
    const cat = getCatForOrder(order);
    const prop = order.property || order.tenant || order.channel || "Unknown";
    if (!result[cat.key]) result[cat.key] = {};
    if (!result[cat.key][prop]) {
      result[cat.key][prop] = {
        property: prop,
        revenue: 0,
        kg: 0,
        clothes: 0,
        students: 0,
        orders: 0,
      };
      if (shouldTrackEntryModes(cat.key)) {
        result[cat.key][prop].entryModes = {
          bulk: createEmptyEntryStats(),
          student: createEmptyEntryStats(),
        };
      }
    }
    const row = result[cat.key][prop];
    const entryMode = determineEntryMode(order);
    const entryStats = row.entryModes ? row.entryModes[entryMode] : null;

    const amount = order.amount || 0;
    const weight = order.weight || 0;
    const clothes = order.items || 0;
    const students = order.studentCount || 0;

    if (entryStats) {
      entryStats.revenue += amount;
      entryStats.kg += weight;
      entryStats.clothes += clothes;
      entryStats.students += students;
      entryStats.orders += 1;
      if (entryMode === "student") {
        const detail = {
          id: order.id,
          name: order.studentName || order.customerName || "Student",
          room: order.studentRoom || order.details?.room || "",
          phone: order.studentPhone || order.studentContact || order.customerNumber || "",
          service: order.service || "Student Laundry",
          amount: amount,
        };
        const exists = entryStats.details.some((item) => item.id === detail.id);
        if (!exists) {
          entryStats.details.push(detail);
          if (entryStats.details.length > 10) entryStats.details.shift();
        }
      }
    }

    row.revenue += amount;
    row.kg += weight;
    row.clothes += clothes;
    row.students += students;
    row.orders += 1;
  });
  const sorted = {};
  Object.entries(result).forEach(([key, propMap]) => {
    sorted[key] = Object.values(propMap).sort((a, b) => b.revenue - a.revenue);
  });
  return sorted;
}

// ── Build last-7-days sparkline per category ──────────────────────
function buildCategorySparklines(nonIssueOrders, todayString) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayString + "T00:00:00");
    d.setDate(d.getDate() - i);
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  const sparklines = {};
  days.forEach((date) => {
    const dayOrders = nonIssueOrders.filter((o) => o.date === date);
    dayOrders.forEach((order) => {
      const cat = getCatForOrder(order);
      if (!sparklines[cat.key]) sparklines[cat.key] = [];
    });
  });
  // Fill sparkline data as array of { v } for each category
  Object.keys(sparklines).forEach((catKey) => { sparklines[catKey] = []; });
  // First pass: collect all category keys
  nonIssueOrders.filter((o) => days.includes(o.date)).forEach((order) => {
    const cat = getCatForOrder(order);
    if (!sparklines[cat.key]) sparklines[cat.key] = Array(7).fill(0);
  });
  Object.keys(sparklines).forEach((key) => {
    if (!Array.isArray(sparklines[key]) || sparklines[key].length !== 7) {
      sparklines[key] = Array(7).fill(0);
    }
  });
  // Second pass: sum revenue per day per category
  days.forEach((date, i) => {
    const dayOrders = nonIssueOrders.filter((o) => o.date === date);
    dayOrders.forEach((order) => {
      const cat = getCatForOrder(order);
      if (!sparklines[cat.key]) sparklines[cat.key] = Array(7).fill(0);
      sparklines[cat.key][i] += order.amount || 0;
    });
  });
  return sparklines;
}

function getDisplayLabel(fullDate, previousDate) {
  const dayNum = parseInt(fullDate.split("-")[2], 10);
  const isNewMonth = !previousDate || previousDate.slice(0, 7) !== fullDate.slice(0, 7);
  return isNewMonth ? `${fullDate.slice(5, 7)}/${fullDate.slice(8, 10)}` : String(dayNum);
}

// ── Main Hook ─────────────────────────────────────────────────────
export function useOverviewMetrics({ orders, daysInRange }) {
  const nonIssueOrders = useMemo(
    () => orders.filter((order) => 
      order.category !== ORDER_CATEGORIES.ISSUES && 
      order.status !== "Cancelled" && 
      order.status !== "Abandoned" && 
      order.type !== "abandoned"
    ),
    [orders]
  );

  const dailyRevenue = useMemo(
    () =>
      daysInRange.map((fullDate, index) => {
        const dayOrders = nonIssueOrders.filter((order) => order.date === fullDate);
        return {
          day: getDisplayLabel(fullDate, daysInRange[index - 1]),
          fullDate,
          revenue: dayOrders.reduce((sum, order) => sum + (order.amount || 0), 0),
        };
      }),
    [daysInRange, nonIssueOrders]
  );

  const totalRevenue = useMemo(
    () => nonIssueOrders.reduce((sum, order) => sum + (order.amount || 0), 0),
    [nonIssueOrders]
  );

  const categoryBreakdown = useMemo(
    () => buildCategoryBreakdown(nonIssueOrders, totalRevenue),
    [nonIssueOrders, totalRevenue]
  );

  // ── Fixed date strings ──────────────────────────────────────────
  const todayString = getDateString(0);
  const yesterdayString = getDateString(-1);

  // ── Period-aware hero section (Today / Week / Month) ───────────
  // Returns a function so the UI can compute for any period on demand
  const buildPeriodData = useMemo(() => {
    return (period) => {
      const { start, end } = buildPeriodRange(period);
      const { start: prevStart, end: prevEnd } = getPrevPeriodRange(period);

      const periodOrders = nonIssueOrders.filter((o) => o.date >= start && o.date <= end);
      const prevOrders = nonIssueOrders.filter((o) => o.date >= prevStart && o.date <= prevEnd);

      const periodTotal = periodOrders.reduce((s, o) => s + (o.amount || 0), 0);
      const prevTotal = prevOrders.reduce((s, o) => s + (o.amount || 0), 0);

      const breakdown = buildCategoryBreakdown(periodOrders, periodTotal);

      // Per-category trend vs previous period
      const prevCatMap = {};
      prevOrders.forEach((order) => {
        const cat = getCatForOrder(order);
        if (!prevCatMap[cat.key]) prevCatMap[cat.key] = 0;
        prevCatMap[cat.key] += order.amount || 0;
      });
      const breakdownWithTrend = breakdown.map((cat) => {
        const prev = prevCatMap[cat.key] || 0;
        const diff = cat.revenue - prev;
        const pct = prev > 0 ? ((diff / prev) * 100).toFixed(1) : null;
        return { ...cat, prevRevenue: prev, trendDiff: diff, trendPct: pct };
      });

      const propertyBreakdown = buildPropertyBreakdown(periodOrders);

      return {
        breakdown: breakdownWithTrend,
        propertyBreakdown,
        periodTotal,
        prevTotal,
        overallTrendDiff: periodTotal - prevTotal,
        overallTrendPct: prevTotal > 0 ? (((periodTotal - prevTotal) / prevTotal) * 100).toFixed(1) : null,
        periodOrders: periodOrders.length,
        start,
        end,
      };
    };
  }, [nonIssueOrders]);

  // ── Yesterday's revenue for quick comparison on the "Today" view ─
  const yesterdayRevenue = useMemo(
    () => nonIssueOrders.filter((o) => o.date === yesterdayString).reduce((s, o) => s + (o.amount || 0), 0),
    [nonIssueOrders, yesterdayString]
  );

  // ── Sparklines: last 7 days per category ──────────────────────
  const categorySparklines = useMemo(
    () => buildCategorySparklines(nonIssueOrders, todayString),
    [nonIssueOrders, todayString]
  );

  // ── Legacy: plain today breakdown (kept for backward compat) ─
  const todayBreakdown = useMemo(() => {
    const todayOrders = nonIssueOrders.filter((o) => o.date === todayString);
    const todayTotal = todayOrders.reduce((s, o) => s + (o.amount || 0), 0);
    return buildCategoryBreakdown(todayOrders, todayTotal);
  }, [nonIssueOrders, todayString]);

  const todayRevenue = useMemo(
    () => todayBreakdown.reduce((s, c) => s + c.revenue, 0),
    [todayBreakdown]
  );

  const todayPropertyBreakdown = useMemo(
    () => buildPropertyBreakdown(nonIssueOrders.filter((o) => o.date === todayString)),
    [nonIssueOrders, todayString]
  );

  const propertyRows = useMemo(() => {
    const propertyMap = new Map();
    nonIssueOrders.forEach((order) => {
      const key = order.type === ORDER_TYPES.REGULAR ? (order.channel || order.property || "Retail") : order.property;
      if (!key) return;
      if (!propertyMap.has(key)) {
        propertyMap.set(key, {
          id: key.toLowerCase().replace(/\s+/g, "-"),
          name: key,
          properties: [key],
          hostelType: getOrderTypeLabel(order.type),
          rev: 0, kg: 0, clothes: 0, orders: 0, issues: 0, last: null,
        });
      }
      const row = propertyMap.get(key);
      row.rev += order.amount || 0;
      row.kg += order.weight || 0;
      row.clothes += order.items || 0;
      row.orders += 1;
      if (order.date) {
        const currentDate = new Date(order.date);
        if (!row.last || currentDate > row.last) row.last = currentDate;
      }
    });
    return Array.from(propertyMap.values());
  }, [nonIssueOrders]);

  return {
    buildPeriodData,
    categoryBreakdown,
    categorySparklines,
    dailyRevenue,
    propertyRows,
    todayBreakdown,
    todayPropertyBreakdown,
    todayRevenue,
    todayString,
    totalRevenue,
    yesterdayRevenue,
  };
}
