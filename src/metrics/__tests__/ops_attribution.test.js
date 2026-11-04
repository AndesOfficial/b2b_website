import { describe, it, expect } from "vitest";
import { acquisitionTable, firstTouchSource, matchSource, opsMetrics } from "../index.js";

const at = (iso) => ({ toMillis: () => Date.parse(iso) });
const period = { fromMs: Date.parse("2026-10-20T00:00:00+05:30"), toMs: Date.parse("2026-10-26T23:59:59+05:30"), now: Date.parse("2026-10-27T12:00:00+05:30") };

describe("orders & pickups", () => {
  const events = [
    { orderId: "a", type: "created", at: at("2026-10-20T05:00:00Z") },
    { orderId: "a", type: "pickup_rescheduled", at: at("2026-10-20T06:00:00Z") },
    { orderId: "a", type: "pickup_rescheduled", at: at("2026-10-21T06:00:00Z") },
    { orderId: "a", type: "pickup_rescheduled", at: at("2026-10-22T06:00:00Z") },
    { orderId: "a", type: "status", to: "order picked up", at: at("2026-10-22T10:00:00Z") },
    { orderId: "a", type: "delivered", at: at("2026-10-24T10:00:00Z") },
    { orderId: "b", type: "cancelled", reason: "price", at: at("2026-10-21T05:00:00Z") },
    { orderId: "b", type: "cancelled", reason: "price", at: at("2026-10-21T05:01:00Z") },
    { orderId: "c", type: "pickup_failed", at: at("2026-10-23T05:00:00Z") },
  ];
  const orders = {
    a: { status: "delivered", createdAt: at("2026-10-20T05:00:00Z"), promisedDeliveryAt: at("2026-10-24T15:30:00Z") },
    b: { status: "cancelled" },
    c: { status: "pending", promisedDeliveryAt: at("2026-10-26T15:30:00Z") },
    d: { status: "out for delivery", promisedDeliveryAt: at("2026-10-28T15:30:00Z") },
  };

  it("counts reschedules as events, cancellations as unique orders", () => {
    const o = opsMetrics(events, orders, period);
    expect(o).toMatchObject({
      created: 1, pickupsRescheduled: 3, repeatedlyRescheduled: 1, pickupsCompleted: 1, pickupsFailed: 1,
      cancelled: 1, cancellationReasons: { price: 1 }, deliveriesCompleted: 1,
    });
  });

  it("on time vs the promise, overdue open orders, cycle time, due and stages", () => {
    const o = opsMetrics(events, orders, period);
    expect(o.onTimePct).toBe(100);
    expect(o.avgCycleHours).toBe(101);
    expect(o.overdue).toBe(1); // c: promised 26 Oct, still pending on 27 Oct
    expect(o.deliveriesDue).toBe(2); // a (delivered) and c; d is due after the period
    expect(o.pendingByStage).toEqual({ pending: 1, "out for delivery": 1 });
  });

  it("late delivery lowers on-time %", () => {
    const late = opsMetrics([{ orderId: "a", type: "delivered", at: at("2026-10-25T10:00:00Z") }], orders, period);
    expect(late.onTimePct).toBe(0);
  });
});

describe("acquisition", () => {
  it("first touch: referral beats campaign beats sign-up answer beats manual tag", () => {
    expect(firstTouchSource({ referredBy: "x", acquisitionCampaign: "meta" })).toBe("Referral");
    expect(firstTouchSource({ acquisitionCampaign: "meta", selfReportedSource: "Instagram" })).toBe("Paid Advertising");
    expect(firstTouchSource({ selfReportedSource: "insta story" }, "WhatsApp")).toBe("Instagram");
    expect(firstTouchSource({}, "WhatsApp")).toBe("WhatsApp");
    expect(firstTouchSource(undefined)).toBe("Other / Unknown");
    expect(matchSource("meta ad oct")).toBe("Paid Advertising");
  });

  it("CAC per source; N/A when spend found no new customers; referral spend estimated", () => {
    const rows = acquisitionTable(
      [{ source: "Referral", firstOrderRevenue: 300 }, { source: "Referral", firstOrderRevenue: 200 }, { source: "Paid Advertising", firstOrderRevenue: 400 }],
      [{ amount: 3000, campaignId: "meta_oct" }, { amount: 500, campaignId: "instagram boost" }],
    );
    const by = Object.fromEntries(rows.map((r) => [r.source, r]));
    expect(by.Referral).toMatchObject({ newPaying: 2, spend: 400, cac: 200, firstOrderRevenue: 500, spendEstimated: true });
    expect(by["Paid Advertising"]).toMatchObject({ newPaying: 1, spend: 3000, cac: 3000 });
    expect(by.Instagram).toMatchObject({ newPaying: 0, spend: 500, cac: null });
  });
});
