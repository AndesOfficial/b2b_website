import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "../../firebase";

// First-purchase coupon codes for regular customers. A code gives one regular
// plan a lower price on the customer's first subscription only; renewals are
// at the plan's own price. The server checks the code (the app can't read this
// collection), so a code only works for the plan it is set on.

const MIN_PRICE = 49;
const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const CODE_RE = /^[A-Z0-9]{4,30}$/;

export default function SubscriptionCouponsPanel({ isViewer, plans }) {
  const [coupons, setCoupons] = useState(null);
  const [form, setForm] = useState({ code: "", planId: "", price: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onSnapshot(
    collection(db, "subscription_coupons"),
    (snap) => setCoupons(snap.docs.map((d) => ({ code: d.id, ...d.data() })).sort((a, b) => a.code.localeCompare(b.code))),
    (e) => { setCoupons([]); setError(e.message); },
  ), []);

  const planById = useMemo(() => Object.fromEntries((plans || []).map((p) => [p.id, p])), [plans]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const audit = (code, action, before, after) => ({
    kind: "subscription_coupon", target: `subscription_coupons/${code}`, action, before, after,
    by: auth.currentUser?.email || null, byUid: auth.currentUser?.uid || null, at: serverTimestamp(),
  });

  const save = async () => {
    const code = form.code.trim().toUpperCase();
    const price = Number(form.price);
    const plan = planById[form.planId];
    if (!CODE_RE.test(code)) return setError("The code is 4 to 30 letters or numbers, no spaces.");
    if (!plan) return setError("Pick the plan this code is for.");
    if (!(price >= MIN_PRICE)) return setError(`The price must be at least ${fmt(MIN_PRICE)}.`);
    if (!(price < Number(plan.price))) return setError(`The coupon price must be lower than the plan's price (${fmt(plan.price)}).`);
    if (coupons?.some((c) => c.code === code && c.planId !== plan.id) &&
      !window.confirm(`${code} already exists for another plan. Move it to this plan?`)) return;
    setBusy(true); setError("");
    try {
      const existing = coupons?.find((c) => c.code === code);
      const data = { planId: plan.id, price, active: true, label: plan.label || "", updatedAt: serverTimestamp() };
      const batch = writeBatch(db);
      if (existing) batch.update(doc(db, "subscription_coupons", code), data);
      else batch.set(doc(db, "subscription_coupons", code), { ...data, createdAt: serverTimestamp() });
      batch.set(doc(collection(db, "admin_settings_audit")), audit(code, existing ? "update" : "create", existing || null, { planId: plan.id, price, active: true }));
      await batch.commit();
      setForm({ code: "", planId: "", price: "" });
    } catch (e) {
      setError(e?.code === "permission-denied" ? "Couldn't save: your account isn't an admin, or a value is out of range." : e?.message || "Couldn't save.");
    } finally { setBusy(false); }
  };

  const toggle = async (c) => {
    setBusy(true); setError("");
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "subscription_coupons", c.code), { active: !(c.active === true), updatedAt: serverTimestamp() });
      batch.set(doc(collection(db, "admin_settings_audit")), audit(c.code, c.active ? "turn_off" : "turn_on", { active: c.active === true }, { active: !(c.active === true) }));
      await batch.commit();
    } catch (e) { setError(e?.message || "Couldn't update the coupon."); }
    finally { setBusy(false); }
  };

  const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none";
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-extrabold text-slate-900">First-purchase coupons</h2>
      <p className="mt-1 text-xs text-slate-500">
        A regular customer enters the code at checkout and pays the coupon price for that plan on their first subscription only.
        Renewals are at the plan's price. Add the plan's coupon price below (for example Basic ₹449 → ₹349).
      </p>

      {!isViewer && (
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <input className={input} placeholder="Code (e.g. HAPPYFAMILY349)" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} maxLength={30} />
          <select className={input} value={form.planId} onChange={set("planId")}>
            <option value="">Plan…</option>
            {(plans || []).map((p) => <option key={p.id} value={p.id}>{p.label || p.id} ({fmt(p.price)})</option>)}
          </select>
          <input className={input} type="number" min="0" placeholder="Price on first purchase (₹)" value={form.price} onChange={set("price")} />
          <button type="button" onClick={save} disabled={busy}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50">
            Save coupon
          </button>
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-700">{error}</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr><th className="py-2 pr-3">Code</th><th className="pr-3">Plan</th><th className="pr-3">Regular price</th><th className="pr-3">First purchase</th><th className="pr-3">Status</th><th /></tr>
          </thead>
          <tbody>
            {coupons === null && <tr><td colSpan={6} className="py-3 text-slate-500">Loading…</td></tr>}
            {coupons && coupons.length === 0 && <tr><td colSpan={6} className="py-3 text-slate-500">No coupons yet.</td></tr>}
            {(coupons || []).map((c) => {
              const plan = planById[c.planId];
              return (
                <tr key={c.code} className="border-t border-slate-100">
                  <td className="py-2 pr-3 font-mono font-bold tracking-wider text-slate-900">{c.code}</td>
                  <td className="pr-3 text-slate-700">{plan?.label || c.label || c.planId}</td>
                  <td className="pr-3 text-slate-500">{plan ? fmt(plan.price) : "—"}</td>
                  <td className="pr-3 font-bold text-emerald-700">{fmt(c.price)}</td>
                  <td className="pr-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                      {c.active ? "On" : "Off"}
                    </span>
                  </td>
                  <td className="text-right">
                    {!isViewer && (
                      <button type="button" onClick={() => toggle(c)} disabled={busy} className="text-xs font-bold text-blue-600">
                        {c.active ? "Turn off" : "Turn on"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
