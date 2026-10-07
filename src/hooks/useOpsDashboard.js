import { useMemo } from "react";

// Metrics for the admin Operations & Revenue dashboard.
//
// Every number is derived from the merged order list (cartdetails = B2C,
// b2b_orders / hostels_orders / b2b_admin_edits = B2B). Things the data does
// not record (B2B payments, failed deliveries, drying stage, dark-store
// capacity) are returned as null so the UI can say "not tracked" instead of
// showing a made-up zero.

const DAY_MS = 86400000;

export function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateStr(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr, n) {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function daysBetween(from, to) {
  return Math.round((parseDateStr(to) - parseDateStr(from)) / DAY_MS) + 1;
}

/** Date range for a period ending on (or containing) `anchor`. */
export function rangeFor(period, anchor, custom) {
  if (period === "custom" && custom?.from && custom?.to) return { from: custom.from, to: custom.to };
  if (period === "week") return { from: addDays(anchor, -6), to: anchor };
  if (period === "month") {
    const d = parseDateStr(anchor);
    return {
      from: toDateStr(new Date(d.getFullYear(), d.getMonth(), 1)),
      to: toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    };
  }
  return { from: anchor, to: anchor };
}

const inRange = (date, r) => !!date && date >= r.from && date <= r.to;
const sum = (list, fn) => list.reduce((s, x) => s + (Number(fn(x)) || 0), 0);
const lower = (v) => String(v || "").trim().toLowerCase();

// ── Classification ──────────────────────────────────────────────────────────

const B2B_TYPES = new Set(["student", "linen", "airbnb"]);
const B2B_SOURCES = new Set(["b2b", "hostels", "admin"]);

export function isB2C(o) {
  if (o.type === "rider_tracking" || o.type === "abandoned" || o.type === "issue") return false;
  return o.source === "cartdetails" || o.source === "website" || (o.source === "admin" && o.type === "regular");
}

export function isB2B(o) {
  return B2B_SOURCES.has(o.source) && B2B_TYPES.has(o.type);
}

const isCancelled = (o) => o.status === "Cancelled" || ["cancelled", "canceled", "abandoned"].includes(lower(o.rawStatus));

/** Groups property names into the client (brand) that is billed. */
export function clientOf(property) {
  const p = lower(property);
  if (p.startsWith("hostel99") || p.startsWith("hostel 99")) return "Hostel 99";
  if (p.startsWith("tribe")) return "Tribe";
  if (p.startsWith("zolo")) return "Zolo";
  if (p.startsWith("treebo")) return "Treebo";
  if (p.includes("airbnb")) return "Airbnb";
  return property || "Unknown";
}

// New-schema b2b_orders keep weight/amount per room instead of on the order.
function b2bWeight(o) {
  if (Number(o.weight) > 0) return Number(o.weight);
  if (Number(o.hostelTotalWeightKg) > 0) return Number(o.hostelTotalWeightKg);
  return Array.isArray(o.roomOrders) ? sum(o.roomOrders, (r) => r.weightKg) : 0;
}

function b2bAmount(o) {
  if (Number(o.amount) > 0) return Number(o.amount);
  return Array.isArray(o.roomOrders) ? sum(o.roomOrders, (r) => r.amount) : 0;
}

const weightOf = (o) => (isB2B(o) ? b2bWeight(o) : Number(o.weight) || 0);

// ── Processing stage ────────────────────────────────────────────────────────

export const STAGES = [
  { key: "booked", label: "Booked" },
  { key: "pickedUp", label: "Picked up" },
  { key: "received", label: "Received" },
  { key: "washing", label: "Washing" },
  { key: "drying", label: "Drying" },
  { key: "ironing", label: "Ironing" },
  { key: "ready", label: "Ready" },
  { key: "outForDelivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];
const RANK = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

const ZONE_STAGE = {
  "order picked up": "pickedUp",
  "reached laundry facility": "received",
  "tagging intake": "received",
  "sorting pre-wash": "received",
  washing: "washing",
  ironing: "ironing",
  packing: "ready",
  "ready for delivery": "ready",
};

/** Furthest stage an order has reached. */
export function stageOf(o) {
  if (isB2B(o)) {
    // B2B orders are logged after the bags are collected, so they start at the store.
    return o.status === "Delivered" ? "delivered" : "received";
  }
  const raw = lower(o.rawStatus);
  if (raw === "completed" || raw === "delivered" || o.status === "Delivered") return "delivered";
  if (raw === "delivery partner on the way" || raw === "out for delivery") return "outForDelivery";
  let best = "booked";
  for (const [zone, at] of Object.entries(o.zoneTimes || {})) {
    const s = ZONE_STAGE[zone];
    if (s && at && RANK[s] > RANK[best]) best = s;
  }
  const fromStatus = ZONE_STAGE[raw];
  if (fromStatus && RANK[fromStatus] > RANK[best]) best = fromStatus;
  if (best === "booked" && (o.pickupOtpVerified || o.pickupOtpVerifiedAt)) best = "pickedUp";
  return best;
}

const reached = (o, stage) => RANK[stageOf(o)] >= RANK[stage];

// ── B2C services ────────────────────────────────────────────────────────────

export function serviceGroup(name) {
  const n = lower(name);
  if (/wash ?(&|and|_)? ?fold/.test(n)) return "Wash & Fold";
  if (n.includes("wash & iron") || n.includes("wash and iron")) return "Wash & Iron";
  if (n.includes("dry")) return "Dry Cleaning";
  if (/shoe|sneaker|loafer|sandal|boot|heel/.test(n)) return "Shoe Care";
  if (n.includes("iron") || n.includes("steam")) return "Ironing";
  return "Per-piece items";
}

function serviceLines(o) {
  const lines = (o.serviceBreakdown || []).map((b) => ({ group: serviceGroup(b.name), weight: b.weight || 0, amount: b.amount || 0 }));
  if (!lines.length) return [{ group: serviceGroup(o.service), weight: Number(o.weight) || 0, amount: Number(o.amount) || 0 }];
  // Lines often carry no price; spread the order total over them by weight, else evenly.
  const lineAmt = sum(lines, (l) => l.amount);
  const total = Number(o.amount) || 0;
  if (lineAmt <= 0 && total > 0) {
    const w = sum(lines, (l) => l.weight);
    lines.forEach((l) => { l.amount = w > 0 ? (total * l.weight) / w : total / lines.length; });
  }
  if (sum(lines, (l) => l.weight) === 0 && Number(o.weight) > 0) lines[0].weight = Number(o.weight);
  return lines;
}

// ── Metrics ─────────────────────────────────────────────────────────────────

const isPaid = (o) => ["completed", "paid", "success"].includes(lower(o.paymentStatus)) || !!o.paymentRecordedAt || !!o.paymentDoneOnDelivery;

function periodMetrics(orders, range) {
  const all = orders.filter((o) => inRange(o.date, range));
  const b2cAll = all.filter(isB2C);
  const b2c = b2cAll.filter((o) => !isCancelled(o));
  const b2b = all.filter((o) => isB2B(o) && !isCancelled(o));

  const b2bWeightTotal = sum(b2b, b2bWeight);
  const b2bRevenue = sum(b2b, b2bAmount);
  const b2cWeight = sum(b2c, (o) => o.weight);
  const b2cRevenue = sum(b2c, (o) => o.amount);
  const totalWeight = b2bWeightTotal + b2cWeight;
  const totalRevenue = b2bRevenue + b2cRevenue;
  const per = (rev, kg) => (kg > 0 ? rev / kg : null);

  // B2B delivery is only meaningful when someone marks orders delivered;
  // since Mar 2026 nobody has, so report it as not tracked instead of 0.
  const b2bDeliveryTracked = b2b.some((o) => o.status === "Delivered");

  // B2B clients
  const clientMap = new Map();
  for (const o of b2b) {
    const name = clientOf(o.property);
    if (!clientMap.has(name)) clientMap.set(name, { name, pickupKg: 0, deliveryKg: 0, revenue: 0, orders: 0, rates: new Map() });
    const c = clientMap.get(name);
    const w = b2bWeight(o);
    c.pickupKg += w;
    if (o.status === "Delivered") c.deliveryKg += w;
    c.revenue += b2bAmount(o);
    c.orders += 1;
    const rate = Number(o.ratePerKg);
    if (rate > 0) c.rates.set(rate, (c.rates.get(rate) || 0) + 1);
  }
  const clients = [...clientMap.values()].map((c) => {
    const topRate = [...c.rates.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return {
      name: c.name,
      pickupKg: c.pickupKg,
      deliveryKg: b2bDeliveryTracked ? c.deliveryKg : null,
      revenue: c.revenue,
      orders: c.orders,
      billing: topRate ? `₹${topRate}/kg` : "—",
      perKg: per(c.revenue, c.pickupKg),
      share: b2bRevenue > 0 ? (c.revenue / b2bRevenue) * 100 : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue || b.pickupKg - a.pickupKg);
  const b2bPickupKg = sum(clients, (c) => c.pickupKg);
  const b2bDeliveryKg = b2bDeliveryTracked ? sum(clients, (c) => c.deliveryKg) : null;
  const topByKg = [...clients].sort((a, b) => b.pickupKg - a.pickupKg)[0] || null;
  const topByRevenue = clients[0] || null;

  // B2C services
  const svcMap = new Map();
  for (const o of b2c) {
    const seen = new Set();
    for (const l of serviceLines(o)) {
      if (!svcMap.has(l.group)) svcMap.set(l.group, { name: l.group, weight: 0, revenue: 0, orders: 0 });
      const s = svcMap.get(l.group);
      s.weight += l.weight;
      s.revenue += l.amount;
      if (!seen.has(l.group)) { s.orders += 1; seen.add(l.group); }
    }
  }
  const services = [...svcMap.values()]
    .map((s) => ({ ...s, perKg: per(s.revenue, s.weight), aov: s.orders ? s.revenue / s.orders : null }))
    .sort((a, b) => b.revenue - a.revenue);

  // Operations (B2C carries the stage-level tracking)
  const pickupsCompleted = b2c.filter((o) => reached(o, "pickedUp"));
  const pickups = {
    scheduled: b2cAll.length,
    completed: pickupsCompleted.length,
    cancelled: b2cAll.filter(isCancelled).length,
    rescheduled: b2cAll.filter((o) => o.isRescheduled || o.rescheduleCount > 0).length,
    pending: b2c.filter((o) => !reached(o, "pickedUp")).length,
  };
  const deliveries = {
    scheduled: pickupsCompleted.length,
    completed: pickupsCompleted.filter((o) => reached(o, "delivered")).length,
    failed: null,
    rescheduled: pickupsCompleted.filter((o) => o.originalDropSlot).length,
    pending: pickupsCompleted.filter((o) => !reached(o, "delivered")).length,
  };
  const processing = Object.fromEntries(STAGES.slice(2).map((s) => [s.key, 0]));
  for (const o of b2c) {
    const s = stageOf(o);
    if (s in processing) processing[s] += 1;
  }
  processing.drying = null; // the app has no drying step

  // Weight flow (B2B + B2C)
  const active = b2bDeliveryTracked ? [...b2b, ...b2c] : b2c;
  const flowKg = (stage) => sum(active.filter((o) => reached(o, stage)), weightOf);
  const flow = [
    { key: "pickedUp", label: "Picked up", kg: flowKg("pickedUp") },
    { key: "received", label: "Received at dark store", kg: flowKg("received") },
    { key: "processed", label: "Processed", kg: flowKg("ironing") },
    { key: "ready", label: "Ready", kg: flowKg("ready") },
    { key: "delivered", label: "Delivered", kg: flowKg("delivered") },
  ];

  // Money (only B2C records payment)
  const collected = sum(b2c.filter(isPaid), (o) => o.amount);
  const unpaid = b2c.filter((o) => !isPaid(o));
  const overdueCutoff = addDays(toDateStr(new Date()), -7);
  const overdue = sum(unpaid.filter((o) => reached(o, "delivered") && o.date < overdueCutoff), (o) => o.amount);
  const money = {
    b2bRevenue, b2cRevenue, totalRevenue,
    b2bPerKg: per(b2bRevenue, b2bWeightTotal),
    b2cPerKg: per(b2cRevenue, b2cWeight),
    blendedPerKg: per(totalRevenue, totalWeight),
    collected,
    pending: sum(unpaid, (o) => o.amount) - overdue,
    overdue,
  };

  return {
    range,
    days: daysBetween(range.from, range.to),
    overall: {
      totalWeight, totalRevenue,
      b2bWeight: b2bWeightTotal, b2bRevenue,
      b2cWeight, b2cRevenue,
      orders: b2b.length + b2c.length,
      perKg: per(totalRevenue, totalWeight),
      mix: {
        b2bWeightPct: totalWeight > 0 ? (b2bWeightTotal / totalWeight) * 100 : 0,
        b2bRevenuePct: totalRevenue > 0 ? (b2bRevenue / totalRevenue) * 100 : 0,
      },
    },
    b2b: {
      weight: b2bWeightTotal, revenue: b2bRevenue,
      pickupKg: b2bPickupKg, deliveryKg: b2bDeliveryKg,
      inProcessKg: b2bDeliveryTracked ? Math.max(0, b2bPickupKg - b2bDeliveryKg) : null,
      deliveryTracked: b2bDeliveryTracked,
      perKg: per(b2bRevenue, b2bWeightTotal),
      orders: b2b.length,
      clients, topByKg, topByRevenue,
    },
    b2c: {
      weight: b2cWeight, revenue: b2cRevenue, orders: b2c.length,
      aov: b2c.length ? b2cRevenue / b2c.length : null,
      kgPerOrder: b2c.length ? b2cWeight / b2c.length : null,
      perKg: per(b2cRevenue, b2cWeight),
      services,
    },
    ops: { pickups, deliveries, processing },
    flow,
    flowIncludesB2B: b2bDeliveryTracked,
    money,
    _b2c: b2c,
  };
}

function trendSeries(orders, endDate, days) {
  const from = addDays(endDate, -(days - 1));
  const rows = new Map();
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    rows.set(d, { date: d, label: d.slice(8) + "/" + d.slice(5, 7), b2bKg: 0, b2cKg: 0, b2bRevenue: 0, b2cRevenue: 0 });
  }
  for (const o of orders) {
    const row = rows.get(o.date);
    if (!row || isCancelled(o)) continue;
    if (isB2B(o)) { row.b2bKg += b2bWeight(o); row.b2bRevenue += b2bAmount(o); }
    else if (isB2C(o)) { row.b2cKg += Number(o.weight) || 0; row.b2cRevenue += Number(o.amount) || 0; }
  }
  return [...rows.values()];
}

const fmtKg = (n) => `${Math.round(n * 10) / 10} KG`;
const fmtRs = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function buildAlerts(cur, prev, orders) {
  const alerts = [];
  const stuckKg = sum(cur._b2c.filter((o) => reached(o, "pickedUp") && !reached(o, "ready")), (o) => o.weight);
  if (stuckKg > 0) alerts.push({ level: "warn", text: `${fmtKg(stuckKg)} picked up but not yet ready (B2C)` });
  if (cur.b2b.inProcessKg > 0) alerts.push({ level: "warn", text: `${fmtKg(cur.b2b.inProcessKg)} of B2B weight picked up but not delivered` });

  const today = toDateStr(new Date());
  const delayed = orders.filter((o) => isB2C(o) && !isCancelled(o) && reached(o, "pickedUp") && !reached(o, "delivered") && o.date && o.date < addDays(today, -3));
  if (delayed.length) alerts.push({ level: "bad", text: `${delayed.length} B2C deliver${delayed.length === 1 ? "y" : "ies"} delayed (picked up 3+ days ago, not delivered)` });

  for (const c of cur.b2b.clients) {
    if (c.deliveryKg !== null && c.deliveryKg > c.pickupKg + 0.5) alerts.push({ level: "bad", text: `${c.name}: delivery weight (${fmtKg(c.deliveryKg)}) > pickup weight (${fmtKg(c.pickupKg)})` });
  }
  if (cur.money.overdue > 0) alerts.push({ level: "bad", text: `${fmtRs(cur.money.overdue)} B2C payment overdue (delivered 7+ days ago, unpaid)` });
  else if (cur.money.pending > 0) alerts.push({ level: "info", text: `${fmtRs(cur.money.pending)} B2C payment pending` });

  if (cur.b2c.aov && prev.b2c.aov) {
    const change = ((cur.b2c.aov - prev.b2c.aov) / prev.b2c.aov) * 100;
    if (change <= -10) alerts.push({ level: "warn", text: `B2C AOV down ${Math.abs(Math.round(change))}% vs previous period` });
  }
  if (prev.overall.totalRevenue > 0) {
    const change = ((cur.overall.totalRevenue - prev.overall.totalRevenue) / prev.overall.totalRevenue) * 100;
    if (change <= -20) alerts.push({ level: "warn", text: `Total revenue down ${Math.abs(Math.round(change))}% vs previous period` });
  }
  const p = cur.ops.pickups;
  if (p.scheduled >= 5 && p.cancelled / p.scheduled >= 0.25) {
    alerts.push({ level: "warn", text: `${p.cancelled} of ${p.scheduled} B2C pickups cancelled (${Math.round((p.cancelled / p.scheduled) * 100)}%)` });
  }
  return alerts;
}

export function useOpsDashboard(orders, range, trendDays) {
  return useMemo(() => {
    const cur = periodMetrics(orders, range);
    const len = daysBetween(range.from, range.to);
    const prevRange = { from: addDays(range.from, -len), to: addDays(range.from, -1) };
    const prev = periodMetrics(orders, prevRange);
    const alerts = buildAlerts(cur, prev, orders);
    const trend = trendSeries(orders, range.to, trendDays);
    return { ...cur, prev, alerts, trend };
  }, [orders, range, trendDays]);
}
