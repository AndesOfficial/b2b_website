import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu, FiArrowLeft, FiRefreshCw, FiAlertTriangle } from "react-icons/fi";
import AdminSidebar from "../components/AdminSidebar";
import { useHostelAuth } from "../context/HostelAuthContext";

// ─── Defaults per model ───────────────────────────────────────────────────────
const DEFAULTS = {
  M1: { m1cap:13, m2cap:8, b2bcycles:6, b2ccycles:11, workdays:30,
        b2bprice:60, b2cprice:81, dcprice:100, gpkg:3,
        laundrysplit:100, dcsplit:0 },
  M2: { m1cap:13, m2cap:8, b2bcycles:6, b2ccycles:11, workdays:30,
        b2bprice:60, b2cprice:81, dcprice:100, gpkg:3,
        laundrysplit:83.33, dcsplit:16.67 },
  M3: { m1cap:13, m2cap:8, b2bcycles:6, b2ccycles:11, workdays:30,
        b2bprice:60, b2cprice:81, dcprice:100, gpkg:3,
        laundrysplit:83.33, dcsplit:16.67 },
  M4: { m1cap:13, m2cap:8, b2bcycles:6, b2ccycles:11, workdays:30,
        b2bprice:60, b2cprice:81, dcprice:100, gpkg:3,
        laundrysplit:83.33, dcsplit:16.67 },
};

const MODEL_INFO = {
  M1: { label:"B2B Only",   color:"blue",    desc:"Both machines (M1 + M2) run B2B bulk laundry at configured cycles/day. 100% laundry pricing." },
  M2: { label:"B2C Only",   color:"emerald", desc:"Both machines share B2C cycles/day for retail customers. Laundry + dry clean split applies." },
  M3: { label:"Dedicated",  color:"violet",  desc:"M1 dedicated to B2B at B2B cycles/day. M2 dedicated to B2C at B2C cycles/day." },
  M4: { label:"Combined",   color:"amber",   desc:"M1 + M2 handle B2B at B2B cycles/day. M2 capacity also runs B2C at B2C cycles/day." },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n)   { return Math.round(n).toLocaleString("en-IN"); }
function fmtL(n)  { return (n / 100000).toFixed(2); }
function fmtKg(n) { return `${fmt(n)} kg`; }

function calculate(model, s) {
  const { m1cap, m2cap, b2bcycles, b2ccycles, workdays,
          b2bprice, b2cprice, dcprice, gpkg,
          laundrysplit, dcsplit } = s;

  let b2bDailyKg = 0, b2cDailyKg = 0;
  if (model === "M1") {
    b2bDailyKg = (m1cap + m2cap) * b2bcycles;
  } else if (model === "M2") {
    b2cDailyKg = (m1cap + m2cap) * b2ccycles;
  } else if (model === "M3") {
    b2bDailyKg = m1cap * b2bcycles;
    b2cDailyKg = m2cap * b2ccycles;
  } else if (model === "M4") {
    b2bDailyKg = (m1cap + m2cap) * b2bcycles;
    b2cDailyKg = m2cap * b2ccycles;
  }

  const b2bMonthly = b2bDailyKg * workdays;
  const b2cMonthly = b2cDailyKg * workdays;
  const laundryQty = b2cMonthly * (laundrysplit / 100);
  const dcQty      = b2cMonthly * (dcsplit / 100);
  const garments   = dcQty * gpkg;
  const b2bRev     = b2bMonthly * b2bprice;
  const laundryRev = laundryQty * b2cprice;
  const dcRev      = garments * dcprice;
  const totalRev   = b2bRev + laundryRev + dcRev;
  const dailyRev   = workdays > 0 ? totalRev / workdays : 0;

  return { b2bDailyKg, b2cDailyKg, b2bMonthly, b2cMonthly,
           laundryQty, dcQty, garments,
           b2bRev, laundryRev, dcRev, totalRev, dailyRev };
}

// ─── Input field components ───────────────────────────────────────────────────
function FieldLabel({ children, unit }) {
  return (
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs text-slate-500">{children}</span>
      {unit && <span className="text-[11px] text-slate-400 font-mono">{unit}</span>}
    </div>
  );
}

function NumInput({ id, value, onChange, min=0, max, step=1, prefix, disabled }) {
  return (
    <div className={`relative ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      {prefix && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono pointer-events-none">{prefix}</span>
      )}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={`w-full h-9 border border-slate-200 rounded-lg font-mono text-sm text-slate-800 bg-white
          focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition
          ${prefix ? "pl-6 pr-3" : "px-3"}`}
      />
    </div>
  );
}

// ─── Section divider ─────────────────────────────────────────────────────────
function SectionDivider({ children }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-4">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{children}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

// ─── Output row ──────────────────────────────────────────────────────────────
function OutRow({ label, value, valueClass="text-slate-800", large=false, muted=false }) {
  return (
    <div className={`flex items-center justify-between py-2 border-b border-slate-100 last:border-0 ${muted ? "opacity-40" : ""}`}>
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`font-semibold font-mono ${large ? "text-base" : "text-sm"} ${valueClass}`}>{value}</span>
    </div>
  );
}

// ─── Model Tab ────────────────────────────────────────────────────────────────
const TAB_COLORS = {
  blue:    { active: "bg-blue-600 border-blue-600 text-white",    idle: "text-slate-600 hover:bg-blue-50 hover:text-blue-700 border-slate-200" },
  emerald: { active: "bg-emerald-600 border-emerald-600 text-white", idle: "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 border-slate-200" },
  violet:  { active: "bg-violet-600 border-violet-600 text-white",  idle: "text-slate-600 hover:bg-violet-50 hover:text-violet-700 border-slate-200" },
  amber:   { active: "bg-amber-500 border-amber-500 text-white",    idle: "text-slate-600 hover:bg-amber-50 hover:text-amber-700 border-slate-200" },
};

function ModelTab({ modelId, info, active, onClick }) {
  const cols = TAB_COLORS[info.color];
  return (
    <button
      onClick={() => onClick(modelId)}
      className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap
        ${active ? cols.active : cols.idle}`}>
      {modelId} · {info.label}
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
    Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, { ...v }]))
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

  const s = states[activeModel];
  const info = MODEL_INFO[activeModel];

  const set = (key, val) =>
    setStates(prev => ({ ...prev, [activeModel]: { ...prev[activeModel], [key]: val } }));

  const handleReset = () =>
    setStates(prev => ({ ...prev, [activeModel]: { ...DEFAULTS[activeModel] } }));

  // Sync splits
  const setLaundry = v => { set("laundrysplit", v); set("dcsplit", parseFloat((100 - v).toFixed(2))); };
  const setDC      = v => { set("dcsplit", v);       set("laundrysplit", parseFloat((100 - v).toFixed(2))); };

  const showB2B = activeModel !== "M2";
  const showB2C = activeModel !== "M1";
  const isM1    = activeModel === "M1";

  const out = calculate(activeModel, s);

  // accent colours for the current model
  const accentMap = { blue:"text-blue-600", emerald:"text-emerald-600", violet:"text-violet-600", amber:"text-amber-600" };
  const accent = accentMap[info.color];
  const heroBg = { blue:"bg-blue-600", emerald:"bg-emerald-600", violet:"bg-violet-600", amber:"bg-amber-500" }[info.color];

  return (
    <div className="flex min-h-screen bg-slate-50" style={{ fontFamily: "DM Sans, sans-serif" }}>
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

        {/* ── Header ── */}
        <header className={`${heroBg} px-6 py-5 relative overflow-hidden`}>
          {/* decorative circles */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-16 left-1/3 w-64 h-64 rounded-full bg-white/4 pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setIsMobileMenuOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white lg:hidden">
                <FiMenu size={18} />
              </button>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50 mb-0.5">Andes Services</p>
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

          {/* Model tabs */}
          <div className="relative z-10 flex flex-wrap gap-2 mt-4">
            {Object.entries(MODEL_INFO).map(([id, inf]) => (
              <ModelTab key={id} modelId={id} info={inf} active={activeModel === id} onClick={setActiveModel} />
            ))}
          </div>
        </header>

        {/* ── Two-panel body ── */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0">

          {/* ════ LEFT: Inputs panel ════ */}
          <div className="w-full lg:w-[320px] xl:w-[360px] flex-shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto">
            <div className="p-5">

              {/* Model description */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 text-xs text-blue-800 leading-relaxed">
                <strong className="font-semibold">{info.label}:</strong> {info.desc}
              </div>

              {/* Machine specs */}
              <SectionDivider>Machine specifications</SectionDivider>
              <div className="space-y-3">
                <div>
                  <FieldLabel unit="kg/cycle">Machine 1 capacity</FieldLabel>
                  <NumInput value={s.m1cap} min={1} max={50} step={0.5} onChange={v => set("m1cap", v)} />
                </div>
                <div>
                  <FieldLabel unit="kg/cycle">Machine 2 capacity</FieldLabel>
                  <NumInput value={s.m2cap} min={1} max={50} step={0.5} onChange={v => set("m2cap", v)} />
                </div>
                <div className={!showB2B ? "opacity-40 pointer-events-none" : ""}>
                  <FieldLabel unit="cycles/day">B2B cycles per day</FieldLabel>
                  <NumInput value={s.b2bcycles} min={1} max={20} onChange={v => set("b2bcycles", v)} disabled={!showB2B} />
                </div>
                <div className={!showB2C ? "opacity-40 pointer-events-none" : ""}>
                  <FieldLabel unit="cycles/day">B2C cycles per day</FieldLabel>
                  <NumInput value={s.b2ccycles} min={1} max={20} onChange={v => set("b2ccycles", v)} disabled={!showB2C} />
                </div>
                <div>
                  <FieldLabel unit="days">Monthly working days</FieldLabel>
                  <NumInput value={s.workdays} min={1} max={31} onChange={v => set("workdays", v)} />
                </div>
              </div>

              {/* Pricing */}
              <SectionDivider>Pricing assumptions</SectionDivider>
              <div className="space-y-3">
                <div className={!showB2B ? "opacity-40 pointer-events-none" : ""}>
                  <FieldLabel unit="₹/kg">B2B laundry price</FieldLabel>
                  <NumInput value={s.b2bprice} min={1} prefix="₹" onChange={v => set("b2bprice", v)} disabled={!showB2B} />
                </div>
                <div className={!showB2C ? "opacity-40 pointer-events-none" : ""}>
                  <FieldLabel unit="₹/kg">B2C laundry price</FieldLabel>
                  <NumInput value={s.b2cprice} min={1} prefix="₹" onChange={v => set("b2cprice", v)} disabled={!showB2C} />
                </div>
                <div className={!showB2C ? "opacity-40 pointer-events-none" : ""}>
                  <FieldLabel unit="₹/garment">Dry clean price</FieldLabel>
                  <NumInput value={s.dcprice} min={1} prefix="₹" onChange={v => set("dcprice", v)} disabled={!showB2C} />
                </div>
                <div className={!showB2C ? "opacity-40 pointer-events-none" : ""}>
                  <FieldLabel unit="garments/kg">Garments per kg</FieldLabel>
                  <NumInput value={s.gpkg} min={1} step={0.5} onChange={v => set("gpkg", v)} disabled={!showB2C} />
                </div>
              </div>

              {/* B2C split */}
              <SectionDivider>
                B2C revenue split
                {isM1 && <span className="ml-1 text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono normal-case tracking-normal">Locked — B2B only</span>}
              </SectionDivider>
              <div className={`grid grid-cols-2 gap-3 ${isM1 ? "opacity-40 pointer-events-none" : ""}`}>
                <div>
                  <FieldLabel unit="%">Laundry split</FieldLabel>
                  <NumInput value={s.laundrysplit} min={0} max={100} step={0.01} onChange={setLaundry} />
                </div>
                <div>
                  <FieldLabel unit="%">Dry clean split</FieldLabel>
                  <NumInput value={s.dcsplit} min={0} max={100} step={0.01} onChange={setDC} />
                </div>
              </div>
              {!isM1 && Math.abs(s.laundrysplit + s.dcsplit - 100) > 0.1 && (
                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                  <FiAlertTriangle size={11} /> Splits must sum to 100%
                </p>
              )}

              {/* Reset */}
              <button onClick={handleReset}
                className="w-full mt-5 h-9 border border-slate-200 rounded-lg text-sm text-slate-500 font-medium hover:bg-slate-50 hover:text-slate-700 transition flex items-center justify-center gap-2">
                <FiRefreshCw size={13} /> Reset to model defaults
              </button>
            </div>
          </div>

          {/* ════ RIGHT: Outputs panel ════ */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Revenue hero */}
            <div className={`${heroBg} rounded-2xl p-5 relative overflow-hidden`}>
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50 mb-1">Total monthly revenue</p>
              <p className="text-4xl font-light text-white font-mono">
                <span className="text-xl align-top mt-1.5 inline-block opacity-70">₹</span>
                {fmt(out.totalRev)}
              </p>
              <div className="flex gap-6 mt-3 flex-wrap">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-white/40 mb-0.5">In lakhs</p>
                  <p className="text-sm font-mono font-medium text-white/90">₹ {fmtL(out.totalRev)} L</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-white/40 mb-0.5">Daily revenue</p>
                  <p className="text-sm font-mono font-medium text-white/90">₹ {fmt(out.dailyRev)} / day</p>
                </div>
              </div>
            </div>

            {/* Capacity cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`bg-white border border-slate-200 rounded-xl p-4 border-l-4 border-l-blue-400 ${!showB2B ? "opacity-35" : ""}`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-3">B2B capacity</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs"><span className="text-slate-500">Daily output</span><span className="font-mono font-medium">{fmtKg(out.b2bDailyKg)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-500">Monthly processing</span><span className="font-mono font-medium">{fmtKg(out.b2bMonthly)}</span></div>
                </div>
              </div>
              <div className={`bg-white border border-slate-200 rounded-xl p-4 border-l-4 border-l-emerald-400 ${!showB2C ? "opacity-35" : ""}`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-3">B2C capacity</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs"><span className="text-slate-500">Daily output</span><span className="font-mono font-medium">{fmtKg(out.b2cDailyKg)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-500">Monthly processing</span><span className="font-mono font-medium">{fmtKg(out.b2cMonthly)}</span></div>
                </div>
              </div>
            </div>

            {/* Revenue breakdown */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Revenue breakdown</p>
              </div>
              {showB2B && (
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-3 border-b border-slate-100 text-sm">
                  <span className="text-slate-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" /> B2B laundry
                  </span>
                  <span className="text-slate-400 font-mono text-xs text-right">{fmtKg(out.b2bMonthly)}</span>
                  <span className="font-mono font-medium text-right">₹ {fmt(out.b2bRev)}</span>
                </div>
              )}
              {showB2C && (
                <>
                  <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-3 border-b border-slate-100 text-sm">
                    <span className="text-slate-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" /> B2C laundry
                    </span>
                    <span className="text-slate-400 font-mono text-xs text-right">{fmtKg(out.laundryQty)}</span>
                    <span className="font-mono font-medium text-right">₹ {fmt(out.laundryRev)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-3 border-b border-slate-100 text-sm">
                    <span className="text-slate-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" /> B2C dry clean
                    </span>
                    <span className="text-slate-400 font-mono text-xs text-right">{fmt(out.garments)} garments</span>
                    <span className="font-mono font-medium text-right">₹ {fmt(out.dcRev)}</span>
                  </div>
                </>
              )}
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-3 bg-slate-50 text-sm font-medium">
                <span className="text-slate-800">Total</span>
                <span />
                <span className={`font-mono font-semibold text-right ${accent}`}>₹ {fmt(out.totalRev)}</span>
              </div>
            </div>

            {/* Intermediate calculations */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Intermediate calculations</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label:"B2C laundry qty",   val: fmt(out.laundryQty), unit:"kg/month",  dim: !showB2C },
                  { label:"B2C dry clean qty",  val: fmt(out.dcQty),      unit:"kg/month",  dim: !showB2C },
                  { label:"Dry clean garments", val: fmt(out.garments),   unit:"garments",  dim: !showB2C },
                  { label:"Total processed",    val: fmt(out.b2bMonthly + out.b2cMonthly), unit:"kg/month", dim: false },
                ].map(({ label, val, unit, dim }) => (
                  <div key={label} className={`bg-white border border-slate-200 rounded-xl p-3.5 ${dim ? "opacity-35" : ""}`}>
                    <p className="text-xs text-slate-400 mb-1 leading-snug">{label}</p>
                    <p className="text-xl font-mono font-medium text-slate-800">{val}</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{unit}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
