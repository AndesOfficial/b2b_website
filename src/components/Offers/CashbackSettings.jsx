import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, Timestamp } from "firebase/firestore";
import { FiSave } from "react-icons/fi";
import { db } from "../../firebase";

// store_settings/config.cashback = { enabled, percent, minOrder, cap }.
// Read by the rider cloud function when an order is delivered (the credit) and
// by the customer app (the banner). Missing or invalid values mean the original
// 5% / no minimum / ₹100 cap, so nothing changes until this is saved.

const DEFAULTS = { enabled: true, percent: 5, minOrder: 0, cap: 100 };
const input = "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl";

const fromDoc = (raw) => ({
  enabled: raw?.enabled !== false,
  percent: typeof raw?.percent === "number" ? raw.percent : DEFAULTS.percent,
  minOrder: typeof raw?.minOrder === "number" ? raw.minOrder : DEFAULTS.minOrder,
  cap: typeof raw?.cap === "number" ? raw.cap : DEFAULTS.cap,
});

export default function CashbackSettings({ isViewer, showToast }) {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onSnapshot(doc(db, "store_settings", "config"), (snap) => {
    const v = fromDoc(snap.data()?.cashback);
    setSaved(v);
    setForm((cur) => cur ?? v);
  }, (e) => setError(e.message)), []);

  if (!form) return error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null;

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const pct = Number(form.percent);
  const min = Number(form.minOrder);
  const cap = Number(form.cap);
  const example = (amount) => (!form.enabled || amount < min ? 0 : Math.min(cap, Math.floor((amount * pct) / 100)));

  const save = async () => {
    setError("");
    if (![pct, min, cap].every((n) => Number.isFinite(n) && n >= 0)) return setError("Enter numbers of 0 or more.");
    if (pct > 100) return setError("Percent can't be more than 100.");
    setSaving(true);
    try {
      await setDoc(doc(db, "store_settings", "config"), {
        cashback: { enabled: Boolean(form.enabled), percent: pct, minOrder: min, cap },
        updatedAt: Timestamp.now(),
      }, { merge: true });
      showToast("success", "Cashback rules saved. New deliveries use them straight away.");
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="p-5 rounded-2xl border border-slate-200/80 bg-white space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-slate-900 text-sm">Wallet Cashback on delivered orders</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Credited to the customer&apos;s wallet once, when the order is delivered. Hostel, subscription, rewash and ₹0 orders never earn it.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input type="checkbox" disabled={isViewer} checked={form.enabled}
            onChange={(e) => set("enabled", e.target.checked)} className="sr-only peer" />
          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <label className="block font-medium text-slate-600 mb-1">Cashback (%)</label>
          <input type="number" min="0" max="100" disabled={isViewer} value={form.percent}
            onChange={(e) => set("percent", e.target.value)} className={input} />
        </div>
        <div>
          <label className="block font-medium text-slate-600 mb-1">Minimum order (₹)</label>
          <input type="number" min="0" disabled={isViewer} value={form.minOrder}
            onChange={(e) => set("minOrder", e.target.value)} className={input} />
        </div>
        <div>
          <label className="block font-medium text-slate-600 mb-1">Most per order (₹)</label>
          <input type="number" min="0" disabled={isViewer} value={form.cap}
            onChange={(e) => set("cap", e.target.value)} className={input} />
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        With these rules: a ₹90 order earns ₹{example(90)}, ₹200 earns ₹{example(200)}, ₹5,000 earns ₹{example(5000)}.
        {" "}The minimum is on the order&apos;s final bill; amounts are rounded down to whole rupees.
      </p>
      <p className="text-[11px] text-slate-400">
        The deliveries use these rules right away. The cart banner in the customer app follows them after the next app update.
      </p>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!isViewer && (
        <div className="flex justify-end">
          <button type="button" onClick={save} disabled={saving || !dirty}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm disabled:opacity-50">
            <FiSave size={16} /> {saving ? "Saving..." : "Save Cashback Rules"}
          </button>
        </div>
      )}
    </div>
  );
}
