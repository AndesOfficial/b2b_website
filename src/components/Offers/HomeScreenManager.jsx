import { useEffect, useState } from "react";
import {
  collection, deleteDoc, deleteField, doc, onSnapshot, runTransaction, serverTimestamp, setDoc, Timestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  FiAlertCircle, FiArrowDown, FiArrowUp, FiEdit2, FiEye, FiEyeOff, FiImage, FiPlus, FiSave, FiTrash2, FiX,
} from "react-icons/fi";
import { db, storage } from "../../firebase";

// What the customer app shows on Home. The app reads these on launch and on
// pull-to-refresh, so a save here is live without an app release.
//   home_config/{type}/items/{id}  — offer cards and banners
//   store_settings/config.carousel_banners — the sliding banners at the top

const ITEM_TYPES = [
  { id: "mainOffer", label: "Main offer" },
  { id: "campaigns", label: "Campaign cards" },
  { id: "hero", label: "Top hero banner" },
  { id: "showcase", label: "Showcase" },
  { id: "picks", label: "Andes Picks" },
  { id: "moreFromAndes", label: "More from Andes" },
];

const ACTIONS = [
  { id: "", label: "Nothing (just a picture)", needsTarget: false },
  { id: "coupons", label: "Open the coupons list", needsTarget: false },
  { id: "coupon", label: "Copy a coupon code", needsTarget: true, hint: "DIWALI50" },
  { id: "service", label: "Open a service", needsTarget: true, hint: "Wash & Fold" },
  { id: "category", label: "Open a category", needsTarget: true, hint: "dry cleaning" },
  { id: "tab", label: "Open a tab", needsTarget: true, hint: "services" },
  { id: "schedulePickup", label: "Schedule pickup", needsTarget: false },
  { id: "url", label: "Open a web link", needsTarget: true, hint: "https://…" },
];

const BUNDLED_SLIDES = ["laundry_festival", "wash_iron", "blazers_dry_cleaning", "blankets_cleaning"];
const BUCKET = "andesuser-792d4.firebasestorage.app";
const storageUrl = (name) => `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/General%2Fhome%2F${name}.jpg?alt=media`;

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const label = "block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1";

const toLocalInput = (v) => {
  const d = v?.toDate ? v.toDate() : v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

async function uploadHomeImage(file) {
  if (!/^image\/(jpeg|png)$/.test(file.type)) throw new Error("Choose a JPG or PNG picture.");
  if (file.size > 2 * 1024 * 1024) throw new Error("The picture is over 2 MB. Shrink it first (aim for under 300 KB).");
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40) || "image";
  const ext = file.type === "image/png" ? "png" : "jpg";
  // A new name every time, so phones never show an old cached copy.
  const fileRef = ref(storage, `General/home/${base}_${Date.now()}.${ext}`);
  const snap = await uploadBytes(fileRef, file, { contentType: file.type });
  return getDownloadURL(snap.ref);
}

function ImagePicker({ value, onChange, setError, disabled }) {
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await uploadHomeImage(file));
    } catch (err) {
      setError(`${err.message || "Upload failed."} You can paste a picture link instead.`);
    }
    setBusy(false);
  };
  return (
    <div className="space-y-2">
      {value && <img src={value} alt="" className="max-h-40 w-full rounded-lg bg-slate-100 object-contain" />}
      <input type="file" accept="image/jpeg,image/png" disabled={disabled || busy} onChange={pick} className="text-xs" />
      {busy && <span className="ml-2 text-xs text-slate-500">Uploading…</span>}
      <input className={field} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste a picture link (https://…)" />
    </div>
  );
}

/* ---------------- carousel (store_settings/config.carousel_banners) ---------------- */

const parseSlide = (raw) => {
  if (typeof raw === "string") return { image: raw, targetType: "", targetId: "", extra: {} };
  if (raw && typeof raw === "object") {
    const { image, imageUrl, url, targetType, targetId, ...extra } = raw;
    return { image: image || imageUrl || url || "", targetType: targetType || "", targetId: targetId || "", extra };
  }
  return null;
};
const buildSlide = (s) => (s.targetType && s.targetId.trim()
  ? { ...s.extra, image: s.image.trim(), targetType: s.targetType, targetId: s.targetId.trim() }
  : s.image.trim());

function CarouselPanel({ readOnly, toast }) {
  const [saved, setSaved] = useState(undefined); // undefined loading, null not set, array set
  const [slides, setSlides] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => onSnapshot(doc(db, "store_settings", "config"), (snap) => {
    const raw = snap.data()?.carousel_banners ?? snap.data()?.carouselBanners;
    const arr = Array.isArray(raw) ? raw : null;
    setSaved(arr);
    setSlides((cur) => (dirty ? cur : (arr || []).map(parseSlide).filter(Boolean)));
  }, (e) => setError(e.message)), [dirty]);

  const edit = (fn) => { setSlides(fn); setDirty(true); };
  const set = (i, patch) => edit((l) => l.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i, d) => edit((l) => { const c = [...l]; const [x] = c.splice(i, 1); c.splice(i + d, 0, x); return c; });

  const save = async () => {
    setError("");
    const clean = slides.filter((s) => s.image.trim());
    if (!clean.length) return setError("Add at least one slide, or use “Go back to built-in banners”.");
    if (clean.some((s) => !/^https:\/\//.test(s.image.trim()))) return setError("Every picture link must start with https://");
    setBusy(true);
    try {
      await setDoc(doc(db, "store_settings", "config"), { carousel_banners: clean.map(buildSlide), updatedAt: Timestamp.now() }, { merge: true });
      setDirty(false);
      toast("success", "Home banners saved. Phones show them on the next app open or pull-down.");
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const reset = async () => {
    if (!window.confirm("Go back to the 4 banners built into the app? Your slides here will be removed.")) return;
    setBusy(true);
    try {
      await setDoc(doc(db, "store_settings", "config"), { carousel_banners: deleteField() }, { merge: true });
      setDirty(false);
      setSlides([]);
      toast("success", "Home now uses the built-in banners again.");
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  if (saved === undefined && !error) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        {saved === null
          ? "The app is currently showing its 4 built-in banners (one of them is the old Laundry Festival dates). Add your own below to replace them."
          : `The app is showing the ${saved.length} banner${saved.length === 1 ? "" : "s"} below, in this order.`}
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {slides.length === 0 && !readOnly && (
        <button type="button" onClick={() => edit(() => BUNDLED_SLIDES.map((n) => ({ image: storageUrl(n), targetType: "", targetId: "", extra: {} })))}
          className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50">
          Start from the 4 banners already uploaded to Storage
        </button>
      )}

      {slides.map((s, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700">Slide {i + 1}</span>
            {!readOnly && (
              <div className="flex gap-1">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="rounded p-1.5 hover:bg-slate-100 disabled:opacity-30"><FiArrowUp /></button>
                <button type="button" disabled={i === slides.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="rounded p-1.5 hover:bg-slate-100 disabled:opacity-30"><FiArrowDown /></button>
                <button type="button" onClick={() => edit((l) => l.filter((_, j) => j !== i))} aria-label="Remove slide" className="rounded p-1.5 text-red-600 hover:bg-red-50"><FiTrash2 /></button>
              </div>
            )}
          </div>
          <ImagePicker value={s.image} onChange={(v) => set(i, { image: v })} setError={setError} disabled={readOnly} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>When tapped</label>
              <select className={field} disabled={readOnly} value={s.targetType} onChange={(e) => set(i, { targetType: e.target.value })}>
                <option value="">Nothing</option>
                <option value="service">Open a service</option>
                <option value="category">Open a category</option>
              </select>
            </div>
            {s.targetType && (
              <div>
                <label className={label}>{s.targetType === "service" ? "Service name" : "Category"}</label>
                <input className={field} disabled={readOnly} value={s.targetId} onChange={(e) => set(i, { targetId: e.target.value })}
                  placeholder={s.targetType === "service" ? "Wash & Fold" : "dry cleaning"} />
              </div>
            )}
          </div>
        </div>
      ))}

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => edit((l) => [...l, { image: "", targetType: "", targetId: "", extra: {} }])}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><FiPlus /> Add a slide</button>
          <div className="flex gap-2">
            {saved !== null && <button type="button" disabled={busy} onClick={reset} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100">Go back to built-in banners</button>}
            <button type="button" disabled={busy || !dirty} onClick={save}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"><FiSave /> {busy ? "Saving…" : "Save & make live"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- offer cards (home_config/{type}/items) ---------------- */

function ItemModal({ item, type, onClose, toast }) {
  const isNew = !item;
  const it = item || {};
  const [f, setF] = useState({
    type: it.type || type,
    title: it.title || "", subtitle: it.subtitle || "", ctaText: it.ctaText || "",
    imageUrl: it.imageUrl || it.image || "",
    order: it.order ?? "", visible: it.visible !== false,
    startAt: toLocalInput(it.startAt), endAt: toLocalInput(it.endAt),
    actionType: it.action?.type || "", actionTarget: it.action?.target || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const act = ACTIONS.find((a) => a.id === f.actionType) || ACTIONS[0];
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!f.imageUrl.trim() && !f.title.trim()) return setError("Add a picture or a title.");
    if (f.imageUrl.trim() && !/^https:\/\//.test(f.imageUrl.trim())) return setError("The picture link must start with https://");
    if (act.needsTarget && !f.actionTarget.trim()) return setError("Enter what the tap should open.");
    if (f.startAt && f.endAt && new Date(f.endAt) <= new Date(f.startAt)) return setError("“Ends” must be after “Starts”.");
    const data = {
      title: f.title.trim(), subtitle: f.subtitle.trim(), ctaText: f.ctaText.trim(),
      imageUrl: f.imageUrl.trim(),
      order: f.order === "" ? 0 : Number(f.order),
      visible: f.visible,
      startAt: f.startAt ? Timestamp.fromDate(new Date(f.startAt)) : deleteField(),
      endAt: f.endAt ? Timestamp.fromDate(new Date(f.endAt)) : deleteField(),
      action: f.actionType ? { type: f.actionType, target: act.needsTarget ? f.actionTarget.trim() : "" } : deleteField(),
      updatedAt: serverTimestamp(),
    };
    setSaving(true);
    try {
      const moved = !isNew && it.type !== f.type;
      if (moved) await deleteDoc(doc(db, "home_config", it.type, "items", it.id));
      const id = isNew || moved ? `${f.type}_${Date.now().toString(36)}` : it.id;
      await setDoc(doc(db, "home_config", f.type, "items", id), data, { merge: true });
      toast("success", "Saved. It is live on Home now.");
      onClose();
    } catch (err) { setError(err.message || "Could not save."); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4">
      <form onSubmit={submit} className="my-8 w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-900">{isNew ? "New Home offer" : "Edit Home offer"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 hover:bg-slate-100"><FiX /></button>
        </div>
        <div>
          <label className={label}>Where on Home</label>
          <select className={field} value={f.type} onChange={set("type")}>{ITEM_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        </div>
        <div>
          <label className={label}>Picture</label>
          <ImagePicker value={f.imageUrl} onChange={(v) => setF((p) => ({ ...p, imageUrl: v }))} setError={setError} />
          <p className="mt-1 text-[11px] text-slate-400">Same shape as the old picture, JPG or PNG, under about 300 KB. Each upload gets a new file name automatically.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Title (optional)</label><input className={field} value={f.title} onChange={set("title")} /></div>
          <div><label className={label}>Subtitle (optional)</label><input className={field} value={f.subtitle} onChange={set("subtitle")} /></div>
        </div>
        <div><label className={label}>Button text (optional)</label><input className={field} value={f.ctaText} onChange={set("ctaText")} placeholder="Book now" /></div>
        <div>
          <label className={label}>When tapped</label>
          <select className={field} value={f.actionType} onChange={set("actionType")}>{ACTIONS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
          {act.needsTarget && <input className={`${field} mt-2`} value={f.actionTarget} onChange={set("actionTarget")} placeholder={act.hint} />}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Starts (optional)</label><input className={field} type="datetime-local" value={f.startAt} onChange={set("startAt")} /></div>
          <div><label className={label}>Ends (optional)</label><input className={field} type="datetime-local" value={f.endAt} onChange={set("endAt")} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Position (small = first)</label><input className={field} type="number" value={f.order} onChange={set("order")} placeholder="1" /></div>
          <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={f.visible} onChange={set("visible")} /> Live on Home</label>
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={saving} className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Saving…" : isNew ? "Add to Home" : "Save changes"}
        </button>
      </form>
    </div>
  );
}

const windowState = (it) => {
  const now = new Date();
  const s = it.startAt?.toDate ? it.startAt.toDate() : null;
  const e = it.endAt?.toDate ? it.endAt.toDate() : null;
  if (s && now < s) return "Scheduled";
  if (e && now >= e) return "Expired";
  return "Live";
};

function ItemsPanel({ readOnly, toast }) {
  const [type, setType] = useState("mainOffer");
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(undefined);

  useEffect(() => onSnapshot(collection(db, "home_config", type, "items"), (snap) => {
    setList(snap.docs.map((d) => ({ id: d.id, type, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  }, (e) => { setError(e.message); setList([]); }), [type]);

  const toggle = async (it) => {
    try { await setDoc(doc(db, "home_config", it.type, "items", it.id), { visible: it.visible === false, updatedAt: serverTimestamp() }, { merge: true }); }
    catch (e) { setError(e.message); }
  };
  const remove = async (it) => {
    if (!window.confirm(`Delete "${it.title || it.id}" from Home? This can't be undone. (Turn it off to hide it for now.)`)) return;
    try { await deleteDoc(doc(db, "home_config", it.type, "items", it.id)); } catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {ITEM_TYPES.map((t) => (
          <button key={t.id} type="button" onClick={() => { setList(null); setType(t.id); }}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${type === t.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{t.label}</button>
        ))}
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!readOnly && (
        <div className="flex justify-end">
          <button type="button" onClick={() => setEditing(null)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"><FiPlus /> New offer</button>
        </div>
      )}
      {list === null ? <p className="text-sm text-slate-500">Loading…</p>
        : list.length === 0 ? <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Nothing here yet.</p>
          : list.map((it) => {
            const on = it.visible !== false;
            const img = it.imageUrl || it.image;
            const st = on ? windowState(it) : "Off";
            return (
              <div key={it.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                {img && /^https?:/.test(img)
                  ? <img src={img} alt="" className="h-12 w-20 rounded-lg bg-slate-100 object-cover" />
                  : <span className="flex h-12 w-20 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><FiImage /></span>}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-900">
                    {it.title || it.id}{" "}
                    <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${st === "Live" ? "bg-emerald-50 text-emerald-700" : st === "Off" ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-700"}`}>{st}</span>
                  </div>
                  <div className="truncate text-[11px] text-slate-500">
                    Position {it.order ?? 0}{it.action?.type ? ` · opens ${it.action.type}${it.action.target ? `: ${it.action.target}` : ""}` : ""}
                    {img && !/^https?:/.test(img) ? " · picture is built into the app" : ""}
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => toggle(it)} title={on ? "Turn off" : "Turn on"} className="rounded p-2 hover:bg-slate-100">{on ? <FiEye /> : <FiEyeOff />}</button>
                    <button type="button" onClick={() => setEditing(it)} title="Edit" className="rounded p-2 hover:bg-slate-100"><FiEdit2 /></button>
                    <button type="button" onClick={() => remove(it)} title="Delete" className="rounded p-2 text-red-600 hover:bg-red-50"><FiTrash2 /></button>
                  </div>
                )}
              </div>
            );
          })}
      {editing !== undefined && <ItemModal item={editing} type={type} toast={toast} onClose={() => setEditing(undefined)} />}
    </div>
  );
}

/* ---------------- page section ---------------- */

export default function HomeScreenManager({ isViewer, showToast }) {
  const [sub, setSub] = useState("carousel");
  const [layout, setLayout] = useState(undefined);
  const [layoutError, setLayoutError] = useState("");

  useEffect(() => onSnapshot(doc(db, "home_config", "layout"),
    (snap) => setLayout(snap.exists() ? snap.data() : null),
    (e) => setLayoutError(e.message)), []);

  const couponsHidden = layout?.sections?.find((s) => s?.type === "coupons")?.visible === false;
  const showCoupons = async () => {
    try {
      const r = doc(db, "home_config", "layout");
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(r);
        const sections = snap.data()?.sections || [];
        tx.update(r, { sections: sections.map((s) => (s?.type === "coupons" ? { ...s, visible: true } : s)) });
      });
      showToast("success", "The coupon strip is back on the Home screen.");
    } catch (e) { showToast("error", e.message); }
  };

  return (
    <div className="space-y-4">
      {layoutError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{layoutError}</p>}
      {layout && layout.enabled !== true && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <FiAlertCircle className="mt-0.5 shrink-0" /> The new Home screen is switched off in the app, so Home offer cards and the coupon strip are not shown yet.
        </div>
      )}
      {couponsHidden && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <span>The coupon strip is switched <b>off</b> on Home, so coupons marked “Home Banner” are not shown there.</span>
          {!isViewer && <button type="button" onClick={showCoupons} className="rounded-lg bg-amber-600 px-3 py-1.5 font-bold text-white">Switch it on</button>}
        </div>
      )}
      <div className="inline-flex gap-1.5 rounded-2xl bg-slate-200/70 p-1.5">
        {[["carousel", "Top banners"], ["items", "Offer cards"]].map(([id, text]) => (
          <button key={id} type="button" onClick={() => setSub(id)}
            className={`rounded-xl px-4 py-2 text-xs font-bold ${sub === id ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}>{text}</button>
        ))}
      </div>
      {sub === "carousel" ? <CarouselPanel readOnly={isViewer} toast={showToast} /> : <ItemsPanel readOnly={isViewer} toast={showToast} />}
    </div>
  );
}
