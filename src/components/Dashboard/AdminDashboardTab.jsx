import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { FiDownload, FiInfo, FiRefreshCw, FiX } from "react-icons/fi";
import { db } from "../../firebase";
import {
  KPI_REGISTRY, acquisitionTable, addDays, ageing, eachDay, estimatedContribution, expenseTotals,
  standardCostsOn, todayIst,
} from "../../metrics";
import { CANCELLATION_REASONS } from "../../constants/cancellationReasons";
import { useDailyMetrics } from "../../hooks/useDailyMetrics";
import { useVerifiedMetrics } from "../../hooks/useVerifiedMetrics";
import { useLiveQuery, useNewCustomers, useOpsMetrics } from "../../hooks/useDashboardData";
import AlertStrip from "./AlertStrip";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const money = (n) => (n == null || Number.isNaN(n) ? "—" : inr.format(n));
const card = "bg-white rounded-xl border border-gray-100 p-4";
const label = "text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider";

/** % change vs the prior period; null when there is nothing to compare with. */
const growth = (now, before) => (before ? Math.round(((now - before) / Math.abs(before)) * 1000) / 10 : null);

function Kpi({ title, value, change, note, badge, onClick, info }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${card} relative ${onClick ? "cursor-pointer hover:border-blue-300" : ""}`} onClick={onClick}>
      <div className="flex items-start justify-between gap-1">
        <div className={label}>{title}</div>
        <div className="flex items-center gap-1">
          {badge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{badge}</span>}
          {info && (
            <button type="button" aria-label={`About ${title}`} className="text-gray-400 hover:text-gray-700"
              onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
              <FiInfo size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="text-xl font-extrabold text-[#0F172A] mt-1">{value}</div>
      <div className="text-[11px] mt-1 flex flex-wrap gap-x-2">
        {change != null && <span className={change >= 0 ? "text-emerald-600" : "text-rose-600"}>{change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs prior</span>}
        {note && <span className="text-[#64748B]">{note}</span>}
      </div>
      {open && info && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-[12px] text-gray-700 space-y-1" onClick={(e) => e.stopPropagation()}>
          <div>{info.definition}</div>
          <div><b>Formula:</b> {info.formula}</div>
          <div><b>Source:</b> {info.source}</div>
          {info.limitations && <div><b>Limits:</b> {info.limitations}</div>}
        </div>
      )}
    </div>
  );
}

/**
 * Executive dashboard (spec modules 1–3): finance, orders & pickups, acquisition.
 * Roles without money access (ops) see orders & pickups only; the rules would
 * refuse them the money collections anyway.
 */
export default function AdminDashboardTab({ dateFrom, dateTo, showMoney = true, canAct = true }) {
  return (
    <div className="space-y-5">
      <AlertStrip canAct={canAct} />
      {showMoney ? <FullDashboard dateFrom={dateFrom} dateTo={dateTo} /> : <OpsDashboard dateFrom={dateFrom} dateTo={dateTo} />}
    </div>
  );
}

function OpsDashboard({ dateFrom, dateTo }) {
  const to = dateTo || todayIst();
  const from = dateFrom || addDays(to, -6);
  const ops = useOpsMetrics(from, to);
  return (
    <div className="space-y-5">
      <p className="text-[12px] text-[#64748B]">{from} → {to}</p>
      <OrdersAndPickups state={ops} />
    </div>
  );
}

function FullDashboard({ dateFrom, dateTo }) {
  const today = todayIst();
  const to = dateTo || today;
  const from = dateFrom || addDays(to, -6);
  const days = eachDay(from, to).length;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));

  const [segment, setSegment] = useState("all");
  const [drill, setDrill] = useState(null);

  const cur = useDailyMetrics(from, to);
  const prev = useDailyMetrics(prevFrom, prevTo);
  const ops = useOpsMetrics(from, to);
  const newCustomers = useNewCustomers(from, to);
  const expensesQ = useMemo(() => collection(db, "b2b_expenses"), []);
  const invoicesQ = useMemo(() => query(collection(db, "invoices"), orderBy("issuedDate", "desc")), []);
  const expenses = useLiveQuery(expensesQ);
  const invoices = useLiveQuery(invoicesQ);
  const [costConfig, setCostConfig] = useState(null);
  useEffect(() => onSnapshot(doc(db, "company_config", "standardCosts"), (s) => setCostConfig(s.data() || null),
    (e) => console.error("standardCosts:", e)), []);

  const t = cur.totals;
  const p = prev.totals;
  const rev = (x) => (!x ? null : segment === "B2C" ? x.revenueB2c : segment === "B2B" ? x.revenueB2b : x.revenue);
  const exp = useMemo(() => expenseTotals(expenses, from, to), [expenses, from, to]);
  const prevExp = useMemo(() => expenseTotals(expenses, prevFrom, prevTo), [expenses, prevFrom, prevTo]);
  const contribution = t ? estimatedContribution(t, standardCostsOn(costConfig, to)) : null;
  const aged = useMemo(() => ageing(invoices, to), [invoices, to]);
  const acq = useMemo(
    () => acquisitionTable(newCustomers.filter((c) => c.segment !== "B2B"), expenses.filter((e) => e.category === "Marketing" && (e.incurredDate || e.date) >= from && (e.incurredDate || e.date) <= to)),
    [newCustomers, expenses, from, to],
  );
  const incomplete = cur.missingDays?.length > 0;
  const newPaying = cur.kpis?.new_paying_customers;

  return (
    <div className="space-y-5">
      {/* Header: period, comparison, filters, freshness */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-[#64748B]">
          {from} → {to} ({days} days) · compared with {prevFrom} → {prevTo}
          {cur.computedAt && ` · server totals as of ${cur.computedAt.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}`}
        </p>
        <div className="flex items-center gap-2">
          {["all", "B2C", "B2B"].map((s) => (
            <button key={s} onClick={() => setSegment(s)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border ${segment === s ? "bg-[#0F172A] text-white border-[#0F172A]" : "bg-white border-gray-200"}`}>
              {s === "all" ? "All" : s}
            </button>
          ))}
          <button onClick={() => { cur.refresh(); prev.refresh(); ops.refresh(); }} className="p-2 rounded-lg bg-white border border-gray-200" aria-label="Refresh">
            <FiRefreshCw size={13} className={cur.loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Data-quality notes (server alerts are in AlertStrip above) */}
      {(incomplete || ops.ops?.overdue > 0 || aged.overdue > 0 || cur.kpis?.unverified?.value > 0) && (
        <div className="flex flex-wrap gap-2 text-[12px]">
          {incomplete && <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">Incomplete: {cur.missingDays.length} day(s) not computed yet</span>}
          {cur.kpis?.unverified?.value > 0 && <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">{cur.kpis.unverified.value} orders not yet verified by the manager</span>}
          {ops.ops?.overdue > 0 && <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">{ops.ops.overdue} open orders past their promised delivery</span>}
          {aged.overdue > 0 && <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">{money(aged.overdue)} receivables overdue</span>}
        </div>
      )}

      {/* Top row */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
        <Kpi title={segment === "all" ? "Revenue" : `${segment} revenue`} value={money(rev(t))} change={growth(rev(t), rev(p))}
          info={KPI_REGISTRY.revenue_total} badge={incomplete ? "incomplete" : null} onClick={() => setDrill("revenue")} />
        {segment === "all" && <Kpi title="B2C / B2B" value={t ? `${money(t.revenueB2c)} / ${money(t.revenueB2b)}` : "—"} onClick={() => setDrill("revenue")} />}
        <Kpi title="Contribution" value={contribution?.status === "ok" ? money(contribution.value) : "N/A"}
          note={contribution?.status === "ok" && t?.revenue ? `${Math.round((contribution.value / t.revenue) * 1000) / 10}% margin` : contribution?.reason}
          badge="estimated" />
        <Kpi title="Expenses incurred" value={money(exp.incurred)} change={growth(exp.incurred, prevExp.incurred)} note={`${money(exp.unpaid)} unpaid`} />
        <Kpi title="Completed orders" value={t ? t.ordersCompleted.toLocaleString("en-IN") : "—"} change={growth(t?.ordersCompleted, p?.ordersCompleted)}
          info={KPI_REGISTRY.orders_completed} onClick={() => setDrill("completed")} />
        <Kpi title="New paying customers" value={newPaying?.status === "ok" ? newPaying.value : newPaying?.status === "incomplete" ? "Incomplete" : "—"}
          info={KPI_REGISTRY.new_paying_customers} note={newPaying?.reason} />
        <Kpi title="Marketing spend" value={money(exp.marketing)} change={growth(exp.marketing, prevExp.marketing)} />
        <Kpi title="Cash collected" value={money(t?.cashCollected)} change={growth(t?.cashCollected, p?.cashCollected)}
          info={KPI_REGISTRY.cash_collected} onClick={() => setDrill("cash")} />
        <Kpi title="Receivables" value={money(aged.total)} note={`${money(aged.overdue)} overdue`} />
        <Kpi title="AOV" value={cur.kpis?.aov?.status === "ok" ? money(cur.kpis.aov.value) : "N/A"} change={growth(cur.kpis?.aov?.value, prev.kpis?.aov?.value)} info={KPI_REGISTRY.aov} />
        <Kpi title="Not yet verified" value={t ? t.unverified : "—"} info={KPI_REGISTRY.unverified} onClick={() => setDrill("unverified")} />
        <Kpi title="Cancelled" value={t ? t.ordersCancelled : "—"} info={KPI_REGISTRY.orders_cancelled} onClick={() => setDrill("cancelled")} />
      </div>

      {drill && <DrillDown kind={drill} from={from} to={to} segment={segment} onClose={() => setDrill(null)} />}

      <OrdersAndPickups state={ops} />
      <Acquisition rows={acq} newPaying={newPaying} />
    </div>
  );
}

const DRILLS = {
  revenue: { title: "Verified revenue", pick: (r) => r.verificationStatus === "verified" && r.billReady && !r.cancelled, amount: (r) => r.bill },
  completed: { title: "Completed (verified) orders", pick: (r) => r.verificationStatus === "verified" && r.billReady && !r.cancelled, amount: (r) => r.bill },
  unverified: { title: "Not yet verified", pick: (r) => !r.cancelled && !(r.verificationStatus === "verified" && r.billReady), amount: (r) => r.bill ?? 0 },
  cancelled: { title: "Cancelled", pick: (r) => r.cancelled, amount: () => 0 },
  cash: { title: "Cash collected", pick: (r) => r.segment === "B2C" && !r.cancelled && r.isPaid && r.billReady, amount: (r) => Math.max(0, r.bill - r.walletUsed), byPaidDay: true },
};

/** Rows behind a KPI, read live from orders; the total should match the card. */
function DrillDown({ kind, from, to, segment, onClose }) {
  const { records, loading, error } = useVerifiedMetrics(from, to);
  const d = DRILLS[kind];
  const rows = useMemo(() => records
    .filter((r) => (d.byPaidDay ? r.paidDay : r.day) >= from && (d.byPaidDay ? r.paidDay : r.day) <= to)
    .filter((r) => segment === "all" || r.segment === segment)
    .filter(d.pick), [records, d, from, to, segment]);
  const total = rows.reduce((s, r) => s + (d.amount(r) || 0), 0);

  const csv = () => {
    const head = ["id", "segment", "day", "status", "bill", "wallet", "paid", "paidDay", "kg", "customer"];
    const body = rows.map((r) => [r.id, r.segment, r.day, r.verificationStatus, r.bill ?? "", r.walletUsed, r.isPaid, r.paidDay ?? "", r.kg, r.customerId ?? ""]);
    const text = [head, ...body].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    a.download = `${kind}_${from}_${to}.csv`;
    a.click();
  };

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-[15px] font-bold">{d.title} · {rows.length} rows · {money(total)}</h3>
        <div className="flex gap-2">
          <button onClick={csv} disabled={!rows.length} className="flex items-center gap-1 text-[12px] font-bold px-3 py-1.5 rounded-lg border border-gray-200"><FiDownload size={12} /> CSV</button>
          <button onClick={onClose} aria-label="Close" className="p-1.5"><FiX /></button>
        </div>
      </div>
      {loading ? <p className="text-[13px] text-[#64748B]">Loading orders…</p> : error ? <p className="text-[13px] text-rose-700">{error}</p> : (
        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-[12px]">
            <thead className="text-left text-[11px] uppercase text-[#94A3B8] sticky top-0 bg-white">
              <tr><th className="py-1.5">Order / batch</th><th>Segment</th><th>Day</th><th>Status</th><th className="text-right">Amount</th><th className="text-right">Wallet</th><th>Paid</th><th className="text-right">kg</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.source}:${r.id}`} className="border-t border-gray-100">
                  <td className="py-1.5 font-mono">{r.id}</td><td>{r.segment}</td><td>{r.day}</td><td>{r.verificationStatus}</td>
                  <td className="text-right">{money(d.amount(r))}</td><td className="text-right">{r.walletUsed ? money(r.walletUsed) : ""}</td>
                  <td>{r.isPaid ? r.paidDay || "yes" : ""}</td><td className="text-right">{r.kg || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-[#94A3B8] mt-2">Read live from orders; the card uses the server's daily totals, which refresh every 30 minutes.</p>
    </section>
  );
}

function OrdersAndPickups({ state }) {
  const o = state.ops;
  const stat = (t, v, n) => (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-[11px] text-[#64748B]">{t}</div>
      <div className="font-bold text-[#0F172A]">{v ?? "—"}</div>
      {n && <div className="text-[10px] text-[#94A3B8]">{n}</div>}
    </div>
  );
  return (
    <section className={card}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-bold">Orders & pickups</h3>
        {o?.reconstructedEvents > 0 && <span className="text-[11px] text-amber-700">{o.reconstructedEvents} events rebuilt from old orders (approximate)</span>}
      </div>
      {state.error ? <p className="text-[13px] text-rose-700">{state.error}</p> : !o ? <p className="text-[13px] text-[#64748B]">Loading…</p> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {stat("Created", o.created)}
            {stat("Pickups done", o.pickupsCompleted)}
            {stat("Pickups failed", o.pickupsFailed)}
            {stat("Pickups rescheduled", o.pickupsRescheduled, `${o.repeatedlyRescheduled} orders 2+ times`)}
            {stat("Cancelled", o.cancelled, "unique orders")}
            {stat("Deliveries due", o.deliveriesDue)}
            {stat("Delivered", o.deliveriesCompleted)}
            {stat("On time", o.onTimePct == null ? "N/A" : `${o.onTimePct}%`, "vs promised slot end")}
            {stat("Avg cycle", o.avgCycleHours == null ? "N/A" : `${o.avgCycleHours} h`, "order → delivered")}
            {stat("Overdue now", o.overdue, "open, past promise")}
            {stat("Deliveries rescheduled", o.deliveriesRescheduled)}
          </div>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <div className={`${label} mb-1`}>Open orders by stage</div>
              {Object.entries(o.pendingByStage).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                <div key={s} className="flex justify-between text-[13px] py-0.5"><span className="capitalize">{s}</span><b>{n}</b></div>
              ))}
            </div>
            <div>
              <div className={`${label} mb-1`}>Cancellation reasons</div>
              {Object.keys(o.cancellationReasons).length === 0 ? <p className="text-[13px] text-[#64748B]">None</p> :
                Object.entries(o.cancellationReasons).sort((a, b) => b[1] - a[1]).map(([r, n]) => (
                  <div key={r} className="flex justify-between text-[13px] py-0.5"><span>{CANCELLATION_REASONS[r] || (r === "unknown" ? "Not recorded" : r)}</span><b>{n}</b></div>
                ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Acquisition({ rows, newPaying }) {
  return (
    <section className={card}>
      <h3 className="text-[15px] font-bold mb-1">Acquisition</h3>
      <p className="text-[12px] text-[#64748B] mb-3">
        New paying B2C customers by first-touch source (referral → ad campaign → sign-up answer → manual tag). Spend = Marketing expenses by campaign/source; referral spend is ₹200 per referred customer (estimated).
      </p>
      {newPaying?.status === "incomplete" ? <p className="text-[13px] text-amber-700">Needs the full-history backfill before new customers can be counted.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[11px] uppercase text-[#94A3B8]">
              <tr><th className="py-1.5">Source</th><th className="text-right">New paying</th><th className="text-right">Spend</th><th className="text-right">CAC</th><th className="text-right">First-order revenue</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="py-2 text-[#64748B]">No new paying customers or spend in this period.</td></tr>}
              {rows.map((r) => (
                <tr key={r.source} className="border-t border-gray-100">
                  <td className="py-1.5">{r.source}</td>
                  <td className="text-right">{r.newPaying}</td>
                  <td className="text-right">{money(r.spend)}{r.spendEstimated && <span className="text-[10px] text-amber-700"> est.</span>}</td>
                  <td className="text-right">{r.cac == null ? <span className="text-[#94A3B8]">N/A — no new customers</span> : money(r.cac)}</td>
                  <td className="text-right">{money(r.firstOrderRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
