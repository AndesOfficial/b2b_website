import { useState } from "react";
import { collection, getDocs, orderBy, query, Timestamp, where } from "firebase/firestore";
import { FiDownload, FiX } from "react-icons/fi";
import { db } from "../../firebase";

// Exports every order document in `cartdetails` placed (createdAt, IST) on a day
// or within a date range, with the full order details.

const IST = "+05:30";
const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

const isTs = (v) => v && typeof v === "object" && typeof v.toDate === "function";
const fmtTs = (v) => {
  const d = isTs(v) ? v.toDate() : v instanceof Date ? v : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19);
};
const toJson = (v) => JSON.stringify(v, (_k, val) => (isTs(val) ? fmtTs(val) : val));
// Any value -> plain text for one CSV cell
const str = (v) => {
  if (v === null || v === undefined) return "";
  if (isTs(v)) return fmtTs(v);
  if (typeof v === "object") return toJson(v);
  return String(v);
};
// Keeps spreadsheets from running text as a formula
const cell = (v) => {
  let s = str(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
const servicesText = (s) => {
  if (!s || typeof s !== "object") return str(s);
  return Object.entries(s).map(([k, q]) => `${k} x${str(q)}`).join("; ");
};
const addressText = (a) => {
  if (!a || typeof a !== "object") return str(a);
  return [a.fullAddress, a.address, a.line1, a.line2, a.landmark, a.city, a.pincode].filter(Boolean).join(", ") || toJson(a);
};

const COLUMNS = [
  ["Order ID", (o) => o.id],
  ["Order No", (o) => o.orderNumber],
  ["Placed At (IST)", (o) => fmtTs(o.createdAt) || fmtTs(o.orderTimestamp ? new Date(Number(o.orderTimestamp)) : null)],
  ["Status", (o) => o.status],
  ["Customer", (o) => o.userName || o.customerName],
  ["Mobile", (o) => o.userMobile || o.customerNumber || o.userPhone],
  ["User ID", (o) => o.userId],
  ["Address", (o) => addressText(o.address)],
  ["Pickup", (o) => str(o.pickupTime)],
  ["Drop", (o) => str(o.dropTime)],
  ["Services", (o) => servicesText(o.services)],
  ["Total Items", (o) => o.totalItems],
  ["Original Total", (o) => o.originalTotalCost],
  ["Wallet Used", (o) => o.walletAmountUsed],
  ["Amount To Pay", (o) => o.totalCost],
  ["Delivery Charge", (o) => o.deliveryCharge],
  ["Convenience Fee", (o) => o.convenienceFee],
  ["Other Charges", (o) => o.otherCharges],
  ["Rider Tip", (o) => o.riderTip],
  ["Coupon", (o) => o.couponCode],
  ["Coupon Discount", (o) => o.couponDiscount],
  ["Promotion Discount", (o) => o.promotionDiscount],
  ["Payment Method", (o) => o.paymentMethod],
  ["Payment Status", (o) => o.paymentStatus],
  ["Payment ID", (o) => o.paymentId],
  ["Payment Recorded At (IST)", (o) => fmtTs(o.paymentRecordedAt)],
  ["Pickup Rider", (o) => o.pickupRiderName],
  ["Delivery Rider", (o) => o.riderName],
  ["Delivery Date", (o) => str(o.deliveryDate)],
  ["Express Delivery", (o) => (o.ultraFastDelivery ? "Yes" : "")],
  ["Full Record (JSON)", (o) => { const { id, ...rest } = o; return toJson(rest); }],
];

function download(rows, filename) {
  const bom = String.fromCharCode(0xfeff);
  const head = COLUMNS.map(([h]) => cell(h)).join(",");
  const body = rows.map((o) => COLUMNS.map(([, f]) => cell(f(o))).join(","));
  const blob = new Blob([bom + [head, ...body].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function CartDetailsExport({ defaultFrom, defaultTo }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(defaultFrom || todayIST());
  const [to, setTo] = useState(defaultTo || todayIST());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // {ok, text}

  const openPanel = () => {
    setFrom(defaultFrom || todayIST());
    setTo(defaultTo || todayIST());
    setMsg(null);
    setOpen(true);
  };

  const run = async () => {
    if (!from || !to) { setMsg({ ok: false, text: "Pick both dates." }); return; }
    if (from > to) { setMsg({ ok: false, text: "The start date is after the end date." }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const start = Timestamp.fromDate(new Date(`${from}T00:00:00${IST}`));
      const end = Timestamp.fromDate(new Date(`${to}T23:59:59.999${IST}`));
      const snap = await getDocs(query(
        collection(db, "cartdetails"),
        where("createdAt", ">=", start),
        where("createdAt", "<=", end),
        orderBy("createdAt", "asc"),
      ));
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!rows.length) { setMsg({ ok: false, text: "No orders were placed in that period." }); return; }
      download(rows, from === to ? `orders_${from}.csv` : `orders_${from}_to_${to}.csv`);
      setMsg({ ok: true, text: `Downloaded ${rows.length} order${rows.length === 1 ? "" : "s"}.` });
    } catch (err) {
      console.error("CartDetailsExport:", err);
      setMsg({ ok: false, text: err?.message || "Export failed." });
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-400";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPanel}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
      >
        <FiDownload size={14} />
        Export Orders
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-black text-slate-500 uppercase tracking-widest">Export all orders</span>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700"><FiX size={14} /></button>
            </div>
            <p className="text-[11px] text-slate-400">Every order placed in this period, from the app's order records. For one day, pick the same date twice.</p>
            <label className="block text-[11px] font-bold text-slate-500">From
              <input type="date" className={`${input} mt-1`} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="block text-[11px] font-bold text-slate-500">To
              <input type="date" className={`${input} mt-1`} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={run}
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? "Fetching orders…" : "Download CSV"}
            </button>
            {msg && <p className={`text-[12px] font-semibold ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
          </div>
        </>
      )}
    </div>
  );
}
