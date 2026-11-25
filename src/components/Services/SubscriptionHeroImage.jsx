import { useEffect, useState } from "react";
import { collection, deleteField, doc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { uploadServiceImage } from "../../utils/serviceCatalog";

/**
 * The picture at the top of the app's Subscription screen (the towels):
 * store_settings/config subscription_hero_image. Empty means the app's own
 * picture. Customers on an app version that has this screen pick it up
 * straight away.
 */
export default function SubscriptionHeroImage({ isViewer }) {
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onSnapshot(doc(db, "store_settings", "config"),
    (snap) => setUrl(String((snap.data() || {}).subscription_hero_image || "")),
    (e) => setError(e.message)), []);

  const save = async (next, action) => {
    setBusy(true); setError("");
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "store_settings", "config"),
        { subscription_hero_image: next || deleteField(), updatedAt: serverTimestamp() }, { merge: true });
      batch.set(doc(collection(db, "admin_settings_audit")), {
        kind: "subscription_hero_image", target: "store_settings/config", action,
        before: { subscription_hero_image: url || null }, after: { subscription_hero_image: next || null },
        by: auth.currentUser?.email || null, byUid: auth.currentUser?.uid || null, at: serverTimestamp(),
      });
      await batch.commit();
    } catch (e) {
      setError(e?.code === "permission-denied" || e?.code === "storage/unauthorized"
        ? "Your account can't change this. Only the owner accounts can."
        : e?.message || "Couldn't save.");
    }
    setBusy(false);
  };

  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type)) return setError("Choose an image file.");
    if (f.size > 8 * 1024 * 1024) return setError("That image is too large. Use one under 8 MB.");
    setBusy(true); setError("");
    try {
      const uploaded = await uploadServiceImage(f, "subscription-hero");
      await save(uploaded, "set");
    } catch (err) {
      setError(err?.message || "Couldn't upload the picture.");
      setBusy(false);
    }
  };

  if (url === null) return error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-xl bg-blue-500">
          {url ? <img src={url} alt="" className="h-full w-full object-contain" /> : <span className="px-2 text-center text-[11px] font-semibold text-white/80">App default</span>}
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-slate-900">Subscription screen picture</h2>
          <p className="text-sm text-slate-600">The picture on the blue header of the Subscription screen in the app. A PNG with a transparent background looks best.</p>
          {error && <p className="mt-1 text-sm font-semibold text-red-700">{error}</p>}
        </div>
      </div>
      {!isViewer && (
        <div className="flex items-center gap-2">
          <label className={`cursor-pointer rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 ${busy ? "pointer-events-none opacity-50" : ""}`}>
            {busy ? "Saving…" : url ? "Change picture" : "Upload picture"}
            <input type="file" accept="image/*" className="hidden" onChange={pick} />
          </label>
          {url && (
            <button type="button" disabled={busy} onClick={() => window.confirm("Go back to the app's own picture?") && save("", "reset")}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              Use app default
            </button>
          )}
        </div>
      )}
    </div>
  );
}
