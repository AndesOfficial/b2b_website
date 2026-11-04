import { describe, it, expect } from "vitest";
import { evaluateAlerts } from "../index.js";
import { canEdit, canSeeTab, isAdminRole, seesMoney } from "../../config/roles.js";

const quiet = { overdueOrders: 0, unverifiedOld: 0, receivablesOverdue: 0, revenueYesterday: 1000, revenueAvg7: 1000, cashBalance: 50000 };
const fired = (inputs, overrides) => evaluateAlerts(inputs, overrides).filter((a) => a.triggered).map((a) => a.rule);

describe("alerts", () => {
  it("nothing fires on a normal day", () => {
    expect(fired(quiet)).toEqual([]);
  });

  it("fires overdue, backlog, receivables and revenue-drop rules", () => {
    expect(fired({ ...quiet, overdueOrders: 2, unverifiedOld: 1, receivablesOverdue: 5000, revenueYesterday: 400 }))
      .toEqual(["overdue_orders", "unverified_backlog", "receivables_overdue", "revenue_drop"]);
  });

  it("respects thresholds and disabled rules; cash_low is off until enabled", () => {
    expect(fired({ ...quiet, overdueOrders: 2 }, { overdue_orders: { threshold: 5 } })).toEqual([]);
    expect(fired({ ...quiet, overdueOrders: 2 }, { overdue_orders: { enabled: false } })).toEqual([]);
    expect(fired({ ...quiet, cashBalance: 100 })).toEqual([]);
    expect(fired({ ...quiet, cashBalance: 100 }, { cash_low: { enabled: true, threshold: 10000 } })).toEqual(["cash_low"]);
  });

  it("no revenue-drop alert without history", () => {
    expect(fired({ ...quiet, revenueYesterday: 0, revenueAvg7: null })).toEqual([]);
  });
});

describe("roles", () => {
  it("ops sees orders but no money; finance sees money but not order ops", () => {
    expect(isAdminRole("ops") && isAdminRole("finance")).toBe(true);
    expect(isAdminRole("client")).toBe(false);
    expect(canSeeTab("ops", "regular")).toBe(true);
    expect(canSeeTab("ops", "finance")).toBe(false);
    expect(canSeeTab("ops", "expenses")).toBe(false);
    expect(seesMoney("ops")).toBe(false);
    expect(canSeeTab("finance", "finance")).toBe(true);
    expect(canSeeTab("finance", "regular")).toBe(false);
  });

  it("viewers see everything and edit nothing", () => {
    expect(canSeeTab("admin_viewer", "finance")).toBe(true);
    expect(canEdit("admin_viewer")).toBe(false);
    expect(canEdit("finance")).toBe(true);
  });
});
