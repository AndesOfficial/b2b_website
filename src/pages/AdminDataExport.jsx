import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, getDocs, limit, orderBy, query, startAfter, Timestamp, where,
} from "firebase/firestore";
import { FiAlertCircle, FiCheckCircle, FiDownload, FiMenu } from "react-icons/fi";
import { MdOutlineFileDownload } from "react-icons/md";
import AdminSidebar from "../components/Layout/AdminSidebar";
import { useHostelAuth } from "../context/HostelAuthContext";
import { db } from "../firebase";

// Export any Firestore collection to CSV: everything, one day, or a date range.

const COLLECTIONS = [
  { name: "users", label: "users — app customers", dateField: "createdAt" },
  { name: "cartdetails", label: "cartdetails — B2C orders", dateField: "createdAt" },
  { name: "wallets", label: "wallets — wallet balances", dateField: "createdAt" },
  { name: "available_coupons", label: "available_coupons — coupons", dateField: "createdAt" },
  { name: "prices", label: "prices — service catalog", dateField: "" },
  { name: "transactions", label: "transactions — payment records", dateField: "createdAt" },
  { name: "managerVerifications", label: "managerVerifications", dateField: "" },
  { name: "managerB2bEntries", label: "managerB2bEntries — B2B entries", dateField: "date" },
];
const CUSTOM = "__custom__";
const PAGE = 1000;
const MAX_DOCS = 100000; // safety stop, so one export can't run away

const IST = "+05:30";
const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

const isTs = (v) => v && typeof v === "object" && typeof v.toDate === "function";
const fmtTs = (v) => new Date(v.toDate().getTime() + 5.5 * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19);
const isRef = (v) => v && typeof v === "object" && typeof v.path === "string" && typeof v.firestore === "object";

// Credentials never go into an export file.
const SECRET_KEY = /^(password|passcode|pin|otp)$|token|secret|apikey/i;

// Nested maps become dotted columns (address.city); arrays and anything odd become JSON.
function flatten(value, prefix, out) {
  if (value === null || value === undefined) { out[prefix] = ""; return; }
  if (isTs(value)) { out[prefix] = fmtTs(value); return; }
  if (isRef(value)) { out[prefix] = value.path; return; }
  if (Array.isArray(value)) {
    out[prefix] = JSON.stringify(value, (_k, v) => (isTs(v) ? fmtTs(v) : v));
    return;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length) { out[prefix] = ""; return; }
    keys.forEach((k) => { if (!SECRET_KEY.test(k)) flatten(value[k], prefix ? `${prefix}.${k}` : k, out); });
    return;
  }
  out[prefix] = value;
}

const cell = (v) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

function toCsv(docs) {
  const rows = docs.map((d) => { const r = { _id: d.id }; flatten(d.data, "", r); delete r[""]; return r; });
  const cols = [];
  const seen = new Set();
  rows.forEach((r) => Object.keys(r).forEach((k) => { if (!seen.has(k)) { seen.add(k); cols.push(k); } }));
  cols.sort((a, b) => (a === "_id" ? -1 : b === "_id" ? 1 : 0)); // id first, rest in first-seen order
  const bom = String.fromCharCode(0xfeff);
  return bom + [cols.map(cell).join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
}

function saveFile(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400";

export default function AdminDataExport() {
  const navigate = useNavigate();
  const { client, logout } = useHostelAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [pick, setPick] = useState("users");
  const [custom, setCustom] = useState("");
  const [dateField, setDateField] = useState("createdAt");
  const [mode, setMode] = useState("all"); // all | range
  const [from, setFrom] = useState(todayIST());
  const [to, setTo] = useState(todayIST());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 1024;
      setCollapsed(mobile);
      if (!mobile) setMobileOpen(false);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onSidebar = useCallback((tab) => {
    setMobileOpen(false);
    const routes = {
      services: "/admin/services", b2b: "/admin/b2b-orders", regular: "/admin/regular-orders", investors: "/admin/investors",
      expenses: "/admin/expenses", salaries: "/admin/salaries", calculator: "/admin/calculator", dailyReport: "/admin/daily-report",
      metaleads: "/admin/meta-leads", coupons: "/admin/coupons", wallets: "/admin/wallets",
    };
    if (tab === "dataExport") return;
    if (routes[tab]) { navigate(routes[tab]); return; }
    navigate("/admin", { state: { initialTab: tab } });
  }, [navigate]);

  const choose = (name) => {
    setPick(name);
    const known = COLLECTIONS.find((c) => c.name === name);
    setDateField(known ? known.dateField || "createdAt" : "createdAt");
    if (known && !known.dateField) setMode("all");
    setMsg(null);
  };

  const collectionName = (pick === CUSTOM ? custom : pick).trim();
  const known = COLLECTIONS.find((c) => c.name === pick);
  const noDates = !!known && !known.dateField;

  const run = async () => {
    if (!collectionName || /[/\s]/.test(collectionName)) { setMsg({ ok: false, text: "Enter a valid collection name (no slashes or spaces)." }); return; }
    if (mode === "range") {
      if (!dateField.trim()) { setMsg({ ok: false, text: "Enter the date field to filter on." }); return; }
      if (!from || !to || from > to) { setMsg({ ok: false, text: "Pick a valid date range (start is after the end)." }); return; }
    }
    setBusy(true); setMsg(null); setProgress(0);
    try {
      const col = collection(db, collectionName);
      const field_ = dateField.trim();
      let base;
      if (mode === "range") {
        // `date`-style string fields (YYYY-MM-DD) vs Timestamp fields
        const asString = field_ === "date" || /Date$/.test(field_) && !/(createdAt|At)$/.test(field_);
        const lo = asString ? from : Timestamp.fromDate(new Date(`${from}T00:00:00${IST}`));
        const hi = asString ? to : Timestamp.fromDate(new Date(`${to}T23:59:59.999${IST}`));
        base = [where(field_, ">=", lo), where(field_, "<=", hi), orderBy(field_, "asc")];
      } else {
        base = []; // no orderBy: documents that lack a date field would be dropped
      }
      const docs = [];
      let last = null;
      for (;;) {
        const q = query(col, ...base, ...(base.length ? [] : [orderBy("__name__")]), ...(last ? [startAfter(last)] : []), limit(PAGE));
        const snap = await getDocs(q);
        snap.docs.forEach((d) => docs.push({ id: d.id, data: d.data() }));
        setProgress(docs.length);
        if (snap.docs.length < PAGE) break;
        last = snap.docs[snap.docs.length - 1];
        if (docs.length >= MAX_DOCS) { setMsg({ ok: false, text: `Stopped at ${MAX_DOCS.toLocaleString()} documents. Narrow the date range and export again.` }); break; }
      }
      if (!docs.length) { setMsg({ ok: false, text: "No documents found for that selection." }); return; }
      const suffix = mode === "all" ? "all" : from === to ? from : `${from}_to_${to}`;
      saveFile(toCsv(docs), `${collectionName}_${suffix}.csv`);
      setMsg((m) => m || { ok: true, text: `Downloaded ${docs.length.toLocaleString()} document${docs.length === 1 ? "" : "s"} from "${collectionName}".` });
    } catch (err) {
      console.error("data export:", err);
      const denied = err?.code === "permission-denied";
      const needsIndex = err?.code === "failed-precondition";
      setMsg({
        ok: false,
        text: denied ? `Your account isn't allowed to read "${collectionName}" from the browser.`
          : needsIndex ? `That date filter needs a Firestore index (or "${dateField}" isn't a date field on these documents). ${err.message}`
          : err?.message || "Export failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <AdminSidebar activeTab="dataExport" setActiveTab={onSidebar} issuesCount={0} user={client} onLogout={logout}
        isCollapsed={collapsed} setIsCollapsed={setCollapsed} isMobileOpen={mobileOpen} setIsMobileOpen={setMobileOpen} />

      <main className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ${collapsed ? "lg:ml-[80px]" : "lg:ml-[220px]"}`}>
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/80 bg-white/95 px-6 py-4 backdrop-blur-md">
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open navigation menu"><FiMenu size={22} /></button>
          <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600"><MdOutlineFileDownload size={20} /></span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Data Export</h1>
            <p className="mt-0.5 text-xs text-slate-500">Download any collection as a CSV — everything, one day, or a date range.</p>
          </div>
        </header>

        <div className="mx-auto w-full max-w-2xl space-y-5 p-6">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="block text-xs font-bold text-slate-500">Collection
              <select className={`${field} mt-1`} value={pick} onChange={(e) => choose(e.target.value)}>
                {COLLECTIONS.map((c) => <option key={c.name} value={c.name}>{c.label}</option>)}
                <option value={CUSTOM}>Other — type a collection name…</option>
              </select>
            </label>
            {pick === CUSTOM && (
              <input className={field} placeholder="Collection name, e.g. orders" value={custom} onChange={(e) => setCustom(e.target.value)} />
            )}

            <div>
              <p className="mb-1 text-xs font-bold text-slate-500">Which documents</p>
              <div className="flex gap-2">
                {[["all", "All documents"], ["range", "A day or date range"]].map(([k, label]) => (
                  <button key={k} type="button" disabled={k === "range" && noDates} onClick={() => setMode(k)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-40 ${mode === k ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                    {label}
                  </button>
                ))}
              </div>
              {noDates && <p className="mt-1 text-[11px] text-slate-400">This collection has no date field, so it exports in full.</p>}
            </div>

            {mode === "range" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-bold text-slate-500">From
                    <input type="date" className={`${field} mt-1`} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
                  </label>
                  <label className="block text-xs font-bold text-slate-500">To
                    <input type="date" className={`${field} mt-1`} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
                  </label>
                </div>
                <p className="-mt-1 text-[11px] text-slate-400">For one day, pick the same date twice. Days are in IST.</p>
                <label className="block text-xs font-bold text-slate-500">Filter on date field
                  <input className={`${field} mt-1`} value={dateField} onChange={(e) => setDateField(e.target.value)} />
                </label>
                <p className="-mt-1 text-[11px] text-slate-400">Usually <code>createdAt</code> (when it was created). Documents without this field are left out of a date export.</p>
              </div>
            )}

            <button type="button" disabled={busy} onClick={run}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              <FiDownload /> {busy ? `Fetching… ${progress.toLocaleString()} documents` : "Download CSV"}
            </button>

            {msg && (
              <p className={`flex items-start gap-2 rounded-xl p-3 text-sm font-semibold ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {msg.ok ? <FiCheckCircle className="mt-0.5 shrink-0" /> : <FiAlertCircle className="mt-0.5 shrink-0" />}<span>{msg.text}</span>
              </p>
            )}
          </div>

          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            Exports can contain customers' names, phone numbers and addresses. Keep the downloaded file private.
            Nested fields become columns like <code>address.city</code>; lists are written as JSON. Large exports can take a while — leave the page open.
          </p>
        </div>
      </main>
    </div>
  );
}
