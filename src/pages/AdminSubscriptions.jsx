import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { FiEdit2, FiEye, FiEyeOff, FiMenu, FiPlus, FiRepeat, FiX } from "react-icons/fi";
import { auth, db } from "../firebase";
import AdminSidebar from "../components/Layout/AdminSidebar";
import { useHostelAuth } from "../context/HostelAuthContext";

// Plans the user app offers (`subscription_plans`). The app reads active plans;
// the activateSubscription function checks the amount paid against `price`.
// Plans are never deleted: "Remove" hides a plan from the app (active: false),
// and payments already made for it still activate.

// Same limits as firestore.rules and activateSubscription.
const MIN_PRICE_PER_KG = 30;
const MAX_KG = 100;

const PLAN_FIELDS = ["label", "subtitle", "kg", "price", "originalPrice", "validityDays", "badge", "sortOrder", "active"];
const pick = (p) => (p ? Object.fromEntries(PLAN_FIELDS.filter((k) => p[k] !== undefined).map((k) => [k, p[k]])) : null);

/** Audit record written in the same batch as the plan change. */
function auditEntry(planId, action, before, after) {
  return {
    kind: "subscription_plan", target: `subscription_plans/${planId}`, action,
    before: pick(before), after: pick(after),
    by: auth.currentUser?.email || null, byUid: auth.currentUser?.uid || null, at: serverTimestamp(),
  };
}

const slug = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const num = (v) => (v === "" || v == null ? NaN : Number(v));
const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const perKg = (p) => {
  const kg = Number(p.kg), price = Number(p.price);
  return kg > 0 && price > 0 ? `₹${(price / kg).toFixed(2).replace(/\.?0+$/, "")}/kg` : "—";
};

const EMPTY = { label: "", subtitle: "Wash & Iron", kg: "", price: "", originalPrice: "", validityDays: "30", badge: "", sortOrder: "", active: true };

function PlanModal({ plan, nextOrder, onClose, onSaved }) {
  const isNew = !plan;
  const [form, setForm] = useState(() => plan
    ? {
        label: plan.label ?? "", subtitle: plan.subtitle ?? "", kg: plan.kg ?? "", price: plan.price ?? "",
        originalPrice: plan.originalPrice ?? "", validityDays: plan.validityDays ?? 30, badge: plan.badge ?? "",
        sortOrder: plan.sortOrder ?? "", active: plan.active !== false && plan.isActive !== false,
      }
    : { ...EMPTY, sortOrder: String(nextOrder) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = async () => {
    const kg = num(form.kg), price = num(form.price), validityDays = num(form.validityDays);
    const original = num(form.originalPrice);
    if (!(kg > 0)) return setError("Enter the kg included in the plan.");
    if (!(price > 0)) return setError("Enter a price above 0.");
    if (!(validityDays >= 1)) return setError("Validity must be at least 1 day.");
    if (!isNaN(original) && original < price) return setError("Original price can't be lower than the price (leave it empty for no strike-through).");
    if (kg > MAX_KG) return setError(`A plan can include at most ${MAX_KG} kg.`);
    if (validityDays > 365) return setError("Validity can be at most 365 days.");
    if (price < MIN_PRICE_PER_KG * kg) return setError(`Price must be at least ₹${MIN_PRICE_PER_KG}/kg (₹${MIN_PRICE_PER_KG * kg} for ${kg} kg).`);
    if (!isNew && Number(plan.price) > 0 && price < Number(plan.price) * 0.7 &&
      !window.confirm(`This cuts the price from ₹${plan.price} to ₹${price} (more than 30% off). Customers pay the new price straight away. Continue?`)) return;
    setSaving(true);
    setError("");
    try {
      const data = {
        label: String(form.label).trim() || `${kg} kg Plan`,
        subtitle: String(form.subtitle).trim() || "Wash & Iron",
        kg, price, validityDays: Math.round(validityDays),
        originalPrice: isNaN(original) ? price : original,
        badge: String(form.badge).trim(),
        sortOrder: isNaN(num(form.sortOrder)) ? nextOrder : num(form.sortOrder),
        active: !!form.active,
        updatedAt: serverTimestamp(),
      };
      const id = isNew ? `plan_${slug(data.label) || `${kg}kg`}_${Date.now().toString(36)}` : plan.id;
      const batch = writeBatch(db);
      if (isNew) batch.set(doc(db, "subscription_plans", id), { ...data, createdAt: serverTimestamp() });
      else batch.update(doc(db, "subscription_plans", id), data);
      batch.set(doc(collection(db, "admin_settings_audit")), auditEntry(id, isNew ? "create" : "update", plan, data));
      await batch.commit();
      onSaved();
    } catch (err) {
      setError(err?.code === "permission-denied"
        ? "Your account isn't allowed to edit plans. Ask an Andes admin for the admin role, then log out and back in."
        : err?.message || "Could not save the plan.");
      setSaving(false);
    }
  };

  const field = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500";
  const lab = "mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500";
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">{isNew ? "New subscription plan" : "Edit plan"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><FiX size={20} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className={lab}>Plan name</label><input className={field} value={form.label} onChange={set("label")} placeholder="e.g. 10 kg Plan" /></div>
          <div className="col-span-2"><label className={lab}>Subtitle</label><input className={field} value={form.subtitle} onChange={set("subtitle")} placeholder="Wash & Iron" /></div>
          <div><label className={lab}>Kg included</label><input className={field} type="number" min="0" step="0.5" value={form.kg} onChange={set("kg")} /></div>
          <div><label className={lab}>Validity (days)</label><input className={field} type="number" min="1" value={form.validityDays} onChange={set("validityDays")} /></div>
          <div><label className={lab}>Price (₹)</label><input className={field} type="number" min="0" value={form.price} onChange={set("price")} /></div>
          <div><label className={lab}>Original price (₹)</label><input className={field} type="number" min="0" value={form.originalPrice} onChange={set("originalPrice")} placeholder="optional" /></div>
          <div><label className={lab}>Badge</label><input className={field} value={form.badge} onChange={set("badge")} placeholder="e.g. Best value" /></div>
          <div><label className={lab}>Sort order</label><input className={field} type="number" value={form.sortOrder} onChange={set("sortOrder")} /></div>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={form.active} onChange={set("active")} /> Shown in the app
        </label>
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          Customers on older app versions still show the built-in prices. A price below the built-in one is accepted; a <b>higher</b> price
          makes activation fail for those users, so raise prices only once the new app is out.
        </p>
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">Cancel</button>
          <button type="button" disabled={saving} onClick={save} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSubscriptions() {
  const { client, logout, isViewer } = useHostelAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [plans, setPlans] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [editing, setEditing] = useState(undefined); // undefined: closed, null: new

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsSidebarCollapsed(mobile);
      if (!mobile) setIsMobileMenuOpen(false);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => onSnapshot(
    collection(db, "subscription_plans"),
    (snap) => setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => setLoadError(err.message),
  ), []);

  const sorted = useMemo(() => [...(plans || [])].sort(
    (a, b) => (Number(a.sortOrder) || 999) - (Number(b.sortOrder) || 999) || Number(a.kg) - Number(b.kg)), [plans]);
  const nextOrder = sorted.reduce((m, p) => Math.max(m, Number(p.sortOrder) || 0), 0) + 1;
  const isActive = (p) => p.active !== false && p.isActive !== false;

  const toggle = async (p) => {
    const hiding = isActive(p);
    if (hiding && !window.confirm(`Remove "${p.label || p.kg + " kg"}" from the app? Customers will no longer see it. Payments already made still activate.`)) return;
    setActionError("");
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "subscription_plans", p.id), { active: !hiding, updatedAt: serverTimestamp() });
      batch.set(doc(collection(db, "admin_settings_audit")),
        auditEntry(p.id, hiding ? "remove" : "restore", p, { ...pick(p), active: !hiding }));
      await batch.commit();
    }
    catch (err) { setActionError(err?.message || "Could not update the plan."); }
  };

  return (
    <div className="flex min-h-screen bg-[#F1F5F9]" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <AdminSidebar
        activeTab="subscriptions" setActiveTab={() => setIsMobileMenuOpen(false)} user={client} onLogout={logout}
        isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen} setIsMobileOpen={setIsMobileMenuOpen}
      />
      {editing !== undefined && (
        <PlanModal plan={editing} nextOrder={nextOrder} onClose={() => setEditing(undefined)} onSaved={() => setEditing(undefined)} />
      )}
      <main className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ${isSidebarCollapsed ? "lg:ml-[80px]" : "lg:ml-[220px]"} ml-0`}>
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-8">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setIsMobileMenuOpen(true)} aria-label="Open sidebar"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden">
                <FiMenu size={20} />
              </button>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Admin Portal</p>
                <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-slate-950">
                  <FiRepeat size={20} className="text-blue-500" /> Subscriptions
                </h1>
              </div>
            </div>
            {!isViewer && (
              <button type="button" onClick={() => setEditing(null)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-700">
                <FiPlus size={16} /> New plan
              </button>
            )}
          </div>
        </header>

        <div className="space-y-4 p-4 lg:p-8">
          {loadError && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Could not load plans: {loadError}</p>}
          {actionError && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{actionError}</p>}
          {plans && plans.length === 0 && !loadError && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No plans yet, so the app shows its built-in plans (5, 10 and 20 kg). Once any plan is saved here, the app
              shows only the plans listed on this page.
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((p) => {
              const active = isActive(p);
              const discounted = Number(p.originalPrice) > Number(p.price);
              return (
                <div key={p.id} className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${active ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">{p.label || `${p.kg} kg Plan`}</h3>
                      <p className="text-xs text-slate-500">{p.subtitle || "Wash & Iron"}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {active ? "Live" : "Removed"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900">{fmt(p.price)}</span>
                    {discounted && <span className="text-sm text-slate-400 line-through">{fmt(p.originalPrice)}</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{p.kg} kg · {p.validityDays || 30} days · {perKg(p)}</p>
                  {p.badge ? <p className="mt-2 inline-block rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{p.badge}</p> : null}
                  <p className="mt-2 text-[11px] text-slate-400">Order {p.sortOrder ?? "—"} · {p.id}</p>
                  {!isViewer && (
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={() => setEditing(p)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                        <FiEdit2 size={13} /> Edit
                      </button>
                      <button type="button" onClick={() => toggle(p)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                        {active ? <><FiEyeOff size={13} /> Remove</> : <><FiEye size={13} /> Restore</>}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
