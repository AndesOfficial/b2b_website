import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc, writeBatch } from "firebase/firestore";
import { FiArrowDown, FiArrowUp, FiEye, FiEyeOff, FiTrash2, FiX } from "react-icons/fi";
import { db } from "../../firebase";
import { uploadServiceImage } from "../../utils/serviceCatalog";

const COLLECTION = "premium_carousel";
const fieldClass = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

/** Slides at the top of the app's Premium Laundry page. */
export default function PremiumCarouselManager({ onClose, readOnly }) {
  const [slides, setSlides] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ title: "", subtitle: "" });

  useEffect(() => onSnapshot(
    collection(db, COLLECTION),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      setSlides(list);
    },
    (e) => setError(e.message),
  ), []);

  const run = async (task) => {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e.message || "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const addSlide = (file) => run(async () => {
    const image = await uploadServiceImage(file, "premium_carousel");
    const order = (slides || []).reduce((max, s) => Math.max(max, s.order ?? 0), -1) + 1;
    await addDoc(collection(db, COLLECTION), {
      image,
      title: draft.title.trim(),
      subtitle: draft.subtitle.trim(),
      order,
      active: true,
    });
    setDraft({ title: "", subtitle: "" });
  });

  const move = (index, delta) => run(async () => {
    const list = [...slides];
    const [slide] = list.splice(index, 1);
    list.splice(index + delta, 0, slide);
    const batch = writeBatch(db);
    list.forEach((s, order) => batch.update(doc(db, COLLECTION, s.id), { order }));
    await batch.commit();
  });

  const update = (id, data) => run(() => updateDoc(doc(db, COLLECTION, id), data));

  const remove = (slide) => {
    if (!window.confirm(`Delete this slide${slide.title ? ` "${slide.title}"` : ""}? This can't be undone.`)) return;
    run(() => deleteDoc(doc(db, COLLECTION, slide.id)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-950">Premium carousel</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 hover:bg-slate-100">
            <FiX size={18} />
          </button>
        </div>
        {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {!readOnly && (
          <div className="mb-5 space-y-2 rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-bold text-slate-700">Add a slide</p>
            <input className={fieldClass} placeholder="Title (optional)" value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
            <input className={fieldClass} placeholder="Subtitle (optional)" value={draft.subtitle}
              onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))} />
            <input type="file" accept="image/*" disabled={busy} aria-label="Slide image" className="text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) addSlide(file);
              }} />
          </div>
        )}

        {slides === null && !error && <p className="text-sm text-slate-500">Loading slides…</p>}
        {slides?.length === 0 && <p className="text-sm text-slate-500">No slides yet. The app page starts at the services.</p>}
        <div className="space-y-3">
          {slides?.map((slide, i) => (
            <div key={slide.id} className="flex gap-3 rounded-xl border border-slate-200 p-3">
              <img src={slide.image} alt="" className={`h-20 w-32 rounded-lg object-cover ${slide.active === false ? "opacity-40" : ""}`} />
              <div className="min-w-0 flex-1 space-y-2">
                <input className={fieldClass} placeholder="Title" defaultValue={slide.title} disabled={readOnly}
                  onBlur={(e) => e.target.value !== (slide.title || "") && update(slide.id, { title: e.target.value.trim() })} />
                <input className={fieldClass} placeholder="Subtitle" defaultValue={slide.subtitle} disabled={readOnly}
                  onBlur={(e) => e.target.value !== (slide.subtitle || "") && update(slide.id, { subtitle: e.target.value.trim() })} />
              </div>
              {!readOnly && (
                <div className="flex flex-col gap-1">
                  <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"><FiArrowUp /></button>
                  <button type="button" disabled={busy || i === slides.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"><FiArrowDown /></button>
                  <button type="button" disabled={busy} onClick={() => update(slide.id, { active: slide.active === false })} aria-label={slide.active === false ? "Show" : "Hide"} className="rounded p-1 hover:bg-slate-100">{slide.active === false ? <FiEyeOff /> : <FiEye />}</button>
                  <button type="button" disabled={busy} onClick={() => remove(slide)} aria-label="Delete" className="rounded p-1 text-red-600 hover:bg-red-50"><FiTrash2 /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
