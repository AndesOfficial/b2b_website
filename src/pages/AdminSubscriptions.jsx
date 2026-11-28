import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, deleteField, doc, limit, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { FiClock, FiEdit2, FiMenu, FiPlus, FiRepeat, FiTrash2, FiX } from "react-icons/fi";
import { auth, db, functions } from "../firebase";
import AdminSidebar from "../components/Layout/AdminSidebar";
import StallCodesPanel from "../components/Services/StallCodesPanel";
import SubscriptionCouponsPanel from "../components/Services/SubscriptionCouponsPanel";
import SubscriptionHeroImage from "../components/Services/SubscriptionHeroImage";
import { uploadServiceImage } from "../utils/serviceCatalog";
import { useHostelAuth } from "../context/HostelAuthContext";

// Plans the user app offers (`subscription_plans`). The app reads active plans;
// the activateSubscription function checks the amount paid against `price`.
// The on/off switch hides a plan from the app (active: false), and payments
// already made for it still activate. Delete goes through the server
// (requestPlanDeletionOtp, then confirmPlanDeletion): an approver from the
// owner's list gets a WhatsApp code, the plan is marked deleted (kept so
// in-flight payments still activate) and subscription_plan_deletions keeps
// who, why, who told them, who approved and the full plan.

const callFn = (name, data) => httpsCallable(functions, name)(data).then((r) => r.data);
const tsText = (t) => {
  const d = t?.toDate ? t.toDate() : null;
  return d ? d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
};

// Same limits as firestore.rules and activateSubscription.
const MIN_PRICE = 49;
const MIN_PRICE_PER_KG = 30;
const MIN_PRICE_PER_PIECE = 5;
const MAX_KG = 100;
const MAX_PIECES = 200;

export const PLAN_KINDS = [
  { value: "kg", label: "Kg services", hint: "Laundry by weight" },
  { value: "piece", label: "Piece services", hint: "Iron, dry cleaning, shoes" },
  { value: "both", label: "Both", hint: "Kg + pieces in one plan" },
];
export const KG_SERVICES = [
  { value: "wash_iron", label: "Wash & Iron" },
  { value: "wash_fold", label: "Wash & Fold" },
];
export const PIECE_SERVICES = [
  { value: "iron", label: "Iron", unit: "pieces" },
  { value: "dry_cleaning", label: "Dry Cleaning", unit: "pieces" },
  { value: "shoe_cleaning", label: "Shoe Cleaning", unit: "pairs" },
];
const KG_LABEL = Object.fromEntries(KG_SERVICES.map((s) => [s.value, s.label]));

const PLAN_FIELDS = ["label", "subtitle", "kind", "kg", "kgService", "pieces", "pickups", "maxKgPerPickup", "turnaroundHours",
  "highlights", "price", "originalPrice", "validityDays", "badge", "sortOrder", "active", "imageUrl"];
const pick = (p) => (p ? Object.fromEntries(PLAN_FIELDS.filter((k) => p[k] !== undefined).map((k) => [k, p[k]])) : null);

/** Audit record written in the same batch as the plan change. */
function auditEntry(planId, action, before, after, coll = "subscription_plans") {
  return {
    kind: coll === "society_plans" ? "society_plan" : "subscription_plan", target: `${coll}/${planId}`, action,
    before: pick(before), after: pick(after),
    by: auth.currentUser?.email || null, byUid: auth.currentUser?.uid || null, at: serverTimestamp(),
  };
}

const slug = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const num = (v) => (v === "" || v == null ? NaN : Number(v));
const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const kindOf = (p) => (["kg", "piece", "both"].includes(p?.kind) ? p.kind : "kg");

/** "10 kg Wash & Iron", "20 Iron pieces + 2 Dry Cleaning": what the plan includes. */
export function planIncludes(p) {
  const kind = kindOf(p);
  const parts = [];
  if (kind !== "piece" && Number(p.kg) > 0) parts.push(`${p.kg} kg ${KG_LABEL[p.kgService] || "Wash & Iron"}`);
  if (kind !== "kg") {
    for (const s of PIECE_SERVICES) {
      const n = Number(p.pieces?.[s.value]) || 0;
      if (n > 0) parts.push(`${n} ${s.label} ${n === 1 ? s.unit.replace(/s$/, "") : s.unit}`);
    }
  }
  return parts;
}

/** "2 pickups a week", or "Unlimited pickups". */
export function pickupText(p) {
  const n = Number(p?.pickups?.count) || 0;
  if (!n) return "Unlimited pickups";
  return `${n} pickup${n === 1 ? "" : "s"} a ${p.pickups.per === "week" ? "week" : "month"}`;
}

/** The rules every customer is shown, worked out from the plan's own fields. */
export function planRules(p) {
  const days = Number(p.validityDays) || 30;
  const rules = [
    `Valid for ${days} days from the day you buy it.`,
    `${pickupText(p)}${Number(p?.pickups?.count) ? ` (${p.pickups.per === "week" ? "Monday to Sunday" : "calendar month"}).` : "."}`,
  ];
  if (Number(p.maxKgPerPickup) > 0) rules.push(`Up to ${p.maxKgPerPickup} kg per pickup.`);
  if (Number(p.turnaroundHours) > 0) rules.push(`Clothes back within ${p.turnaroundHours} hours of pickup.`);
  rules.push("Anything beyond the plan, or a service it doesn't include, is billed at the normal price.");
  rules.push("Instant (express) and Premium services aren't included.");
  rules.push("Unused kg, pieces and pickups don't carry over to the next plan.");
  return rules;
}

const minPriceFor = (kind, kg, pieces) => {
  const totalPieces = kind === "kg" ? 0 : Object.values(pieces).reduce((s, n) => s + (Number(n) || 0), 0);
  return Math.max(MIN_PRICE, MIN_PRICE_PER_KG * (kind === "piece" ? 0 : kg) + MIN_PRICE_PER_PIECE * totalPieces);
};

const EMPTY = {
  label: "", subtitle: "", kind: "kg", kg: "", kgService: "wash_iron",
  pieces: { iron: "", dry_cleaning: "", shoe_cleaning: "" },
  pickupCount: "", pickupPer: "month", maxKgPerPickup: "", turnaroundHours: "", highlights: "",
  price: "", originalPrice: "", validityDays: "30", badge: "", sortOrder: "", active: true,
};

function PlanModal({ plan, nextOrder, onClose, onSaved, collectionName = "subscription_plans" }) {
  const isSociety = collectionName === "society_plans";
  const isNew = !plan;
  const [form, setForm] = useState(() => plan
    ? {
        label: plan.label ?? "", subtitle: plan.subtitle ?? "", kind: kindOf(plan),
        kg: plan.kg ?? "", kgService: plan.kgService === "wash_fold" ? "wash_fold" : "wash_iron",
        pieces: Object.fromEntries(PIECE_SERVICES.map((s) => [s.value, plan.pieces?.[s.value] ?? ""])),
        pickupCount: plan.pickups?.count ?? "", pickupPer: plan.pickups?.per === "week" ? "week" : "month",
        maxKgPerPickup: plan.maxKgPerPickup ?? "", turnaroundHours: plan.turnaroundHours ?? "",
        highlights: Array.isArray(plan.highlights) ? plan.highlights.join("\n") : "", imageUrl: plan.imageUrl ?? "",
        price: plan.price ?? "", originalPrice: plan.originalPrice ?? "", validityDays: plan.validityDays ?? 30,
        badge: plan.badge ?? "", sortOrder: plan.sortOrder ?? "", active: plan.active !== false && plan.isActive !== false,
      }
    : { ...EMPTY, sortOrder: String(nextOrder) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const imagePreview = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : form.imageUrl || ""), [imageFile, form.imageUrl]);
  const pickImage = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type)) return setError("Choose an image file (PNG with a transparent background looks best).");
    if (f.size > 8 * 1024 * 1024) return setError("That image is too large. Use one under 8 MB.");
    setError(""); setImageFile(f);
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setPiece = (k) => (e) => setForm((f) => ({ ...f, pieces: { ...f.pieces, [k]: e.target.value } }));

  const kind = form.kind;
  const usesKg = kind !== "piece";
  const usesPieces = kind !== "kg";
  const piecesNum = Object.fromEntries(PIECE_SERVICES.map((s) => [s.value, usesPieces ? Math.floor(Number(form.pieces[s.value]) || 0) : 0]));
  const kgNum = usesKg ? num(form.kg) : 0;
  const floor = minPriceFor(kind, Number(kgNum) || 0, piecesNum);
  const preview = {
    kind, kg: kgNum, kgService: form.kgService, pieces: piecesNum,
    pickups: Number(form.pickupCount) > 0 ? { count: Number(form.pickupCount), per: form.pickupPer } : null,
    maxKgPerPickup: num(form.maxKgPerPickup), turnaroundHours: num(form.turnaroundHours), validityDays: num(form.validityDays),
  };

  const save = async () => {
    const price = num(form.price), validityDays = num(form.validityDays), original = num(form.originalPrice);
    const pickupCount = form.pickupCount === "" ? 0 : num(form.pickupCount);
    const maxKg = form.maxKgPerPickup === "" ? null : num(form.maxKgPerPickup);
    const turnaround = form.turnaroundHours === "" ? null : num(form.turnaroundHours);
    const highlights = String(form.highlights).split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 6).map((s) => s.slice(0, 80));
    const totalPieces = Object.values(piecesNum).reduce((s, n) => s + n, 0);

    if (usesKg && !(kgNum > 0)) return setError("Enter the kg included in the plan.");
    if (usesKg && kgNum > MAX_KG) return setError(`A plan can include at most ${MAX_KG} kg.`);
    if (usesPieces && totalPieces === 0) return setError("Enter how many pieces of at least one piece service the plan includes.");
    if (Object.values(piecesNum).some((n) => n < 0 || n > MAX_PIECES)) return setError(`Each piece service can include 0 to ${MAX_PIECES} pieces.`);
    if (!(validityDays >= 1 && validityDays <= 365)) return setError("Validity must be 1 to 365 days.");
    if (!(pickupCount >= 0 && pickupCount <= 60 && Number.isInteger(pickupCount))) return setError("Pickups must be a whole number from 0 (no limit) to 60.");
    if (maxKg !== null && !(maxKg > 0 && maxKg <= 100)) return setError("Max kg per pickup must be between 1 and 100, or empty.");
    if (turnaround !== null && !(turnaround >= 6 && turnaround <= 240)) return setError("Turnaround must be 6 to 240 hours, or empty.");
    if (!(price > 0)) return setError("Enter a price above 0.");
    if (price < floor) return setError(`Price must be at least ₹${floor} for what this plan includes.`);
    if (!isNaN(original) && original < price) return setError("Original price can't be lower than the price (leave it empty for no strike-through).");
    if (!isNew && Number(plan.price) > 0 && price < Number(plan.price) * 0.7 &&
      !window.confirm(`This cuts the price from ₹${plan.price} to ₹${price} (more than 30% off). Customers pay the new price straight away. Continue?`)) return;

    setSaving(true);
    setError("");
    try {
      const includes = planIncludes({ ...preview, kg: kgNum });
      let imageUrl = form.imageUrl || "";
      if (imageFile) imageUrl = await uploadServiceImage(imageFile, `plan-${slug(String(form.label)) || kind}`);
      const data = {
        label: String(form.label).trim() || includes[0] || "Subscription plan",
        subtitle: String(form.subtitle).trim() || includes.join(" + "),
        kind,
        kg: usesKg ? kgNum : 0,
        kgService: form.kgService,
        pieces: piecesNum,
        pickups: pickupCount > 0 ? { count: pickupCount, per: form.pickupPer } : null,
        maxKgPerPickup: usesKg ? maxKg : null,
        turnaroundHours: turnaround,
        highlights,
        imageUrl,
        price, validityDays: Math.round(validityDays),
        originalPrice: isNaN(original) ? price : original,
        badge: String(form.badge).trim(),
        sortOrder: isNaN(num(form.sortOrder)) ? nextOrder : num(form.sortOrder),
        active: !!form.active,
        updatedAt: serverTimestamp(),
      };
      const id = isNew ? `${isSociety ? "soc" : "plan"}_${slug(data.label) || kind}_${Date.now().toString(36)}` : plan.id;
      const batch = writeBatch(db);
      if (isNew) batch.set(doc(db, collectionName, id), { ...data, createdAt: serverTimestamp() });
      else batch.update(doc(db, collectionName, id), data);
      batch.set(doc(collection(db, "admin_settings_audit")), auditEntry(id, isNew ? "create" : "update", plan, data, collectionName));
      await batch.commit();
      onSaved();
    } catch (err) {
      setError(err?.code === "permission-denied"
        ? "Couldn't save: either your account isn't an admin, or the plan breaks a limit (price floor, kg or piece counts)."
        : err?.message || "Could not save the plan.");
      setSaving(false);
    }
  };

  const field = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500";
  const lab = "mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500";
  const section = "mt-5 border-t border-slate-100 pt-4";
  const chip = (on) => `rounded-xl border px-3 py-2 text-left text-sm ${on ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`;
  const includes = planIncludes(preview);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">{isNew ? (isSociety ? "New society plan" : "New subscription plan") : (isSociety ? "Edit society plan" : "Edit plan")}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><FiX size={20} /></button>
        </div>

        <label className={lab}>What the plan covers</label>
        <div className="grid grid-cols-3 gap-2">
          {PLAN_KINDS.map((k) => (
            <button key={k.value} type="button" className={chip(kind === k.value)} onClick={() => setForm((f) => ({ ...f, kind: k.value }))}>
              <span className="block font-bold">{k.label}</span>
              <span className="block text-[11px] opacity-70">{k.hint}</span>
            </button>
          ))}
        </div>

        {usesKg && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lab}>Kg service</label>
              <div className="grid grid-cols-2 gap-2">
                {KG_SERVICES.map((s) => (
                  <button key={s.value} type="button" className={chip(form.kgService === s.value)} onClick={() => setForm((f) => ({ ...f, kgService: s.value }))}>
                    <span className="font-bold">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div><label className={lab}>Kg included</label><input className={field} type="number" min="0" step="0.5" value={form.kg} onChange={set("kg")} /></div>
            <div><label className={lab}>Max kg per pickup</label><input className={field} type="number" min="0" step="0.5" value={form.maxKgPerPickup} onChange={set("maxKgPerPickup")} placeholder="no limit" /></div>
          </div>
        )}

        {usesPieces && (
          <div className="mt-4">
            <label className={lab}>Pieces included per service (0 = not included)</label>
            <div className="grid grid-cols-3 gap-3">
              {PIECE_SERVICES.map((s) => (
                <div key={s.value}>
                  <span className="mb-1 block text-xs font-semibold text-slate-600">{s.label} ({s.unit})</span>
                  <input className={field} type="number" min="0" max={MAX_PIECES} step="1" value={form.pieces[s.value]} onChange={setPiece(s.value)} placeholder="0" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={section}>
          <label className={lab}>Pickups</label>
          <div className="grid grid-cols-3 gap-3">
            <input className={field} type="number" min="0" max="60" step="1" value={form.pickupCount} onChange={set("pickupCount")} placeholder="0 = unlimited" />
            <select className={field} value={form.pickupPer} onChange={set("pickupPer")}>
              <option value="week">per week</option>
              <option value="month">per month</option>
            </select>
            <input className={field} type="number" min="6" max="240" step="1" value={form.turnaroundHours} onChange={set("turnaroundHours")} placeholder="Turnaround (hours)" />
          </div>
        </div>

        <div className={`${section} grid grid-cols-2 gap-3`}>
          <div className="col-span-2"><label className={lab}>Plan name</label><input className={field} value={form.label} onChange={set("label")} placeholder={includes[0] || "e.g. 10 kg Plan"} /></div>
          <div className="col-span-2"><label className={lab}>Subtitle</label><input className={field} value={form.subtitle} onChange={set("subtitle")} placeholder={includes.join(" + ") || "Wash & Iron"} /></div>
          <div><label className={lab}>Price (₹)</label><input className={field} type="number" min="0" value={form.price} onChange={set("price")} /><span className="mt-1 block text-[11px] text-slate-400">At least ₹{floor}</span></div>
          <div><label className={lab}>Original price (₹)</label><input className={field} type="number" min="0" value={form.originalPrice} onChange={set("originalPrice")} placeholder="optional" /></div>
          <div><label className={lab}>Validity (days)</label><input className={field} type="number" min="1" max="365" value={form.validityDays} onChange={set("validityDays")} /></div>
          <div><label className={lab}>Badge</label><input className={field} value={form.badge} onChange={set("badge")} placeholder="e.g. Best value" /></div>
          <div><label className={lab}>Sort order</label><input className={field} type="number" value={form.sortOrder} onChange={set("sortOrder")} /></div>
          <div className="col-span-2">
            <label className={lab}>Card picture (optional)</label>
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {imagePreview ? <img src={imagePreview} alt="" className="h-full w-full object-contain" /> : <span className="px-1 text-center text-[10px] text-slate-400">App default</span>}
              </div>
              <div className="space-y-1">
                <label className="inline-block cursor-pointer rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50">
                  {imagePreview ? "Change picture" : "Upload picture"}
                  <input type="file" accept="image/*" className="hidden" onChange={pickImage} />
                </label>
                {imagePreview && (
                  <button type="button" onClick={() => { setImageFile(null); setForm((f) => ({ ...f, imageUrl: "" })); }}
                    className="ml-2 text-xs font-bold text-slate-500 hover:text-red-600">Use app default</button>
                )}
                <p className="text-[11px] text-slate-400">Shown on the right of this plan's card in the app. A PNG with a transparent background looks best. Leave it empty to use the app's picture.</p>
              </div>
            </div>
          </div>
          <div className="col-span-2">
            <label className={lab}>Extra highlights (one per line, up to 6)</label>
            <textarea className={field} rows={3} value={form.highlights} onChange={set("highlights")} placeholder={"Free pickup and delivery\nPriority handling"} />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">What customers will see</p>
          <p className="font-bold text-slate-900">Includes: {includes.join(" + ") || "—"}</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-slate-600">
            {String(form.highlights).split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 6).map((h) => <li key={`h-${h}`}>{h}</li>)}
            {planRules(preview).map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={form.active} onChange={set("active")} /> Shown in the app
        </label>
        {isSociety ? (
          <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
            Society plans are shown only to customers who signed up with a society stall code and haven't bought a plan yet.
            Set the original price to the regular plan's price so they see the saving. After this first plan they renew on the regular plans.
          </p>
        ) : null}
        <p className={`mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 ${isSociety ? "hidden" : ""}`}>
          The current app only knows kg plans: it shows piece and "both" plans properly after the next app update. Raising the price of
          one of the 3 built-in plans makes payment activation fail on older apps, so raise those only once the new app is out.
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

/**
 * Master switch for selling subscriptions: store_settings/config
 * subscriptions_enabled, the field the user app reads. Off hides the Subscribe
 * screen's buy button and the Profile tile for customers without a plan;
 * customers with an active plan keep it and can still book pickups.
 * The app also honours subscriptions_paused_until (a timed pause), so the
 * state shown here matches what the app does.
 */
function SubscriptionsMasterSwitch({ isViewer }) {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onSnapshot(doc(db, "store_settings", "config"), (snap) => {
    const d = snap.data() || {};
    const until = d.subscriptions_paused_until?.toDate ? d.subscriptions_paused_until.toDate() : null;
    setCfg({ enabled: d.subscriptions_enabled === true, until });
  }, (e) => setError(e.message)), []);

  if (!cfg) return error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null;

  const pauseOver = !cfg.enabled && cfg.until && cfg.until <= new Date();
  const on = cfg.enabled || pauseOver;
  const status = on
    ? "On: customers can see and buy plans."
    : cfg.until
      ? `Paused until ${cfg.until.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}. It turns back on by itself then.`
      : "Off: customers can't see or buy plans. Customers who already have a plan keep it.";

  const flip = async () => {
    const next = !on;
    if (!window.confirm(next
      ? "Turn subscriptions ON? Customers on the latest app can see and buy plans straight away."
      : "Turn subscriptions OFF? The Subscribe screen and Profile tile disappear for customers without a plan. Customers who already have one keep it and can still book pickups.")) return;
    setSaving(true); setError("");
    try {
      const batch = writeBatch(db);
      // Clearing the pause date makes the switch the only thing that decides.
      batch.set(doc(db, "store_settings", "config"),
        { subscriptions_enabled: next, subscriptions_paused_until: deleteField(), updatedAt: serverTimestamp() }, { merge: true });
      batch.set(doc(collection(db, "admin_settings_audit")), {
        kind: "subscriptions_switch", target: "store_settings/config", action: next ? "turn_on" : "turn_off",
        before: { subscriptions_enabled: cfg.enabled, subscriptions_paused_until: cfg.until ? cfg.until.toISOString() : null },
        after: { subscriptions_enabled: next, subscriptions_paused_until: null },
        by: auth.currentUser?.email || null, byUid: auth.currentUser?.uid || null, at: serverTimestamp(),
      });
      await batch.commit();
    } catch (e) {
      setError(e?.code === "permission-denied"
        ? "Your account can't change store settings. Only the owner accounts can turn subscriptions on or off."
        : e?.message || "Couldn't save.");
    }
    setSaving(false);
  };

  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 shadow-sm ${on ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"}`}>
      <div className="min-w-0">
        <h2 className="text-base font-extrabold text-slate-900">Subscriptions in the app</h2>
        <p className="text-sm text-slate-600">{status}</p>
        {error && <p className="mt-1 text-sm font-semibold text-red-700">{error}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold ${on ? "text-emerald-700" : "text-slate-500"}`}>{on ? "On" : "Off"}</span>
        <button
          type="button" role="switch" aria-checked={on} aria-label={on ? "Turn subscriptions off" : "Turn subscriptions on"}
          disabled={isViewer || saving} onClick={flip}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${on ? "bg-emerald-500" : "bg-slate-300"}`}
        >
          <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-7" : "translate-x-0.5"}`} />
        </button>
      </div>
    </div>
  );
}

/** Who / why / who told you / approver, then the approver's WhatsApp code. */
function DeleteModal({ plan, defaultName, onClose }) {
  const [step, setStep] = useState("details"); // details → code → done
  const [approvers, setApprovers] = useState(null);
  const [form, setForm] = useState({ deletedByName: defaultName || "", reason: "", authorizedBy: "", approverIndex: "" });
  const [request, setRequest] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const name = plan.label || `${plan.kg} kg plan`;

  useEffect(() => {
    callFn("getPlanDeletionApprovers", {})
      .then((r) => setApprovers(r.approvers || []))
      .catch((e) => { setApprovers([]); setError(e?.message || "Couldn't load approvers."); });
  }, []);

  const sendCode = async () => {
    if (form.deletedByName.trim().length < 2) return setError("Enter your name.");
    if (form.reason.trim().length < 5) return setError("Enter why this plan is being deleted.");
    if (form.authorizedBy.trim().length < 2) return setError("Enter who told you to delete it.");
    if (form.approverIndex === "") return setError("Pick who should approve this.");
    setBusy(true); setError("");
    try {
      const r = await callFn("requestPlanDeletionOtp", {
        planId: plan.id, deletedByName: form.deletedByName, reason: form.reason,
        authorizedBy: form.authorizedBy, approverIndex: Number(form.approverIndex),
      });
      setRequest(r); setStep("code");
    } catch (e) { setError(e?.message || "Couldn't send the code."); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!/^\d{6}$/.test(code.trim())) return setError("Enter the 6-digit code.");
    setBusy(true); setError("");
    try {
      const r = await callFn("confirmPlanDeletion", { requestId: request.requestId, code: code.trim() });
      setResult(r); setStep("done");
    } catch (e) { setError(e?.message || "Couldn't delete the plan."); }
    finally { setBusy(false); }
  };

  const input = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Delete plan</h2>
            <p className="text-sm text-slate-500">{name} · {fmt(plan.price)} · {plan.id}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><FiX size={18} /></button>
        </div>

        {step === "details" && (
          <div className="mt-4 space-y-3">
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              The plan leaves this page and the app for good and can't be turned back on. Customers who already have it keep it until it runs out.
            </p>
            <label className="block text-xs font-bold text-slate-600">Your name
              <input className={input} value={form.deletedByName} onChange={set("deletedByName")} maxLength={80} />
            </label>
            <label className="block text-xs font-bold text-slate-600">Why are you deleting it?
              <textarea className={input} rows={3} value={form.reason} onChange={set("reason")} maxLength={500} />
            </label>
            <label className="block text-xs font-bold text-slate-600">Who told you to delete it?
              <input className={input} value={form.authorizedBy} onChange={set("authorizedBy")} maxLength={80} />
            </label>
            <label className="block text-xs font-bold text-slate-600">Send the approval code to
              <select className={input} value={form.approverIndex} onChange={set("approverIndex")} disabled={!approvers}>
                <option value="">{approvers === null ? "Loading…" : approvers.length ? "Pick an approver" : "No approvers set up"}</option>
                {(approvers || []).map((a) => <option key={a.index} value={a.index}>{a.name} ({a.phone})</option>)}
              </select>
            </label>
          </div>
        )}

        {step === "code" && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-700">
              A 6-digit code was sent on WhatsApp to <b>{request.approverName}</b> ({request.approverPhone}). Ask them for it. It works for 10 minutes.
            </p>
            <input className={`${input} text-center text-lg tracking-[0.4em]`} inputMode="numeric" maxLength={6}
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••••" autoFocus />
          </div>
        )}

        {step === "done" && (
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <p className="font-bold text-emerald-700">"{name}" is deleted.</p>
            {result?.activeSubscribers > 0 && (
              <p>{result.activeSubscribers} customer{result.activeSubscribers === 1 ? " has" : "s have"} this plan and keep{result.activeSubscribers === 1 ? "s" : ""} it until it runs out.</p>
            )}
            <p className="text-xs text-slate-500">It's recorded in Deletion history below.</p>
          </div>
        )}

        {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-700">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          {step !== "done" && (
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
          )}
          {step === "details" && (
            <button type="button" onClick={sendCode} disabled={busy || !approvers?.length}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
              {busy ? "Sending…" : "Send code"}
            </button>
          )}
          {step === "code" && (
            <button type="button" onClick={confirm} disabled={busy}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
              {busy ? "Deleting…" : "Delete plan"}
            </button>
          )}
          {step === "done" && (
            <button type="button" onClick={onClose} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Close</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminSubscriptions() {
  const { client, logout, isViewer } = useHostelAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  // Leaving this page from the sidebar: tabs with their own page go there,
  // the rest open on the main dashboard (same as the Wallets page).
  const onSidebar = useCallback((tab) => {
    setIsMobileMenuOpen(false);
    const routes = {
      services: "/admin/services", b2b: "/admin/b2b-orders", regular: "/admin/regular-orders", investors: "/admin/investors",
      expenses: "/admin/expenses", salaries: "/admin/salaries", calculator: "/admin/calculator", dailyReport: "/admin/daily-report",
      metaleads: "/admin/meta-leads", coupons: "/admin/coupons", dataExport: "/admin/data-export", wallets: "/admin/wallets",
    };
    if (tab === "subscriptions") return;
    if (routes[tab]) { navigate(routes[tab]); return; }
    navigate("/admin", { state: { initialTab: tab } });
  }, [navigate]);
  const [plans, setPlans] = useState(null);
  const [societyPlans, setSocietyPlans] = useState(null);
  const [section, setSection] = useState("regular"); // regular | society
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [editing, setEditing] = useState(undefined); // undefined: closed, null: new
  const [busyId, setBusyId] = useState(null); // plan whose on/off switch is saving
  const [deleting, setDeleting] = useState(null); // plan in the delete dialog
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => onSnapshot(
    query(collection(db, "subscription_plan_deletions"), orderBy("deletedAt", "desc"), limit(50)),
    (snap) => setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => setHistoryError(err.message),
  ), []);

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

  useEffect(() => onSnapshot(
    collection(db, "society_plans"),
    (snap) => setSocietyPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => setLoadError(err.message),
  ), []);

  const isSocietySection = section === "society";
  const coll = isSocietySection ? "society_plans" : "subscription_plans";
  // Deleted plans stay in Firestore (for in-flight payments) but not on this page.
  const byOrder = (list) => (list || []).filter((p) => p.deleted !== true && !p.movedTo).sort(
    (a, b) => (Number(a.sortOrder) || 999) - (Number(b.sortOrder) || 999) || Number(a.kg) - Number(b.kg));
  const regularSorted = useMemo(() => byOrder(plans), [plans]);
  const societySorted = useMemo(() => byOrder(societyPlans), [societyPlans]);
  const sorted = isSocietySection ? societySorted : regularSorted;
  const nextOrder = sorted.reduce((m, p) => Math.max(m, Number(p.sortOrder) || 0), 0) + 1;
  const isActive = (p) => p.active !== false && p.isActive !== false;

  const toggle = async (p) => {
    const hiding = isActive(p);
    if (hiding && !window.confirm(`Turn off "${p.label || p.kg + " kg"}"? Customers will no longer see it in the app. Payments already made still activate.`)) return;
    setActionError("");
    setBusyId(p.id);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, coll, p.id), { active: !hiding, updatedAt: serverTimestamp() });
      batch.set(doc(collection(db, "admin_settings_audit")),
        auditEntry(p.id, hiding ? "turn_off" : "turn_on", p, { ...pick(p), active: !hiding }, coll));
      await batch.commit();
    }
    catch (err) { setActionError(err?.message || "Could not update the plan."); }
    finally { setBusyId(null); }
  };

  // Moves a plan to the other section: a copy goes into the other collection
  // (society plans need a soc_ id, which is how the server tells them apart)
  // and the original is switched off and hidden. Customers who already hold
  // the plan keep it, and payments already started for it still activate.
  const movePlan = async (p) => {
    const toSociety = !isSocietySection;
    const dest = toSociety ? "society_plans" : "subscription_plans";
    const name = p.label || `${p.kg} kg plan`;
    const msg = toSociety
      ? `Move "${name}" to Society plans? Only customers who signed up with a stall code (and haven't bought a plan) will see it. Regular customers will no longer see it, and any coupon set on it stops working.`
      : `Move "${name}" to Regular plans? Every regular customer will see it, and society customers see it when they renew.`;
    if (!window.confirm(msg)) return;
    setActionError("");
    setBusyId(p.id);
    try {
      const newId = `${toSociety ? "soc" : "plan"}_${slug(p.label || "") || kindOf(p)}_${Date.now().toString(36)}`;
      const copy = { ...pick(p), movedFrom: p.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      const batch = writeBatch(db);
      batch.set(doc(db, dest, newId), copy);
      batch.update(doc(db, coll, p.id), { active: false, movedTo: newId, updatedAt: serverTimestamp() });
      batch.set(doc(collection(db, "admin_settings_audit")), auditEntry(p.id, `move_to_${toSociety ? "society" : "regular"}`, p, { ...pick(p), movedTo: newId }, coll));
      await batch.commit();
      setSection(toSociety ? "society" : "regular");
    } catch (err) {
      setActionError(err?.code === "permission-denied"
        ? "Couldn't move the plan: your account isn't an admin, or the plan breaks a limit."
        : err?.message || "Could not move the plan.");
    } finally { setBusyId(null); }
  };

  return (
    <div className="flex min-h-screen bg-[#f3f6f2]" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <AdminSidebar
        activeTab="subscriptions" setActiveTab={onSidebar} user={client} onLogout={logout}
        isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen} setIsMobileOpen={setIsMobileMenuOpen}
      />
      {editing !== undefined && (
        <PlanModal plan={editing} nextOrder={nextOrder} collectionName={coll} onClose={() => setEditing(undefined)} onSaved={() => setEditing(undefined)} />
      )}
      {deleting && (
        <DeleteModal plan={deleting} defaultName={client?.name || auth.currentUser?.displayName || ""} onClose={() => setDeleting(null)} />
      )}
      <main className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ${isSidebarCollapsed ? "lg:ml-[80px]" : "lg:ml-[218px]"} ml-0`}>
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
                <FiPlus size={16} /> {isSocietySection ? "New society plan" : "New plan"}
              </button>
            )}
          </div>
        </header>

        <div className="space-y-4 p-4 lg:p-8">
          <SubscriptionsMasterSwitch isViewer={isViewer} />
          <SubscriptionHeroImage isViewer={isViewer} />
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {[["regular", "Regular plans"], ["society", "Society plans"]].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setSection(k)}
                className={`rounded-lg px-4 py-2 text-sm font-bold ${section === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {isSocietySection
              ? "For customers who signed up at a society stall with a stall code: a special price on their first plan. Regular customers never see these. After the first plan they renew on the regular plans."
              : "For everyone else (and for society customers when they renew). First-purchase coupons below give a regular customer a lower price on their first plan only."}
          </p>
          {isSocietySection && <StallCodesPanel isViewer={isViewer} />}
          {!isSocietySection && <SubscriptionCouponsPanel isViewer={isViewer} plans={regularSorted} />}
          {loadError && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Could not load plans: {loadError}</p>}
          {actionError && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{actionError}</p>}
          {((isSocietySection ? societyPlans : plans) || null) && sorted.length === 0 && !loadError && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              {isSocietySection
                ? "No society plans yet. Add the plans stall customers should see for their first purchase."
                : "No plans yet, so the app shows its built-in plans (5, 10 and 20 kg). Once any plan is saved here, the app shows only the plans listed on this page."}
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
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`text-xs font-bold ${active ? "text-emerald-700" : "text-slate-500"}`}>
                        {active ? "On" : "Off"}
                      </span>
                      <button
                        type="button" role="switch" aria-checked={active}
                        aria-label={`${active ? "Turn off" : "Turn on"} ${p.label || `${p.kg} kg plan`}`}
                        disabled={isViewer || busyId === p.id}
                        onClick={() => toggle(p)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${active ? "bg-emerald-500" : "bg-slate-300"}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${active ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900">{fmt(p.price)}</span>
                    {discounted && <span className="text-sm text-slate-400 line-through">{fmt(p.originalPrice)}</span>}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{planIncludes(p).join(" + ") || "—"}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {p.validityDays || 30} days · {pickupText(p)}
                    {Number(p.maxKgPerPickup) > 0 ? ` · max ${p.maxKgPerPickup} kg/pickup` : ""}
                    {Number(p.turnaroundHours) > 0 ? ` · ${p.turnaroundHours}h turnaround` : ""}
                  </p>
                  {p.badge ? <p className="mt-2 inline-block rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{p.badge}</p> : null}
                  <p className="mt-2 text-[11px] text-slate-400">Order {p.sortOrder ?? "—"} · {p.id}</p>
                  {!isViewer && (
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={() => setEditing(p)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                        <FiEdit2 size={13} /> Edit
                      </button>
                      <button type="button" onClick={() => movePlan(p)} disabled={busyId === p.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                        <FiRepeat size={13} /> {isSocietySection ? "Move to Regular" : "Move to Society"}
                      </button>
                      {!isSocietySection && (
                        <button type="button" onClick={() => setDeleting(p)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
                          <FiTrash2 size={13} /> Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!isSocietySection && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
              <FiClock size={16} className="text-slate-400" /> Deletion history
            </h2>
            {historyError && <p className="mt-2 text-sm text-red-700">Could not load history: {historyError}</p>}
            {history && history.length === 0 && <p className="mt-2 text-sm text-slate-500">No plans have been deleted.</p>}
            {history && history.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="py-2 pr-3">When</th><th className="py-2 pr-3">Plan</th><th className="py-2 pr-3">Deleted by</th>
                      <th className="py-2 pr-3">Why</th><th className="py-2 pr-3">Told by</th><th className="py-2 pr-3">Approved by</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 align-top">
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td className="py-2 pr-3 whitespace-nowrap text-slate-600">{tsText(h.deletedAt)}</td>
                        <td className="py-2 pr-3">
                          <p className="font-bold text-slate-900">{h.planLabel}</p>
                          <p className="text-xs text-slate-500">
                            {h.price != null ? fmt(h.price) : "—"} · {h.plan ? planIncludes(h.plan).join(" + ") : ""}
                            {h.plan?.validityDays ? ` · ${h.plan.validityDays} days` : ""}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {h.planId} · was {h.wasActive ? "on" : "off"}
                            {h.activeSubscribers != null ? ` · ${h.activeSubscribers} active customer${h.activeSubscribers === 1 ? "" : "s"}` : ""}
                          </p>
                        </td>
                        <td className="py-2 pr-3">
                          <p className="font-semibold text-slate-800">{h.deletedByName}</p>
                          <p className="text-xs text-slate-500">{h.deletedByEmail || h.deletedByUid}</p>
                        </td>
                        <td className="py-2 pr-3 text-slate-700 whitespace-pre-wrap">{h.reason}</td>
                        <td className="py-2 pr-3 text-slate-700">{h.authorizedBy}</td>
                        <td className="py-2 pr-3 text-slate-700">{h.approverName} <span className="text-xs text-slate-400">({h.approverPhone})</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>}
        </div>
      </main>
    </div>
  );
}
