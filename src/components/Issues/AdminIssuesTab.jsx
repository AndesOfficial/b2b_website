import { useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiAlertTriangle, FiPlus, FiX, FiCheck, FiEdit2, FiTrash2 } from "react-icons/fi";
import { BiRupee } from "react-icons/bi";
import EmptyState from "../Shared/EmptyState";
import { formatTimeSlot } from "../../utils/formatUtils";
import { useHostelAuth } from "../../context/HostelAuthContext";

const ISSUE_TYPES = [
  // Admin-entered types
  "Missing Items", "Damage", "Quality Issue", "Stain Issue", "Return Pending", "Weight Dispute", "Bags Pending",
  // Hostel form categories
  "Missing Clothes", "Damaged / Torn Clothes", "Wrong Clothes Delivered",
  "Late Delivery", "Poor Washing Quality", "Incorrect Billing", "Staff Behaviour", "Other",
];
const SEVERITY_ORDER = { critical: 0, pending: 1 };
const RESOLVE_COLORS = { Unresolved: "bg-red-100 text-red-600", Checking: "bg-yellow-100 text-yellow-700", Resolved: "bg-green-100 text-green-600" };
const TYPE_COLORS = {
  "Missing Items": "#DC2626", "Damage": "#D97706", "Quality Issue": "#7C3AED",
  "Stain Issue": "#9333EA", "Return Pending": "#0891B2", "Weight Dispute": "#BE185D", "Bags Pending": "#DC2626",
  // Hostel categories
  "Missing Clothes": "#DC2626", "Damaged / Torn Clothes": "#D97706", "Wrong Clothes Delivered": "#0891B2",
  "Late Delivery": "#F59E0B", "Poor Washing Quality": "#7C3AED", "Incorrect Billing": "#BE185D",
  "Staff Behaviour": "#6B7280", "Other": "#374151",
};

export default function AdminIssuesTab({ orders, onAddIssue, onEditIssue, onDeleteIssue }) {
  const { isViewer } = useHostelAuth();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    id: null, date: "", issueType: "Missing Items", description: "",
    linkedHostel: "", assignedTo: "", severity: "pending", resolveStatus: "Unresolved", solution: "",
    originalService: "", source: ""
  });
  const [statusFilter, setStatusFilter] = useState("All"); // All, Pending, Critical, Resolved

  const openEditModal = (issue) => {
    setForm({
      id: issue.id,
      date: issue.date || "",
      issueType: issue.issueType || "Missing Items",
      description: issue.service || "",
      linkedHostel: issue.linkedHostel || "",
      assignedTo: issue.reportedBy || "",
      severity: issue.severity || "pending",
      resolveStatus: issue.resolveStatus || "Unresolved",
      solution: issue.solution || "",
      originalService: issue.service || "",
      source: issue.source || ""
    });
    setShowModal(true);
  };

  const isResolved = (i) => i.resolveStatus === "Resolved";
  const allIssues = useMemo(() => orders.filter(o => o.category === "ISSUES"), [orders]);

  const issues = useMemo(() => {
    let list = allIssues;
    // Pending = not resolved; Critical = critical and still open (what needs action now).
    if (statusFilter === "Pending") list = list.filter(i => !isResolved(i));
    else if (statusFilter === "Critical") list = list.filter(i => i.severity === "critical" && !isResolved(i));
    else if (statusFilter === "Resolved") list = list.filter(isResolved);

    return [...list].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99) || new Date(b.date) - new Date(a.date));
  }, [allIssues, statusFilter]);

  const kpis = useMemo(() => ({
    pending: allIssues.filter(i => !isResolved(i)).length,
    critical: allIssues.filter(i => i.severity === "critical" && !isResolved(i)).length,
    resolved: allIssues.filter(isResolved).length,
  }), [allIssues]);

  const handleSubmit = () => {
    const descriptionValue = (form.description || form.originalService || "").trim();
    if (!descriptionValue && !form.id) return;
    const issueData = {
      property: "Issues",
      category: "ISSUES",
      type: "issue",
      date: form.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0],
      amount: 0,
      service: descriptionValue,
      issueType: form.issueType,
      severity: form.severity,
      resolveStatus: form.resolveStatus,
      status: form.resolveStatus === "Resolved" ? "Resolved" : "Pending",
      reportedBy: form.assignedTo || "Admin",
      solution: form.solution,
      linkedHostel: form.linkedHostel,
      source: form.source,
    };

    if (form.id) {
      issueData.id = form.id;
      onEditIssue(issueData);
    } else {
      issueData.id = `issue-new-${Date.now()}`;
      onAddIssue(issueData);
    }

    setShowModal(false);
    setForm({ id: null, date: "", issueType: "Missing Items", description: "", linkedHostel: "", assignedTo: "", severity: "pending", resolveStatus: "Unresolved", solution: "", originalService: "" });
  };

  return (
    <div className="space-y-6" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* KPI cards — click to filter the list */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { value: "Pending", label: "Pending Issues", count: kpis.pending, hint: "Not yet resolved", icon: FiClock, iconBg: "bg-amber-50", iconColor: "text-amber-500", text: "text-amber-600" },
          { value: "Critical", label: "Critical Issues", count: kpis.critical, hint: "Critical and still open", icon: FiAlertTriangle, iconBg: "bg-red-50", iconColor: "text-red-500", text: "text-red-600" },
          { value: "Resolved", label: "Resolved Issues", count: kpis.resolved, hint: "Closed", icon: FiCheckCircle, iconBg: "bg-emerald-50", iconColor: "text-emerald-500", text: "text-emerald-600" },
        ].map((card) => (
          <button
            key={card.value}
            type="button"
            onClick={() => setStatusFilter(statusFilter === card.value ? "All" : card.value)}
            className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 text-left transition-all hover:shadow-md ${statusFilter === card.value ? "ring-2 ring-offset-1 ring-slate-400" : ""}`}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center`}><card.icon size={16} className={card.iconColor} /></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</span>
            </div>
            <p className={`text-[28px] font-black ${card.text} tracking-tight leading-none`}>{card.count}</p>
            <p className="text-[11px] font-bold text-slate-400">{card.hint}</p>
          </button>
        ))}
      </div>

      {onAddIssue && !isViewer && (
        <div className="flex justify-end">
          <button onClick={() => { setForm({ id: null, date: "", issueType: "Missing Items", description: "", linkedHostel: "", assignedTo: "", severity: "pending", resolveStatus: "Unresolved", solution: "", originalService: "" }); setShowModal(true); }} className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white text-[12px] font-black rounded-xl hover:bg-red-700 transition-all shadow-md active:scale-95 uppercase tracking-widest">
            <FiPlus size={18} /> Report New Issue
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm transition-all">
        <div className="flex items-center gap-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex-shrink-0">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[12px] font-bold text-slate-600 focus:outline-none focus:ring-1 focus:ring-red-500 appearance-none min-w-[140px]">
            <option value="All">All Issues</option>
            <option value="Pending">Pending</option>
            <option value="Critical">Critical (open)</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>

        {statusFilter !== "All" && (
          <button
            onClick={() => setStatusFilter("All")}
            className="w-fit text-[10px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest flex items-center gap-1.5 transition-colors">
            <FiX size={14} /> Clear Selected Filters
          </button>
        )}
      </div>

      {/* Issue List */}
      <div className="space-y-4">
        {issues.map(issue => (
          <div key={issue.id} className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 transition-all hover:shadow-md group ${issue.severity === "critical" ? 'border-l-4 border-l-red-500' : ''}`}>
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex flex-col gap-2 flex-shrink-0 min-w-[120px]">
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider text-center" style={{ backgroundColor: (TYPE_COLORS[issue.issueType] || '#6B7280') + '15', color: TYPE_COLORS[issue.issueType] || '#6B7280' }}>
                  {issue.issueType}
                </span>
                {issue.severity === "critical" && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white uppercase tracking-widest text-center shadow-sm">Critical</span>
                )}
              </div>
              <div className="flex-1">
                <p className="text-[13.5px] font-bold text-[#0F172A] leading-relaxed">{issue.service}</p>

                {/* Room + Source tags */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {issue.room && (
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                      Room {issue.room}
                    </span>
                  )}
                  {issue.source === "complaint" && (
                    <span className="text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full">
                      Hostel Form
                    </span>
                  )}
                </div>

                {/* Photo thumbnails */}
                {issue.photoUrls?.length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {issue.photoUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={`photo-${i + 1}`}
                          className="w-12 h-12 object-cover rounded-lg border border-gray-100 shadow-sm hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                )}

                {issue.solution && (
                  <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <p className="text-[12px] text-emerald-800 font-medium italic select-none">Resolution: {issue.solution}</p>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">
                  <span>{issue.date}</span>
                  {issue.reportedBy && <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-gray-300" /> reported by {issue.reportedBy}</span>}
                  {issue.linkedHostel && <span className="flex items-center gap-1.5 text-blue-500"><div className="w-1 h-1 rounded-full bg-blue-300" /> {issue.linkedHostel}</span>}
                  {issue.customerName && issue.customerName !== issue.reportedBy && <span className="flex items-center gap-1.5 text-fuchsia-500"><div className="w-1 h-1 rounded-full bg-fuchsia-300" /> student: {issue.customerName}</span>}
                  {issue.pickupDate && <span className="flex items-center gap-1.5 text-teal-500"><div className="w-1 h-1 rounded-full bg-teal-300" /> picked: {formatTimeSlot(issue.pickupDate)}</span>}
                  {issue.deliveryDate && <span className="flex items-center gap-1.5 text-orange-500"><div className="w-1 h-1 rounded-full bg-orange-300" /> delivered: {formatTimeSlot(issue.deliveryDate)}</span>}
                  {issue.linkedOrderId && <span className="flex items-center gap-1.5 text-indigo-500"><div className="w-1 h-1 rounded-full bg-indigo-300" /> Order ID: {issue.linkedOrderId}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase border ${issue.resolveStatus === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    issue.resolveStatus === 'Checking' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                      'bg-red-50 text-red-700 border-red-100'
                  }`}>
                  {issue.resolveStatus}
                </span>
                {!isViewer && (
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onEditIssue && (
                      <button onClick={() => openEditModal(issue)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <FiEdit2 size={14} />
                      </button>
                    )}
                    {onDeleteIssue && (
                      <button onClick={() => onDeleteIssue(issue)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <FiTrash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {issues.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden py-12">
            <EmptyState
              icon={FiCheckCircle}
              title="All systems clear"
              message="No outstanding issues or complaints for this period."
            />
          </div>
        )}
      </div>

      {/* Add Issue Modal - Simplified Styling */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-w-lg flex flex-col overflow-hidden animate-slide-up sm:animate-fade-in max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
            <div className="flex items-center justify-between p-6 sm:p-8 border-b border-gray-50 bg-slate-50/30 flex-shrink-0">
              <div>
                <h2 className="text-lg font-black text-[#0F172A] tracking-tight">{form.id ? 'Modify Issue Report' : 'New Issue Report'}</h2>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mt-0.5">Andes Audit & Compliance</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                <FiX size={24} />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Date of Incident</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-red-500 focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Category</label>
                  <select value={form.issueType} onChange={e => setForm({ ...form, issueType: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-red-500 focus:outline-none transition-all bg-no-repeat bg-right">
                    {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Description of Issue</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-red-500 focus:outline-none resize-none transition-all" placeholder="Enter full details..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Linked Client</label>
                  <input type="text" value={form.linkedHostel} onChange={e => setForm({ ...form, linkedHostel: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-red-500 focus:outline-none transition-all" placeholder="Search client..." />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Reported By</label>
                  <input type="text" value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-red-500 focus:outline-none transition-all" placeholder="Enter name..." />
                </div>
              </div>

              {form.id && (
                <div className="pt-4 border-t border-slate-100 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Severity Level</label>
                      <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black text-red-600 focus:bg-white focus:outline-none uppercase tracking-widest">
                        <option value="pending">Standard</option>
                        <option value="critical text-red-600">!! Critical !!</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Resolution Status</label>
                      <select value={form.resolveStatus} onChange={e => setForm({ ...form, resolveStatus: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:outline-none">
                        <option value="Unresolved">Unresolved</option>
                        <option value="Checking">Under Investigation</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Final Solution Notes</label>
                    <textarea value={form.solution} onChange={e => setForm({ ...form, solution: e.target.value })} rows={2}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-emerald-700 focus:bg-emerald-50 focus:border-emerald-500 focus:outline-none resize-none transition-all" placeholder="What was done to resolve this?" />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-black text-[13px] rounded-xl hover:bg-slate-200 transition-all uppercase tracking-widest">Cancel</button>
              <button onClick={handleSubmit} disabled={!form.description && !form.id}
                className="flex-[2] py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-[13px] rounded-xl transition-all shadow-lg active:scale-95 uppercase tracking-widest">
                {form.id ? 'Update Record' : 'Submit for Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
