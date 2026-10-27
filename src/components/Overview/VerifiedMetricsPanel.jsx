import { useState } from "react";
import { FiInfo, FiRefreshCw } from "react-icons/fi";
import { KPI_REGISTRY } from "../../metrics";
import { useDailyMetrics } from "../../hooks/useDailyMetrics";

const MONEY = new Set(["revenue_total", "revenue_b2c", "revenue_b2b", "discounts", "wallet_redeemed", "cash_collected", "aov"]);
const ORDER = [
  "revenue_total", "revenue_b2c", "revenue_b2b", "cash_collected",
  "orders_completed", "unverified", "orders_created", "orders_cancelled",
  "unique_customers", "new_paying_customers", "aov", "avg_kg", "discounts", "wallet_redeemed",
];
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function display(key, r) {
  if (!r) return "—";
  if (r.status === "incomplete") return "Incomplete";
  if (r.status === "na") return "N/A";
  if (MONEY.has(key)) return inr.format(r.value);
  if (key === "avg_kg") return `${r.value.toFixed(1)} kg`;
  return r.value.toLocaleString("en-IN");
}

function Metric({ k, result }) {
  const [open, setOpen] = useState(false);
  const def = KPI_REGISTRY[k];
  const flagged = result && (result.status !== "ok" || result.note || (k === "unverified" && result.value > 0));
  return (
    <div className={`relative bg-white rounded-xl border p-4 ${flagged ? "border-amber-300" : "border-gray-100"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">{def.label}</div>
        <button type="button" aria-label={`About ${def.label}`} onClick={() => setOpen((o) => !o)} className="text-gray-400 hover:text-gray-700">
          <FiInfo size={14} />
        </button>
      </div>
      <div className="text-xl font-extrabold text-[#0F172A] mt-1">{display(k, result)}</div>
      {(result?.note || result?.reason) && <div className="text-[11px] text-amber-700 mt-1">{result.note || result.reason}</div>}
      {open && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-[12px] text-gray-700 space-y-1">
          <div>{def.definition}</div>
          <div><b>Formula:</b> {def.formula}</div>
          <div><b>Source:</b> {def.source}</div>
          {def.limitations && <div><b>Limits:</b> {def.limitations}</div>}
        </div>
      )}
    </div>
  );
}

/** P0 KPIs from the server's dailyMetrics: verified orders only, one definition per figure. */
export default function VerifiedMetricsPanel({ dateFrom, dateTo }) {
  const { loading, error, kpis, missingDays, computedAt, refresh } = useDailyMetrics(dateFrom, dateTo);
  return (
    <section className="bg-slate-50 rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold text-[#0F172A]">Verified metrics (beta)</h2>
          <p className="text-[12px] text-[#64748B]">
            {dateFrom} → {dateTo} · pickup day, IST · verified by manager only
            {computedAt && ` · server totals as of ${computedAt.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}`}
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={loading} className="flex items-center gap-1 text-[12px] font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-200 disabled:opacity-50">
          <FiRefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>
      {!error && missingDays.length > 0 && (
        <div className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Incomplete: {missingDays.length} day{missingDays.length > 1 ? "s" : ""} not computed yet ({missingDays.slice(0, 3).join(", ")}{missingDays.length > 3 ? ", …" : ""}). Figures below leave them out.
        </div>
      )}
      {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">Could not load: {error}</div>}
      {!error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {ORDER.map((k) => <Metric key={k} k={k} result={loading && !kpis ? null : kpis?.[k]} />)}
        </div>
      )}
    </section>
  );
}
