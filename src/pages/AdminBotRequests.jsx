import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import AdminSidebar from "../components/Layout/AdminSidebar";
import AdminPageHeader from "../components/Layout/AdminPageHeader";
import SectionErrorBoundary from "../components/Shared/SectionErrorBoundary";
import { useHostelOrders } from "../context/HostelAuthContext";
import { db } from "../firebase";

// Requests created by the WhatsApp bot / AI-calling vendor through the Bot API:
// complaints, enquiries, support requests, and cancel / reschedule requests.
// Cancel and reschedule are only requests: the team does the change in the
// usual order screens, then marks the request done here.

const TYPES = {
  complaint: "Complaint",
  enquiry: "Enquiry",
  support_request: "Support",
  cancel_request: "Cancel order",
  reschedule_request: "Reschedule",
};
const STATUS_STYLE = {
  open: "bg-amber-50 text-amber-800 border-amber-200",
  done: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rejected: "bg-slate-100 text-slate-600 border-slate-200",
};

const fmt = (ts) => {
  const ms = ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;
  return ms
    ? new Date(ms).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })
    : "—";
};

function Row({ r, onSet, busy }) {
  const urgent = r.status === "open" && (r.type === "cancel_request" || r.type === "reschedule_request");
  return (
    <div className={`rounded-xl border bg-white p-4 ${urgent ? "border-amber-300" : "border-[#dfe8e2]"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-[#16654e] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">{TYPES[r.type] || r.type}</span>
        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_STYLE[r.status] || STATUS_STYLE.open}`}>{r.status || "open"}</span>
        <span className="text-xs text-[#58706a]">{fmt(r.createdAt)}</span>
        {!r.customerFound && r.customerFound !== undefined && <span className="text-xs font-semibold text-red-600">No customer account for this number</span>}
      </div>

      <div className="mt-2 text-sm text-[#172c28]">
        {r.message && <p className="whitespace-pre-wrap">{r.message}</p>}
        {r.reason && <p><b>Reason:</b> {r.reason}</p>}
        {r.type === "reschedule_request" && (
          <p><b>Wants {r.leg}</b> on <b>{r.requestedDate}</b>, slot <b>{r.requestedSlot}</b></p>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#58706a]">
        <a className="font-semibold text-[#172c28] underline" href={`tel:${r.phone}`}>{r.phone}</a>
        {r.orderId && <span>Order <code className="rounded bg-slate-100 px-1">{r.orderId}</code></span>}
        {r.category && <span>Category: {r.category}</span>}
        {r.handledAt && <span>Handled {fmt(r.handledAt)}{r.handledBy ? ` by ${r.handledBy}` : ""}</span>}
      </div>

      {r.status === "open" && (
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={busy} onClick={() => onSet(r, "done")}
            className="rounded-lg bg-[#16654e] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Mark done</button>
          <button type="button" disabled={busy} onClick={() => onSet(r, "rejected")}
            className="rounded-lg border border-[#dfe8e2] px-3 py-1.5 text-xs font-bold text-[#58706a] disabled:opacity-50">Reject</button>
        </div>
      )}
    </div>
  );
}

function BotRequestsList({ adminEmail }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("open");
  const [type, setType] = useState("all");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    const q = query(collection(db, "bot_requests"), orderBy("createdAt", "desc"), limit(200));
    return onSnapshot(
      q,
      (snap) => { setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setError(""); },
      (e) => setError(e.code === "permission-denied" ? "You don't have access to these requests." : "Could not load requests."),
    );
  }, []);

  const setStatus = useCallback(async (r, status) => {
    if (!window.confirm(`${status === "done" ? "Mark as done" : "Reject"} this ${TYPES[r.type] || "request"}?`)) return;
    setBusyId(r.id);
    try {
      await updateDoc(doc(db, "bot_requests", r.id), {
        status, handledAt: serverTimestamp(), handledBy: adminEmail || "admin",
      });
    } catch (e) {
      window.alert("Could not update the request.");
    } finally {
      setBusyId("");
    }
  }, [adminEmail]);

  const shown = useMemo(() => (rows || []).filter((r) =>
    (filter === "all" || (r.status || "open") === filter) && (type === "all" || r.type === type)), [rows, filter, type]);
  const openCount = (rows || []).filter((r) => (r.status || "open") === "open").length;

  if (error) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!rows) return <p className="text-sm text-[#58706a]">Loading…</p>;

  const pill = (active) => `rounded-full border px-3 py-1 text-xs font-bold ${active ? "border-[#16654e] bg-[#16654e] text-white" : "border-[#dfe8e2] bg-white text-[#58706a]"}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[["open", `Open (${openCount})`], ["done", "Done"], ["rejected", "Rejected"], ["all", "All"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={pill(filter === k)}>{l}</button>
        ))}
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="ml-auto rounded-lg border border-[#dfe8e2] bg-white px-2 py-1.5 text-xs font-semibold text-[#172c28]">
          <option value="all">All types</option>
          {Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#dfe8e2] p-8 text-center text-sm text-[#58706a]">Nothing here.</p>
      ) : (
        <div className="space-y-3">{shown.map((r) => <Row key={r.id} r={r} onSet={setStatus} busy={busyId === r.id} />)}</div>
      )}
    </div>
  );
}

export default function AdminBotRequests() {
  const navigate = useNavigate();
  const { client, logout } = useHostelOrders();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const onSidebar = useCallback((tab) => navigate("/admin", { state: { initialTab: tab } }), [navigate]);

  return (
    <div className="flex min-h-screen bg-[#f3f6f2]" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <AdminSidebar activeTab="botRequests" setActiveTab={onSidebar} user={client} onLogout={logout}
        isCollapsed={collapsed} setIsCollapsed={setCollapsed} isMobileOpen={mobileOpen} setIsMobileOpen={setMobileOpen} />
      <main className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ${collapsed ? "lg:ml-[80px]" : "lg:ml-[218px]"} ml-0`}>
        <AdminPageHeader
          title="Bot Requests"
          subtitle="Complaints, enquiries and cancel or reschedule requests from the WhatsApp bot and AI calls."
          onMenuClick={() => setMobileOpen(true)}
        />
        <div className="px-4 pb-10 pt-6 lg:px-10">
          <SectionErrorBoundary section="bot-requests" title="Bot requests could not be displayed">
            <BotRequestsList adminEmail={client && client.email} />
          </SectionErrorBoundary>
        </div>
      </main>
    </div>
  );
}
