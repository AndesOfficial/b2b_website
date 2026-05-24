import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu, FiArrowLeft, FiAlertTriangle, FiRefreshCw } from "react-icons/fi";
import AdminSidebar from "../components/AdminSidebar";
import { useHostelAuth } from "../context/HostelAuthContext";

// ─── Constants ───────────────────────────────────────────────────────────────
const WORKING_DAYS = 30;
const CYCLE_MIN  = { b2b: 75, b2c: 40 };
const PRICE      = { b2b: 60, b2cLaundry: 81, b2cDryClean: 100 };
const MACHINE_CAP = { "15": 13, "10": 8 };  // usable kg per cycle

// ─── Model configs ────────────────────────────────────────────────────────────
const MODELS = {
  M1: {
    id: "M1", label: "B2B Only",
    desc: "Both machines run B2B bulk laundry at 6 cycles/day each. 100% laundry at ₹60/kg.",
    color: "blue",
    defaults: { b2bM1: "15", b2bM2: "10", b2bHours: 7.5, b2cMachine: "10", b2cHours: 7.33,
                b2bKg: "", b2cKg: "", laundrySplit: 100, dryCleanSplit: 0 },
  },
  M2: {
    id: "M2", label: "B2C Only",
    desc: "Both machines combined for 11 retail cycles/day. 83.33% laundry + 16.67% dry clean.",
    color: "emerald",
    defaults: { b2bM1: "15", b2bM2: "10", b2bHours: 7.5, b2cMachine: "10", b2cHours: 7.33,
                b2bKg: "", b2cKg: "", laundrySplit: 83.33, dryCleanSplit: 16.67 },
  },
  M3: {
    id: "M3", label: "Dedicated",
    desc: "15 kg machine dedicated to B2B (6 cycles). 10 kg machine dedicated to B2C (11 cycles).",
    color: "violet",
    defaults: { b2bM1: "15", b2bM2: "10", b2bHours: 7.5, b2cMachine: "10", b2cHours: 7.33,
                b2bKg: "", b2cKg: "", laundrySplit: 83.33, dryCleanSplit: 16.67 },
  },
  M4: {
    id: "M4", label: "Combined",
    desc: "2 machines for B2B (6 cycles each) + 1 new 10 kg machine for B2C (11 cycles).",
    color: "amber",
    defaults: { b2bM1: "15", b2bM2: "10", b2bHours: 7.5, b2cMachine: "10", b2cHours: 7.33,
                b2bKg: "", b2cKg: "", laundrySplit: 83.33, dryCleanSplit: 16.67 },
  },
};

const COLOR = {
  blue:    { header: "bg-blue-600",   border: "border-blue-100",   text: "text-blue-600",   badge: "bg-blue-50 border-blue-200 text-blue-700",   ring: "focus:ring-blue-200",   active: "border-blue-500 bg-blue-50 text-blue-700",   dot: "bg-blue-500"   },
  emerald: { header: "bg-emerald-600",border: "border-emerald-100",text: "text-emerald-600",badge: "bg-emerald-50 border-emerald-200 text-emerald-700",ring: "focus:ring-emerald-200",active: "border-emerald-500 bg-emerald-50 text-emerald-700",dot: "bg-emerald-500"},
  violet:  { header: "bg-violet-600", border: "border-violet-100", text: "text-violet-600", badge: "bg-violet-50 border-violet-200 text-violet-700", ring: "focus:ring-violet-200", active: "border-violet-500 bg-violet-50 text-violet-700", dot: "bg-violet-500" },
  amber:   { header: "bg-amber-500",  border: "border-amber-100",  text: "text-amber-600",  badge: "bg-amber-50 border-amber-200 text-amber-700",  ring: "focus:ring-amber-200",  active: "border-amber-500 bg-amber-50 text-amber-700",  dot: "bg-amber-500"  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n)    { return Math.round(n).toLocaleString("en-IN"); }
function fmtL(n)   { return (n / 100000).toFixed(2); }
function fmtKg(n)  { return `${fmt(n)} kg`; }

function maxCycles(hours, side) {
  return Math.floor((hours * 60) / CYCLE_MIN[side]);
}

function calcColumn(kgStr, hours, machineKey, side) {
  const cap = MACHINE_CAP[machineKey];
  const cycleMin = CYCLE_MIN[side];
  const totalMins = hours * 60;
  const maxCy = Math.floor(totalMins / cycleMin);
  const kgNum = parseFloat(kgStr) || 0;
  const kgCapPerDay = maxCy * cap;
  const actualKgPerDay = Math.min(kgNum, kgCapPerDay);
  const cyclesForBatch = kgNum > 0 ? Math.ceil(kgNum / cap) : 0;
  const daysNeeded = cyclesForBatch > maxCy ? Math.ceil(cyclesForBatch / maxCy) : 1;
  return { cap, maxCy, kgCapPerDay, kgNum, actualKgPerDay, cyclesForBatch, daysNeeded, cycleMin, totalMins };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 pt-3 pb-1">{children}</p>;
}

function ResultRow({ label, value, valueClass = "text-slate-800", large = false }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`font-semibold ${large ? "text-base" : "text-sm"} ${valueClass}`}>{value}</span>
    </div>
  );
}

function CycleDots({ total, maxPerDay, cap, color }) {
  if (!total) return null;
  const dots = [];
  for (let i = 0; i < total; i++) {
    dots.push({ overflow: i >= maxPerDay });
  }
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {dots.map((d, i) => (
        <div key={i}
          className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center text-[10px] font-semibold border
            ${d.overflow ? "bg-slate-100 border-slate-200 text-slate-400" : color.badge}`}>
          <span>{cap}</span>
          <span className="text-[8px] opacity-70">kg</span>
        </div>
      ))}
    </div>
  );
}

// ─── B2B Column ───────────────────────────────────────────────────────────────
function B2BColumn({ model, state, onChange }) {
  const c = COLOR[model.color] || COLOR.blue;
  const { b2bKg, b2bHours, b2bM1, b2bM2 } = state;

  // M1: both machines run B2B. M3/M4: only M1 (15kg) is B2B. M4 also uses M2 for B2B.
  const showM2 = model.id === "M1" || model.id === "M4";

  const m1 = calcColumn(b2bKg, b2bHours, b2bM1, "b2b");
  const m2 = showM2 ? calcColumn(b2bKg, b2bHours, b2bM2, "b2b") : null;

  // For M1/M4: both machines share the load proportionally
  // For M3: only machine 1 handles B2B
  let totalB2BKgPerDay, totalB2BMonthly, totalB2BRev;
  if (showM2) {
    // Each machine runs independently on full B2B cycles
    const m1Daily = m1.maxCy * MACHINE_CAP[b2bM1];
    const m2Daily = m2.maxCy * MACHINE_CAP[b2bM2];
    totalB2BKgPerDay = m1Daily + m2Daily;
    totalB2BMonthly = totalB2BKgPerDay * WORKING_DAYS;
    totalB2BRev = totalB2BMonthly * PRICE.b2b;
  } else {
    // M3: only 15kg machine for B2B
    const m1Daily = m1.maxCy * MACHINE_CAP[b2bM1];
    totalB2BKgPerDay = m1Daily;
    totalB2BMonthly = totalB2BKgPerDay * WORKING_DAYS;
    totalB2BRev = totalB2BMonthly * PRICE.b2b;
  }

  const hasData = parseFloat(b2bKg) > 0;

  return (
    <div className={`flex-1 rounded-2xl border bg-white shadow-sm overflow-hidden ${c.border}`}>
      <div className={`px-6 py-4 flex items-center justify-between ${c.header}`}>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">Hotel & business clients</p>
          <h2 className="text-xl font-extrabold text-white">B2B</h2>
        </div>
        <span className="px-3 py-1 rounded-full bg-white/20 text-white text-sm font-bold">₹{PRICE.b2b}/kg</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Hours */}
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200">
          <span className="text-sm text-slate-500 whitespace-nowrap">Working hours/day</span>
          <input type="number" value={b2bHours} min={1} max={24} step={0.5}
            onChange={e => onChange("b2bHours", parseFloat(e.target.value) || 8)}
            className={`w-16 text-center font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 ${c.ring}`} />
          <span className="text-sm text-slate-400 whitespace-nowrap ml-auto">{Math.round(b2bHours * 60)} mins/day</span>
        </div>

        {/* KG input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Total kg of clothes</label>
          <input type="number" value={b2bKg} placeholder="e.g. 78" min={0} step={0.5}
            onChange={e => onChange("b2bKg", e.target.value)}
            className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 ${c.ring} focus:bg-white`} />
        </div>

        {/* Machine display */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">
            {showM2 ? "Machines (both run B2B)" : "Machine (dedicated B2B)"}
          </label>
          <div className={`grid ${showM2 ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
            <div className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${c.active}`}>
              15 kg machine
              <span className="block text-[11px] font-normal opacity-70">{MACHINE_CAP[b2bM1]} kg · {CYCLE_MIN.b2b} min/cycle · {m1.maxCy} cycles/day</span>
            </div>
            {showM2 && (
              <div className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${c.active}`}>
                10 kg machine
                <span className="block text-[11px] font-normal opacity-70">{MACHINE_CAP[b2bM2]} kg · {CYCLE_MIN.b2b} min/cycle · {m2.maxCy} cycles/day</span>
              </div>
            )}
          </div>
        </div>

        {/* Results — always show capacity */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
          <SectionLabel>Daily capacity ({b2bHours}h)</SectionLabel>
          <ResultRow label="15 kg machine — cycles/day" value={m1.maxCy} valueClass={c.text} />
          <ResultRow label="15 kg machine — kg/day" value={fmtKg(m1.maxCy * MACHINE_CAP[b2bM1])} valueClass={c.text} />
          {showM2 && <>
            <ResultRow label="10 kg machine — cycles/day" value={m2.maxCy} valueClass={c.text} />
            <ResultRow label="10 kg machine — kg/day" value={fmtKg(m2.maxCy * MACHINE_CAP[b2bM2])} valueClass={c.text} />
          </>}
          <ResultRow label="Total B2B capacity/day" value={fmtKg(totalB2BKgPerDay)} large />

          <SectionLabel>Monthly output (×{WORKING_DAYS} days)</SectionLabel>
          <ResultRow label="Total B2B processing/month" value={fmtKg(totalB2BMonthly)} />
          <ResultRow label="Monthly B2B revenue" value={`₹${fmt(totalB2BRev)}`} valueClass={c.text} large />

          {hasData && (
            <>
              <SectionLabel>Your batch ({b2bKg} kg)</SectionLabel>
              <ResultRow label="Cycles needed" value={m1.cyclesForBatch} valueClass={c.text} />
              {m1.daysNeeded > 1 && (
                <div className="flex items-center gap-2 py-2 text-amber-600 text-sm">
                  <FiAlertTriangle size={14} />
                  <span>Batch needs <strong>{m1.daysNeeded} days</strong> to fully process</span>
                </div>
              )}
              <div className="pt-2 pb-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  Cycle breakdown <span className="normal-case font-normal">(faded = overflow)</span>
                </p>
                <CycleDots total={m1.cyclesForBatch} maxPerDay={m1.maxCy} cap={MACHINE_CAP[b2bM1]} color={COLOR[model.color]} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── B2C Column ───────────────────────────────────────────────────────────────
function B2CColumn({ model, state, onChange }) {
  const c = COLOR.emerald; // B2C always green
  const { b2cKg, b2cHours, b2cMachine, laundrySplit, dryCleanSplit } = state;

  // M2: both machines combined for B2C. M3: only 10kg machine. M4: only new 10kg machine.
  const isM2Combined = model.id === "M2";

  const b2cCap = isM2Combined
    ? (MACHINE_CAP["15"] + MACHINE_CAP["10"]) // 13+8 = 21 kg combined per cycle
    : MACHINE_CAP[b2cMachine];

  const maxCy = maxCycles(b2cHours, "b2c");
  const kgCapPerDay = maxCy * (isM2Combined ? MACHINE_CAP["10"] : MACHINE_CAP[b2cMachine]);
  // For M2, both machines run 11 cycles: daily = (13+8) × 11 not quite — they run separately but both B2C
  const m1DailyB2C = isM2Combined ? maxCy * MACHINE_CAP["15"] : 0;
  const m2DailyB2C = maxCy * MACHINE_CAP[b2cMachine];
  const totalB2CDailyKg = m1DailyB2C + m2DailyB2C;
  const totalB2CMonthly = totalB2CDailyKg * WORKING_DAYS;

  const laundryFrac = laundrySplit / 100;
  const dcFrac = dryCleanSplit / 100;
  const laundryQty = totalB2CMonthly * laundryFrac;
  const dcQty = totalB2CMonthly * dcFrac;
  const garments = dcQty * 3; // 3 garments/kg
  const laundryRev = laundryQty * PRICE.b2cLaundry;
  const dcRev = garments * PRICE.b2cDryClean;
  const totalB2CRev = laundryRev + dcRev;

  const kgNum = parseFloat(b2cKg) || 0;
  const singleMachineCap = MACHINE_CAP[b2cMachine];
  const cyclesForBatch = kgNum > 0 ? Math.ceil(kgNum / singleMachineCap) : 0;
  const daysNeeded = cyclesForBatch > maxCy ? Math.ceil(cyclesForBatch / maxCy) : 1;
  const hasData = kgNum > 0;

  return (
    <div className="flex-1 rounded-2xl border bg-white shadow-sm overflow-hidden border-emerald-100">
      <div className="px-6 py-4 flex items-center justify-between bg-emerald-600">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">App & walk-in customers</p>
          <h2 className="text-xl font-extrabold text-white">B2C</h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="px-3 py-0.5 rounded-full bg-white/20 text-white text-xs font-bold">₹{PRICE.b2cLaundry}/kg laundry</span>
          <span className="px-3 py-0.5 rounded-full bg-white/20 text-white text-xs font-bold">₹{PRICE.b2cDryClean}/garment dry clean</span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Hours */}
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200">
          <span className="text-sm text-slate-500 whitespace-nowrap">Working hours/day</span>
          <input type="number" value={b2cHours} min={1} max={24} step={0.5}
            onChange={e => onChange("b2cHours", parseFloat(e.target.value) || 7.33)}
            className="w-16 text-center font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          <span className="text-sm text-slate-400 whitespace-nowrap ml-auto">{Math.round(b2cHours * 60)} mins/day</span>
        </div>

        {/* KG input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Total kg of clothes</label>
          <input type="number" value={b2cKg} placeholder="e.g. 88" min={0} step={0.5}
            onChange={e => onChange("b2cKg", e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:bg-white" />
        </div>

        {/* Split inputs */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Revenue split</label>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="block text-[11px] text-slate-400 mb-1">Laundry %</span>
              <input type="number" value={laundrySplit} min={0} max={100} step={0.01}
                onChange={e => { const v = parseFloat(e.target.value) || 0; onChange("laundrySplit", v); onChange("dryCleanSplit", parseFloat((100 - v).toFixed(2))); }}
                className="w-full text-sm font-bold text-emerald-700 bg-transparent focus:outline-none" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="block text-[11px] text-slate-400 mb-1">Dry clean %</span>
              <input type="number" value={dryCleanSplit} min={0} max={100} step={0.01}
                onChange={e => { const v = parseFloat(e.target.value) || 0; onChange("dryCleanSplit", v); onChange("laundrySplit", parseFloat((100 - v).toFixed(2))); }}
                className="w-full text-sm font-bold text-amber-600 bg-transparent focus:outline-none" />
            </div>
          </div>
          {Math.abs(laundrySplit + dryCleanSplit - 100) > 0.1 && (
            <p className="text-xs text-red-500 mt-1">Splits must sum to 100%</p>
          )}
        </div>

        {/* Machine display */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">
            {isM2Combined ? "Machines (both run B2C)" : "Machine (dedicated B2C)"}
          </label>
          <div className={`grid ${isM2Combined ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
            {isM2Combined && (
              <div className="rounded-xl border border-emerald-500 bg-emerald-50 text-emerald-700 px-3 py-2.5 text-sm font-semibold">
                15 kg machine
                <span className="block text-[11px] font-normal opacity-70">{MACHINE_CAP["15"]} kg · {CYCLE_MIN.b2c} min/cycle · {maxCy} cycles/day</span>
              </div>
            )}
            <div className="rounded-xl border border-emerald-500 bg-emerald-50 text-emerald-700 px-3 py-2.5 text-sm font-semibold">
              {model.id === "M4" ? "New " : ""}10 kg machine
              <span className="block text-[11px] font-normal opacity-70">{MACHINE_CAP["10"]} kg · {CYCLE_MIN.b2c} min/cycle · {maxCy} cycles/day</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
          <SectionLabel>Daily B2C capacity ({b2cHours}h · {maxCy} cycles/day)</SectionLabel>
          {isM2Combined && (
            <ResultRow label="15 kg machine — kg/day" value={fmtKg(maxCy * MACHINE_CAP["15"])} valueClass="text-emerald-600" />
          )}
          <ResultRow label={`${model.id === "M4" ? "New " : ""}10 kg machine — kg/day`} value={fmtKg(maxCy * MACHINE_CAP["10"])} valueClass="text-emerald-600" />
          <ResultRow label="Total B2C capacity/day" value={fmtKg(totalB2CDailyKg)} large />

          <SectionLabel>Monthly B2C processing (×{WORKING_DAYS} days)</SectionLabel>
          <ResultRow label="Total monthly B2C" value={fmtKg(totalB2CMonthly)} />
          <ResultRow label={`Laundry qty (${laundrySplit}%)`} value={fmtKg(laundryQty)} />
          <ResultRow label={`Dry clean qty (${dryCleanSplit}%)`} value={fmtKg(dcQty)} />
          <ResultRow label="Dry clean garments" value={`${fmt(garments)} pcs`} />

          <SectionLabel>Monthly B2C revenue</SectionLabel>
          <ResultRow label={`Laundry — ${fmt(laundryQty)} kg × ₹${PRICE.b2cLaundry}`} value={`₹${fmt(laundryRev)}`} valueClass="text-emerald-600" />
          <ResultRow label={`Dry clean — ${fmt(garments)} garments × ₹${PRICE.b2cDryClean}`} value={`₹${fmt(dcRev)}`} valueClass="text-amber-600" />
          <ResultRow label="Total B2C monthly revenue" value={`₹${fmt(totalB2CRev)}`} valueClass="text-emerald-700" large />

          {hasData && (
            <>
              <SectionLabel>Your batch ({b2cKg} kg)</SectionLabel>
              <ResultRow label="Cycles needed" value={cyclesForBatch} valueClass="text-emerald-600" />
              {daysNeeded > 1 && (
                <div className="flex items-center gap-2 py-2 text-amber-600 text-sm">
                  <FiAlertTriangle size={14} />
                  <span>Batch needs <strong>{daysNeeded} days</strong> to fully process</span>
                </div>
              )}
              <div className="pt-2 pb-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  Cycle breakdown <span className="normal-case font-normal">(faded = overflow)</span>
                </p>
                <CycleDots total={cyclesForBatch} maxPerDay={maxCy} cap={MACHINE_CAP[b2cMachine]} color={COLOR.emerald} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Combined Revenue Summary ─────────────────────────────────────────────────
function CombinedSummary({ model, state }) {
  const { b2bHours, b2cHours, b2cMachine, laundrySplit, dryCleanSplit } = state;

  const showB2B = model.id !== "M2";
  const showB2C = model.id !== "M1";
  const isM2Combined = model.id === "M2";
  const b2bHasM2 = model.id === "M1" || model.id === "M4";

  const b2bMaxCy = maxCycles(b2bHours, "b2b");
  const b2cMaxCy = maxCycles(b2cHours, "b2c");

  // B2B capacity
  const b2bDailyKg = showB2B
    ? (b2bMaxCy * MACHINE_CAP["15"]) + (b2bHasM2 ? b2bMaxCy * MACHINE_CAP["10"] : 0)
    : 0;
  const b2bMonthly = b2bDailyKg * WORKING_DAYS;
  const b2bRev = b2bMonthly * PRICE.b2b;

  // B2C capacity
  const b2cM1Daily = isM2Combined ? b2cMaxCy * MACHINE_CAP["15"] : 0;
  const b2cM2Daily = showB2C ? b2cMaxCy * MACHINE_CAP["10"] : 0;
  const b2cDailyKg = b2cM1Daily + b2cM2Daily;
  const b2cMonthly = b2cDailyKg * WORKING_DAYS;
  const laundryQty = b2cMonthly * (laundrySplit / 100);
  const dcQty = b2cMonthly * (dryCleanSplit / 100);
  const garments = dcQty * 3;
  const b2cLaundryRev = laundryQty * PRICE.b2cLaundry;
  const b2cDcRev = garments * PRICE.b2cDryClean;
  const b2cTotalRev = b2cLaundryRev + b2cDcRev;

  const totalRev = b2bRev + b2cTotalRev;
  const dailyRev = totalRev / WORKING_DAYS;
  const c = COLOR[model.color] || COLOR.blue;

  return (
    <div className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${c.border}`}>
      <div className={`px-6 py-4 ${c.header}`}>
        <p className="text-xs font-bold uppercase tracking-widest text-white/70">Combined total</p>
        <div className="flex items-end justify-between mt-1">
          <div>
            <p className="text-3xl font-extrabold text-white">₹{fmt(totalRev)}</p>
            <p className="text-sm text-white/70 mt-0.5">₹{fmtL(totalRev)} L / month</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/60 uppercase tracking-widest">Daily</p>
            <p className="text-lg font-bold text-white">₹{fmt(dailyRev)}</p>
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="space-y-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
          {showB2B && (
            <>
              <SectionLabel>B2B stream</SectionLabel>
              <ResultRow label="B2B processing/month" value={fmtKg(b2bMonthly)} />
              <ResultRow label="B2B revenue" value={`₹${fmt(b2bRev)}`} valueClass={c.text} large />
            </>
          )}
          {showB2C && (
            <>
              <SectionLabel>B2C stream</SectionLabel>
              <ResultRow label="B2C processing/month" value={fmtKg(b2cMonthly)} />
              <ResultRow label="B2C laundry revenue" value={`₹${fmt(b2cLaundryRev)}`} valueClass="text-emerald-600" />
              <ResultRow label="B2C dry clean revenue" value={`₹${fmt(b2cDcRev)}`} valueClass="text-amber-600" />
              <ResultRow label="B2C total revenue" value={`₹${fmt(b2cTotalRev)}`} valueClass="text-emerald-700" large />
            </>
          )}
          <SectionLabel>Summary</SectionLabel>
          <ResultRow label="Total monthly revenue" value={`₹${fmt(totalRev)}`} valueClass={c.text} large />
          <ResultRow label="In lakhs" value={`₹${fmtL(totalRev)} L`} valueClass={c.text} />
          <ResultRow label="Daily revenue" value={`₹${fmt(dailyRev)}`} />
          <ResultRow label="Total kg/month" value={fmtKg(b2bMonthly + b2cMonthly)} />
        </div>
      </div>
    </div>
  );
}

// ─── Model Tab Button ─────────────────────────────────────────────────────────
function ModelTab({ m, active, onClick }) {
  const c = COLOR[m.color] || COLOR.blue;
  return (
    <button onClick={() => onClick(m.id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all
        ${active
          ? `${c.badge} border-current`
          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
      <span className={`w-2 h-2 rounded-full ${active ? c.dot : "bg-slate-300"}`} />
      {m.label}
    </button>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Calculator() {
  const navigate = useNavigate();
  const { client, logout } = useHostelAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeModel, setActiveModel] = useState("M1");
  const [states, setStates] = useState(() =>
    Object.fromEntries(Object.entries(MODELS).map(([k, m]) => [k, { ...m.defaults }]))
  );

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

  const handleSidebarTabChange = useCallback((tab) => {
    setIsMobileMenuOpen(false);
    if (tab === "investors") navigate("/admin/investors");
    else navigate("/admin");
  }, [navigate]);

  const model = MODELS[activeModel];
  const state = states[activeModel];

  const handleChange = (key, value) => {
    setStates(prev => ({ ...prev, [activeModel]: { ...prev[activeModel], [key]: value } }));
  };

  const handleReset = () => {
    setStates(prev => ({ ...prev, [activeModel]: { ...model.defaults } }));
  };

  const showB2B = activeModel !== "M2";
  const showB2C = activeModel !== "M1";

  return (
    <div className="flex min-h-screen bg-[#F1F5F9]" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <AdminSidebar
        activeTab="calculator"
        setActiveTab={handleSidebarTabChange}
        user={client}
        onLogout={logout}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />

      <main className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ${isSidebarCollapsed ? "lg:ml-[80px]" : "lg:ml-[220px]"} ml-0`}>
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#F1F5F9]/95 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-8">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setIsMobileMenuOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
                aria-label="Open sidebar">
                <FiMenu size={20} />
              </button>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Admin Portal</p>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">Revenue Calculator</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
                <FiRefreshCw size={15} />
                Reset
              </button>
              <button type="button" onClick={() => navigate("/admin")}
                className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
                <FiArrowLeft size={16} />
                Back
              </button>
            </div>
          </div>

          {/* Model tabs */}
          <div className="px-4 pb-3 lg:px-8 flex flex-wrap gap-2">
            {Object.values(MODELS).map(m => (
              <ModelTab key={m.id} m={m} active={activeModel === m.id} onClick={setActiveModel} />
            ))}
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-8">
          {/* Model description */}
          <p className="text-sm text-slate-500 mb-5">
            <span className="font-bold text-slate-700">{model.label}:</span> {model.desc}
          </p>

          {/* Machine columns */}
          <div className="flex flex-col lg:flex-row gap-4 mb-4">
            {showB2B && <B2BColumn model={model} state={state} onChange={handleChange} />}
            {showB2C && <B2CColumn model={model} state={state} onChange={handleChange} />}
          </div>

          {/* Combined summary */}
          <CombinedSummary model={model} state={state} />
        </div>
      </main>
    </div>
  );
}
