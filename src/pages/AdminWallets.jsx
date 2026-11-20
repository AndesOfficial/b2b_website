import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import {
  FiAlertCircle, FiCheckCircle, FiDownload, FiMenu, FiMinus, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiX,
} from "react-icons/fi";
import { MdOutlineAccountBalanceWallet } from "react-icons/md";
import { functions } from "../firebase";
import AdminSidebar from "../components/Layout/AdminSidebar";
import { useHostelAuth } from "../context/HostelAuthContext";

// Customer wallets: look up, add or take money, clear (one, some or all), see
// every transaction and how it got there, and export it all as CSV.
// Wallets can change only in Cloud Functions, so everything goes through the
// admin* callables in the customer functions project.

const call = (name, data) => httpsCallable(functions, name, { timeout: 300000 })(data).then((r) => r.data);

const inr = (n) => `₹${(Math.round(Number(n || 0) * 100) / 100).toLocaleString("en-IN")}`;
const fmtDate = (ms) => (ms
  ? new Date(ms).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
  : "—");
const isoDate = (ms) => (ms ? new Date(ms + 330 * 60000).toISOString().replace("T", " ").slice(0, 19) : "");

/** How a ledger entry got into (or out of) the wallet, in plain words. */
function howLabel(t) {
  switch (t.source) {
    case "topup": return "PhonePe top-up";
    case "spend": return "Paid for an order";
    case "refund": return "Refund";
    case "cashback": return "Cashback";
    case "referral": return "Referral bonus";
    case "campaign": return "Society offer";
    case "bonus": return "Promotional credit (taken back)";
    case "adjustment": return "Adjustment";
    case "admin_credit": return "Added by admin";
    case "admin_debit": return "Removed by admin";
    case "admin_clear": return "Cleared by admin";
    default: return t.source || t.description || "—";
  }
}

const detailOf = (t) => [
  t.description,
  t.orderId && `Order ${t.orderId}`,
  t.merchantTransactionId && `PhonePe ${t.merchantTransactionId}`,
  t.byAdmin && `By ${t.byAdmin}`,
  t.reversed && "Taken back",
].filter(Boolean).join(" · ");

/* ---------------- CSV ---------------- */

// Text that starts with = + - @ would run as a formula in Excel; a leading
// apostrophe keeps it as plain text (names and notes are customer-typed).
const cell = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function downloadCsv(filename, rows) {
  // A byte-order mark so Excel reads the ₹ and any non-English names correctly.
  const text = String.fromCharCode(0xfeff) + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const stamp = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 16).replace(/[-:T]/g, "");

const BALANCE_HEAD = ["Customer ID", "Name", "Mobile", "Email", "Balance (INR)", "Wallet created", "Last updated"];
const balanceRow = (w) => [w.uid, w.name, w.mobile, w.email, w.balance, isoDate(w.createdAtMs), isoDate(w.updatedAtMs)];

const LEDGER_HEAD = [
  "Customer ID", "Name", "Mobile", "Email", "Current balance (INR)",
  "Date (IST)", "Credit/Debit", "Amount (INR)", "How it was added", "Source code", "Details", "Order ID", "PhonePe transaction ID", "By admin", "Taken back",
];
function ledgerRows(w, transactions) {
  const head = [w.uid, w.name, w.mobile, w.email, w.balance];
  if (!transactions.length) return [[...head, "", "", "", "", "", "", "", "", "", ""]];
  return transactions.map((t) => [
    ...head, isoDate(t.timestampMs), t.type, t.type === "debit" ? -t.amount : t.amount, howLabel(t), t.source,
    t.description, t.orderId, t.merchantTransactionId, t.byAdmin, t.reversed ? "yes" : "",
  ]);
}

/* ---------------- small UI pieces ---------------- */

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4">
      <div className={`my-8 w-full ${wide ? "max-w-3xl" : "max-w-md"} space-y-4 rounded-2xl bg-white p-5 shadow-xl`}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 hover:bg-slate-100"><FiX /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const field = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm";
const btn = "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors disabled:opacity-50";

function AdjustModal({ wallet, mode, onClose, onDone }) {
  const credit = mode === "credit";
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const value = Number(amount);

  const submit = async (e) => {
    e.preventDefault();
    if (!(value > 0)) return setError("Enter an amount above 0.");
    if (!credit && value > wallet.balance) return setError(`The wallet only has ${inr(wallet.balance)}.`);
    if (!window.confirm(`${credit ? "Add" : "Take"} ${inr(value)} ${credit ? "to" : "from"} ${wallet.name || wallet.uid}'s wallet?`)) return;
    setBusy(true);
    setError("");
    try {
      const r = await call("adminWalletAdjust", { uid: wallet.uid, type: mode, amount: value, note });
      onDone(`${credit ? "Added" : "Took"} ${inr(value)}. New balance ${inr(r.balance)}.`, wallet.uid, r.balance);
    } catch (err) {
      setError(err.message || "Could not save.");
      setBusy(false);
    }
  };

  return (
    <Modal title={`${credit ? "Add money to" : "Take money from"} ${wallet.name || "wallet"}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-xs text-slate-500">Current balance <b>{inr(wallet.balance)}</b>{wallet.mobile ? ` · ${wallet.mobile}` : ""}</p>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Amount (₹)</label>
          <input className={field} type="number" min="1" step="0.01" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Reason (shown in their history)</label>
          <input className={field} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={credit ? "Goodwill credit" : "Correction"} />
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy}
          className={`${btn} w-full justify-center py-2.5 text-white ${credit ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"}`}>
          {busy ? "Saving…" : credit ? "Add money" : "Take money"}
        </button>
      </form>
    </Modal>
  );
}

/** Clears the given wallets (balance → ₹0), 100 per call, with a typed confirmation. */
function ClearModal({ targets, label, onClose, onDone }) {
  const withMoney = targets.filter((w) => w.balance > 0);
  const total = withMoney.reduce((s, w) => s + w.balance, 0);
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const run = async () => {
    setBusy(true);
    setError("");
    const out = { cleared: [], skipped: [], failed: [] };
    try {
      for (let i = 0; i < withMoney.length; i += 100) {
        const chunk = withMoney.slice(i, i + 100).map((w) => w.uid);
        const r = await call("adminWalletClear", { uids: chunk, note });
        out.cleared.push(...r.cleared);
        out.skipped.push(...r.skipped);
        out.failed.push(...r.failed);
        setProgress(Math.min(i + 100, withMoney.length));
      }
    } catch (err) {
      setError(`${err.message || "Stopped."} Some wallets may already be cleared — reload to see them.`);
    }
    setResult(out);
    setBusy(false);
    onDone(out);
  };

  if (result) {
    const sum = result.cleared.reduce((s, c) => s + c.amount, 0);
    return (
      <Modal title="Done" onClose={onClose}>
        <p className="text-sm text-slate-700">Cleared <b>{result.cleared.length}</b> wallet{result.cleared.length === 1 ? "" : "s"}, {inr(sum)} in total.</p>
        {result.skipped.length > 0 && <p className="text-xs text-slate-500">{result.skipped.length} already had ₹0.</p>}
        {result.failed.length > 0 && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{result.failed.length} could not be cleared: {result.failed.slice(0, 3).map((f) => f.error).join("; ")}</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="button" onClick={onClose} className={`${btn} w-full justify-center bg-slate-900 text-white`}>Close</button>
      </Modal>
    );
  }

  return (
    <Modal title={`Clear ${label}`} onClose={busy ? () => {} : onClose}>
      <div className="space-y-3 text-sm">
        <p className="rounded-lg bg-red-50 p-3 text-xs text-red-800">
          This sets <b>{withMoney.length}</b> wallet{withMoney.length === 1 ? "" : "s"} to ₹0 and removes <b>{inr(total)}</b> from customers. Each one gets a "Cleared by admin" entry in its history. It can't be undone automatically — you would have to add the money back by hand.
        </p>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Reason (shown in their history)</label>
          <input className={field} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wallet cleared by Andes support" disabled={busy} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Type CLEAR to confirm</label>
          <input className={field} value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy} />
        </div>
        {busy && <p className="text-xs text-slate-500">Clearing… {progress} of {withMoney.length}</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="button" disabled={busy || typed !== "CLEAR" || withMoney.length === 0} onClick={run}
          className={`${btn} w-full justify-center bg-red-600 py-2.5 text-white hover:bg-red-700`}>
          <FiTrash2 /> {busy ? "Clearing…" : `Clear ${withMoney.length} wallet${withMoney.length === 1 ? "" : "s"}`}
        </button>
        {withMoney.length === 0 && <p className="text-xs text-slate-500">None of these wallets has money.</p>}
      </div>
    </Modal>
  );
}

function HistoryModal({ wallet, onClose, onAdjust, onClear, toast }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    call("adminWalletHistory", { uid: wallet.uid })
      .then((r) => live && setData(r))
      .catch((e) => live && setError(e.message || "Could not load."));
    return () => { live = false; };
  }, [wallet.uid, wallet.balance]);

  const current = data?.wallet || wallet;
  const exportOne = () => {
    downloadCsv(`wallet_${(current.name || current.uid).replace(/[^a-zA-Z0-9]+/g, "_")}_${stamp()}.csv`, [LEDGER_HEAD, ...ledgerRows(current, data.transactions)]);
    toast("success", "Downloaded this customer's wallet and history.");
  };

  return (
    <Modal title={current.name || "Customer wallet"} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div><div className="text-slate-400">Mobile</div><div className="font-bold">{current.mobile || "—"}</div></div>
        <div><div className="text-slate-400">Email</div><div className="truncate font-bold">{current.email || "—"}</div></div>
        <div><div className="text-slate-400">Customer ID</div><div className="truncate font-mono text-[10px]">{current.uid}</div></div>
        <div><div className="text-slate-400">Balance</div><div className="text-lg font-black text-emerald-600">{inr(current.balance)}</div></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onAdjust(current, "credit")} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}><FiPlus /> Add money</button>
        <button type="button" onClick={() => onAdjust(current, "debit")} className={`${btn} bg-amber-600 text-white hover:bg-amber-700`}><FiMinus /> Take money</button>
        <button type="button" disabled={!(current.balance > 0)} onClick={() => onClear([current], `${current.name || "this"} wallet`)} className={`${btn} border border-red-200 text-red-600 hover:bg-red-50`}><FiTrash2 /> Clear wallet</button>
        <button type="button" disabled={!data} onClick={exportOne} className={`${btn} ml-auto border border-slate-200 text-slate-700 hover:bg-slate-50`}><FiDownload /> Download CSV</button>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="text-sm text-slate-500">Loading history…</p>}
      {data && (
        <div className="max-h-[50vh] overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">How</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Details</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.transactions.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">No transactions yet.</td></tr>}
              {data.transactions.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtDate(t.timestampMs)}</td>
                  <td className="px-3 py-2 font-semibold text-slate-800">{howLabel(t)}</td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right font-mono font-bold ${t.type === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                    {t.type === "credit" ? "+" : "−"}{inr(t.amount)}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{detailOf(t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.truncated && <p className="p-3 text-center text-[11px] text-amber-700">Showing the latest 1,000 entries.</p>}
        </div>
      )}
    </Modal>
  );
}

/* ---------------- page ---------------- */

const PAGE = 100;

export default function AdminWallets() {
  const navigate = useNavigate();
  const { client, logout, isViewer } = useHostelAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [wallets, setWallets] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState(() => new Set());
  const [viewing, setViewing] = useState(null);
  const [adjusting, setAdjusting] = useState(null); // { wallet, mode }
  const [clearing, setClearing] = useState(null); // { targets, label }
  const [exporting, setExporting] = useState(null); // progress text
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

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
      metaleads: "/admin/meta-leads", coupons: "/admin/coupons", dataExport: "/admin/data-export",
    };
    if (tab === "wallets") return;
    if (routes[tab]) { navigate(routes[tab]); return; }
    navigate("/admin", { state: { initialTab: tab } });
  }, [navigate]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    setLoadedCount(0);
    try {
      const all = [];
      let after = null;
      do {
        const r = await call("adminListWallets", { pageSize: 200, after });
        all.push(...r.wallets);
        setLoadedCount(all.length);
        after = r.next;
      } while (after);
      all.sort((a, b) => (a.name || "~").localeCompare(b.name || "~") || a.uid.localeCompare(b.uid));
      setWallets(all);
      setSelected(new Set());
    } catch (e) {
      setError(e.message || "Could not load wallets.");
    }
    setLoading(false);
  }, []);

  const filtered = useMemo(() => {
    if (!wallets) return [];
    const q = search.trim().toLowerCase();
    // Amount search: "250" (exact), ">100", ">=100", "<50", "<=50", "100-500" (range); ₹ and commas ignored.
    const a = q.replace(/[₹,\s]/g, "");
    let amountTest = null;
    let m;
    if ((m = a.match(/^(>=|<=|>|<)(\d+(?:\.\d+)?)$/))) {
      const n = Number(m[2]);
      amountTest = { ">": (b) => b > n, "<": (b) => b < n, ">=": (b) => b >= n, "<=": (b) => b <= n }[m[1]];
    } else if ((m = a.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/))) {
      const lo = Math.min(Number(m[1]), Number(m[2]));
      const hi = Math.max(Number(m[1]), Number(m[2]));
      amountTest = (b) => b >= lo && b <= hi;
    } else if (/^\d+(?:\.\d+)?$/.test(a)) {
      const n = Number(a);
      amountTest = (b) => b === n;
    }
    return wallets.filter((w) => {
      if (filter === "money" && !(w.balance > 0)) return false;
      if (filter === "zero" && w.balance > 0) return false;
      if (!q) return true;
      if (amountTest && amountTest(Number(w.balance) || 0)) return true;
      return [w.name, w.mobile, w.email, w.uid].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [wallets, search, filter]);

  const stats = useMemo(() => {
    const list = wallets || [];
    const withMoney = list.filter((w) => w.balance > 0);
    return { count: list.length, withMoney: withMoney.length, total: withMoney.reduce((s, w) => s + w.balance, 0) };
  }, [wallets]);

  // Keep the list in step after a change, without reloading everything.
  const patchBalance = (uid, balance) => setWallets((cur) => cur && cur.map((w) => (w.uid === uid ? { ...w, balance } : w)));
  const onAdjusted = (message, uid, balance) => {
    patchBalance(uid, balance);
    setAdjusting(null);
    showToast("success", message);
  };
  const onCleared = (out) => {
    const done = new Set(out.cleared.map((c) => c.uid));
    setWallets((cur) => cur && cur.map((w) => (done.has(w.uid) ? { ...w, balance: 0 } : w)));
    setSelected(new Set());
    if (out.cleared.length) showToast("success", `Cleared ${out.cleared.length} wallet${out.cleared.length === 1 ? "" : "s"}.`);
  };

  const toggle = (uid) => setSelected((cur) => { const n = new Set(cur); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });
  const allShownSelected = filtered.slice(0, shown).length > 0 && filtered.slice(0, shown).every((w) => selected.has(w.uid));
  const selectedWallets = (wallets || []).filter((w) => selected.has(w.uid));

  const exportBalances = (list, name) => {
    downloadCsv(`${name}_${stamp()}.csv`, [BALANCE_HEAD, ...list.map(balanceRow)]);
    showToast("success", `Downloaded ${list.length} wallet${list.length === 1 ? "" : "s"}.`);
  };

  const exportWithHistory = async (list, name) => {
    const rows = [LEDGER_HEAD];
    const byUid = new Map(list.map((w) => [w.uid, w]));
    try {
      for (let i = 0; i < list.length; i += 25) {
        setExporting(`Reading transactions… ${Math.min(i + 25, list.length)} of ${list.length} wallets`);
        const r = await call("adminWalletExport", { uids: list.slice(i, i + 25).map((w) => w.uid) });
        r.wallets.forEach((x) => rows.push(...ledgerRows(byUid.get(x.uid), x.transactions)));
      }
      downloadCsv(`${name}_${stamp()}.csv`, rows);
      showToast("success", `Downloaded ${list.length} wallets with their transactions.`);
    } catch (e) {
      showToast("error", `Export stopped: ${e.message || "error"}`);
    }
    setExporting(null);
  };

  const noAccess = isViewer;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]" style={{ fontFamily: "DM Sans, sans-serif" }}>
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-semibold shadow-2xl ${toast.type === "error" ? "bg-red-600 text-white" : "bg-slate-900 text-white"}`}>
          {toast.type === "error" ? <FiAlertCircle size={18} /> : <FiCheckCircle size={18} className="text-emerald-400" />}
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="ml-2 text-white/70 hover:text-white"><FiX size={16} /></button>
        </div>
      )}

      <AdminSidebar activeTab="wallets" setActiveTab={onSidebar} issuesCount={0} user={client} onLogout={logout}
        isCollapsed={collapsed} setIsCollapsed={setCollapsed} isMobileOpen={mobileOpen} setIsMobileOpen={setMobileOpen} />

      <main className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ${collapsed ? "lg:ml-[80px]" : "lg:ml-[220px]"}`}>
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open navigation menu"><FiMenu size={22} /></button>
            <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600"><MdOutlineAccountBalanceWallet size={20} /></span>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Customer Wallets</h1>
              <p className="mt-0.5 text-xs text-slate-500">Add or clear wallet money, see every transaction, and export to CSV.</p>
            </div>
          </div>
          <button type="button" disabled={loading || noAccess} onClick={loadAll} className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>
            <FiRefreshCw className={loading ? "animate-spin" : ""} /> {wallets ? "Reload" : "Load wallets"}
          </button>
        </header>

        <div className="mx-auto w-full max-w-7xl space-y-5 p-6">
          {noAccess && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Wallet tools are for admin accounts only.</p>}
          {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

          {!wallets && !noAccess && (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <p className="text-sm font-bold text-slate-800">{loading ? `Loading wallets… ${loadedCount}` : "Wallets are not loaded yet"}</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">Loading reads every customer wallet and its owner's name once, so it starts when you press the button, not on its own.</p>
              {!loading && <button type="button" onClick={loadAll} className={`${btn} mt-4 bg-blue-600 text-white hover:bg-blue-700`}>Load wallets</button>}
            </div>
          )}

          {wallets && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[["Wallets", stats.count], ["With money", stats.withMoney], ["Total in wallets", inr(stats.total)]].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200/70 bg-white p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
                    <div className="mt-1 text-2xl font-black text-slate-900">{value}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[220px] flex-1">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input className={`${field} pl-9`} placeholder="Search name, mobile, email, ID or amount (250, >100, 100-500)" value={search} onChange={(e) => { setSearch(e.target.value); setShown(PAGE); }} />
                  </div>
                  <select className={`${field} !w-auto`} value={filter} onChange={(e) => { setFilter(e.target.value); setShown(PAGE); }}>
                    <option value="all">All wallets</option>
                    <option value="money">With money</option>
                    <option value="zero">Empty</option>
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Export</span>
                  <button type="button" disabled={!!exporting} onClick={() => exportBalances(wallets, "wallet_balances_all")} className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`}><FiDownload /> All balances</button>
                  <button type="button" disabled={!!exporting} onClick={() => exportWithHistory(wallets, "wallets_with_transactions_all")} className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`}><FiDownload /> All with transactions</button>
                  {selected.size > 0 && (
                    <>
                      <button type="button" disabled={!!exporting} onClick={() => exportBalances(selectedWallets, "wallet_balances_selected")} className={`${btn} border border-blue-200 text-blue-700 hover:bg-blue-50`}><FiDownload /> Selected balances ({selected.size})</button>
                      <button type="button" disabled={!!exporting} onClick={() => exportWithHistory(selectedWallets, "wallets_with_transactions_selected")} className={`${btn} border border-blue-200 text-blue-700 hover:bg-blue-50`}><FiDownload /> Selected with transactions</button>
                    </>
                  )}
                  {exporting && <span className="text-xs text-slate-500">{exporting}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Clear</span>
                  <button type="button" disabled={selected.size === 0} onClick={() => setClearing({ targets: selectedWallets, label: `${selected.size} selected wallet${selected.size === 1 ? "" : "s"}` })}
                    className={`${btn} border border-red-200 text-red-600 hover:bg-red-50`}><FiTrash2 /> Clear selected ({selected.size})</button>
                  <button type="button" disabled={stats.withMoney === 0} onClick={() => setClearing({ targets: wallets, label: "ALL wallets" })}
                    className={`${btn} bg-red-600 text-white hover:bg-red-700`}><FiTrash2 /> Clear ALL wallets ({stats.withMoney} with money)</button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Select all shown" checked={allShownSelected}
                        onChange={(e) => setSelected((cur) => { const n = new Set(cur); filtered.slice(0, shown).forEach((w) => (e.target.checked ? n.add(w.uid) : n.delete(w.uid))); return n; })} /></th>
                      <th className="px-4 py-3">Customer</th><th className="px-4 py-3">Mobile</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No wallets match.</td></tr>}
                    {filtered.slice(0, shown).map((w) => (
                      <tr key={w.uid} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3"><input type="checkbox" checked={selected.has(w.uid)} onChange={() => toggle(w.uid)} aria-label={`Select ${w.name || w.uid}`} /></td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => setViewing(w)} className="text-left font-bold text-slate-900 hover:text-blue-600">{w.name || <span className="font-normal text-slate-400">(no name)</span>}</button>
                          <div className="text-[10px] text-slate-400">{w.email || w.uid}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{w.mobile || "—"}</td>
                        <td className={`px-4 py-3 text-right font-mono font-bold ${w.balance > 0 ? "text-emerald-600" : "text-slate-400"}`}>{inr(w.balance)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button type="button" onClick={() => setViewing(w)} className="rounded-lg px-2 py-1 font-bold text-slate-600 hover:bg-slate-100">History</button>
                          <button type="button" onClick={() => setAdjusting({ wallet: w, mode: "credit" })} className="rounded-lg px-2 py-1 font-bold text-emerald-600 hover:bg-emerald-50">Add</button>
                          <button type="button" disabled={!(w.balance > 0)} onClick={() => setClearing({ targets: [w], label: `${w.name || "this"} wallet` })} className="rounded-lg px-2 py-1 font-bold text-red-600 hover:bg-red-50 disabled:opacity-30">Clear</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length > shown && (
                  <div className="border-t border-slate-100 p-3 text-center">
                    <button type="button" onClick={() => setShown((n) => n + PAGE)} className={`${btn} text-blue-600 hover:bg-blue-50`}>Show more ({filtered.length - shown} left)</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {viewing && (
        <HistoryModal wallet={viewing} toast={showToast} onClose={() => setViewing(null)}
          onAdjust={(w, mode) => setAdjusting({ wallet: w, mode })}
          onClear={(targets, label) => setClearing({ targets, label })} />
      )}
      {adjusting && (
        <AdjustModal wallet={adjusting.wallet} mode={adjusting.mode} onClose={() => setAdjusting(null)}
          onDone={(message, uid, balance) => {
            onAdjusted(message, uid, balance);
            setViewing((v) => (v && v.uid === uid ? { ...v, balance } : v));
          }} />
      )}
      {clearing && (
        <ClearModal targets={clearing.targets} label={clearing.label} onClose={() => setClearing(null)}
          onDone={(out) => {
            onCleared(out);
            setViewing((v) => (v && out.cleared.some((c) => c.uid === v.uid) ? { ...v, balance: 0 } : v));
          }} />
      )}
    </div>
  );
}
