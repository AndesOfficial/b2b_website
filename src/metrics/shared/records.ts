// Turns raw Firestore docs into MetricRecords: one row per real order/batch,
// with the money fields every KPI reads. Revenue only ever comes from here.
import { calculateBatchRevenue, isHostel99Client } from "./rateCard.js";
import { customerPhone, isB2bRoomSync, isPaid, isRiderTracking, orderKg, paymentRecordedAt } from "./orderShape.js";

export interface MetricRecord {
  id: string;
  segment: "B2C" | "B2B";
  customerId: string | null;
  createdDay: string | null;
  day: string | null;
  verificationStatus: string;
  cancelled: boolean;
  billReady: boolean;
  bill: number | null;
  grossBeforeDiscounts: number | null;
  couponDiscount: number;
  promotionDiscount: number;
  walletUsed: number;
  isPaid: boolean;
  paidDay: string | null;
  kg: number;
  source: "cartdetails" | "managerB2bEntries";
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** YYYY-MM-DD in IST for a Firestore Timestamp, Date, millis or ISO string. */
export function istDay(raw: any): string | null {
  if (!raw) return null;
  const ms = typeof raw?.toMillis === "function" ? raw.toMillis()
    : raw instanceof Date ? raw.getTime()
    : typeof raw === "number" ? raw
    : typeof raw?.seconds === "number" ? raw.seconds * 1000
    : typeof raw?._seconds === "number" ? raw._seconds * 1000
    : Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * B2C order from cartdetails joined with managerVerifications/{id}.
 * Returns null for docs that are not customer orders (rider tracking, B2B room sync).
 */
export function b2cRecord(order: any, verification?: any): MetricRecord | null {
  if (isB2bRoomSync(order) || isRiderTracking(order)) return null;

  const v = verification || {};
  const cancelled = v.status === "cancelled" || /cancel/i.test(String(order.status || "")) || order.cancelled === true;
  // "changed" (rider edited after verify) is detected by the Manager site, which
  // resets the status; here we trust the stored status.
  const verificationStatus = cancelled ? "cancelled" : v.status || "pending";
  // Manager corrections are written back to cartdetails and the server reprices,
  // so the Authoritative Bill is `totalCost` once `breakdownReady`.
  const billReady = order.breakdownReady === true && order.totalCost != null;
  const paid = isPaid(order);

  return {
    id: order.id,
    segment: "B2C",
    customerId: order.userId || order.uid || customerPhone(order),
    createdDay: istDay(order.createdAt || (order.orderTimestamp && Number(order.orderTimestamp))),
    day: v.pickupDate || istDay(order.pickupOtpVerifiedAt) || istDay(order.createdAt),
    verificationStatus,
    cancelled,
    billReady,
    bill: billReady ? num(order.totalCost) : null,
    grossBeforeDiscounts: billReady ? num(order.originalTotalCost ?? order.totalCost) : null,
    couponDiscount: num(order.couponDiscount),
    promotionDiscount: num(order.promotionDiscount),
    walletUsed: num(order.walletAmountUsed),
    isPaid: paid,
    paidDay: paid ? istDay(paymentRecordedAt(order)) || istDay(order.updatedAt) : null,
    kg: num(v.kg) || orderKg(order),
    source: "cartdetails",
  };
}

/** Manager-entered B2B batch. Revenue from the per-client rate card. */
export function b2bRecord(entry: any, countOnDate = 1): MetricRecord {
  const cancelled = entry.status === "cancelled";
  const bill = calculateBatchRevenue(entry, isHostel99Client(entry.client) ? countOnDate : 1);
  return {
    id: entry.id,
    segment: "B2B",
    customerId: entry.client || null,
    createdDay: entry.date,
    day: entry.date,
    verificationStatus: cancelled ? "cancelled" : entry.status || "pending",
    cancelled,
    billReady: true,
    bill,
    grossBeforeDiscounts: bill,
    couponDiscount: 0,
    promotionDiscount: 0,
    walletUsed: 0,
    isPaid: false, // B2B cash comes from invoices (Phase 4)
    paidDay: null,
    kg: num(entry.kg ?? entry.weightKg ?? entry.weight),
    source: "managerB2bEntries",
  };
}

export interface RecordSources {
  cartdetails?: any[];
  verifications?: Record<string, any>;
  b2bEntries?: any[];
}

/** Builds records from all P0 sources; Hostel 99 batches share their day's fixed fee. */
export function buildRecords({ cartdetails = [], verifications = {}, b2bEntries = [] }: RecordSources): MetricRecord[] {
  const h99PerDay: Record<string, number> = {};
  for (const e of b2bEntries) {
    if (isHostel99Client(e.client) && e.status !== "cancelled") h99PerDay[e.date] = (h99PerDay[e.date] || 0) + 1;
  }
  const seen = new Set<string>();
  const out: MetricRecord[] = [];
  for (const o of cartdetails) {
    if (seen.has(`c:${o.id}`)) continue;
    seen.add(`c:${o.id}`);
    const r = b2cRecord(o, verifications[o.id]);
    if (r) out.push(r);
  }
  for (const e of b2bEntries) {
    if (seen.has(`b:${e.id}`)) continue;
    seen.add(`b:${e.id}`);
    out.push(b2bRecord(e, h99PerDay[e.date] || 1));
  }
  return out;
}
