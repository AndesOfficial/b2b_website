import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu, FiArrowLeft, FiRefreshCw, FiAlertTriangle, FiTrendingUp, FiTrendingDown, FiMinus, FiSettings, FiX } from "react-icons/fi";
import AdminSidebar from "../components/AdminSidebar";
import { useHostelAuth } from "../context/HostelAuthContext";

// ─── Scenario seeds ───────────────────────────────────────────────────────────
const SCENARIO_SEEDS = {
  optimistic:   { cycles: 12, label: "Optimistic",   color: "emerald", icon: "up",   desc: "8 hrs · 12 cycles/day — best-case" },
  mostlikely:   { cycles: 11, label: "Most Likely",  color: "blue",    icon: "mid",  desc: "7h 20m · 11 cycles/day — practical" },
  conservative: { cycles: 10, label: "Conservative", color: "amber",   icon: "down", desc: "6h 40m · 10 cycles/day — conservative" },
};

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_ASSUMPTIONS = {
  // Machines
  m1cap: 13, m2cap: 8,
  m3enabled: false, m3cap: 8,
  m4enabled: false, m4cap: 8,
  m5enabled: false, m5cap: 8,
  // Per-machine channel mode: "b2c" | "b2b" | "both"
  m1mode: "b2c", m2mode: "b2c", m3mode: "b2c", m4mode: "b2c", m5mode: "b2c",
  // Operational
  workdays: 30,
  // Pricing
  b2bPrice: 60, b2cPrice: 81, dcPrice: 100, gpkg: 3,
  // B2C
  laundrySplit: 83.33, dcSplit: 16.67,
  // B2B (no separate enable — derived from machine modes)
  // Expenses
  rent: 30000, salaries: 80000, electricity: 15000,
  water: 8000, packaging: 5000, detergent: 10000,
  delivery: 8000, maintenance: 5000, overtime: 4000, misc: 5000,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt    = n => Math.round(n).toLocaleString("en-IN");
const fmtL   = n => (n / 100000).toFixed(2);
const fmtKg  = n => `${fmt(n)} kg`;
const fmtPct = n => `${n.toFixed(1)}%`;
const fmtR   = n => `₹ ${fmt(n)}`;

const B2B_CYCLES = 6;

// Helper: does a machine contribute to a channel given its mode?
function machineDoesB2C(mode) { return mode === "b2c" || mode === "both"; }
function machineDoesB2B(mode) { return mode === "b2b" || mode === "both"; }

function calcScenario(scenarioKey, a) {
  const seed = SCENARIO_SEEDS[scenarioKey];

  // Channels are derived purely from machine mode assignments
  // ── B2C machine output (scenario-dependent cycles) ──
  const b2cM1daily = machineDoesB2C(a.m1mode) ? a.m1cap * seed.cycles : 0;
  const b2cM2daily = machineDoesB2C(a.m2mode) ? a.m2cap * seed.cycles : 0;
  const b2cM3daily = (a.m3enabled && machineDoesB2C(a.m3mode)) ? a.m3cap * seed.cycles : 0;
  const b2cM4daily = (a.m4enabled && machineDoesB2C(a.m4mode)) ? a.m4cap * seed.cycles : 0;
  const b2cM5daily = (a.m5enabled && machineDoesB2C(a.m5mode)) ? a.m5cap * seed.cycles : 0;

  // ── B2B machine output (fixed 6 cycles/day) ──
  const b2bM1daily = machineDoesB2B(a.m1mode) ? a.m1cap * B2B_CYCLES : 0;
  const b2bM2daily = machineDoesB2B(a.m2mode) ? a.m2cap * B2B_CYCLES : 0;
  const b2bM3daily = (a.m3enabled && machineDoesB2B(a.m3mode)) ? a.m3cap * B2B_CYCLES : 0;
  const b2bM4daily = (a.m4enabled && machineDoesB2B(a.m4mode)) ? a.m4cap * B2B_CYCLES : 0;
  const b2bM5daily = (a.m5enabled && machineDoesB2B(a.m5mode)) ? a.m5cap * B2B_CYCLES : 0;

  const m1daily = b2cM1daily + b2bM1daily;
  const m2daily = b2cM2daily + b2bM2daily;
  const m3daily = b2cM3daily + b2bM3daily;
  const m4daily = b2cM4daily + b2bM4daily;
  const m5daily = b2cM5daily + b2bM5daily;

  const b2cDailyKg     = b2cM1daily + b2cM2daily + b2cM3daily + b2cM4daily + b2cM5daily;
  const b2bDailyKgCalc = b2bM1daily + b2bM2daily + b2bM3daily + b2bM4daily + b2bM5daily;

  const b2cMonthly = b2cDailyKg * a.workdays;
  const b2bMonthly = b2bDailyKgCalc * a.workdays;

  const b2cActive = b2cDailyKg > 0;
  const b2bActive = b2bDailyKgCalc > 0;

  const laundryKg  = b2cMonthly * (a.laundrySplit / 100);
  const dcKg       = b2cMonthly * (a.dcSplit / 100);
  const garments   = dcKg * a.gpkg;
  const laundryRev = laundryKg * a.b2cPrice;
  const dcRev      = garments  * a.dcPrice;
  const b2bRev     = b2bMonthly * a.b2bPrice;

  const totalRev = laundryRev + dcRev + b2bRev;
  const dailyRev = a.workdays > 0 ? totalRev / a.workdays : 0;

  const totalExp = a.rent + a.salaries + a.electricity + a.water +
                   a.packaging + a.detergent + a.delivery +
                   a.maintenance + a.overtime + a.misc;

  const totalKg  = b2cMonthly + b2bMonthly;
  const profit   = totalRev - totalExp;
  const margin   = totalRev > 0 ? (profit / totalRev) * 100 : 0;
  const revPerKg = totalKg  > 0 ? totalRev / totalKg : 0;
  const expPerKg = totalKg  > 0 ? totalExp / totalKg : 0;

  return {
    seed, m1daily, m2daily, m3daily, m4daily, m5daily,
    b2cDailyKg, b2cMonthly, b2cActive,
    b2bDailyKgCalc, b2bMonthly, b2bActive,
    laundryKg, dcKg, garments,
    laundryRev, dcRev,
    b2bRev,
    totalRev, dailyRev, totalExp,
    profit, margin, revPerKg, expPerKg,
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const SS = {
  emerald: { hero:"bg-emerald-600", ring:"ring-emerald-400", border:"border-emerald-300", text:"text-emerald-600", light:"bg-emerald-50", badge:"bg-emerald-100 text-emerald-700" },
  blue:    { hero:"bg-blue-600",    ring:"ring-blue-400",    border:"border-blue-300",    text:"text-blue-600",    light:"bg-blue-50",    badge:"bg-blue-100 text-blue-700"       },
  amber:   { hero:"bg-amber-500",   ring:"ring-amber-400",   border:"border-amber-300",   text:"text-amber-600",   light:"bg-amber-50",   badge:"bg-amber-100 text-amber-700"     },
};

// ─── UI primitives ────────────────────────────────────────────────────────────
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
    <div className="grid grid-cols-2 gap-2 items-center mb-2.5">
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

function Toggle({ enabled, onToggle, labelOn = "Enabled", labelOff = "Disabled", colorOn = "bg-blue-600 border-blue-600 text-white" }) {
  return (
    <button onClick={onToggle}
      className={`w-full h-8 rounded-lg text-xs font-semibold border transition
        ${enabled ? colorOn : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"}`}>
      {enabled ? labelOn : labelOff}
    </button>
  );
}

// ─── Machine mode selector: B2C / Both / B2B ──────────────────────────────────
function ModeToggle({ value, onChange }) {
  const opts = [
    { v: "b2c",  label: "B2C",  activeClass: "bg-emerald-500 border-emerald-500 text-white" },
    { v: "both", label: "Both", activeClass: "bg-violet-600 border-violet-600 text-white" },
    { v: "b2b",  label: "B2B",  activeClass: "bg-blue-600 border-blue-600 text-white" },
  ];
  return (
    <div className="flex rounded-lg overflow-hidden border border-slate-200 h-7">
      {opts.map(({ v, label, activeClass }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex-1 text-[10px] font-bold uppercase tracking-wide transition border-r last:border-r-0 border-slate-200
            ${value === v ? activeClass : "bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}


function ConfigModal({ assumptions, set, onClose }) {
  const splitTotal = assumptions.laundrySplit + assumptions.dcSplit;
  const splitWarn  = Math.abs(splitTotal - 100) > 0.1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,23,42,0.55)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pricing settings</p>
            <p className="text-base font-semibold text-slate-800 mt-0.5">Edit Configuration</p>
          </div>
          <button onClick={onClose}
            className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition">
            <FiX size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">

          {/* ── B2C PRICING ── */}
          <SectionDivider>B2C pricing</SectionDivider>
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
          <div className="bg-slate-50 rounded-xl p-3 mb-2 border border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">B2C revenue split</p>
            <p className="text-[10px] text-slate-400 mb-2">Laundry % and Dry Clean % are independent — set each freely</p>
            <div className="grid grid-cols-2 gap-2 mb-1">
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Laundry split %</p>
                <NI value={assumptions.laundrySplit} min={0} max={100} step={0.01}
                  onChange={v => set("laundrySplit", v)} />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Dry clean split %</p>
                <NI value={assumptions.dcSplit} min={0} max={100} step={0.01}
                  onChange={v => set("dcSplit", v)} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-slate-400">
                Total: <span className={`font-mono font-semibold ${Math.abs(splitTotal - 100) < 0.1 ? "text-emerald-600" : splitTotal > 100 ? "text-red-500" : "text-amber-500"}`}>
                  {splitTotal.toFixed(2)}%
                </span>
              </p>
              {splitWarn && (
                <p className="text-[10px] text-amber-600 flex items-center gap-1">
                  <FiAlertTriangle size={10} /> {splitTotal > 100 ? "Over 100%" : "Under 100% — unused capacity"}
                </p>
              )}
            </div>
          </div>

          {/* ── B2B PRICING ── */}
          <SectionDivider>B2B pricing</SectionDivider>
          <FieldRow label="B2B price" unit="₹ / kg">
            <NI value={assumptions.b2bPrice} min={1} prefix="₹" onChange={v => set("b2bPrice", v)} />
          </FieldRow>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose}
            className="w-full h-9 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-700 transition">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Scenario card ────────────────────────────────────────────────────────────
function ScenarioCard({ scenarioKey, out, active, onClick }) {
  const { seed, totalRev, totalExp, profit, margin, b2cDailyKg, b2cMonthly, dailyRev } = out;
  const st = SS[seed.color];
  const Icon = seed.icon === "up" ? FiTrendingUp : seed.icon === "down" ? FiTrendingDown : FiMinus;

  return (
    <button onClick={() => onClick(scenarioKey)}
      className={`w-full text-left rounded-2xl border-2 overflow-hidden transition-all
        ${active ? `ring-2 ${st.ring} ring-offset-1 border-transparent` : "border-slate-200 hover:border-slate-300"}`}>
      <div className={`${st.hero} px-4 py-3 flex items-center justify-between`}>
        <div>
          <p className="text-[9px] uppercase tracking-widest text-white/50 mb-0.5">{seed.desc}</p>
          <p className="text-sm font-semibold text-white flex items-center gap-1.5"><Icon size={14} />{seed.label}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-white/50 uppercase tracking-widest">Monthly revenue</p>
          <p className="text-lg font-mono font-semibold text-white">₹{fmtL(totalRev)} L</p>
        </div>
      </div>
      <div className="bg-white px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {[
          { l:"Daily output",   v: fmtKg(b2cDailyKg) },
          { l:"Monthly kg",     v: fmtKg(b2cMonthly)  },
          { l:"Daily revenue",  v: fmtR(dailyRev)      },
          { l:"Expenses",       v: fmtR(totalExp)      },
          { l:"Net profit",     v: fmtR(profit),  cls: profit >= 0 ? "text-emerald-600" : "text-red-500" },
          { l:"Profit margin",  v: fmtPct(margin), cls: margin >= 20 ? "text-emerald-600" : margin >= 0 ? "text-amber-600" : "text-red-500" },
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
function DetailPanel({ out, assumptions }) {
  const { seed, m1daily, m2daily, m3daily, m4daily, m5daily,
          b2cDailyKg, b2cMonthly, b2cActive,
          b2bDailyKgCalc, b2bMonthly, b2bActive,
          laundryKg, dcKg, garments, laundryRev, dcRev,
          b2bRev, totalRev, dailyRev,
          totalExp, profit, margin, revPerKg, expPerKg } = out;
  const st = SS[seed.color];

  const modeLabel = (mode) => mode === "b2c" ? "B2C" : mode === "b2b" ? "B2B" : "B2C+B2B";

  const combinedSub = [
    b2cActive ? `${seed.cycles} cyc B2C` : null,
    b2bActive ? `${B2B_CYCLES} cyc B2B` : null,
  ].filter(Boolean).join(" + ") || "no machines assigned";

  const machineSub = (cap, mode) => {
    const parts = [];
    if (machineDoesB2C(mode)) parts.push(`${cap} kg × ${seed.cycles} cyc B2C`);
    if (machineDoesB2B(mode)) parts.push(`${cap} kg × ${B2B_CYCLES} cyc B2B`);
    return parts.join(" + ");
  };

  const enabledMachines = [
    { l:"Machine 1", v:fmtKg(m1daily), sub: machineSub(assumptions.m1cap, assumptions.m1mode) },
    { l:"Machine 2", v:fmtKg(m2daily), sub: machineSub(assumptions.m2cap, assumptions.m2mode) },
    ...(assumptions.m3enabled ? [{ l:"Machine 3", v:fmtKg(m3daily), sub: machineSub(assumptions.m3cap, assumptions.m3mode) }] : []),
    ...(assumptions.m4enabled ? [{ l:"Machine 4", v:fmtKg(m4daily), sub: machineSub(assumptions.m4cap, assumptions.m4mode) }] : []),
    ...(assumptions.m5enabled ? [{ l:"Machine 5", v:fmtKg(m5daily), sub: machineSub(assumptions.m5cap, assumptions.m5mode) }] : []),
    { l:"Combined daily", v:fmtKg(b2cDailyKg + b2bDailyKgCalc), sub: combinedSub },
  ];

  const expRows = [
    ["Rent", assumptions.rent], ["Salaries", assumptions.salaries],
    ["Electricity", assumptions.electricity], ["Water", assumptions.water],
    ["Packaging", assumptions.packaging], ["Detergent / Chemicals", assumptions.detergent],
    ["Delivery", assumptions.delivery], ["Maintenance", assumptions.maintenance],
    ["Overtime", assumptions.overtime], ["Miscellaneous", assumptions.misc],
  ];

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className={`${st.hero} rounded-2xl p-5 relative overflow-hidden`}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Total monthly revenue — {seed.label}</p>
        <p className="text-4xl font-light font-mono text-white">
          <span className="text-xl align-top mt-1.5 inline-block opacity-60">₹</span>{fmt(totalRev)}
        </p>
        <div className="flex flex-wrap gap-6 mt-3">
          {[
            { l:"In Lakhs",      v:`₹ ${fmtL(totalRev)} L` },
            { l:"Daily revenue", v:fmtR(dailyRev) },
            { l:"Net profit",    v:fmtR(profit)   },
            { l:"Margin",        v:fmtPct(margin)  },
          ].map(({ l, v }) => (
            <div key={l}>
              <p className="text-[9px] uppercase tracking-widest text-white/40 mb-0.5">{l}</p>
              <p className="text-sm font-mono font-medium text-white/90">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Machine cards */}
      <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${Math.min(enabledMachines.length, 4)}, 1fr)` }}>
        {enabledMachines.map(({ l, v, sub }) => (
          <div key={l} className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 mb-1">{l}</p>
            <p className="text-base font-mono font-semibold text-slate-800">{v}</p>
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
            {b2cActive && (
              <>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-2.5 text-slate-600">
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" />B2C Laundry ({fmtPct(assumptions.laundrySplit)})</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 font-mono text-xs text-right">{fmtKg(laundryKg)}</td>
                  <td className="px-4 py-2.5 font-mono font-medium text-right">₹ {fmt(laundryRev)}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-2.5 text-slate-600">
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400" />B2C Dry Clean ({fmtPct(assumptions.dcSplit)})</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 font-mono text-xs text-right">{fmt(garments)} garments</td>
                  <td className="px-4 py-2.5 font-mono font-medium text-right">₹ {fmt(dcRev)}</td>
                </tr>
              </>
            )}
            {b2bActive && (
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2.5 text-slate-600">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" />B2B Laundry</span>
                </td>
                <td className="px-4 py-2.5 text-slate-400 font-mono text-xs text-right">{fmtKg(b2bMonthly)}</td>
                <td className="px-4 py-2.5 font-mono font-medium text-right">₹ {fmt(b2bRev)}</td>
              </tr>
            )}
            {!b2cActive && !b2bActive && (
              <tr><td colSpan={3} className="px-4 py-4 text-center text-slate-400 text-xs italic">Assign at least one machine to B2C or B2B to see revenue</td></tr>
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

      {/* Profit + per-kg */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { l:"Net Profit / Month", v:fmtR(profit),   cls: profit >= 0 ? "text-emerald-600" : "text-red-500" },
          { l:"Profit Margin",      v:fmtPct(margin),  cls: margin >= 20 ? "text-emerald-600" : margin >= 0 ? "text-amber-600" : "text-red-500" },
          { l:"Revenue per kg",     v:fmtR(revPerKg),  cls:"text-slate-800" },
          { l:"Expense per kg",     v:fmtR(expPerKg),  cls:"text-slate-800" },
        ].map(({ l, v, cls }) => (
          <div key={l} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-1">{l}</p>
            <p className={`text-xl font-mono font-semibold ${cls}`}>{v}</p>
          </div>
        ))}
      </div>

      {/* Intermediate */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Intermediate calculations</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { l:"Monthly B2C processing", v:fmtKg(b2cMonthly),      dim:!b2cActive },
            { l:"Monthly B2B processing", v:fmtKg(b2bMonthly),      dim:!b2bActive },
            { l:"Laundry quantity",        v:fmtKg(laundryKg),       dim:!b2cActive },
            { l:"Dry clean garments",      v:`${fmt(garments)} pcs`, dim:!b2cActive },
          ].map(({ l, v, dim }) => (
            <div key={l} className={`bg-white border border-slate-200 rounded-xl p-3.5 ${dim ? "opacity-30" : ""}`}>
              <p className="text-[10px] text-slate-400 mb-1">{l}</p>
              <p className="text-base font-mono font-semibold text-slate-800">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Calculator() {
  const navigate = useNavigate();
  const { client, logout } = useHostelAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen,   setIsMobileMenuOpen]   = useState(false);
  const [activeScenario,     setActiveScenario]     = useState("mostlikely");
  const [assumptions,        setAssumptions]        = useState({ ...DEFAULT_ASSUMPTIONS });
  const [tab,                setTab]                = useState("overview");
  const [showConfig,         setShowConfig]         = useState(false);

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

  const set         = (key, val) => setAssumptions(prev => ({ ...prev, [key]: val }));
  const handleReset = () => setAssumptions({ ...DEFAULT_ASSUMPTIONS });

  const outputs   = Object.fromEntries(Object.keys(SCENARIO_SEEDS).map(k => [k, calcScenario(k, assumptions)]));
  const activeOut = outputs[activeScenario];
  const activeSt  = SS[SCENARIO_SEEDS[activeScenario].color];

  const splitTotal = assumptions.laundrySplit + assumptions.dcSplit;
  // splitWarn derived per-modal only

  const expFields = [
    ["rent","Rent"],["salaries","Salaries"],["electricity","Electricity"],
    ["water","Water"],["packaging","Packaging"],["detergent","Detergent / Chemicals"],
    ["delivery","Delivery"],["maintenance","Maintenance"],["overtime","Overtime"],["misc","Miscellaneous"],
  ];

  return (
    <div className="flex min-h-screen bg-slate-50" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <AdminSidebar
        activeTab="calculator" setActiveTab={handleSidebarTabChange}
        user={client} onLogout={logout}
        isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen} setIsMobileOpen={setIsMobileMenuOpen}
      />

      <main className={`flex min-h-screen flex-1 flex-col transition-all duration-300
        ${isSidebarCollapsed ? "lg:ml-[80px]" : "lg:ml-[220px]"} ml-0`}>

        {/* Header */}
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
          {/* Scenario revenue strip */}
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

        {/* Body */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0">

          {/* ════ LEFT: Assumptions ════ */}
          <div className="w-full lg:w-[310px] xl:w-[350px] flex-shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto">
            <div className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Editable assumptions</p>
              <p className="text-[11px] text-slate-400 mb-3">All values update all 3 scenarios live</p>

              {/* ── MACHINE SPECS ── */}
              <SectionDivider>Machine specifications</SectionDivider>
              <FieldRow label="Machine 1 capacity" unit="kg/cycle">
                <NI value={assumptions.m1cap} min={1} max={50} step={0.5} onChange={v => set("m1cap", v)} />
              </FieldRow>
              <FieldRow label="Machine 1 channel" unit="assign to">
                <ModeToggle value={assumptions.m1mode} onChange={v => set("m1mode", v)} />
              </FieldRow>
              <FieldRow label="Machine 2 capacity" unit="kg/cycle">
                <NI value={assumptions.m2cap} min={1} max={50} step={0.5} onChange={v => set("m2cap", v)} />
              </FieldRow>
              <FieldRow label="Machine 2 channel" unit="assign to">
                <ModeToggle value={assumptions.m2mode} onChange={v => set("m2mode", v)} />
              </FieldRow>

              {/* Machine 3 */}
              <FieldRow label="Machine 3" unit="add new machine">
                <Toggle enabled={assumptions.m3enabled} onToggle={() => set("m3enabled", !assumptions.m3enabled)}
                  labelOn="Added ✓" labelOff="+ Add Machine 3" colorOn="bg-violet-600 border-violet-600 text-white" />
              </FieldRow>
              {assumptions.m3enabled && (
                <>
                  <FieldRow label="Machine 3 capacity" unit="kg/cycle">
                    <NI value={assumptions.m3cap} min={1} max={50} step={0.5} onChange={v => set("m3cap", v)} />
                  </FieldRow>
                  <FieldRow label="Machine 3 channel" unit="assign to">
                    <ModeToggle value={assumptions.m3mode} onChange={v => set("m3mode", v)} />
                  </FieldRow>
                </>
              )}

              {/* Machine 4 */}
              {assumptions.m3enabled && (
                <FieldRow label="Machine 4" unit="add new machine">
                  <Toggle enabled={assumptions.m4enabled} onToggle={() => set("m4enabled", !assumptions.m4enabled)}
                    labelOn="Added ✓" labelOff="+ Add Machine 4" colorOn="bg-violet-600 border-violet-600 text-white" />
                </FieldRow>
              )}
              {assumptions.m4enabled && (
                <>
                  <FieldRow label="Machine 4 capacity" unit="kg/cycle">
                    <NI value={assumptions.m4cap} min={1} max={50} step={0.5} onChange={v => set("m4cap", v)} />
                  </FieldRow>
                  <FieldRow label="Machine 4 channel" unit="assign to">
                    <ModeToggle value={assumptions.m4mode} onChange={v => set("m4mode", v)} />
                  </FieldRow>
                </>
              )}

              {/* Machine 5 */}
              {assumptions.m4enabled && (
                <FieldRow label="Machine 5" unit="add new machine">
                  <Toggle enabled={assumptions.m5enabled} onToggle={() => set("m5enabled", !assumptions.m5enabled)}
                    labelOn="Added ✓" labelOff="+ Add Machine 5" colorOn="bg-violet-600 border-violet-600 text-white" />
                </FieldRow>
              )}
              {assumptions.m5enabled && (
                <>
                  <FieldRow label="Machine 5 capacity" unit="kg/cycle">
                    <NI value={assumptions.m5cap} min={1} max={50} step={0.5} onChange={v => set("m5cap", v)} />
                  </FieldRow>
                  <FieldRow label="Machine 5 channel" unit="assign to">
                    <ModeToggle value={assumptions.m5mode} onChange={v => set("m5mode", v)} />
                  </FieldRow>
                </>
              )}

              <FieldRow label="Working days / month" unit="days">
                <NI value={assumptions.workdays} min={1} max={31} onChange={v => set("workdays", v)} />
              </FieldRow>

              {/* ── PRICING CONFIGURATION ── */}
              <SectionDivider>Pricing configuration</SectionDivider>

              {/* Active channel summary — derived from machine modes */}
              {(() => {
                const modes = [assumptions.m1mode, assumptions.m2mode,
                  ...(assumptions.m3enabled ? [assumptions.m3mode] : []),
                  ...(assumptions.m4enabled ? [assumptions.m4mode] : []),
                  ...(assumptions.m5enabled ? [assumptions.m5mode] : [])];
                const hasB2C = modes.some(machineDoesB2C);
                const hasB2B = modes.some(machineDoesB2B);
                return (
                  <div className="flex gap-2 mb-2.5">
                    <div className={`flex-1 rounded-lg px-2.5 py-2 border text-center ${hasB2C ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${hasB2C ? "text-emerald-600" : "text-slate-400"}`}>B2C</p>
                      <p className={`text-[10px] ${hasB2C ? "text-emerald-500" : "text-slate-400"}`}>{hasB2C ? "Active" : "No machines"}</p>
                    </div>
                    <div className={`flex-1 rounded-lg px-2.5 py-2 border text-center ${hasB2B ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200"}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${hasB2B ? "text-blue-600" : "text-slate-400"}`}>B2B</p>
                      <p className={`text-[10px] ${hasB2B ? "text-blue-500" : "text-slate-400"}`}>{hasB2B ? "Active" : "No machines"}</p>
                    </div>
                  </div>
                );
              })()}

              <button
                onClick={() => setShowConfig(true)}
                className="w-full h-9 bg-slate-800 text-white rounded-xl text-xs font-semibold
                  hover:bg-slate-700 transition flex items-center justify-center gap-1.5">
                <FiSettings size={13} /> Edit Pricing
              </button>

              {/* ── EXPENSES ── */}
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
              {[{ id:"overview", l:"Scenario Overview" }, { id:"detail", l:"Detailed Breakdown" }].map(({ id, l }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition -mb-px
                    ${tab === id ? `${activeSt.text} border-current` : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                  {l}
                </button>
              ))}
            </div>

            <div className="p-5">
              {tab === "overview" && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 mb-2">All 3 scenarios use the same assumptions — only cycles/day differs. Click a card to see its full breakdown.</p>
                  {Object.keys(SCENARIO_SEEDS).map(k => (
                    <ScenarioCard key={k} scenarioKey={k} out={outputs[k]}
                      active={activeScenario === k}
                      onClick={k => { setActiveScenario(k); setTab("detail"); }} />
                  ))}

                  {/* Comparison table */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
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
                            { l:"Cycles/day",     fn: o => o.seed.cycles },
                            { l:"Daily output",   fn: o => fmtKg(o.b2cDailyKg) },
                            { l:"Monthly kg",     fn: o => fmtKg(o.b2cMonthly) },
                            { l:"Total revenue",  fn: o => fmtR(o.totalRev) },
                            { l:"Expenses",       fn: o => fmtR(o.totalExp) },
                            { l:"Net profit",     fn: o => fmtR(o.profit) },
                            { l:"Profit margin",  fn: o => fmtPct(o.margin) },
                            { l:"Daily revenue",  fn: o => fmtR(o.dailyRev) },
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
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {Object.entries(SCENARIO_SEEDS).map(([k, s]) => {
                      const st2 = SS[s.color];
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
                  <DetailPanel out={activeOut} assumptions={assumptions} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Edit Configuration Modal */}
      {showConfig && (
        <ConfigModal
          assumptions={assumptions}
          set={set}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}
