// Turns the admin's live order list into the rows the Analytics workspace
// reports on, and holds the small calculations those reports share.
// Nothing here reads or writes the database.

const DAY_MS = 86400000;

export const sum = (rows, key) => rows.reduce((n, r) => n + (Number(r[key]) || 0), 0);
export const rate = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");
export const avg = (a, b) => (b ? a / b : 0);
export const rupee = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
export const count = (n) => (Number(n) || 0).toLocaleString("en-IN");

export const toDayStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseDay = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export const dayIndex = (s) => Math.round(parseDay(s) / DAY_MS);
export const addDays = (s, n) => new Date(parseDay(s) + n * DAY_MS).toISOString().slice(0, 10);
export const fmtDay = (s) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(parseDay(s)));
export const today = () => toDayStr(new Date());

const EXCLUDED_TYPES = new Set(["issue", "rider_tracking", "abandoned"]);

const B2B_LABELS = {
  STUDENT_LAUNDRY: "Student laundry",
  INDIVIDUAL_STUDENT: "Individual student",
  LINEN: "Linen",
  AIRBNB: "Hotel / Airbnb",
};

const clean = (name) =>
  String(name || "")
    .replace(/_(regular|instant)$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const KEYWORD_SERVICES = [
  [/wash\s*(&|and)?\s*fold/i, "Wash & Fold"],
  [/wash\s*(&|and)?\s*iron/i, "Wash & Iron"],
  [/dry\s*-?\s*clean/i, "Dry Clean"],
  [/\biron/i, "Iron"],
  [/shoe|sneaker|loafer/i, "Shoes"],
  [/blanket|curtain|bedsheet|linen/i, "Home care"],
];

/**
 * The service an order is mainly for: the named service line worth the most,
 * else the first one, else a guess from the order's text, else "Other".
 * The order's own text ("11 + 1 More", "5 Kg Wash & Fold") is a description,
 * not a service, so it is never used as the name.
 */
export function primaryService(o) {
  const lines = Array.isArray(o.serviceBreakdown) && o.serviceBreakdown.length
    ? o.serviceBreakdown.map((l) => ({ name: l.name, amount: Number(l.amount) || 0 }))
    : Array.isArray(o.services)
      ? o.services.map((l) => ({ name: l?.serviceName || l?.name, amount: Number(l?.totalCost ?? l?.totalPrice) || 0 }))
      : [];
  const named = lines.filter((l) => clean(l.name));
  if (named.length) {
    const best = named.reduce((m, l) => (l.amount > m.amount ? l : m), named[0]);
    return clean(best.name);
  }
  const text = `${o.service || ""} ${o.serviceBreakdownSummary || ""}`;
  for (const [re, label] of KEYWORD_SERVICES) if (re.test(text)) return label;
  return "Other";
}

/** Orders that count as real placed orders (B2C and B2B), one row each. */
export function buildRows(orders = []) {
  const rows = [];
  for (const o of orders) {
    if (!o || o.isB2bRoomSync || EXCLUDED_TYPES.has(o.type)) continue;
    if (o.status === "Abandoned") continue;
    const dayStr = /^\d{4}-\d{2}-\d{2}$/.test(String(o.date || "")) ? o.date : null;
    if (!dayStr) continue;

    const b2b = o.type !== "regular";
    const amount = Number(o.amount) || 0;
    const delivered = o.status === "Delivered";
    const cancelled = o.status === "Cancelled";
    const discount = Number(o.discount ?? o.couponDiscount ?? 0) || 0;
    const customerName = String(o.customerName || o.property || "").trim();
    const phone = String(o.customerNumber || "").replace(/\D/g, "");
    rows.push({
      id: String(o.canonicalOrderId || o.id),
      order: o,
      dayStr,
      day: dayIndex(dayStr),
      b2b,
      channel: b2b ? "Institutional" : o.channel || "Other",
      service: b2b ? B2B_LABELS[o.category] || clean(o.category) || "B2B" : primaryService(o),
      status: o.status || "Pending",
      delivered,
      cancelled,
      open: !delivered && !cancelled,
      customer: b2b ? String(o.property || customerName || "Unknown") : phone && phone !== "nocontact" ? phone : customerName || "Unknown",
      customerName: b2b ? String(o.property || customerName) : customerName || "Customer",
      weight: Number(o.weight) || 0,
      gross: amount,
      discount,
      revenue: delivered ? amount : 0,
      paid: !!o.isPaid,
      reason: cancelled ? String(o.cancellationReason || o.cancelReason || "Not recorded") : "",
      source: o.acquisitionSource || "Other / Unknown",
      rider: o.riderName || "",
      subscription: o.source === "subscription_form" || o.type === "subscription" || o.isSubscription === true,
    });
  }
  return rows;
}

export const delivered = (rows) => rows.filter((r) => r.delivered);
export const uniq = (rows) => new Set(rows.map((r) => r.customer)).size;

/** First delivered B2C order of each customer, over the whole history. */
export function firstOrderMap(rows) {
  const map = new Map();
  const sorted = rows.filter((r) => !r.b2b && r.delivered).sort((a, b) => a.day - b.day);
  for (const r of sorted) if (!map.has(r.customer)) map.set(r.customer, r);
  return map;
}

export function resolveRange({ days, start, end }) {
  const last = today();
  if (days === "custom") return { start, end: end > last ? last : end };
  const n = Number(days);
  return { start: addDays(last, -(n - 1)), end: last };
}

export function spanDays(start, end) {
  return dayIndex(end) - dayIndex(start) + 1;
}

export function between(rows, start, end) {
  return rows.filter((r) => r.dayStr >= start && r.dayStr <= end);
}

export function delta(a, b) {
  if (!b) return "Prior period unavailable";
  const pct = ((a - b) / b) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs prior period`;
}

/** Up to 14 bars across the range; value is a revenue sum or an order count. */
export function bins(rows, start, end, key = "revenue") {
  const span = spanDays(start, end);
  const n = Math.max(1, Math.min(span, 14));
  const out = Array.from({ length: n }, () => 0);
  const s = dayIndex(start);
  for (const r of rows) {
    const i = Math.min(n - 1, Math.floor(((r.day - s) * n) / span));
    if (i >= 0) out[i] += key === "orders" ? 1 : r[key];
  }
  return out;
}

export function breakdown(rows, labels, key) {
  return labels.map(([value, label]) => {
    const r = rows.filter((o) => o[key] === value);
    const d = delivered(r);
    return [label, r.length, d.length, sum(d, "weight").toFixed(1), rupee(sum(d, "revenue"))];
  });
}

/** 30-day acquisition cohorts and the share who ordered again in later windows. */
export function cohorts(rows, firstOrders, start, end) {
  const origin = dayIndex(start);
  const lastDay = dayIndex(end);
  const out = [];
  for (let offset = 0; origin + offset <= lastDay; offset += 30) {
    const from = origin + offset;
    const to = Math.min(lastDay, from + 29);
    const members = [...firstOrders.values()].filter((o) => o.day >= from && o.day <= to);
    const cells = [1, 2, 3].map((k) => {
      if (from + (k + 1) * 30 - 1 > lastDay) return "Pending";
      const back = members.filter((m) =>
        rows.some((x) => !x.b2b && x.delivered && x.customer === m.customer && x.day >= from + k * 30 && x.day < from + (k + 1) * 30),
      ).length;
      return rate(back, members.length);
    });
    out.push({ from, to, size: members.length, cells });
  }
  return out;
}

export const dayToStr = (idx) => new Date(idx * DAY_MS).toISOString().slice(0, 10);
