// Pure KPI maths. Records → additive Totals → KPIs. A day's Totals is what the
// server stores in dailyMetrics/{day}; a date range is the merge of its days,
// so the server aggregate and the client calculation cannot drift apart.
// Every KPI is { status: "ok", value } or { status: "incomplete" | "na", reason } — never a silent zero.
import type { MetricRecord } from "./records.js";

export interface Totals {
  revenue: number;
  revenueB2c: number;
  revenueB2b: number;
  discounts: number;
  walletRedeemed: number;
  cashCollected: number;
  ordersCreated: number;
  ordersCompleted: number;
  ordersCancelled: number;
  unverified: number;
  kgSum: number;
  weighedOrders: number;
  customerIds: string[];
  /** Customers whose first verified order falls in the period; null when history is incomplete. */
  newCustomerIds: string[] | null;
}

export type Kpi = { status: "ok"; value: number } | { status: "incomplete" | "na"; reason: string; value?: undefined };
export type KpiMap = Record<string, Kpi>;

const round2 = (n: number) => Math.round(n * 100) / 100;
const inRange = (day: string | null, from: string, to: string) => !!day && day >= from && day <= to;
const ok = (value: number): Kpi => ({ status: "ok", value: round2(value) });
const sum = (rows: MetricRecord[], f: (r: MetricRecord) => number) => rows.reduce((s, r) => s + f(r), 0);

/** Earliest verified day per customer over the records given. */
export function firstVerifiedDays(records: MetricRecord[]): Record<string, string> {
  const first: Record<string, string> = {};
  for (const r of records) {
    if (r.cancelled || r.verificationStatus !== "verified" || !r.customerId || !r.day) continue;
    if (!first[r.customerId] || r.day < first[r.customerId]) first[r.customerId] = r.day;
  }
  return first;
}

/**
 * @param records   may include rows outside [from, to]; they are ignored except for paidDay
 * @param firstDays earliest verified day per customer over ALL history, or null if unknown
 */
export function totalsFor(records: MetricRecord[], from: string, to: string, firstDays: Record<string, string> | null): Totals {
  const inPeriod = records.filter((r) => inRange(r.day, from, to));
  const live = inPeriod.filter((r) => !r.cancelled);
  const isDone = (r: MetricRecord) => r.verificationStatus === "verified" && r.billReady;
  const verified = live.filter(isDone);
  const b2c = verified.filter((r) => r.segment === "B2C");
  const paid = records.filter((r) => r.segment === "B2C" && !r.cancelled && r.isPaid && r.billReady && inRange(r.paidDay, from, to));
  const weighed = verified.filter((r) => r.kg > 0);
  const customerIds = [...new Set(verified.map((r) => r.customerId).filter((c): c is string => !!c))].sort();

  return {
    revenue: sum(verified, (r) => r.bill!),
    revenueB2c: sum(b2c, (r) => r.bill!),
    revenueB2b: sum(verified.filter((r) => r.segment === "B2B"), (r) => r.bill!),
    discounts: sum(b2c, (r) => Math.max(0, r.grossBeforeDiscounts! - r.bill!)),
    walletRedeemed: sum(b2c, (r) => r.walletUsed),
    cashCollected: sum(paid, (r) => Math.max(0, r.bill! - r.walletUsed)),
    ordersCreated: new Set(records.filter((r) => inRange(r.createdDay, from, to)).map((r) => r.id)).size,
    ordersCompleted: verified.length,
    ordersCancelled: inPeriod.length - live.length,
    unverified: live.length - verified.length,
    kgSum: sum(weighed, (r) => r.kg),
    weighedOrders: weighed.length,
    customerIds,
    newCustomerIds: firstDays ? customerIds.filter((c) => inRange(firstDays[c], from, to)) : null,
  };
}

/** Totals of consecutive periods → totals of the whole range. */
export function mergeTotals(parts: Totals[]): Totals {
  const out = emptyTotals();
  const customers = new Set<string>();
  const newCustomers = new Set<string>();
  let newKnown = true;
  for (const t of parts) {
    for (const k of NUMERIC_KEYS) out[k] += Number(t[k]) || 0;
    t.customerIds.forEach((c) => customers.add(c));
    if (t.newCustomerIds) t.newCustomerIds.forEach((c) => newCustomers.add(c));
    else newKnown = false;
  }
  out.customerIds = [...customers].sort();
  out.newCustomerIds = newKnown ? [...newCustomers].sort() : null;
  return out;
}

const NUMERIC_KEYS = [
  "revenue", "revenueB2c", "revenueB2b", "discounts", "walletRedeemed", "cashCollected",
  "ordersCreated", "ordersCompleted", "ordersCancelled", "unverified", "kgSum", "weighedOrders",
] as const;

export function emptyTotals(): Totals {
  const t: any = { customerIds: [], newCustomerIds: [] };
  for (const k of NUMERIC_KEYS) t[k] = 0;
  return t;
}

export function kpisFromTotals(t: Totals): KpiMap {
  return {
    revenue_total: ok(t.revenue),
    revenue_b2c: ok(t.revenueB2c),
    revenue_b2b: ok(t.revenueB2b),
    discounts: ok(t.discounts),
    wallet_redeemed: ok(t.walletRedeemed),
    cash_collected: ok(t.cashCollected),
    orders_created: ok(t.ordersCreated),
    orders_completed: ok(t.ordersCompleted),
    orders_cancelled: ok(t.ordersCancelled),
    unverified: ok(t.unverified),
    unique_customers: ok(t.customerIds.length),
    new_paying_customers: t.newCustomerIds
      ? ok(t.newCustomerIds.length)
      : { status: "incomplete", reason: "Full order history not loaded" },
    aov: t.ordersCompleted ? ok(t.revenue / t.ordersCompleted) : { status: "na", reason: "No verified orders" },
    avg_kg: t.weighedOrders ? ok(t.kgSum / t.weighedOrders) : { status: "na", reason: "No weighed orders" },
  };
}

/**
 * @param records   output of buildRecords (may include history before `from`)
 * @param opts.historyComplete true when records cover all time (needed for new customers)
 */
export function computeKpis(records: MetricRecord[], { from, to, historyComplete = false }: { from: string; to: string; historyComplete?: boolean }): KpiMap {
  return kpisFromTotals(totalsFor(records, from, to, historyComplete ? firstVerifiedDays(records) : null));
}
