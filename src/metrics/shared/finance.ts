// Money inputs: expenses (incurred vs paid), invoices/receivables, cash
// balances and estimated contribution from standard costs. Pure functions;
// Firestore shapes are described next to each.
import { addDays } from "./days.js";

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;
const inRange = (day: string | null | undefined, from: string, to: string) => !!day && day >= from && day <= to;

// ─── Expenses (b2b_expenses) ──────────────────────────────────────────────────

export type ExpenseNature = "fixed" | "variable";

/** Dashboard categories, with whether they are usually fixed or variable. */
export const EXPENSE_CATEGORIES: Record<string, ExpenseNature> = {
  "Rent": "fixed",
  "Salaries": "fixed",
  "Utilities": "fixed",
  "Software & subscriptions": "fixed",
  "Laundry processing": "variable",
  "Detergent & consumables": "variable",
  "Packaging": "variable",
  "Delivery & fuel": "variable",
  "Rider payouts": "variable",
  "Payment gateway fees": "variable",
  "Marketing": "variable",
  "Equipment & setup (capex)": "fixed",
  "Repairs & maintenance": "fixed",
  "Other": "fixed",
};

/** The old free-form categories → dashboard categories. */
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  "Purchase things for dark store": "Detergent & consumables",
  "Setup cost": "Equipment & setup (capex)",
  "Workers payment": "Rider payouts",
  "Out of the box": "Other",
  "Vendor payment": "Laundry processing",
  "Other": "Other",
  "Dark Store OPEX": "Utilities",
  "COMPANY OPEX": "Software & subscriptions",
  "Marketing Expense": "Marketing",
  "Packaging": "Packaging",
  "Team Member Salary": "Salaries",
};

export interface Expense {
  id: string;
  amount: number;
  category: string;
  nature: ExpenseNature;
  vendor: string;
  invoiceNo: string;
  /** When the cost belongs (P&L). */
  incurredDate: string | null;
  /** When the money left; null while unpaid. */
  paidDate: string | null;
  campaignId: string | null;
}

/** A b2b_expenses doc, old or new shape, as an Expense. Old docs: one `date`, `type: Paid|Payable`, `payee`. */
export function normalizeExpense(e: any): Expense {
  const category = EXPENSE_CATEGORIES[e.category] ? e.category : LEGACY_CATEGORY_MAP[e.category] || "Other";
  const unpaid = ["payable", "unpaid"].includes(String(e.type || "").toLowerCase());
  return {
    id: e.id,
    amount: num(e.amount),
    category,
    nature: e.nature === "fixed" || e.nature === "variable" ? e.nature : EXPENSE_CATEGORIES[category],
    vendor: String(e.vendor || e.payee || "").trim(),
    invoiceNo: String(e.invoiceNo || "").trim(),
    incurredDate: e.incurredDate || e.date || null,
    paidDate: e.paidDate !== undefined ? e.paidDate || null : unpaid ? null : e.date || null,
    campaignId: e.campaignId || null,
  };
}

export interface ExpenseTotals {
  incurred: number;
  paid: number;
  /** Incurred in the period and still unpaid. */
  unpaid: number;
  fixed: number;
  variable: number;
  marketing: number;
  byCategory: Record<string, number>;
}

/** Incurred (P&L, by incurredDate) vs paid (cash, by paidDate) for [from, to]. */
export function expenseTotals(raw: any[], from: string, to: string): ExpenseTotals {
  const out: ExpenseTotals = { incurred: 0, paid: 0, unpaid: 0, fixed: 0, variable: 0, marketing: 0, byCategory: {} };
  for (const e of raw.map(normalizeExpense)) {
    if (inRange(e.paidDate, from, to)) out.paid += e.amount;
    if (!inRange(e.incurredDate, from, to)) continue;
    out.incurred += e.amount;
    if (!e.paidDate) out.unpaid += e.amount;
    out[e.nature] += e.amount;
    if (e.category === "Marketing") out.marketing += e.amount;
    out.byCategory[e.category] = round2((out.byCategory[e.category] || 0) + e.amount);
  }
  for (const k of ["incurred", "paid", "unpaid", "fixed", "variable", "marketing"] as const) out[k] = round2(out[k]);
  return out;
}

/**
 * Existing expenses that look like the same bill: same vendor and invoice
 * number, or same vendor and amount within 3 days.
 */
export function findDuplicateExpenses(candidate: any, existing: any[]): Expense[] {
  const c = normalizeExpense(candidate);
  const vendor = c.vendor.toLowerCase();
  if (!vendor) return [];
  return existing.map(normalizeExpense).filter((e) => {
    if (e.id && e.id === c.id) return false;
    if (e.vendor.toLowerCase() !== vendor) return false;
    if (c.invoiceNo && e.invoiceNo && c.invoiceNo.toLowerCase() === e.invoiceNo.toLowerCase()) return true;
    if (Math.abs(e.amount - c.amount) > 0.5 || !c.incurredDate || !e.incurredDate) return false;
    return e.incurredDate >= addDays(c.incurredDate, -3) && e.incurredDate <= addDays(c.incurredDate, 3);
  });
}

// ─── Invoices (invoices/{invoiceNo}) ──────────────────────────────────────────
// { invoiceNo, client, periodFrom, periodTo, amount, issuedDate, dueDate,
//   payments: [{ amount, date, method, note }], status: "unpaid"|"partial"|"paid"|"void" }

export const DEFAULT_CREDIT_DAYS = 15;
export const AGEING_BUCKETS = ["0–15", "16–30", "31–60", "60+"] as const;

export function invoicePaid(inv: any): number {
  return round2((inv.payments || []).reduce((s: number, p: any) => s + num(p.amount), 0));
}

export function invoiceOutstanding(inv: any): number {
  if (inv.status === "void") return 0;
  return round2(Math.max(0, num(inv.amount) - invoicePaid(inv)));
}

export function invoiceStatus(inv: any): "unpaid" | "partial" | "paid" | "void" {
  if (inv.status === "void") return "void";
  const paid = invoicePaid(inv);
  if (paid <= 0) return "unpaid";
  return paid + 0.5 >= num(inv.amount) ? "paid" : "partial";
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** Outstanding receivables by days past the issue date, as of `asOf`. */
export function ageing(invoices: any[], asOf: string): Record<(typeof AGEING_BUCKETS)[number], number> & { total: number; overdue: number } {
  const out: any = { total: 0, overdue: 0 };
  AGEING_BUCKETS.forEach((b) => (out[b] = 0));
  for (const inv of invoices) {
    const due = invoiceOutstanding(inv);
    if (!due || !inv.issuedDate || inv.issuedDate > asOf) continue;
    const age = daysBetween(inv.issuedDate, asOf);
    const bucket = age <= 15 ? "0–15" : age <= 30 ? "16–30" : age <= 60 ? "31–60" : "60+";
    out[bucket] = round2(out[bucket] + due);
    out.total = round2(out.total + due);
    if (inv.dueDate && inv.dueDate < asOf) out.overdue = round2(out.overdue + due);
  }
  return out;
}

/** Days sales outstanding: receivables ÷ invoiced revenue over the last `days` × days. Null when nothing was invoiced. */
export function dso(invoices: any[], asOf: string, days = 30): number | null {
  const from = addDays(asOf, -(days - 1));
  const billed = invoices.filter((i) => i.status !== "void" && inRange(i.issuedDate, from, asOf)).reduce((s, i) => s + num(i.amount), 0);
  if (!billed) return null;
  return Math.round((ageing(invoices, asOf).total / billed) * days);
}

// ─── Cash (cash_balances/{YYYY-MM-DD}) ────────────────────────────────────────
// { date, accounts: { bank: n, upi: n, cash: n }, note, enteredBy }

/** Latest balance entered on or before `asOf`, or null. */
export function cashBalance(entries: any[], asOf: string): { date: string; total: number; accounts: Record<string, number> } | null {
  const latest = entries.filter((e) => e.date && e.date <= asOf).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!latest) return null;
  const accounts: Record<string, number> = {};
  for (const [k, v] of Object.entries(latest.accounts || {})) accounts[k] = num(v);
  return { date: latest.date, accounts, total: round2(Object.values(accounts).reduce((s, v) => s + v, 0)) };
}

// ─── Standard costs (company_config/standardCosts) ───────────────────────────
// { versions: [{ effectiveFrom, perKg: { "Wash & Fold": n, default: n },
//   packagingPerOrder, deliveryPerStop, paymentFeePct }] }

export interface StandardCosts {
  effectiveFrom: string;
  perKg: Record<string, number>;
  packagingPerOrder: number;
  deliveryPerStop: number;
  paymentFeePct: number;
}

/** The version in force on `day` (latest effectiveFrom ≤ day), or null. */
export function standardCostsOn(config: any, day: string): StandardCosts | null {
  const versions: StandardCosts[] = (config?.versions || []).filter((v: any) => v.effectiveFrom && v.effectiveFrom <= day);
  return versions.sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0] || null;
}

/**
 * Estimated contribution of verified orders and B2B batches: revenue − variable standard
 * costs (processing per kg, packaging, two delivery stops, gateway fee on cash
 * collected online). Fixed costs are never spread per order.
 */
export function estimatedContribution(
  t: { revenue: number; kgSum: number; ordersCompleted: number; cashCollected: number },
  costs: StandardCosts | null,
): { status: "ok"; value: number; variableCosts: number; estimated: true } | { status: "na"; reason: string } {
  if (!costs) return { status: "na", reason: "No standard costs set for this period" };
  const variableCosts =
    t.kgSum * num(costs.perKg?.default) +
    t.ordersCompleted * (num(costs.packagingPerOrder) + 2 * num(costs.deliveryPerStop)) +
    t.cashCollected * (num(costs.paymentFeePct) / 100);
  return { status: "ok", value: round2(t.revenue - variableCosts), variableCosts: round2(variableCosts), estimated: true };
}
