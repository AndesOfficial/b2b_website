import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FiActivity,
  FiAlertCircle,
  FiArrowUpRight,
  FiBarChart2,
  FiCheckCircle,
  FiInfo,
  FiPieChart,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import { IndianRupee } from "lucide-react";
import { useInvestorMetrics } from "../hooks/useInvestorMetrics";

const CARD_CLASS = "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6";

const SNAPSHOT_TONES = {
  blue: {
    panel: "border-blue-100 bg-blue-50/70",
    eyebrow: "text-blue-600",
    icon: "bg-blue-100 text-blue-700",
  },
  green: {
    panel: "border-emerald-100 bg-emerald-50/70",
    eyebrow: "text-emerald-600",
    icon: "bg-emerald-100 text-emerald-700",
  },
  amber: {
    panel: "border-amber-100 bg-amber-50/70",
    eyebrow: "text-amber-600",
    icon: "bg-amber-100 text-amber-700",
  },
  slate: {
    panel: "border-slate-200 bg-slate-50/80",
    eyebrow: "text-slate-500",
    icon: "bg-slate-200 text-slate-700",
  },
  rose: {
    panel: "border-rose-100 bg-rose-50/70",
    eyebrow: "text-rose-600",
    icon: "bg-rose-100 text-rose-700",
  },
};

const formatCurrency = (value) => {
  const numericValue = Number(value);
  if (isNaN(numericValue)) return "—";
  const absolute = Math.abs(numericValue);
  const formatted = new Intl.NumberFormat("en-IN").format(absolute);
  return numericValue < 0 ? `-₹${formatted}` : `₹${formatted}`;
};

const formatCurrencyCompact = (value) => {
  const numericValue = Number(value);
  const absolute = Math.abs(numericValue);
  const sign = numericValue < 0 ? "-" : "";

  if (absolute >= 10000000) return `${sign}₹${(absolute / 10000000).toFixed(2)} Cr`;
  if (absolute >= 100000) return `${sign}₹${(absolute / 100000).toFixed(2)} L`;
  if (absolute >= 1000) return `${sign}₹${(absolute / 1000).toFixed(1)} k`;
  return `${sign}${formatCurrency(absolute)}`;
};

const formatPercent = (value) => {
  const numericValue = Number(value);
  if (isNaN(numericValue)) return "—";
  const scaledByTen = numericValue * 10;
  const digits = Number.isInteger(numericValue) ? 0 : Number.isInteger(scaledByTen) ? 1 : 2;
  return `${numericValue.toFixed(digits)}%`;
};

function LabelWithInfo({ text, tooltip }) {
  if (!tooltip) return <span>{text}</span>;

  return (
    <div className="flex w-full items-center gap-1.5">
      <span className="break-words leading-tight">{text}</span>
      <span className="relative inline-flex flex-shrink-0 items-center">
        <button
          type="button"
          className="group inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:text-blue-500 active:text-blue-500"
          aria-label={`More info about ${text}`}
        >
          <FiInfo size={13} />
          <span className="pointer-events-none invisible absolute bottom-[calc(100%+0.55rem)] right-0 z-50 w-52 max-w-[min(16rem,calc(100vw-2rem))] whitespace-normal rounded-xl bg-slate-800 p-3 text-left text-xs font-medium leading-relaxed text-white opacity-0 shadow-xl transition-all duration-150 tracking-normal group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 group-active:visible group-active:opacity-100 sm:left-1/2 sm:right-auto sm:w-56 sm:-translate-x-1/2">
            {tooltip}
            <span className="absolute right-2 top-full -mt-1 border-4 border-transparent border-t-slate-800 sm:left-1/2 sm:right-auto sm:-translate-x-1/2" />
          </span>
        </button>
      </span>
    </div>
  );
}

function SectionHeading({ eyebrow, title, titleTooltip, description, aside }) {
  return (
    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">
          <LabelWithInfo text={title} tooltip={titleTooltip} />
        </h2>
        {description ? <p className="mt-2 max-w-3xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {aside ? <div>{aside}</div> : null}
    </div>
  );
}

function SnapshotMetric({ label, tooltip, value, note, icon: Icon, tone = "slate" }) {
  const theme = SNAPSHOT_TONES[tone] || SNAPSHOT_TONES.slate;
  const displayNote = label === "Total Revenue" ? (note || "LTD Period: Nov 2024 - May 2026") : note;

  return (
    <div className={`rounded-[28px] border p-4 shadow-sm lg:p-5 ${theme.panel}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${theme.eyebrow}`}>
            <LabelWithInfo text={label} tooltip={tooltip} />
          </div>
          <p className="mt-1.5 text-[1.95rem] font-extrabold tracking-tight leading-none text-slate-950 lg:text-[2.1rem]">{value}</p>
          {displayNote ? <p className="mt-2 text-sm leading-6 text-slate-600">{displayNote}</p> : null}
        </div>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${theme.icon}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function InsightCard({ icon: Icon, title, body, tone = "blue" }) {
  const theme = SNAPSHOT_TONES[tone] || SNAPSHOT_TONES.blue;

  return (
    <div className={`rounded-[28px] border p-4 shadow-sm lg:p-5 ${theme.panel}`}>
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl ${theme.icon}`}>
        <Icon size={18} />
      </div>
      <h3 className="mt-3 text-lg font-extrabold tracking-tight text-slate-950">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function DetailRow({ label, tooltip, value, tone = "default" }) {
  const valueClass = tone === "danger" ? "text-rose-600" : "text-slate-950";

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <div className="text-sm font-semibold text-slate-600">
        <LabelWithInfo text={label} tooltip={tooltip} />
      </div>
      <p className={`text-base font-extrabold tracking-tight ${valueClass}`}>{value}</p>
    </div>
  );
}

function MixMeter({ label, tooltip, value, amount, fillClass }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 lg:p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-slate-950">
            <LabelWithInfo text={label} tooltip={tooltip} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{amount}</p>
        </div>
        <p className="text-lg font-extrabold tracking-tight text-slate-950">{formatPercent(value)}</p>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function StreamList({ title, tooltip, items }) {
  return (
    <div>
      <h3 className="text-base font-extrabold text-slate-950">
        <LabelWithInfo text={title} tooltip={tooltip} />
      </h3>
      <ul className="mt-3 space-y-2.5 text-sm font-medium text-slate-700">
        {(items || []).map((item) => (
          <li key={item} className="rounded-2xl bg-slate-50 px-4 py-2.5">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function InvestorMetrics() {
  const { metrics, loading } = useInvestorMetrics();
  const [isChartReady, setIsChartReady] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsChartReady(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const quarterlySummary = useMemo(() => {
    // SAFETY CHECK: If data isn't loaded yet, return 0
    if (!metrics || !metrics.monthlyRevenue) return { q4Revenue: 0, q1Revenue: 0 };

    const q4Months = ["Oct 2025", "Nov 2025", "Dec 2025"];
    const q1Months = ["Jan 2026", "Feb 2026", "Mar 2026"];

    const q4Revenue = (metrics.monthlyRevenue || [])
      .filter((point) => point && q4Months.includes(point.month))
      .reduce((sum, point) => sum + (Number(point.totalRevenue) || 0), 0);

    const q1Revenue = (metrics.monthlyRevenue || [])
      .filter((point) => point && q1Months.includes(point.month))
      .reduce((sum, point) => sum + (Number(point.totalRevenue) || 0), 0);

    return { q4Revenue, q1Revenue };
  }, [metrics]);

  const bestRecentMonth = useMemo(() => {
    // SAFETY CHECK: If data isn't loaded yet, return a safe default
    const revenue = metrics?.monthlyRevenue || [];
    if (revenue.length === 0) {
      return { month: "N/A", totalRevenue: 0 };
    }

    return revenue
      .slice(-3)
      .reduce((best, point) => ((Number(point.totalRevenue) || 0) > (Number(best.totalRevenue) || 0) ? point : best), revenue[revenue.length - 1]);
  }, [metrics]);

  if (loading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <p className="animate-pulse text-sm font-bold uppercase tracking-widest text-slate-500">
          Loading Financials...
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-7" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_38%),linear-gradient(135deg,_#ffffff_0%,_#f8fafc_52%,_#eff6ff_100%)] p-5 shadow-sm lg:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
              <FiBarChart2 size={14} />
              Investor Snapshot
            </div>
            <h2 className="mt-3 text-[2rem] font-extrabold tracking-tight text-slate-950 lg:text-3xl">
              {metrics.reportTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
              The Andes story is one of rapid and successful transformation. Starting as a B2C-focused laundry pilot, 
              the business has pivoted into a high-scale B2B revenue engine. This report details our path from 
              initial retail operations to securing large-scale institutional contracts, resulting in 
              significant revenue acceleration and robust segment margins.
            </p>
          </div>

          <div className="w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm sm:w-auto">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Official Report</p>
            <p className="mt-2 text-lg font-extrabold tracking-tight text-slate-950">{metrics.reportUpdatedOn}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3.5 xl:grid-cols-12">
          <div className="xl:col-span-4">
            <SnapshotMetric
              label="Total Revenue"
              tooltip="Cumulative revenue generated since operations began in Nov 2024."
              value={formatCurrencyCompact(metrics.totalRevenue)}
              note={metrics.ltdPeriodNote}
              icon={IndianRupee}
              tone="blue"
            />
          </div>
          <div className="sm:grid sm:grid-cols-2 sm:gap-4 xl:col-span-8 xl:grid-cols-4">
            <SnapshotMetric
              label="QoQ Growth"
              tooltip="Quarter-on-quarter revenue growth from Q4 2025 total revenue to Q1 2026 total revenue."
              value={formatPercent(metrics.qoqGrowthPct)}
              note={metrics.growthComparisonPeriod}
              icon={FiTrendingUp}
              tone="green"
            />
            <SnapshotMetric
              label="ARRR"
              tooltip={`Annualized Revenue Run Rate based on the ${metrics.summaryPeriod} monthly average multiplied by 12.`}
              value={formatCurrencyCompact(metrics.arrr)}
              note="Annualized from Feb-Apr average"
              icon={FiArrowUpRight}
              tone="amber"
            />
            <SnapshotMetric
              label="GMV"
              tooltip="Gross Merchandise Value (GMV) represents the total transacted value of all services processed through the Andes platform."
              value={formatCurrencyCompact(metrics.gmv)}
              note="MIT Hostel, Hostel 99, IBIS, Airbnb, and Regular orders"
              icon={IndianRupee}
              tone="slate"
            />
            <SnapshotMetric
              label="EBITDA"
              tooltip={`Earnings before interest, taxes, depreciation, and amortization. This card uses the ${metrics.ebitdaBreakdown.monthLabel} EBITDA snapshot.`}
              value={formatCurrency(metrics.ebitdaBreakdown.ebitda)}
              note={`${metrics.ebitdaBreakdown.monthLabel} snapshot`}
              icon={IndianRupee}
              tone={metrics.ebitdaBreakdown.ebitda < 0 ? "rose" : "green"}
            />
          </div>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Key Takeaways"
          title="What stands out right away"
          titleTooltip="A quick summary of the most important investor signals before reviewing the detailed sections."
          description="These are the fastest signals an investor is likely to look for before reading the detailed breakdown."
        />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <InsightCard
            icon={FiTrendingUp}
            title="Revenue accelerated sharply in Q1 2026"
            body={`Total revenue grew to ${formatCurrency(quarterlySummary.q1Revenue)} in Q1 2026. This representing a 80.3% quarter-on-quarter acceleration compared to Q4 2025. This growth signals rapid scale in our core B2B channels.`}
            tone="green"
          />
          <InsightCard
            icon={FiUsers}
            title="B2B is the primary revenue engine"
            body={`B2B now contributes ${formatPercent(metrics.b2bShare)} of the revenue mix. From Nov 2024 (B2C-only), we've successfully pivoted to high-volume institutional contracts while maintaining a B2C pilot.`}
            tone="blue"
          />
          <InsightCard
            icon={metrics.ebitdaBreakdown.ebitda < 0 ? FiAlertCircle : FiCheckCircle}
            title="Margins are healthy; EBITDA remains under watch"
            body={`Gross margin remains strong at ${formatPercent(metrics.b2cMarginPct)} (B2C) and ${formatPercent(metrics.b2bMarginPct)} (B2B). Our ${metrics.ebitdaBreakdown.monthLabel} EBITDA is currently ${formatCurrency(metrics.ebitdaBreakdown.ebitda)} due to scaling fixed costs.`}
            tone={metrics.ebitdaBreakdown.ebitda < 0 ? "rose" : "green"}
          />
        </div>
      </section>

      <section className={CARD_CLASS}>
        <SectionHeading
          eyebrow="Revenue Trend"
          title="Monthly growth trajectory"
          titleTooltip="Monthly B2C and B2B revenue trend from Nov 2024 to May 2026, with a line for total revenue."
          description="The main chart is the hero visual so investors can read the business momentum before drilling into detailed rows."
          aside={
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                <LabelWithInfo
                  text="Best Recent Month"
                  tooltip="The strongest month by total revenue among the latest three months."
                />
              </div>
              <p className="mt-1 text-lg font-extrabold tracking-tight text-slate-950">{bestRecentMonth.month}</p>
              <p className="text-sm text-slate-500">{formatCurrency(bestRecentMonth.totalRevenue)} total revenue</p>
            </div>
          }
        />
        <div className="h-[380px] w-full min-w-0">
          {isChartReady && (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
              <ComposedChart data={metrics.monthlyRevenue} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748B", fontSize: 12 }}
                  interval={0}
                  angle={-28}
                  textAnchor="end"
                  height={70}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748B", fontSize: 12 }}
                  tickFormatter={(value) => {
                    if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                    return `${value}`;
                  }}
                />
                <Tooltip
                  formatter={(value, name) => [formatCurrency(value), name]}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
                  }}
                />
                <Legend />
                <Bar dataKey="b2cRevenue" name="B2C Revenue" stackId="revenue" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                <Bar dataKey="b2bRevenue" name="B2B Revenue" stackId="revenue" fill="#2563EB" radius={[6, 6, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="totalRevenue"
                  name="Total Revenue"
                  stroke="#0F172A"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#0F172A" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className={CARD_CLASS}>
          <SectionHeading
            eyebrow="Revenue Mix"
            title="Where revenue is coming from"
            titleTooltip="Breakdown of Jan-Mar 2026 revenue between B2B and B2C."
            description="The Jan-Mar 2026 summary shows the business is currently B2B-heavy."
          />
          <div className="space-y-4">
            <MixMeter
              label="B2B Revenue"
              tooltip="Combined B2B revenue for the Jan-Mar 2026 summary period."
              value={metrics.b2bShare}
              amount={formatCurrency(metrics.totalB2bRevenue)}
              fillClass="bg-gradient-to-r from-blue-600 to-cyan-400"
            />
            <MixMeter
              label="B2C Revenue"
              tooltip="Combined B2C revenue for the Jan-Mar 2026 summary period."
              value={metrics.b2cShare}
              amount={formatCurrency(metrics.totalB2cRevenue)}
              fillClass="bg-gradient-to-r from-amber-400 to-orange-500"
            />
          </div>
        </div>

        <div className={CARD_CLASS}>
          <SectionHeading
            eyebrow="Margin Quality"
            title="Gross margin by segment"
            titleTooltip="Gross margin compares selling price versus variable cost for each segment."
            description="Margins are shown next to the core pricing assumptions so investors can read quality of revenue quickly."
          />
          <div className="space-y-4">
            <DetailRow
              label="B2C Gross Margin"
              tooltip="Gross margin for app-based B2C laundry pricing."
              value={formatPercent(metrics.b2cMarginPct)}
            />
            <DetailRow
              label="B2B Gross Margin"
              tooltip="Gross margin for bulk and institutional B2B pricing."
              value={formatPercent(metrics.b2bMarginPct)}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  <LabelWithInfo
                    text="B2C Inputs"
                    tooltip="Inputs used in the B2C gross margin calculation."
                  />
                </div>
                <p className="mt-2"><span className="font-bold text-slate-900">Selling Price:</span> ₹80/kg</p>
                <p><span className="font-bold text-slate-900">Var. Cost:</span> ₹26.4/kg</p>
                <p className="mt-1 text-[10px] text-slate-400">Chemicals (₹5), Electricity (₹7.9), Ironing (₹10.5), Packaging (₹3)</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  <LabelWithInfo
                    text="B2B Inputs"
                    tooltip="Inputs used in the B2B gross margin calculation (Selling Price - Variable Cost) / Selling Price."
                  />
                </div>
                <p className="mt-2"><span className="font-bold text-slate-900">Selling Price:</span> ₹55/kg</p>
                <p><span className="font-bold text-slate-900">Var. Cost:</span> ₹24.98/kg</p>
                <p className="mt-1 text-[10px] text-slate-400">Chemicals (₹5), Electricity (₹7.87), Ironing (₹10.5), Packaging (₹1.61)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className={CARD_CLASS}>
          <SectionHeading
            eyebrow="EBITDA"
            title={`${metrics.ebitdaBreakdown.monthLabel} health check`}
            titleTooltip="A compact operating-profit snapshot using the EBITDA inputs shown here."
            description="This is intentionally compact so it supports the story without overpowering the page."
          />
          <div className="space-y-4">
            <DetailRow
              label="Revenue"
              tooltip={`Total ${metrics.ebitdaBreakdown.monthLabel} revenue used in the EBITDA calculation.`}
              value={formatCurrency(metrics.ebitdaBreakdown.revenue)}
            />
            <DetailRow
              label="Variable Cost"
              tooltip="Costs that rise with activity, such as direct operating costs in this EBITDA example."
              value={formatCurrency(metrics.ebitdaBreakdown.variableCost)}
            />
            <DetailRow
              label="Fixed Cost"
              tooltip="Costs that do not vary directly with order volume in this EBITDA example."
              value={formatCurrency(metrics.ebitdaBreakdown.fixedCost)}
            />
            <DetailRow
              label="EBITDA"
              tooltip={`Revenue minus variable cost minus fixed cost for the ${metrics.ebitdaBreakdown.monthLabel} snapshot.`}
              value={formatCurrency(metrics.ebitdaBreakdown.ebitda)}
              tone={metrics.ebitdaBreakdown.ebitda < 0 ? "danger" : "default"}
            />
          </div>
        </div>

        <div className={CARD_CLASS}>
          <SectionHeading
            eyebrow="Revenue Streams"
            title="What Andes sells"
            titleTooltip="The listed service lines for B2C and B2B revenue."
            description="Operational context stays below the financial story, where it is useful but not distracting."
          />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <StreamList
              title="B2C (App-based)"
              tooltip="Consumer-facing laundry and dry-cleaning services."
              items={metrics.revenueStreams.b2c}
            />
            <StreamList
              title="B2B (Bulk / Institutional)"
              tooltip="Institutional and bulk laundry service lines."
              items={metrics.revenueStreams.b2b}
            />
          </div>
        </div>
      </section>

      <section className={CARD_CLASS}>
        <SectionHeading
          eyebrow="Detailed Data"
          title="Monthly revenue appendix"
          titleTooltip="A detailed month-by-month appendix matching the source table."
          description="The detailed table is still available, but it is moved lower on the page so the summary narrative stays cleaner."
        />
        <details className="group rounded-3xl border border-slate-200 bg-slate-50/70 p-4 open:bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl bg-white px-4 py-4 text-left shadow-sm">
            <div>
              <p className="text-sm font-extrabold tracking-tight text-slate-950">Detailed monthly data</p>
              <p className="mt-1 text-sm text-slate-500">Open to review the full Nov 2024 to May 2026 table.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 group-open:bg-blue-50 group-open:text-blue-600">
              Expand
            </span>
          </summary>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-2xl border border-slate-200">
              <thead>
                <tr className="bg-slate-50">
                  {[
                    { text: "Month", tooltip: "The billing or reporting month." },
                    { text: "B2C Revenue", tooltip: "Revenue earned from app-based B2C customers in that month." },
                    { text: "B2B Revenue", tooltip: "Revenue earned from bulk and institutional B2B customers in that month." },
                    { text: "Total Revenue", tooltip: "B2C Revenue plus B2B Revenue for that month." },
                    { text: "B2C %", tooltip: "Share of monthly total revenue contributed by B2C." },
                    { text: "B2B %", tooltip: "Share of monthly total revenue contributed by B2B." },
                  ].map((heading) => (
                    <th
                      key={heading.text}
                      className="border-b border-slate-200 px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500"
                    >
                      <LabelWithInfo text={heading.text} tooltip={heading.tooltip} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(metrics?.monthlyRevenue || []).map((row) => (
                  <tr key={row?.month || Math.random()} className="bg-white odd:bg-white even:bg-slate-50/40">
                    <td className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">{row?.month || "—"}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{formatCurrency(row?.b2cRevenue || 0)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{formatCurrency(row?.b2bRevenue || 0)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{formatCurrency(row?.totalRevenue || 0)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{formatPercent(row?.b2cShare || 0)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{formatPercent(row?.b2bShare || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </div>
  );
}
