import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { SERVICE_CATEGORIES, canonicalCategory } from "../constants/serviceCatalog";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useHostelOrders } from "../context/HostelAuthContext";
import LoadingSpinner from "../components/Shared/LoadingSpinner";
import {
  OTHER_SERVICE, addDays, avg, between, bins, breakdown, buildCatalog, cohorts, count, delivered, delta, dayToStr, firstOrderMap, fmtDay, buildRows,
  rate, resolveRange, rupee, spanDays, sum, today, uniq,
} from "../utils/analyticsData";
import "./analytics.css";

const REPORTS = [
  ["executive-overview", "Executive Overview"],
  ["customer-acquisition-and-orders", "Customer Acquisition & Orders"],
  ["retention-and-cohorts", "Retention & Cohorts"],
  ["order-intelligence", "Order Intelligence"],
  ["revenue-and-unit-economics", "Revenue & Unit Economics"],
  ["service-intelligence", "Service Intelligence"],
  ["dark-store-and-processing", "Dark Store & Processing"],
  ["rider-and-logistics", "Rider & Logistics"],
  ["location-intelligence", "Location Intelligence"],
  ["subscription-analytics", "Subscription Analytics"],
  ["marketing-and-conversion", "Marketing & Conversion"],
  ["customer-experience", "Customer Experience"],
  ["forecasting-and-alerts", "Forecasting & Alerts"],
  ["order-records", "Order Records"],
];

const PERIODS = [["1", "Today"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["60", "Last 60 days"], ["120", "Last 120 days"], ["365", "Last 365 days"], ["custom", "Custom range"]];

const kpi = (label, value, note) => (
  <article className="card" key={label}>
    <small>{label}</small>
    <strong>{value}</strong>
    <small>{note}</small>
  </article>
);
const Cards = ({ items }) => <div className="cards">{items.map((i) => kpi(...i))}</div>;
const Panel = ({ title, children }) => (
  <section className="panel">
    <h2>{title}</h2>
    {children}
  </section>
);
const Grid = ({ children }) => <div className="grid">{children}</div>;

function Table({ headers, rows }) {
  if (!rows.length) return <p className="empty">No records match this view.</p>;
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>{headers.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Chart({ rows, start, end, metric = "revenue" }) {
  if (spanDays(start, end) < 1) return <p>No dates in this range.</p>;
  const data = bins(rows, start, end, metric);
  const max = Math.max(1, ...data);
  const span = spanDays(start, end);
  const first = data.length;
  return (
    <>
      <div className="chart" role="img" aria-label={`Trend from ${fmtDay(start)} to ${fmtDay(end)}`}>
        {data.map((n, i) => (
          <div
            key={i}
            className="bar"
            style={{ height: `${Math.max(1, (n / max) * 100)}%` }}
            title={`${fmtDay(addDays(start, Math.ceil((i * span) / first)))} · ${metric === "revenue" ? rupee(n) : n}`}
          />
        ))}
      </div>
      <div className="legend"><span>{fmtDay(start)}</span><span>{fmtDay(end)}</span></div>
    </>
  );
}

const csvCell = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;

function OrderRecords({ rows }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [page, setPage] = useState(0);
  const headers = ["Order", "Customer / client", "Channel", "Service", "Placed", "Weight (kg)", "Order value", "Status"];
  const all = useMemo(
    () => [...rows].sort((a, b) => b.day - a.day).map((r) => [r.id, r.customerName, r.channel, r.service, r.dayStr, r.weight || "—", rupee(r.gross), r.status]),
    [rows],
  );
  const statuses = useMemo(() => [...new Set(all.map((r) => r.at(-1)))].sort(), [all]);
  const filtered = all.filter((r) => (status === "All statuses" || r.at(-1) === status) && r.join(" ").toLowerCase().includes(q.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * 10, current * 10 + 10);

  const exportCsv = () => {
    const csv = [headers, ...filtered].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "andes-order-records.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Panel title="Order records">
      <div className="filters">
        <input aria-label="Search records" placeholder="Search records" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
          {["All statuses", ...statuses].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button type="button" onClick={exportCsv}>Export CSV</button>
      </div>
      <Table headers={headers} rows={visible.map((r) => r.map((c, i) => (i === r.length - 1 ? <span className={`tag ${/Cancel|Pending/i.test(c) ? "warn" : ""}`}>{c}</span> : c)))} />
      <div className="tablefoot">
        <span className="muted">{count(filtered.length)} records · Page {current + 1} of {pages}</span>
        <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
        <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
      </div>
    </Panel>
  );
}

function reportBody(report, ctx) {
  const { all, r, d, previous, prevComplete, start, end, span, firstOrders, issuesCount } = ctx;
  const b2c = r.filter((o) => !o.b2b);
  const dc = delivered(b2c);
  const revenue = sum(d, "revenue");
  const cancelled = r.filter((o) => o.cancelled);
  const acquired = [...firstOrders.values()].filter((o) => o.day >= ctx.startIdx && o.day <= ctx.endIdx);
  const channels = [...new Set(r.map((o) => o.channel))].sort().map((c) => [c, c]);
  const services = [...new Set(r.map((o) => o.service))].sort().map((s) => [s, s]);
  const compare = (a, b) => (prevComplete ? delta(a, b) : "Prior period unavailable");
  const sources = [...new Set(acquired.map((o) => o.source))].sort().map((s) => {
    const a = acquired.filter((o) => o.source === s);
    return [s, a.length, dc.filter((o) => a.some((f) => f.customer === o.customer)).length, rupee(sum(a, "revenue"))];
  });
  const returning = uniq(dc.filter((o) => firstOrders.get(o.customer) && firstOrders.get(o.customer).day < ctx.startIdx));

  switch (report) {
    case "Executive Overview": {
      const paidDelivered = d.filter((o) => o.paid).length;
      return (
        <>
          <Cards items={[
            ["Net revenue", rupee(revenue), compare(revenue, sum(delivered(previous), "revenue"))],
            ["Orders placed", count(r.length), compare(r.length, previous.length)],
            ["Average order value", d.length ? rupee(avg(revenue, d.length)) : "—", "Net revenue per delivered order"],
            ["Delivery rate", rate(d.length, r.length), "Delivered ÷ placed"],
          ]} />
          <Grid>
            <Panel title="Net revenue trend"><Chart rows={r} start={start} end={end} /></Panel>
            <Panel title="Channel performance">
              <Table headers={["Channel", "Placed", "Delivered", "Delivered kg", "Net revenue"]} rows={breakdown(r, channels, "channel")} />
            </Panel>
          </Grid>
          <Panel title="Advanced KPIs">
            <Table headers={["Area", "Metric", "Value", "How it is measured"]} rows={[
              ["Profit & cash", "Revenue per kg", sum(d, "weight") ? rupee(revenue / sum(d, "weight")) : "—", "Net revenue divided by delivered kg"],
              ["Profit & cash", "Paid share of delivered orders", rate(paidDelivered, d.length), "Delivered orders marked paid ÷ delivered orders"],
              ["Customers", "Active B2C customers", uniq(dc), "Distinct customers with a delivered order"],
              ["Customers", "Repeat customer share", rate(returning, uniq(dc)), "Active customers whose first delivered order was before this period"],
              ["Delivery & quality", "Cancellation rate", rate(cancelled.length, r.length), "Cancelled orders ÷ orders placed"],
            ]} />
          </Panel>
        </>
      );
    }
    case "Customer Acquisition & Orders":
      return (
        <>
          <Cards items={[
            ["New customers", acquired.length, "First delivered B2C order"],
            ["Active customers", uniq(dc), "Delivered B2C customers"],
            ["Orders per customer", uniq(dc) ? avg(dc.length, uniq(dc)).toFixed(2) : "—", "Delivered orders per active customer"],
            ["Returning customers", returning, "First delivered order before period"],
          ]} />
          <Grid>
            <Panel title="Orders trend"><Chart rows={b2c} start={start} end={end} metric="orders" /></Panel>
            <Panel title="New customers by source">
              <Table headers={["First-order source", "Customers", "Period deliveries", "First-order revenue"]} rows={sources} />
            </Panel>
          </Grid>
        </>
      );
    case "Retention & Cohorts": {
      const rowsC = cohorts(all, firstOrders, start, end).map((c) => [`${fmtDay(dayToStr(c.from))} – ${fmtDay(dayToStr(c.to))}`, c.size, ...c.cells]);
      return (
        <Panel title="30-day acquisition cohorts">
          <p>Cohorts start at the beginning of the selected range. Later windows count distinct customers with a delivered repeat order.</p>
          <Table headers={["Acquisition window", "Customers", "Window +1", "Window +2", "Window +3"]} rows={rowsC} />
        </Panel>
      );
    }
    case "Order Intelligence": {
      const reasons = [...new Set(cancelled.map((o) => o.reason))].sort().map((x) => [x, cancelled.filter((o) => o.reason === x).length]);
      return (
        <>
          <Cards items={[
            ["Placed", r.length, "Includes cancelled orders"],
            ["Delivered", d.length, "Completed"],
            ["Cancellation rate", rate(cancelled.length, r.length), "Cancelled ÷ placed"],
            ["Open orders", r.filter((o) => o.open).length, "Not yet delivered or cancelled"],
          ]} />
          <Grid>
            <Panel title="Order volume"><Chart rows={r} start={start} end={end} metric="orders" /></Panel>
            <Panel title="Cancellation reasons"><Table headers={["Reason", "Orders"]} rows={reasons} /></Panel>
          </Grid>
          <Panel title="Order channel breakdown"><Table headers={["Channel", "Placed", "Delivered", "Delivered kg", "Net revenue"]} rows={breakdown(r, channels, "channel")} /></Panel>
        </>
      );
    }
    case "Revenue & Unit Economics": {
      const clients = [...new Set(r.filter((o) => o.b2b).map((o) => o.customer))].sort().map((x) => [x, x]);
      return (
        <>
          <Cards items={[
            ["Net revenue", rupee(revenue), "Delivered order value"],
            ["Average order value", d.length ? rupee(avg(revenue, d.length)) : "—", "Net revenue per delivered order"],
            ["Revenue per kg", sum(d, "weight") ? rupee(revenue / sum(d, "weight")) : "—", "Net revenue ÷ delivered kg"],
            ["Discounts", rupee(sum(d, "discount")), "On delivered orders"],
          ]} />
          <Panel title="Operations & revenue breakdown">
            <Table headers={["Segment", "Placed", "Delivered", "Delivered kg", "Net revenue"]} rows={breakdown(r, [[true, "Institutional B2B"], [false, "Consumer B2C"]], "b2b")} />
          </Panel>
          <Panel title="B2B client-wise breakdown">
            <Table headers={["Client", "Placed", "Delivered", "Delivered kg", "Net revenue"]} rows={breakdown(r.filter((o) => o.b2b), clients, "customer")} />
          </Panel>
        </>
      );
    }
    case "Service Intelligence":
      return <Panel title="Service profitability"><Table headers={["Service", "Placed", "Delivered", "Delivered kg", "Net revenue"]} rows={breakdown(r, services, "service")} /></Panel>;
    case "Dark Store & Processing":
      return (
        <>
          <Cards items={[
            ["Delivered weight", `${sum(d, "weight").toFixed(1)} kg`, "From completed orders"],
            ["In-process weight", `${sum(r.filter((o) => o.open), "weight").toFixed(1)} kg`, "Orders not yet delivered"],
            ["Open orders", r.filter((o) => o.open).length, "Awaiting pickup, processing or delivery"],
            ["Machine utilisation", "Unavailable", "Needs machine runtime and capacity"],
          ]} />
          <Panel title="Throughput by service"><Table headers={["Service", "Placed", "Delivered", "Delivered kg", "Net revenue"]} rows={breakdown(r, services, "service")} /></Panel>
        </>
      );
    case "Rider & Logistics": {
      const riders = [...new Set(r.map((o) => o.rider).filter(Boolean))].sort();
      return (
        <>
          <Cards items={[
            ["Deliveries", d.length, "Delivered in this period"],
            ["With a rider recorded", rate(r.filter((o) => o.rider).length, r.length), "Orders with a rider name"],
            ["Open orders", r.filter((o) => o.open).length, "Not yet delivered or cancelled"],
            ["On-time delivery", "Unavailable", "Needs promised and actual delivery times"],
          ]} />
          <Panel title="Orders by rider">
            <Table headers={["Rider", "Placed", "Delivered", "Delivered kg", "Net revenue"]} rows={breakdown(r, riders.map((x) => [x, x]), "rider")} />
          </Panel>
        </>
      );
    }
    case "Location Intelligence":
      return (
        <>
          <Panel title="Facility data">
            <p>Orders are not yet tagged with the facility that fulfilled them, so a facility comparison would not be accurate. Once orders carry a facility, this report can split by outlet and dark store.</p>
          </Panel>
          <br />
          <Panel title="Outlet vs digital demand"><Table headers={["Channel", "Placed", "Delivered", "Delivered kg", "Net revenue"]} rows={breakdown(r, channels, "channel")} /></Panel>
        </>
      );
    case "Subscription Analytics": {
      const s = dc.filter((o) => o.subscription);
      return (
        <>
          <Cards items={[
            ["Plan redemptions", s.length, "Delivered subscription orders"],
            ["Redeeming customers", uniq(s), "Distinct B2C customers"],
            ["Redeemed weight", `${sum(s, "weight").toFixed(1)} kg`, "Delivered service weight"],
            ["Renewal rate", "Unavailable", "Requires billing and plan history"],
          ]} />
          <Panel title="Redemption by service">
            <Table headers={["Service", "Orders", "Weight (kg)"]} rows={[...new Set(s.map((o) => o.service))].sort().map((x) => { const a = s.filter((o) => o.service === x); return [x, a.length, sum(a, "weight").toFixed(1)]; })} />
          </Panel>
        </>
      );
    }
    case "Marketing & Conversion":
      return (
        <>
          <Cards items={[
            ["First-order customers", acquired.length, "Delivered B2C acquisitions"],
            ["Discounts", rupee(sum(d, "discount")), "On delivered orders"],
            ["Lead conversion", "Unavailable", "Needs leads linked to customers"],
            ["Acquisition cost", "Unavailable", "Needs campaign spend"],
          ]} />
          <Panel title="Acquisition attribution"><Table headers={["Source", "New customers", "Period deliveries", "First-order revenue"]} rows={sources} /></Panel>
        </>
      );
    case "Customer Experience":
      return (
        <>
          <Cards items={[
            ["Issues logged", issuesCount, "Manager and customer issues in this period"],
            ["Issue rate", rate(issuesCount, d.length), "Issues ÷ delivered orders"],
            ["Cancellation rate", rate(cancelled.length, r.length), "Cancelled ÷ placed"],
            ["Rewash rate", "Unavailable", "Needs rewash recorded on orders"],
          ]} />
        </>
      );
    case "Forecasting & Alerts": {
      const w = Math.min(span, 7);
      const latest = r.filter((o) => o.dayStr >= addDays(end, -(w - 1)));
      return (
        <>
          <Cards items={[
            ["Next 7 days", `${Math.round((latest.length / w) * 7)} orders`, "Simple trailing daily average"],
            ["Trailing daily demand", avg(latest.length, w).toFixed(1), `Based on ${w} selected days`],
            ["Open orders", r.filter((o) => o.open).length, "Not yet delivered or cancelled"],
            ["Cancelled", cancelled.length, "In the selected range"],
          ]} />
          <Panel title="Recent order volume"><Chart rows={r} start={start} end={end} metric="orders" /></Panel>
        </>
      );
    }
    case "Order Records":
      return <OrderRecords rows={r} />;
    default:
      return null;
  }
}

export function AnalyticsView({ orders, catalog }) {
  const navigate = useNavigate();
  const { report: slug } = useParams();
  const [days, setDays] = useState("30");
  const [customStart, setCustomStart] = useState(() => addDays(today(), -29));
  const [customEnd, setCustomEnd] = useState(today());
  const [service, setService] = useState("All services");
  const [channel, setChannel] = useState("All channels");

  const entry = REPORTS.find(([s]) => s === slug) || REPORTS[0];
  const report = entry[1];

  const all = useMemo(() => buildRows(orders, catalog), [orders, catalog]);
  const firstOrders = useMemo(() => firstOrderMap(all), [all]);
  // Only catalog services that appear in orders, grouped by catalog category.
  const serviceGroups = useMemo(() => {
    const used = new Set(all.filter((r) => !r.b2b).map((r) => r.service));
    const labels = Object.fromEntries(SERVICE_CATEGORIES.map((c) => [c.value, c.label]));
    const groups = new Map();
    for (const s of catalog?.services || []) {
      if (!used.has(s.name)) continue;
      const key = canonicalCategory(s.category);
      const label = labels[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
      if (!groups.has(label)) groups.set(label, []);
      if (!groups.get(label).includes(s.name)) groups.get(label).push(s.name);
    }
    return { groups: [...groups.entries()], hasOther: used.has(OTHER_SERVICE) };
  }, [all, catalog]);
  const channels = useMemo(() => [...new Set(all.map((r) => r.channel))].sort(), [all]);

  const { start, end } = resolveRange({ days, start: customStart, end: customEnd });
  const span = spanDays(start, end);
  const valid = Number.isFinite(span) && span > 0;

  const ctx = useMemo(() => {
    if (!valid) return null;
    const scoped = all.filter((o) => (service === "All services" || o.service === service) && (channel === "All channels" || o.channel === channel));
    const r = between(scoped, start, end);
    const prevStart = addDays(start, -span);
    const previous = between(scoped, prevStart, addDays(start, -1));
    const earliest = all.reduce((m, o) => (o.dayStr < m ? o.dayStr : m), today());
    const issues = (orders || []).filter((o) => o?.type === "issue" && /^\d{4}-\d{2}-\d{2}$/.test(String(o.date || "")) && o.date >= start && o.date <= end).length;
    const s = new Date(`${start}T00:00:00Z`).getTime() / 86400000;
    const e = new Date(`${end}T00:00:00Z`).getTime() / 86400000;
    return {
      all, r, d: delivered(r), previous, prevComplete: prevStart >= earliest, start, end, span, firstOrders,
      startIdx: Math.round(s), endIdx: Math.round(e), issuesCount: issues,
    };
  }, [all, firstOrders, valid, service, channel, start, end, span, orders]);


  const bounds = all.reduce((m, o) => (o.dayStr < m ? o.dayStr : m), today());

  return (
    <div className="an">
      <header className="top">
        <div className="scope">
          <button type="button" className="back" onClick={() => navigate("/admin")}>← Back to Admin</button>
          <span className="analyticsName">Andes Analytics</span>
        </div>
      </header>

      <main className="content" id="main">
        <div className="head">
          <div>
            <div className="eyebrow">Business intelligence</div>
            <h1>{report}</h1>
            <p>Date, service and channel filters apply across reports.</p>
          </div>
        </div>

        <div className="filters">
          <label className="filterlabel">Period
            <select value={days} onChange={(e) => setDays(e.target.value)}>
              {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {days === "custom" && (
            <>
              <label className="filterlabel">From
                <input type="date" min={bounds} max={today()} value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              </label>
              <label className="filterlabel">To
                <input type="date" min={bounds} max={today()} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              </label>
            </>
          )}
          <label className="filterlabel">Service
            <select value={service} onChange={(e) => setService(e.target.value)}>
              <option>All services</option>
              {serviceGroups.groups.map(([label, names]) => (
                <optgroup key={label} label={label}>
                  {names.map((s) => <option key={s}>{s}</option>)}
                </optgroup>
              ))}
              {serviceGroups.hasOther && <option>{OTHER_SERVICE}</option>}
            </select>
          </label>
          <label className="filterlabel">Channel
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              {["All channels", ...channels].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>

        <div className="reportbox">
          <nav className="panel reportnav" aria-label="Analytics reports">
            {REPORTS.map(([s, label]) => (
              <Link key={s} to={s === REPORTS[0][0] ? "/admin/analytics" : `/admin/analytics/${s}`} aria-current={label === report ? "page" : undefined}>
                {label}
              </Link>
            ))}
          </nav>
          <div>
            {valid && ctx ? reportBody(report, ctx) : <Panel title="Check date range"><p>Choose a start date on or before the end date.</p></Panel>}
          </div>
        </div>

        <div className="footer">Live Andes orders · {all.length ? `${bounds} to ${today()}` : "no orders yet"}</div>
      </main>
    </div>
  );
}

// Loads the live orders and the `prices` catalog, then shows the workspace.
export default function AdminAnalytics() {
  const { orders, isDataLoaded } = useHostelOrders();
  const [catalog, setCatalog] = useState(null);
  useEffect(() => {
    let live = true;
    getDocs(collection(db, "prices"))
      .then((snap) => live && setCatalog(buildCatalog(snap.docs.map((d) => d.data()))))
      .catch(() => live && setCatalog(buildCatalog([])));
    return () => { live = false; };
  }, []);
  if (!isDataLoaded || !catalog) return <LoadingSpinner fullscreen />;
  return <AnalyticsView orders={orders} catalog={catalog} />;
}
