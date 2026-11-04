// Orders & pickups (spec module 2) from orderEvents plus the open orders.
// Pickups, failures and reschedules count EVENTS (one order rescheduled three
// times is three reschedules); cancellations count unique orders.

const ms = (v: any): number | null => {
  if (!v) return null;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (typeof v.seconds === "number") return v.seconds * 1000;
  const p = Date.parse(v);
  return Number.isFinite(p) ? p : null;
};

/** Order statuses that are still in progress (mirrors functions/src/assignment.ts ACTIVE_STATUSES + pending). */
export const OPEN_STATUSES = [
  "pending", "confirmed", "in_progress", "pickup partner on the way", "order picked up",
  "reached laundry facility", "processing", "ready for delivery", "delivery partner on the way", "out for delivery",
];
const PICKED_UP = "order picked up";

export interface OpsMetrics {
  created: number;
  pickupsCompleted: number;
  pickupsFailed: number;
  pickupsRescheduled: number;
  deliveriesRescheduled: number;
  /** Orders rescheduled 2+ times in the period. */
  repeatedlyRescheduled: number;
  cancelled: number;
  cancellationReasons: Record<string, number>;
  deliveriesCompleted: number;
  /** Open or delivered orders whose promise falls in the period. */
  deliveriesDue: number;
  /** Delivered in the period by the promise, of those with a promise. Null when none. */
  onTimePct: number | null;
  /** Average hours from order creation to delivery, for deliveries in the period. Null when none. */
  avgCycleHours: number | null;
  /** Open orders past their promised delivery time at `now`. */
  overdue: number;
  pendingByStage: Record<string, number>;
  reconstructedEvents: number;
}

/**
 * @param events  orderEvents with `at` in the period ({ orderId, type, to, reason, at, reconstructed })
 * @param orders  order docs by id: every order named in `events`, plus all open orders
 * @param period  { fromMs, toMs } window the promises are checked against; now = current time
 */
export function opsMetrics(events: any[], orders: Record<string, any>, { fromMs, toMs, now }: { fromMs: number; toMs: number; now: number }): OpsMetrics {
  const count = (t: string) => events.filter((e) => e.type === t).length;
  const reschedules: Record<string, number> = {};
  for (const e of events) {
    if (e.type === "pickup_rescheduled" || e.type === "delivery_rescheduled") reschedules[e.orderId] = (reschedules[e.orderId] || 0) + 1;
  }
  const cancelledEvents = events.filter((e) => e.type === "cancelled");
  const cancelledIds = new Set(cancelledEvents.map((e) => e.orderId));
  const cancellationReasons: Record<string, number> = {};
  const seenCancel = new Set<string>();
  for (const e of cancelledEvents) {
    if (seenCancel.has(e.orderId)) continue;
    seenCancel.add(e.orderId);
    const r = e.reason || orders[e.orderId]?.cancellationReasonCode || "unknown";
    cancellationReasons[r] = (cancellationReasons[r] || 0) + 1;
  }

  const delivered = events.filter((e) => e.type === "delivered");
  const deliveredIds = new Set(delivered.map((e) => e.orderId));
  let promised = 0;
  let onTime = 0;
  const cycles: number[] = [];
  for (const e of delivered) {
    const o = orders[e.orderId] || {};
    const at = ms(e.at);
    const p = ms(o.promisedDeliveryAt);
    if (at != null && p != null) {
      promised++;
      if (at <= p) onTime++;
    }
    const created = ms(o.createdAt);
    if (at != null && created != null && at >= created) cycles.push((at - created) / 3600000);
  }

  const pendingByStage: Record<string, number> = {};
  let overdue = 0;
  let due = 0;
  for (const [id, o] of Object.entries(orders)) {
    const status = String(o.status || "").toLowerCase().trim();
    const p = ms(o.promisedDeliveryAt);
    const open = OPEN_STATUSES.includes(status);
    if (p != null && p >= fromMs && p <= toMs && (open || deliveredIds.has(id))) due++;
    if (!open) continue;
    pendingByStage[status] = (pendingByStage[status] || 0) + 1;
    if (p != null && p < now) overdue++;
  }

  return {
    created: count("created"),
    pickupsCompleted: events.filter((e) => e.type === "status" && String(e.to).toLowerCase() === PICKED_UP).length,
    pickupsFailed: count("pickup_failed"),
    pickupsRescheduled: count("pickup_rescheduled"),
    deliveriesRescheduled: count("delivery_rescheduled"),
    repeatedlyRescheduled: Object.values(reschedules).filter((n) => n >= 2).length,
    cancelled: cancelledIds.size,
    cancellationReasons,
    deliveriesCompleted: deliveredIds.size,
    deliveriesDue: due,
    onTimePct: promised ? Math.round((onTime / promised) * 1000) / 10 : null,
    avgCycleHours: cycles.length ? Math.round((cycles.reduce((s, h) => s + h, 0) / cycles.length) * 10) / 10 : null,
    overdue,
    pendingByStage,
    reconstructedEvents: events.filter((e) => e.reconstructed).length,
  };
}
