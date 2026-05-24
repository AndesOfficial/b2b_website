import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu, FiArrowLeft, FiAlertTriangle } from "react-icons/fi";
import AdminSidebar from "../components/AdminSidebar";
import { useHostelAuth } from "../context/HostelAuthContext";

const MONTHS = 30;
const CYCLE_TIME = { b2b: 75, b2c: 40 };
const RATES = { b2b: 60, b2c: 81 };
const CAP = { "15": 13, "10": 8 };

function cyclesNeeded(kg, cap) {
  if (!kg || kg <= 0) return null;
  const full = Math.floor(kg / cap);
  const rem = parseFloat((kg % cap).toFixed(4));
  const partial = rem > 0 ? 1 : 0;
  return { full, partial, total: full + partial, lastKg: rem || cap };
}

function fmt(n) {
  return Math.round(n).toLocaleString("en-IN");
}

function CycleDots({ cycles, maxPerDay, isB2B }) {
  if (!cycles) return null;
  const dots = [];
  for (let i = 0; i < cycles.full; i++) {
    const overflow = i >= maxPerDay;
    dots.push({ kg: CAP[isB2B ? "15" : "15"], overflow, partial: false });
  }
  if (cycles.partial) {
    dots.push({ kg: cycles.lastKg, overflow: cycles.full >= maxPerDay, partial: true });
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {dots.map((d, i) => (
        <div
          key={i}
          className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center text-[10px] font-semibold border
            ${d.overflow
              ? "bg-slate-100 border-slate-200 text-slate-400"
              : d.partial
              ? "bg-amber-50 border-amber-200 text-amber-700"
              : isB2B
              ? "bg-blue-50 border-blue-200 text-blue-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}
        >
          <span>{typeof d.kg === "number" && d.kg % 1 !== 0 ? d.kg.toFixed(1) : d.kg}</span>
          <span className="text-[8px] opacity-70">kg</span>
        </div>
      ))}
    </div>
  );
}

function ResultRow({ label, value, valueClass = "text-slate-800", large = false }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`font-semibold ${large ? "text-base" : "text-sm"} ${valueClass}`}>{value}</span>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 pt-3 pb-1">{children}</p>
  );
}

function CalculatorColumn({ side }) {
  const isB2B = side === "b2b";
  const label = isB2B ? "B2B" : "B2C";
  const rate = RATES[side];
  const cycleMin = CYCLE_TIME[side];

  const [kg, setKg] = useState("");
  const [hours, setHours] = useState(8);
  const [machine, setMachine] = useState("15");

  const capPerCycle = CAP[machine];
  const totalMins = hours * 60;
  const maxCyclesPerDay = Math.floor(totalMins / cycleMin);
  const kgCapPerDay = maxCyclesPerDay * capPerCycle;
  const kgNum = parseFloat(kg) || 0;
  const cycles = cyclesNeeded(kgNum, capPerCycle);
  const actualKgPerDay = Math.min(kgNum, kgCapPerDay);
  const cyclesUsedPerDay = cycles ? Math.min(cycles.total, maxCyclesPerDay) : 0;
  const daysNeeded = cycles && cycles.total > maxCyclesPerDay ? Math.ceil(cycles.total / maxCyclesPerDay) : 1;
  const dailyRev = actualKgPerDay * rate;
  const monthlyRev = dailyRev * MONTHS;
  const hasData = kgNum > 0;

  const accentBg = isB2B ? "bg-blue-600" : "bg-emerald-600";
  const accentText = isB2B ? "text-blue-600" : "text-emerald-600";
  const accentBorder = isB2B ? "border-blue-500" : "border-emerald-500";
  const accentLight = isB2B ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-emerald-50 border-emerald-200 text-emerald-700";
  const activeMachine = isB2B ? "border-blue-500 bg-blue-50 text-blue-700" : "border-emerald-500 bg-emerald-50 text-emerald-700";

  return (
    <div className={`flex-1 rounded-2xl border bg-white shadow-sm overflow-hidden ${isB2B ? "border-blue-100" : "border-emerald-100"}`}>
      {/* Column header */}
      <div className={`px-6 py-4 flex items-center justify-between ${isB2B ? "bg-blue-600" : "bg-emerald-600"}`}>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">{isB2B ? "Hotel & business clients" : "App & walk-in customers"}</p>
          <h2 className="text-xl font-extrabold text-white">{label}</h2>
        </div>
        <span className="px-3 py-1 rounded-full bg-white/20 text-white text-sm font-bold">
          ₹{rate}/kg
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Hours */}
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200">
          <span className="text-sm text-slate-500 whitespace-nowrap">Working hours/day</span>
          <input
            type="number"
            value={hours}
            min={1} max={24} step={0.5}
            onChange={e => setHours(parseFloat(e.target.value) || 8)}
            className="w-16 text-center font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <span className="text-sm text-slate-400 whitespace-nowrap ml-auto">{Math.round(totalMins)} mins/day</span>
        </div>

        {/* KG input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">
            Total kg of clothes
          </label>
          <input
            type="number"
            value={kg}
            placeholder={`e.g. ${isB2B ? "25" : "20"}`}
            min={0} step={0.5}
            onChange={e => setKg(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white"
          />
        </div>

        {/* Machine picker */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Machine</label>
          <div className="grid grid-cols-2 gap-2">
            {["15", "10"].map(m => (
              <button
                key={m}
                onClick={() => setMachine(m)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all
                  ${machine === m ? activeMachine : "border-slate-200 text-slate-500 bg-white hover:bg-slate-50"}`}
              >
                {m} kg machine
                <span className="block text-[11px] font-normal opacity-70">{CAP[m]} kg · {cycleMin} min/cycle</span>
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {!hasData ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-400">
            Enter kg above to see calculation
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
            <SectionLabel>This batch ({kgNum} kg)</SectionLabel>
            <ResultRow label="Capacity per cycle" value={`${capPerCycle} kg`} />
            <ResultRow label="Full cycles needed" value={cycles.full} valueClass={accentText} />
            {cycles.partial > 0 && (
              <ResultRow
                label={`Partial cycle (${cycles.lastKg % 1 === 0 ? cycles.lastKg : cycles.lastKg.toFixed(1)} kg)`}
                value="1"
                valueClass="text-amber-600"
              />
            )}
            <ResultRow label="Total cycles for batch" value={cycles.total} large />

            <SectionLabel>Per day ({hours}h = {Math.round(totalMins)} mins)</SectionLabel>
            <ResultRow label="Max cycles/day" value={maxCyclesPerDay} />
            <ResultRow label="Max capacity/day" value={`${kgCapPerDay} kg`} />
            <ResultRow
              label="Kg processed/day"
              value={`${actualKgPerDay % 1 === 0 ? actualKgPerDay : actualKgPerDay.toFixed(1)} kg`}
              valueClass={accentText}
              large
            />
            {daysNeeded > 1 && (
              <div className="flex items-center gap-2 py-2 text-amber-600 text-sm">
                <FiAlertTriangle size={14} />
                <span>Batch needs <strong>{daysNeeded} days</strong> to fully process</span>
              </div>
            )}
            <ResultRow
              label="Daily revenue"
              value={`₹${fmt(dailyRev)}`}
              valueClass={accentText}
              large
            />

            <SectionLabel>Per month (×{MONTHS} days)</SectionLabel>
            <ResultRow label="Kg processed/month" value={`${fmt(Math.round(actualKgPerDay) * MONTHS)} kg`} />
            <ResultRow
              label="Monthly revenue"
              value={`₹${fmt(monthlyRev)}`}
              valueClass={isB2B ? "text-blue-700" : "text-emerald-700"}
              large
            />

            <div className="pt-2 pb-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                Cycle breakdown <span className="normal-case font-normal">(faded = overflow)</span>
              </p>
              <CycleDots cycles={cycles} maxPerDay={maxCyclesPerDay} isB2B={isB2B} machine={machine} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Calculator() {
  const navigate = useNavigate();
  const { client, logout } = useHostelAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

      <main
        className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ${
          isSidebarCollapsed ? "lg:ml-[80px]" : "lg:ml-[220px]"
        } ml-0`}
      >
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#F1F5F9]/95 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
                aria-label="Open sidebar"
              >
                <FiMenu size={20} />
              </button>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Admin Portal</p>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">Calculator</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FiArrowLeft size={16} />
              Back to Dashboard
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-8">
          <p className="text-sm text-slate-500 mb-5">
            Enter kg of clothes in either or both channels. Cycles, daily output, and monthly revenue calculate automatically.
          </p>
          <div className="flex flex-col lg:flex-row gap-4">
            <CalculatorColumn side="b2b" />
            <CalculatorColumn side="b2c" />
          </div>
        </div>
      </main>
    </div>
  );
}
