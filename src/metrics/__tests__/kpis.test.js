import { describe, it, expect } from "vitest";
import { buildRecords, computeKpis, eachDay, emptyTotals, firstVerifiedDays, kpisFromTotals, KPI_REGISTRY, mergeTotals, totalsFor } from "../index.js";

const day = "2026-10-20";
const ts = (iso) => ({ toMillis: () => Date.parse(iso) });

// Real customer order: has breakdown + paymentData so normalizeOrder treats it as B2C.
const order = (id, extra = {}) => ({
  id,
  userId: `u-${id}`,
  createdAt: ts("2026-10-20T04:00:00Z"),
  status: "delivered",
  breakdown: { perKg: { items: [{ name: "Wash & Fold", weightKg: 3, amount: 300 }] } },
  paymentData: { totalWithFee: 300 },
  breakdownReady: true,
  originalTotalCost: 300,
  totalCost: 300,
  clothesWeightKg: 3,
  ...extra,
});
const verified = { status: "verified", pickupDate: day, kg: 3 };

function kpis({ cartdetails = [], verifications = {}, b2bEntries = [] }, opts = {}) {
  return computeKpis(buildRecords({ cartdetails, verifications, b2bEntries }), { from: day, to: day, ...opts });
}

describe("revenue", () => {
  it("counts verified orders only; unverified go to the unverified count", () => {
    const k = kpis({
      cartdetails: [order("a"), order("b")],
      verifications: { a: verified },
    });
    expect(k.revenue_total.value).toBe(300);
    expect(k.orders_completed.value).toBe(1);
    expect(k.unverified.value).toBe(1);
  });

  it("excludes cancelled orders and counts them once", () => {
    const k = kpis({
      cartdetails: [order("a", { status: "cancelled" }), order("b")],
      verifications: { a: { ...verified, status: "cancelled" }, b: verified },
    });
    expect(k.revenue_total.value).toBe(300);
    expect(k.orders_cancelled.value).toBe(1);
  });

  it("treats a verified order without a server bill as incomplete, not zero", () => {
    const k = kpis({ cartdetails: [order("a", { breakdownReady: false })], verifications: { a: verified } });
    expect(k.revenue_total.value).toBe(0);
    expect(k.unverified.value).toBe(1);
    expect(k.aov.status).toBe("na");
  });

  it("reports discounts from originalTotalCost − totalCost", () => {
    const k = kpis({
      cartdetails: [order("a", { originalTotalCost: 300, totalCost: 200, couponCode: "MYAGE" })],
      verifications: { a: verified },
    });
    expect(k.revenue_total.value).toBe(200);
    expect(k.discounts.value).toBe(100);
  });

  it("keeps wallet use as revenue but out of cash collected", () => {
    const k = kpis({
      cartdetails: [order("a", { walletAmountUsed: 100, paymentStatus: "completed", paymentRecordedAt: ts("2026-10-20T06:00:00Z") })],
      verifications: { a: verified },
    });
    expect(k.revenue_total.value).toBe(300);
    expect(k.wallet_redeemed.value).toBe(100);
    expect(k.cash_collected.value).toBe(200);
  });

});

describe("dedupe and non-orders", () => {
  it("counts a duplicated doc once", () => {
    const k = kpis({ cartdetails: [order("a"), order("a")], verifications: { a: verified } });
    expect(k.orders_completed.value).toBe(1);
    expect(k.revenue_total.value).toBe(300);
  });

  it("ignores rider tracking records and B2B room-sync docs", () => {
    const k = kpis({
      cartdetails: [
        { id: "t1", createdAt: ts("2026-10-20T04:00:00Z"), services: { servicesConfirmed: false } },
        order("b2b_x_1", { b2bOrderId: "x" }),
      ],
    });
    expect(k.orders_created.value).toBe(0);
  });
});

describe("B2B", () => {
  it("counts verified manager batches and separates B2B from B2C", () => {
    const k = kpis({
      cartdetails: [order("a")],
      verifications: { a: verified },
      b2bEntries: [
        { id: "e1", date: day, client: "Zolo Stays", status: "verified", items: [{ name: "Bedsheet", qty: 10 }] },
        { id: "e2", date: day, client: "Zolo Stays", status: "pending", items: [{ name: "Bedsheet", qty: 10 }] },
      ],
    });
    expect(k.revenue_b2c.value).toBe(300);
    expect(k.revenue_total.value).toBe(k.revenue_b2c.value + k.revenue_b2b.value);
    expect(k.unverified.value).toBe(1);
  });
});

describe("customers", () => {
  it("new paying customers need full history", () => {
    const k = kpis({ cartdetails: [order("a")], verifications: { a: verified } });
    expect(k.new_paying_customers.status).toBe("incomplete");
  });

  it("a returning customer is not new", () => {
    const old = order("old", { userId: "u-a", createdAt: ts("2026-09-01T04:00:00Z") });
    const k = kpis(
      {
        cartdetails: [old, order("a"), order("b")],
        verifications: { old: { ...verified, pickupDate: "2026-09-01" }, a: verified, b: verified },
      },
      { historyComplete: true },
    );
    expect(k.unique_customers.value).toBe(2);
    expect(k.new_paying_customers.value).toBe(1);
  });
});

describe("daily totals", () => {
  it("merging per-day totals gives the same KPIs as computing the whole range", () => {
    const records = buildRecords({
      cartdetails: [
        order("a"),
        order("b", { userId: "u-a", createdAt: ts("2026-10-21T04:00:00Z"), walletAmountUsed: 50, paymentStatus: "paid" }),
        order("c", { createdAt: ts("2026-10-22T04:00:00Z"), status: "cancelled" }),
        order("d", { createdAt: ts("2026-10-22T04:00:00Z") }),
      ],
      verifications: {
        a: verified,
        b: { ...verified, pickupDate: "2026-10-21" },
        c: { ...verified, pickupDate: "2026-10-22", status: "cancelled" },
      },
      b2bEntries: [{ id: "e1", date: "2026-10-21", client: "Hostel 99 A", status: "verified" }],
    });
    const firstDays = firstVerifiedDays(records);
    const daily = eachDay("2026-10-20", "2026-10-22").map((d) => totalsFor(records, d, d, firstDays));
    expect(kpisFromTotals(mergeTotals(daily))).toEqual(
      computeKpis(records, { from: "2026-10-20", to: "2026-10-22", historyComplete: true }),
    );
  });

  it("a range with any day of unknown history reports new customers as incomplete", () => {
    const t = mergeTotals([{ ...emptyTotals(), newCustomerIds: null }, emptyTotals()]);
    expect(kpisFromTotals(t).new_paying_customers.status).toBe("incomplete");
  });
});

describe("registry", () => {
  it("documents every KPI computeKpis returns", () => {
    const k = kpis({});
    for (const key of Object.keys(k)) {
      expect(KPI_REGISTRY[key], key).toBeDefined();
      expect(KPI_REGISTRY[key].formula).toBeTruthy();
    }
  });
});
