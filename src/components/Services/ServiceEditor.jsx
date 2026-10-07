import { useMemo, useState } from "react";
import { FiArrowDown, FiArrowUp, FiPlus, FiUpload, FiX } from "react-icons/fi";
import {
  MAX_SERVICE_IMAGE_BYTES,
  SERVICE_CATEGORIES,
  SERVICE_STATUSES,
  SERVICE_UNITS,
} from "../../constants/serviceCatalog";
import {
  describeCatalogError,
  saveService,
  serviceStatusOf,
  uploadServiceImage,
  validateService,
} from "../../utils/serviceCatalog";

const EMPTY_SERVICE = {
  serviceName: "",
  category: "general",
  status: "active",
  unit: "piece",
  rateByPiece: "",
  rateByKg: "",
  rateByPair: "",
  originalRateByPiece: "",
  originalRateByKg: "",
  discountPercentage: "",
  instantRateByPiece: "",
  instantRateByKg: "",
  originalInstantRateByPiece: "",
  originalInstantRateByKg: "",
  instantDiscountPercentage: "",
  imageId: "",
  imageUrl: "",
  isGrouped: false,
  groupName: "",
  isGroupedService: false,
  isSpecialKgService: false,
  subServices: [],
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500";

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-3 border-t border-slate-100 pt-4">
      <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Side panel to create or edit one service. `service` is null for a new one.
 */
export default function ServiceEditor({ service, allServices, groupNames, readOnly, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    if (!service) {
      const maxOrder = Math.max(0, ...allServices.map((s) => Number(s.displayOrder) || 0));
      return { ...EMPTY_SERVICE, displayOrder: maxOrder + 1 };
    }
    return {
      ...EMPTY_SERVICE,
      ...service,
      status: serviceStatusOf(service),
      subServices: Array.isArray(service.subServices)
        ? service.subServices.map((s) => ({ ...s, status: serviceStatusOf(s) }))
        : [],
    };
  });
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const categoryOptions = useMemo(() => {
    const known = new Set(SERVICE_CATEGORIES.map((c) => c.value));
    // Keep a legacy value selectable so editing never silently changes it.
    return known.has(form.category) || !form.category
      ? SERVICE_CATEGORIES
      : [...SERVICE_CATEGORIES, { value: form.category, label: `${form.category} (legacy)` }];
  }, [form.category]);

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const setSub = (index, key, value) =>
    setForm((f) => ({
      ...f,
      subServices: f.subServices.map((s, i) => (i === index ? { ...s, [key]: value } : s)),
    }));

  const moveSub = (index, delta) =>
    setForm((f) => {
      const subs = [...f.subServices];
      const target = index + delta;
      if (target < 0 || target >= subs.length) return f;
      [subs[index], subs[target]] = [subs[target], subs[index]];
      return { ...f, subServices: subs.map((s, i) => ({ ...s, displayOrder: i + 1 })) };
    });

  const addSub = () =>
    setForm((f) => ({
      ...f,
      subServices: [
        ...f.subServices,
        { name: "", rateByPiece: "", instantRateByPiece: "", status: "active", displayOrder: f.subServices.length + 1 },
      ],
    }));

  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors(["Please choose an image file."]);
      return;
    }
    if (file.size > MAX_SERVICE_IMAGE_BYTES) {
      setErrors(["Image must be smaller than 2 MB."]);
      return;
    }
    setUploading(true);
    setErrors([]);
    try {
      const url = await uploadServiceImage(file, form.serviceName || service?.id || "service");
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (err) {
      setErrors([`Image upload failed: ${describeCatalogError(err)}`]);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const problems = validateService(form, allServices);
    setErrors(problems);
    if (problems.length > 0) return;
    setSaving(true);
    try {
      await saveService(service, form);
      onSaved?.();
      onClose();
    } catch (err) {
      setErrors([`Save failed: ${describeCatalogError(err)}`]);
    } finally {
      setSaving(false);
    }
  };

  const num = (key, label, hint) => (
    <Field label={label} hint={hint}>
      <input type="number" min="0" step="any" className={inputClass} value={form[key] ?? ""} onChange={set(key)} disabled={readOnly} />
    </Field>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
              {service ? (readOnly ? "View service" : "Edit service") : "New service"}
            </p>
            <h2 className="text-lg font-extrabold text-slate-900">{form.serviceName || "Untitled service"}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <FiX size={20} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {errors.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Name" hint={service ? "Renaming is safe: orders store the permanent service ID." : undefined}>
                <input className={inputClass} value={form.serviceName} onChange={set("serviceName")} disabled={readOnly} />
              </Field>
            </div>
            <Field label="Category">
              <select className={inputClass} value={form.category} onChange={set("category")} disabled={readOnly}>
                {categoryOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Unit">
              <select className={inputClass} value={form.unit || "piece"} onChange={set("unit")} disabled={readOnly}>
                {SERVICE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
          </div>

          <Section title="Visibility">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {SERVICE_STATUSES.map((s) => (
                <label
                  key={s.value}
                  className={`cursor-pointer rounded-lg border p-3 text-sm ${form.status === s.value ? s.tone + " ring-2 ring-blue-200" : "border-slate-200 text-slate-600"}`}
                >
                  <input type="radio" name="status" className="sr-only" value={s.value} checked={form.status === s.value} onChange={set("status")} disabled={readOnly} />
                  <span className="block font-bold">{s.label}</span>
                  <span className="block text-[11px] opacity-80">{s.hint}</span>
                </label>
              ))}
            </div>
          </Section>

          <Section title="Regular prices (₹)">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {num("rateByPiece", "Per piece")}
              {num("rateByKg", "Per kg")}
              {num("rateByPair", "Per pair")}
              {num("originalRateByPiece", "Original per piece", "Shown struck through")}
              {num("originalRateByKg", "Original per kg")}
              <Field label="Discount label">
                <input className={inputClass} placeholder="25% OFF" value={form.discountPercentage ?? ""} onChange={set("discountPercentage")} disabled={readOnly} />
              </Field>
            </div>
          </Section>

          <Section title="Instant prices (₹)">
            <p className="text-[11px] text-slate-400">Leave empty if the service is not offered as instant.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {num("instantRateByPiece", "Per piece")}
              {num("instantRateByKg", "Per kg")}
              <Field label="Discount label">
                <input className={inputClass} value={form.instantDiscountPercentage ?? ""} onChange={set("instantDiscountPercentage")} disabled={readOnly} />
              </Field>
              {num("originalInstantRateByPiece", "Original per piece")}
              {num("originalInstantRateByKg", "Original per kg")}
            </div>
          </Section>

          {form.category === "household" && (
            <Section title="Price range (household)">
              <div className="grid grid-cols-2 gap-3">
                {num("minPrice", "Min price")}
                {num("maxPrice", "Max price")}
              </div>
            </Section>
          )}

          <Section title="Image">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-[10px] text-slate-400">
                {form.imageUrl ? <img src={form.imageUrl} alt="" className="h-full w-full object-cover" /> : "Built-in"}
              </div>
              <div className="flex-1 space-y-2">
                {!readOnly && (
                  <div className="flex gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      <FiUpload size={14} /> {uploading ? "Uploading…" : "Upload image"}
                      <input type="file" accept="image/*" className="hidden" onChange={handleImage} disabled={uploading} />
                    </label>
                    {form.imageUrl && (
                      <button type="button" className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100" onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}>
                        Remove
                      </button>
                    )}
                  </div>
                )}
                <Field label="Built-in image ID" hint="Used when no image is uploaded, and by older app versions.">
                  <input className={inputClass} value={form.imageId ?? ""} onChange={set("imageId")} disabled={readOnly} />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Grouping & behaviour">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Group">
                <select className={inputClass} value={form.groupName ?? ""} onChange={(e) => setForm((f) => ({ ...f, groupName: e.target.value, isGrouped: e.target.value !== "" }))} disabled={readOnly}>
                  <option value="">No group</option>
                  {groupNames.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <div className="space-y-2 pt-5 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.isGroupedService} onChange={set("isGroupedService")} disabled={readOnly} /> Grouped service card
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.isSpecialKgService} onChange={set("isSpecialKgService")} disabled={readOnly} /> Weighed by rider (special kg)
                </label>
              </div>
            </div>
          </Section>

          <Section title="Sub-services">
            {form.subServices.length === 0 && <p className="text-sm text-slate-400">None. Add one for items like Iron types or household wash options.</p>}
            <div className="space-y-2">
              {form.subServices.map((sub, i) => (
                <div key={sub.serviceId || `new-${i}`} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-slate-200 p-2">
                  <div className="col-span-4">
                    <Field label="Name"><input className={inputClass} value={sub.name ?? ""} onChange={(e) => setSub(i, "name", e.target.value)} disabled={readOnly} /></Field>
                  </div>
                  <div className="col-span-2">
                    <Field label="₹ / piece"><input type="number" min="0" className={inputClass} value={sub.rateByPiece ?? ""} onChange={(e) => setSub(i, "rateByPiece", e.target.value)} disabled={readOnly} /></Field>
                  </div>
                  <div className="col-span-2">
                    <Field label="Instant"><input type="number" min="0" className={inputClass} value={sub.instantRateByPiece ?? ""} onChange={(e) => setSub(i, "instantRateByPiece", e.target.value)} disabled={readOnly} /></Field>
                  </div>
                  <div className="col-span-2">
                    <Field label="Status">
                      <select className={inputClass} value={sub.status} onChange={(e) => setSub(i, "status", e.target.value)} disabled={readOnly}>
                        {SERVICE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="col-span-2 flex justify-end gap-1 pb-1">
                    <button type="button" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" onClick={() => moveSub(i, -1)} disabled={readOnly || i === 0} aria-label="Move up"><FiArrowUp size={14} /></button>
                    <button type="button" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" onClick={() => moveSub(i, 1)} disabled={readOnly || i === form.subServices.length - 1} aria-label="Move down"><FiArrowDown size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
            {!readOnly && (
              <button type="button" onClick={addSub} className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                <FiPlus size={14} /> Add sub-service
              </button>
            )}
          </Section>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly && (
            <button type="button" onClick={handleSave} disabled={saving || uploading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : service ? "Save changes" : "Create service"}
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}
