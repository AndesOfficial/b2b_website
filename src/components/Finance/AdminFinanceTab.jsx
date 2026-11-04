import { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase";
import {
  AGEING_BUCKETS, ageing, cashBalance, dso, estimatedContribution, expenseTotals,
  invoiceOutstanding, invoicePaid, standardCostsOn, todayIst,
} from "../../metrics";
import { useDailyMetrics } from "../../hooks/useDailyMetrics";
import { AlertRulesEditor } from "../Dashboard/AlertStrip";
import { recordInvoicePayment, saveCashBalance, saveStandardCostsVersion, voidInvoice } from "../../api/financeApi";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const money = (n) => (n == null ? "—" : inr.format(n));
const card = "bg-white rounded-xl border border-gray-100 p-4 sm:p-5";
const input = "w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-500";
const btn = "px-3 py-2 rounded-lg text-[12px] font-bold bg-[#0F172A] text-white disabled:opacity-50";

function useCollection(q) {
  const [rows, setRows] = useState([]);
  useEffect(() => onSnapshot(q, (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => console.error("finance listener:", e)), [q]);
  return rows;
}

function Stat({ label, value, note }) {
  return (
    <div className={card}>
      <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">{label}</div>
      <div className="text-xl font-extrabold text-[#0F172A] mt-1">{value}</div>
      {note && <div className="text-[11px] text-[#64748B] mt-1">{note}</div>}
    </div>
  );
}

/** Money inputs for the dashboard: P&L vs cash, receivables, cash balance, standard costs. */
export default function AdminFinanceTab({ dateFrom, dateTo, isViewer, isAdmin }) {
  const today = todayIst();
  const from = dateFrom || `${today.slice(0, 8)}01`;
  const to = dateTo || today;

  const invoicesQ = useMemo(() => query(collection(db, "invoices"), orderBy("issuedDate", "desc")), []);
  const cashQ = useMemo(() => query(collection(db, "cash_balances"), orderBy("date", "desc"), limit(60)), []);
  const expensesQ = useMemo(() => collection(db, "b2b_expenses"), []);
  const invoices = useCollection(invoicesQ);
  const cashEntries = useCollection(cashQ);
  const expenses = useCollection(expensesQ);
  const [costConfig, setCostConfig] = useState(null);
  useEffect(() => onSnapshot(doc(db, "company_config", "standardCosts"), (s) => setCostConfig(s.data() || null)), []);
  const { totals, missingDays } = useDailyMetrics(from, to);

  const exp = useMemo(() => expenseTotals(expenses, from, to), [expenses, from, to]);
  const aged = useMemo(() => ageing(invoices, to), [invoices, to]);
  const cash = useMemo(() => cashBalance(cashEntries, to), [cashEntries, to]);
  const costs = standardCostsOn(costConfig, to);
  const contribution = totals ? estimatedContribution(totals, costs) : null;
  const daysOut = dso(invoices, to);

  return (
    <div className="space-y-5">
      <p className="text-[12px] text-[#64748B]">{from} → {to} · revenue from verified daily totals{missingDays?.length ? ` (${missingDays.length} days not computed yet)` : ""}</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Revenue (verified)" value={money(totals?.revenue)} />
        <Stat label="Expenses incurred" value={money(exp.incurred)} note={`Fixed ${money(exp.fixed)} · Variable ${money(exp.variable)}`} />
        <Stat label="Operating result" value={totals ? money(totals.revenue - exp.incurred) : "—"} note="Revenue − incurred expenses" />
        <Stat
          label="Contribution (estimated)"
          value={contribution?.status === "ok" ? money(contribution.value) : "N/A"}
          note={contribution?.status === "ok" ? `Standard variable costs ${money(contribution.variableCosts)}` : contribution?.reason || "Loading"}
        />
        <Stat label="Expenses paid (cash out)" value={money(exp.paid)} note={`Unpaid bills from period: ${money(exp.unpaid)}`} />
        <Stat label="Marketing spend" value={money(exp.marketing)} note="Expenses in the Marketing category" />
        <Stat label="Receivables" value={money(aged.total)} note={`Overdue ${money(aged.overdue)}${daysOut != null ? ` · DSO ${daysOut} days` : ""}`} />
        <Stat label="Cash balance" value={cash ? money(cash.total) : "Not entered"} note={cash ? `As of ${cash.date}` : "Add an opening balance below"} />
      </div>

      <Receivables invoices={invoices} aged={aged} asOf={to} isViewer={isViewer} />
      <div className="grid lg:grid-cols-2 gap-5">
        <CashBalances entries={cashEntries} isViewer={isViewer} />
        <StandardCosts config={costConfig} isViewer={isViewer} />
      </div>
      {isAdmin && <AlertRulesEditor />}
    </div>
  );
}

function Receivables({ invoices, aged, asOf, isViewer }) {
  const [paying, setPaying] = useState(null);
  const [form, setForm] = useState({ amount: "", date: asOf, method: "Bank transfer", note: "" });
  const [busy, setBusy] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const rows = invoices.filter((i) => showPaid || invoiceOutstanding(i) > 0);

  const pay = async () => {
    const amount = Number(form.amount);
    if (!(amount > 0)) return alert("Enter the amount received.");
    setBusy(true);
    try {
      await recordInvoicePayment(paying.invoiceNo, { ...form, amount });
      setPaying(null);
    } catch (e) {
      alert(`Could not record payment: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-[15px] font-bold text-[#0F172A]">Receivables</h3>
        <label className="text-[12px] text-[#64748B] flex items-center gap-1">
          <input type="checkbox" checked={showPaid} onChange={(e) => setShowPaid(e.target.checked)} /> Show paid & void
        </label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {AGEING_BUCKETS.map((b) => (
          <div key={b} className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-[#64748B]">{b} days</div>
            <div className="font-bold">{money(aged[b])}</div>
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px] text-[#64748B]">No open invoices. Invoices appear here when their PDF is generated.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[11px] uppercase text-[#94A3B8]">
              <tr><th className="py-2">Invoice</th><th>Client</th><th>Issued</th><th>Due</th><th className="text-right">Amount</th><th className="text-right">Paid</th><th className="text-right">Outstanding</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const overdue = invoiceOutstanding(i) > 0 && i.dueDate && i.dueDate < asOf;
                return (
                  <tr key={i.id} className="border-t border-gray-100">
                    <td className="py-2 font-semibold">{i.invoiceNo}{i.status === "void" && <span className="ml-1 text-[11px] text-rose-600">void</span>}</td>
                    <td>{i.client}</td>
                    <td>{i.issuedDate}</td>
                    <td className={overdue ? "text-rose-600 font-semibold" : ""}>{i.dueDate}</td>
                    <td className="text-right">{money(i.amount)}</td>
                    <td className="text-right">{money(invoicePaid(i))}</td>
                    <td className="text-right font-semibold">{money(invoiceOutstanding(i))}</td>
                    <td className="text-right whitespace-nowrap">
                      {!isViewer && invoiceOutstanding(i) > 0 && (
                        <>
                          <button className="text-[12px] font-bold text-blue-600 mr-3" onClick={() => { setPaying(i); setForm({ amount: String(invoiceOutstanding(i)), date: asOf, method: "Bank transfer", note: "" }); }}>Record payment</button>
                          <button className="text-[12px] text-gray-400" onClick={() => { const r = window.prompt(`Void invoice ${i.invoiceNo}? Reason:`); if (r) voidInvoice(i.invoiceNo, r); }}>Void</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {paying && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 grid sm:grid-cols-5 gap-2 items-end">
          <div className="sm:col-span-5 text-[13px] font-semibold">Payment for {paying.invoiceNo} · {paying.client}</div>
          <input className={input} type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount" />
          <input className={input} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <select className={input} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            {["Bank transfer", "UPI", "Cash", "Cheque"].map((m) => <option key={m}>{m}</option>)}
          </select>
          <input className={input} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Reference / note" />
          <div className="flex gap-2">
            <button className={btn} disabled={busy} onClick={pay}>Save</button>
            <button className="text-[12px]" onClick={() => setPaying(null)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

const ACCOUNTS = ["bank", "upi", "cash"];

function CashBalances({ entries, isViewer }) {
  const [form, setForm] = useState({ date: todayIst(), bank: "", upi: "", cash: "", note: "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await saveCashBalance(form.date, Object.fromEntries(ACCOUNTS.map((a) => [a, form[a]])), form.note);
      setForm({ ...form, bank: "", upi: "", cash: "", note: "" });
    } catch (e) {
      alert(`Could not save: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={card}>
      <h3 className="text-[15px] font-bold text-[#0F172A] mb-1">Cash balance</h3>
      <p className="text-[12px] text-[#64748B] mb-3">Opening balance per account for a day. The latest entry is the cash balance.</p>
      {!isViewer && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          <input className={input} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          {ACCOUNTS.map((a) => (
            <input key={a} className={input} type="number" value={form[a]} onChange={(e) => setForm({ ...form, [a]: e.target.value })} placeholder={a.toUpperCase()} />
          ))}
          <input className={input} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note" />
          <button className={btn} disabled={busy} onClick={save}>Save balance</button>
        </div>
      )}
      <table className="w-full text-[13px]">
        <tbody>
          {entries.slice(0, 7).map((e) => (
            <tr key={e.id} className="border-t border-gray-100">
              <td className="py-1.5">{e.date}</td>
              {ACCOUNTS.map((a) => <td key={a} className="text-right text-[#64748B]">{money(e.accounts?.[a] || 0)}</td>)}
              <td className="text-right font-semibold">{money(Object.values(e.accounts || {}).reduce((s, v) => s + Number(v || 0), 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const COST_FIELDS = [
  ["perKg", "Processing ₹ per kg"],
  ["packagingPerOrder", "Packaging ₹ per order"],
  ["deliveryPerStop", "Delivery ₹ per stop (2 per order)"],
  ["paymentFeePct", "Payment gateway fee %"],
];

function StandardCosts({ config, isViewer }) {
  const current = standardCostsOn(config, todayIst());
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const edit = () => setForm({
    effectiveFrom: todayIst(),
    perKg: current?.perKg?.default ?? "",
    packagingPerOrder: current?.packagingPerOrder ?? "",
    deliveryPerStop: current?.deliveryPerStop ?? "",
    paymentFeePct: current?.paymentFeePct ?? "",
  });
  const save = async () => {
    setBusy(true);
    try {
      await saveStandardCostsVersion({
        effectiveFrom: form.effectiveFrom,
        perKg: { default: Number(form.perKg) || 0 },
        packagingPerOrder: Number(form.packagingPerOrder) || 0,
        deliveryPerStop: Number(form.deliveryPerStop) || 0,
        paymentFeePct: Number(form.paymentFeePct) || 0,
      });
      setForm(null);
    } catch (e) {
      alert(`Could not save: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={card}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[15px] font-bold text-[#0F172A]">Standard costs</h3>
        {!isViewer && !form && <button className="text-[12px] font-bold text-blue-600" onClick={edit}>New version</button>}
      </div>
      <p className="text-[12px] text-[#64748B] mb-3">Variable cost estimates used for contribution. Fixed costs (rent, salaries) are never spread per kg or order.</p>
      {form ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[12px] col-span-2">Effective from
            <input className={input} type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
          </label>
          {COST_FIELDS.map(([k, label]) => (
            <label key={k} className="text-[12px]">{label}
              <input className={input} type="number" min="0" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </label>
          ))}
          <div className="col-span-2 flex gap-2">
            <button className={btn} disabled={busy} onClick={save}>Save version</button>
            <button className="text-[12px]" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      ) : current ? (
        <dl className="text-[13px] grid grid-cols-2 gap-y-1">
          <dt className="text-[#64748B]">In force since</dt><dd>{current.effectiveFrom}</dd>
          <dt className="text-[#64748B]">Processing</dt><dd>₹{current.perKg?.default}/kg</dd>
          <dt className="text-[#64748B]">Packaging</dt><dd>₹{current.packagingPerOrder}/order</dd>
          <dt className="text-[#64748B]">Delivery</dt><dd>₹{current.deliveryPerStop}/stop</dd>
          <dt className="text-[#64748B]">Gateway fee</dt><dd>{current.paymentFeePct}%</dd>
        </dl>
      ) : (
        <p className="text-[13px] text-amber-700">Not set — contribution shows N/A until a version is saved.</p>
      )}
    </section>
  );
}
