import { useMemo } from "react";
import { rangeFor, toDateStr, useOpsDashboard } from "../../hooks/useOpsDashboard";

const rs = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

const isResolved = (i) => i.resolveStatus === "Resolved" || i.status === "Resolved" || i.status === "resolved";
export const countHighPriorityIssues = (orders) =>
  (orders || []).filter((o) => (o.category === "ISSUES" || o.type === "issue")
    && (o.severity === "critical" || o.severity === "high") && !isResolved(o)).length;

function Tile({ label, value, sub, dark }) {
  return (
    <div className={`rounded-xl border p-5 ${dark ? "border-[#1e5a4c] bg-[#1e5a4c] text-white" : "border-[#dfe8e2] bg-white text-[#172c28]"}`}>
      <p className={`text-[15px] font-medium leading-snug ${dark ? "text-white" : "text-[#172c28]"}`}>{label}</p>
      <p className="mt-2 text-[30px] font-extrabold leading-none tracking-tight">{value}</p>
      <p className={`mt-2 text-[12.5px] leading-snug ${dark ? "text-white/80" : "text-[#58706a]"}`}>{sub}</p>
    </div>
  );
}

function LinkRow({ children, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="block w-full border-b border-[#dfe8e2] py-3 text-left text-[15px] font-semibold text-[#16654e] last:border-0 hover:text-[#10463a]">
      {children}
    </button>
  );
}

export default function BusinessOverview({ orders, onGo }) {
  const range = useMemo(() => rangeFor("day", toDateStr(new Date())), []);
  const m = useOpsDashboard(orders, range, 7);
  const issues = useMemo(() => countHighPriorityIssues(orders), [orders]);
  const { overall, b2b, b2c, delayedDeliveries } = m;
  const top = Math.max(overall.b2bRevenue, overall.b2cRevenue, 1);

  return (
    <div className="space-y-5 px-4 pb-10 pt-6 lg:px-10">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile dark label="Order revenue" value={rs(overall.totalRevenue)} sub="B2B + B2C" />
        <Tile label="Orders placed" value={overall.orders} sub={`${b2b.orders} institutional · ${b2c.orders} consumer`} />
        <Tile label="Overdue deliveries" value={delayedDeliveries} sub="Past promised delivery" />
        <Tile label="High-priority issues" value={issues} sub="Open now" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-[#dfe8e2] bg-white p-6">
          <h2 className="text-[20px] font-extrabold text-[#172c28]">Revenue by channel</h2>
          <div className="mt-5 space-y-3">
            {[["B2B", overall.b2bRevenue], ["B2C", overall.b2cRevenue]].map(([name, value]) => (
              <div key={name} className="flex items-center gap-4">
                <span className="w-9 text-[14px] text-[#3d5450]">{name}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#dfe9e6]">
                  <div className="h-full rounded-full bg-[#258a73]" style={{ width: `${Math.round((value / top) * 100)}%` }} />
                </div>
                <span className="w-24 text-right text-[14px] font-bold text-[#172c28]">{rs(value)}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onGo("analytics", "ops")}
            className="mt-6 text-[15px] font-semibold text-[#16654e] hover:text-[#10463a]">
            View operations &amp; revenue
          </button>
        </section>

        <section className="rounded-xl border border-[#dfe8e2] bg-white p-6">
          <h2 className="text-[20px] font-extrabold text-[#172c28]">Needs attention</h2>
          <div className="mt-3">
            {delayedDeliveries > 0 && (
              <LinkRow onClick={() => onGo("regular")}>
                {delayedDeliveries} consumer deliver{delayedDeliveries === 1 ? "y" : "ies"} overdue
              </LinkRow>
            )}
            {issues > 0 && (
              <LinkRow onClick={() => onGo("issues")}>
                {issues} high-priority issue{issues === 1 ? "" : "s"} open
              </LinkRow>
            )}
            {delayedDeliveries === 0 && issues === 0 && <p className="py-3 text-[14px] text-[#58706a]">Nothing needs attention right now.</p>}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-[#dfe8e2] bg-white p-6">
        <h2 className="text-[20px] font-extrabold text-[#172c28]">Detailed reports</h2>
        <div className="mt-2">
          <LinkRow onClick={() => onGo("analytics", "acquisition")}>Customer acquisition &amp; orders</LinkRow>
          <LinkRow onClick={() => onGo("analytics", "ops")}>Operations &amp; revenue breakdown</LinkRow>
          <LinkRow onClick={() => onGo("kpis")}>Advanced KPIs</LinkRow>
        </div>
      </section>
    </div>
  );
}
