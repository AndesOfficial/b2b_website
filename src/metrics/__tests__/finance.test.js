import { describe, it, expect } from "vitest";
import {
  ageing, cashBalance, dso, estimatedContribution, expenseTotals, findDuplicateExpenses,
  invoiceOutstanding, invoiceStatus, normalizeExpense, standardCostsOn,
} from "../index.js";

describe("expenses", () => {
  it("old docs: one date is both incurred and paid; Unpaid has no paid date; legacy category mapped", () => {
    expect(normalizeExpense({ id: "x", amount: 100, date: "2026-10-01", type: "Paid", category: "Team Member Salary", payee: "Ravi" }))
      .toMatchObject({ incurredDate: "2026-10-01", paidDate: "2026-10-01", category: "Salaries", nature: "fixed", vendor: "Ravi" });
    expect(normalizeExpense({ id: "y", amount: 100, date: "2026-10-01", type: "Payable" }).paidDate).toBeNull();
  });

  it("splits incurred (P&L) from paid (cash) by their own dates", () => {
    const rows = [
      { id: "rent", amount: 30000, category: "Rent", incurredDate: "2026-09-30", paidDate: "2026-10-05" },
      { id: "ads", amount: 5000, category: "Marketing", incurredDate: "2026-10-10", paidDate: null },
      { id: "soap", amount: 2000, category: "Detergent & consumables", incurredDate: "2026-10-12", paidDate: "2026-10-12" },
    ];
    const oct = expenseTotals(rows, "2026-10-01", "2026-10-31");
    expect(oct).toMatchObject({ incurred: 7000, paid: 32000, unpaid: 5000, fixed: 0, variable: 7000, marketing: 5000 });
    expect(expenseTotals(rows, "2026-09-01", "2026-09-30")).toMatchObject({ incurred: 30000, paid: 0, fixed: 30000 });
  });

  it("warns on same vendor + invoice number, or same vendor + amount within 3 days", () => {
    const existing = [
      { id: "a", amount: 1200, payee: "Surf Supplies", invoiceNo: "SS-9", date: "2026-10-01" },
      { id: "b", amount: 800, payee: "Fuel Co", date: "2026-10-01" },
    ];
    expect(findDuplicateExpenses({ amount: 99, vendor: "surf supplies", invoiceNo: "ss-9", incurredDate: "2026-11-20" }, existing).map((e) => e.id)).toEqual(["a"]);
    expect(findDuplicateExpenses({ amount: 800, vendor: "Fuel Co", incurredDate: "2026-10-03" }, existing).map((e) => e.id)).toEqual(["b"]);
    expect(findDuplicateExpenses({ amount: 800, vendor: "Fuel Co", incurredDate: "2026-10-06" }, existing)).toEqual([]);
    expect(findDuplicateExpenses({ id: "b", amount: 800, vendor: "Fuel Co", incurredDate: "2026-10-01" }, existing)).toEqual([]);
  });
});

describe("receivables", () => {
  const invoices = [
    { invoiceNo: "1", amount: 1000, issuedDate: "2026-10-20", dueDate: "2026-11-04", payments: [] },
    { invoiceNo: "2", amount: 2000, issuedDate: "2026-09-20", dueDate: "2026-10-05", payments: [{ amount: 500 }] },
    { invoiceNo: "3", amount: 4000, issuedDate: "2026-08-01", dueDate: "2026-08-16", payments: [{ amount: 4000 }] },
    { invoiceNo: "4", amount: 9000, issuedDate: "2026-07-01", status: "void", payments: [] },
  ];

  it("status and outstanding follow the payments", () => {
    expect(invoices.map(invoiceStatus)).toEqual(["unpaid", "partial", "paid", "void"]);
    expect(invoices.map(invoiceOutstanding)).toEqual([1000, 1500, 0, 0]);
  });

  it("ages outstanding by days since issue", () => {
    expect(ageing(invoices, "2026-10-27")).toEqual({ "0–15": 1000, "16–30": 0, "31–60": 1500, "60+": 0, total: 2500, overdue: 1500 });
  });

  it("DSO = receivables ÷ last 30 days' invoicing × 30; null with no invoicing", () => {
    expect(dso(invoices, "2026-10-27")).toBe(75);
    expect(dso([], "2026-10-27")).toBeNull();
  });
});

describe("cash and standard costs", () => {
  it("cash balance is the latest entry on or before the day", () => {
    const entries = [
      { date: "2026-10-20", accounts: { bank: 100, cash: 50 } },
      { date: "2026-10-25", accounts: { bank: 300, upi: 20 } },
    ];
    expect(cashBalance(entries, "2026-10-24")).toMatchObject({ date: "2026-10-20", total: 150 });
    expect(cashBalance(entries, "2026-10-27").total).toBe(320);
    expect(cashBalance(entries, "2026-10-01")).toBeNull();
  });

  it("uses the costs in force on the day and never spreads fixed costs", () => {
    const config = { versions: [
      { effectiveFrom: "2026-01-01", perKg: { default: 10 }, packagingPerOrder: 5, deliveryPerStop: 20, paymentFeePct: 2 },
      { effectiveFrom: "2026-10-15", perKg: { default: 12 }, packagingPerOrder: 5, deliveryPerStop: 20, paymentFeePct: 2 },
    ] };
    const costs = standardCostsOn(config, "2026-10-20");
    expect(costs.perKg.default).toBe(12);
    const c = estimatedContribution({ revenue: 1000, kgSum: 10, ordersCompleted: 2, cashCollected: 500 }, costs);
    // 10 kg × 12 + 2 × (5 + 2 × 20) + 2% of 500 = 120 + 90 + 10
    expect(c).toEqual({ status: "ok", value: 780, variableCosts: 220, estimated: true });
    expect(estimatedContribution({ revenue: 1000, kgSum: 10, ordersCompleted: 2, cashCollected: 0 }, standardCostsOn(config, "2025-12-31")).status).toBe("na");
  });
});
