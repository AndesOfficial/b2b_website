// The few facts about a raw cartdetails doc that metrics need. Mirrors the
// Admin site's utils/orderNormalization.js (normalizeOrder, resolvePaymentInfo)
// without its UI-only dependencies, so the server can run the same maths.

/** Rider creates `b2b_<orderId>_<i>` docs in cartdetails for hostel rooms; they are not orders. */
export function isB2bRoomSync(o: any): boolean {
  return !!(
    o.b2bOrderId ||
    (typeof o.id === "string" && o.id.startsWith("b2b_")) ||
    o.roomNo ||
    (typeof o.userName === "string" && o.userName.startsWith("Room "))
  );
}

/** Rider tracking records have no bill and no numeric services. */
export function isRiderTracking(o: any): boolean {
  const hasBill = !!(o.breakdown || o.paymentData || o.totalCost || o.originalTotalCost);
  const hasNumericServices = !!o.services && !Array.isArray(o.services) &&
    Object.values(o.services).some((v) => typeof v === "number" && v > 0);
  return !hasBill && !hasNumericServices;
}

export function isPaid(o: any): boolean {
  const status = String(o.paymentStatus || o.payment_status || "").toLowerCase();
  return o.paymentDoneOnDelivery === true || o.payment_done_on_delivery === true ||
    ["completed", "paid", "success"].includes(status) ||
    !!(o.paymentRecordedAt || o.payment_recorded_at);
}

export function paymentRecordedAt(o: any): unknown {
  return o.paymentRecordedAt || o.payment_recorded_at || null;
}

export function customerPhone(o: any): string | null {
  const digits = String(o.userMobile || o.customerNumber || o.userPhone || o.phoneNumber || o.customerPhone || "")
    .replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export function orderKg(o: any): number {
  for (const v of [o.clothesWeightKg, o.weightKg, o.weight, o.totalWeight]) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}
