import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "../../firebase";

/**
 * Master switch for Andes Instant: store_settings/config instant_enabled, the
 * field the user app reads. Only an explicit "off" turns Instant off; a missing
 * field means on. Off: the Instant tab and button in the app show "paused"
 * instead of opening. Orders already in the cart or placed are not touched.
 */
export default function InstantSwitch({ isViewer }) {
  const [on, setOn] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onSnapshot(doc(db, "store_settings", "config"),
    (snap) => setOn((snap.data() || {}).instant_enabled !== false),
    (e) => setError(e.message)), []);

  if (on === null) return error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null;

  const flip = async () => {
    const next = !on;
    if (!window.confirm(next
      ? "Turn Andes Instant ON? Customers can use Instant again straight away."
      : "Turn Andes Instant OFF? Customers on the latest app see 'Instant paused' and can't start new Instant orders. Regular services are not affected. Apps that haven't updated keep showing Instant.")) return;
    setSaving(true); setError("");
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "store_settings", "config"),
        { instant_enabled: next, updatedAt: serverTimestamp() }, { merge: true });
      batch.set(doc(collection(db, "admin_settings_audit")), {
        kind: "instant_switch", target: "store_settings/config", action: next ? "turn_on" : "turn_off",
        before: { instant_enabled: on }, after: { instant_enabled: next },
        by: auth.currentUser?.email || null, byUid: auth.currentUser?.uid || null, at: serverTimestamp(),
      });
      await batch.commit();
    } catch (e) {
      setError(e?.code === "permission-denied"
        ? "Your account can't change store settings. Only the owner accounts can turn Instant on or off."
        : e?.message || "Couldn't save.");
    }
    setSaving(false);
  };

  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 shadow-sm ${on ? "border-violet-200 bg-violet-50/60" : "border-slate-200 bg-white"}`}>
      <div className="min-w-0">
        <h2 className="text-sm font-extrabold text-slate-900">Andes Instant in the app</h2>
        <p className="text-sm text-slate-600">
          {on ? "On: customers can order Instant services." : "Off: customers see \"Instant paused\" and can't start Instant orders. Regular services are not affected."}
        </p>
        {error && <p className="mt-1 text-sm font-semibold text-red-700">{error}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold ${on ? "text-violet-700" : "text-slate-500"}`}>{on ? "On" : "Off"}</span>
        <button type="button" role="switch" aria-checked={on} aria-label={on ? "Turn Instant off" : "Turn Instant on"}
          disabled={isViewer || saving} onClick={flip}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${on ? "bg-violet-500" : "bg-slate-300"}`}>
          <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-7" : "translate-x-0.5"}`} />
        </button>
      </div>
    </div>
  );
}
