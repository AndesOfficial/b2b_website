import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu, FiArrowLeft, FiRefreshCw, FiAlertTriangle, FiTrendingUp, FiTrendingDown, FiMinus } from "react-icons/fi";
import AdminSidebar from "../components/AdminSidebar";
import { useHostelAuth } from "../context/HostelAuthContext";

// ─── Scenario seed data (from Excel sheets) ──────────────────────────────────
const SCENARIO_SEEDS = {
  optimistic:   { cycles: 12, effHours: 8,    label: "Optimistic",   color: "emerald", icon: "up",   desc: "8 hrs · 12 cycles/day — best-case smooth operations" },
  mostlikely:   { cycles: 11, effHours: 7.33, label: "Most Likely",  color: "blue",    icon: "mid",  desc: "7h 20m · 11 cycles/day — practical achievable case" },
  conservative: { cycles: 10, effHours: 6.67, label: "Conservative", color: "amber",   icon: "down", desc: "6h 40m · 10 cycles/day — accounting for delays & breaks" },
};

// ─── Default assumptions (fully editable) ────────────────────────────────────
const DEFAULT_ASSUMPTIONS = {
  // Machines
  m1cap: 13, m2cap: 8,
  m1dedicated: "b2c", m2dedicated: "b2c",  // b2b | b2c | mixed
  // Operational
  workdays: 30,
  cycleMinB2C: 40,
  // Pricing
  b2bPrice: 60, b2cPrice: 81, dcPrice: 100, gpkg: 3,
  // B2C split
  laundrySplit: 83.33, dcSplit: 16.67,
  // B2B (if applicable)
  b2bEnabled: false, b2bDailyKg: 126,
  // Expenses (monthly fixed defaults)
  rent: 30000, salaries: 80000, electricity: 15000,
  water: 8000, packaging: 5000, detergent: 10000,
  delivery: 8000, maintenance: 5000, overtime: 4000, misc: 5000,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt    = n => Math.round(n).toLocaleString("en-IN");
const fmtL   = n => (n / 100000).toFixed(2);
const fmtKg  = n => `${fmt(n)} kg`;
const fmtPct = n => `${n.toFixed(1)}%`;
const fmtR   = n => `₹ ${fmt(n)}`;

function calcScenario(scenarioKey, assumptions) {
  const seed = SCENARIO_SEEDS[scenarioKey];
  const { m1cap, m2cap, workdays, laundrySplit, dcSplit,
          b2bPrice, b2cPrice, dcPrice, gpkg,
          b2bEnabled, b2bDailyKg } = assumptions;

  // B2C capacity from both machines combined
  const m1daily = m1cap * seed.cycles;
  const m2daily = m2cap * seed.cycles;
  const b2cDailyKg = m1daily + m2daily;
  const b2cMonthly = b2cDailyKg * workdays;

  // Revenue
  const laundryKg  = b2cMonthly * (laundrySplit / 100);
  const dcKg       = b2cMonthly * (dcSplit / 100);
  const garments   = dcKg * gpkg;
  const laundryRev = laundryKg * b2cPrice;
  const dcRev      = garments * dcPrice;
  const b2bMonthly = b2bEnabled ? b2bDailyKg * workdays : 0;
  const b2bRev     = b2bMonthly * b2bPrice;
  const totalRev   = laundryRev + dcRev + b2bRev;
  const dailyRev   = totalRev / workdays;

  // Expenses
  const { rent, salaries, electricity, water, packaging,
          detergent, delivery, maintenance, overtime, misc } = assumptions;
  const totalExp = rent + salaries + electricity + water +
                   packaging + detergent + delivery + maintenance + overtime + misc;

  const profit       = totalRev - totalExp;
  const margin       = totalRev > 0 ? (profit / totalRev) * 100 : 0;
  const revPerKg     = (b2cMonthly + b2bMonthly) > 0 ? totalRev / (b2cMonthly + b2bMonthly) : 0;
  const expPerKg     = (b2cMonthly + b2bMonthly) > 0 ? totalExp / (b2cMonthly + b2bMonthly) : 0;

  return {
    seed, m1daily, m2daily, b2cDailyKg, b2cMonthly,
    laundryKg, dcKg, garments,
    laundryRev, dcRev, b2bRev, b2bMonthly,
    totalRev, dailyRev,
    totalExp, profit, margin, revPerKg, expPerKg,
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function SectionDivider({ children }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

function FieldRow({ label, unit, children }) {
  return (
    <div className="grid grid-cols-2 gap-2 items-center mb-2">
      <div>
        <p className="text-xs text-slate-600 leading-tight">{label}</p>
        {unit && <p className="text-[10px] text-slate-400 font-mono">{unit}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function NI({ value, onChange, min = 0, max, step = 1, prefix, disabled }) {
  return (
    <div className={`relative ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{prefix}</span>}
      <input
        type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={`w-full h-8 border border-slate-200 rounded-lg text-sm font-mono text-slate-800 bg-white
          focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 transition
          ${prefix ? "pl-6 pr-2" : "px-3"}`}
      />
    </div>
  );
}

function SI({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full h-8 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white px-2
        focus:outline-none focus:border-teal-400 transition">
      {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

// ─── Scenario card ────────────────────────────────────────────────────────────
const SCENARIO_STYLES = {
  emerald: { hero: "bg-emerald-600", badge: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-400", border: "border-emerald-200", text: "text-emerald-600", light: "bg-emerald-50" },
  blue:    { hero: "bg-blue-600",    badge: "bg-blue-100 text-blue-700",       ring: "ring-blue-400",    border: "border-blue-200",    text: "text-blue-600",    light: "bg-blue-50"    },
  amber:   { hero: "bg-amber-500",   badge: "bg-amber-100 text-amber-700",     ring: "ring-amber-400",   border: "border-amber-200",   text: "text-amber-600",   light: "bg-amber-50"   },
};

function ScenarioCard({ scenarioKey, out, active, onClick }) {
  const { seed, totalRev, totalExp, profit, margin, b2cDailyKg, b2cMonthly, dailyRev } = out;
  const st = SCENARIO_STYLES[seed.color];
  const Icon = seed.icon === "up" ? FiTrendingUp : seed.icon === "down" ? FiTrendingDown : FiMinus;

  return (
    <button onClick={() => onClick(scenarioKey)}
      className={`w-full text-left rounded-2xl border-2 overflow-hidden transition-all
        ${active ? `ring-2 ${st.ring} ring-offset-1 border-transparent` : "border-slate-200 hover:border-slate-300"}`}>
      {/* Header */}
      <div className={`${st.hero} px-4 py-3 flex items-center justify-between`}>
        <div>
          <p className="text-[9px] uppercase tracking-widest text-white/50 mb-0.5">{seed.desc}</p>
          <p className="text-sm font-semibold text-white flex items-center gap-1.5">
            <Icon size={14} /> {seed.label}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-white/50 uppercase tracking-widest">Monthly revenue</p>
          <p className="text-lg font-mono font-semibold text-white">₹{fmtL(totalRev)} L</p>
        </div>
      </div>
      {/* Body */}
      <div className="bg-white px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {[
          { l: "Daily output",    v: fmtKg(b2cDailyKg) },
          { l: "Monthly kg",      v: fmtKg(b2cMonthly)  },
          { l: "Daily revenue",   v: fmtR(dailyRev)      },
          { l: "Total expenses",  v: fmtR(totalExp)      },
          { l: "Net profit",      v: fmtR(profit),        cls: profit >= 0 ? "text-emerald-600" : "text-red-500" },
          { l: "Profit margin",   v: fmtPct(margin),      cls: margin >= 20 ? "text-emerald-600" : margin >= 0 ? "text-amber-600" : "text-red-500" },
        ].map(({ l, v, cls }) => (
          <div key={l}>
            <p className="text-[10px] text-slate-400">{l}</p>
            <p className={`text-sm font-mono font-medium ${cls || "text-slate-800"}`}>{v}</p>
          </div>
        ))}
      </div>
    </button>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({ scenarioKey, out, assumptions }) {
  const { seed, m1daily, m2daily, b2cDailyKg, b2cMonthly,
          laundryKg, dcKg, garments,
          laundryRev, dcRev, b2bRev, b2bMonthly,
          totalRev, dailyRev, totalExp, profit, margin, revPerKg, expPerKg } = out;
  const st = SCENARIO_STYLES[seed.color];
  const { assumptions: a } = { assumptions };
  const expRows = [
    ["Rent",          assumptions.rent],
    ["Salaries",      assumptions.salaries],
    ["Electricity",   assumptions.electricity],
    ["Water",         assumptions.water],
    ["Packaging",     assumptions.packaging],
    ["Detergent / Chemicals", assumptions.detergent],
    ["Delivery",      assumptions.delivery],
    ["Maintenance",   assumptions.maintenance],
    ["Overtime",      assumptions.overtime],
    ["Miscellaneous", assumptions.misc],
  ];

  return (
    <div className="space-y-4">
      {/* Revenue hero */}
      <div className={`${st.hero} rounded-2xl p-5 relative overflow-hidden`}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Total monthly revenue — {seed.label}</p>
        <p className="text-4xl font-light font-mono text-white">
          <span className="text-xl align-top mt-1.5 inline-block opacity-60">₹</span>{fmt(totalRev)}
        </p>
        <div className="flex flex-wrap gap-6 mt-3">
          {[
            { l: "In Lakhs",      v: `₹ ${fmtL(totalRev)} L` },
            { l: "Daily revenue", v: fmtR(dailyRev) },
            { l: "Net profit",    v: fmtR(profit) },
            { l: "Margin",        v: fmtPct(margin) },
          ].map(({ l, v }) => (
            <div key={l}>
              <p className="text-[9px] uppercase tracking-widest text-white/40 mb-0.5">{l}</p>
              <p className="text-sm font-mono font-medium text-white/90">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Capacity cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: "M1 daily output",    v: fmtKg(m1daily),      sub: `${assumptions.m1cap} kg × ${seed.cycles} cycles` },
          { l: "M2 daily output",    v: fmtKg(m2daily),      sub: `${assumptions.m2cap} kg × ${seed.cycles} cycles` },
          { l: "Combined daily",     v: fmtKg(b2cDailyKg),   sub: `${seed.cycles} cycles/day` },
        ].map(({ l, v, sub }) => (
          <div key={l} className="bg-white border border-slate-200 rounded-xl p-3.5">
            <p className="text-[10px] text-slate-400 mb-1">{l}</p>
            <p className="text-lg font-mono font-semibold text-slate-800">{v}</p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Revenue breakdown</p>
        </div>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="px-4 py-2.5 text-slate-600 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 mt-0.5" />B2C Laundry
              </td>
              <td className="px-4 py-2.5 text-slate-400 font-mono text-xs text-right">{fmtKg(laundryKg)}</td>
              <td className="px-4 py-2.5 font-mono font-medium text-right">₹ {fmt(laundryRev)}</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="px-4 py-2.5 text-slate-600 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-0.5" />B2C Dry Clean
              </td>
              <td className="px-4 py-2.5 text-slate-400 font-mono text-xs text-right">{fmt(garments)} garments</td>
              <td className="px-4 py-2.5 font-mono font-medium text-right">₹ {fmt(dcRev)}</td>
            </tr>
            {assumptions.b2bEnabled && (
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2.5 text-slate-600 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-0.5" />B2B Laundry
                </td>
                <td className="px-4 py-2.5 text-slate-400 font-mono text-xs text-right">{fmtKg(b2bMonthly)}</td>
                <td className="px-4 py-2.5 font-mono font-medium text-right">₹ {fmt(b2bRev)}</td>
              </tr>
            )}
            <tr className="bg-slate-50 font-semibold">
              <td className="px-4 py-2.5 text-slate-800">Total Revenue</td>
              <td />
              <td className={`px-4 py-2.5 font-mono text-right ${st.text}`}>₹ {fmt(totalRev)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Expense breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Expense breakdown</p>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {expRows.map(([l, v]) => (
              <tr key={l} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 text-slate-500">{l}</td>
                <td className="px-4 py-2 font-mono text-right text-slate-700">₹ {fmt(v)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td className="px-4 py-2.5 text-slate-800">Total Expenses</td>
              <td className="px-4 py-2.5 font-mono text-right text-red-500">₹ {fmt(totalExp)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Profit summary */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { l: "Net Profit / Month", v: fmtR(profit),    cls: profit >= 0 ? "text-emerald-600" : "text-red-500" },
          { l: "Profit Margin",      v: fmtPct(margin),  cls: margin >= 20 ? "text-emerald-600" : margin >= 0 ? "text-amber-600" : "text-red-500" },
          { l: "Revenue per kg",     v: fmtR(revPerKg),  cls: "text-slate-800" },
          { l: "Expense per kg",     v: fmtR(expPerKg),  cls: "text-slate-800" },
        ].map(({ l, v, cls }) => (
          <div key={l} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-1">{l}</p>
            <p className={`text-xl font-mono font-semibold ${cls}`}>{v}</p>
          </div>
        ))}
      </div>

      {/* Intermediate calcs */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Intermediate calculations</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { l: "Monthly processing",  v: fmtKg(b2cMonthly) },
            { l: "Laundry quantity",    v: fmtKg(laundryKg)  },
            { l: "Dry clean qty",       v: fmtKg(dcKg)       },
            { l: "Dry clean garments",  v: `${fmt(garments)} pcs` },
          ].map(({ l, v }) => (
            <div key={l} className="bg-white border border-slate-200 rounded-xl p-3.5">
              <p className="text-[10px] text-slate-400 mb-1">{l}</p>
              <p className="text-base font-mono font-semibold text-slate-800">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function Calculator() {
  const navigate = useNavigate();
  const { client, logout } = useHostelAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen]     = useState(false);
  const [activeScenario, setActiveScenario]         = useState("mostlikely");
  const [assumptions, setAssumptions]               = useState({ ...DEFAULT_ASSUMPTIONS });
  const [tab, setTab]                               = useState("overview"); // overview | detail | expenses

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 1024;
      setIsSidebarCollapsed(isMobile);
      if (!isMobile) setIsMobileMenuOpen(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSidebarTabChange = useCallback((t) => {
    setIsMobileMenuOpen(false);
    if (t === "investors") navigate("/admin/investors");
    else navigate("/admin");
  }, [navigate]);

  const set = (key, val) => setAssumptions(prev => ({ ...prev, [key]: val }));
  const setLaundry = v => setAssumptions(prev => ({ ...prev, laundrySplit: v, dcSplit: parseFloat((100 - v).toFixed(2)) }));
  const setDC      = v => setAssumptions(prev => ({ ...prev, dcSplit: v,       laundrySplit: parseFloat((100 - v).toFixed(2)) }));
  const handleReset = () => setAssumptions({ ...DEFAULT_ASSUMPTIONS });

  const outputs = Object.fromEntries(
    Object.keys(SCENARIO_SEEDS).map(k => [k, calcScenario(k, assumptions)])
  );
  const activeOut = outputs[activeScenario];
  const activeSt  = SCENARIO_STYLES[SCENARIO_SEEDS[activeScenario].color];
  const splitWarn = Math.abs(assumptions.laundrySplit + assumptions.dcSplit - 100) > 0.1;

  const expFields = [
    ["rent","Rent"],["salaries","Salaries"],["electricity","Electricity"],
    ["water","Water"],["packaging","Packaging"],["detergent","Detergent / Chemicals"],
    ["delivery","Delivery"],["maintenance","Maintenance"],["overtime","Overtime"],["misc","Miscellaneous"],
  ];

  return (
    <div className="flex min-h-screen bg-slate-50" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <AdminSidebar
        activeTab="calculator"
        setActiveTab={handleSidebarTabChange}
        user={client} onLogout={logout}
        isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen} setIsMobileOpen={setIsMobileMenuOpen}
      />

      <main className={`flex min-h-screen flex-1 flex-col transition-all duration-300
        ${isSidebarCollapsed ? "lg:ml-[80px]" : "lg:ml-[220px]"} ml-0`}>

        {/* ── Header ── */}
        <header className={`${activeSt.hero} px-6 py-5 relative overflow-hidden`}>
          <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/5 pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setIsMobileMenuOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white lg:hidden">
                <FiMenu size={18} />
              </button>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50 mb-0.5">Andes Services</p>
                <h1 className="text-xl font-light text-white"><strong className="font-semibold">Revenue</strong> Calculator</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleReset}
                className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/20 transition">
                <FiRefreshCw size={12} /> Reset
              </button>
              <button onClick={() => navigate("/admin")}
                className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/20 transition">
                <FiArrowLeft size={12} /> Back
              </button>
            </div>
          </div>
          {/* Summary strip */}
          <div className="relative z-10 flex flex-wrap gap-6 mt-4 pt-4 border-t border-white/10">
            {Object.entries(outputs).map(([k, o]) => (
              <button key={k} onClick={() => setActiveScenario(k)}
                className={`text-left transition ${activeScenario === k ? "opacity-100" : "opacity-50 hover:opacity-75"}`}>
                <p className="text-[9px] uppercase tracking-widest text-white/50">{SCENARIO_SEEDS[k].label}</p>
                <p className="text-base font-mono font-semibold text-white">₹ {fmtL(o.totalRev)} L</p>
              </button>
            ))}
          </div>
        </header>

        {/* ── Body ── */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0">

          {/* ════ LEFT: Assumptions ════ */}
          <div className="w-full lg:w-[300px] xl:w-[340px] flex-shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto">
            <div className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Editable assumptions</p>

              {/* Machines */}
              <SectionDivider>Machine specs</SectionDivider>
              <FieldRow label="Machine 1 capacity" unit="kg/cycle">
                <NI value={assumptions.m1cap} min={1} max={50} step={0.5} onChange={v => set("m1cap", v)} />
              </FieldRow>
              <FieldRow label="Machine 2 capacity" unit="kg/cycle">
                <NI value={assumptions.m2cap} min={1} max={50} step={0.5} onChange={v => set("m2cap", v)} />
              </FieldRow>
              <FieldRow label="Working days / month" unit="days">
                <NI value={assumptions.workdays} min={1} max={31} onChange={v => set("workdays", v)} />
              </FieldRow>

              {/* Pricing */}
              <SectionDivider>Pricing</SectionDivider>
              <FieldRow label="B2C laundry price" unit="₹ / kg">
                <NI value={assumptions.b2cPrice} min={1} prefix="₹" onChange={v => set("b2cPrice", v)} />
              </FieldRow>
              <FieldRow label="Dry clean price" unit="₹ / garment">
                <NI value={assumptions.dcPrice} min={1} prefix="₹" onChange={v => set("dcPrice", v)} />
              </FieldRow>
              <FieldRow label="Garments per kg" unit="pcs / kg">
                <NI value={assumptions.gpkg} min={1} step={0.5} onChange={v => set("gpkg", v)} />
              </FieldRow>

              {/* B2C split */}
              <SectionDivider>B2C revenue split</SectionDivider>
              <FieldRow label="Laundry split" unit="%">
                <NI value={assumptions.laundrySplit} min={0} max={100} step={0.01} onChange={setLaundry} />
              </FieldRow>
              <FieldRow label="Dry clean split" unit="%">
                <NI value={assumptions.dcSplit} min={0} max={100} step={0.01} onChange={setDC} />
              </FieldRow>
              {splitWarn && (
                <p className="text-xs text-red-500 flex items-center gap-1 mb-2">
                  <FiAlertTriangle size={11} /> Must sum to 100%
                </p>
              )}

              {/* B2B toggle */}
              <SectionDivider>B2B channel</SectionDivider>
              <FieldRow label="Enable B2B revenue">
                <button onClick={() => set("b2bEnabled", !assumptions.b2bEnabled)}
                  className={`w-full h-8 rounded-lg text-xs font-medium border transition
                    ${assumptions.b2bEnabled ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-500"}`}>
                  {assumptions.b2bEnabled ? "Enabled" : "Disabled"}
                </button>
              </FieldRow>
              {assumptions.b2bEnabled && (
                <>
                  <FieldRow label="B2B daily kg" unit="kg/day">
                    <NI value={assumptions.b2bDailyKg} min={0} onChange={v => set("b2bDailyKg", v)} />
                  </FieldRow>
                  <FieldRow label="B2B price" unit="₹ / kg">
                    <NI value={assumptions.b2bPrice} min={1} prefix="₹" onChange={v => set("b2bPrice", v)} />
                  </FieldRow>
                </>
              )}

              {/* Expenses */}
              <SectionDivider>Monthly expenses</SectionDivider>
              {expFields.map(([key, label]) => (
                <FieldRow key={key} label={label} unit="₹ / month">
                  <NI value={assumptions[key]} min={0} prefix="₹" onChange={v => set(key, v)} />
                </FieldRow>
              ))}

              <button onClick={handleReset}
                className="w-full mt-4 h-9 border border-slate-200 rounded-lg text-sm text-slate-500 font-medium
                  hover:bg-slate-50 hover:text-slate-700 transition flex items-center justify-center gap-2">
                <FiRefreshCw size={13} /> Reset all to defaults
              </button>
            </div>
          </div>

          {/* ════ RIGHT: Output ════ */}
          <div className="flex-1 overflow-y-auto">
            {/* Tab bar */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-5 flex gap-1 pt-2">
              {[
                { id: "overview", l: "Scenario Overview" },
                { id: "detail",   l: "Detailed Breakdown" },
              ].map(({ id, l }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition -mb-px
                    ${tab === id ? `border-b-2 ${activeSt.text} border-current` : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                  {l}
                </button>
              ))}
            </div>

            <div className="p-5">
              {tab === "overview" && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">Click a scenario to see its detailed breakdown. All three scenarios use the same assumptions — only cycles/day differs.</p>
                  {Object.entries(SCENARIO_SEEDS).map(([k]) => (
                    <ScenarioCard key={k} scenarioKey={k} out={outputs[k]}
                      active={activeScenario === k} onClick={k => { setActiveScenario(k); setTab("detail"); }} />
                  ))}

                  {/* Comparison table */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-2">
                    <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Side-by-side comparison</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="px-4 py-2.5 text-left text-xs text-slate-400 font-medium">Metric</th>
                            {Object.entries(SCENARIO_SEEDS).map(([k, s]) => (
                              <th key={k} className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">{s.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { l: "Cycles/day",       fn: o => o.seed.cycles },
                            { l: "Daily output",     fn: o => fmtKg(o.b2cDailyKg) },
                            { l: "Monthly kg",       fn: o => fmtKg(o.b2cMonthly) },
                            { l: "Total revenue",    fn: o => fmtR(o.totalRev) },
                            { l: "Total expenses",   fn: o => fmtR(o.totalExp) },
                            { l: "Net profit",       fn: o => fmtR(o.profit) },
                            { l: "Profit margin",    fn: o => fmtPct(o.margin) },
                            { l: "Daily revenue",    fn: o => fmtR(o.dailyRev) },
                          ].map(({ l, fn }) => (
                            <tr key={l} className="border-b border-slate-100 last:border-0">
                              <td className="px-4 py-2.5 text-slate-500">{l}</td>
                              {Object.keys(SCENARIO_SEEDS).map(k => (
                                <td key={k} className="px-4 py-2.5 font-mono text-right text-slate-800">{fn(outputs[k])}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {tab === "detail" && (
                <div>
                  {/* Scenario switcher */}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {Object.entries(SCENARIO_SEEDS).map(([k, s]) => {
                      const st2 = SCENARIO_STYLES[s.color];
                      return (
                        <button key={k} onClick={() => setActiveScenario(k)}
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition
                            ${activeScenario === k
                              ? `${st2.hero} border-transparent text-white`
                              : `bg-white ${st2.border} ${st2.text} hover:${st2.light}`}`}>
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  <DetailPanel scenarioKey={activeScenario} out={activeOut} assumptions={assumptions} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
