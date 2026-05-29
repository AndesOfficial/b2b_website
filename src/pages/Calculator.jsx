import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu, FiArrowLeft, FiRefreshCw, FiAlertTriangle, FiTrendingUp, FiTrendingDown, FiMinus, FiSettings, FiX, FiZap, FiDroplet, FiPackage, FiInfo } from "react-icons/fi";
import AdminSidebar from "../components/AdminSidebar";
import { useHostelAuth } from "../context/HostelAuthContext";

// ─── Scenario seeds ───────────────────────────────────────────────────────────
const SCENARIO_SEEDS = {
  optimistic:   { cycles: 12, label: "Optimistic",   color: "emerald", icon: "up",   desc: "8 hrs · 12 cycles/day — best-case" },
  mostlikely:   { cycles: 11, label: "Most Likely",  color: "blue",    icon: "mid",  desc: "7h 20m · 11 cycles/day — practical" },
  conservative: { cycles: 10, label: "Conservative", color: "amber",   icon: "down", desc: "6h 40m · 10 cycles/day — conservative" },
};

// ─── B2B client presets ───────────────────────────────────────────────────────
const B2B_CLIENTS = {
  hostel: { label: "Hostel", cycles: 12, cycleMins: 40, kgPerCycle: 21, rate: 55, is_premium: true },
  hotel:  { label: "Hotel",  cycles: 6,  cycleMins: 75, kgPerCycle: 21, rate: 60, is_premium: true },
};
const B2B_DAY_MINS = 480;

// ─── All defaults (including previously hardcoded spec constants) ─────────────
const DEFAULT_ASSUMPTIONS = {
  // Machine setup
  machine_count: 2,
  m1cap: 13, m2cap: 8,
  m3enabled: false, m3cap: 8,
  m4enabled: false, m4cap: 8,
  m5enabled: false, m5cap: 8,
  m1mode: "b2c", m2mode: "b2c", m3mode: "b2c", m4mode: "b2c", m5mode: "b2c",
  b2bClientType: "hostel",
  hostelPct: 100, hotelPct: 0,
  dailyKgDemand: 0,
  demandB2CPct: 50,
  workdays: 30,

  // Pricing
  b2bPrice: 55, b2cPrice: 81, dcPrice: 100, gpkg: 3,
  laundrySplit: 83.33, dcSplit: 16.67,

  // ── Now-editable: Electricity spec ──────────────────────────────────────────
  elecRate: 13.80,
  cycleMins: 40,
  // 10 KG machine kW ratings
  m10_washerColdKw: 0.5,
  m10_washerHotKw:  2.1,
  m10_dryerKw:      0.25,
  // 15 KG machine kW ratings
  m15_washerColdKw: 0.5,
  m15_washerHotKw:  2.2,
  m15_dryerKw:      0.35,

  // ── Now-editable: Water spec ─────────────────────────────────────────────────
  waterRate:          0.38,
  water10kg:          65,
  water15kg:          95,
  practicalLoad10kg:  8,
  practicalLoad15kg:  13,

  // ── Now-editable: Detergent ──────────────────────────────────────────────────
  detergentRate: 5,

  // ── Now-editable: Packaging (B2C only) ──────────────────────────────────────
  pkgWashIronBagCost:      5,
  pkgWashIronClothesPerBag:12,
  pkgWashIronClothesPerKg: 4,
  pkgDcPolythene:          4.6,
  pkgDcCollar:             1.0,
  pkgDcCardboard:          4.0,
  pkgDcClipping:           1.0,
  pkgDcWhitePaper:         0.5,
  pkgDcGarmentsPerKg:      3,

  // ── Avg packaging cost per order (editable reference) ───────────────────────
  pkgWashIronOrderCost: 10,
  pkgWashFoldOrderCost: 10,
  pkgDcOrderCost:       10,
  pkgDcShoeOrderCost:   10,

  // Fixed monthly expenses — updated to match Monthly Operating Costs sheet
  rent: 20000,
  workers: [
    { id: 1, name: "Worker 1 – Washing",  salary: 20000 },
    { id: 2, name: "Worker 2 – Delivery", salary: 20000 },
    { id: 3, name: "Worker 3 – Ironing",  salary: 20000 },
  ],
  deliveryVehicleRent: 7000, maintenance: 2000, overtime: 0, misc: 2000,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt    = n => Math.round(n).toLocaleString("en-IN");
const fmtL   = n => (n / 100000).toFixed(2);
const fmtKg  = n => `${fmt(n)} kg`;
const fmtPct = n => `${n.toFixed(1)}%`;
const fmtR   = n => `₹ ${fmt(n)}`;
const fmtDec = (n, d = 3) => n.toFixed(d);

function machineDoesB2C(mode) { return mode === "b2c" || mode === "both"; }
function machineDoesB2B(mode) { return mode === "b2b" || mode === "both"; }

function getSpecKey(cap) { return cap <= 10 ? "10kg" : "15kg"; }

// ─── Derive all spec values from assumptions ───────────────────────────────────
function deriveSpecs(a) {
  const cycleHr = a.cycleMins / 60;

  const m10_washerCold_kwh = a.m10_washerColdKw * cycleHr;
  const m10_washerHot_kwh  = a.m10_washerHotKw  * cycleHr;
  const m10_dryer_kwh      = a.m10_dryerKw      * cycleHr;
  const m15_washerCold_kwh = a.m15_washerColdKw * cycleHr;
  const m15_washerHot_kwh  = a.m15_washerHotKw  * cycleHr;
  const m15_dryer_kwh      = a.m15_dryerKw      * cycleHr;

  const specs = {
    "10kg": {
      washerCold_kwh:    m10_washerCold_kwh,
      washerHot_kwh:     m10_washerHot_kwh,
      dryer_kwh:         m10_dryer_kwh,
      combined_cold_kwh: m10_washerCold_kwh + m10_dryer_kwh,
      combined_hot_kwh:  m10_washerHot_kwh  + m10_dryer_kwh,
      waterLitres:       a.water10kg,
      practicalLoad:     a.practicalLoad10kg,
      waterPerKg:        a.water10kg / a.practicalLoad10kg,
      waterCostPerKg:    (a.water10kg / a.practicalLoad10kg) * a.waterRate,
    },
    "15kg": {
      washerCold_kwh:    m15_washerCold_kwh,
      washerHot_kwh:     m15_washerHot_kwh,
      dryer_kwh:         m15_dryer_kwh,
      combined_cold_kwh: m15_washerCold_kwh + m15_dryer_kwh,
      combined_hot_kwh:  m15_washerHot_kwh  + m15_dryer_kwh,
      waterLitres:       a.water15kg,
      practicalLoad:     a.practicalLoad15kg,
      waterPerKg:        a.water15kg / a.practicalLoad15kg,
      waterCostPerKg:    (a.water15kg / a.practicalLoad15kg) * a.waterRate,
    },
  };

  const pkgDcPerGarment = a.pkgDcPolythene + a.pkgDcCollar + a.pkgDcCardboard + a.pkgDcClipping + a.pkgDcWhitePaper;

  return { specs, pkgDcPerGarment, cycleHr };
}

// ─── Packaging breakdown ──────────────────────────────────────────────────────
function calcPackagingBreakdown(laundryKg, dcKg, a, pkgDcPerGarment) {
  const totalClothes = laundryKg * a.pkgWashIronClothesPerKg;
  const bagsNeeded   = Math.ceil(totalClothes / a.pkgWashIronClothesPerBag);
  const washIronCost = bagsNeeded * a.pkgWashIronBagCost;
  const dcGarments   = dcKg * a.pkgDcGarmentsPerKg;
  const dcCost       = dcGarments * pkgDcPerGarment;
  return {
    totalClothes:  Math.round(totalClothes),
    bagsNeeded,
    washIronCost:  Math.round(washIronCost),
    dcGarments:    Math.round(dcGarments),
    dcCost:        Math.round(dcCost),
    total:         Math.round(washIronCost + dcCost),
  };
}

// ─── Core calculation ─────────────────────────────────────────────────────────
function calcScenario(scenarioKey, a) {
  const seed = SCENARIO_SEEDS[scenarioKey];
  const { specs, pkgDcPerGarment } = deriveSpecs(a);

  const hostelW      = (a.hostelPct || 0) / 100;
  const hotelW       = (a.hotelPct  || 0) / 100;
  const hostel       = B2B_CLIENTS.hostel;
  const hotel        = B2B_CLIENTS.hotel;
  const hostelCycles = Math.floor((hostelW * B2B_DAY_MINS) / hostel.cycleMins);
  const hotelCycles  = Math.floor((hotelW  * B2B_DAY_MINS) / hotel.cycleMins);
  const b2bCycles    = Math.round((hostelCycles + hotelCycles) * 2) / 2;
  const b2bRate      = hostel.rate * hostelW + hotel.rate * hotelW;
  const b2bClient = {
    label:        hostelW === 1 ? "Hostel" : hotelW === 1 ? "Hotel" : `Hostel ${a.hostelPct}% / Hotel ${a.hotelPct}%`,
    cycles:       b2bCycles,
    hostelCycles, hotelCycles,
    rate:         b2bRate,
    is_premium:   true,
  };

  const machines = [
    { cap: a.m1cap, mode: a.m1mode, enabled: true },
    { cap: a.m2cap, mode: a.m2mode, enabled: (a.machine_count || 2) >= 2 },
    { cap: a.m3cap, mode: a.m3mode, enabled: a.m3enabled },
    { cap: a.m4cap, mode: a.m4mode, enabled: a.m4enabled },
    { cap: a.m5cap, mode: a.m5mode, enabled: a.m5enabled },
  ];

  let b2cDailyKg = 0, b2bDailyKg = 0;
  let b2cDailyCycles = 0, b2bDailyCycles = 0;

  const mDetails = machines.map(m => {
    if (!m.enabled || m.cap <= 0) return { b2cKg: 0, b2bKg: 0, b2cCyc: 0, b2bCyc: 0 };
    const b2cKg  = machineDoesB2C(m.mode) ? m.cap * seed.cycles : 0;
    const b2bKg  = machineDoesB2B(m.mode) ? b2bCycles * m.cap : 0;
    const b2cCyc = machineDoesB2C(m.mode) ? seed.cycles : 0;
    const b2bCyc = machineDoesB2B(m.mode) ? b2bCycles  : 0;
    b2cDailyKg    += b2cKg;  b2bDailyKg    += b2bKg;
    b2cDailyCycles += b2cCyc; b2bDailyCycles += b2bCyc;
    return { b2cKg, b2bKg, b2cCyc, b2bCyc };
  });

  const [m1daily, m2daily, m3daily, m4daily, m5daily] = mDetails.map(m => m.b2cKg + m.b2bKg);

  const b2cMonthly = b2cDailyKg * a.workdays;
  const b2bMonthly = b2bDailyKg * a.workdays;
  const b2cActive  = b2cDailyKg > 0;
  const b2bActive  = b2bDailyKg > 0;

  const totalB2BCycles = hostelCycles + hotelCycles;
  const hostelFrac     = totalB2BCycles > 0 ? hostelCycles / totalB2BCycles : 0;
  const hotelFrac      = totalB2BCycles > 0 ? hotelCycles  / totalB2BCycles : 0;
  const hostelDailyKg  = b2bDailyKg * hostelFrac;
  const hotelDailyKg   = b2bDailyKg * hotelFrac;
  const hostelMonthly  = hostelDailyKg * a.workdays;
  const hotelMonthly   = hotelDailyKg  * a.workdays;
  const hostelRev      = hostelMonthly * hostel.rate;
  const hotelRev       = hotelMonthly  * hotel.rate;

  const laundryKg  = b2cMonthly * (a.laundrySplit / 100);
  const dcKg       = b2cMonthly * (a.dcSplit / 100);
  const garments   = dcKg * a.gpkg;
  const laundryRev = laundryKg * a.b2cPrice;
  const dcRev      = garments  * a.dcPrice;
  const b2bRev     = hostelRev + hotelRev;
  const totalRev   = laundryRev + dcRev + b2bRev;
  const dailyRev   = a.workdays > 0 ? totalRev / a.workdays : 0;

  const b2cMonthlyCycles   = b2cDailyCycles * a.workdays;
  const b2bMonthlyCycles   = b2bDailyCycles * a.workdays;
  const totalMonthlyCycles = b2cMonthlyCycles + b2bMonthlyCycles;

  let elec_cold_total = 0;
  let elec_hot_total  = 0;
  let waterCostTotal  = 0;

  const machineElecBreakdown = [];

  machines.forEach((m, i) => {
    if (!m.enabled || m.cap <= 0) { machineElecBreakdown.push(null); return; }

    const k    = getSpecKey(m.cap);
    const spec = specs[k];

    const b2cCyc   = mDetails[i].b2cCyc * a.workdays;
    const b2bCyc   = mDetails[i].b2bCyc * a.workdays;
    const totalCyc = b2cCyc + b2bCyc;

    const machineKwh_cold  = spec.combined_cold_kwh * totalCyc;
    const machineKwh_hot   = spec.combined_hot_kwh  * totalCyc;
    const machineCost_cold = machineKwh_cold * a.elecRate;
    const machineCost_hot  = machineKwh_hot  * a.elecRate;
    const costPerKg_cold   = (spec.combined_cold_kwh * a.elecRate) / spec.practicalLoad;
    const costPerKg_hot    = (spec.combined_hot_kwh  * a.elecRate) / spec.practicalLoad;

    const waterPerCycle  = spec.waterLitres;
    const waterPerKg     = spec.waterPerKg;
    const waterCostPerKg = spec.waterCostPerKg;
    const dailyCycles    = mDetails[i].b2cCyc + mDetails[i].b2bCyc;
    const dailyWaterL    = waterPerCycle * dailyCycles;
    const dailyWaterCost = dailyWaterL * a.waterRate;
    const monthlyWaterL  = waterPerCycle * totalCyc;
    const machineWaterCost = monthlyWaterL * a.waterRate;

    elec_cold_total += machineCost_cold;
    elec_hot_total  += machineCost_hot;
    waterCostTotal  += machineWaterCost;

    machineElecBreakdown.push({
      cap: m.cap, mode: m.mode,
      specLabel:    m.cap <= 10 ? `10 KG spec (${spec.practicalLoad} kg load)` : `15 KG spec (${spec.practicalLoad} kg load)`,
      practicalLoad: spec.practicalLoad,
      washerColdKw:  m.cap <= 10 ? a.m10_washerColdKw : a.m15_washerColdKw,
      washerHotKw:   m.cap <= 10 ? a.m10_washerHotKw  : a.m15_washerHotKw,
      dryerKw:       m.cap <= 10 ? a.m10_dryerKw      : a.m15_dryerKw,
      washerCold_kwh: spec.washerCold_kwh,
      washerHot_kwh:  spec.washerHot_kwh,
      dryer_kwh:      spec.dryer_kwh,
      combined_cold_kwh: spec.combined_cold_kwh,
      combined_hot_kwh:  spec.combined_hot_kwh,
      machineKwh_cold, machineKwh_hot,
      machineCost_cold, machineCost_hot,
      costPerKg_cold, costPerKg_hot,
      waterPerCycle, waterPerKg, waterCostPerKg,
      dailyCycles, dailyWaterL, dailyWaterCost,
      monthlyWaterL, machineWaterCost,
      totalCyc, b2cCyc, b2bCyc,
    });
  });

  const electricityCost_cold = Math.round(elec_cold_total);
  const electricityCost_hot  = Math.round(elec_hot_total);
  const electricityCost      = electricityCost_cold;
  const waterCost            = Math.round(waterCostTotal);
  const detergentCost        = Math.round((b2cMonthly + b2bMonthly) * a.detergentRate);

  const pkgBreakdown     = b2cActive ? calcPackagingBreakdown(laundryKg, dcKg, a, pkgDcPerGarment) : null;
  const packagingCostVal = b2cActive ? (pkgBreakdown ? pkgBreakdown.total : 0) : 0;

  // ── Updated: uses deliveryVehicleRent instead of delivery ──
  const totalSalaries = (a.workers || []).reduce((sum, w) => sum + (w.salary || 0), 0);
  const totalExp = a.rent + totalSalaries + electricityCost + waterCost +
                   packagingCostVal + detergentCost + a.deliveryVehicleRent + a.maintenance + a.overtime + a.misc;
  const totalExp_hot = a.rent + totalSalaries + electricityCost_hot + waterCost +
                       packagingCostVal + detergentCost + a.deliveryVehicleRent + a.maintenance + a.overtime + a.misc;

  const totalKg    = b2cMonthly + b2bMonthly;
  const profit     = totalRev - totalExp;
  const profit_hot = totalRev - totalExp_hot;
  const margin     = totalRev > 0 ? (profit     / totalRev) * 100 : 0;
  const margin_hot = totalRev > 0 ? (profit_hot / totalRev) * 100 : 0;
  const revPerKg   = totalKg  > 0 ? totalRev / totalKg : 0;
  const expPerKg   = totalKg  > 0 ? totalExp / totalKg : 0;

  return {
    seed, b2bClient, is_premium: b2bClient.is_premium,
    m1daily, m2daily, m3daily, m4daily, m5daily,
    b2cDailyKg, b2bDailyKg, b2cDailyCycles, b2bDailyCycles,
    b2cMonthlyCycles, b2bMonthlyCycles, totalMonthlyCycles,
    b2cMonthly, b2bMonthly, b2cActive, b2bActive,
    laundryKg, dcKg, garments, laundryRev, dcRev, b2bRev, totalRev, dailyRev,
    hostelCycles, hotelCycles, hostelDailyKg, hotelDailyKg,
    hostelMonthly, hotelMonthly, hostelRev, hotelRev,
    electricityCost, electricityCost_cold, electricityCost_hot,
    machineElecBreakdown, waterCost, detergentCost,
    packagingCostVal, pkgBreakdown, pkgDcPerGarment,
    totalExp, totalExp_hot, profit, profit_hot, margin, margin_hot, revPerKg, expPerKg,
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

function FieldRow({ label, unit, children, hint }) {
  return (
    <div className="grid grid-cols-2 gap-2 items-center mb-2.5">
      <div>
        <p className="text-xs text-slate-600 leading-tight">{label}</p>
        {unit && <p className="text-[10px] text-slate-400 font-mono">{unit}</p>}
        {hint && <p className="text-[9px] text-slate-300 italic">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function NI({ value, onChange, min = 0, max, step = 1, prefix, suffix, disabled }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  const commit = (raw) => {
    let n = parseFloat(raw);
    if (isNaN(n) || raw === "") n = (min !== undefined && min > 0) ? min : 0;
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    setLocal(String(n));
    onChange(n);
  };
  return (
    <div className={`relative ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{prefix}</span>}
      <input
        type="number" value={local} min={min} max={max} step={step}
        onChange={e => { setLocal(e.target.value); const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(n); }}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") commit(e.target.value); }}
        className={`w-full h-8 border border-slate-200 rounded-lg text-sm font-mono text-slate-800 bg-white
          focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 transition
          ${prefix ? "pl-6 pr-2" : suffix ? "pl-3 pr-8" : "px-3"}`}
      />
      {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{suffix}</span>}
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

function ModeToggle({ value, onChange }) {
  const opts = [
    { v: "b2c",  label: "B2C",  activeClass: "bg-emerald-500 border-emerald-500 text-white" },
    { v: "both", label: "Both", activeClass: "bg-violet-600 border-violet-600 text-white" },
    { v: "b2b",  label: "B2B",  activeClass: "bg-blue-600 border-blue-600 text-white" },
  ];
  return (
    <div className="flex rounded-lg overflow-hidden border border-slate-200 h-7">
      {opts.map(({ v, label, activeClass }) => (
        <button key={v} onClick={() => onChange(v)}
          className={`flex-1 text-[10px] font-bold uppercase tracking-wide transition border-r last:border-r-0 border-slate-200
            ${value === v ? activeClass : "bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function AutoBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider
      bg-teal-50 text-teal-600 border border-teal-200 rounded px-1.5 py-0.5 ml-1.5">
      auto
    </span>
  );
}

// ─── Derived value display row ─────────────────────────────────────────────────
function DerivedRow({ label, formula, value }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-[10px] text-slate-500">{label}</p>
        {formula && <p className="text-[9px] text-slate-300 font-mono">{formula}</p>}
      </div>
      <p className="text-[10px] font-mono font-semibold text-teal-700 ml-2 whitespace-nowrap">{value}</p>
    </div>
  );
}

// ─── Water Consumption Panel ──────────────────────────────────────────────────
function WaterConsumptionPanel({ machineElecBreakdown, workdays, waterRate }) {
  const enabledMachines = machineElecBreakdown.map((mb, i) => mb ? { ...mb, index: i } : null).filter(Boolean);
  const [selectedMachine, setSelectedMachine] = useState("all");
  if (enabledMachines.length === 0) return null;

  const viewMachines = selectedMachine === "all" ? enabledMachines : enabledMachines.filter(m => m.index === selectedMachine);
  const agg = viewMachines.reduce((acc, mb) => ({
    totalCyc:         acc.totalCyc         + mb.totalCyc,
    dailyCycles:      acc.dailyCycles      + mb.dailyCycles,
    dailyWaterL:      acc.dailyWaterL      + mb.dailyWaterL,
    dailyWaterCost:   acc.dailyWaterCost   + mb.dailyWaterCost,
    monthlyWaterL:    acc.monthlyWaterL    + mb.monthlyWaterL,
    machineWaterCost: acc.machineWaterCost + mb.machineWaterCost,
  }), { totalCyc: 0, dailyCycles: 0, dailyWaterL: 0, dailyWaterCost: 0, monthlyWaterL: 0, machineWaterCost: 0 });

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FiDroplet size={13} className="text-teal-500" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Water Consumption</p>
          <AutoBadge />
        </div>
        <div className="flex rounded-lg overflow-hidden border border-slate-200 h-7">
          <button onClick={() => setSelectedMachine("all")}
            className={`px-3 text-[10px] font-bold uppercase tracking-wide border-r border-slate-200 transition
              ${selectedMachine === "all" ? "bg-teal-500 text-white" : "bg-white text-slate-400 hover:bg-slate-50"}`}>
            All
          </button>
          {enabledMachines.map(mb => (
            <button key={mb.index} onClick={() => setSelectedMachine(mb.index)}
              className={`px-3 text-[10px] font-bold uppercase tracking-wide border-r last:border-r-0 border-slate-200 transition
                ${selectedMachine === mb.index ? "bg-teal-500 text-white" : "bg-white text-slate-400 hover:bg-slate-50"}`}>
              M{mb.index + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 pb-1 space-y-3">
        {viewMachines.map(mb => (
          <div key={mb.index} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Machine {mb.index + 1} — {mb.specLabel}</p>
              <span className="text-[9px] bg-blue-50 text-blue-500 border border-blue-100 rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide">
                {mb.waterPerCycle}L · {mb.practicalLoad}KG load
              </span>
            </div>
            <div className="space-y-0">
              <DerivedRow label="Step 1 · Water per cycle"  value={`${mb.waterPerCycle} L`} />
              <DerivedRow label="Step 2 · Water per KG"     formula={`${mb.waterPerCycle} ÷ ${mb.practicalLoad}`}                               value={`${fmtDec(mb.waterPerKg, 3)} L/KG`} />
              <DerivedRow label="Step 3 · Water cost/KG"    formula={`${fmtDec(mb.waterPerKg,3)} × ₹${waterRate}`}                              value={`₹${fmtDec(mb.waterCostPerKg, 2)}/KG`} />
              <DerivedRow label="Step 4 · Daily water"      formula={`${mb.waterPerCycle}L × ${mb.dailyCycles} cycles`}                          value={`${fmtDec(mb.dailyWaterL,0)} L/day`} />
              <DerivedRow label="Step 5 · Daily cost"       formula={`${fmtDec(mb.dailyWaterL,0)} × ₹${waterRate}`}                              value={`₹${fmtDec(mb.dailyWaterCost,2)}/day`} />
              <DerivedRow label="Step 6 · Monthly water"    formula={`${mb.waterPerCycle}L × ${mb.totalCyc} cycles`}                             value={`${fmt(mb.monthlyWaterL)} L/mo`} />
              <DerivedRow label="Step 7 · Monthly cost"     formula={`${fmt(mb.monthlyWaterL)}L × ₹${waterRate}`}                                value={fmtR(mb.machineWaterCost)} />
            </div>
          </div>
        ))}
      </div>

      {selectedMachine === "all" && viewMachines.length > 1 && (
        <div className="mx-4 mb-3 mt-1 bg-teal-50 border border-teal-200 rounded-xl p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 mb-2">Combined — All Machines</p>
          {[
            { l:"Total monthly cycles",  v:`${fmt(agg.totalCyc)} cyc`        },
            { l:"Daily cycles",          v:`${fmt(agg.dailyCycles)} cyc/day` },
            { l:"Daily water usage",     v:`${fmt(agg.dailyWaterL)} L/day`   },
            { l:"Daily water cost",      v:`₹${fmtDec(agg.dailyWaterCost,2)}/day` },
            { l:"Monthly water usage",   v:`${fmt(agg.monthlyWaterL)} L/mo`  },
            { l:"Monthly water cost",    v:fmtR(agg.machineWaterCost), bold: true },
          ].map(({ l, v, bold }) => (
            <div key={l} className="flex justify-between border-b border-teal-100 last:border-0 py-1">
              <span className="text-[10px] text-teal-600">{l}</span>
              <span className={`text-[10px] font-mono ${bold ? "font-bold text-teal-800" : "font-semibold text-slate-700"}`}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {selectedMachine !== "all" && viewMachines.length === 1 && (() => {
        const mb = viewMachines[0];
        return (
          <div className="mx-4 mb-3 mt-1 grid grid-cols-3 gap-2">
            {[
              { l:"Water/KG",     v:`${fmtDec(mb.waterPerKg,3)} L`       },
              { l:"Cost/KG",      v:`₹${fmtDec(mb.waterCostPerKg,2)}`    },
              { l:"Monthly cost", v:fmtR(mb.machineWaterCost)             },
            ].map(({ l, v }) => (
              <div key={l} className="bg-teal-50 border border-teal-100 rounded-lg p-2 text-center">
                <p className="text-[9px] uppercase tracking-widest text-teal-500 mb-0.5">{l}</p>
                <p className="text-xs font-mono font-bold text-teal-800">{v}</p>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Electricity Consumption Panel ───────────────────────────────────────────
function ElectricityConsumptionPanel({ machineElecBreakdown, elecRate }) {
  const enabledMachines = machineElecBreakdown.map((mb, i) => mb ? { ...mb, index: i } : null).filter(Boolean);
  const [selectedMachine, setSelectedMachine] = useState("all");
  if (enabledMachines.length === 0) return null;

  const viewMachines = selectedMachine === "all" ? enabledMachines : enabledMachines.filter(m => m.index === selectedMachine);
  const agg = viewMachines.reduce((acc, mb) => ({
    totalCyc:        acc.totalCyc        + mb.totalCyc,
    dailyCycles:     acc.dailyCycles     + mb.dailyCycles,
    machineKwh_cold: acc.machineKwh_cold + mb.machineKwh_cold,
    machineKwh_hot:  acc.machineKwh_hot  + mb.machineKwh_hot,
    machineCost_cold:acc.machineCost_cold+ mb.machineCost_cold,
    machineCost_hot: acc.machineCost_hot + mb.machineCost_hot,
  }), { totalCyc: 0, dailyCycles: 0, machineKwh_cold: 0, machineKwh_hot: 0, machineCost_cold: 0, machineCost_hot: 0 });

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FiZap size={13} className="text-amber-500" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Electricity Consumption</p>
          <AutoBadge />
        </div>
        <div className="flex rounded-lg overflow-hidden border border-slate-200 h-7">
          <button onClick={() => setSelectedMachine("all")}
            className={`px-3 text-[10px] font-bold uppercase tracking-wide border-r border-slate-200 transition
              ${selectedMachine === "all" ? "bg-amber-500 text-white" : "bg-white text-slate-400 hover:bg-slate-50"}`}>
            All
          </button>
          {enabledMachines.map(mb => (
            <button key={mb.index} onClick={() => setSelectedMachine(mb.index)}
              className={`px-3 text-[10px] font-bold uppercase tracking-wide border-r last:border-r-0 border-slate-200 transition
                ${selectedMachine === mb.index ? "bg-amber-500 text-white" : "bg-white text-slate-400 hover:bg-slate-50"}`}>
              M{mb.index + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 pb-1 space-y-3">
        {viewMachines.map(mb => (
          <div key={mb.index} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Machine {mb.index + 1} — {mb.specLabel}</p>
              <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-100 rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide">
                {mb.totalCyc} cyc/mo
              </span>
            </div>
            <div className="space-y-0">
              <DerivedRow label="Step 1 · Washer cold kW"         value={`${mb.washerColdKw} kW`} />
              <DerivedRow label="Step 2 · Dryer kW"               value={`${mb.dryerKw} kW`} />
              <DerivedRow label="Step 3 · Combined cold kWh/cyc"  formula={`${mb.washerColdKw} + ${mb.dryerKw} kW × cycle`}  value={`${fmtDec(mb.combined_cold_kwh, 4)} kWh`} />
              <DerivedRow label="Step 4 · Washer hot kW"          value={`${mb.washerHotKw} kW`} />
              <DerivedRow label="Step 5 · Combined hot kWh/cyc"   formula={`${mb.washerHotKw} + ${mb.dryerKw} kW × cycle`}   value={`${fmtDec(mb.combined_hot_kwh, 4)} kWh`} />
              <DerivedRow label="Step 6 · Monthly kWh (cold)"     formula={`${fmtDec(mb.combined_cold_kwh,4)} × ${mb.totalCyc} cyc`} value={`${fmtDec(mb.machineKwh_cold, 1)} kWh`} />
              <DerivedRow label="Step 7 · Monthly kWh (hot)"      formula={`${fmtDec(mb.combined_hot_kwh,4)} × ${mb.totalCyc} cyc`}  value={`${fmtDec(mb.machineKwh_hot, 1)} kWh`} />
              <DerivedRow label="Step 8 · Monthly cost (cold)"    formula={`${fmtDec(mb.machineKwh_cold,1)} kWh × ₹${elecRate}`}     value={fmtR(mb.machineCost_cold)} />
              <DerivedRow label="Step 9 · Monthly cost (hot)"     formula={`${fmtDec(mb.machineKwh_hot,1)} kWh × ₹${elecRate}`}      value={fmtR(mb.machineCost_hot)} />
            </div>
          </div>
        ))}
      </div>

      {selectedMachine === "all" && viewMachines.length > 1 && (
        <div className="mx-4 mb-3 mt-1 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">Combined — All Machines</p>
          {[
            { l:"Total monthly cycles",       v:`${fmt(agg.totalCyc)} cyc`              },
            { l:"Daily cycles",               v:`${fmt(agg.dailyCycles)} cyc/day`        },
            { l:"Monthly kWh (no heater)",    v:`${fmtDec(agg.machineKwh_cold, 1)} kWh` },
            { l:"Monthly kWh (with heater)",  v:`${fmtDec(agg.machineKwh_hot, 1)} kWh`  },
            { l:"Monthly cost (no heater)",   v:fmtR(agg.machineCost_cold)               },
            { l:"Monthly cost (with heater)", v:fmtR(agg.machineCost_hot), bold: true    },
          ].map(({ l, v, bold }) => (
            <div key={l} className="flex justify-between border-b border-amber-100 last:border-0 py-1">
              <span className="text-[10px] text-amber-700">{l}</span>
              <span className={`text-[10px] font-mono ${bold ? "font-bold text-amber-900" : "font-semibold text-slate-700"}`}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {selectedMachine !== "all" && viewMachines.length === 1 && (() => {
        const mb = viewMachines[0];
        return (
          <div className="mx-4 mb-3 mt-1 grid grid-cols-2 gap-2">
            {[
              { l:"Cost/mo (cold)", v:fmtR(mb.machineCost_cold) },
              { l:"Cost/mo (hot)",  v:fmtR(mb.machineCost_hot)  },
              { l:"kWh (cold)",     v:`${fmtDec(mb.machineKwh_cold,1)} kWh` },
              { l:"kWh (hot)",      v:`${fmtDec(mb.machineKwh_hot,1)} kWh`  },
            ].map(({ l, v }) => (
              <div key={l} className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-center">
                <p className="text-[9px] uppercase tracking-widest text-amber-500 mb-0.5">{l}</p>
                <p className="text-xs font-mono font-bold text-amber-800">{v}</p>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Machine Recommendation ───────────────────────────────────────────────────
function MachineRecommendation({ assumptions }) {
  const demand = assumptions.dailyKgDemand || 0;
  if (demand <= 0) return null;
  const hostelW       = (assumptions.hostelPct || 0) / 100;
  const hotelW        = (assumptions.hotelPct  || 0) / 100;
  const hostelDailyKg = demand * hostelW;
  const hotelDailyKg  = demand * hotelW;
  const hostelCycles  = (hostelW * B2B_DAY_MINS) / B2B_CLIENTS.hostel.cycleMins;
  const hotelCycles   = (hotelW  * B2B_DAY_MINS) / B2B_CLIENTS.hotel.cycleMins;
  const blendedCycles = hostelCycles + hotelCycles;
  const kgPerMachineDay = Math.round(blendedCycles * assumptions.m1cap);
  const machinesNeeded  = demand > 0 ? Math.ceil(demand / kgPerMachineDay) : 0;
  const canHandle = (() => {
    const modes = [assumptions.m1mode, assumptions.m2mode,
      ...(assumptions.m3enabled ? [assumptions.m3mode] : []),
      ...(assumptions.m4enabled ? [assumptions.m4mode] : []),
      ...(assumptions.m5enabled ? [assumptions.m5mode] : [])];
    return modes.filter(machineDoesB2B).length;
  })();
  const status = canHandle >= machinesNeeded ? "ok" : "warn";
  return (
    <div className={`rounded-xl border p-3 mt-1 ${status === "ok" ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${status === "ok" ? "text-emerald-600" : "text-amber-600"}`}>Machine Recommendation</p>
      <div className="space-y-1.5">
        <div className="flex justify-between"><span className="text-[11px] text-slate-500">Daily demand</span><span className="text-[11px] font-mono font-semibold text-slate-700">{demand} kg</span></div>
        {hostelDailyKg > 0 && <div className="flex justify-between"><span className="text-[11px] text-slate-500">↳ Hostel ({assumptions.hostelPct}%)</span><span className="text-[11px] font-mono text-blue-600">{hostelDailyKg.toFixed(0)} kg</span></div>}
        {hotelDailyKg  > 0 && <div className="flex justify-between"><span className="text-[11px] text-slate-500">↳ Hotel ({assumptions.hotelPct}%)</span><span className="text-[11px] font-mono text-violet-600">{hotelDailyKg.toFixed(0)} kg</span></div>}
        <div className="flex justify-between pt-1 border-t border-slate-200"><span className="text-[11px] text-slate-500">kg/machine/day (blended)</span><span className="text-[11px] font-mono text-slate-700">~{kgPerMachineDay} kg</span></div>
        <div className={`flex justify-between font-semibold ${status === "ok" ? "text-emerald-700" : "text-amber-700"}`}><span className="text-[11px]">Machines needed (B2B)</span><span className="text-[11px] font-mono">{machinesNeeded}</span></div>
        <div className="flex justify-between"><span className="text-[11px] text-slate-500">B2B machines assigned</span><span className="text-[11px] font-mono text-slate-700">{canHandle}</span></div>
      </div>
      <p className={`text-[10px] mt-2 font-medium ${status === "ok" ? "text-emerald-600" : "text-amber-600"}`}>
        {status === "ok" ? `✓ Current setup can handle ${demand} kg/day` : `⚠ Need ${machinesNeeded - canHandle} more B2B machine${machinesNeeded - canHandle > 1 ? "s" : ""} — set mode to B2B or Both`}
      </p>
    </div>
  );
}

// ─── Edit Configuration Modal ─────────────────────────────────────────────────
function ConfigModal({ assumptions, set, onClose, hasB2B }) {
  const a = assumptions;
  const splitTotal = a.laundrySplit + a.dcSplit;
  const splitWarn  = Math.abs(splitTotal - 100) > 0.1;

  const cycleHr = a.cycleMins / 60;
  const m10_cold_kwh = (a.m10_washerColdKw * cycleHr).toFixed(4);
  const m10_hot_kwh  = (a.m10_washerHotKw  * cycleHr).toFixed(4);
  const m10_dry_kwh  = (a.m10_dryerKw      * cycleHr).toFixed(4);
  const m15_cold_kwh = (a.m15_washerColdKw * cycleHr).toFixed(4);
  const m15_hot_kwh  = (a.m15_washerHotKw  * cycleHr).toFixed(4);
  const m15_dry_kwh  = (a.m15_dryerKw      * cycleHr).toFixed(4);
  const m10_waterPerKg    = (a.water10kg / a.practicalLoad10kg).toFixed(3);
  const m10_costPerKg     = (a.water10kg / a.practicalLoad10kg * a.waterRate).toFixed(2);
  const m15_waterPerKg    = (a.water15kg / a.practicalLoad15kg).toFixed(3);
  const m15_costPerKg     = (a.water15kg / a.practicalLoad15kg * a.waterRate).toFixed(2);
  const pkgDcPerGarment   = (a.pkgDcPolythene + a.pkgDcCollar + a.pkgDcCardboard + a.pkgDcClipping + a.pkgDcWhitePaper).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,23,42,0.55)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pricing & rates</p>
            <p className="text-base font-semibold text-slate-800 mt-0.5">Edit Configuration</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition">
            <FiX size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">

          {/* ── MACHINE SETUP ── */}
          <SectionDivider>Machine setup</SectionDivider>
          <FieldRow label="Machine 1 capacity" unit="kg/cycle"><NI value={a.m1cap} min={0} max={50} step={0.5} onChange={v => set("m1cap", v)}/></FieldRow>
          <FieldRow label="Machine 1 channel" unit="assign to"><ModeToggle value={a.m1mode} onChange={v => set("m1mode", v)}/></FieldRow>
          <FieldRow label="Machine 2 capacity" unit="kg/cycle"><NI value={a.m2cap} min={0} max={50} step={0.5} onChange={v => set("m2cap", v)}/></FieldRow>
          <FieldRow label="Machine 2 channel" unit="assign to"><ModeToggle value={a.m2mode} onChange={v => set("m2mode", v)}/></FieldRow>

          <FieldRow label="Machine 3" unit="add new machine">
            <Toggle enabled={a.m3enabled} onToggle={() => set("m3enabled", !a.m3enabled)} labelOn="Added ✓" labelOff="+ Add Machine 3" colorOn="bg-violet-600 border-violet-600 text-white"/>
          </FieldRow>
          {a.m3enabled && (<>
            <FieldRow label="Machine 3 capacity" unit="kg/cycle"><NI value={a.m3cap} min={0} max={50} step={0.5} onChange={v => set("m3cap", v)}/></FieldRow>
            <FieldRow label="Machine 3 channel" unit="assign to"><ModeToggle value={a.m3mode} onChange={v => set("m3mode", v)}/></FieldRow>
          </>)}
          {a.m3enabled && (
            <FieldRow label="Machine 4" unit="add new machine">
              <Toggle enabled={a.m4enabled} onToggle={() => set("m4enabled", !a.m4enabled)} labelOn="Added ✓" labelOff="+ Add Machine 4" colorOn="bg-violet-600 border-violet-600 text-white"/>
            </FieldRow>
          )}
          {a.m4enabled && (<>
            <FieldRow label="Machine 4 capacity" unit="kg/cycle"><NI value={a.m4cap} min={0} max={50} step={0.5} onChange={v => set("m4cap", v)}/></FieldRow>
            <FieldRow label="Machine 4 channel" unit="assign to"><ModeToggle value={a.m4mode} onChange={v => set("m4mode", v)}/></FieldRow>
          </>)}
          {a.m4enabled && (
            <FieldRow label="Machine 5" unit="add new machine">
              <Toggle enabled={a.m5enabled} onToggle={() => set("m5enabled", !a.m5enabled)} labelOn="Added ✓" labelOff="+ Add Machine 5" colorOn="bg-violet-600 border-violet-600 text-white"/>
            </FieldRow>
          )}
          {a.m5enabled && (<>
            <FieldRow label="Machine 5 capacity" unit="kg/cycle"><NI value={a.m5cap} min={0} max={50} step={0.5} onChange={v => set("m5cap", v)}/></FieldRow>
            <FieldRow label="Machine 5 channel" unit="assign to"><ModeToggle value={a.m5mode} onChange={v => set("m5mode", v)}/></FieldRow>
          </>)}

          <FieldRow label="Working days / month" unit="days">
            <NI value={a.workdays} min={1} max={31} onChange={v => set("workdays", v)}/>
          </FieldRow>

          {/* ── B2C PRICING ── */}
          <SectionDivider>B2C pricing</SectionDivider>
          <FieldRow label="B2C laundry price" unit="₹ / kg">
            <NI value={a.b2cPrice} min={1} prefix="₹" onChange={v => set("b2cPrice", v)} />
          </FieldRow>
          <FieldRow label="Dry clean price" unit="₹ / garment">
            <NI value={a.dcPrice} min={1} prefix="₹" onChange={v => set("dcPrice", v)} />
          </FieldRow>
          <FieldRow label="Garments per kg" unit="pcs / kg">
            <NI value={a.gpkg} min={1} step={0.5} onChange={v => set("gpkg", v)} />
          </FieldRow>

          <div className="bg-slate-50 rounded-xl p-3 mb-2 border border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">B2C revenue split</p>
            <p className="text-[10px] text-slate-400 mb-2">Laundry % and Dry Clean % are independent — set each freely</p>
            <div className="grid grid-cols-2 gap-2 mb-1">
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Laundry split %</p>
                <NI value={a.laundrySplit} min={0} max={100} step={0.01} onChange={v => set("laundrySplit", v)} />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Dry clean split %</p>
                <NI value={a.dcSplit} min={0} max={100} step={0.01} onChange={v => set("dcSplit", v)} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-slate-400">Total: <span className={`font-mono font-semibold ${Math.abs(splitTotal-100)<0.1?"text-emerald-600":splitTotal>100?"text-red-500":"text-amber-500"}`}>{splitTotal.toFixed(2)}%</span></p>
              {splitWarn && <p className="text-[10px] text-amber-600 flex items-center gap-1"><FiAlertTriangle size={10}/>{splitTotal>100?"Over 100%":"Under 100% — unused capacity"}</p>}
            </div>
          </div>

          {/* ── B2B PRICING ── */}
          {hasB2B && (<>
            <SectionDivider>B2B pricing</SectionDivider>
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-3 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1.5">Rates by client type (blended from mix)</p>
              {Object.entries(B2B_CLIENTS).map(([key, c]) => {
                const pct = key === "hostel" ? a.hostelPct : a.hotelPct;
                return (
                  <div key={key} className={`flex items-center justify-between py-1.5 border-b border-blue-100 last:border-0 ${pct > 0 ? "" : "opacity-40"}`}>
                    <span className="text-xs text-blue-700 font-semibold">{c.label} {pct}%</span>
                    <span className="text-xs font-mono text-blue-700">₹{c.rate}/kg · {c.cycles} cyc/day · {c.kgPerCycle} kg/cyc</span>
                  </div>
                );
              })}
              <div className="mt-2 pt-2 border-t border-blue-200 flex items-center justify-between">
                <span className="text-[10px] text-blue-500 font-semibold">Blended effective rate</span>
                <span className="text-xs font-mono font-bold text-blue-700">
                  ₹{(B2B_CLIENTS.hostel.rate*(a.hostelPct/100)+B2B_CLIENTS.hotel.rate*(a.hotelPct/100)).toFixed(1)}/kg
                </span>
              </div>
            </div>
          </>)}

          {/* ── ELECTRICITY SPEC ── */}
          <SectionDivider>Electricity spec</SectionDivider>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
            <p className="text-[10px] text-amber-700 font-semibold">All kWh values are auto-derived from kW × cycle duration. Edit the power ratings and cycle time below.</p>
          </div>

          <FieldRow label="Electricity rate" unit="₹ / unit (kWh)">
            <NI value={a.elecRate} min={1} step={0.1} prefix="₹" onChange={v => set("elecRate", v)} />
          </FieldRow>
          <FieldRow label="Cycle duration" unit="minutes">
            <NI value={a.cycleMins} min={10} max={120} step={1} suffix="min" onChange={v => set("cycleMins", v)} />
          </FieldRow>

          <div className="grid grid-cols-2 gap-3 mb-1">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">10 KG Machine</p>
              <FieldRow label="Washer (cold)" unit="kW">
                <NI value={a.m10_washerColdKw} min={0.1} step={0.05} suffix="kW" onChange={v => set("m10_washerColdKw", v)} />
              </FieldRow>
              <FieldRow label="Washer (hot)" unit="kW">
                <NI value={a.m10_washerHotKw} min={0.1} step={0.05} suffix="kW" onChange={v => set("m10_washerHotKw", v)} />
              </FieldRow>
              <FieldRow label="Dryer" unit="kW">
                <NI value={a.m10_dryerKw} min={0.05} step={0.05} suffix="kW" onChange={v => set("m10_dryerKw", v)} />
              </FieldRow>
              <div className="mt-2 pt-2 border-t border-slate-200 space-y-0.5 text-[9px] text-slate-400 font-mono">
                <p>Washer cold: {m10_cold_kwh} kWh/cycle</p>
                <p>Washer hot: {m10_hot_kwh} kWh/cycle</p>
                <p>Dryer: {m10_dry_kwh} kWh/cycle</p>
                <p className="text-teal-600 font-semibold">Combined cold: {(parseFloat(m10_cold_kwh)+parseFloat(m10_dry_kwh)).toFixed(4)} kWh</p>
                <p className="text-teal-600 font-semibold">Combined hot: {(parseFloat(m10_hot_kwh)+parseFloat(m10_dry_kwh)).toFixed(4)} kWh</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">15 KG Machine</p>
              <FieldRow label="Washer (cold)" unit="kW">
                <NI value={a.m15_washerColdKw} min={0.1} step={0.05} suffix="kW" onChange={v => set("m15_washerColdKw", v)} />
              </FieldRow>
              <FieldRow label="Washer (hot)" unit="kW">
                <NI value={a.m15_washerHotKw} min={0.1} step={0.05} suffix="kW" onChange={v => set("m15_washerHotKw", v)} />
              </FieldRow>
              <FieldRow label="Dryer" unit="kW">
                <NI value={a.m15_dryerKw} min={0.05} step={0.05} suffix="kW" onChange={v => set("m15_dryerKw", v)} />
              </FieldRow>
              <div className="mt-2 pt-2 border-t border-slate-200 space-y-0.5 text-[9px] text-slate-400 font-mono">
                <p>Washer cold: {m15_cold_kwh} kWh/cycle</p>
                <p>Washer hot: {m15_hot_kwh} kWh/cycle</p>
                <p>Dryer: {m15_dry_kwh} kWh/cycle</p>
                <p className="text-teal-600 font-semibold">Combined cold: {(parseFloat(m15_cold_kwh)+parseFloat(m15_dry_kwh)).toFixed(4)} kWh</p>
                <p className="text-teal-600 font-semibold">Combined hot: {(parseFloat(m15_hot_kwh)+parseFloat(m15_dry_kwh)).toFixed(4)} kWh</p>
              </div>
            </div>
          </div>

          {/* ── WATER SPEC ── */}
          <SectionDivider>Water spec</SectionDivider>
          <FieldRow label="Water rate" unit="₹ / litre">
            <NI value={a.waterRate} min={0.01} step={0.01} prefix="₹" onChange={v => set("waterRate", v)} />
          </FieldRow>

          <div className="grid grid-cols-2 gap-3 mb-1">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">10 KG Machine</p>
              <FieldRow label="Water / cycle" unit="litres">
                <NI value={a.water10kg} min={1} step={1} suffix="L" onChange={v => set("water10kg", v)} />
              </FieldRow>
              <FieldRow label="Practical load" unit="kg">
                <NI value={a.practicalLoad10kg} min={1} max={10} step={0.5} suffix="kg" onChange={v => set("practicalLoad10kg", v)} />
              </FieldRow>
              <div className="mt-2 pt-2 border-t border-slate-200 space-y-0.5 text-[9px] font-mono">
                <p className="text-slate-400">{a.water10kg} ÷ {a.practicalLoad10kg} = <span className="text-teal-600 font-semibold">{m10_waterPerKg} L/KG</span></p>
                <p className="text-slate-400">{m10_waterPerKg} × ₹{a.waterRate} = <span className="text-teal-600 font-semibold">₹{m10_costPerKg}/KG</span></p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">15 KG Machine</p>
              <FieldRow label="Water / cycle" unit="litres">
                <NI value={a.water15kg} min={1} step={1} suffix="L" onChange={v => set("water15kg", v)} />
              </FieldRow>
              <FieldRow label="Practical load" unit="kg">
                <NI value={a.practicalLoad15kg} min={1} max={15} step={0.5} suffix="kg" onChange={v => set("practicalLoad15kg", v)} />
              </FieldRow>
              <div className="mt-2 pt-2 border-t border-slate-200 space-y-0.5 text-[9px] font-mono">
                <p className="text-slate-400">{a.water15kg} ÷ {a.practicalLoad15kg} = <span className="text-teal-600 font-semibold">{m15_waterPerKg} L/KG</span></p>
                <p className="text-slate-400">{m15_waterPerKg} × ₹{a.waterRate} = <span className="text-teal-600 font-semibold">₹{m15_costPerKg}/KG</span></p>
              </div>
            </div>
          </div>

          {/* ── DETERGENT ── */}
          <SectionDivider>Detergent</SectionDivider>
          <FieldRow label="Detergent cost" unit="₹ / kg of laundry">
            <NI value={a.detergentRate} min={0} step={0.5} prefix="₹" onChange={v => set("detergentRate", v)} />
          </FieldRow>

          {/* ── PACKAGING ── */}
          <SectionDivider>Packaging — B2C only</SectionDivider>
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-2 mb-3">
            <p className="text-[10px] text-orange-600 font-semibold">B2B clients handle their own bulk packaging — not charged here.</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Avg packaging cost per order</p>
            <p className="text-[9px] text-slate-400 mb-3">Reference values — edit to match your actual costs</p>
            {[
              { label: "Wash & Iron",       key: "pkgWashIronOrderCost" },
              { label: "Wash & Fold",       key: "pkgWashFoldOrderCost" },
              { label: "Dry Clean",         key: "pkgDcOrderCost"       },
              { label: "Dry Clean (Shoes)", key: "pkgDcShoeOrderCost"   },
            ].map(({ label, key }) => (
              <FieldRow key={key} label={label} unit="₹ per order">
                <NI value={a[key]} min={0} step={0.5} prefix="₹" onChange={v => set(key, v)} />
              </FieldRow>
            ))}
          </div>

        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 h-9 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-700 transition">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Scenario card ────────────────────────────────────────────────────────────
function ScenarioCard({ scenarioKey, out, active, onClick }) {
  const { seed, totalRev, totalExp, totalExp_hot, profit, profit_hot, margin, margin_hot, b2cDailyKg, b2cMonthly, dailyRev } = out;
  const st = SS[seed.color];
  const Icon = seed.icon === "up" ? FiTrendingUp : seed.icon === "down" ? FiTrendingDown : FiMinus;
  return (
    <button onClick={() => onClick(scenarioKey)}
      className={`w-full text-left rounded-2xl border-2 overflow-hidden transition-all
        ${active ? `ring-2 ${st.ring} ring-offset-1 border-transparent` : "border-slate-200 hover:border-slate-300"}`}>
      <div className={`${st.hero} px-4 py-3 flex items-center justify-between`}>
        <div>
          <p className="text-[9px] uppercase tracking-widest text-white/50 mb-0.5">{seed.desc}</p>
          <p className="text-sm font-semibold text-white flex items-center gap-1.5"><Icon size={14}/>{seed.label}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-white/50 uppercase tracking-widest">Monthly revenue</p>
          <p className="text-lg font-mono font-semibold text-white">₹{fmtL(totalRev)} L</p>
        </div>
      </div>
      <div className="bg-white px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {[
          { l:"Daily B2C output",        v: fmtKg(b2cDailyKg) },
          { l:"Monthly B2C kg",          v: fmtKg(b2cMonthly) },
          { l:"Daily revenue",           v: fmtR(dailyRev) },
          { l:"Expenses (cold / hot)",   v: `${fmtR(totalExp)} – ${fmtR(totalExp_hot)}` },
          { l:"Net profit (cold / hot)", v: `${fmtR(profit)} – ${fmtR(profit_hot)}`, cls: profit >= 0 ? "text-emerald-600" : "text-red-500" },
          { l:"Profit margin (cold)",    v: fmtPct(margin), cls: margin >= 20 ? "text-emerald-600" : margin >= 0 ? "text-amber-600" : "text-red-500" },
        ].map(({ l, v, cls }) => (
          <div key={l}><p className="text-[10px] text-slate-400">{l}</p><p className={`text-sm font-mono font-medium ${cls || "text-slate-800"}`}>{v}</p></div>
        ))}
      </div>
    </button>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({ out, assumptions }) {
  const {
    seed, m1daily, m2daily, m3daily, m4daily, m5daily,
    b2cDailyKg, b2bDailyKg, b2cMonthlyCycles, b2bMonthlyCycles, totalMonthlyCycles,
    b2cMonthly, b2bMonthly, b2cActive, b2bActive,
    laundryKg, dcKg, garments, laundryRev, dcRev, b2bRev, totalRev, dailyRev,
    hostelCycles, hotelCycles, hostelMonthly, hotelMonthly, hostelRev, hotelRev,
    electricityCost, electricityCost_cold, electricityCost_hot,
    machineElecBreakdown, waterCost, detergentCost, packagingCostVal, pkgBreakdown, pkgDcPerGarment,
    totalExp, totalExp_hot, profit, profit_hot, margin, margin_hot, revPerKg, expPerKg,
  } = out;
  const a  = assumptions;
  const st = SS[seed.color];
  const b2bCycles = out.b2bClient.cycles;

  const machineSub = (cap, mode) => {
    const parts = [];
    if (machineDoesB2C(mode)) parts.push(`${cap}kg × ${seed.cycles} cyc B2C`);
    if (machineDoesB2B(mode)) parts.push(`${cap}kg × ${b2bCycles} cyc B2B`);
    return parts.join(" + ");
  };
  const combinedSub = [b2cActive?`${seed.cycles} cyc B2C`:null, b2bActive?`${b2bCycles} cyc B2B`:null].filter(Boolean).join(" + ") || "no machines assigned";

  const mc = a.machine_count || 2;
  const enabledMachines = [
    { l:"Machine 1", v:fmtKg(m1daily), sub: machineSub(a.m1cap, a.m1mode) },
    ...(mc >= 2 ? [{ l:"Machine 2", v:fmtKg(m2daily), sub: machineSub(a.m2cap, a.m2mode) }] : []),
    ...(a.m3enabled ? [{ l:"Machine 3", v:fmtKg(m3daily), sub: machineSub(a.m3cap, a.m3mode) }] : []),
    ...(a.m4enabled ? [{ l:"Machine 4", v:fmtKg(m4daily), sub: machineSub(a.m4cap, a.m4mode) }] : []),
    ...(a.m5enabled ? [{ l:"Machine 5", v:fmtKg(m5daily), sub: machineSub(a.m5cap, a.m5mode) }] : []),
    { l:"Combined daily", v:fmtKg(b2cDailyKg+b2bDailyKg), sub: combinedSub },
  ];

  // ── Updated: split salaries row into dynamic workers, use deliveryVehicleRent ──
  const fixedExpRows = [
    ["Rent", a.rent],
    ...(a.workers || []).map(w => [w.name, w.salary]),
    ["Delivery Vehicle Rent", a.deliveryVehicleRent],
    ["Maintenance",           a.maintenance],
    ["Petty Expenses",        a.misc],
    ["Overtime",              a.overtime],
  ];

  return (
    <div className="space-y-4">

      {/* Hero */}
      <div className={`${st.hero} rounded-2xl p-5 relative overflow-hidden`}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Total monthly revenue — {seed.label}</p>
        <p className="text-4xl font-light font-mono text-white"><span className="text-xl align-top mt-1.5 inline-block opacity-60">₹</span>{fmt(totalRev)}</p>
        <div className="flex flex-wrap gap-6 mt-3">
          {[
            { l:"In Lakhs",v:`₹ ${fmtL(totalRev)} L` }, { l:"Daily revenue",v:fmtR(dailyRev) },
            { l:"Profit (no heat)",v:fmtR(profit) },     { l:"Profit (w/ heat)",v:fmtR(profit_hot) },
            { l:"Margin (no heat)",v:fmtPct(margin) },   { l:"Margin (w/ heat)",v:fmtPct(margin_hot) },
          ].map(({ l, v }) => (
            <div key={l}><p className="text-[9px] uppercase tracking-widest text-white/40 mb-0.5">{l}</p><p className="text-sm font-mono font-medium text-white/90">{v}</p></div>
          ))}
        </div>
      </div>

      {/* Machine cards */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(enabledMachines.length,4)}, 1fr)` }}>
        {enabledMachines.map(({ l, v, sub }) => (
          <div key={l} className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 mb-1">{l}</p>
            <p className="text-base font-mono font-semibold text-slate-800">{v}</p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Water panel */}
      <WaterConsumptionPanel machineElecBreakdown={machineElecBreakdown} workdays={a.workdays} waterRate={a.waterRate} />

      {/* Electricity panel */}
      <ElectricityConsumptionPanel machineElecBreakdown={machineElecBreakdown} elecRate={a.elecRate} />

      {/* Revenue */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Revenue breakdown</p>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {b2cActive && (<>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2.5 text-slate-600"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400"/>B2C Laundry ({fmtPct(a.laundrySplit)})</span></td>
                <td className="px-4 py-2.5 text-slate-400 font-mono text-xs text-right">{fmtKg(laundryKg)}</td>
                <td className="px-4 py-2.5 font-mono font-medium text-right">₹ {fmt(laundryRev)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2.5 text-slate-600"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400"/>B2C Dry Clean ({fmtPct(a.dcSplit)})</span></td>
                <td className="px-4 py-2.5 text-slate-400 font-mono text-xs text-right">{fmt(garments)} garments</td>
                <td className="px-4 py-2.5 font-mono font-medium text-right">₹ {fmt(dcRev)}</td>
              </tr>
            </>)}
            {b2bActive && (<>
              {a.hostelPct > 0 && (
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-2.5 text-slate-600"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-400"/>B2B Hostel ({a.hostelPct}%) · ₹{B2B_CLIENTS.hostel.rate}/kg · {hostelCycles.toFixed(1)} cyc/day</span></td>
                  <td className="px-4 py-2.5 text-slate-400 font-mono text-xs text-right">{fmtKg(hostelMonthly)}</td>
                  <td className="px-4 py-2.5 font-mono font-medium text-right text-blue-700">₹ {fmt(hostelRev)}</td>
                </tr>
              )}
              {a.hotelPct > 0 && (
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-2.5 text-slate-600"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500"/>B2B Hotel ({a.hotelPct}%) · ₹{B2B_CLIENTS.hotel.rate}/kg · {hotelCycles.toFixed(1)} cyc/day</span></td>
                  <td className="px-4 py-2.5 text-slate-400 font-mono text-xs text-right">{fmtKg(hotelMonthly)}</td>
                  <td className="px-4 py-2.5 font-mono font-medium text-right text-indigo-700">₹ {fmt(hotelRev)}</td>
                </tr>
              )}
              <tr className="border-b border-slate-100 bg-blue-50/40">
                <td className="px-4 py-2 text-slate-600 pl-8"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"/>B2B Total ({out.b2bClient.label} · blended ₹{out.b2bClient.rate.toFixed(1)}/kg)</span></td>
                <td className="px-4 py-2 text-slate-400 font-mono text-xs text-right">{fmtKg(b2bMonthly)}</td>
                <td className="px-4 py-2 font-mono font-semibold text-right text-blue-800">₹ {fmt(b2bRev)}</td>
              </tr>
            </>)}
            {!b2cActive && !b2bActive && (
              <tr><td colSpan={3} className="px-4 py-4 text-center text-slate-400 text-xs italic">Assign at least one machine to B2C or B2B to see revenue</td></tr>
            )}
            <tr className="bg-slate-50 font-semibold">
              <td className="px-4 py-2.5 text-slate-800">Total Revenue</td><td/>
              <td className={`px-4 py-2.5 font-mono text-right ${st.text}`}>₹ {fmt(totalRev)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Expenses */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Expense breakdown</p>
          <span className="text-[9px] bg-teal-50 text-teal-600 border border-teal-200 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider">LG spec auto-calc</span>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {fixedExpRows.map(([l, v]) => (
              <tr key={l} className="border-b border-slate-100">
                <td className="px-4 py-2.5 text-slate-500">{l}</td>
                <td className="px-4 py-2.5 font-mono text-right text-slate-700">₹ {fmt(v)}</td>
              </tr>
            ))}
            <tr className="border-b border-slate-100 bg-teal-50/40">
              <td className="px-4 py-2.5 text-slate-600">
                <span className="flex items-center gap-1.5"><FiZap size={11} className="text-teal-500"/>Electricity <AutoBadge/></span>
                <p className="text-[9px] text-slate-400 ml-4 mt-0.5">No heater / With heater</p>
              </td>
              <td className="px-4 py-2.5 font-mono font-semibold text-right text-teal-700">
                <div>₹ {fmt(electricityCost_cold)}</div>
                <div className="text-[11px] font-normal text-slate-400">₹ {fmt(electricityCost_hot)}</div>
              </td>
            </tr>
            <tr className="border-b border-slate-100 bg-teal-50/40">
              <td className="px-4 py-2.5 text-slate-600"><span className="flex items-center gap-1.5"><FiDroplet size={11} className="text-teal-500"/>Water <AutoBadge/></span></td>
              <td className="px-4 py-2.5 font-mono font-semibold text-right text-teal-700">₹ {fmt(waterCost)}</td>
            </tr>
            <tr className="border-b border-slate-100 bg-teal-50/40">
              <td className="px-4 py-2.5 text-slate-600"><span className="flex items-center gap-1.5"><FiInfo size={11} className="text-teal-500"/>Detergent <AutoBadge/></span></td>
              <td className="px-4 py-2.5 font-mono font-semibold text-right text-teal-700">₹ {fmt(detergentCost)}</td>
            </tr>
            <tr className="border-b border-slate-100 bg-teal-50/40">
              <td className="px-4 py-2.5 text-slate-600">
                <span className="flex items-center gap-1.5"><FiPackage size={11} className="text-teal-500"/>Packaging <AutoBadge/></span>
                <p className="text-[9px] text-orange-500 font-semibold ml-4 mt-0.5">B2C only</p>
              </td>
              <td className="px-4 py-2.5 font-mono font-semibold text-right text-teal-700">₹ {fmt(packagingCostVal)}</td>
            </tr>
            <tr className="bg-slate-50 font-semibold">
              <td className="px-4 py-2.5 text-slate-800">Total Expenses</td>
              <td className="px-4 py-2.5 font-mono text-right text-red-500">
                <div>₹ {fmt(totalExp)}</div>
                <div className="text-[11px] font-normal text-red-400">₹ {fmt(totalExp_hot)} (w/ heater)</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Profit */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { l:"Net Profit (no heater)",   v:fmtR(profit),       cls: profit>=0?"text-emerald-600":"text-red-500" },
          { l:"Net Profit (with heater)", v:fmtR(profit_hot),   cls: profit_hot>=0?"text-emerald-600":"text-red-500" },
          { l:"Margin (no heater)",       v:fmtPct(margin),     cls: margin>=20?"text-emerald-600":margin>=0?"text-amber-600":"text-red-500" },
          { l:"Margin (with heater)",     v:fmtPct(margin_hot), cls: margin_hot>=20?"text-emerald-600":margin_hot>=0?"text-amber-600":"text-red-500" },
          { l:"Revenue per kg",           v:fmtR(revPerKg),     cls:"text-slate-800" },
          { l:"Expense per kg",           v:fmtR(expPerKg),     cls:"text-slate-800" },
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
            { l:"Monthly B2C processing",   v:fmtKg(b2cMonthly),               dim:!b2cActive },
            { l:"Monthly B2B processing",   v:fmtKg(b2bMonthly),               dim:!b2bActive },
            { l:"B2C monthly cycles",       v:`${fmt(b2cMonthlyCycles)} cyc`,   dim:!b2cActive },
            { l:"B2B monthly cycles",       v:`${fmt(b2bMonthlyCycles)} cyc`,   dim:!b2bActive },
            { l:"Total monthly cycles",     v:`${fmt(totalMonthlyCycles)} cyc`, dim:false },
            { l:"Elec cost (no heater)",    v:`₹ ${fmt(electricityCost_cold)}`, dim:false },
            { l:"Elec cost (w/ heater)",    v:`₹ ${fmt(electricityCost_hot)}`,  dim:false },
            { l:"Water cost (all machines)",v:`₹ ${fmt(waterCost)}`,            dim:false },
            { l:"Laundry qty (B2C)",        v:fmtKg(laundryKg),                 dim:!b2cActive },
            { l:"DC garments (B2C)",        v:`${fmt(garments)} pcs`,           dim:!b2cActive },
            { l:"Pkg: W&I bags",            v:pkgBreakdown?`${fmt(pkgBreakdown.bagsNeeded)} bags`:"—", dim:!b2cActive },
            { l:"Pkg: DC garments",         v:pkgBreakdown?`${fmt(pkgBreakdown.dcGarments)} pcs`:"—",  dim:!b2cActive },
          ].map(({ l, v, dim }) => (
            <div key={l} className={`bg-white border border-slate-200 rounded-xl p-3.5 ${dim?"opacity-30":""}`}>
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
  const [tab,                setTab]                = useState("detail");
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

  // ── Updated: deliveryVehicleRent replaces delivery; misc → Petty Expenses ──
  const expFields = [
    ["rent",                "Rent"],
    ["deliveryVehicleRent", "Delivery Vehicle Rent"],
    ["maintenance",         "Maintenance"],
    ["overtime",            "Overtime"],
    ["misc",                "Petty Expenses"],
  ];

  const mc    = assumptions.machine_count || 2;
  const modes = [
    assumptions.m1mode,
    ...(mc >= 2 ? [assumptions.m2mode] : []),
    ...(assumptions.m3enabled ? [assumptions.m3mode] : []),
    ...(assumptions.m4enabled ? [assumptions.m4mode] : []),
    ...(assumptions.m5enabled ? [assumptions.m5mode] : []),
  ];
  const hasB2C = modes.some(machineDoesB2C);
  const hasB2B = modes.some(machineDoesB2B);

  return (
    <div className="flex min-h-screen bg-slate-50" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <AdminSidebar
        activeTab="calculator" setActiveTab={handleSidebarTabChange}
        user={client} onLogout={logout}
        isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen} setIsMobileOpen={setIsMobileMenuOpen}
      />

      <main className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ${isSidebarCollapsed?"lg:ml-[80px]":"lg:ml-[220px]"} ml-0`}>

        <header className={`${activeSt.hero} px-6 py-5 relative overflow-hidden`}>
          <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/5 pointer-events-none"/>
          <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setIsMobileMenuOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white lg:hidden">
                <FiMenu size={18}/>
              </button>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50 mb-0.5">Andes Services</p>
                <h1 className="text-xl font-light text-white"><strong className="font-semibold">Revenue</strong> Calculator</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleReset} className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/20 transition">
                <FiRefreshCw size={12}/> Reset
              </button>
              <button onClick={() => navigate("/admin")} className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/20 transition">
                <FiArrowLeft size={12}/> Back
              </button>
            </div>
          </div>
          <div className="relative z-10 flex flex-wrap gap-6 mt-4 pt-4 border-t border-white/10">
            {Object.entries(outputs).map(([k, o]) => (
              <button key={k} onClick={() => setActiveScenario(k)}
                className={`text-left transition ${activeScenario===k?"opacity-100":"opacity-50 hover:opacity-75"}`}>
                <p className="text-[9px] uppercase tracking-widest text-white/50">{SCENARIO_SEEDS[k].label}</p>
                <p className="text-base font-mono font-semibold text-white">₹ {fmtL(o.totalRev)} L</p>
              </button>
            ))}
          </div>
        </header>

        <div className="flex flex-col lg:flex-row flex-1 min-h-0">

          {/* LEFT panel */}
          <div className="w-full lg:w-[310px] xl:w-[350px] flex-shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto">
            <div className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Editable assumptions</p>
              <p className="text-[11px] text-slate-400 mb-3">All values update all 3 scenarios live</p>

              {hasB2B && (<>
                <SectionDivider>B2B client mix</SectionDivider>
                <div className="mb-3">
                  <p className="text-[10px] text-slate-400 mb-2">What % of your B2B load is Hostel vs Hotel?</p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <p className="text-[11px] font-semibold text-blue-700 mb-1">🏨 Hostel %</p>
                      <NI value={assumptions.hostelPct} min={0} max={100} step={1} onChange={v => { const c=Math.min(100,Math.max(0,v)); set("hostelPct",c); set("b2bClientType",c>=assumptions.hotelPct?"hostel":"hotel"); }}/>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-violet-700 mb-1">🏩 Hotel %</p>
                      <NI value={assumptions.hotelPct} min={0} max={100} step={1} onChange={v => { const c=Math.min(100,Math.max(0,v)); set("hotelPct",c); set("b2bClientType",assumptions.hostelPct>=c?"hostel":"hotel"); }}/>
                    </div>
                  </div>
                  {(assumptions.hostelPct+assumptions.hotelPct>100) && <p className="text-[10px] text-red-500 flex items-center gap-1 mb-2"><FiAlertTriangle size={10}/> Total exceeds 100%</p>}
                  {(assumptions.hostelPct+assumptions.hotelPct<100)&&(assumptions.hostelPct+assumptions.hotelPct>0) && <p className="text-[10px] text-amber-500 flex items-center gap-1 mb-2"><FiAlertTriangle size={10}/> Total is {assumptions.hostelPct+assumptions.hotelPct}% — {100-assumptions.hostelPct-assumptions.hotelPct}% uncounted</p>}
                  <div className="flex rounded-xl overflow-hidden h-7 border border-slate-200 mb-1">
                    {assumptions.hostelPct>0 && <div className="bg-blue-500 flex items-center justify-center transition-all" style={{width:`${assumptions.hostelPct}%`}}><span className="text-[9px] font-bold text-white truncate px-1">Hostel {assumptions.hostelPct}%</span></div>}
                    {assumptions.hotelPct>0  && <div className="bg-violet-500 flex items-center justify-center transition-all" style={{width:`${assumptions.hotelPct}%`}}><span className="text-[9px] font-bold text-white truncate px-1">Hotel {assumptions.hotelPct}%</span></div>}
                    {assumptions.hostelPct===0&&assumptions.hotelPct===0 && <div className="flex-1 bg-slate-100 flex items-center justify-center"><span className="text-[9px] text-slate-400">0% / 0%</span></div>}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mt-2 bg-slate-50 rounded-xl p-2 border border-slate-100 text-center">
                    <div><p className="text-[9px] uppercase tracking-widest text-slate-400">Blended cycles</p><p className="text-xs font-mono font-semibold text-slate-700">{(B2B_CLIENTS.hostel.cycles*(assumptions.hostelPct/100)+B2B_CLIENTS.hotel.cycles*(assumptions.hotelPct/100)).toFixed(1)}/day</p></div>
                    <div><p className="text-[9px] uppercase tracking-widest text-slate-400">Blended rate</p><p className="text-xs font-mono font-semibold text-slate-700">₹{(B2B_CLIENTS.hostel.rate*(assumptions.hostelPct/100)+B2B_CLIENTS.hotel.rate*(assumptions.hotelPct/100)).toFixed(0)}/kg</p></div>
                    <div><p className="text-[9px] uppercase tracking-widest text-slate-400">Kg/machine/day</p><p className="text-xs font-mono font-semibold text-slate-700">~{Math.round((B2B_CLIENTS.hostel.cycles*(assumptions.hostelPct/100)+B2B_CLIENTS.hotel.cycles*(assumptions.hotelPct/100))*21)} kg</p></div>
                  </div>
                </div>
              </>)}

              <SectionDivider>Pricing configuration</SectionDivider>
              <div className="flex gap-2 mb-2.5">
                <div className={`flex-1 rounded-lg px-2.5 py-2 border text-center ${hasB2C?"bg-emerald-50 border-emerald-200":"bg-slate-50 border-slate-200"}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${hasB2C?"text-emerald-600":"text-slate-400"}`}>B2C</p>
                  <p className={`text-[10px] ${hasB2C?"text-emerald-500":"text-slate-400"}`}>{hasB2C?"Active":"No machines"}</p>
                </div>
                <div className={`flex-1 rounded-lg px-2.5 py-2 border text-center ${hasB2B?"bg-blue-50 border-blue-200":"bg-slate-50 border-slate-200"}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${hasB2B?"text-blue-600":"text-slate-400"}`}>B2B</p>
                  <p className={`text-[10px] ${hasB2B?"text-blue-500":"text-slate-400"}`}>{hasB2B?"Active":"No machines"}</p>
                </div>
              </div>
              <button onClick={() => setShowConfig(true)}
                className="w-full h-9 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-700 transition flex items-center justify-center gap-1.5 mb-1">
                <FiSettings size={13}/> Edit Configuration
              </button>

              <SectionDivider>Auto-calculated costs</SectionDivider>
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-2.5">
                <p className="text-[10px] font-bold text-teal-700 mb-1.5 flex items-center gap-1"><FiZap size={10}/> LG Spec — Heater OFF / Heater ON</p>
                {[
                  { l:"Electricity (no heater)",   v:fmtR(activeOut.electricityCost_cold) },
                  { l:"Electricity (with heater)", v:fmtR(activeOut.electricityCost_hot) },
                  { l:"Water (all machines)",       v:fmtR(activeOut.waterCost) },
                  { l:"Detergent (B2C + B2B)",      v:fmtR(activeOut.detergentCost) },
                ].map(({ l, v }) => (
                  <div key={l} className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-teal-600">{l}</p>
                    <p className="text-[10px] font-mono font-semibold text-teal-800">{v}</p>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-teal-600">Packaging <span className="text-[9px] text-orange-500 font-semibold">(B2C only)</span></p>
                  <p className="text-[10px] font-mono font-semibold text-teal-800">{fmtR(activeOut.packagingCostVal)}</p>
                </div>
                <p className="text-[9px] text-teal-500 mt-1.5">{SCENARIO_SEEDS[activeScenario].label} · ₹{assumptions.elecRate}/unit · {assumptions.cycleMins}min cycle</p>
              </div>

              <SectionDivider>Fixed monthly expenses</SectionDivider>

              {/* Workers – dynamic list */}
              <div className="mb-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-slate-600">Workers</p>
                  <button
                    onClick={() => {
                      const workers = assumptions.workers || [];
                      const newId = Date.now();
                      set("workers", [...workers, { id: newId, name: `Worker ${workers.length + 1}`, salary: 20000 }]);
                    }}
                    className="text-[10px] font-semibold text-teal-600 border border-teal-200 bg-teal-50 hover:bg-teal-100 rounded-lg px-2.5 py-1 transition">
                    + Add Worker
                  </button>
                </div>
                {(assumptions.workers || []).map((worker, idx) => (
                  <div key={worker.id} className="grid grid-cols-[1fr_auto_auto] gap-1.5 items-center mb-1.5">
                    <input
                      type="text"
                      value={worker.name}
                      onChange={e => {
                        const updated = assumptions.workers.map(w => w.id === worker.id ? { ...w, name: e.target.value } : w);
                        set("workers", updated);
                      }}
                      className="h-8 border border-slate-200 rounded-lg text-xs text-slate-700 px-2.5 bg-white focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 transition"
                      placeholder="Worker name"
                    />
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">₹</span>
                      <input
                        type="number"
                        value={worker.salary}
                        min={0}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          const updated = assumptions.workers.map(w => w.id === worker.id ? { ...w, salary: val } : w);
                          set("workers", updated);
                        }}
                        className="w-28 h-8 pl-6 pr-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 bg-white focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 transition"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const updated = assumptions.workers.filter(w => w.id !== worker.id);
                        set("workers", updated);
                      }}
                      className="h-8 w-8 flex items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition text-xs font-bold">
                      ×
                    </button>
                  </div>
                ))}
                {(assumptions.workers || []).length > 0 && (
                  <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-100">
                    <p className="text-[10px] text-slate-400">{(assumptions.workers || []).length} worker{(assumptions.workers || []).length !== 1 ? "s" : ""}</p>
                    <p className="text-[10px] font-mono font-semibold text-slate-600">
                      Total: ₹{((assumptions.workers || []).reduce((s, w) => s + (w.salary || 0), 0)).toLocaleString("en-IN")} / mo
                    </p>
                  </div>
                )}
                {(assumptions.workers || []).length === 0 && (
                  <p className="text-[10px] text-slate-400 italic">No workers added yet.</p>
                )}
              </div>

              {expFields.map(([key, label]) => (
                <FieldRow key={key} label={label} unit="₹ / month">
                  <NI value={assumptions[key]} min={0} prefix="₹" onChange={v => set(key, v)}/>
                </FieldRow>
              ))}

              <SectionDivider>Daily kg demand</SectionDivider>
              <FieldRow label="Total daily kg to process" unit="kg / day">
                <NI value={assumptions.dailyKgDemand} min={0} max={9999} step={10} onChange={v => set("dailyKgDemand", v)}/>
              </FieldRow>
              <p className="text-[10px] text-slate-400 mb-3">Enter your expected total demand — set B2C/B2B split and we'll recommend machines.</p>

              {/* B2C / B2B split */}
              {(assumptions.dailyKgDemand > 0) && (() => {
                const totalKg = assumptions.dailyKgDemand;
                const b2cPct  = assumptions.demandB2CPct !== undefined ? assumptions.demandB2CPct : 50;
                const b2bPct  = 100 - b2cPct;
                const b2cKg   = Math.round(totalKg * b2cPct / 100);
                const b2bKg   = totalKg - b2cKg;
                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">B2C / B2B Demand Split</p>

                    <div className="relative h-5 rounded-full overflow-hidden flex mb-2">
                      <div className="bg-emerald-500 transition-all duration-200" style={{ width: `${b2cPct}%` }} />
                      <div className="bg-blue-500 flex-1 transition-all duration-200" />
                    </div>
                    <div className="flex justify-between text-[10px] font-semibold mb-3">
                      <span className="text-emerald-600">B2C {b2cPct}% · {b2cKg} kg/day</span>
                      <span className="text-blue-600">B2B {b2bPct}% · {b2bKg} kg/day</span>
                    </div>

                    <div className="mb-3">
                      <p className="text-[10px] text-slate-400 mb-1">Drag to adjust split</p>
                      <input
                        type="range" min={0} max={100} step={5}
                        value={b2cPct}
                        onChange={e => set("demandB2CPct", Number(e.target.value))}
                        className="w-full h-1.5"
                        style={{ accentColor: "#10b981" }}
                      />
                      <div className="flex justify-between text-[9px] text-slate-300 mt-0.5">
                        <span>0% B2C</span><span>50/50</span><span>100% B2C</span>
                      </div>
                    </div>

                    <div className="flex gap-1.5 flex-wrap mb-1">
                      {[[100,0],[75,25],[50,50],[25,75],[0,100]].map(([b2c]) => (
                        <button key={b2c} onClick={() => set("demandB2CPct", b2c)}
                          className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition
                            ${b2cPct === b2c
                              ? "bg-slate-700 text-white border-slate-700"
                              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                          {b2c}:{100-b2c}
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] text-slate-300 italic mb-3">B2C : B2B ratio presets</p>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-center">
                        <p className="text-[9px] uppercase tracking-widest text-emerald-500 mb-0.5">B2C daily</p>
                        <p className="text-sm font-mono font-bold text-emerald-700">{b2cKg} kg</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
                        <p className="text-[9px] uppercase tracking-widest text-blue-500 mb-0.5">B2B daily</p>
                        <p className="text-sm font-mono font-bold text-blue-700">{b2bKg} kg</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <MachineRecommendation assumptions={assumptions}/>

              <button onClick={handleReset}
                className="w-full mt-4 h-9 border border-slate-200 rounded-lg text-sm text-slate-500 font-medium hover:bg-slate-50 hover:text-slate-700 transition flex items-center justify-center gap-2">
                <FiRefreshCw size={13}/> Reset all to defaults
              </button>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex-1 overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-5 flex gap-1 pt-2">
              {[{ id:"overview", l:"Scenario Overview" }, { id:"detail", l:"Detailed Breakdown" }].map(({ id, l }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition -mb-px
                    ${tab===id ? `${activeSt.text} border-current` : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                  {l}
                </button>
              ))}
            </div>

            <div className="p-5">
              {tab === "overview" && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 mb-2">All 3 scenarios use the same assumptions — only B2C cycles/day differs.</p>
                  {Object.keys(SCENARIO_SEEDS).map(k => (
                    <ScenarioCard key={k} scenarioKey={k} out={outputs[k]} active={activeScenario===k}
                      onClick={k => { setActiveScenario(k); setTab("detail"); }}/>
                  ))}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Side-by-side comparison</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="px-4 py-2.5 text-left text-xs text-slate-400 font-medium">Metric</th>
                            {Object.entries(SCENARIO_SEEDS).map(([k,s]) => <th key={k} className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">{s.label}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { l:"B2C cycles/day",       fn: o => o.seed.cycles },
                            { l:"Daily B2C kg",         fn: o => fmtKg(o.b2cDailyKg) },
                            { l:"Daily B2B kg",         fn: o => fmtKg(o.b2bDailyKg) },
                            { l:"Monthly B2C",          fn: o => fmtKg(o.b2cMonthly) },
                            { l:"Monthly B2B",          fn: o => fmtKg(o.b2bMonthly) },
                            { l:"Elec (no heater)",     fn: o => fmtR(o.electricityCost_cold) },
                            { l:"Elec (with heater)",   fn: o => fmtR(o.electricityCost_hot) },
                            { l:"Water",                fn: o => fmtR(o.waterCost) },
                            { l:"Detergent",            fn: o => fmtR(o.detergentCost) },
                            { l:"Packaging (B2C only)", fn: o => fmtR(o.packagingCostVal) },
                            { l:"Total revenue",        fn: o => fmtR(o.totalRev) },
                            { l:"Expenses (no heater)", fn: o => fmtR(o.totalExp) },
                            { l:"Expenses (w/ heater)", fn: o => fmtR(o.totalExp_hot) },
                            { l:"Profit (no heater)",   fn: o => fmtR(o.profit) },
                            { l:"Profit (w/ heater)",   fn: o => fmtR(o.profit_hot) },
                            { l:"Margin (no heater)",   fn: o => fmtPct(o.margin) },
                            { l:"Margin (w/ heater)",   fn: o => fmtPct(o.margin_hot) },
                          ].map(({ l, fn }) => (
                            <tr key={l} className="border-b border-slate-100 last:border-0">
                              <td className="px-4 py-2.5 text-slate-500">{l}</td>
                              {Object.keys(SCENARIO_SEEDS).map(k => <td key={k} className="px-4 py-2.5 font-mono text-right text-slate-800">{fn(outputs[k])}</td>)}
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
                            ${activeScenario===k ? `${st2.hero} border-transparent text-white` : `bg-white ${st2.border} ${st2.text}`}`}>
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  <DetailPanel out={activeOut} assumptions={assumptions}/>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {showConfig && <ConfigModal assumptions={assumptions} set={set} onClose={() => setShowConfig(false)} hasB2B={hasB2B}/>}
    </div>
  );
}
