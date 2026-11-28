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

vi.mock("../../firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({ collection: () => ({}), getDocs: () => Promise.resolve({ docs: [] }) }));
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
    const { AnalyticsView } = await import("../AdminAnalytics");
    const { buildCatalog } = await import("../../utils/analyticsData");
    const catalog = buildCatalog([{ serviceName: "Wash & Fold", category: "general", status: "active" }]);
    const slugs = [
      "executive-overview", "customer-acquisition-and-orders", "retention-and-cohorts", "order-intelligence",
      "revenue-and-unit-economics", "service-intelligence", "dark-store-and-processing", "rider-and-logistics",
      "location-intelligence", "subscription-analytics", "marketing-and-conversion", "customer-experience",
      "forecasting-and-alerts", "order-records",
    ];
    for (const slug of slugs) {
      const html = renderToString(
        <MemoryRouter initialEntries={[`/admin/analytics/${slug}`]}>
          <Routes><Route path="/admin/analytics/:report" element={<AnalyticsView orders={sample} catalog={catalog} />} /></Routes>
        </MemoryRouter>,
      );
      expect(html).toContain("Andes Analytics");
      expect(html).toContain("Business intelligence");
    }
  });
});

describe("service names", () => {
  it("matches order lines to the prices catalog and ignores everything else", async () => {
    const { buildCatalog, primaryService } = await import("../../utils/analyticsData");
    const catalog = buildCatalog([
      { serviceName: "Wash & Fold", category: "general", status: "active" },
      { serviceName: "Shirt/Pant", category: "dry cleaning", status: "active", subServices: [{ name: "Shirts(Wash)" }] },
    ]);
    expect(primaryService({ serviceBreakdown: [{ name: "11", amount: 900 }, { name: "Wash & Fold_regular", amount: 200 }] }, catalog)).toBe("Wash & Fold");
    expect(primaryService({ serviceBreakdown: [{ name: "totalCost", amount: 5 }, { name: "Shirts(Wash) piece", amount: 80 }] }, catalog)).toBe("Shirt/Pant");
    expect(primaryService({ service: "11 + 1 More" }, catalog)).toBe("Other");
    expect(primaryService({ serviceBreakdown: [{ name: "Cancelled on 31 Aug", amount: 1 }] }, catalog)).toBe("Other");
  });
});
