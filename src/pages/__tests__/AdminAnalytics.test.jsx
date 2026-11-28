import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { addDays, buildRows, cohorts, firstOrderMap, today } from "../../utils/analyticsData";

const t = today();
const order = (i, over = {}) => ({
  id: `o${i}`, type: "regular", status: "Delivered", date: addDays(t, -(i % 25)), amount: 100 + i, weight: 2,
  channel: i % 2 ? "App" : "WhatsApp", service: "Wash & Fold", customerName: `Cust ${i % 7}`, customerNumber: `98000000${i % 7}`,
  isPaid: i % 3 === 0, acquisitionSource: "WhatsApp", riderName: i % 2 ? "Maruti" : "", ...over,
});
const sample = [
  ...Array.from({ length: 40 }, (_, i) => order(i)),
  order(100, { status: "Cancelled", cancellationReason: "Price" }),
  order(101, { status: "Pending" }),
  order(102, { type: "student", property: "Tulsi", category: "STUDENT_LAUNDRY" }),
  order(103, { type: "issue" }),
  order(104, { status: "Abandoned" }),
  order(105, { isB2bRoomSync: true }),
];

vi.mock("../../context/HostelAuthContext", () => ({
  useHostelOrders: () => ({ orders: sample, isDataLoaded: true }),
}));

describe("analytics rows", () => {
  it("counts real orders only", () => {
    const rows = buildRows(sample);
    expect(rows.length).toBe(43); // 40 + cancelled + pending + b2b; issue, abandoned, room-sync dropped
    expect(rows.filter((r) => r.b2b).length).toBe(1);
    expect(rows.find((r) => r.id === "o100").reason).toBe("Price");
  });

  it("builds cohorts without throwing", () => {
    const rows = buildRows(sample);
    const out = cohorts(rows, firstOrderMap(rows), addDays(t, -60), t);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("AdminAnalytics page", () => {
  it("renders every report", async () => {
    const { default: AdminAnalytics } = await import("../AdminAnalytics");
    const slugs = [
      "executive-overview", "customer-acquisition-and-orders", "retention-and-cohorts", "order-intelligence",
      "revenue-and-unit-economics", "service-intelligence", "dark-store-and-processing", "rider-and-logistics",
      "location-intelligence", "subscription-analytics", "marketing-and-conversion", "customer-experience",
      "forecasting-and-alerts", "order-records",
    ];
    for (const slug of slugs) {
      const html = renderToString(
        <MemoryRouter initialEntries={[`/admin/analytics/${slug}`]}>
          <Routes><Route path="/admin/analytics/:report" element={<AdminAnalytics />} /></Routes>
        </MemoryRouter>,
      );
      expect(html).toContain("Andes Analytics");
      expect(html).toContain("Business intelligence");
    }
  });
});

describe("service names", () => {
  it("uses real service lines, never the order's description text", async () => {
    const { primaryService } = await import("../../utils/analyticsData");
    expect(primaryService({ service: "11 + 1 More", serviceBreakdown: [{ name: "Iron", amount: 20 }, { name: "Wash & Fold", amount: 200 }] })).toBe("Wash & Fold");
    expect(primaryService({ service: "x", services: [{ serviceName: "Dry Clean_regular", totalCost: 300 }] })).toBe("Dry Clean");
    expect(primaryService({ service: "5 Kg Wash & Fold" })).toBe("Wash & Fold");
    expect(primaryService({ service: "2 Shirts Dryclean" })).toBe("Dry Clean");
    expect(primaryService({ service: "11 + 2 More" })).toBe("Other");
  });
});
