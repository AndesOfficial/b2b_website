import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, limit, onSnapshot, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import AdminSidebar from "../components/Layout/AdminSidebar";
import AdminPageHeader from "../components/Layout/AdminPageHeader";
import SectionErrorBoundary from "../components/Shared/SectionErrorBoundary";
import { useHostelOrders } from "../context/HostelAuthContext";
import { db, storage, functions } from "../firebase";

// Riders: everyone with a rider login. Admin adds a rider (name, mobile, email
// and a temporary password are required; areas and documents can come later),
// edits areas and documents, and removes a rider. Removing keeps the record
// (past orders point at it) and switches the login off.

const call = (name, data) => httpsCallable(functions, name)(data).then((r) => r.data);

const DOC_TYPES = [
  { key: "aadhaar", label: "Aadhaar card" },
  { key: "license", label: "Driving license" },
];
const MAX_DOC_MB = 5;
const ALLOWED_DOC = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const parseAreas = (s) => [...new Set(String(s || "").split(",").map((a) => a.trim()).filter(Boolean))];
const errText = (e) => (e && e.message ? String(e.message).replace(/^.*?:\s(?=[A-Z])/, "") : "Something went wrong.");

async function uploadDoc(riderId, type, file) {
  if (!ALLOWED_DOC.includes(file.type)) throw new Error("Documents must be a photo (JPG, PNG, WebP) or a PDF.");
  if (file.size > MAX_DOC_MB * 1024 * 1024) throw new Error(`Each document must be under ${MAX_DOC_MB} MB.`);
  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const path = `rider_documents/${riderId}/${type}_${Date.now()}.${ext}`;
  await uploadBytes(ref(storage, path), file, { contentType: file.type });
  await updateDoc(doc(db, "riders", riderId), {
    [`documents.${type}`]: { path, name: file.name.slice(0, 80), uploadedAt: serverTimestamp() },
  });
}

const inputCls = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500";
const labelCls = "mb-1 block text-[11px] font-black uppercase tracking-widest text-slate-400";

function DocPicker({ label, file, onFile, existing, onView }) {
  return (
    <div>
      <label className={labelCls}>{label} <span className="normal-case tracking-normal font-semibold text-slate-400">(optional)</span></label>
      {existing && (
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-emerald-700">
          ✓ Uploaded{existing.name ? `: ${existing.name}` : ""}
          <button type="button" className="underline" onClick={onView}>View</button>
        </div>
      )}
      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(e) => onFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
        className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-bold file:text-slate-700" />
      {file && <div className="mt-1 text-[11px] font-semibold text-slate-500">{file.name}</div>}
    </div>
  );
}

const viewDoc = async (d) => {
  try { window.open(await getDownloadURL(ref(storage, d.path)), "_blank", "noopener"); }
  catch (e) { alert("Could not open the document."); }
};

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative my-auto flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-100 bg-slate-50/70 p-5">
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-slate-900">{title}</h2>
            {subtitle && <p className="text-xs font-semibold text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700">✕</button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs">{children}</div>
      </div>
    </div>
  );
}

function AddRiderModal({ onClose, onDone }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", password: "", areas: "" });
  const [files, setFiles] = useState({ aadhaar: null, license: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [warn, setWarn] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setWarn("");
    for (const t of DOC_TYPES) {
      const file = files[t.key];
      if (file && (!ALLOWED_DOC.includes(file.type) || file.size > MAX_DOC_MB * 1024 * 1024)) {
        return setError(`${t.label}: use a JPG, PNG, WebP or PDF under ${MAX_DOC_MB} MB.`);
      }
    }
    setSaving(true);
    let riderId;
    try {
      ({ riderId } = await call("adminCreateRider", { name: f.name, phone: f.phone, email: f.email, password: f.password }));
    } catch (err) {
      setError(errText(err)); setSaving(false); return;
    }
    // The rider now exists. Anything optional that fails is reported, not fatal.
    const problems = [];
    const areas = parseAreas(f.areas);
    if (areas.length) {
      try { await call("setRiderRole", { riderId, assignedAreas: areas }); }
      catch (err) { problems.push(`Areas not saved: ${errText(err)}`); }
    }
    for (const t of DOC_TYPES) {
      if (!files[t.key]) continue;
      try { await uploadDoc(riderId, t.key, files[t.key]); }
      catch (err) { problems.push(`${t.label} not uploaded: ${errText(err)}`); }
    }
    setSaving(false);
    onDone(`Rider ${f.name.trim()} added. Share the email and temporary password with them.${problems.length ? ` ${problems.join(" ")} Add these from Edit.` : ""}`);
    onClose();
  };

  return (
    <Modal title="Add rider" subtitle="Name, email and a temporary password are required; mobile can come later" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div>}
        {warn && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 font-bold text-amber-800">{warn}</div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className={labelCls}>Name *</label><input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} required maxLength={60} /></div>
          <div><label className={labelCls}>Mobile number <span className="normal-case tracking-normal font-semibold text-slate-400">(add later if unknown)</span></label><input className={inputCls} inputMode="numeric" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="10 digits" /></div>
          <div><label className={labelCls}>Email (login) *</label><input type="email" className={inputCls} value={f.email} onChange={(e) => set("email", e.target.value)} required /></div>
          <div><label className={labelCls}>Temporary password *</label><input type="text" autoComplete="off" className={inputCls} value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="At least 8 characters" required minLength={8} /></div>
        </div>
        <div>
          <label className={labelCls}>Assigned areas <span className="normal-case tracking-normal font-semibold text-slate-400">(optional, comma separated)</span></label>
          <input className={inputCls} value={f.areas} onChange={(e) => set("areas", e.target.value)} placeholder="e.g. Baner, Aundh" />
          <p className="mt-1 text-[11px] font-semibold text-slate-400">Use the same area names as orders. An area can belong to one active rider.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DOC_TYPES.map((t) => (
            <DocPicker key={t.key} label={t.label} file={files[t.key]} onFile={(file) => setFiles((x) => ({ ...x, [t.key]: file }))} />
          ))}
        </div>
        <button type="submit" disabled={saving} className="w-full rounded-xl bg-blue-600 py-2.5 font-black text-white hover:bg-blue-700 disabled:opacity-60">
          {saving ? "Adding…" : "Add rider"}
        </button>
      </form>
    </Modal>
  );
}

function EditRiderModal({ rider, allRiders, onClose, onDone }) {
  const [phone, setPhone] = useState(rider.phone || "");
  const [areas, setAreas] = useState((rider.assignedAreas || []).join(", "));
  const [files, setFiles] = useState({ aadhaar: null, license: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      const cleanPhone = phone.replace(/[\s-]/g, "").replace(/^(\+91|91)(?=\d{10}$)/, "");
      if (cleanPhone !== (rider.phone || "")) {
        if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) throw new Error("Enter a valid 10 digit mobile number.");
        if (cleanPhone && allRiders.some((r) => r.id !== rider.id && r.phone === cleanPhone)) throw new Error("Another rider already has this mobile number.");
        await updateDoc(doc(db, "riders", rider.id), { phone: cleanPhone, updatedAt: serverTimestamp() });
      }
      const next = parseAreas(areas);
      const prev = (rider.assignedAreas || []).join("|");
      if (next.join("|") !== prev) await call("setRiderRole", { riderId: rider.id, assignedAreas: next });
      for (const t of DOC_TYPES) if (files[t.key]) await uploadDoc(rider.id, t.key, files[t.key]);
      onDone(`${rider.name} updated.`);
      onClose();
    } catch (err) {
      setError(errText(err)); setSaving(false);
    }
  };

  return (
    <Modal title={`Edit ${rider.name}`} subtitle={`${rider.phone || ""} · ${rider.email || ""}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div>}
        <div>
          <label className={labelCls}>Mobile number</label>
          <input className={inputCls} inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10 digits" />
        </div>
        <div>
          <label className={labelCls}>Assigned areas <span className="normal-case tracking-normal font-semibold text-slate-400">(comma separated)</span></label>
          <input className={inputCls} value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="e.g. Baner, Aundh" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DOC_TYPES.map((t) => (
            <DocPicker key={t.key} label={t.label} file={files[t.key]} onFile={(file) => setFiles((x) => ({ ...x, [t.key]: file }))}
              existing={rider.documents && rider.documents[t.key]} onView={() => viewDoc(rider.documents[t.key])} />
          ))}
        </div>
        <button type="submit" disabled={saving} className="w-full rounded-xl bg-blue-600 py-2.5 font-black text-white hover:bg-blue-700 disabled:opacity-60">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </Modal>
  );
}

function RidersPanel() {
  const [riders, setRiders] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => onSnapshot(query(collection(db, "riders"), limit(300)), (snap) => {
    setRiders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => setError(err.message)), []);

  const say = (m) => { setToast(m); setTimeout(() => setToast(""), 7000); };

  const list = useMemo(() => (riders || [])
    .filter((r) => showRemoved ? !!r.removedAt : !r.removedAt)
    .filter((r) => {
      const q = search.trim().toLowerCase();
      return !q || [r.name, r.phone, r.email, ...(r.assignedAreas || [])].some((v) => String(v || "").toLowerCase().includes(q));
    })
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))), [riders, showRemoved, search]);

  const [removing, setRemoving] = useState(null); // { rider, orders }

  const doRemove = async (r, unassignOrders) => {
    setBusyId(r.id);
    try {
      await call("adminRemoveRider", { riderId: r.id, unassignOrders });
      say(`${r.name} removed.${unassignOrders ? " Their orders are now under Needs a rider in the rider app." : ""}`);
      setRemoving(null);
    } catch (err) { setError(errText(err)); }
    setBusyId("");
  };

  // Looks up the rider's unfinished orders first and shows them before asking.
  const remove = async (r) => {
    setBusyId(r.id);
    let orders;
    try { ({ orders } = await call("adminRiderOpenOrders", { riderId: r.id })); }
    catch (err) { setError(errText(err)); setBusyId(""); return; }
    setBusyId("");
    if (orders.length === 0) {
      if (window.confirm(`Remove ${r.name}? Their login is switched off and they leave the area list. Past orders are kept.`)) doRemove(r, false);
      return;
    }
    setRemoving({ rider: r, orders });
  };

  const roleLabel = (r) => (r.role === "admin" ? "Admin" : r.role === "riderManager" ? "Manager" : "Rider");

  return (
    <div className="space-y-4">
      {error && <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700"><span>{error}</span><button onClick={() => setError("")}>✕</button></div>}
      {toast && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{toast}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, mobile, area…"
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-500" />
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <input type="checkbox" checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} /> Show removed
        </label>
        <button onClick={() => setAdding(true)} className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700">+ Add rider</button>
      </div>

      {riders === null && !error ? (
        <div className="rounded-xl border border-slate-100 p-8 text-center text-sm font-semibold text-slate-400">Loading riders…</div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-slate-100 p-8 text-center text-sm font-semibold text-slate-400">{showRemoved ? "No removed riders." : "No riders yet."}</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Rider</th><th className="px-4 py-3">Mobile</th><th className="px-4 py-3">Areas</th>
                <th className="px-4 py-3">Documents</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {list.map((r) => {
                const docs = r.documents || {};
                const removed = !!r.removedAt;
                const isRider = !r.role || r.role === "rider";
                return (
                  <tr key={r.id} className={removed ? "opacity-60" : ""}>
                    <td className="px-4 py-3"><div className="font-extrabold text-slate-900">{r.name || "—"}</div><div className="text-[11px] text-slate-400">{r.email}{!isRider ? ` · ${roleLabel(r)}` : ""}</div></td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.phone || "—"}</td>
                    <td className="px-4 py-3">{(r.assignedAreas || []).length ? r.assignedAreas.join(", ") : <span className="text-slate-300">Not set</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {DOC_TYPES.map((t) => (
                        <span key={t.key} className={`mr-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${docs[t.key] ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                          {t.key === "aadhaar" ? "Aadhaar" : "License"} {docs[t.key] ? "✓" : "—"}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${removed ? "border-rose-200 bg-rose-50 text-rose-700" : r.onDuty ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                        {removed ? "Removed" : r.onDuty ? "On duty" : "Off duty"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {!removed && (
                        <>
                          <button onClick={() => setEditing(r)} className="mr-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 font-bold text-blue-600 hover:bg-blue-100">Edit</button>
                          {isRider && (
                            <button disabled={busyId === r.id} onClick={() => remove(r)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-60">
                              {busyId === r.id ? "Removing…" : "Remove"}
                            </button>
                          )}
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

      {removing && (
        <Modal title={`Remove ${removing.rider.name}?`} subtitle={`${removing.orders.length} order${removing.orders.length === 1 ? " is" : "s are"} still assigned to this rider`} onClose={() => setRemoving(null)}>
          <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100">
            {removing.orders.map((o) => (
              <div key={`${o.collection}-${o.id}`} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <div className="font-extrabold text-slate-900">#{o.number}{o.collection === "hostels_orders" ? " · Hostel" : ""}</div>
                  <div className="text-slate-500 font-semibold">{o.area || "No area"} · pickup {o.pickupDate || "—"} · drop {o.dropDate || "—"}</div>
                </div>
                <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600">{o.status || "new"}</span>
              </div>
            ))}
          </div>
          <p className="font-semibold text-slate-600">
            If you remove them, these orders are taken off {removing.rider.name} and appear under “Needs a rider” in the rider app until a manager assigns someone. The rider’s login is switched off.
          </p>
          <div className="flex gap-2">
            <button disabled={busyId === removing.rider.id} onClick={() => doRemove(removing.rider, true)} className="flex-1 rounded-xl bg-rose-600 py-2.5 font-black text-white hover:bg-rose-700 disabled:opacity-60">
              {busyId === removing.rider.id ? "Removing…" : "Unassign orders and remove"}
            </button>
            <button onClick={() => setRemoving(null)} className="rounded-xl px-4 py-2.5 font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
          </div>
        </Modal>
      )}
      {adding && <AddRiderModal onClose={() => setAdding(false)} onDone={say} />}
      {editing && <EditRiderModal rider={editing} allRiders={riders || []} onClose={() => setEditing(null)} onDone={say} />}
    </div>
  );
}

export default function AdminRiders() {
  const navigate = useNavigate();
  const { client, logout } = useHostelOrders();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 1024;
      setCollapsed(mobile);
      if (!mobile) setMobileOpen(false);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onSidebar = useCallback((tab) => navigate("/admin", { state: { initialTab: tab } }), [navigate]);

  return (
    <div className="flex min-h-screen bg-white" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <AdminSidebar activeTab="riders" setActiveTab={onSidebar} user={client} onLogout={logout}
        isCollapsed={collapsed} setIsCollapsed={setCollapsed} isMobileOpen={mobileOpen} setIsMobileOpen={setMobileOpen} />
      <main className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ${collapsed ? "lg:ml-[80px]" : "lg:ml-[220px]"} ml-0`}>
        <AdminPageHeader title="Riders" subtitle="Add, edit and remove riders, their areas and documents." onMenuClick={() => setMobileOpen(true)} />
        <div className="px-4 pb-10 pt-6 lg:px-10">
          <SectionErrorBoundary section="riders" title="Riders could not be displayed">
            <RidersPanel />
          </SectionErrorBoundary>
        </div>
      </main>
    </div>
  );
}
