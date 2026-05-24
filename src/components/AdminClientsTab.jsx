import { useCallback, useMemo, useState } from "react";
import { FiEdit2, FiPlus, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import EmptyState from "./EmptyState";
import { normalizePropertyName } from "../utils/orderNormalization";

function normalizeList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((v) => String(v).trim()).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function buildEditableManager(source) {
  const partnernames = source?.partnernames || source?.properties || [];
  const cleanedPartnernames = normalizeList(partnernames);

  return {
    uid: source?.uid || "",
    id: source?.id || "",
    name: source?.name || "",
    email: source?.email || "",
    role: source?.role || "client",
    isGroup: Boolean(source?.isGroup) || cleanedPartnernames.length > 1,
    partnernames: cleanedPartnernames,
    monthlyBilling: source?.monthlyBilling ?? "",
  };
}

export default function AdminClientsTab({ managers, onSaveManager, onDeleteManager }) {
  const [query, setQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [draft, setDraft] = useState(() => buildEditableManager(null));

  const clients = useMemo(
    () => (managers || []).filter((manager) => String(manager?.role || "") !== "admin"),
    [managers],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;

    return clients.filter((manager) => {
      const name = String(manager?.name || "").toLowerCase();
      const email = String(manager?.email || "").toLowerCase();
      const uid = String(manager?.uid || "").toLowerCase();
      const id = String(manager?.id || "").toLowerCase();
      const partnernames = normalizeList(manager?.partnernames || manager?.properties).join(",").toLowerCase();
      return (
        name.includes(q)
        || email.includes(q)
        || uid.includes(q)
        || id.includes(q)
        || partnernames.includes(q)
      );
    });
  }, [clients, query]);

  const openCreate = useCallback(() => {
    setFormError(null);
    setDraft(buildEditableManager(null));
    setIsModalOpen(true);
  }, []);

  const openTemplate = useCallback((templateKey) => {
    setFormError(null);
    if (templateKey === "treebo_trend") {
      setDraft({
        uid: "",
        id: "client-treebo-trend",
        name: "Treebo Trend Hotel",
        email: "",
        role: "client",
        isGroup: false,
        partnernames: ["Treebo Trend"],
      });
      setIsModalOpen(true);
      return;
    }

    setDraft(buildEditableManager(null));
    setIsModalOpen(true);
  }, []);

  const openEdit = useCallback((manager) => {
    setFormError(null);
    setDraft(buildEditableManager(manager));
    setIsModalOpen(true);
  }, []);


  const closeModal = useCallback(() => {
    if (submitting) return;
    setIsModalOpen(false);
  }, [submitting]);

  const handleSubmit = useCallback(async () => {
    setFormError(null);
    setSubmitting(true);

    try {
      const uid = String(draft.uid || "").trim();
      const email = String(draft.email || "").trim();
      const name = String(draft.name || "").trim();
      const role = String(draft.role || "client").trim();
      const partnernames = normalizeList(draft.partnernames).map(name => normalizePropertyName(name));
      const monthlyBillingNumber = draft.monthlyBilling === "" ? undefined : Number(draft.monthlyBilling);
      if (monthlyBillingNumber !== undefined && !Number.isFinite(monthlyBillingNumber)) {
        throw new Error("Monthly billing must be a number.");
      }

      if (!uid) throw new Error("Firebase Auth UID is required (document ID).");
      if (!email) throw new Error("Email is required.");
      if (!name) throw new Error("Name is required.");

      await onSaveManager({
        uid,
        id: String(draft.id || "").trim() || undefined,
        email,
        name,
        role,
        isGroup: draft.isGroup || partnernames.length > 1,
        partnernames,
        monthlyBilling: monthlyBillingNumber,
        updatedAt: new Date().toISOString(),
      });

      setIsModalOpen(false);
    } catch (error) {
      setFormError(error?.message || "Failed to save client profile.");
    } finally {
      setSubmitting(false);
    }
  }, [draft, onSaveManager]);

  return (
    <div className="space-y-6 animate-fade-in" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[12px] font-black uppercase tracking-widest text-blue-700">How client login works</p>
            <ul className="mt-2 text-[13px] font-semibold text-slate-700 space-y-1">
              <li>1) Create the user in Firebase Authentication (email + password)</li>
              <li>2) Copy the user&apos;s <span className="font-black">UID</span></li>
              <li>3) Create/update Firestore doc: <span className="font-black">b2b_managers/{`{UID}`}</span> with <span className="font-black">role: &quot;client&quot;</span> and <span className="font-black">partnernames</span></li>
              <li>4) Client signs in from <span className="font-black">/login</span> → app loads the matching Firestore profile by UID</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 sm:min-w-[220px]">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Quick templates</p>
            <button
              onClick={() => openTemplate("treebo_trend")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-black text-blue-700 shadow-sm ring-1 ring-blue-100 hover:bg-blue-50 active:scale-[0.99]"
            >
              <FiPlus size={16} />
              Treebo Trend Hotel
            </button>
            <p className="text-[12px] font-semibold text-slate-500">
              Paste UID + email, adjust properties, save.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xl flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, UID, or property..."
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-[13px] font-black text-white shadow-sm hover:bg-blue-700 active:scale-[0.99]"
        >
          <FiPlus size={16} />
          New Client Profile
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No clients found"
          message="Create a client profile after adding the user in Firebase Authentication."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Name</th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Email</th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Role</th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Properties</th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">UID</th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((manager) => {
                  const partnernames = normalizeList(manager?.partnernames || manager?.properties);
                  return (
                    <tr key={manager.uid} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-black text-slate-900">{manager.name || "-"}</p>
                        {manager.id && (
                          <p className="text-[11px] font-black text-slate-400">{manager.id}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-semibold text-slate-700">{manager.email || "-"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700 uppercase tracking-wider">
                          {manager.role || "client"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-semibold text-slate-700">
                          {partnernames.length ? partnernames.join(", ") : "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[12px] font-mono text-slate-600">{manager.uid}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(manager)}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-700"
                            title="Edit profile"
                          >
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            onClick={() => onDeleteManager(manager.uid)}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Delete profile"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Client Profile</p>
                <h2 className="text-[16px] font-black text-slate-900">{draft.uid ? "Edit Client" : "New Client"}</h2>
              </div>
              <button
                onClick={closeModal}
                className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-red-600"
                title="Close"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-slate-500">
                    Firebase Auth UID (Doc ID)
                  </label>
                  <input
                    value={draft.uid}
                    onChange={(e) => setDraft((prev) => ({ ...prev, uid: e.target.value }))}
                    placeholder="Paste UID from Firebase Authentication"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-slate-500">
                    Internal ID (optional)
                  </label>
                  <input
                    value={draft.id}
                    onChange={(e) => setDraft((prev) => ({ ...prev, id: e.target.value }))}
                    placeholder="e.g. client-treebo"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-slate-500">
                    Name
                  </label>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Treebo Trend Hotel"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-slate-500">
                    Email
                  </label>
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="treebo@example.com"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-slate-500">
                    Role
                  </label>
                  <select
                    value={draft.role}
                    onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500"
                  >
                    <option value="client">client</option>
                    <option value="investor">investor</option>
                  </select>
                </div>

                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.isGroup)}
                      onChange={(e) => setDraft((prev) => ({ ...prev, isGroup: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Group account (multiple properties)
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-slate-500">
                  Monthly Billing (₹)
                </label>
                <input
                  inputMode="numeric"
                  value={draft.monthlyBilling}
                  onChange={(e) => setDraft((prev) => ({ ...prev, monthlyBilling: e.target.value }))}
                  placeholder="e.g. 32000"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-slate-500">
                  Partner names / Properties (comma separated)
                </label>
                <textarea
                  value={Array.isArray(draft.partnernames) ? draft.partnernames.join(", ") : String(draft.partnernames || "")}
                  onChange={(e) => setDraft((prev) => ({ ...prev, partnernames: e.target.value }))}
                  rows={3}
                  placeholder='Example: "Treebo Trend", "Treebo Trend Hotel ABC"'
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-500"
                />
                <p className="mt-2 text-[12px] font-semibold text-slate-500">
                  Tip: The client only sees orders where <span className="font-black">order.property</span> or <span className="font-black">order.linkedHostel</span> contains one of these names.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-[13px] font-black text-slate-600 hover:bg-slate-200 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-[13px] font-black text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
