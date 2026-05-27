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

// ─── Auto-cost constants ──────────────────────────────────────────────────────
const ELEC_RATE           = 13.80; // ₹/unit (kWh)
const B2C_UNITS_PER_CYCLE = 8;    // units per cycle
const B2B_KWH_PER_KG      = 0.331; // kWh per kg (washing machine)
const DRYER_KWH_PER_KG    = 0.415; // kWh per kg (dryer)
const WATER_LITRES_CYCLE  = 60;   // litres per cycle
const WATER_RATE          = 0.38; // ₹/litre
const DETERGENT_RATE      = 5;    // ₹/kg

// Packaging: tiered by utilisation % of B2C monthly kg capacity
const PKG_TIERS = [
  { upto: 25,  cost: 3920  },
  { upto: 35,  cost: 5236  },
  { upto: 80,  cost: 12514 },
  { upto: 100, cost: 15760 },
];

function packagingCost(laundrySplitPct) {
  const pct = Math.min(100, Math.max(0, laundrySplitPct));
  for (const tier of PKG_TIERS) {
    if (pct <= tier.upto) return tier.cost;
  }
  return PKG_TIERS[PKG_TIERS.length - 1].cost;
}

// ─── B2B client presets ───────────────────────────────────────────────────────
// cycles/day are for a standard 21 kg machine (8 hr day).
// Cycle durations are used to time-split machines with mixed hostel/hotel loads.
const B2B_CLIENTS = {
  hostel: { label: "Hostel", cycles: 12, cycleMins: 40, kgPerCycle: 21, rate: 55, is_premium: true },
  hotel:  { label: "Hotel",  cycles: 6,  cycleMins: 75, kgPerCycle: 21, rate: 60, is_premium: true },
};

// Total operating minutes in a standard B2B day = 8 hours = 480 min
// (matches reference: 50% hostel → 6 cycles × 40 min = 240 min; 50% hotel → 3 cycles × 75 min = 225 min)
const B2B_DAY_MINS = 480;

// ─── DS onboarding config ─────────────────────────────────────────────────────
// distribution_model: null | "b2c" | "b2b" | "both"
// b2b_client_type:    null | "hostel" | "hotel"
// machine_count:      1–20 (used by onboarding step 3)
// is_premium:         true for all B2B clients
// b2b_split_percent:  0–100, only used if model = "both"
// onboarding_done:    false until user completes DS onboarding flow

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_ASSUMPTIONS = {
  // DS onboarding fields
  distribution_model:  null,
  b2b_client_type:     null,
  machine_count:       1,
  is_premium:          false,
  b2b_split_percent:   null,
  onboarding_done:     false,
  // Machines
  m1cap: 13, m2cap: 8,
  m3enabled: false, m3cap: 8,
  m4enabled: false, m4cap: 8,
  m5enabled: false, m5cap: 8,
  // Per-machine channel mode: "b2c" | "b2b" | "both"
  m1mode: "b2c", m2mode: "b2c", m3mode: "b2c", m4mode: "b2c", m5mode: "b2c",
  // B2B client type: "hostel" | "hotel"
  b2bClientType: "hostel",
  // B2B split: hostel vs hotel (must sum to 100)
  hostelPct: 100, hotelPct: 0,
  // Daily kg demand (for machine recommendation)
  dailyKgDemand: 0,
  // Operational
  workdays: 30,
  // Pricing
  b2bPrice: 55, b2cPrice: 81, dcPrice: 100, gpkg: 3,
  // B2C splits
  laundrySplit: 83.33, dcSplit: 16.67,
  // Auto-cost rate overrides
  elecRate: ELEC_RATE,
  // Dryer
  dryerMonthlyKg: 0,
  // Fixed expenses
  rent: 30000, salaries: 80000,
  delivery: 8000, maintenance: 5000, overtime: 4000, misc: 5000,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt    = n => Math.round(n).toLocaleString("en-IN");
const fmtL   = n => (n / 100000).toFixed(2);
const fmtKg  = n => `${fmt(n)} kg`;
const fmtPct = n => `${n.toFixed(1)}%`;
const fmtR   = n => `₹ ${fmt(n)}`;

// ─── Channel helpers ──────────────────────────────────────────────────────────
function machineDoesB2C(mode) { return mode === "b2c" || mode === "both"; }
function machineDoesB2B(mode) { return mode === "b2b" || mode === "both"; }

// ─── Core calculation ─────────────────────────────────────────────────────────
function calcScenario(scenarioKey, a) {
  const seed = SCENARIO_SEEDS[scenarioKey];

  // ── Blended B2B from hostel/hotel split ──────────────────────────────────────
  // Cycles are computed by time-splitting the operating day, NOT by averaging.
  // B2B_DAY_MINS = total daily operating minutes (440 min for 100% hostel baseline).
  // Each channel gets (its % × B2B_DAY_MINS) minutes, divided by its cycle duration.
  const hostelW       = (a.hostelPct || 0) / 100;
  const hotelW        = (a.hotelPct  || 0) / 100;
  const hostel        = B2B_CLIENTS.hostel;
  const hotel         = B2B_CLIENTS.hotel;
  // Use Math.floor so only complete cycles are counted (partial cycles aren't processed)
  const hostelCycles  = Math.floor((hostelW * B2B_DAY_MINS) / hostel.cycleMins); // e.g. 50% → floor(240/40) = 6
  const hotelCycles   = Math.floor((hotelW  * B2B_DAY_MINS) / hotel.cycleMins);  // e.g. 50% → floor(240/75) = 3
  const b2bCycles     = Math.round((hostelCycles + hotelCycles) * 2) / 2; // rounded to 0.5
  // kgPerCycle is per-machine (machine capacity), NOT hardcoded to 21.
  // This is resolved per-machine in the mDetails loop below.
  const b2bRate       = hostel.rate * hostelW + hotel.rate * hotelW;
  const b2bClient = {
    label:        hostelW === 1 ? "Hostel" : hotelW === 1 ? "Hotel" : `Hostel ${a.hostelPct}% / Hotel ${a.hotelPct}%`,
    cycles:       b2bCycles,
    hostelCycles, hotelCycles,
    rate:         b2bRate,
    is_premium:   true,
  };

  // ── Machine daily kg per channel ─────────────────────────────────────────────
  const machines = [
    { cap: a.m1cap, mode: a.m1mode, enabled: true },
    { cap: a.m2cap, mode: a.m2mode, enabled: true },
    { cap: a.m3cap, mode: a.m3mode, enabled: a.m3enabled },
    { cap: a.m4cap, mode: a.m4mode, enabled: a.m4enabled },
    { cap: a.m5cap, mode: a.m5mode, enabled: a.m5enabled },
  ];

  let b2cDailyKg = 0, b2bDailyKg = 0;
  let b2cDailyCycles = 0, b2bDailyCycles = 0;

  const mDetails = machines.map(m => {
    if (!m.enabled) return { b2cKg: 0, b2bKg: 0, b2cCyc: 0, b2bCyc: 0 };
    // B2C: machine capacity × scenario cycles
    const b2cKg  = machineDoesB2C(m.mode) ? m.cap * seed.cycles : 0;
    // B2B: blended time-split cycles × this machine's actual capacity (not hardcoded 21)
    const b2bKg  = machineDoesB2B(m.mode) ? b2bCycles * m.cap : 0;
    const b2cCyc = machineDoesB2C(m.mode) ? seed.cycles : 0;
    const b2bCyc = machineDoesB2B(m.mode) ? b2bCycles  : 0;
    b2cDailyKg    += b2cKg;  b2bDailyKg    += b2bKg;
    b2cDailyCycles += b2cCyc; b2bDailyCycles += b2bCyc;
    return { b2cKg, b2bKg, b2cCyc, b2bCyc };
  });

  const [m1daily, m2daily, m3daily, m4daily, m5daily] =
    mDetails.map(m => m.b2cKg + m.b2bKg);

  // ── Monthly volumes ──────────────────────────────────────────────────────────
  const b2cMonthly = b2cDailyKg * a.workdays;
  const b2bMonthly = b2bDailyKg * a.workdays;
  const b2cActive  = b2cDailyKg > 0;
  const b2bActive  = b2bDailyKg > 0;

  // ── B2B hostel/hotel kg & revenue split ──────────────────────────────────────
  // Computed BEFORE revenue so hostelRev/hotelRev can feed into totalRev correctly.
  // Each client type's daily kg = their cycle count × total machine capacity (21 kg).
  // This matches the reference: hostel 6 cyc × 21 kg = 126 kg/day; hotel 3 cyc × 21 kg = 63 kg/day.
  // We do NOT blend rates — each segment is billed at its own rate independently.
  const totalB2BCycles = hostelCycles + hotelCycles;
  const hostelFrac     = totalB2BCycles > 0 ? hostelCycles / totalB2BCycles : 0;
  const hotelFrac      = totalB2BCycles > 0 ? hotelCycles  / totalB2BCycles : 0;
  const hostelDailyKg  = b2bDailyKg * hostelFrac;   // e.g. 189 × 6/9 = 126 kg/day
  const hotelDailyKg   = b2bDailyKg * hotelFrac;    // e.g. 189 × 3/9 =  63 kg/day
  const hostelMonthly  = hostelDailyKg * a.workdays; // 126 × 30 = 3,780 kg/month
  const hotelMonthly   = hotelDailyKg  * a.workdays; // 63  × 30 = 1,890 kg/month
  const hostelRev      = hostelMonthly * hostel.rate; // 3,780 × ₹55 = ₹2,07,900
  const hotelRev       = hotelMonthly  * hotel.rate;  // 1,890 × ₹60 = ₹1,13,400

  // ── Revenue ──────────────────────────────────────────────────────────────────
  const laundryKg  = b2cMonthly * (a.laundrySplit / 100);
  const dcKg       = b2cMonthly * (a.dcSplit / 100);
  const garments   = dcKg * a.gpkg;
  const laundryRev = laundryKg * a.b2cPrice;
  const dcRev      = garments  * a.dcPrice;
  // B2B revenue = hostel rev + hotel rev (billed at separate rates, NOT blended average).
  // For 100% hostel: hostelRev = b2bMonthly×₹55, hotelRev=0 → correct.
  // For 100% hotel:  hostelRev = 0, hotelRev = b2bMonthly×₹60 → correct.
  // For 50/50 mix:   hostelRev + hotelRev = ₹2,07,900 + ₹1,13,400 = ₹3,21,300 → matches reference.
  const b2bRev     = hostelRev + hotelRev;
  const totalRev   = laundryRev + dcRev + b2bRev;
  const dailyRev   = a.workdays > 0 ? totalRev / a.workdays : 0;

  // ── AUTO-CALCULATED EXPENSES ─────────────────────────────────────────────────

  // 1. Electricity
  const b2cMonthlyCycles = b2cDailyCycles * a.workdays;
  const b2cElecUnits     = b2cMonthlyCycles * B2C_UNITS_PER_CYCLE;
  const b2cElecCost      = b2cElecUnits * a.elecRate;

  const b2bElecUnits = b2bMonthly * B2B_KWH_PER_KG;
  const b2bElecCost  = b2bElecUnits * a.elecRate;

  const dryerElecUnits    = b2bMonthly * DRYER_KWH_PER_KG;
  const dryerElecCost     = dryerElecUnits * a.elecRate;

  const b2bTotalElecUnits = b2bElecUnits + dryerElecUnits;
  const b2bTotalElecCost  = b2bElecCost + dryerElecCost;

  const electricityCost = Math.round(b2cElecCost + b2bTotalElecCost);

  // 2. Water: total monthly cycles × 60 L × ₹0.38
  const b2bMonthlyCycles   = b2bDailyCycles * a.workdays;
  const totalMonthlyCycles = b2cMonthlyCycles + b2bMonthlyCycles;
  const waterCost          = Math.round(totalMonthlyCycles * WATER_LITRES_CYCLE * WATER_RATE);

  // 3. Detergent: total monthly kg × ₹5
  const detergentCost = Math.round((b2cMonthly + b2bMonthly) * DETERGENT_RATE);

  // 4. Packaging: tiered by laundry split % (B2C only)
  const packagingCostVal = b2cActive ? packagingCost(a.laundrySplit) : 0;

  // ── Total expenses ───────────────────────────────────────────────────────────
  const totalExp = a.rent + a.salaries + electricityCost + waterCost +
                   packagingCostVal + detergentCost + a.delivery +
                   a.maintenance + a.overtime + a.misc;

  const totalKg  = b2cMonthly + b2bMonthly;
  const profit   = totalRev - totalExp;
  const margin   = totalRev > 0 ? (profit / totalRev) * 100 : 0;
  const revPerKg = totalKg  > 0 ? totalRev / totalKg : 0;
  const expPerKg = totalKg  > 0 ? totalExp / totalKg : 0;

  return {
    seed, b2bClient, is_premium: b2bClient.is_premium,
    m1daily, m2daily, m3daily, m4daily, m5daily,
    b2cDailyKg, b2bDailyKg,
    b2cDailyCycles, b2bDailyCycles,
    b2cMonthlyCycles, b2bMonthlyCycles, totalMonthlyCycles,
    b2cMonthly, b2bMonthly,
    b2cActive, b2bActive,
    laundryKg, dcKg, garments,
    laundryRev, dcRev, b2bRev, totalRev, dailyRev,
    hostelCycles, hotelCycles,
    hostelDailyKg, hotelDailyKg,
    hostelMonthly, hotelMonthly,
    hostelRev, hotelRev,
    electricityCost, b2cElecUnits, b2bElecUnits, b2cElecCost, b2bElecCost,
    dryerElecUnits, dryerElecCost, b2bTotalElecUnits, b2bTotalElecCost,
    waterCost, detergentCost, packagingCostVal,
    totalExp, profit, margin, revPerKg, expPerKg,
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

function MachineCountNI({ value, onChange, min = 1, max = 20 }) {
  const [raw, setRaw] = useState(String(value));
  const parsed = parseInt(raw, 10);
  const isInvalid = isNaN(parsed) || parsed < min || !Number.isInteger(parsed);

  const handleChange = e => {
    const v = e.target.value;
    setRaw(v);
    const n = parseInt(v, 10);
    if (!isNaN(n) && n >= min && Number.isInteger(n)) onChange(Math.min(n, max));
  };

  useEffect(() => { setRaw(String(value)); }, [value]);

  return (
    <div>
      <input
        type="number" value={raw} min={min} max={max} step={1}
        onChange={handleChange}
        className={`w-full h-8 border rounded-lg text-sm font-mono text-slate-800 bg-white
          focus:outline-none transition px-3
          ${isInvalid
            ? "border-red-400 focus:border-red-400 focus:ring-1 focus:ring-red-100"
            : "border-slate-200 focus:border-teal-400 focus:ring-1 focus:ring-teal-100"}`}
      />
      {isInvalid && (
        <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
          <FiAlertTriangle size={10} /> Must be a whole number between {min} and {max}
        </p>
      )}
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

// ─── Auto-cost info badge ─────────────────────────────────────────────────────
function AutoBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider
      bg-teal-50 text-teal-600 border border-teal-200 rounded px-1.5 py-0.5 ml-1.5">
      auto
    </span>
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
  // Use machine 1 capacity (13 kg) as the representative machine for recommendation
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
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${status === "ok" ? "text-emerald-600" : "text-amber-600"}`}>
        Machine Recommendation
      </p>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-slate-500">Daily demand</span>
          <span className="text-[11px] font-mono font-semibold text-slate-700">{demand} kg</span>
        </div>
        {hostelDailyKg > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-slate-500">↳ Hostel ({assumptions.hostelPct}%)</span>
            <span className="text-[11px] font-mono text-blue-600">{hostelDailyKg.toFixed(0)} kg</span>
          </div>
        )}
        {hotelDailyKg > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-slate-500">↳ Hotel ({assumptions.hotelPct}%)</span>
            <span className="text-[11px] font-mono text-violet-600">{hotelDailyKg.toFixed(0)} kg</span>
          </div>
        )}
        <div className="flex justify-between items-center pt-1 border-t border-slate-200">
          <span className="text-[11px] text-slate-500">kg/machine/day (blended)</span>
          <span className="text-[11px] font-mono text-slate-700">~{kgPerMachineDay} kg</span>
        </div>
        <div className={`flex justify-between items-center font-semibold ${status === "ok" ? "text-emerald-700" : "text-amber-700"}`}>
          <span className="text-[11px]">Machines needed (B2B)</span>
          <span className="text-[11px] font-mono">{machinesNeeded}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-slate-500">B2B machines assigned</span>
          <span className="text-[11px] font-mono text-slate-700">{canHandle}</span>
        </div>
      </div>
      <p className={`text-[10px] mt-2 font-medium ${status === "ok" ? "text-emerald-600" : "text-amber-600"}`}>
        {status === "ok"
          ? `✓ Current setup can handle ${demand} kg/day`
          : `⚠ Need ${machinesNeeded - canHandle} more B2B machine${machinesNeeded - canHandle > 1 ? "s" : ""} — set mode to B2B or Both`}
      </p>
    </div>
  );
}

// ─── Edit Configuration Modal ─────────────────────────────────────────────────
function ConfigModal({ assumptions, set, onClose, hasB2B }) {
  const splitTotal = assumptions.laundrySplit + assumptions.dcSplit;
  const splitWarn  = Math.abs(splitTotal - 100) > 0.1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,23,42,0.55)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pricing & rates</p>
            <p className="text-base font-semibold text-slate-800 mt-0.5">Edit Configuration</p>
          </div>
          <button onClick={onClose}
            className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition">
            <FiX size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">

          {/* B2C pricing */}
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

          {/* B2B pricing — only shown when at least one machine is B2B/Both */}
          {hasB2B && (<>
            <SectionDivider>B2B pricing</SectionDivider>
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-3 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1.5">Rates by client type (blended from mix)</p>
              {Object.entries(B2B_CLIENTS).map(([key, c]) => {
                const pct = key === "hostel" ? assumptions.hostelPct : assumptions.hotelPct;
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
                  ₹{(B2B_CLIENTS.hostel.rate * (assumptions.hostelPct/100) + B2B_CLIENTS.hotel.rate * (assumptions.hotelPct/100)).toFixed(1)}/kg
                </span>
              </div>
              <p className="text-[10px] text-blue-400 mt-1">Adjust mix via the B2B client mix slider in the left panel.</p>
            </div>
          </>)}

          {/* Auto-cost rates */}
          <SectionDivider>Auto-calculated cost rates</SectionDivider>
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-3">
            <p className="text-[10px] text-teal-700 font-semibold mb-1">These rates drive automatic expense calculation</p>
            <p className="text-[10px] text-teal-600">Electricity, water, detergent and packaging are computed from your machine output — not manual inputs.</p>
          </div>
          <FieldRow label="Electricity rate" unit="₹ / unit (kWh)">
            <NI value={assumptions.elecRate} min={1} step={0.1} prefix="₹" onChange={v => set("elecRate", v)} />
          </FieldRow>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-[10px] text-slate-500 space-y-1">
            <p><span className="font-semibold text-slate-600">B2C electricity:</span> cycles/month × 8 units × rate</p>
            <p><span className="font-semibold text-slate-600">B2B electricity:</span> kg/month × 0.331 kWh × rate</p>
            <p><span className="font-semibold text-slate-600">Dryer electricity:</span> dryer kg/month × 0.415 kWh × rate</p>
            <p><span className="font-semibold text-slate-600">Water:</span> cycles/month × 60 L × ₹0.38</p>
            <p><span className="font-semibold text-slate-600">Detergent:</span> total kg/month × ₹5</p>
            <p><span className="font-semibold text-slate-600">Packaging:</span> tiered by laundry split % (25%→₹3,920 · 35%→₹5,236 · 80%→₹12,514 · 100%→₹15,760)</p>
          </div>

        </div>

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

// ─── DS Onboarding — helpers ──────────────────────────────────────────────────
// B2C constants (Andes common assumptions)
const B2C_LAUNDRY_RATE   = 81;    // ₹/kg
const B2C_DC_RATE        = 100;   // ₹/garment
const B2C_LAUNDRY_PCT    = 83.33; // % of B2C kg going to laundry
const B2C_DC_PCT         = 16.67; // % of B2C kg going to dry clean
const B2C_GPK            = 3;     // garments per kg (dry clean)
const WORKDAYS           = 30;

// Compute total kg/cycle from an array of per-machine capacities
const totalKgPerCycle = (caps) => caps.reduce((s, c) => s + c, 0);

// B2C live calculation for all 3 scenarios
function calcB2CLive(machineCaps) {
  const kgCycle = totalKgPerCycle(machineCaps);
  return Object.entries(SCENARIO_SEEDS).map(([key, seed]) => {
    const dailyKg     = kgCycle * seed.cycles;
    const monthlyKg   = dailyKg * WORKDAYS;
    const laundryKg   = monthlyKg * (B2C_LAUNDRY_PCT / 100);
    const dcKg        = monthlyKg * (B2C_DC_PCT / 100);
    const garments    = dcKg * B2C_GPK;
    const laundryRev  = laundryKg * B2C_LAUNDRY_RATE;
    const dcRev       = garments  * B2C_DC_RATE;
    const totalRev    = laundryRev + dcRev;
    return { key, label: seed.label, color: seed.color, dailyKg, monthlyKg, laundryRev, dcRev, totalRev };
  });
}

// B2B live calculation for hostel-only, hotel-only, or mix
// Uses actual sum of machine caps (not hardcoded 21) — scales correctly per machine count
function calcB2BLive(machineCaps, hostelPct, hotelPct) {
  const kgCycle    = totalKgPerCycle(machineCaps);
  const hostelW    = hostelPct / 100;
  const hotelW     = hotelPct  / 100;
  // Time-split: each client gets its share of 480 min day
  const hostelCyc  = Math.floor((hostelW * B2B_DAY_MINS) / B2B_CLIENTS.hostel.cycleMins);
  const hotelCyc   = Math.floor((hotelW  * B2B_DAY_MINS) / B2B_CLIENTS.hotel.cycleMins);
  // Daily kg per client type = cycles × total machine capacity (sum of all machine caps)
  const hostelDailyKg  = hostelCyc * kgCycle;
  const hotelDailyKg   = hotelCyc  * kgCycle;
  const totalDailyKg   = hostelDailyKg + hotelDailyKg;
  const hostelMonthly  = hostelDailyKg * WORKDAYS;
  const hotelMonthly   = hotelDailyKg  * WORKDAYS;
  const hostelRev      = hostelMonthly * B2B_CLIENTS.hostel.rate;
  const hotelRev       = hotelMonthly  * B2B_CLIENTS.hotel.rate;
  const totalRev       = hostelRev + hotelRev;
  return { hostelCyc, hotelCyc, hostelDailyKg, hotelDailyKg, totalDailyKg,
           hostelMonthly, hotelMonthly, hostelRev, hotelRev, totalRev,
           totalMonthly: hostelMonthly + hotelMonthly };
}

// Validated integer input hook
function useIntInput(initial, min, max) {
  const [raw, setRaw] = useState(String(initial));
  const parsed  = parseInt(raw, 10);
  const invalid = isNaN(parsed) || parsed < min || parsed > max || !Number.isInteger(parsed);
  const value   = invalid ? min : parsed;
  const onChange = (e) => {
    const v = e.target.value;
    setRaw(v);
  };
  const syncTo = (n) => setRaw(String(n));
  return { raw, value, invalid, onChange, syncTo };
}

// ─── DS Onboarding Flow ───────────────────────────────────────────────────────
function DSOnboarding({ onComplete }) {
  // ── Step & flow state ────────────────────────────────────────────────────────
  const [step,          setStep]          = useState(1);
  const [distModel,     setDistModel]     = useState(null);   // "b2c"|"b2b"|"both"
  const [b2bClientType, setB2bClientType] = useState(null);   // "hostel"|"hotel"|"mix"
  const [hostelSplitPct,setHostelSplitPct]= useState(50);     // used when mix selected
  // step 3a: machine count
  const mcInput = useIntInput(1, 1, 20);
  // step 3b: per-machine capacities (array of strings, one per machine)
  const [machineCaps, setMachineCaps] = useState(["13"]);     // raw strings

  // ── Derived: step count depends on model ──────────────────────────────────────
  // b2c: step1 → step3(count) → step3b(caps)     = 3 visual steps
  // b2b: step1 → step2(type)  → step3(count) → step3b(caps) = 4
  // both:step1 → step2(type)  → step3(count) → step3b(caps) = 4
  const totalSteps = (distModel === "b2c" || distModel === null) ? 3 : 4;

  // ── When machine count changes, resize machineCaps array ─────────────────────
  const mcCount = mcInput.value;
  useEffect(() => {
    setMachineCaps(prev => {
      const next = [...prev];
      while (next.length < mcCount) next.push("13");
      return next.slice(0, mcCount);
    });
  }, [mcCount]);

  // ── Parsed machine capacities (numeric) ──────────────────────────────────────
  const parsedCaps = machineCaps.map(s => {
    const n = parseFloat(s);
    return isNaN(n) || n <= 0 ? 0 : n;
  });
  const capsValid = parsedCaps.every(n => n > 0);

  // ── Hostel/hotel pcts for current selection ───────────────────────────────────
  const hostelPct = b2bClientType === "hostel" ? 100
                  : b2bClientType === "hotel"  ? 0
                  : b2bClientType === "mix"    ? hostelSplitPct
                  : 100;
  const hotelPct  = 100 - hostelPct;

  // ── Live revenue for summary card ─────────────────────────────────────────────
  const b2cScenarios = capsValid && (distModel === "b2c" || distModel === "both")
    ? calcB2CLive(parsedCaps) : null;

  const b2bLive = capsValid && (distModel === "b2b" || distModel === "both") && b2bClientType
    ? calcB2BLive(parsedCaps, hostelPct, hotelPct) : null;

  // ── Navigation ───────────────────────────────────────────────────────────────
  const handleStep1Continue = () => {
    if (!distModel) return;
    if (distModel === "b2c") setStep(3);   // skip step 2
    else setStep(2);
  };

  const handleBack = () => {
    if (step === 2) { setStep(1); setB2bClientType(null); }
    else if (step === 3) { distModel === "b2c" ? setStep(1) : setStep(2); }
    else if (step === 4) setStep(3);
  };

  // ── Save & complete ───────────────────────────────────────────────────────────
  const handleFinish = () => {
    if (!capsValid) return;
    const model     = distModel;
    const isPremium = model !== "b2c";
    const mMode     = model === "b2c" ? "b2c" : model === "b2b" ? "b2b" : "both";

    // Build machine capacity overrides (m1cap, m2cap, … up to 5)
    const capOverrides = {};
    const modeOverrides = {};
    const machineKeys = ["m1cap","m2cap","m3cap","m4cap","m5cap"];
    const enableKeys  = ["m3enabled","m4enabled","m5enabled"];
    parsedCaps.forEach((c, i) => {
      capOverrides[machineKeys[i]] = c;
      modeOverrides[`m${i+1}mode`] = mMode;
    });
    // enable extra machines if count > 2
    enableKeys.forEach((k, i) => {
      capOverrides[k] = mcCount >= i + 3;
    });

    onComplete({
      distribution_model: model,
      b2b_client_type:    model === "b2c" ? null : b2bClientType,
      machine_count:      mcCount,
      is_premium:         isPremium,
      b2b_split_percent:  model === "both" ? hotelPct : null,
      onboarding_done:    true,
      hostelPct,
      hotelPct,
      ...capOverrides,
      ...modeOverrides,
    });
  };

  // ── Shared styles ─────────────────────────────────────────────────────────────
  const optCard = (active) =>
    `w-full text-left rounded-2xl border-2 p-4 transition-all cursor-pointer
     ${active
       ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300 ring-offset-1"
       : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`;

  const RadioDot = ({ active }) => (
    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition
      ${active ? "border-blue-500 bg-blue-500" : "border-slate-300"}`}>
      {active && <div className="w-2 h-2 rounded-full bg-white" />}
    </div>
  );

  const PremiumBadge = () => (
    <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">
      ★ Premium
    </span>
  );

  // ── Step label mapping ────────────────────────────────────────────────────────
  const stepLabel = {
    1: "How do you distribute?",
    2: "What type of B2B service?",
    3: "Machine count",
    4: "Machine capacities",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4"
      style={{ fontFamily: "DM Sans, sans-serif" }}>
      <div className="w-full max-w-lg">

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center gap-1.5 mb-2">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(n => (
              <div key={n} className={`h-1.5 flex-1 rounded-full transition-all
                ${n < step ? "bg-blue-600" : n === step ? "bg-blue-400" : "bg-slate-200"}`} />
            ))}
          </div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 text-center">
            Step {step} of {totalSteps} &nbsp;·&nbsp; Distribution Strategy Setup
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">

          {/* ════ STEP 1 — Distribution model ════ */}
          {step === 1 && (
            <div className="p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1">Step 1</p>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">How do you distribute?</h2>
              <p className="text-sm text-slate-400 mb-5">Choose your primary distribution channel.</p>

              <div className="space-y-3 mb-5">
                {[
                  { val: "b2c",  label: "B2C 100%",          desc: "Direct to end customers only" },
                  { val: "b2b",  label: "B2B 100%",          desc: "Business clients (Hotels, Hostels)", premium: true },
                  { val: "both", label: "B2C + B2B",         desc: "Mixed — both channels", premium: true },
                ].map(({ val, label, desc, premium }) => (
                  <button key={val} className={optCard(distModel === val)} onClick={() => setDistModel(val)}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-slate-800">{label}</p>
                          {premium && <PremiumBadge />}
                        </div>
                        <p className="text-xs text-slate-500">{desc}</p>
                      </div>
                      <RadioDot active={distModel === val} />
                    </div>
                  </button>
                ))}
              </div>

              <button onClick={handleStep1Continue} disabled={!distModel}
                className={`w-full h-11 rounded-xl text-sm font-semibold transition
                  ${distModel ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-300 cursor-not-allowed"}`}>
                Continue →
              </button>
            </div>
          )}

          {/* ════ STEP 2 — B2B client type (for both b2b and both) ════ */}
          {step === 2 && (
            <div className="p-6">
              <button onClick={handleBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-4 transition">
                <FiArrowLeft size={13} /> Back
              </button>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1">Step 2</p>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">What type of B2B service?</h2>
              <p className="text-sm text-slate-400 mb-5">Select the B2B client type you serve.</p>

              <div className="space-y-3 mb-4">
                {/* Hostel */}
                <button className={optCard(b2bClientType === "hostel")} onClick={() => setB2bClientType("hostel")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-slate-800">Hostel</p>
                        <PremiumBadge />
                      </div>
                      <p className="text-xs text-slate-500 font-mono">
                        {B2B_CLIENTS.hostel.cycles} cycles/day · {B2B_CLIENTS.hostel.kgPerCycle} kg per cycle · Rs {B2B_CLIENTS.hostel.rate} per kg
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Cycle time: {B2B_CLIENTS.hostel.cycleMins} min · 8 hr day = {B2B_CLIENTS.hostel.cycles} full cycles</p>
                    </div>
                    <RadioDot active={b2bClientType === "hostel"} />
                  </div>
                </button>

                {/* Hotel */}
                <button className={optCard(b2bClientType === "hotel")} onClick={() => setB2bClientType("hotel")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-slate-800">Hotel</p>
                        <PremiumBadge />
                      </div>
                      <p className="text-xs text-slate-500 font-mono">
                        {B2B_CLIENTS.hotel.cycles} cycles/day · {B2B_CLIENTS.hotel.kgPerCycle} kg per cycle · Rs {B2B_CLIENTS.hotel.rate} per kg
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Cycle time: {B2B_CLIENTS.hotel.cycleMins} min · 8 hr day = {B2B_CLIENTS.hotel.cycles} full cycles</p>
                    </div>
                    <RadioDot active={b2bClientType === "hotel"} />
                  </div>
                </button>

                {/* Hostel + Hotel mix — only for B2B 100% */}
                {distModel === "b2b" && (
                  <button className={optCard(b2bClientType === "mix")} onClick={() => setB2bClientType("mix")}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-slate-800">Hostel + Hotel Mix</p>
                          <PremiumBadge />
                        </div>
                        <p className="text-xs text-slate-500">Split the day between hostel and hotel clients</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">You'll set the hostel % split on next step</p>
                      </div>
                      <RadioDot active={b2bClientType === "mix"} />
                    </div>
                  </button>
                )}
              </div>

              {/* Hostel split slider — shown inline when mix selected */}
              {b2bClientType === "mix" && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-3">Set Hostel / Hotel split</p>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1">
                      <input type="range" min={0} max={100} step={5} value={hostelSplitPct}
                        onChange={e => setHostelSplitPct(parseInt(e.target.value, 10))}
                        className="w-full accent-blue-600" />
                    </div>
                    <div className="text-center w-12">
                      <p className="text-base font-mono font-bold text-blue-700">{hostelSplitPct}%</p>
                      <p className="text-[9px] text-slate-400">Hostel</p>
                    </div>
                  </div>
                  <div className="flex rounded-xl overflow-hidden h-6 border border-blue-200">
                    {hostelSplitPct > 0 && (
                      <div className="bg-blue-500 flex items-center justify-center transition-all" style={{ width: `${hostelSplitPct}%` }}>
                        <span className="text-[9px] font-bold text-white truncate px-1">Hostel {hostelSplitPct}%</span>
                      </div>
                    )}
                    {(100 - hostelSplitPct) > 0 && (
                      <div className="bg-violet-500 flex items-center justify-center transition-all" style={{ width: `${100 - hostelSplitPct}%` }}>
                        <span className="text-[9px] font-bold text-white truncate px-1">Hotel {100 - hostelSplitPct}%</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                    <div>Hostel: {Math.floor((hostelSplitPct / 100) * B2B_DAY_MINS / B2B_CLIENTS.hostel.cycleMins)} cycles/day ({hostelSplitPct}% of 480 min)</div>
                    <div className="text-right">Hotel: {Math.floor(((100 - hostelSplitPct) / 100) * B2B_DAY_MINS / B2B_CLIENTS.hotel.cycleMins)} cycles/day ({100 - hostelSplitPct}% of 480 min)</div>
                  </div>
                </div>
              )}

              <button onClick={() => b2bClientType && setStep(3)} disabled={!b2bClientType}
                className={`w-full h-11 rounded-xl text-sm font-semibold transition
                  ${b2bClientType ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-300 cursor-not-allowed"}`}>
                Continue →
              </button>
            </div>
          )}

          {/* ════ STEP 3 — Machine count ════ */}
          {step === 3 && (
            <div className="p-6">
              <button onClick={handleBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-4 transition">
                <FiArrowLeft size={13} /> Back
              </button>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1">Step {distModel === "b2c" ? 2 : 3}</p>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">How many machines?</h2>
              <p className="text-sm text-slate-400 mb-5">Enter your total machine count (1–20). You'll set each machine's capacity next.</p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Number of machines</label>
                <input type="number" value={mcInput.raw} min={1} max={20} step={1} onChange={mcInput.onChange}
                  className={`w-full h-11 border rounded-xl text-sm font-mono text-slate-800 bg-white px-4
                    focus:outline-none transition
                    ${mcInput.invalid
                      ? "border-red-400 focus:border-red-400 focus:ring-1 focus:ring-red-100"
                      : "border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100"}`}
                  placeholder="Enter 1–20"
                />
                {mcInput.invalid && (
                  <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                    <FiAlertTriangle size={11} /> Must be a whole number between 1 and 20
                  </p>
                )}
              </div>

              {/* Quick reference */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-5 text-[10px] text-slate-500 space-y-1">
                <p className="font-semibold text-slate-600 mb-1">Standard machine capacities (reference)</p>
                <p>15 kg machine → effective processing = <strong>13 kg</strong></p>
                <p>10 kg machine → effective processing = <strong>8 kg</strong></p>
                <p className="text-slate-400">You'll enter the exact capacity for each machine on the next step.</p>
              </div>

              <button onClick={() => !mcInput.invalid && setStep(4)} disabled={mcInput.invalid}
                className={`w-full h-11 rounded-xl text-sm font-semibold transition
                  ${!mcInput.invalid ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-300 cursor-not-allowed"}`}>
                Continue →
              </button>
            </div>
          )}

          {/* ════ STEP 4 — Machine capacities + live revenue ════ */}
          {step === 4 && (
            <div className="p-6 overflow-y-auto max-h-[90vh]">
              <button onClick={handleBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-4 transition">
                <FiArrowLeft size={13} /> Back
              </button>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1">Step {distModel === "b2c" ? 3 : 4}</p>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">Machine capacities</h2>
              <p className="text-sm text-slate-400 mb-5">Enter each machine's effective kg capacity per cycle.</p>

              {/* Per-machine capacity inputs */}
              <div className="space-y-3 mb-5">
                {machineCaps.map((cap, i) => {
                  const n = parseFloat(cap);
                  const err = isNaN(n) || n <= 0;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-24 flex-shrink-0">
                        <p className="text-xs font-semibold text-slate-700">Machine {i + 1}</p>
                        <p className="text-[10px] text-slate-400">kg/cycle</p>
                      </div>
                      <div className="flex-1">
                        <input
                          type="number" value={cap} min={1} max={200} step={0.5}
                          onChange={e => {
                            const next = [...machineCaps];
                            next[i] = e.target.value;
                            setMachineCaps(next);
                          }}
                          className={`w-full h-10 border rounded-xl text-sm font-mono text-slate-800 bg-white px-3
                            focus:outline-none transition
                            ${err ? "border-red-400 focus:ring-1 focus:ring-red-100" : "border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100"}`}
                          placeholder="e.g. 13"
                        />
                        {err && <p className="text-[10px] text-red-500 mt-0.5">Enter a positive number</p>}
                      </div>
                      {/* Quick-set buttons */}
                      <div className="flex gap-1 flex-shrink-0">
                        {[13, 8].map(q => (
                          <button key={q} onClick={() => {
                            const next = [...machineCaps];
                            next[i] = String(q);
                            setMachineCaps(next);
                          }}
                            className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 transition border border-slate-200">
                            {q} kg
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total kg/cycle */}
              {capsValid && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 flex items-center justify-between">
                  <p className="text-xs text-slate-600 font-semibold">Total kg per cycle</p>
                  <p className="text-sm font-mono font-bold text-slate-800">{totalKgPerCycle(parsedCaps).toLocaleString("en-IN")} kg</p>
                </div>
              )}

              {/* ── B2C live revenue (3 scenarios) ── */}
              {b2cScenarios && capsValid && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-3">
                    B2C Revenue — 3 Scenarios
                  </p>
                  <div className="space-y-2">
                    {b2cScenarios.map(sc => (
                      <div key={sc.key} className={`rounded-xl p-3 border
                        ${sc.color === "emerald" ? "bg-emerald-100 border-emerald-200"
                          : sc.color === "blue" ? "bg-blue-50 border-blue-200"
                          : "bg-amber-50 border-amber-200"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-xs font-bold
                            ${sc.color === "emerald" ? "text-emerald-700"
                              : sc.color === "blue" ? "text-blue-700" : "text-amber-700"}`}>
                            {sc.label} · {SCENARIO_SEEDS[sc.key].cycles} cycles/day
                          </p>
                          <p className={`text-sm font-mono font-bold
                            ${sc.color === "emerald" ? "text-emerald-700"
                              : sc.color === "blue" ? "text-blue-700" : "text-amber-700"}`}>
                            Rs {sc.totalRev.toLocaleString("en-IN")}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 text-[10px] text-slate-500">
                          <span>Daily: {sc.dailyKg.toLocaleString("en-IN")} kg</span>
                          <span>Monthly: {sc.monthlyKg.toLocaleString("en-IN")} kg</span>
                          <span>Laundry: Rs {Math.round(sc.laundryRev).toLocaleString("en-IN")}</span>
                          <span>Dry clean: Rs {Math.round(sc.dcRev).toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-emerald-600 mt-2">
                    Laundry {B2C_LAUNDRY_PCT}% @Rs {B2C_LAUNDRY_RATE}/kg · Dry clean {B2C_DC_PCT}% @{B2C_GPK} garments/kg @Rs {B2C_DC_RATE}/garment
                  </p>
                </div>
              )}

              {/* ── B2B live revenue ── */}
              {b2bLive && capsValid && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-3">
                    B2B Revenue Summary
                    {b2bClientType === "mix" ? ` · Hostel ${hostelPct}% / Hotel ${hotelPct}%` : ` · ${b2bClientType === "hostel" ? "Hostel" : "Hotel"} 100%`}
                  </p>
                  <div className="space-y-2">
                    {hostelPct > 0 && (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-blue-700">Hostel · {b2bLive.hostelCyc} cyc/day · {b2bLive.hostelDailyKg.toLocaleString("en-IN")} kg/day</p>
                        <p className="text-xs font-mono font-semibold text-blue-900">Rs {Math.round(b2bLive.hostelRev).toLocaleString("en-IN")}/mo</p>
                      </div>
                    )}
                    {hotelPct > 0 && (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-violet-700">Hotel · {b2bLive.hotelCyc} cyc/day · {b2bLive.hotelDailyKg.toLocaleString("en-IN")} kg/day</p>
                        <p className="text-xs font-mono font-semibold text-violet-900">Rs {Math.round(b2bLive.hotelRev).toLocaleString("en-IN")}/mo</p>
                      </div>
                    )}
                    <div className="border-t border-blue-200 pt-2 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-blue-800">Total monthly revenue</p>
                        <p className="text-[10px] text-blue-500">{b2bLive.totalDailyKg.toLocaleString("en-IN")} kg/day · {b2bLive.totalMonthly.toLocaleString("en-IN")} kg/month</p>
                      </div>
                      <p className="text-lg font-mono font-bold text-emerald-600">
                        Rs {Math.round(b2bLive.totalRev).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button onClick={handleFinish} disabled={!capsValid}
                className={`w-full h-11 rounded-xl text-sm font-semibold transition
                  ${capsValid ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-100 text-slate-300 cursor-not-allowed"}`}>
                Save & Continue →
              </button>
            </div>
          )}

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
          { l:"Daily B2C output", v: fmtKg(b2cDailyKg) },
          { l:"Monthly B2C kg",   v: fmtKg(b2cMonthly)  },
          { l:"Daily revenue",    v: fmtR(dailyRev)      },
          { l:"Expenses",         v: fmtR(totalExp)      },
          { l:"Net profit",       v: fmtR(profit),  cls: profit >= 0 ? "text-emerald-600" : "text-red-500" },
          { l:"Profit margin",    v: fmtPct(margin), cls: margin >= 20 ? "text-emerald-600" : margin >= 0 ? "text-amber-600" : "text-red-500" },
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
  const {
    seed, m1daily, m2daily, m3daily, m4daily, m5daily,
    b2cDailyKg, b2bDailyKg,
    b2cMonthlyCycles, b2bMonthlyCycles, totalMonthlyCycles,
    b2cMonthly, b2bMonthly, b2cActive, b2bActive,
    laundryKg, dcKg, garments, laundryRev, dcRev, b2bRev, totalRev, dailyRev,
    hostelCycles, hotelCycles,
    hostelDailyKg, hotelDailyKg,
    hostelMonthly, hotelMonthly,
    hostelRev, hotelRev,
    electricityCost, b2cElecUnits, b2bElecUnits, b2cElecCost, b2bElecCost,
    dryerElecUnits, dryerElecCost, b2bTotalElecUnits, b2bTotalElecCost,
    waterCost, detergentCost, packagingCostVal,
    totalExp, profit, margin, revPerKg, expPerKg,
  } = out;
  const st = SS[seed.color];
  const b2bCycles = out.b2bClient.cycles;

  const machineSub = (cap, mode) => {
    const parts = [];
    if (machineDoesB2C(mode)) parts.push(`${cap}kg × ${seed.cycles} cyc B2C`);
    if (machineDoesB2B(mode)) parts.push(`${cap}kg × ${b2bCycles} cyc B2B`);
    return parts.join(" + ");
  };

  const combinedSub = [
    b2cActive ? `${seed.cycles} cyc B2C` : null,
    b2bActive ? `${b2bCycles} cyc B2B` : null,
  ].filter(Boolean).join(" + ") || "no machines assigned";

  const enabledMachines = [
    { l:"Machine 1", v:fmtKg(m1daily), sub: machineSub(assumptions.m1cap, assumptions.m1mode) },
    { l:"Machine 2", v:fmtKg(m2daily), sub: machineSub(assumptions.m2cap, assumptions.m2mode) },
    ...(assumptions.m3enabled ? [{ l:"Machine 3", v:fmtKg(m3daily), sub: machineSub(assumptions.m3cap, assumptions.m3mode) }] : []),
    ...(assumptions.m4enabled ? [{ l:"Machine 4", v:fmtKg(m4daily), sub: machineSub(assumptions.m4cap, assumptions.m4mode) }] : []),
    ...(assumptions.m5enabled ? [{ l:"Machine 5", v:fmtKg(m5daily), sub: machineSub(assumptions.m5cap, assumptions.m5mode) }] : []),
    { l:"Combined daily", v:fmtKg(b2cDailyKg + b2bDailyKg), sub: combinedSub },
  ];

  const fixedExpRows = [
    ["Rent",          assumptions.rent],
    ["Salaries",      assumptions.salaries],
    ["Delivery",      assumptions.delivery],
    ["Maintenance",   assumptions.maintenance],
    ["Overtime",      assumptions.overtime],
    ["Miscellaneous", assumptions.misc],
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
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(enabledMachines.length, 4)}, 1fr)` }}>
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
            {b2bActive && (<>
              {/* Hostel sub-row (shown when hostel % > 0) */}
              {assumptions.hostelPct > 0 && (
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-2.5 text-slate-600">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      B2B Hostel ({assumptions.hostelPct}%) · ₹{B2B_CLIENTS.hostel.rate}/kg · {hostelCycles.toFixed(1)} cyc/day
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 font-mono text-xs text-right">{fmtKg(hostelMonthly)}</td>
                  <td className="px-4 py-2.5 font-mono font-medium text-right text-blue-700">₹ {fmt(hostelRev)}</td>
                </tr>
              )}
              {/* Hotel sub-row (shown when hotel % > 0) */}
              {assumptions.hotelPct > 0 && (
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-2.5 text-slate-600">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      B2B Hotel ({assumptions.hotelPct}%) · ₹{B2B_CLIENTS.hotel.rate}/kg · {hotelCycles.toFixed(1)} cyc/day
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 font-mono text-xs text-right">{fmtKg(hotelMonthly)}</td>
                  <td className="px-4 py-2.5 font-mono font-medium text-right text-indigo-700">₹ {fmt(hotelRev)}</td>
                </tr>
              )}
              {/* B2B total row */}
              <tr className="border-b border-slate-100 bg-blue-50/40">
                <td className="px-4 py-2 text-slate-600 pl-8">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    B2B Total ({out.b2bClient.label} · blended ₹{out.b2bClient.rate.toFixed(1)}/kg · {out.b2bClient.cycles} cyc/day)
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-400 font-mono text-xs text-right">{fmtKg(b2bMonthly)}</td>
                <td className="px-4 py-2 font-mono font-semibold text-right text-blue-800">₹ {fmt(b2bRev)}</td>
              </tr>
            </>)}
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
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Expense breakdown</p>
          <span className="text-[9px] bg-teal-50 text-teal-600 border border-teal-200 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider">4 costs auto-calculated</span>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {fixedExpRows.map(([l, v]) => (
              <tr key={l} className="border-b border-slate-100">
                <td className="px-4 py-2 text-slate-500">{l}</td>
                <td className="px-4 py-2 text-slate-400 font-mono text-xs text-right"></td>
                <td className="px-4 py-2 font-mono text-right text-slate-700">₹ {fmt(v)}</td>
              </tr>
            ))}

            {/* Electricity (auto) */}
            <tr className="border-b border-slate-100 bg-teal-50/40">
              <td className="px-4 py-2 text-slate-600">
                <span className="flex items-center gap-1.5">
                  <FiZap size={11} className="text-teal-500" />
                  Electricity <AutoBadge />
                </span>
              </td>
              <td className="px-4 py-2 text-slate-400 font-mono text-[10px] text-right leading-relaxed">
                {b2cActive && <div>B2C: {fmt(Math.round(b2cElecUnits))} u → ₹{fmt(b2cElecCost)}</div>}
                {b2bActive && <div>B2B machine: {fmt(Math.round(b2bElecUnits))} u → ₹{fmt(b2bElecCost)}</div>}
                {b2bActive && <div>B2B dryer: {fmt(Math.round(dryerElecUnits))} u → ₹{fmt(dryerElecCost)}</div>}
                {b2bActive && <div className="font-semibold">B2B total: {fmt(Math.round(b2bTotalElecUnits))} u → ₹{fmt(b2bTotalElecCost)}</div>}
              </td>
              <td className="px-4 py-2 font-mono font-semibold text-right text-teal-700">₹ {fmt(electricityCost)}</td>
            </tr>

            {/* Water (auto) */}
            <tr className="border-b border-slate-100 bg-teal-50/40">
              <td className="px-4 py-2 text-slate-600">
                <span className="flex items-center gap-1.5">
                  <FiDroplet size={11} className="text-teal-500" />
                  Water <AutoBadge />
                </span>
              </td>
              <td className="px-4 py-2 text-slate-400 font-mono text-[10px] text-right">
                {fmt(totalMonthlyCycles)} cyc × 60L × ₹0.38
              </td>
              <td className="px-4 py-2 font-mono font-semibold text-right text-teal-700">₹ {fmt(waterCost)}</td>
            </tr>

            {/* Detergent (auto) */}
            <tr className="border-b border-slate-100 bg-teal-50/40">
              <td className="px-4 py-2 text-slate-600">
                <span className="flex items-center gap-1.5">
                  <FiInfo size={11} className="text-teal-500" />
                  Detergent <AutoBadge />
                </span>
              </td>
              <td className="px-4 py-2 text-slate-400 font-mono text-[10px] text-right">
                {fmtKg(b2cMonthly + b2bMonthly)} × ₹5
              </td>
              <td className="px-4 py-2 font-mono font-semibold text-right text-teal-700">₹ {fmt(detergentCost)}</td>
            </tr>

            {/* Packaging (auto) */}
            <tr className="border-b border-slate-100 bg-teal-50/40">
              <td className="px-4 py-2 text-slate-600">
                <span className="flex items-center gap-1.5">
                  <FiPackage size={11} className="text-teal-500" />
                  Packaging <AutoBadge />
                </span>
              </td>
              <td className="px-4 py-2 text-slate-400 font-mono text-[10px] text-right">
                Laundry split {fmtPct(assumptions.laundrySplit)} tier
              </td>
              <td className="px-4 py-2 font-mono font-semibold text-right text-teal-700">₹ {fmt(packagingCostVal)}</td>
            </tr>

            <tr className="bg-slate-50 font-semibold">
              <td className="px-4 py-2.5 text-slate-800">Total Expenses</td>
              <td />
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

      {/* Intermediate calculations */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Intermediate calculations</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { l:"Monthly B2C processing", v:fmtKg(b2cMonthly),                          dim:!b2cActive },
            { l:"Monthly B2B processing", v:fmtKg(b2bMonthly),                          dim:!b2bActive },
            { l:"B2C monthly cycles",     v:`${fmt(b2cMonthlyCycles)} cyc`,              dim:!b2cActive },
            { l:"B2B monthly cycles",     v:`${fmt(b2bMonthlyCycles)} cyc`,              dim:!b2bActive },
            { l:"Laundry quantity",        v:fmtKg(laundryKg),                           dim:!b2cActive },
            { l:"Dry clean garments",      v:`${fmt(garments)} pcs`,                     dim:!b2cActive },
            { l:"B2C elec units",          v:`${fmt(Math.round(b2cElecUnits))} kWh`,     dim:!b2cActive },
            { l:"B2B machine units",       v:`${fmt(Math.round(b2bElecUnits))} kWh`,     dim:!b2bActive },
            { l:"B2B dryer units",         v:`${fmt(Math.round(dryerElecUnits))} kWh`,   dim:!b2bActive },
            { l:"B2B total elec units",    v:`${fmt(Math.round(b2bTotalElecUnits))} kWh`,dim:!b2bActive },
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

  // ── DS onboarding completion ──────────────────────────────────────────────────
  const handleOnboardingComplete = (dsData) => {
    setAssumptions(prev => ({ ...prev, ...dsData }));
  };
  const handleEditDS = () => {
    setAssumptions(prev => ({ ...prev, onboarding_done: false }));
  };

  // Show onboarding if not done yet
  if (!assumptions.onboarding_done) {
    return <DSOnboarding onComplete={handleOnboardingComplete} />;
  }

  const outputs   = Object.fromEntries(Object.keys(SCENARIO_SEEDS).map(k => [k, calcScenario(k, assumptions)]));
  const activeOut = outputs[activeScenario];
  const activeSt  = SS[SCENARIO_SEEDS[activeScenario].color];

  const expFields = [
    ["rent","Rent"],["salaries","Salaries"],
    ["delivery","Delivery"],["maintenance","Maintenance"],["overtime","Overtime"],["misc","Miscellaneous"],
  ];

  const modes  = [assumptions.m1mode, assumptions.m2mode,
    ...(assumptions.m3enabled ? [assumptions.m3mode] : []),
    ...(assumptions.m4enabled ? [assumptions.m4mode] : []),
    ...(assumptions.m5enabled ? [assumptions.m5mode] : [])];
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
              <button onClick={handleEditDS}
                className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/20 transition">
                <FiSettings size={12} /> Edit DS Setup
              </button>
              <button onClick={() => navigate("/admin")}
                className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/20 transition">
                <FiArrowLeft size={12} /> Back
              </button>
            </div>
          </div>
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

        <div className="flex flex-col lg:flex-row flex-1 min-h-0">

          {/* ════ LEFT panel ════ */}
          <div className="w-full lg:w-[310px] xl:w-[350px] flex-shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto">
            <div className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Editable assumptions</p>
              <p className="text-[11px] text-slate-400 mb-3">All values update all 3 scenarios live</p>

              {/* DS config summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-blue-400 mb-1">Distribution Strategy</p>
                  <p className="text-xs font-semibold text-blue-800">
                    {assumptions.distribution_model === "b2c" ? "B2C 100%"
                     : assumptions.distribution_model === "b2b" && assumptions.b2b_client_type === "mix"
                       ? `B2B 100% · Hostel ${assumptions.hostelPct}% / Hotel ${assumptions.hotelPct}%`
                     : assumptions.distribution_model === "b2b" ? `B2B 100% · ${assumptions.b2b_client_type === "hotel" ? "Hotel" : "Hostel"}`
                     : assumptions.distribution_model === "both" ? `B2C + B2B · ${assumptions.b2b_client_type === "hotel" ? "Hotel" : "Hostel"}`
                     : "—"}
                  </p>
                  <p className="text-[10px] text-blue-600 mt-0.5">
                    {assumptions.machine_count} machine{assumptions.machine_count > 1 ? "s" : ""}
                    {assumptions.is_premium ? " · ★ Premium" : ""}
                  </p>
                </div>
                <button onClick={handleEditDS}
                  className="text-[10px] text-blue-500 font-semibold hover:text-blue-700 border border-blue-200 rounded-lg px-2 py-1 transition whitespace-nowrap flex-shrink-0">
                  Edit
                </button>
              </div>

              {/* Machine specs */}
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

              <FieldRow label="Machine 3" unit="add new machine">
                <Toggle enabled={assumptions.m3enabled} onToggle={() => set("m3enabled", !assumptions.m3enabled)}
                  labelOn="Added ✓" labelOff="+ Add Machine 3" colorOn="bg-violet-600 border-violet-600 text-white" />
              </FieldRow>
              {assumptions.m3enabled && (<>
                <FieldRow label="Machine 3 capacity" unit="kg/cycle">
                  <NI value={assumptions.m3cap} min={1} max={50} step={0.5} onChange={v => set("m3cap", v)} />
                </FieldRow>
                <FieldRow label="Machine 3 channel" unit="assign to">
                  <ModeToggle value={assumptions.m3mode} onChange={v => set("m3mode", v)} />
                </FieldRow>
              </>)}

              {assumptions.m3enabled && (
                <FieldRow label="Machine 4" unit="add new machine">
                  <Toggle enabled={assumptions.m4enabled} onToggle={() => set("m4enabled", !assumptions.m4enabled)}
                    labelOn="Added ✓" labelOff="+ Add Machine 4" colorOn="bg-violet-600 border-violet-600 text-white" />
                </FieldRow>
              )}
              {assumptions.m4enabled && (<>
                <FieldRow label="Machine 4 capacity" unit="kg/cycle">
                  <NI value={assumptions.m4cap} min={1} max={50} step={0.5} onChange={v => set("m4cap", v)} />
                </FieldRow>
                <FieldRow label="Machine 4 channel" unit="assign to">
                  <ModeToggle value={assumptions.m4mode} onChange={v => set("m4mode", v)} />
                </FieldRow>
              </>)}

              {assumptions.m4enabled && (
                <FieldRow label="Machine 5" unit="add new machine">
                  <Toggle enabled={assumptions.m5enabled} onToggle={() => set("m5enabled", !assumptions.m5enabled)}
                    labelOn="Added ✓" labelOff="+ Add Machine 5" colorOn="bg-violet-600 border-violet-600 text-white" />
                </FieldRow>
              )}
              {assumptions.m5enabled && (<>
                <FieldRow label="Machine 5 capacity" unit="kg/cycle">
                  <NI value={assumptions.m5cap} min={1} max={50} step={0.5} onChange={v => set("m5cap", v)} />
                </FieldRow>
                <FieldRow label="Machine 5 channel" unit="assign to">
                  <ModeToggle value={assumptions.m5mode} onChange={v => set("m5mode", v)} />
                </FieldRow>
              </>)}

              <FieldRow label="Working days / month" unit="days">
                <NI value={assumptions.workdays} min={1} max={31} onChange={v => set("workdays", v)} />
              </FieldRow>

              {/* B2B client mix — only shown when at least one machine is B2B or Both */}
              {hasB2B && (<>
                <SectionDivider>B2B client mix</SectionDivider>
                <div className="mb-3">
                  <p className="text-[10px] text-slate-400 mb-2">What % of your B2B load is Hostel vs Hotel? (must sum to 100 · 0% allowed)</p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <p className="text-[11px] font-semibold text-blue-700 mb-1">🏨 Hostel %</p>
                      <NI value={assumptions.hostelPct} min={0} max={100} step={1}
                        onChange={v => {
                          const c = Math.min(100, Math.max(0, v));
                          set("hostelPct", c);
                          set("b2bClientType", c >= assumptions.hotelPct ? "hostel" : "hotel");
                        }} />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-violet-700 mb-1">🏩 Hotel %</p>
                      <NI value={assumptions.hotelPct} min={0} max={100} step={1}
                        onChange={v => {
                          const c = Math.min(100, Math.max(0, v));
                          set("hotelPct", c);
                          set("b2bClientType", assumptions.hostelPct >= c ? "hostel" : "hotel");
                        }} />
                    </div>
                  </div>
                  {(assumptions.hostelPct + assumptions.hotelPct > 100) && (
                    <p className="text-[10px] text-red-500 flex items-center gap-1 mb-2">
                      <FiAlertTriangle size={10} /> Total exceeds 100% (currently {assumptions.hostelPct + assumptions.hotelPct}%) — reduce one value
                    </p>
                  )}
                  {(assumptions.hostelPct + assumptions.hotelPct < 100) && (assumptions.hostelPct + assumptions.hotelPct > 0) && (
                    <p className="text-[10px] text-amber-500 flex items-center gap-1 mb-2">
                      <FiAlertTriangle size={10} /> Total is {assumptions.hostelPct + assumptions.hotelPct}% — remaining {100 - assumptions.hostelPct - assumptions.hotelPct}% won't be counted
                    </p>
                  )}
                  <div className="flex rounded-xl overflow-hidden h-7 border border-slate-200 mb-1">
                    {assumptions.hostelPct > 0 && (
                      <div className="bg-blue-500 flex items-center justify-center transition-all" style={{ width: `${assumptions.hostelPct}%` }}>
                        <span className="text-[9px] font-bold text-white truncate px-1">Hostel {assumptions.hostelPct}%</span>
                      </div>
                    )}
                    {assumptions.hotelPct > 0 && (
                      <div className="bg-violet-500 flex items-center justify-center transition-all" style={{ width: `${assumptions.hotelPct}%` }}>
                        <span className="text-[9px] font-bold text-white truncate px-1">Hotel {assumptions.hotelPct}%</span>
                      </div>
                    )}
                    {assumptions.hostelPct === 0 && assumptions.hotelPct === 0 && (
                      <div className="flex-1 bg-slate-100 flex items-center justify-center">
                        <span className="text-[9px] text-slate-400">0% / 0% — set a mix above</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mt-2 bg-slate-50 rounded-xl p-2 border border-slate-100 text-center">
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-slate-400">Blended cycles</p>
                      <p className="text-xs font-mono font-semibold text-slate-700">
                        {(B2B_CLIENTS.hostel.cycles * (assumptions.hostelPct/100) + B2B_CLIENTS.hotel.cycles * (assumptions.hotelPct/100)).toFixed(1)}/day
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-slate-400">Blended rate</p>
                      <p className="text-xs font-mono font-semibold text-slate-700">
                        ₹{(B2B_CLIENTS.hostel.rate * (assumptions.hostelPct/100) + B2B_CLIENTS.hotel.rate * (assumptions.hotelPct/100)).toFixed(0)}/kg
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-slate-400">Kg/machine/day</p>
                      <p className="text-xs font-mono font-semibold text-slate-700">
                        ~{Math.round((B2B_CLIENTS.hostel.cycles * (assumptions.hostelPct/100) + B2B_CLIENTS.hotel.cycles * (assumptions.hotelPct/100)) * 21)} kg
                      </p>
                    </div>
                  </div>
                </div>
              </>)}

              {/* Daily kg demand */}
              <SectionDivider>Daily kg demand</SectionDivider>
              <FieldRow label="Total daily kg to process" unit="kg / day">
                <NI value={assumptions.dailyKgDemand} min={0} max={9999} step={10}
                  onChange={v => set("dailyKgDemand", v)} />
              </FieldRow>
              <p className="text-[10px] text-slate-400 mb-2">Enter your expected B2B demand — we'll recommend how many machines to assign.</p>
              <MachineRecommendation assumptions={assumptions} />

              {/* Pricing configuration */}
              <SectionDivider>Pricing configuration</SectionDivider>
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
              <button onClick={() => setShowConfig(true)}
                className="w-full h-9 bg-slate-800 text-white rounded-xl text-xs font-semibold
                  hover:bg-slate-700 transition flex items-center justify-center gap-1.5 mb-1">
                <FiSettings size={13} /> Edit Configuration
              </button>

              {/* Auto-costs info */}
              <SectionDivider>Auto-calculated costs</SectionDivider>
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-2.5">
                <p className="text-[10px] font-bold text-teal-700 mb-1.5 flex items-center gap-1"><FiZap size={10} /> Automatically computed</p>
                {[
                  { l:"Electricity", v: fmtR(activeOut.electricityCost) },
                  { l:"Water",       v: fmtR(activeOut.waterCost)       },
                  { l:"Detergent",   v: fmtR(activeOut.detergentCost)   },
                  { l:"Packaging",   v: fmtR(activeOut.packagingCostVal)},
                ].map(({ l, v }) => (
                  <div key={l} className="flex items-center justify-between mb-1 last:mb-0">
                    <p className="text-[10px] text-teal-600">{l}</p>
                    <p className="text-[10px] font-mono font-semibold text-teal-800">{v}</p>
                  </div>
                ))}
                <p className="text-[9px] text-teal-500 mt-1.5">Based on {SCENARIO_SEEDS[activeScenario].label} scenario · rate ₹{assumptions.elecRate}/unit</p>
              </div>

              {/* Fixed expenses */}
              <SectionDivider>Fixed monthly expenses</SectionDivider>
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
                  <p className="text-xs text-slate-400 mb-2">All 3 scenarios use the same assumptions — only B2C cycles/day differs. Click a card to see its full breakdown.</p>
                  {Object.keys(SCENARIO_SEEDS).map(k => (
                    <ScenarioCard key={k} scenarioKey={k} out={outputs[k]}
                      active={activeScenario === k}
                      onClick={k => { setActiveScenario(k); setTab("detail"); }} />
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
                            {Object.entries(SCENARIO_SEEDS).map(([k, s]) => (
                              <th key={k} className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">{s.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { l:"B2C cycles/day",  fn: o => o.seed.cycles },
                            { l:"Daily B2C kg",    fn: o => fmtKg(o.b2cDailyKg) },
                            { l:"Daily B2B kg",    fn: o => fmtKg(o.b2bDailyKg) },
                            { l:"Monthly B2C",     fn: o => fmtKg(o.b2cMonthly) },
                            { l:"Monthly B2B",     fn: o => fmtKg(o.b2bMonthly) },
                            { l:"Electricity",     fn: o => fmtR(o.electricityCost) },
                            { l:"Water",           fn: o => fmtR(o.waterCost) },
                            { l:"Detergent",       fn: o => fmtR(o.detergentCost) },
                            { l:"Packaging",       fn: o => fmtR(o.packagingCostVal) },
                            { l:"Total revenue",   fn: o => fmtR(o.totalRev) },
                            { l:"Total expenses",  fn: o => fmtR(o.totalExp) },
                            { l:"Net profit",      fn: o => fmtR(o.profit) },
                            { l:"Profit margin",   fn: o => fmtPct(o.margin) },
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

      {showConfig && (
        <ConfigModal assumptions={assumptions} set={set} onClose={() => setShowConfig(false)} hasB2B={hasB2B} />
      )}
    </div>
  );
}
