import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu, FiUpload, FiUsers, FiSave, FiCheck, FiAlertCircle, FiX, FiDatabase, FiEdit2 } from "react-icons/fi";
import readXlsxFile from "read-excel-file/browser";
import { collection, getDocs, writeBatch, doc, getDoc, setDoc, Timestamp, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import AdminSidebar from "../components/Layout/AdminSidebar";
import { useHostelAuth } from "../context/HostelAuthContext";
import { db, auth } from "../firebase";

// ─── Constants ───────────────────────────────────────────────────────────────
const COLLECTION        = "meta_ads_leads";
const SETTINGS_DOC      = "meta_ads_settings/config"; // stores admin-entered values like CPC

// Well-known statuses get hand-picked, consistent colours.
// Any unknown status is automatically assigned a unique colour via hash.
const PINNED_STATUS_STYLES = {
  "Pending":            { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  "Closed":             { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
  "No Response":        { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
  "Service Completed":  { bg: "#DBEAFE", text: "#1E40AF", border: "#93C5FD" },
  "Unserviceable":      { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" },
  "Follow-up Required": { bg: "#EDE9FE", text: "#5B21B6", border: "#C4B5FD" },
};

// A palette of 12 visually distinct pastel hues for unknown statuses.
const DYNAMIC_PALETTE = [
  { bg: "#FFF0F6", text: "#9D174D", border: "#FBCFE8" }, // pink
  { bg: "#FFF7ED", text: "#9A3412", border: "#FDBA74" }, // orange
  { bg: "#ECFDF5", text: "#065F46", border: "#6EE7B7" }, // teal
  { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" }, // blue
  { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" }, // violet
  { bg: "#FDF4FF", text: "#7E22CE", border: "#E9D5FF" }, // purple
  { bg: "#ECFEFF", text: "#155E75", border: "#A5F3FC" }, // cyan
  { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" }, // green
  { bg: "#FEF9C3", text: "#854D0E", border: "#FDE047" }, // yellow
  { bg: "#FFF1F2", text: "#881337", border: "#FECDD3" }, // rose
  { bg: "#F0F9FF", text: "#075985", border: "#BAE6FD" }, // sky
  { bg: "#FEFCE8", text: "#713F12", border: "#FEF08A" }, // lime-yellow
];

// Simple djb2-style hash: maps any string to a consistent index in the palette.
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0; // keep 32-bit int
  }
  return Math.abs(hash);
}

// Returns an inline style object { backgroundColor, color, borderColor } for any status.
function getStatusStyle(status) {
  if (!status) return { backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#CBD5E1" };
  const pinned = PINNED_STATUS_STYLES[status];
  if (pinned) return { backgroundColor: pinned.bg, color: pinned.text, borderColor: pinned.border };
  const palette = DYNAMIC_PALETTE[hashString(status) % DYNAMIC_PALETTE.length];
  return { backgroundColor: palette.bg, color: palette.text, borderColor: palette.border };
}

// ─── Security: validate a parsed row ─────────────────────────────────────────
function validateRow(row) {
  const phone = String(row.phone || "").trim();
  if (!phone || phone.length < 6) return null; // must have a phone number
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return null;           // must be at least 6 digits

  return {
    srNo:     String(row.srNo     || "").trim(),
    phone:    phone,
    location: String(row.location || "").trim(),
    status:   String(row.status   || "Pending").trim() || "Pending",
    remarks:  String(row.remarks  || "").trim(),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function AdminMetaAdsLeads() {
  const navigate = useNavigate();
  const { client, logout } = useHostelAuth();
  const fileInputRef = useRef(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed]   = useState(false);
  const [isMobileMenuOpen,   setIsMobileMenuOpen]     = useState(false);
  const [previewData,        setPreviewData]           = useState([]);    // parsed from excel
  const [savedData,          setSavedData]             = useState([]);    // loaded from firebase
  const [activeView,         setActiveView]            = useState("saved"); // "preview" | "saved"
  const [isUploading,        setIsUploading]           = useState(false);
  const [isSaving,           setIsSaving]              = useState(false);
  const [isLoadingDb,        setIsLoadingDb]           = useState(true);
  const [toast,              setToast]                 = useState(null);   // { type, message }
  const [skippedCount,       setSkippedCount]          = useState(0);

  // CPC state
  const [cpc,         setCpc]         = useState(null);   // stored value from Firestore
  const [cpcInput,    setCpcInput]    = useState("");      // editing input value
  const [isEditingCpc, setIsEditingCpc] = useState(false);
  const [isSavingCpc,  setIsSavingCpc]  = useState(false);

  // ── Sidebar resize ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 1024;
      setIsSidebarCollapsed(isMobile);
      if (!isMobile) setIsMobileMenuOpen(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Load existing leads from Firestore ─────────────────────────────────
  useEffect(() => {
    let unsubAuth = () => {};
    unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) { setIsLoadingDb(false); return; }
      try {
        // Load leads
        const snap = await getDocs(query(collection(db, COLLECTION), orderBy("uploadedAt", "desc")));
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setSavedData(rows);

        // Load CPC setting
        const settingsSnap = await getDoc(doc(db, SETTINGS_DOC));
        if (settingsSnap.exists() && settingsSnap.data().cpc != null) {
          setCpc(settingsSnap.data().cpc);
        }
      } catch (err) {
        console.error("Failed to load meta_ads_leads:", err);
      } finally {
        setIsLoadingDb(false);
      }
    });
    return () => unsubAuth();
  }, []);

  // ── Save CPC to Firestore ───────────────────────────────────────────────
  const handleSaveCpc = async () => {
    const val = parseFloat(cpcInput);
    if (isNaN(val) || val < 0) return;
    setIsSavingCpc(true);
    try {
      await setDoc(doc(db, SETTINGS_DOC), { cpc: val }, { merge: true });
      setCpc(val);
      setIsEditingCpc(false);
      setCpcInput("");
      showToast("success", `Cost per click updated to ₹${val.toFixed(2)}`);
    } catch (err) {
      console.error("CPC save error:", err);
      showToast("error", "Failed to save CPC. Check your permissions.");
    } finally {
      setIsSavingCpc(false);
    }
  };

  // ── Sidebar tab routing ─────────────────────────────────────────────────
  const handleSidebarTabChange = useCallback((tab) => {
    setIsMobileMenuOpen(false);
    if (tab === "metaleads") return;
    if (tab === "investors") { navigate("/admin/investors"); return; }
    if (tab === "expenses")  { navigate("/admin/expenses");  return; }
    if (tab === "regular")   { navigate("/admin/regular-orders"); return; }
    if (tab === "calculator"){ navigate("/admin/calculator"); return; }
    navigate("/admin");
  }, [navigate]);

  // ── Show toast helper ───────────────────────────────────────────────────
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  // ── Excel parsing with read-excel-file ──────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    setPreviewData([]);
    setSkippedCount(0);

    try {
      // readXlsxFile automatically reads the File object and returns a 2D array of rows
      const rows = await readXlsxFile(file);

      if (!rows || rows.length === 0) {
        throw new Error("Empty file");
      }

      let skipped = 0;
      const parsed = [];

      // Skip row[0] (header), then map each row to our schema
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        // In read-excel-file, empty cells are null, so we convert them to empty strings
        const raw = {
          srNo:     r[0] != null ? String(r[0]) : "",
          phone:    r[1] != null ? String(r[1]) : "",
          location: r[2] != null ? String(r[2]) : "",
          status:   r[3] != null ? String(r[3]) : "",
          remarks:  r[4] != null ? String(r[4]) : "",
        };
        const valid = validateRow(raw);
        if (!valid) { skipped++; continue; }
        parsed.push(valid);
      }

      setPreviewData(parsed);
      setSkippedCount(skipped);
      setActiveView("preview");

      if (parsed.length === 0) {
        showToast("error", "No valid rows found. Make sure Column B has phone numbers.");
      } else {
        showToast("success", `Loaded ${parsed.length} valid rows${skipped > 0 ? ` (${skipped} skipped – missing phone)` : ""}.`);
      }
    } catch (err) {
      console.error("Excel parse error:", err);
      showToast("error", "Failed to read file. Please upload a valid .xlsx file.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  // ── Save to Firebase with deduplication ────────────────────────────────
  const handleSaveToFirebase = async () => {
    if (previewData.length === 0) return;
    setIsSaving(true);

    try {
      // Security: only an authenticated user can save
      const user = auth.currentUser;
      if (!user) {
        showToast("error", "You must be signed in to save data.");
        setIsSaving(false);
        return;
      }

      // Fetch all existing leads — build a map of phone → { docId, status, remarks, location }
      const existingSnap = await getDocs(collection(db, COLLECTION));
      const existingMap  = {};
      existingSnap.docs.forEach(d => {
        const data = d.data();
        if (data.phone) existingMap[data.phone] = { id: d.id, ...data };
      });

      const now = Timestamp.now();

      const toCreate = [];  // brand new leads
      const toUpdate = [];  // existing leads with changed fields
      let   unchanged = 0;  // existing leads with no changes

      previewData.forEach(lead => {
        const existing = existingMap[lead.phone];

        if (!existing) {
          // Phone not in DB at all → create
          toCreate.push(lead);
        } else {
          // Phone exists → check if any tracked field changed
          const statusChanged   = lead.status   !== existing.status;
          const remarksChanged  = lead.remarks  !== existing.remarks;
          const locationChanged = lead.location !== existing.location;

          if (statusChanged || remarksChanged || locationChanged) {
            toUpdate.push({
              docId: existing.id,
              changes: {
                ...(statusChanged   && { status:   lead.status }),
                ...(remarksChanged  && { remarks:  lead.remarks }),
                ...(locationChanged && { location: lead.location }),
                updatedAt:  now,
                updatedBy:  user.email || user.uid,
              },
            });
          } else {
            unchanged++;
          }
        }
      });

      // Nothing to do at all
      if (toCreate.length === 0 && toUpdate.length === 0) {
        showToast("error", `All ${unchanged} leads are already up to date — nothing to save.`);
        setIsSaving(false);
        return;
      }

      // ── Batch writes in chunks of 500 ──────────────────────────────────
      const CHUNK = 500;
      const allOps = [
        ...toCreate.map(lead => ({ type: "create", lead })),
        ...toUpdate.map(upd  => ({ type: "update", upd  })),
      ];

      for (let i = 0; i < allOps.length; i += CHUNK) {
        const chunk = allOps.slice(i, i + CHUNK);
        const batch = writeBatch(db);

        chunk.forEach(op => {
          if (op.type === "create") {
            const ref = doc(collection(db, COLLECTION));
            batch.set(ref, {
              ...op.lead,
              uploadedBy: user.email || user.uid,
              uploadedAt: now,
            });
          } else {
            const ref = doc(db, COLLECTION, op.upd.docId);
            batch.update(ref, op.upd.changes);
          }
        });

        await batch.commit();
      }

      // Refresh saved view
      const refreshSnap = await getDocs(query(collection(db, COLLECTION), orderBy("uploadedAt", "desc")));
      setSavedData(refreshSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Build a human-readable summary toast
      const parts = [];
      if (toCreate.length > 0) parts.push(`${toCreate.length} new added`);
      if (toUpdate.length > 0) parts.push(`${toUpdate.length} updated`);
      if (unchanged      > 0) parts.push(`${unchanged} unchanged`);
      showToast("success", parts.join(" · "));

      setPreviewData([]);
      setActiveView("saved");

    } catch (err) {
      console.error("Firebase save error:", err);
      showToast("error", "Failed to save. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const displayData = activeView === "preview" ? previewData : savedData;

  // ── KPI stats — computed from saved DB data only ──────────────────────
  const kpiStats = useMemo(() => {
    const total = savedData.length;
    const statusCounts = {};
    savedData.forEach(lead => {
      const s = lead.status || "Unknown";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    return { total, statusCounts };
  }, [savedData]);

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-[#F1F5F9]" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <AdminSidebar
        activeTab="metaleads"
        setActiveTab={handleSidebarTabChange}
        user={client}
        onLogout={logout}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />

      <main
        className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ${
          isSidebarCollapsed ? "lg:ml-[80px]" : "lg:ml-[220px]"
        } ml-0`}
      >
        {/* ── Top Bar ── */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#F1F5F9]/95 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
              >
                <FiMenu size={20} />
              </button>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Admin Portal</p>
                <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-950">
                  <FiUsers size={20} className="text-blue-500" />
                  Meta Ads Leads
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Upload Excel */}
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
                <FiUpload size={15} />
                {isUploading ? "Reading…" : "Upload Excel"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>

              {/* Save to Firebase — only visible in preview mode with data */}
              {activeView === "preview" && previewData.length > 0 && (
                <button
                  onClick={handleSaveToFirebase}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {isSaving
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    : <FiSave size={15} />
                  }
                  {isSaving ? "Saving…" : `Save ${previewData.length} Leads`}
                </button>
              )}
            </div>
          </div>

          {/* ── Sub-tabs ── */}
          <div className="flex items-center gap-1 border-t border-slate-100 bg-white px-4 py-2 lg:px-8">
            <button
              onClick={() => setActiveView("saved")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${
                activeView === "saved"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <FiDatabase size={14} />
              Saved in DB
              {savedData.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                  activeView === "saved" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {savedData.length}
                </span>
              )}
            </button>

            <button
              onClick={() => previewData.length > 0 && setActiveView("preview")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${
                activeView === "preview"
                  ? "bg-amber-500 text-white shadow"
                  : previewData.length > 0
                    ? "text-slate-500 hover:bg-slate-100"
                    : "cursor-not-allowed text-slate-300"
              }`}
            >
              <FiUpload size={14} />
              Preview Upload
              {previewData.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                  activeView === "preview" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"
                }`}>
                  {previewData.length}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* ── Toast ── */}
        {toast && (
          <div className={`fixed right-6 top-6 z-[100] flex items-start gap-3 rounded-2xl border px-5 py-4 shadow-xl backdrop-blur-md ${
            toast.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}>
            {toast.type === "success" ? <FiCheck className="mt-0.5 shrink-0" /> : <FiAlertCircle className="mt-0.5 shrink-0" />}
            <p className="text-sm font-semibold">{toast.message}</p>
            <button onClick={() => setToast(null)} className="ml-2 text-current opacity-60 hover:opacity-100">
              <FiX size={14} />
            </button>
          </div>
        )}

        {/* ── Main Content ── */}
        <div className="flex flex-1 flex-col p-4 lg:p-8">

          {/* ── KPI Cards — shown only in saved view ── */}
          {activeView === "saved" && !isLoadingDb && (
            <div className="mb-6 flex flex-col sm:flex-row gap-4">

              {/* Total Impressions */}
              <div className="flex flex-col justify-between rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-600 to-indigo-600 p-5 shadow-sm shadow-blue-200 min-w-[180px]">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-200">Total Impressions</p>
                <p className="mt-3 text-4xl font-black text-white leading-none">
                  {kpiStats.total > 0 ? kpiStats.total.toLocaleString() : "—"}
                </p>
                <p className="mt-2 text-[11px] font-semibold text-blue-200">Leads from Meta Ads</p>
              </div>

              {/* Cost Per Click — admin editable */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm min-w-[180px] relative group">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Cost Per Click</p>
                  {!isEditingCpc && (
                    <button
                      onClick={() => { setIsEditingCpc(true); setCpcInput(cpc != null ? String(cpc) : ""); }}
                      title="Edit CPC"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                    >
                      <FiEdit2 size={13} />
                    </button>
                  )}
                </div>

                {isEditingCpc ? (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-slate-400 font-black text-lg">₹</span>
                    <input
                      autoFocus
                      type="number"
                      min="0"
                      step="0.01"
                      value={cpcInput}
                      onChange={e => setCpcInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSaveCpc(); if (e.key === "Escape") setIsEditingCpc(false); }}
                      className="w-24 border-b-2 border-blue-500 bg-transparent text-2xl font-black text-slate-900 focus:outline-none"
                      placeholder="0.00"
                    />
                    <button
                      onClick={handleSaveCpc}
                      disabled={isSavingCpc}
                      className="ml-1 flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSavingCpc
                        ? <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                        : <FiCheck size={12} />}
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditingCpc(false)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-4xl font-black text-slate-900 leading-none">
                    {cpc != null ? `₹${Number(cpc).toFixed(2)}` : <span className="text-slate-300 text-2xl">Not set</span>}
                  </p>
                )}

                <p className="mt-2 text-[11px] font-semibold text-slate-400">
                  {cpc != null ? "Hover card to edit" : "Click ✏ to set value"}
                </p>
              </div>

            </div>
          )}

          {/* Info banner for preview mode */}
          {activeView === "preview" && previewData.length > 0 && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <FiAlertCircle className="shrink-0 text-amber-600" />
              <p className="text-sm font-semibold text-amber-800">
                Previewing <span className="font-black">{previewData.length}</span> rows from your Excel file.
                {skippedCount > 0 && <> <span className="font-black text-red-600">{skippedCount} rows skipped</span> (missing phone number).</>}
                {" "}Click <span className="font-black">"Save Leads"</span> to push them to Firebase.
              </p>
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    {["Sr. No.", "Phone Number", "Location / Address", "Status", "Remarks"].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {h}
                      </th>
                    ))}
                    {activeView === "saved" && (
                      <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Uploaded By
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoadingDb && activeView === "saved" ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                          <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
                          <p className="text-sm font-semibold">Loading from database…</p>
                        </div>
                      </td>
                    </tr>
                  ) : displayData.length > 0 ? (
                    displayData.map((lead, i) => (
                      <tr key={lead.id || i} className="transition-colors hover:bg-slate-50">
                        <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-500">{lead.srNo || "-"}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-sm font-semibold text-slate-900">{lead.phone || "-"}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{lead.location || "-"}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-sm">
                          {(() => {
                            const style = getStatusStyle(lead.status);
                            return (
                              <span
                                style={{
                                  backgroundColor: style.backgroundColor,
                                  color: style.color,
                                  borderColor: style.borderColor,
                                  borderWidth: "1px",
                                  borderStyle: "solid",
                                }}
                                className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
                              >
                                {lead.status || "Unknown"}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="max-w-xs truncate px-5 py-3.5 text-sm text-slate-600" title={lead.remarks}>
                          {lead.remarks || "-"}
                        </td>
                        {activeView === "saved" && (
                          <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-400">
                            {lead.uploadedBy || "-"}
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                            <FiUsers size={28} className="text-slate-400" />
                          </div>
                          <p className="text-base font-bold text-slate-700">
                            {activeView === "saved" ? "No leads saved yet" : "No preview data"}
                          </p>
                          <p className="text-sm text-slate-400">
                            {activeView === "saved"
                              ? "Upload an Excel file from Meta Ads and save it to the database."
                              : "Upload an Excel file to preview the data here."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer row count */}
            {displayData.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
                <p className="text-xs font-semibold text-slate-500">
                  {displayData.length} record{displayData.length !== 1 ? "s" : ""}
                  {activeView === "preview" ? " — not yet saved" : " in database"}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
