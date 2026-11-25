import { useMemo, useState } from "react";
import { rangeFor, toDateStr, useOpsDashboard } from "../../hooks/useOpsDashboard";

const rs = (n) => (n === null || n === undefined || Number.isNaN(n) ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`);
const pct = (n) => (n === null || n === undefined || Number.isNaN(n) ? "—" : `${Math.round(n)}%`);
const MONTH = (d) => d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

function overduePct(money) {
  const total = (money.collected || 0) + (money.pending || 0) + (money.overdue || 0);
  return total > 0 ? ((money.overdue || 0) / total) * 100 : 0;
}

function Kpi({ label, value, previous, what, how }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-[#e3eae8] bg-white p-5">
      <p className="text-[14px] font-medium text-[#3d5450]">{label}</p>
      <p className="mt-2 text-[30px] font-extrabold leading-none tracking-tight text-[#10262b]">{value}</p>
      <p className="mt-2 text-[12.5px] text-[#5f726f]">Previous month: {previous}</p>
      <p className="mt-3 text-[13px] text-[#3d5450]">{what}</p>
      <button type="button" onClick={() => setOpen(!open)} className="mt-3 text-[13px] font-semibold text-[#1b6b58] hover:text-[#10463a]">
        How to measure it
      </button>
      {open && <p className="mt-2 rounded-lg bg-[#f2f7f6] p-3 text-[12.5px] text-[#3d5450]">{how}</p>}
    </div>
  );
}

function Group({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[20px] font-extrabold text-[#10262b]">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

/** Last full month against the month before it. */
export function useKpiMonths() {
  return useMemo(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const before = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { lastMonth, before, range: rangeFor("month", toDateStr(lastMonth)) };
  }, []);
}

export default function AdvancedKpis({ orders }) {
  const { range } = useKpiMonths();
  const m = useOpsDashboard(orders, range, 31);
  const { prev } = m;
  const clientShare = (x) => (x.b2b.clients[0] ? x.b2b.clients[0].share : null);

  return (
    <div className="space-y-8 px-4 pb-10 pt-6 lg:px-10">
      <Group title="Profit and cash">
        <Kpi label="Revenue per kg" value={rs(m.overall.perKg)} previous={rs(prev.overall.perKg)}
          what="Average revenue earned for each kg processed."
          how="Total revenue (B2B + B2C) divided by total kg processed in the month." />
        <Kpi label="Overdue payment share" value={pct(overduePct(m.money))} previous={pct(overduePct(prev.money))}
          what="A rising share means more cash is tied up in unpaid bills."
          how="B2C payments unpaid 7+ days after delivery, as a share of all B2C order value in the month." />
      </Group>

      <Group title="Customers">
        <Kpi label="Largest client share" value={pct(clientShare(m))} previous={pct(clientShare(prev))}
          what="Shows how much B2B revenue depends on one client."
          how="Revenue from the biggest B2B client divided by total B2B revenue in the month." />
        <Kpi label="Average B2C order value" value={rs(m.b2c.aov)} previous={rs(prev.b2c.aov)}
          what="How much a typical consumer order is worth."
          how="B2C revenue divided by the number of B2C orders in the month." />
      </Group>

      <Group title="Delivery and quality">
        <Kpi label="Overdue deliveries now" value={m.delayedDeliveries} previous="—"
          what="Consumer orders picked up 3+ days ago and still not delivered."
          how="Counted today across all B2C orders. It is a live number, so there is no earlier month to compare." />
      </Group>
    </div>
  );
}
