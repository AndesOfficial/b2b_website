import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FiAlertTriangle, FiArrowDown, FiCheckCircle, FiInfo } from "react-icons/fi";
import { rangeFor, toDateStr, useOpsDashboard } from "../../hooks/useOpsDashboard";

const B2B_COLOR = "#2563EB";
const B2C_COLOR = "#059669";

const kg = (n) => (n === null || n === undefined ? "—" : `${(Math.round(n * 10) / 10).toLocaleString("en-IN")} KG`);
const rs = (n) => (n === null || n === undefined ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`);
const rsKg = (n) => (n === null || n === undefined ? "—" : `₹${(Math.round(n * 10) / 10).toLocaleString("en-IN")}/kg`);
const pct = (n) => `${Math.round(n)}%`;
const num = (n) => (n === null || n === undefined ? "—" : Math.round(n * 10) / 10);

const PERIODS = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "custom", label: "Custom Range" },
];

function prettyRange(r) {
  const f = (s) => new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return r.from === r.to ? f(r.from) : `${f(r.from)} – ${f(r.to)}`;
}

function Section({ index, title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:p-6">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="text-xs font-black tracking-widest text-slate-400">{String(index).padStart(2, "0")}</span>
        <h2 className="text-lg font-extrabold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, hint, accent, big }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-1 font-extrabold tracking-tight ${big ? "text-2xl lg:text-3xl" : "text-xl lg:text-2xl"}`} style={{ color: accent || "#0F172A" }}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Table({ columns, rows, empty }) {
  if (!rows.length) return <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
            {columns.map((c) => <th key={c.key} className={`px-3 py-2 font-bold ${c.right ? "text-right" : ""}`}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.name}>
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 ${c.right ? "text-right tabular-nums" : "font-semibold text-slate-800"}`}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MixBar({ label, b2bPct, title }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
        <span>{title}</span>
        <span><span style={{ color: B2B_COLOR }}>B2B {pct(b2bPct)}</span> · <span style={{ color: B2C_COLOR }}>B2C {pct(100 - b2bPct)}</span></span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" aria-label={label}>
        <div style={{ width: `${b2bPct}%`, background: B2B_COLOR }} />
        <div style={{ width: `${100 - b2bPct}%`, background: B2C_COLOR }} />
      </div>
    </div>
  );
}

function CountList({ title, items }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.15em] text-slate-500">{title}</p>
      <ul className="space-y-1.5 text-sm">
        {items.map(([label, value]) => (
          <li key={label} className="flex justify-between">
            <span className="text-slate-600">{label}</span>
            <span className={`font-bold tabular-nums ${value === null ? "text-slate-400" : "text-slate-900"}`}>{value === null ? "not tracked" : value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrendChart({ data, title, b2bKey, b2cKey, format }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="mb-2 text-sm font-bold text-slate-700">{title}</p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => format(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey={b2bKey} name="B2B" stackId="a" fill={B2B_COLOR} />
            <Bar dataKey={b2cKey} name="B2C" stackId="a" fill={B2C_COLOR} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function OpsRevenueDashboard({ orders }) {
  const [period, setPeriod] = useState("day");
  const [anchor, setAnchor] = useState(() => toDateStr(new Date()));
  const [custom, setCustom] = useState(() => ({ from: toDateStr(new Date()), to: toDateStr(new Date()) }));
  const [trendDays, setTrendDays] = useState(14);

  const range = useMemo(() => rangeFor(period, anchor, custom), [period, anchor, custom]);
  const m = useOpsDashboard(orders, range, period === "month" ? 31 : trendDays);
  const { overall, b2b, b2c, ops, flow, flowIncludesB2B, money, alerts, trend } = m;
  const periodName = period === "day" ? "Today's" : "Period";

  return (
    <div className="space-y-5">
      {/* Filter */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">Date</p>
          <p className="text-lg font-extrabold text-slate-900">{prettyRange(range)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${period === p.key ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === "custom" ? (
            <>
              <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <span className="text-slate-400">to</span>
              <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            </>
          ) : period === "month" ? (
            <input type="month" value={anchor.slice(0, 7)} onChange={(e) => e.target.value && setAnchor(`${e.target.value}-01`)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
          ) : (
            <input type="date" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
          )}
        </div>
      </div>

      {/* 01 Overall */}
      <Section index={1} title="Overall" subtitle={period === "month" ? new Date(`${range.from}T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : undefined}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Kpi big label="Total weight" value={kg(overall.totalWeight)} />
          <Kpi big label="Total revenue" value={rs(overall.totalRevenue)} />
          <Kpi big label="B2B weight" value={kg(overall.b2bWeight)} accent={B2B_COLOR} />
          <Kpi big label="B2B revenue" value={rs(overall.b2bRevenue)} accent={B2B_COLOR} />
          <Kpi big label="B2C weight" value={kg(overall.b2cWeight)} accent={B2C_COLOR} />
          <Kpi big label="B2C revenue" value={rs(overall.b2cRevenue)} accent={B2C_COLOR} />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <MixBar title="Weight" label="Weight mix" b2bPct={overall.mix.b2bWeightPct} />
          <MixBar title="Revenue" label="Revenue mix" b2bPct={overall.mix.b2bRevenuePct} />
        </div>
      </Section>

      {/* 02 B2B */}
      <Section index={2} title="B2B">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="B2B total weight" value={kg(b2b.weight)} accent={B2B_COLOR} />
          <Kpi label="B2B revenue" value={rs(b2b.revenue)} accent={B2B_COLOR} />
          <Kpi label="Pickup weight" value={kg(b2b.pickupKg)} />
          <Kpi label="Delivery weight" value={b2b.deliveryTracked ? kg(b2b.deliveryKg) : "Not tracked"} hint={b2b.deliveryTracked ? undefined : "No B2B order marked delivered"} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Kpi label="Top client by weight" value={b2b.topByKg ? b2b.topByKg.name : "—"} hint={b2b.topByKg ? kg(b2b.topByKg.pickupKg) : undefined} />
          <Kpi label="Top client by revenue" value={b2b.topByRevenue ? b2b.topByRevenue.name : "—"} hint={b2b.topByRevenue ? rs(b2b.topByRevenue.revenue) : undefined} />
          <Kpi label="Pending / in-process weight" value={b2b.deliveryTracked ? kg(b2b.inProcessKg) : "Not tracked"} hint="Pickup − delivery" />
        </div>
        <h3 className="mb-2 mt-5 text-sm font-bold text-slate-700">Client-wise breakdown</h3>
        <Table
          empty="No B2B orders in this period."
          rows={b2b.clients}
          columns={[
            { key: "name", label: "Client", render: (r) => r.name },
            { key: "p", label: "Pickup KG", right: true, render: (r) => num(r.pickupKg) },
            { key: "d", label: "Delivery KG", right: true, render: (r) => (r.deliveryKg === null ? "—" : num(r.deliveryKg)) },
            { key: "rev", label: "Revenue", right: true, render: (r) => rs(r.revenue) },
            { key: "share", label: "% of B2B", right: true, render: (r) => pct(r.share) },
            { key: "pk", label: "Avg ₹/KG", right: true, render: (r) => rsKg(r.perKg) },
            { key: "bill", label: "Rate / billing", right: true, render: (r) => r.billing },
            { key: "o", label: "Orders", right: true, render: (r) => r.orders },
          ]}
        />
      </Section>

      {/* 03 B2C */}
      <Section index={3} title="B2C">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="B2C total weight" value={kg(b2c.weight)} accent={B2C_COLOR} />
          <Kpi label="B2C revenue" value={rs(b2c.revenue)} accent={B2C_COLOR} />
          <Kpi label="B2C orders" value={b2c.orders} />
          <Kpi label="Revenue / kg" value={rsKg(b2c.perKg)} />
        </div>
        <h3 className="mb-2 mt-5 text-sm font-bold text-slate-700">Service-wise breakdown</h3>
        <Table
          empty="No B2C orders in this period."
          rows={b2c.services}
          columns={[
            { key: "name", label: "Service", render: (r) => r.name },
            { key: "o", label: "Orders", right: true, render: (r) => r.orders },
            { key: "w", label: "Weight", right: true, render: (r) => (r.weight > 0 ? kg(r.weight) : "—") },
            { key: "rev", label: "Revenue", right: true, render: (r) => rs(r.revenue) },
            { key: "pk", label: "₹/KG", right: true, render: (r) => rsKg(r.perKg) },
            { key: "aov", label: "AOV", right: true, render: (r) => rs(r.aov) },
          ]}
        />
      </Section>

      {/* 04 Operations */}
      <Section index={4} title="Operations" subtitle={`${periodName} B2C pickups and deliveries`}>
        <div className="mb-4 flex flex-col gap-1 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
          <p><b>{ops.pickups.scheduled} Pickups</b> → {ops.pickups.completed} Completed → {ops.pickups.rescheduled} Rescheduled → {ops.pickups.cancelled} Cancelled</p>
          <p><b>{ops.deliveries.scheduled} Deliveries</b> → {ops.deliveries.completed} Completed</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <CountList title="Pickups" items={[
            ["Scheduled", ops.pickups.scheduled], ["Completed", ops.pickups.completed], ["Cancelled", ops.pickups.cancelled],
            ["Rescheduled", ops.pickups.rescheduled],
          ]} />
          <CountList title="Deliveries" items={[
            ["Scheduled", ops.deliveries.scheduled], ["Completed", ops.deliveries.completed], ["Failed", ops.deliveries.failed],
            ["Rescheduled", ops.deliveries.rescheduled],
          ]} />
        </div>
      </Section>

      {/* 05 Weight flow */}
      <Section index={5} title="Weight flow" subtitle={flowIncludesB2B ? "Where the weight is stuck (B2B + B2C)" : "Where the weight is stuck (B2C — B2B orders aren't marked through stages)"}>
        <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center">
          {flow.map((s, i) => (
            <div key={s.key} className="flex flex-1 flex-col items-center sm:flex-row">
              <div className="w-full flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{s.label}</p>
                <p className="text-xl font-extrabold text-slate-900">{kg(s.kg)}</p>
                {i > 0 && flow[i - 1].kg - s.kg > 0.05 && (
                  <p className="text-xs font-semibold text-amber-600">−{kg(flow[i - 1].kg - s.kg)}</p>
                )}
              </div>
              {i < flow.length - 1 && <FiArrowDown className="my-1 text-slate-400 sm:mx-1 sm:-rotate-90" />}
            </div>
          ))}
        </div>
      </Section>

      {/* 06 Money */}
      <Section index={6} title="Money flow">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">Revenue</p>
            <p className="flex justify-between"><span>B2B revenue</span><b style={{ color: B2B_COLOR }}>{rs(money.b2bRevenue)}</b></p>
            <p className="flex justify-between"><span>B2C revenue</span><b style={{ color: B2C_COLOR }}>{rs(money.b2cRevenue)}</b></p>
            <p className="flex justify-between border-t border-slate-200 pt-2 text-base"><span className="font-bold">Total revenue</span><b>{rs(money.totalRevenue)}</b></p>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">Payments (B2C)</p>
            <p className="flex justify-between"><span>Collected</span><b className="text-emerald-600">{rs(money.collected)}</b></p>
            <p className="flex justify-between"><span>Pending payment</span><b className="text-amber-600">{rs(money.pending)}</b></p>
            <p className="flex justify-between"><span>Overdue</span><b className="text-red-600">{rs(money.overdue)}</b></p>
            <p className="pt-1 text-xs text-slate-500">Overdue = delivered 7+ days ago with no payment recorded (includes COD orders where the rider didn&apos;t record payment). B2B payments aren&apos;t recorded in the system yet, so B2B collections can&apos;t be shown.</p>
          </div>
        </div>
      </Section>

      {/* 07 Trends */}
      <Section index={7} title="Trends" subtitle={period === "month" ? "Daily, last 31 days" : `Daily, last ${trendDays} days`}>
        {period !== "month" && (
          <div className="mb-3 flex gap-1">
            {[7, 14, 30].map((d) => (
              <button key={d} type="button" onClick={() => setTrendDays(d)}
                className={`rounded-md px-3 py-1 text-xs font-bold ${trendDays === d ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                {d} days
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <TrendChart data={trend} title="Weight trend (KG / day)" b2bKey="b2bKg" b2cKey="b2cKg" format={(v) => kg(v)} />
          <TrendChart data={trend} title="Revenue trend (₹ / day)" b2bKey="b2bRevenue" b2cKey="b2cRevenue" format={(v) => rs(v)} />
        </div>
      </Section>

      {/* 08 Alerts */}
      <Section index={8} title="What needs attention?">
        {alerts.length === 0 ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><FiCheckCircle /> Nothing needs attention for this period.</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.text} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                a.level === "bad" ? "border-red-200 bg-red-50 text-red-800" : a.level === "warn" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700"
              }`}>
                {a.level === "info" ? <FiInfo className="mt-0.5 shrink-0" /> : <FiAlertTriangle className="mt-0.5 shrink-0" />}
                {a.text}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
